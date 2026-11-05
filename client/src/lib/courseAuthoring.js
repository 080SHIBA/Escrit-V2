// WHAT: pure helpers for the course authoring screen and learning screen.
// WHY pure: building ids, reordering and working out "what comes next" are easy to get subtly wrong,
// so they live here where they can be tested.
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

export const newLesson = () => ({ id: id(), title: '', summary: '', bodyMarkdown: '', videoUrl: '', attachments: [] });
export const newModule = () => ({ id: id(), title: '', lessons: [newLesson()] });
export function newQuestion(type = 'single') {
  const options = type === 'truefalse' ? [{ id: id(), text: 'True' }, { id: id(), text: 'False' }] : [{ id: id(), text: '' }, { id: id(), text: '' }];
  return { id: id(), prompt: '', type, options, correct: [], explanation: '' };
}
export const newAssessment = () => ({ id: id(), title: '', afterLessonId: null, passMark: 60, questions: [newQuestion()] });
export const newOption = () => ({ id: id(), text: '' });

export function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// WHAT: the learner's reading order: each lesson, with its assessment (if any) right after it, and
// assessments with no lesson placed at the very end.
// WHY: this is the "junction" idea: assessments are taken at the point the seller chose.
export function buildSequence(modules, assessments) {
  const steps = [];
  const placed = new Set();
  for (const module of modules) {
    for (const lesson of module.lessons) {
      steps.push({ kind: 'lesson', id: lesson.id, moduleId: module.id, title: lesson.title });
      for (const assessment of assessments.filter((a) => a.afterLessonId === lesson.id)) {
        steps.push({ kind: 'assessment', id: assessment.id, title: assessment.title });
        placed.add(assessment.id);
      }
    }
  }
  for (const assessment of assessments) if (!placed.has(assessment.id)) steps.push({ kind: 'assessment', id: assessment.id, title: assessment.title });
  return steps;
}

// Course progress as a whole number: lessons completed plus assessments passed.
export function progressPercent(steps, completedLessonIds, attempts) {
  if (!steps.length) return 0;
  const passed = new Set(attempts.filter((a) => a.passed).map((a) => a.assessmentId));
  const done = steps.filter((step) => (step.kind === 'lesson' ? completedLessonIds.includes(step.id) : passed.has(step.id))).length;
  return Math.round((done / steps.length) * 100);
}

// What the authoring screen warns about before saving (the server enforces the same rules).
export function contentProblems(content) {
  const problems = [];
  content.modules.forEach((m, mi) => {
    if (!m.title.trim()) problems.push(`Module ${mi + 1} needs a title.`);
    m.lessons.forEach((l, li) => { if (!l.title.trim()) problems.push(`Lesson ${li + 1} in module ${mi + 1} needs a title.`); });
  });
  content.assessments.forEach((a, ai) => {
    if (!a.title.trim()) problems.push(`Assessment ${ai + 1} needs a title.`);
    a.questions.forEach((q, qi) => {
      const where = `Question ${qi + 1} in assessment ${ai + 1}`;
      if (!q.prompt.trim()) problems.push(`${where} needs question text.`);
      if (q.options.filter((o) => o.text.trim()).length < 2) problems.push(`${where} needs at least two options.`);
      if (!q.correct.length) problems.push(`${where} needs a correct answer.`);
    });
  });
  return problems;
}
