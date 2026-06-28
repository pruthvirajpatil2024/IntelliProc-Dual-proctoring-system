import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Webcam from 'react-webcam';
import { Box, Button, CircularProgress, Typography, Paper, Alert } from '@mui/material';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle, HelpCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useUpdateUserMutation } from 'src/slices/usersApiSlice';
import { useDispatch } from 'react-redux';
import { setCredentials } from 'src/slices/authSlice';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

const FaceVerification = ({ storedDescriptor, onVerificationSuccess, userInfo }) => {
  const webcamRef = useRef(null);
  const dispatch = useDispatch();
  const [updateUser] = useUpdateUserMutation();

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'verifying', 'success', 'failed', 'no_descriptor'
  const [attempts, setAttempts] = useState(0);
  const [distance, setDistance] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  // If the user doesn't have a stored descriptor, we'll allow them to register their face descriptor first
  const [isRegisteringDescriptor, setIsRegisteringDescriptor] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingError(false);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        if (!storedDescriptor || storedDescriptor.length === 0) {
          setStatus('no_descriptor');
        } else {
          setStatus('ready');
        }
      } catch (error) {
        console.error('Failed to load FaceAPI models:', error);
        setLoadingError(true);
        setStatus('failed');
        toast.error('Failed to load face verification models. Please check your internet connection.');
      }
    };
    loadModels();
  }, [storedDescriptor]);

  const verifyFace = async () => {
    if (!modelsLoaded || !storedDescriptor || storedDescriptor.length === 0) return;

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

    setStatus('verifying');
    setAttempts((prev) => prev + 1);

    try {
      // Detect face, landmarks, and extract descriptor
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.warn('No face detected. Please position yourself in front of the camera.');
        setStatus('ready');
        return;
      }

      const liveDescriptor = Array.from(detection.descriptor);
      
      // Calculate distance between live face and stored face weight
      const matchDistance = faceapi.euclideanDistance(liveDescriptor, storedDescriptor);
      setDistance(matchDistance);

      console.log('Face matching distance:', matchDistance);

      // Vladmandic face-api standard threshold is 0.6. Less than 0.6 = match.
      const THRESHOLD = 0.6; 
      if (matchDistance < THRESHOLD) {
        setStatus('success');
        setCapturedImage(webcam.getScreenshot());
        toast.success('Face verified successfully!');
        
        // Wait 1.5 seconds to show success state before proceeding to test
        setTimeout(() => {
          onVerificationSuccess();
        }, 1500);
      } else {
        setStatus('failed');
        toast.error('Face verification failed. Face does not match the registered user.');
      }
    } catch (error) {
      console.error('Error during face verification:', error);
      toast.error('Verification error. Please try again.');
      setStatus('ready');
    }
  };

  const handleRegisterDescriptor = async () => {
    const webcam = webcamRef.current;
    if (!webcam || !webcam.video) {
      toast.error('Camera stream is not ready.');
      return;
    }

    setIsRegisteringDescriptor(true);
    try {
      const detection = await faceapi
        .detectSingleFace(webcam.video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.warn('No face detected. Please position yourself in front of the camera.');
        setIsRegisteringDescriptor(false);
        return;
      }

      const descriptorArray = Array.from(detection.descriptor);
      
      // Call backend to update profile with faceDescriptor
      const res = await updateUser({
        _id: userInfo._id,
        name: userInfo.name,
        email: userInfo.email,
        role: userInfo.role,
        faceDescriptor: descriptorArray
      }).unwrap();

      dispatch(setCredentials({ ...res }));
      toast.success('Face profile registered successfully!');
      setStatus('ready');
    } catch (error) {
      console.error('Error registering descriptor:', error);
      toast.error(error?.data?.message || 'Failed to register face profile.');
    } finally {
      setIsRegisteringDescriptor(false);
    }
  };

  if (loadingError) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: '500px',
          margin: '40px auto',
          textAlign: 'center',
          borderRadius: '20px',
          border: '1px solid #ffebee',
        }}
      >
        <AlertTriangle color="#d32f2f" size={48} style={{ marginBottom: 16 }} />
        <Typography variant="h4" color="error.main" fontWeight={700} mb={2}>
          System Initialization Failed
        </Typography>
        <Typography color="text.secondary" mb={3}>
          Unable to load required face recognition models from the CDN. Please check your internet connection.
        </Typography>
        <Button variant="outlined" color="primary" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </Paper>
    );
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh" py={4}>
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: '480px',
          borderRadius: '24px',
          textAlign: 'center',
          background: 'linear-gradient(145deg, #ffffff, #f7f9fc)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Verification Icon Header */}
        <Box display="flex" justifyContent="center" mb={2}>
          {status === 'initializing' && <CircularProgress size={48} />}
          {status === 'ready' && (
            <Box sx={{ color: '#1976d2', backgroundColor: '#e3f2fd', p: 2, borderRadius: '50%' }}>
              <Shield size={36} />
            </Box>
          )}
          {status === 'verifying' && <CircularProgress size={48} color="primary" />}
          {status === 'success' && (
            <Box sx={{ color: '#4caf50', backgroundColor: '#e8f5e9', p: 2, borderRadius: '50%' }}>
              <ShieldCheck size={36} />
            </Box>
          )}
          {status === 'failed' && (
            <Box sx={{ color: '#ef5350', backgroundColor: '#ffebee', p: 2, borderRadius: '50%' }}>
              <ShieldAlert size={36} />
            </Box>
          )}
          {status === 'no_descriptor' && (
            <Box sx={{ color: '#ff9800', backgroundColor: '#fff3e0', p: 2, borderRadius: '50%' }}>
              <HelpCircle size={36} />
            </Box>
          )}
        </Box>

        <Typography variant="h3" fontWeight={700} gutterBottom>
          Face Verification Required
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {status === 'no_descriptor'
            ? 'You have not registered a face profile. Please register your face first to start the test.'
            : 'You must verify your identity to unlock and start the exam.'}
        </Typography>

        {/* Camera/Verification Frame */}
        <Box
          sx={{
            position: 'relative',
            width: '280px',
            height: '280px',
            margin: '0 auto 24px',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            border:
              status === 'success'
                ? '6px solid #4caf50'
                : status === 'failed'
                ? '6px solid #f44336'
                : '6px solid #1976d2',
            backgroundColor: '#000',
            transition: 'border 0.3s ease',
          }}
        >
          {capturedImage ? (
            <Box
              component="img"
              src={capturedImage}
              alt="Verified Student"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : modelsLoaded ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              muted
              screenshotFormat="image/jpeg"
              videoConstraints={{
                width: 480,
                height: 480,
                facingMode: 'user',
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box display="flex" height="100%" alignItems="center" justifyContent="center">
              <CircularProgress color="inherit" />
            </Box>
          )}

          {/* Scanning Animation / Shutter overlay */}
          {status === 'verifying' && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '4px',
                background: 'linear-gradient(90deg, #1976d2, #42a5f5)',
                animation: 'scan 1.5s infinite linear',
                boxShadow: '0 0 8px #1976d2',
                '@keyframes scan': {
                  '0%': { top: '0%' },
                  '100%': { top: '100%' },
                },
              }}
            />
          )}
        </Box>

        {/* Display verification state status texts */}
        <Box mb={3}>
          {status === 'initializing' && (
            <Typography variant="body1" fontWeight={600} color="text.secondary">
              Initializing camera and models...
            </Typography>
          )}
          {status === 'ready' && (
            <Typography variant="body1" fontWeight={600} color="primary.main">
              Ready to verify. Position your face in the circle.
            </Typography>
          )}
          {status === 'verifying' && (
            <Typography variant="body1" fontWeight={600} color="info.main">
              Analyzing facial features...
            </Typography>
          )}
          {status === 'success' && (
            <Typography variant="body1" fontWeight={600} color="success.main">
              Identity Confirmed! Launching Exam...
            </Typography>
          )}
          {status === 'failed' && (
            <Box>
              <Typography variant="body1" fontWeight={600} color="error.main">
                Verification Failed (Distance: {distance ? distance.toFixed(3) : 'N/A'})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Make sure you are in a well-lit room and look directly at the camera.
              </Typography>
            </Box>
          )}
          {status === 'no_descriptor' && (
            <Alert severity="warning" sx={{ borderRadius: '12px', textAlign: 'left' }}>
              No face template found in database for your account. Please capture your face template below to continue.
            </Alert>
          )}
        </Box>

        {/* Control Buttons */}
        <Box display="flex" flexDirection="column" gap={2} px={4}>
          {status === 'no_descriptor' ? (
            <Button
              variant="contained"
              color="warning"
              disabled={isRegisteringDescriptor}
              startIcon={isRegisteringDescriptor ? <CircularProgress size={16} color="inherit" /> : <RefreshCw size={16} />}
              onClick={handleRegisterDescriptor}
              sx={{ borderRadius: '12px', py: 1.2, fontWeight: 600 }}
            >
              {isRegisteringDescriptor ? 'Registering...' : 'Register Face Profile'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color={status === 'failed' ? 'error' : 'primary'}
              disabled={status === 'verifying' || status === 'success' || !modelsLoaded}
              onClick={verifyFace}
              sx={{
                borderRadius: '12px',
                py: 1.5,
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow:
                  status === 'failed'
                    ? '0 4px 14px rgba(244, 67, 54, 0.4)'
                    : '0 4px 14px rgba(25, 118, 210, 0.4)',
              }}
            >
              {status === 'failed'
                ? 'Retry Verification'
                : status === 'verifying'
                ? 'Verifying...'
                : 'Verify Identity'}
            </Button>
          )}

          {attempts > 0 && status !== 'success' && status !== 'verifying' && (
            <Typography variant="caption" color="text.secondary">
              Attempt: {attempts}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default FaceVerification;
