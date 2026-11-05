import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LessonText from '../components/course/LessonText.jsx';
import { api } from '../lib/api.js';
import { buildSequence, progressPercent } from '../lib/courseAuthoring.js';
import { readingMinutes } from '../lib/lessonMarkdown.js';
import { usePageTitle } from '../lib/usePageTitle.js';

// WHAT: the learner's course screen. A sidebar outline (with ticks), a progress bar, and a main area
// that shows one step at a time: a lesson (video, formatted text, downloads) or an assessment taken at
// the point the author placed it.
// WHY one step at a time: it keeps attention on the current idea, works well on a phone, and makes
// "Next" the obvious action, which is what drives people to finish a course.
export default function CourseLearnPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(null); // { kind, id }
  const [outlineOpen, setOutlineOpen] = useState(false);
  usePageTitle(data?.course?.title || 'Course');

  useEffect(() => {
    let active = true;
    api.getCourseLearning(id).then((result) => {
      if (!active) return;
      setData(result);
      const steps = buildSequence(result.modules, result.assessments);
      const resume = steps.find((s) => s.id === result.progress.lastLessonId);
      const firstUndone = steps.find((s) => s.kind === 'lesson' && !result.progress.completedLessonIds.includes(s.id));
      setCurrent(resume ? steps[Math.min(steps.indexOf(resume) + (result.progress.completedLessonIds.includes(resume.id) ? 1 : 0), steps.length - 1)] : firstUndone || steps[0] || null);
    }).catch((cause) => { if (active) setError(cause?.message || 'This course could not be opened.'); });
    return () => { active = false; };
  }, [id]);

  const steps = useMemo(() => (data ? buildSequence(data.modules, data.assessments) : []), [data]);
  const percent = data ? progressPercent(steps, data.progress.completedLessonIds, data.progress.attempts) : 0;
  const index = steps.findIndex((s) => current && s.kind === current.kind && s.id === current.id);
  const next = steps[index + 1];

  const complete = useCallback(async (lessonId) => {
    try {
      const { completedLessonIds } = await api.completeLesson(id, lessonId);
      setData((d) => ({ ...d, progress: { ...d.progress, completedLessonIds: data?.preview ? d.progress.completedLessonIds : completedLessonIds, lastLessonId: lessonId } }));
    } catch { /* progress will retry on the next lesson; reading is not blocked */ }
  }, [id, data?.preview]);

  if (error) return <main className="mx-auto max-w-md px-4 py-12 text-center"><p role="alert" className="text-dispute">{error}</p><Link to="/account/orders?role=buy" className="mt-4 inline-block underline">Back to my orders</Link></main>;
  if (!data) return <main className="mx-auto max-w-md px-4 py-12 text-center text-ink/60" aria-busy="true">Opening your course…</main>;
  if (!steps.length) return <main className="mx-auto max-w-md px-4 py-12 text-center"><h1 className="font-display text-2xl">{data.course.title}</h1><p className="mt-3 text-ink/65">The instructor hasn’t added lessons yet. Please check back soon.</p></main>;

  const passed = new Set(data.progress.attempts.filter((a) => a.passed).map((a) => a.assessmentId));
  const lessonsById = new Map(data.modules.flatMap((m) => m.lessons.map((l) => [l.id, l])));
  const go = (step) => { setCurrent({ kind: step.kind, id: step.id }); setOutlineOpen(false); window.scrollTo({ top: 0 }); };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        {data.preview && <p className="mb-2 rounded-lg bg-paper-2 px-3 py-2 text-xs text-ink/65">Preview: you’re seeing this as a learner. Progress isn’t recorded.</p>}
        <h1 className="font-display text-2xl sm:text-3xl">{data.course.title}</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
          <span className="text-sm font-medium tabular-nums">{percent}%</span>
          <button type="button" onClick={() => setOutlineOpen((open) => !open)} className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium min-[860px]:hidden" aria-expanded={outlineOpen}>Outline</button>
        </div>
      </header>

      <div className="grid gap-6 min-[860px]:grid-cols-[18rem_minmax(0,1fr)]">
        <nav aria-label="Course outline" className={`${outlineOpen ? 'block' : 'hidden'} min-[860px]:block`}>
          <div className="space-y-5 rounded-2xl border border-line bg-paper-2 p-4 min-[860px]:sticky min-[860px]:top-4 min-[860px]:max-h-[calc(100dvh-2rem)] min-[860px]:overflow-y-auto">
            {data.modules.map((module, mi) => (
              <div key={module.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Module {mi + 1}</p>
                <p className="font-medium">{module.title}</p>
                <ul className="mt-2 space-y-1">
                  {module.lessons.flatMap((lesson) => [
                    { step: { kind: 'lesson', id: lesson.id }, title: lesson.title, done: data.progress.completedLessonIds.includes(lesson.id) },
                    ...data.assessments.filter((a) => a.afterLessonId === lesson.id).map((a) => ({ step: { kind: 'assessment', id: a.id }, title: `Quiz: ${a.title}`, done: passed.has(a.id) })),
                  ]).map(({ step, title, done }) => {
                    const active = current?.kind === step.kind && current.id === step.id;
                    return (
                      <li key={`${step.kind}-${step.id}`}>
                        <button type="button" onClick={() => go(step)} aria-current={active ? 'step' : undefined} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${active ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-paper-3'}`}>
                          <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${done ? 'border-released bg-released text-paper' : 'border-line-strong'}`}>{done ? '✓' : ''}</span>
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                          <span className="sr-only">{done ? 'completed' : 'not completed'}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {data.assessments.filter((a) => !a.afterLessonId).length > 0 && (
              <div>
                <p className="font-medium">Final assessments</p>
                <ul className="mt-2 space-y-1">{data.assessments.filter((a) => !a.afterLessonId).map((a) => (
                  <li key={a.id}><button type="button" onClick={() => go({ kind: 'assessment', id: a.id })} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-paper-3"><span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${passed.has(a.id) ? 'border-released bg-released text-paper' : 'border-line-strong'}`}>{passed.has(a.id) ? '✓' : ''}</span>Quiz: {a.title}</button></li>
                ))}</ul>
              </div>
            )}
          </div>
        </nav>

        <main className="min-w-0 pb-24">
          {current?.kind === 'lesson' && lessonsById.get(current.id) && (
            <Lesson key={current.id} lesson={lessonsById.get(current.id)} done={data.progress.completedLessonIds.includes(current.id)} hasNext={Boolean(next)} onDone={() => complete(current.id)} onNext={() => next && go(next)} />
          )}
          {current?.kind === 'assessment' && (
            <Assessment key={current.id} courseId={id} assessment={data.assessments.find((a) => a.id === current.id)} hasNext={Boolean(next)} onNext={() => next && go(next)}
              onResult={(result) => setData((d) => ({ ...d, progress: { ...d.progress, attempts: d.preview ? d.progress.attempts : [...d.progress.attempts, { assessmentId: current.id, score: result.score, passed: result.passed }] } }))} />
          )}
        </main>
      </div>
    </div>
  );
}

function Lesson({ lesson, done, hasNext, onDone, onNext }) {
  return (
    <article>
      <p className="text-sm text-ink/55">{readingMinutes(lesson.bodyMarkdown)} min read{lesson.videoUrl ? ' · includes video' : ''}</p>
      <h2 className="mt-1 font-display text-3xl leading-tight">{lesson.title}</h2>
      {lesson.summary && <p className="mt-3 max-w-[68ch] text-lg text-ink/70">{lesson.summary}</p>}
      {lesson.videoUrl && (
        // WHY controls + playsInline + preload metadata: the learner decides when to play, it stays inline on iPhones,
        // and nothing heavy downloads until needed (important on mobile data).
        <video src={lesson.videoUrl} controls playsInline preload="metadata" className="mt-6 aspect-video w-full max-w-3xl rounded-2xl bg-ink" aria-label={`Video for ${lesson.title}`} />
      )}
      <div className="mt-6"><LessonText markdown={lesson.bodyMarkdown} /></div>
      {lesson.attachments.length > 0 && (
        <section className="mt-8" aria-label="Downloads">
          <h3 className="font-display text-lg">Downloads</h3>
          <ul className="mt-2 space-y-2">{lesson.attachments.map((file) => <li key={file.url}><a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium hover:border-accent">{file.name}</a></li>)}</ul>
        </section>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur min-[860px]:static min-[860px]:mt-10 min-[860px]:border-0 min-[860px]:bg-transparent min-[860px]:p-0">
        <div className="mx-auto flex max-w-6xl justify-end gap-2">
          {!done && <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-line-strong px-5 text-sm font-semibold">Mark complete</button>}
          {hasNext && <button type="button" onClick={() => { if (!done) onDone(); onNext(); }} className="min-h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-accent-ink">{done ? 'Next' : 'Complete & continue'}</button>}
          {!hasNext && done && <p className="self-center text-sm font-medium text-released">You’ve finished this course. 🎉</p>}
        </div>
      </div>
    </article>
  );
}

function Assessment({ courseId, assessment, hasNext, onNext, onResult }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!assessment) return null;
  const answered = assessment.questions.every((q) => (answers[q.id] || []).length > 0);

  function choose(question, optionId) {
    setAnswers((current) => {
      const chosen = current[question.id] || [];
      if (question.type === 'multiple') return { ...current, [question.id]: chosen.includes(optionId) ? chosen.filter((x) => x !== optionId) : [...chosen, optionId] };
      return { ...current, [question.id]: [optionId] };
    });
  }
  async function submit() {
    setBusy(true); setError('');
    try { const graded = await api.submitAssessment(courseId, assessment.id, answers); setResult(graded); onResult(graded); }
    catch (cause) { setError(cause?.message || 'Your answers could not be submitted.'); }
    setBusy(false);
  }
  const byQuestion = new Map((result?.results || []).map((r) => [r.questionId, r]));

  return (
    <article>
      <p className="text-sm text-ink/55">Assessment · pass mark {assessment.passMark}%</p>
      <h2 className="mt-1 font-display text-3xl">{assessment.title}</h2>
      <ol className="mt-6 space-y-6">
        {assessment.questions.map((question, qi) => {
          const graded = byQuestion.get(question.id);
          return (
            <li key={question.id} className="rounded-2xl border border-line bg-paper-2 p-4">
              <fieldset disabled={Boolean(result)}>
                <legend className="font-medium">{qi + 1}. {question.prompt}</legend>
                {question.type === 'multiple' && <p className="mt-1 text-xs text-ink/55">Select all that apply.</p>}
                <div className="mt-3 space-y-2">
                  {question.options.map((option) => {
                    const checked = (answers[question.id] || []).includes(option.id);
                    const isCorrect = graded?.correctOptionIds.includes(option.id);
                    return (
                      <label key={option.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm ${graded ? (isCorrect ? 'border-released bg-released-soft' : checked ? 'border-dispute/50 bg-dispute-soft' : 'border-line') : checked ? 'border-accent bg-accent/5' : 'border-line'}`}>
                        <input type={question.type === 'multiple' ? 'checkbox' : 'radio'} name={question.id} checked={checked} onChange={() => choose(question, option.id)} className="h-4 w-4 accent-ink" />
                        <span>{option.text}</span>
                        {graded && isCorrect && <span className="ml-auto text-xs font-semibold text-released">Correct answer</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {graded && (
                <div role="status" className="mt-3 text-sm">
                  <p className={graded.correct ? 'font-semibold text-released' : 'font-semibold text-dispute'}>{graded.correct ? 'Correct' : 'Not quite'}</p>
                  {graded.explanation && <p className="mt-1 text-ink/75">{graded.explanation}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="mt-4 text-sm text-dispute">{error}</p>}
      {result ? (
        <div role="status" className={`mt-6 rounded-2xl p-4 ${result.passed ? 'bg-released-soft text-released' : 'bg-dispute-soft text-dispute'}`}>
          <p className="text-lg font-semibold">You scored {result.score}%. {result.passed ? 'Passed!' : `You need ${assessment.passMark}% to pass.`}</p>
          <div className="mt-3 flex gap-2">
            {!result.passed && <button type="button" onClick={() => { setResult(null); setAnswers({}); }} className="min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-paper">Try again</button>}
            {hasNext && <button type="button" onClick={onNext} className="min-h-11 rounded-xl border border-current px-5 text-sm font-semibold">Continue</button>}
          </div>
        </div>
      ) : (
        <button type="button" onClick={submit} disabled={!answered || busy} className="mt-6 min-h-12 rounded-xl bg-accent px-8 text-sm font-semibold text-accent-ink disabled:opacity-50">{busy ? 'Checking…' : 'Submit answers'}</button>
      )}
    </article>
  );
}
