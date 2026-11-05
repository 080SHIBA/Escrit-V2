import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence, contentProblems, moveItem, newAssessment, newModule, newQuestion, progressPercent } from './courseAuthoring.js';
import { parseInline, parseMarkdown, readingMinutes } from './lessonMarkdown.js';

test('assessments appear right after their lesson; unplaced ones go last', () => {
  const m = newModule(); m.lessons.push({ ...m.lessons[0], id: 'l2' }); m.lessons[0].id = 'l1';
  const a1 = { ...newAssessment(), id: 'a1', afterLessonId: 'l1' };
  const a2 = { ...newAssessment(), id: 'a2', afterLessonId: null };
  assert.deepEqual(buildSequence([m], [a2, a1]).map((s) => s.id), ['l1', 'a1', 'l2', 'a2']);
});
test('progress counts completed lessons and passed assessments', () => {
  const steps = [{ kind: 'lesson', id: 'l1' }, { kind: 'assessment', id: 'a1' }];
  assert.equal(progressPercent(steps, ['l1'], [{ assessmentId: 'a1', passed: false }]), 50);
  assert.equal(progressPercent(steps, ['l1'], [{ assessmentId: 'a1', passed: true }]), 100);
  assert.equal(progressPercent([], [], []), 0);
});
test('moveItem stays in bounds', () => {
  assert.deepEqual(moveItem([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(moveItem([1, 2, 3], 0, 1), [2, 1, 3]);
});
test('authoring problems are listed', () => {
  const q = newQuestion(); 
  const problems = contentProblems({ modules: [newModule()], assessments: [{ ...newAssessment(), questions: [q] }] });
  assert.ok(problems.length >= 4);
});
test('markdown parses blocks and only links https', () => {
  const blocks = parseMarkdown('## Title\n\nHello **world** and [site](https://a.test) [bad](javascript:x)\n\n- one\n- two\n\n1. a\n2. b');
  assert.equal(blocks[0].type, 'h');
  assert.deepEqual(blocks[1].inline.filter((p) => p.type === 'link').map((p) => p.href), ['https://a.test']);
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[3].ordered, true);
  assert.equal(parseInline('<script>alert(1)</script>')[0].type, 'text');
});
test('reading time', () => { assert.equal(readingMinutes('word '.repeat(450)), 2); assert.equal(readingMinutes(''), 1); });
