import React, { useRef, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import Webcam from 'react-webcam';
import { drawRect } from './utilities';
import { Box, Card } from '@mui/material';
import swal from 'sweetalert';
import { UploadClient } from '@uploadcare/upload-client';
import io from 'socket.io-client';

const client = new UploadClient({ publicKey: '278c8ebd9968212700ae' });

export default function Home({ testId, cheatingLog, updateCheatingLog }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [lastDetectionTime, setLastDetectionTime] = useState({});
  const [screenshots, setScreenshots] = useState([]);

  // Socket.io connection for receiving mobile detections
  useEffect(() => {
    if (!testId) return;

    const socketHost = process.env.REACT_APP_BACKEND_URL ||
      (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
    console.log('WebCam component connecting to socket:', socketHost);
    
    const socket = io(socketHost, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('WebCam socket connected');
      socket.emit('join-session', { sessionId: testId, deviceType: 'laptop' });
    });

    socket.on('mobile-detection', (data) => {
      console.log('Received mobile-detection in WebCam:', data);
      if (data && data.type) {
        handleDetection(data.type, data.image);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [testId]);

  // Initialize screenshots array when component mounts
  useEffect(() => {
    if (cheatingLog && cheatingLog.screenshots) {
      setScreenshots(cheatingLog.screenshots);
    }
  }, [cheatingLog]);

  const captureScreenshotAndUpload = async (type) => {
    const video = webcamRef.current?.video;

    if (
      !video ||
      video.readyState !== 4 || // ensure video is ready
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.warn('Video not ready for screenshot');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');
    const file = dataURLtoFile(dataUrl, `cheating_${Date.now()}.jpg`);

    try {
      const result = await client.uploadFile(file);
      console.log('✅ Uploaded to Uploadcare:', result.cdnUrl);
      
      const screenshot = {
        url: result.cdnUrl,
        type: type,
        detectedAt: new Date()
      };

      // Update local screenshots state
      setScreenshots(prev => [...prev, screenshot]);
      
      return screenshot;
    } catch (error) {
      console.error('❌ Upload failed:', error);
      return null;
    }
  };

  const handleDetection = async (type, customImage = null) => {
    const now = Date.now();
    const lastTime = lastDetectionTime[type] || 0;

    if (now - lastTime >= 3000) {
      setLastDetectionTime((prev) => ({ ...prev, [type]: now }));

      let screenshot = null;
      if (customImage) {
        try {
          const file = dataURLtoFile(customImage, `cheating_mobile_${Date.now()}.jpg`);
          const result = await client.uploadFile(file);
          console.log('✅ Uploaded to Uploadcare (Mobile):', result.cdnUrl);
          screenshot = {
            url: result.cdnUrl,
            type: type,
            detectedAt: new Date()
          };
        } catch (error) {
          console.error('❌ Upload of mobile image failed:', error);
        }
      } else {
        // Capture and upload screenshot
        screenshot = await captureScreenshotAndUpload(type);
      }
      
      if (screenshot) {
        // Update local screenshots state
        setScreenshots((prev) => [...prev, screenshot]);

        updateCheatingLog((prev) => {
          const updated = {
            ...prev,
            [`${type}Count`]: (prev[`${type}Count`] || 0) + 1,
            screenshots: [...(prev.screenshots || []), screenshot],
          };

          console.log('Updating cheating log with:', updated);
          return updated;
        });
      }

      switch (type) {
        case 'noFace':
          swal('Face Not Visible', 'Warning Recorded', 'warning');
          break;
        case 'multipleFace':
          swal('Multiple Faces Detected', 'Warning Recorded', 'warning');
          break;
        case 'cellPhone':
          swal('Cell Phone Detected', 'Warning Recorded', 'warning');
          break;
        case 'prohibitedObject':
          swal('Prohibited Object Detected', 'Warning Recorded', 'warning');
          break;
        default:
          break;
      }
    }
  };

  const runCoco = async () => {
    try {
      const modelUrl = `${window.location.origin}/models/coco-ssd/model.json`;
      console.log('Loading local coco-ssd model in WebCam from:', modelUrl);
      const net = await cocossd.load({ modelUrl });
      console.log('AI model loaded.');
      setInterval(() => detect(net), 1000);
    } catch (error) {
      console.error('Error loading model:', error);
      swal('Error', 'Failed to load AI model. Please refresh the page.', 'error');
    }
  };

  const detect = async (net) => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      try {
        const obj = await net.detect(video);
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        drawRect(obj, ctx);

        let person_count = 0;
        let faceDetected = false;

        obj.forEach((element) => {
          const detectedClass = element.class;
          console.log('Detected:', detectedClass);

          if (detectedClass === 'cell phone') handleDetection('cellPhone');
          if (detectedClass === 'book' || detectedClass === 'laptop')
            handleDetection('prohibitedObject');
          if (detectedClass === 'person') {
            faceDetected = true;
            person_count++;
            if (person_count > 1) handleDetection('multipleFace');
          }
        });

        if (!faceDetected) handleDetection('noFace');
      } catch (error) {
        console.error('Error during detection:', error);
      }
    }
  };

  useEffect(() => {
    runCoco();
  }, []);

  return (
    <Box>
      <Card variant="outlined" sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          muted
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: 'user',
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
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
          }}
        />
      </Card>
    </Box>
  );
}

// Helper to convert base64 to File
function dataURLtoFile(dataUrl, fileName) {
  let url = dataUrl;
  if (!url.startsWith('data:')) {
    url = 'data:image/jpeg;base64,' + url;
  }
  const arr = url.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mime });
}
