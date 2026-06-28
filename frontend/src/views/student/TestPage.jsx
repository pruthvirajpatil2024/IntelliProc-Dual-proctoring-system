import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Grid, CircularProgress } from '@mui/material';
import PageContainer from 'src/components/container/PageContainer';
import BlankCard from 'src/components/shared/BlankCard';
import MultipleChoiceQuestion from './Components/MultipleChoiceQuestion';
import NumberOfQuestions from './Components/NumberOfQuestions';
import WebCam from './Components/WebCam';
import FaceVerification from './Components/FaceVerification';
import { useGetExamsQuery, useGetQuestionsQuery } from '../../slices/examApiSlice';
import { useSaveCheatingLogMutation } from 'src/slices/cheatingLogApiSlice';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { useCheatingLog } from 'src/context/CheatingLogContext';
import ProctoringEnforcer from '../../components/ProctoringEnforcer';
import axiosInstance from '../../axios';
import io from 'socket.io-client';

const TestPage = () => {
  const { examId, testId } = useParams();
  const [selectedExam, setSelectedExam] = useState(null);
  const [examDurationInSeconds, setExamDurationInSeconds] = useState(0);
  const { data: userExamdata, isLoading: isExamsLoading } = useGetExamsQuery();
  const { userInfo } = useSelector((state) => state.auth);
  const { cheatingLog, updateCheatingLog, resetCheatingLog } = useCheatingLog();
  const [saveCheatingLogMutation] = useSaveCheatingLogMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMcqCompleted, setIsMcqCompleted] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [answers, setAnswers] = useState(new Map());
  const [mobileConnected, setMobileConnected] = useState(true);

  useEffect(() => {
    if (!faceVerified) return;

    const socketHost = `http://${window.location.hostname}:5000`;
    console.log('Connecting to Socket.IO for exam proctoring:', socketHost);
    
    const socket = io(socketHost, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Laptop TestPage connected to socket');
      socket.emit('join-session', { sessionId: testId, deviceType: 'laptop' });
    });

    socket.on('mobile-connected', () => {
      console.log('Mobile proctor reconnected');
      setMobileConnected(true);
      toast.success('Mobile proctor connected. Proctoring active.', {
        toastId: 'mobile-status'
      });
    });

    socket.on('mobile-disconnected', () => {
      console.log('Mobile proctor disconnected');
      setMobileConnected(false);
      toast.error('⚠️ Mobile proctor disconnected! Please check your mobile device.', {
        autoClose: false,
        toastId: 'mobile-status'
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [faceVerified, testId]);

  useEffect(() => {
    if (userExamdata) {
      const exam = userExamdata.find((exam) => exam.examId === examId);
      if (exam) {
        setSelectedExam(exam);
        // Convert duration from minutes to seconds
        setExamDurationInSeconds(exam.duration);
        console.log('Exam duration (minutes):', exam.duration);
      }
    }
  }, [userExamdata, examId]);

  const [questions, setQuestions] = useState([]);
  const { data, isLoading } = useGetQuestionsQuery(examId);
  const [score, setScore] = useState(0);
  const navigate = useNavigate();

  const isStudent = userInfo && userInfo.role === 'student';
  const attemptsCount = selectedExam?.attemptsCount || 0;
  const attemptsAllowed = selectedExam?.attemptsAllowed || 1;
  const isAttemptsExceeded = isStudent && attemptsCount >= attemptsAllowed;

  useEffect(() => {
    if (isAttemptsExceeded) {
      toast.error('You have reached the maximum allowed attempts for this exam.');
      navigate('/Success');
    }
  }, [isAttemptsExceeded, navigate]);

  useEffect(() => {
    if (data) {
      setQuestions(data);
    }
  }, [data]);

  useEffect(() => {
    if (examId) {
      updateCheatingLog({ examId });
    }
  }, [examId]);

  const handleMcqCompletion = () => {
    setIsMcqCompleted(true);
    navigate(`/exam/${examId}/codedetails`);
  };

  const handleTestSubmission = async () => {
    if (isSubmitting) return; // Prevent multiple submissions

    try {
      setIsSubmitting(true);

      const currentSwitches = parseInt(sessionStorage.getItem('tabSwitchCount'), 10) || 0;
      // Make sure we have the latest user info in the log
      const updatedLog = {
        ...cheatingLog,
        username: userInfo.name,
        email: userInfo.email,
        examId: examId,
        noFaceCount: parseInt(cheatingLog.noFaceCount) || 0,
        multipleFaceCount: parseInt(cheatingLog.multipleFaceCount) || 0,
        cellPhoneCount: parseInt(cheatingLog.cellPhoneCount) || 0,
        prohibitedObjectCount: parseInt(cheatingLog.prohibitedObjectCount) || 0,
        tabSwitchCount: currentSwitches,
      };

      console.log('Submitting cheating log:', updatedLog);

      // Save the cheating log
      const result = await saveCheatingLogMutation(updatedLog).unwrap();
      console.log('Cheating log saved:', result);

      toast.success('Test submitted successfully!');
      navigate('/Success');
    } catch (error) {
      console.error('Error saving cheating log:', error);
      toast.error(
        error?.data?.message || error?.message || 'Failed to save test logs. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const answersObject = Object.fromEntries(answers);
      await axiosInstance.post(
        '/api/users/results',
        {
          examId,
          answers: answersObject,
        },
        {
          withCredentials: true,
        },
      );
    } catch (error) {
      console.error('Error auto-saving results:', error);
    }

    try {
      const currentSwitches = parseInt(sessionStorage.getItem('tabSwitchCount'), 10) || 0;
      const updatedLog = {
        ...cheatingLog,
        username: userInfo.name,
        email: userInfo.email,
        examId: examId,
        noFaceCount: parseInt(cheatingLog.noFaceCount) || 0,
        multipleFaceCount: parseInt(cheatingLog.multipleFaceCount) || 0,
        cellPhoneCount: parseInt(cheatingLog.cellPhoneCount) || 0,
        prohibitedObjectCount: parseInt(cheatingLog.prohibitedObjectCount) || 0,
        tabSwitchCount: currentSwitches,
      };
      await saveCheatingLogMutation(updatedLog).unwrap();
      toast.error('Test automatically submitted due to multiple tab switches.');
      navigate('/Success');
    } catch (error) {
      console.error('Error saving cheating log:', error);
      navigate('/Success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveUserTestScore = () => {
    setScore(score + 1);
  };

  if (isExamsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isStudent && !faceVerified) {
    return (
      <PageContainer title="Face Verification" description="Verify your identity to start the exam">
        <FaceVerification
          storedDescriptor={userInfo?.faceDescriptor}
          userInfo={userInfo}
          onVerificationSuccess={() => setFaceVerified(true)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="TestPage" description="This is TestPage">
      {isStudent && faceVerified && <ProctoringEnforcer onAutoSubmit={handleAutoSubmit} />}
      <Box pt="3rem">
        {!mobileConnected && (
          <Box 
            sx={{ 
              backgroundColor: '#EF4444', 
              color: '#FFFFFF', 
              p: 2, 
              textAlign: 'center', 
              fontWeight: 'bold',
              borderRadius: 1,
              mb: 3,
              boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)',
            }}
          >
            ⚠️ MOBILE PROCTOR DISCONNECTED! Ensure your mobile screen is open and connected to WiFi to resume the exam.
          </Box>
        )}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7} lg={7}>
            <BlankCard>
              <Box
                width="100%"
                minHeight="400px"
                boxShadow={3}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
              >
                {isLoading ? (
                  <CircularProgress />
                ) : (
                  <MultipleChoiceQuestion
                    submitTest={isMcqCompleted ? handleTestSubmission : handleMcqCompletion}
                    questions={data}
                    saveUserTestScore={saveUserTestScore}
                    answers={answers}
                    setAnswers={setAnswers}
                  />
                )}
              </Box>
            </BlankCard>
          </Grid>
          <Grid item xs={12} md={5} lg={5}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <BlankCard>
                  <Box
                    maxHeight="300px"
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'start',
                      justifyContent: 'center',
                      overflowY: 'auto',
                      height: '100%',
                    }}
                  >
                    <NumberOfQuestions
                      questionLength={questions.length}
                      submitTest={isMcqCompleted ? handleTestSubmission : handleMcqCompletion}
                      examDurationInSeconds={examDurationInSeconds}
                    />
                  </Box>
                </BlankCard>
              </Grid>
              <Grid item xs={12}>
                <BlankCard>
                  <Box
                    width="300px"
                    maxHeight="180px"
                    boxShadow={3}
                    display="flex"
                    flexDirection="column"
                    alignItems="start"
                    justifyContent="center"
                  >
                     <WebCam testId={testId} cheatingLog={cheatingLog} updateCheatingLog={updateCheatingLog} />
                  </Box>
                </BlankCard>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </PageContainer>
  );
};

export default TestPage;
