import mongoose from 'mongoose';

// WHAT: one learner's progress through one course.
// WHY server-side (not in the browser): progress must follow the learner across devices, and
// assessment results are graded by the server so answers cannot be read or faked in the page.
const courseProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  completedLessonIds: { type: [String], default: [] },
  // Every attempt is kept so the learner can retake; `best` is what counts toward completion.
  attempts: {
    type: [new mongoose.Schema({ assessmentId: String, score: Number, passed: Boolean, at: { type: Date, default: Date.now } }, { _id: false })],
    default: [],
  },
  lastLessonId: { type: String, default: '' },
}, { timestamps: true });

courseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);
