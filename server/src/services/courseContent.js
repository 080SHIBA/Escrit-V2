// WHAT: everything about a course's teaching content that is pure logic: cleaning what a seller
// saves, hiding answers from learners, grading, and tidying pasted or uploaded text.
// WHY pure and separate from the routes: it decides what learners see and whether they pass, so it
// is tested on its own, with no database.
import crypto from 'node:crypto';
import { AppError } from '../middleware/errorHandler.js';

const LIMITS = { modules: 40, lessonsPerModule: 60, assessments: 40, questions: 60, options: 8, text: 60_000, title: 160, attachments: 10 };
const newId = () => crypto.randomBytes(6).toString('hex');
const str = (value, max) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

// WHAT: only https links are kept for videos and files.
// WHY: these URLs are rendered in the learner's browser, so javascript: or data: links must never get in.
function safeUrl(value) {
  const url = str(value, 1000);
  return /^https:\/\/[^\s]+$/i.test(url) ? url : '';
}

// WHAT: validate and normalise content a seller submits. Throws AppError(400) with a readable reason.
// WHY normalise instead of trusting: this is stored and later shown to every learner, so ids must be
// unique, links safe, and every question must be answerable.
export function sanitizeContent(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const modules = (Array.isArray(raw.modules) ? raw.modules : []).slice(0, LIMITS.modules).map((module, mIndex) => {
    const title = str(module.title, LIMITS.title);
    if (!title) throw new AppError(400, `Module ${mIndex + 1} needs a title.`);
    const lessons = (Array.isArray(module.lessons) ? module.lessons : []).slice(0, LIMITS.lessonsPerModule).map((lesson, lIndex) => {
      const lessonTitle = str(lesson.title, LIMITS.title);
      if (!lessonTitle) throw new AppError(400, `Lesson ${lIndex + 1} in “${title}” needs a title.`);
      return {
        id: /^[a-f0-9]{12}$/.test(lesson.id) ? lesson.id : newId(),
        title: lessonTitle,
        summary: str(lesson.summary, 400),
        bodyMarkdown: str(lesson.bodyMarkdown, LIMITS.text),
        videoUrl: safeUrl(lesson.videoUrl),
        attachments: (Array.isArray(lesson.attachments) ? lesson.attachments : []).slice(0, LIMITS.attachments)
          .map((file) => ({ name: str(file.name, 120) || 'Download', url: safeUrl(file.url), kind: ['pdf', 'doc', 'text', 'other'].includes(file.kind) ? file.kind : 'other' }))
          .filter((file) => file.url),
      };
    });
    return { id: /^[a-f0-9]{12}$/.test(module.id) ? module.id : newId(), title, lessons };
  });

  const lessonIds = new Set(modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const assessments = (Array.isArray(raw.assessments) ? raw.assessments : []).slice(0, LIMITS.assessments).map((assessment, aIndex) => {
    const title = str(assessment.title, LIMITS.title);
    if (!title) throw new AppError(400, `Assessment ${aIndex + 1} needs a title.`);
    // WHAT: the "junction": the lesson after which this assessment is taken (null = at the end of the course).
    const afterLessonId = lessonIds.has(assessment.afterLessonId) ? assessment.afterLessonId : null;
    const questions = (Array.isArray(assessment.questions) ? assessment.questions : []).slice(0, LIMITS.questions).map((question, qIndex) => {
      const where = `Question ${qIndex + 1} in “${title}”`;
      const prompt = str(question.prompt, 1000);
      if (!prompt) throw new AppError(400, `${where} needs question text.`);
      const type = ['single', 'multiple', 'truefalse'].includes(question.type) ? question.type : 'single';
      let options = (Array.isArray(question.options) ? question.options : []).slice(0, LIMITS.options)
        .map((option) => ({ id: /^[a-f0-9]{12}$/.test(option.id) ? option.id : newId(), text: str(option.text, 300) }))
        .filter((option) => option.text);
      // True/false questions always have exactly the two fixed options.
      if (type === 'truefalse') {
        const old = Array.isArray(question.options) ? question.options : [];
        options = [{ id: /^[a-f0-9]{12}$/.test(old[0]?.id) ? old[0].id : newId(), text: 'True' }, { id: /^[a-f0-9]{12}$/.test(old[1]?.id) ? old[1].id : newId(), text: 'False' }];
      }
      if (options.length < 2) throw new AppError(400, `${where} needs at least two answer options.`);
      const optionIds = new Set(options.map((option) => option.id));
      const correct = [...new Set(Array.isArray(question.correct) ? question.correct : [])].filter((id) => optionIds.has(id));
      if (!correct.length) throw new AppError(400, `${where} needs a correct answer marked.`);
      if (type !== 'multiple' && correct.length !== 1) throw new AppError(400, `${where} must have exactly one correct answer.`);
      return { id: /^[a-f0-9]{12}$/.test(question.id) ? question.id : newId(), prompt, type, options, correct, explanation: str(question.explanation, 1500) };
    });
    if (!questions.length) throw new AppError(400, `“${title}” needs at least one question.`);
    const passMark = Math.min(100, Math.max(1, Math.round(Number(assessment.passMark) || 60)));
    return { id: /^[a-f0-9]{12}$/.test(assessment.id) ? assessment.id : newId(), title, afterLessonId, passMark, questions };
  });
  return { modules, assessments };
}

// WHAT: what a learner may see: everything except which answers are correct and their explanations.
// WHY: if answers were sent to the page, anyone could read them in the browser's network tab.
export function learnerView(content) {
  return {
    modules: content.modules,
    assessments: content.assessments.map((assessment) => ({
      id: assessment.id, title: assessment.title, afterLessonId: assessment.afterLessonId, passMark: assessment.passMark,
      questions: assessment.questions.map((q) => ({ id: q.id, prompt: q.prompt, type: q.type, options: q.options })),
    })),
  };
}

// WHAT: grade one attempt. `answers` is { questionId: [optionId, ...] }.
// A question is right only when the chosen set equals the correct set (so a "select all" question
// cannot be passed by ticking everything). Explanations are returned here, after the attempt.
export function gradeAssessment(assessment, answers = {}) {
  const results = assessment.questions.map((question) => {
    const chosen = new Set(Array.isArray(answers[question.id]) ? answers[question.id] : []);
    const correct = new Set(question.correct);
    const right = chosen.size === correct.size && [...chosen].every((id) => correct.has(id));
    return { questionId: question.id, correct: right, correctOptionIds: question.correct, explanation: question.explanation || '' };
  });
  const score = Math.round((results.filter((r) => r.correct).length / results.length) * 100);
  return { score, passed: score >= assessment.passMark, results };
}

// WHAT: tidy pasted or uploaded plain text into clean Markdown for the lesson reader.
// WHY: text from PDFs, Word and notes arrives hard-wrapped mid-sentence, with ALL-CAPS headings and
// mixed bullet characters. Fixing that automatically means a seller can upload as-is and learners still
// get a clean, scannable lesson.
export function polishText(input) {
  const lines = String(input || '').replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n').map((line) => line.replace(/\s+$/g, ''));
  const out = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) { out.push(paragraph.join(' ').replace(/\s{2,}/g, ' ')); paragraph = []; } };
  const bullet = /^\s*(?:[-*•▪◦‣–]|\d{1,2}[.)])\s+(.*)$/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (/^#{1,4}\s/.test(trimmed)) { flush(); out.push(trimmed); continue; }
    const bulletMatch = bullet.exec(line);
    if (bulletMatch) {
      flush();
      out.push(/^\s*\d/.test(line) ? `${/^\s*(\d{1,2})/.exec(line)[1]}. ${bulletMatch[1]}` : `- ${bulletMatch[1]}`);
      continue;
    }
    // A short line in capitals, or a short line ending with a colon, reads as a heading.
    const looksLikeHeading = trimmed.length <= 70 && !/[.!?,]$/.test(trimmed) && ((/[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase() && trimmed.length > 3) || /:$/.test(trimmed));
    if (looksLikeHeading && !paragraph.length) {
      const text = trimmed.replace(/:$/, '');
      out.push(`## ${text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text}`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  // Blank line between blocks, but list items stay together.
  return out.reduce((acc, block, index) => {
    const prev = out[index - 1];
    const listy = (b) => /^(- |\d+\. )/.test(b);
    return acc + (index === 0 ? '' : listy(block) && prev && listy(prev) ? '\n' : '\n\n') + block;
  }, '').trim().slice(0, LIMITS.text);
}
