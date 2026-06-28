import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Webcam from 'react-webcam';
import { Box, Button, CircularProgress, Typography, IconButton, Paper } from '@mui/material';
import { Camera, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

const FaceCapture = ({ onCapture, value }) => {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingError(false);
        // Load required models from Vladmandic face-api CDN
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        console.log('FaceAPI models loaded successfully.');
      } catch (error) {
        console.error('Failed to load FaceAPI models:', error);
        setLoadingError(true);
        toast.error('Failed to initialize face recognition models. Please check your connection.');
      }
    };
    loadModels();
  }, []);

  const handleCapture = async () => {
    if (!modelsLoaded) {
      toast.error('Face recognition models are still loading. Please wait.');
      return;
    }

    const webcam = webcamRef.current;
    if (!webcam || !webcam.video) {
      toast.error('Camera stream is not ready.');
      return;
    }

    const video = webcam.video;
    if (video.readyState !== 4) {
      toast.error('Video feed is loading.');
      return;
    }

    setIsCapturing(true);

    try {
      // Detect single face with landmarks and descriptor
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.warn('No face detected. Please position yourself in front of the camera and try again.');
        setIsCapturing(false);
        return;
      }

      // Check face descriptor validity
      if (detection.descriptor) {
        const descriptorArray = Array.from(detection.descriptor);
        
        // Capture screenshot for visual confirmation
        const imageSrc = webcam.getScreenshot();
        setCapturedImage(imageSrc);

        onCapture(descriptorArray);
        toast.success('Face profile captured successfully!');
      } else {
        toast.error('Failed to extract face features. Please try again.');
      }
    } catch (error) {
      console.error('Error during face detection:', error);
      toast.error('An error occurred during face detection. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleReset = () => {
    setCapturedImage(null);
    onCapture(null);
  };

  if (loadingError) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          textAlign: 'center',
          backgroundColor: '#ffebee',
          border: '1px solid #ef5350',
          borderRadius: '12px',
          my: 2,
        }}
      >
        <AlertTriangle color="#d32f2f" size={32} style={{ marginBottom: 8 }} />
        <Typography variant="subtitle1" color="error.main" fontWeight={600} mb={1}>
          Model Loading Failed
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          We couldn't load the face recognition models. Please ensure you have an active internet connection.
        </Typography>
      </Paper>
    );
  }

  if (!modelsLoaded) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={3}
        sx={{
          border: '2px dashed #e0e0e0',
          borderRadius: '16px',
          backgroundColor: '#f9f9f9',
          my: 2,
        }}
      >
        <CircularProgress size={36} sx={{ mb: 2 }} />
        <Typography variant="subtitle2" color="text.secondary">
          Initializing Face Recognition Models...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={1} component="label">
        Face Profile Capture <span style={{ color: '#ef5350' }}>*</span>
      </Typography>
      
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '320px',
          height: '240px',
          margin: '0 auto',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          border: value ? '3px solid #4caf50' : '2px solid #e0e0e0',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {capturedImage ? (
          <Box
            component="img"
            src={capturedImage}
            alt="Captured face profile"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
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
        )}

        {/* Overlay scanning border / success icon */}
        {!capturedImage && (
          <Box
            sx={{
              position: 'absolute',
              top: '10%',
              left: '10%',
              right: '10%',
              bottom: '10%',
              border: '2px dashed rgba(25, 118, 210, 0.5)',
              borderRadius: '50%',
              pointerEvents: 'none',
              animation: 'pulse 2s infinite ease-in-out',
              '@keyframes pulse': {
                '0%': { transform: 'scale(0.95)', opacity: 0.5 },
                '50%': { transform: 'scale(1.05)', opacity: 0.8 },
                '100%': { transform: 'scale(0.95)', opacity: 0.5 },
              },
            }}
          />
        )}

        {value && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: 'rgba(76, 175, 80, 0.9)',
              borderRadius: '50%',
              p: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle color="#fff" size={20} />
          </Box>
        )}
      </Box>

      <Box display="flex" justifyContent="center" gap={2} mt={2}>
        {capturedImage ? (
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RefreshCw size={16} />}
            onClick={handleReset}
            size="small"
            sx={{ borderRadius: '8px' }}
          >
            Recapture Face
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={isCapturing ? <CircularProgress size={16} color="inherit" /> : <Camera size={16} />}
            onClick={handleCapture}
            disabled={isCapturing}
            size="small"
            sx={{
              borderRadius: '8px',
              px: 3,
              background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
            }}
          >
            {isCapturing ? 'Processing...' : 'Capture Face'}
          </Button>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>
        {value
          ? 'Face profile captured! You can proceed to submit.'
          : 'Please capture a clear view of your face. Keep a neutral expression.'}
      </Typography>
    </Box>
  );
};

export default FaceCapture;
