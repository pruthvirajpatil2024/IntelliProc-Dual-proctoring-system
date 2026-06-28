import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from '@mui/material';
import { Trash } from 'lucide-react';
import CustomTextField from '../../../components/forms/theme-elements/CustomTextField';
import CodingQuestionForm from './CodingQuestionForm';

const CreateExam = ({ formik, title, subtitle, subtext, students = [] }) => {
  const { values, errors, touched, handleBlur, handleChange, handleSubmit, setFieldValue } = formik;

  return (
    <>
      {title ? (
        <Typography fontWeight="700" variant="h2" mb={1}>
          {title}
        </Typography>
      ) : null}

      {subtext}

      <Box component="form">
        <Stack mb={3}>
          <CustomTextField
            id="examName"
            name="examName"
            label="Exam Name"
            variant="outlined"
            fullWidth
            value={values.examName}
            onChange={handleChange}
            error={touched.examName && Boolean(errors.examName)}
            helperText={touched.examName && errors.examName}
          />
        </Stack>

        <Stack mb={3}>
          <CustomTextField
            id="totalQuestions"
            name="totalQuestions"
            label="Total Number of Questions"
            variant="outlined"
            fullWidth
            value={values.totalQuestions}
            onChange={handleChange}
            error={touched.totalQuestions && Boolean(errors.totalQuestions)}
            helperText={touched.totalQuestions && errors.totalQuestions}
          />
        </Stack>

        <Stack mb={3}>
          <CustomTextField
            id="duration"
            name="duration"
            label="Exam Duration (minutes)"
            variant="outlined"
            fullWidth
            value={values.duration}
            onChange={handleChange}
            error={touched.duration && Boolean(errors.duration)}
            helperText={touched.duration && errors.duration}
          />
        </Stack>

        <Stack mb={3}>
          <CustomTextField
            id="liveDate"
            name="liveDate"
            label="Live Date and Time"
            type="datetime-local"
            variant="outlined"
            fullWidth
            value={values.liveDate}
            onChange={handleChange}
            error={touched.liveDate && Boolean(errors.liveDate)}
            helperText={touched.liveDate && errors.liveDate}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Stack>

        <Stack mb={3}>
          <CustomTextField
            id="deadDate"
            name="deadDate"
            label="Dead Date and Time"
            type="datetime-local"
            variant="outlined"
            fullWidth
            value={values.deadDate}
            onChange={handleChange}
            error={touched.deadDate && Boolean(errors.deadDate)}
            helperText={touched.deadDate && errors.deadDate}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Stack>

        <Stack mb={3}>
          <Typography variant="h5" fontWeight={600} mb={1}>
            Assign Students & Attempt Limits
          </Typography>
          <Autocomplete
            multiple
            id="assign-students-autocomplete"
            options={students}
            getOptionLabel={(option) => `${option.name} (${option.email})`}
            value={students.filter(s => values.assignedStudents?.some(as => as.studentId === s._id)) || []}
            onChange={(event, newValue) => {
              const updated = newValue.map(student => {
                return {
                  studentId: student._id,
                  studentEmail: student.email,
                  studentName: student.name,
                  attemptsAllowed: 1,
                };
              });
              setFieldValue('assignedStudents', updated);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Search and Select Students"
                placeholder="Select Students"
              />
            )}
          />
        </Stack>

        {values.assignedStudents && values.assignedStudents.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: '12px', overflow: 'hidden' }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell><strong>Student Name</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell align="right" style={{ width: '80px' }}><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {values.assignedStudents.map((as) => (
                  <TableRow key={as.studentId}>
                    <TableCell>{as.studentName}</TableCell>
                    <TableCell>{as.studentEmail}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="error"
                        onClick={() => {
                          const updated = values.assignedStudents.filter(item => item.studentId !== as.studentId);
                          setFieldValue('assignedStudents', updated);
                        }}
                      >
                        <Trash size={18} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <CodingQuestionForm formik={formik} />

        <Button
          color="primary"
          variant="contained"
          size="large"
          fullWidth
          type="submit"
          disabled={formik.isSubmitting}
          onClick={handleSubmit}
        >
          Create Exam
        </Button>
      </Box>

      {subtitle}
    </>
  );
};

export default CreateExam;
