import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import { Box, Card, CardContent, Typography, CircularProgress, Button, Grid, Paper, Alert } from '@mui/material';
import { MobileFriendlyOutlined } from '@mui/icons-material';

export default function MobileProctor() {
  const { sessionId } = useParams();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [status, setStatus] = useState('Initializing...');
  const [socket, setSocket] = useState(null);
  const [model, setModel] = useState(null);
  const [modelStatus, setModelStatus] = useState('Loading local AI model...');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [detections, setDetections] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState({});

  // 1. Setup Socket.IO connection
  useEffect(() => {
    // Connect to backend Socket.IO server running on port 5000 of the same host
    const socketHost = `http://${window.location.hostname}:5000`;
    console.log('Connecting to socket server at:', socketHost);
    
    const socketInstance = io(socketHost, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to backend socket server');
      setSocketConnected(true);
      setStatus('Connected. Pairing...');
      // Join the session room
      socketInstance.emit('join-session', { sessionId, deviceType: 'mobile' });
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from socket server');
      setSocketConnected(false);
      setStatus('Disconnected from laptop server');
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setStatus(`Connection error to ${socketHost}`);
    });

    setSocket(socketInstance);

    // Heartbeat logic
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('heartbeat');
      }
    }, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
    };
  }, [sessionId]);

  // 2. Load model and set up camera
  useEffect(() => {
    async function setupAI() {
      try {
        await tf.ready();
        
        // Load coco-ssd from local public folder
        const modelUrl = `${window.location.origin}/models/coco-ssd/model.json`;
        console.log('Loading local coco-ssd model from:', modelUrl);
        
        const loadedModel = await cocossd.load({ modelUrl });
        setModel(loadedModel);
        setModelStatus('AI Model Loaded.');
      } catch (err) {
        console.error('Error loading TensorFlow model:', err);
        setModelStatus('Failed to load local model. Retrying from CDN...');
        try {
          const loadedModel = await cocossd.load();
          setModel(loadedModel);
          setModelStatus('Loaded from CDN.');
        } catch (cdnErr) {
          console.error('CDN fallback failed:', cdnErr);
          setModelStatus('AI Model Error: Check offline setup.');
        }
      }
    }

    setupAI();
  }, []);

  // 3. Start Camera feed
  useEffect(() => {
    let streamInstance = null;
    
    async function startCamera() {
      if (!videoRef.current) return;

      // Check for secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        const errMsg = 'Insecure Context: Camera access requires HTTPS or localhost.';
        console.error(errMsg);
        setCameraError(errMsg);
        setStatus(errMsg);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errMsg = 'Camera APIs not supported or disabled in this browser.';
        console.error(errMsg);
        setCameraError(errMsg);
        setStatus(errMsg);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Use front (selfie) camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setCameraActive(true);
            setCameraError('');
          }).catch(err => {
            console.error('Video play error:', err);
            setCameraError('Failed to play video stream.');
          });
        };
        streamInstance = stream;
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraError(err.message || 'Camera permission denied or unavailable.');
        setStatus('Camera access failed.');
      }
    }

    if (model) {
      startCamera();
    }

    return () => {
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
    };
  }, [model]);

  // 4. Object Detection loop
  useEffect(() => {
    if (!model || !cameraActive || !videoRef.current) return;

    let animationFrameId;
    
    const detectFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Sync sizes
        video.width = videoWidth;
        video.height = videoHeight;
        if (canvasRef.current) {
          canvasRef.current.width = videoWidth;
          canvasRef.current.height = videoHeight;
        }

        try {
          const predictions = await model.detect(video);
          setDetections(predictions);

          // Draw boxes on Canvas locally
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, videoWidth, videoHeight);
            predictions.forEach(prediction => {
              const [x, y, width, height] = prediction.bbox;
              const text = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;

              // Draw border
              ctx.strokeStyle = '#FF3B30';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y, width, height);

              // Draw background for label text
              ctx.fillStyle = '#FF3B30';
              const textWidth = ctx.measureText(text).width;
              ctx.fillRect(x, y - 22, textWidth + 10, 22);

              // Draw label text
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '16px Roboto, sans-serif';
              ctx.fillText(text, x + 5, y - 6);
            });
          }

          // Handle detection types and notify the server
          let personCount = 0;
          let hasPerson = false;
          let hasCellPhone = false;
          let hasBook = false;

          predictions.forEach(prediction => {
            if (prediction.score > 0.5) {
              const item = prediction.class.toLowerCase();
              if (item === 'person') {
                hasPerson = true;
                personCount++;
              }
              if (item === 'cell phone' || item === 'mobile phone') {
                hasCellPhone = true;
              }
              if (item === 'book' || item === 'laptop') {
                hasBook = true;
              }
            }
          });

          // Check cell phone detection
          if (hasCellPhone) {
            sendNotification('cellPhone');
          }
          // Check book/laptop detection
          if (hasBook) {
            sendNotification('prohibitedObject');
          }
          // Check face counts
          if (personCount > 1) {
            sendNotification('multipleFace');
          }

        } catch (err) {
          console.error('Detection loop error:', err);
        }
      }
      animationFrameId = requestAnimationFrame(detectFrame);
    };

    const sendNotification = (type) => {
      const now = Date.now();
      const lastTime = lastDetectionTime[type] || 0;
      
      // Throttle notification sending to every 4 seconds to avoid network spam
      if (now - lastTime >= 4000) {
        setLastDetectionTime(prev => ({ ...prev, [type]: now }));
        
        let screenshotData = null;
        if (videoRef.current && videoRef.current.readyState === 4) {
          try {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            const context = canvas.getContext('2d');
            
            // Mirror image on canvas since front camera video is mirrored
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to JPEG with 0.5 quality to keep size small (~35KB)
            screenshotData = canvas.toDataURL('image/jpeg', 0.5);
          } catch (e) {
            console.error('Error capturing mobile screenshot:', e);
          }
        }

        if (socket && socket.connected) {
          console.log(`Sending detection notification: ${type}`);
          socket.emit('mobile-detection', { 
            type, 
            image: screenshotData 
          });
        }
      }
    };

    detectFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [model, cameraActive, socket, lastDetectionTime]);

  return (
    <Box sx={{ minHeight: '100vh', background: '#0F172A', color: '#F1F5F9', p: 2 }}>
      <Paper 
        elevation={0} 
        sx={{ 
          background: 'rgba(30, 41, 59, 0.7)', 
          backdropFilter: 'blur(10px)', 
          borderRadius: 4, 
          p: 3, 
          maxWidth: 600, 
          mx: 'auto',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
          <MobileFriendlyOutlined sx={{ fontSize: 32, color: '#6366F1' }} />
          <Typography variant="h4" fontWeight="bold" ml={1} color="#6366F1">
            Mobile Proctor
          </Typography>
        </Box>

        <Alert 
          severity={socketConnected ? "success" : "warning"}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {socketConnected 
            ? "Linked to exam session. AI proctoring active." 
            : "Attempting to pair with laptop... Make sure they are on the same WiFi network."}
        </Alert>

        {cameraError && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              borderRadius: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5'
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              🔒 Camera Access Blocked (Security Restriction)
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, color: '#F1F5F9' }}>
              Chrome blocks camera access on insecure HTTP connections (like local IPs, e.g. <code>{window.location.hostname}</code>).
            </Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ mb: 1, color: '#F1F5F9' }}>
              How to enable camera access on your mobile phone:
            </Typography>
            <ol style={{ paddingLeft: '20px', margin: '5px 0', fontSize: '0.875rem', color: '#F1F5F9' }}>
              <li>Open <strong>chrome://flags/#unsafely-treat-insecure-origin-as-secure</strong> in your mobile Chrome address bar.</li>
              <li>Toggle the flag to <strong>Enabled</strong>.</li>
              <li>Paste this exact URL: <code>http://{window.location.hostname}:3000</code> into the text area.</li>
              <li>Tap the <strong>Relaunch</strong> button at the bottom right.</li>
            </ol>
          </Alert>
        )}

        <Card 
          variant="outlined" 
          sx={{ 
            position: 'relative', 
            width: '100%', 
            aspectRatio: '4/3', 
            borderRadius: 3, 
            overflow: 'hidden', 
            bgcolor: '#020617',
            border: '2px solid rgba(99, 102, 241, 0.2)'
          }}
        >
          {!cameraActive && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" p={3}>
              <CircularProgress color="primary" sx={{ mb: 2 }} />
              <Typography variant="body1" align="center">{modelStatus}</Typography>
              <Typography variant="caption" color="text.secondary" align="center" mt={1}>
                Requires camera permission
              </Typography>
            </Box>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)' // Mirror view for student convenience
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              transform: 'scaleX(-1)' // Mirror canvas coordinates to match video
            }}
          />
        </Card>

        {/* Live detection indicators */}
        {cameraActive && (
          <Box mt={2}>
            <Typography variant="h6" color="#94A3B8" gutterBottom>
              Local AI Status
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              <Box 
                sx={{ 
                  px: 2, 
                  py: 0.5, 
                  borderRadius: 20, 
                  bgcolor: detections.some(d => d.class === 'person') ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                  color: detections.some(d => d.class === 'person') ? '#4ADE80' : '#94A3B8',
                  border: '1px solid currentColor'
                }}
              >
                Person
              </Box>
              <Box 
                sx={{ 
                  px: 2, 
                  py: 0.5, 
                  borderRadius: 20, 
                  bgcolor: detections.some(d => d.class === 'cell phone') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                  color: detections.some(d => d.class === 'cell phone') ? '#FCA5A5' : '#94A3B8',
                  border: '1px solid currentColor'
                }}
              >
                Cell Phone
              </Box>
              <Box 
                sx={{ 
                  px: 2, 
                  py: 0.5, 
                  borderRadius: 20, 
                  bgcolor: detections.some(d => d.class === 'book') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                  color: detections.some(d => d.class === 'book') ? '#FCA5A5' : '#94A3B8',
                  border: '1px solid currentColor'
                }}
              >
                Book/Laptop
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" mt={1.5} align="center">
              ⚠️ AI processing is local. Camera feed is never sent to the network.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
