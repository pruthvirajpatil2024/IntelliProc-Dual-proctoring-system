import asyncHandler from "express-async-handler";
import Question from "../models/quesModel.js";
import Exam from "../models/examModel.js";
import Result from "../models/resultModel.js";

const getQuestionsByExamId = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  console.log("Question Exam id ", examId);

  if (!examId) {
    return res.status(400).json({ error: "examId is missing or invalid" });
  }

  if (req.user && req.user.role === "student") {
    // Check if the student is assigned to this exam
    const exam = await Exam.findOne({ examId });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const studentIdStr = req.user._id.toString();
    const studentEmail = req.user.email;
    const assignment = exam.assignedStudents && exam.assignedStudents.find(as =>
      (as.studentId && as.studentId.toString() === studentIdStr) ||
      (as.studentEmail && as.studentEmail.toLowerCase() === studentEmail.toLowerCase())
    );

    if (!assignment) {
      res.status(403);
      throw new Error("Access Denied: You are not assigned to this exam");
    }

    // Check attempts count
    const attemptsCount = await Result.countDocuments({
      examId,
      userId: req.user._id
    });

    const allowed = (assignment.attemptsAllowed !== undefined && assignment.attemptsAllowed !== null) ? assignment.attemptsAllowed : 1;
    if (attemptsCount >= allowed) {
      res.status(403);
      throw new Error("Access Denied: You have reached the maximum attempts allowed for this exam");
    }
  }

  const questions = await Question.find({ examId });
  console.log("Question Exam  ", questions);

  res.status(200).json(questions);
});

const createQuestion = asyncHandler(async (req, res) => {
  const { question, options, examId } = req.body;

  if (!examId) {
    return res.status(400).json({ error: "examId is missing or invalid" });
  }

  const newQuestion = new Question({
    question,
    options,
    examId,
  });

  const createdQuestion = await newQuestion.save();

  if (createdQuestion) {
    res.status(201).json(createdQuestion);
  } else {
    res.status(400);
    throw new Error("Invalid Question Data");
  }
});

export { getQuestionsByExamId, createQuestion };
