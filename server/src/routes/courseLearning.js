// Course authoring (seller) and learning (enrolled buyer) endpoints.
import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import mammoth from 'mammoth';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { AppError } from '../middleware/errorHandler.js';
import { Course } from '../models/Course.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Link } from '../models/Link.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { gradeAssessment, learnerView, polishText, sanitizeContent } from '../services/courseContent.js';

export const courseLearningRouter = Router();
courseLearningRouter.use(requireAuth);

const ACCESS_STATUSES = [TX_STATUS.PAID_HELD, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED, TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED];
const idParam = (value) => { if (!/^[\da-f]{24}$/i.test(value)) throw new AppError(400, 'Enter a valid course id'); return value; };

async function loadOwnedCourse(req) {
  const course = await Course.findById(idParam(req.params.id));
  if (!course || String(course.seller) !== String(req.sellerId)) throw new AppError(404, 'Course not found');
  return course;
}

// WHAT: may this user open the lessons? The course's own seller (to preview) or a buyer whose payment
// for this course went through. WHY re-check on every request: access must end if a payment is refunded.
async function loadAccessibleCourse(req) {
  const course = await Course.findById(idParam(req.params.id));
  if (!course) throw new AppError(404, 'Course not found');
  if (String(course.seller) === String(req.sellerId)) return { course, preview: true };
  const links = await Link.find({ listingId: course._id }).select('_id');
  const paid = links.length && await Transaction.exists({ buyerUserId: req.sellerId, linkId: { $in: links.map((l) => l._id) }, status: { $in: ACCESS_STATUSES } });
  if (!paid) throw new AppError(403, 'Enroll in this course to open the lessons.');
  return { course, preview: false };
}

// ---- Authoring ----
courseLearningRouter.get('/:id/content', asyncHandler(async (req, res) => {
  const course = await loadOwnedCourse(req);
  res.json({ title: course.title, content: course.content || { modules: [], assessments: [] } });
}));

courseLearningRouter.put('/:id/content', validate(Joi.object({ content: Joi.object().unknown(true).required() })), asyncHandler(async (req, res) => {
  const course = await loadOwnedCourse(req);
  course.content = sanitizeContent(req.body.content);
  course.markModified('content');
  await course.save();
  res.json({ content: course.content });
}));

// WHAT: turn an uploaded .txt / .md / .docx into clean lesson text.
// WHY server-side: Word files need a parser, and keeping it here means the same tidy-up rules apply
// to pasted text and uploaded files. PDFs are attached as downloads instead (their layout rarely converts cleanly).
const textUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
courseLearningRouter.post('/:id/import-text', uploadLimiter, textUpload.single('file'), asyncHandler(async (req, res) => {
  await loadOwnedCourse(req);
  const file = req.file;
  if (!file) throw new AppError(400, 'Choose a .txt, .md or .docx file.');
  const name = file.originalname.toLowerCase();
  let text;
  if (name.endsWith('.docx')) {
    try { text = (await mammoth.convertToMarkdown({ buffer: file.buffer })).value; } catch { throw new AppError(400, 'That Word file could not be read.'); }
    // mammoth escapes punctuation for markdown; undo the common escapes so the text reads naturally.
    text = text.replace(/\\([.\-()!#*_])/g, '$1').replace(/__/g, '**');
  } else if (name.endsWith('.txt') || name.endsWith('.md')) {
    text = file.buffer.toString('utf8');
  } else {
    throw new AppError(400, 'Only .txt, .md and .docx files can be turned into lesson text. Attach PDFs as downloads instead.');
  }
  res.json({ markdown: polishText(text) });
}));

// ---- Learning ----
courseLearningRouter.get('/:id/learn', asyncHandler(async (req, res) => {
  const { course, preview } = await loadAccessibleCourse(req);
  const progress = await CourseProgress.findOne({ userId: req.sellerId, courseId: course._id }).lean();
  const content = course.content || { modules: [], assessments: [] };
  res.json({
    course: { id: String(course._id), title: course.title },
    preview,
    ...learnerView(content),
    progress: { completedLessonIds: progress?.completedLessonIds || [], attempts: progress?.attempts || [], lastLessonId: progress?.lastLessonId || '' },
  });
}));

courseLearningRouter.post('/:id/lessons/:lessonId/complete', asyncHandler(async (req, res) => {
  const { course, preview } = await loadAccessibleCourse(req);
  const exists = (course.content?.modules || []).some((m) => m.lessons.some((l) => l.id === req.params.lessonId));
  if (!exists) throw new AppError(404, 'Lesson not found');
  // WHY no progress for the author's preview: it would pollute their own learner view and means nothing.
  if (preview) return res.json({ completedLessonIds: [] });
  const progress = await CourseProgress.findOneAndUpdate(
    { userId: req.sellerId, courseId: course._id },
    { $addToSet: { completedLessonIds: req.params.lessonId }, $set: { lastLessonId: req.params.lessonId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ completedLessonIds: progress.completedLessonIds });
}));

const submitSchema = Joi.object({ answers: Joi.object().pattern(/^[a-f0-9]{12}$/, Joi.array().items(Joi.string().max(40)).max(8)).required() });
courseLearningRouter.post('/:id/assessments/:assessmentId/submit', validate(submitSchema), asyncHandler(async (req, res) => {
  const { course, preview } = await loadAccessibleCourse(req);
  const assessment = (course.content?.assessments || []).find((a) => a.id === req.params.assessmentId);
  if (!assessment) throw new AppError(404, 'Assessment not found');
  const graded = gradeAssessment(assessment, req.body.answers);
  if (!preview) {
    await CourseProgress.findOneAndUpdate(
      { userId: req.sellerId, courseId: course._id },
      { $push: { attempts: { assessmentId: assessment.id, score: graded.score, passed: graded.passed } } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  res.json(graded);
}));
