import test from 'node:test';
import assert from 'node:assert/strict';
const { sanitizeContent, learnerView, gradeAssessment, polishText } = await import('./courseContent.js');

const base = () => ({
  modules: [{ title: 'Intro', lessons: [{ id: 'aaaaaaaaaaaa', title: 'Welcome', bodyMarkdown: 'Hi', videoUrl: 'javascript:alert(1)', attachments: [{ name: 'x', url: 'http://insecure.test/a.pdf', kind: 'pdf' }, { name: 'ok', url: 'https://cdn.test/a.pdf', kind: 'pdf' }] }] }],
  assessments: [{ title: 'Quiz 1', afterLessonId: 'aaaaaaaaaaaa', passMark: 70, questions: [
    { prompt: '2+2?', type: 'single', options: [{ id: 'b00000000001', text: '3' }, { id: 'b00000000002', text: '4' }], correct: ['b00000000002'], explanation: 'Basic sums.' },
    { prompt: 'Pick primes', type: 'multiple', options: [{ id: 'c00000000001', text: '2' }, { id: 'c00000000002', text: '3' }, { id: 'c00000000003', text: '4' }], correct: ['c00000000001', 'c00000000002'] },
  ] }],
});

test('unsafe links are dropped, safe ones kept', () => {
  const clean = sanitizeContent(base());
  assert.equal(clean.modules[0].lessons[0].videoUrl, '');
  assert.deepEqual(clean.modules[0].lessons[0].attachments.map((a) => a.url), ['https://cdn.test/a.pdf']);
});
test('every question must be answerable', () => {
  const noCorrect = base(); noCorrect.assessments[0].questions[0].correct = [];
  assert.throws(() => sanitizeContent(noCorrect), /correct answer/);
  const twoCorrectSingle = base(); twoCorrectSingle.assessments[0].questions[0].correct = ['b00000000001', 'b00000000002'];
  assert.throws(() => sanitizeContent(twoCorrectSingle), /exactly one/);
  const oneOption = base(); oneOption.assessments[0].questions[0].options = [{ text: 'only' }];
  assert.throws(() => sanitizeContent(oneOption), /two answer/);
});
test('junction must point at a real lesson, otherwise end of course', () => {
  const content = base(); content.assessments[0].afterLessonId = 'nope';
  assert.equal(sanitizeContent(content).assessments[0].afterLessonId, null);
});
test('learners never receive answers or explanations', () => {
  const view = JSON.stringify(learnerView(sanitizeContent(base())));
  assert.doesNotMatch(view, /correct|explanation|Basic sums/);
});
test('grading needs the exact set for multiple choice, and returns explanations after', () => {
  const [assessment] = sanitizeContent(base()).assessments;
  const [q1, q2] = assessment.questions;
  const perfect = gradeAssessment(assessment, { [q1.id]: [q1.correct[0]], [q2.id]: q2.correct });
  assert.equal(perfect.score, 100); assert.equal(perfect.passed, true);
  assert.equal(perfect.results[0].explanation, 'Basic sums.');
  const tickAll = gradeAssessment(assessment, { [q1.id]: [q1.correct[0]], [q2.id]: q2.options.map((o) => o.id) });
  assert.equal(tickAll.score, 50); assert.equal(tickAll.passed, false);
  assert.equal(gradeAssessment(assessment, {}).score, 0);
});
test('polishText unwraps lines, finds headings and lists', () => {
  const md = polishText('INTRODUCTION\nThis is a long sentence that was\nwrapped by a PDF export.\n\n• first point\n• second point\n\nSteps:\n1) Do this\n2) Do that');
  assert.match(md, /^## Introduction\n\nThis is a long sentence that was wrapped by a PDF export\./);
  assert.match(md, /- first point\n- second point/);
  assert.match(md, /## Steps\n\n1\. Do this\n2\. Do that/);
});
