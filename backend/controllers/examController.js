import asyncHandler from "express-async-handler";
import Exam from "./../models/examModel.js";
import Result from "./../models/resultModel.js";

// @desc Get all exams
// @route GET /api/exams
// @access Public
const getExams = asyncHandler(async (req, res) => {
  const exams = await Exam.find();

  if (req.user && req.user.role === "student") {
    const studentIdStr = req.user._id.toString();
    const studentEmail = req.user.email;

    const filteredExams = exams.filter(exam =>
      exam.assignedStudents && exam.assignedStudents.some(as =>
        (as.studentId && as.studentId.toString() === studentIdStr) ||
        (as.studentEmail && as.studentEmail.toLowerCase() === studentEmail.toLowerCase())
      )
    );

    const examsWithAttempts = await Promise.all(filteredExams.map(async (exam) => {
      const attemptsCount = await Result.countDocuments({
        examId: exam.examId,
        userId: req.user._id
      });

      const assignment = exam.assignedStudents.find(as =>
        (as.studentId && as.studentId.toString() === studentIdStr) ||
        (as.studentEmail && as.studentEmail.toLowerCase() === studentEmail.toLowerCase())
      );

      const attemptsAllowed = (assignment && assignment.attemptsAllowed !== undefined && assignment.attemptsAllowed !== null) ? assignment.attemptsAllowed : 1;

      const examObj = exam.toObject();
      examObj.attemptsCount = attemptsCount;
      examObj.attemptsAllowed = attemptsAllowed;
      return examObj;
    }));

    return res.status(200).json(examsWithAttempts);
  }

  res.status(200).json(exams);
});

// @desc Create a new exam
// @route POST /api/exams
// @access Private (admin)
const createExam = asyncHandler(async (req, res) => {
  const { examName, totalQuestions, duration, liveDate, deadDate, assignedStudents } = req.body;

  const exam = new Exam({
    examName,
    totalQuestions,
    duration,
    liveDate,
    deadDate,
    assignedStudents: assignedStudents || [],
  });

  const createdExam = await exam.save();

  if (createdExam) {
    res.status(201).json(createdExam);
  } else {
    res.status(400);
    throw new Error("Invalid Exam Data");
  }
});

const DeleteExamById = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const exam = await Exam.findOneAndDelete({ examId: examId });
  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }
  console.log("deleted exam", exam);
  res.status(200).json(exam);
});

export { getExams, createExam, DeleteExamById };
