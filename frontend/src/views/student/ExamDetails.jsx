import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Radio,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import { uniqueId } from 'lodash';
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useGetQuestionsQuery, useGetExamsQuery } from 'src/slices/examApiSlice';
import { useSelector } from 'react-redux';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';

function Copyright(props) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="https://mui.com/">
        Your Website
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const DescriptionAndInstructions = () => {
  const navigate = useNavigate();

  const { examId } = useParams();
  const { data: questions, isLoading } = useGetQuestionsQuery(examId); // Fetch questions using examId
  const { data: userExamdata, isLoading: isExamsLoading } = useGetExamsQuery();
  const { userInfo } = useSelector((state) => state.auth);

  const exam = userExamdata?.find((e) => e.examId === examId);

  const isStudent = userInfo?.role === 'student';
  const attemptsCount = exam?.attemptsCount || 0;
  const attemptsAllowed = exam?.attemptsAllowed || 1;
  const isAttemptsExceeded = isStudent && attemptsCount >= attemptsAllowed;

  const [certify, setCertify] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [localIp, setLocalIp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [mobileConnected, setMobileConnected] = useState(false);
  const socketRef = useRef(null);

  // Fetch local network IP on mount
  useEffect(() => {
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        setLocalIp(data.ip);
        console.log('Detected local network IP:', data.ip);
      })
      .catch((err) => {
        console.error('Error fetching network IP:', err);
        setLocalIp(window.location.hostname);
      });
  }, []);

  const handleCertifyChange = () => {
    setCertify(!certify);
  };

  const handleStartPairing = () => {
    if (isAttemptsExceeded) {
      toast.error('You have reached the maximum allowed attempts for this exam.');
      return;
    }
    
    // Generate unique session ID
    const newSessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
    setSessionId(newSessionId);
    setMobileConnected(false);
    setPairingOpen(true);

    // Initialize Socket.io connection for pairing
    const socketHost = `http://${window.location.hostname}:5000`;
    console.log('Connecting to socket for pairing:', socketHost);
    const socket = io(socketHost, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Laptop connected for pairing');
      socket.emit('join-session', { sessionId: newSessionId, deviceType: 'laptop' });
    });

    socket.on('mobile-connected', () => {
      console.log('Mobile connected event received in pairing dialog');
      setMobileConnected(true);
      toast.success('Mobile proctor linked successfully!');
    });

    socket.on('mobile-disconnected', () => {
      console.log('Mobile disconnected event received in pairing dialog');
      setMobileConnected(false);
      toast.warning('Mobile proctor unlinked.');
    });

    socketRef.current = socket;
  };

  const handleClosePairing = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setPairingOpen(false);
  };

  const handleTest = () => {
    // Close the pairing socket connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setPairingOpen(false);

    // Reset tab switch count
    sessionStorage.setItem('tabSwitchCount', '0');

    // Request fullscreen
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch((err) => {
        console.error("Error entering fullscreen:", err);
      });
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }

    // Navigate using the pairing session ID as the testId
    navigate(`/exam/${examId}/${sessionId}`);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h2" mb={3}>
          Description
        </Typography>
        <Typography>
          This practice test will allow you to measure your Python skills at the beginner level by
          the way of various multiple choice questions. We recommend you to score at least 75% in
          this test before moving to the next level questionnaire. It will help you in identifying
          your strength and development areas. Based on the same you can plan your next steps in
          learning Python and preparing for job placements.
        </Typography>

        <Typography>#Python #Coding #Software #MCQ #Beginner #Programming Language</Typography>

        <>
          <Typography variant="h3" mb={3} mt={3}>
            Test Instructions
          </Typography>
          <List>
            <ol>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    This Practice Test consists of only <strong>MCQ questions.</strong>
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    There are a total of <strong>40 questions.</strong> Test Duration is{' '}
                    <strong>30 minutes.</strong>
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    There is <strong>Negative Marking</strong> for wrong answers.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    <strong>Do Not switch tabs </strong> while taking the test.
                    <strong> Switching Tabs will Block / End the test automatically.</strong>
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    The test will only run in <strong>full screen mode.</strong> Do not switch back
                    to tab mode. Test will end automatically.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    You may need to use blank sheets for rough work. Please arrange for blank sheets
                    before starting.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    Clicking on Back or Next will save the answer.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    Questions can be reattempted till the time test is running.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    Click on the finish test once you are done with the test.
                  </Typography>
                </ListItemText>
              </li>
              <li>
                <ListItemText>
                  <Typography variant="body1">
                    You will be able to view the scores once your test is complete.
                  </Typography>
                </ListItemText>
              </li>
            </ol>
          </List>
        </>
        <Typography variant="h3" mb={3} mt={3}>
          Confirmation
        </Typography>
        <Typography mb={3}>
          Your actions shall be proctored and any signs of wrongdoing may lead to suspension or
          cancellation of your test.
        </Typography>
        <Stack direction="column" alignItems="center" spacing={3}>
          {isStudent && exam && (
            <Box textAlign="center" mb={2}>
              <Typography variant="h5" color={isAttemptsExceeded ? 'error.main' : 'text.primary'}>
                Attempts Used: {attemptsCount} / {attemptsAllowed}
              </Typography>
              {isAttemptsExceeded ? (
                <Typography variant="body2" color="error.main" fontWeight={600} mt={1}>
                  🚫 You have reached the maximum allowed attempts for this exam.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  You have {attemptsAllowed - attemptsCount} remaining attempt(s).
                </Typography>
              )}
            </Box>
          )}
          <FormControlLabel
            control={<Checkbox checked={certify} disabled={isAttemptsExceeded} onChange={handleCertifyChange} color="primary" />}
            label="I certify that I have carefully read and agree to all of the instructions mentioned above"
          />
          <div style={{ display: 'flex', padding: '2px', margin: '10px' }}>
            <Button variant="contained" color="primary" disabled={!certify || isAttemptsExceeded} onClick={handleStartPairing}>
              Start Test
            </Button>
          </div>
        </Stack>

        {/* Mobile Pairing Dialog */}
        <Dialog 
          open={pairingOpen} 
          onClose={handleClosePairing}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            style: {
              backgroundColor: '#1E293B',
              color: '#F1F5F9',
              borderRadius: '16px',
              padding: '16px',
            }
          }}
        >
          <DialogTitle style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: '#6366F1' }}>
            Mobile Pairing Required
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" align="center" style={{ marginBottom: '20px', color: '#94A3B8' }}>
              Please scan the QR code below using your mobile phone to join the proctored session.
            </Typography>
            
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={3}>
              {sessionId && (
                <Box 
                  p={2} 
                  bgcolor="white" 
                  borderRadius="12px" 
                  boxShadow="0 4px 20px rgba(99, 102, 241, 0.15)"
                  style={{ display: 'inline-block' }}
                >
                  <QRCodeSVG 
                    value={`http://${localIp || window.location.hostname}:3000/mobile-proctor/${sessionId}`} 
                    size={200}
                  />
                </Box>
              )}
              
              <Box mt={3} display="flex" flexDirection="column" alignItems="center">
                {mobileConnected ? (
                  <Typography variant="h6" style={{ color: '#4ADE80', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🟢 Mobile Connected!
                  </Typography>
                ) : (
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <CircularProgress size={20} color="primary" />
                    <Typography variant="body2" style={{ color: '#FB923C' }}>
                      Waiting for mobile connection...
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Typography variant="caption" align="center" display="block" style={{ color: '#64748B', marginTop: '10px', wordBreak: 'break-all' }}>
              URL: http://{localIp || window.location.hostname}:3000/mobile-proctor/{sessionId}
            </Typography>
          </DialogContent>
          <DialogActions style={{ justifyContent: 'space-between', padding: '8px 24px' }}>
            <Button onClick={handleClosePairing} style={{ color: '#94A3B8' }}>
              Cancel
            </Button>
            <Button 
              onClick={handleTest} 
              variant="contained" 
              disabled={!mobileConnected}
              style={{ 
                backgroundColor: mobileConnected ? '#6366F1' : '#475569', 
                color: '#FFFFFF',
                borderRadius: '8px'
              }}
            >
              Start Exam
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const imgUrl =
  'https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';

export default function ExamDetails() {
  return (
    <>
      <Grid container sx={{ height: '100vh' }}>
        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            backgroundImage: `url(${imgUrl})`, // 'url(https://source.unsplash.com/random?wallpapers)',
            backgroundRepeat: 'no-repeat',
            backgroundColor: (t) =>
              t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
          <DescriptionAndInstructions />
        </Grid>
      </Grid>
    </>
  );
}
