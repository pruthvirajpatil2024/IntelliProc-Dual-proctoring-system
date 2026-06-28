import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, Modal } from '@mui/material';
import { toast } from 'react-toastify';
import { useCheatingLog } from '../context/CheatingLogContext';

export default function ProctoringEnforcer({ onAutoSubmit }) {
  const { updateCheatingLog } = useCheatingLog();
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(() => {
    const saved = sessionStorage.getItem('tabSwitchCount');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Track fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      const fsElement = document.fullscreenElement ||
                        document.mozFullScreenElement ||
                        document.webkitFullscreenElement ||
                        document.msFullscreenElement;
      setIsFullscreen(!!fsElement);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    document.addEventListener('mozfullscreenchange', checkFullscreen);
    document.addEventListener('MSFullscreenChange', checkFullscreen);

    // Initial check
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      document.removeEventListener('mozfullscreenchange', checkFullscreen);
      document.removeEventListener('MSFullscreenChange', checkFullscreen);
    };
  }, []);

  // Enter Full Screen Mode
  const enterFullscreen = async () => {
    try {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.error('Failed to enter fullscreen:', err);
      toast.error('Could not enter fullscreen. Please try again or check browser permissions.');
    }
  };

  // Monitor visibility (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Increment count
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        sessionStorage.setItem('tabSwitchCount', newCount.toString());
        
        // Update global cheating log
        updateCheatingLog({ tabSwitchCount: newCount });

        if (newCount > 3) {
          toast.error('Maximum tab switches exceeded. Autosubmitting test...');
          if (onAutoSubmit) {
            onAutoSubmit(newCount);
          }
        } else {
          toast.warning(`Warning: You switched tabs! (Warning ${newCount}/3). Continuing to switch tabs will automatically submit your exam.`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tabSwitchCount, onAutoSubmit, updateCheatingLog]);

  // If not in fullscreen, show the overlay modal preventing exam interaction
  return (
    <Modal
      open={!isFullscreen}
      aria-labelledby="fullscreen-modal-title"
      aria-describedby="fullscreen-modal-description"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}
      disableEscapeKeyDown
    >
      <Paper
        elevation={24}
        sx={{
          p: 5,
          maxWidth: 500,
          mx: 2,
          textAlign: 'center',
          borderRadius: 3,
          border: '2px solid',
          borderColor: 'primary.main',
        }}
      >
        <Typography id="fullscreen-modal-title" variant="h3" color="error" fontWeight="bold" gutterBottom>
          ⚠️ Full Screen Required
        </Typography>
        <Typography id="fullscreen-modal-description" variant="body1" sx={{ mt: 2, mb: 4, color: 'text.secondary' }}>
          To ensure the integrity of this exam, you must take it in Full Screen mode at all times. Switching tabs or exiting full screen is strictly monitored.
        </Typography>
        <Button variant="contained" color="primary" size="large" onClick={enterFullscreen} sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}>
          Enter Full Screen Mode
        </Button>
      </Paper>
    </Modal>
  );
}
