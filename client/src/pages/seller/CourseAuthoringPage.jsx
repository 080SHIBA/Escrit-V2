import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import { useFormDraft } from '../../hooks/useFormDraft.js';
import { api } from '../../lib/api.js';
import { uploadItemDocument, uploadItemVideo } from '../../lib/cloudinary.js';
import { contentProblems, moveItem, newAssessment, newLesson, newModule, newOption, newQuestion } from '../../lib/courseAuthoring.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

// WHAT: where a seller builds a course: modules and lessons (text, video, downloads) and assessments
// (questions, correct answers, optional explanations) placed after any lesson.
// WHY it autosaves a draft: building a course takes a long time. useFormDraft keeps every keystroke on
// this device and on the server, so a closed tab, a dead battery or another device never loses work.
// "Publish changes" is a separate, deliberate step that validates and saves the live version.
const FIELD = 'mt-1 min-h-11 w-full rounded-lg border border-line bg-input px-3 text-sm';
const EMPTY = { modules: [], assessments: [] };

export default function CourseAuthoringPage() {
  const { id } = useParams();
  usePageTitle('Build your course');
  const draft = useFormDraft(`course-content:${id}`, { content: EMPTY });
  const content = draft.values.content || EMPTY;
  const [title, setTitle] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load the live version once; a restored draft (unsaved work) takes priority over it.
  useEffect(() => {
    if (!draft.ready) return;
    let active = true;
    api.getCourseContent(id).then((result) => {
      if (!active) return;
      setTitle(result.title);
      if (!draft.restored) draft.reset({ content: result.content?.modules ? result.content : EMPTY });
    }).catch((cause) => { if (active) setLoadError(cause?.message || 'This course could not be opened.'); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ready, id]);

  const update = (next) => draft.setField('content', next);
  const setModules = (modules) => update({ ...content, modules });
  const setAssessments = (assessments) => update({ ...content, assessments });
  const problems = contentProblems(content);
  const allLessons = content.modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, label: `${m.title || 'Untitled module'} › ${l.title || 'Untitled lesson'}` })));

  async function publish() {
    setSaving(true); setError(''); setMessage('');
    try {
      const { content: saved } = await api.saveCourseContent(id, content);
      draft.reset({ content: saved });
      await draft.clear({ keepValues: true });
      setMessage('Saved. Learners now see these changes.');
    } catch (cause) { setError(cause?.message || 'Your course could not be saved.'); }
    setSaving(false);
  }

  if (loadError) return <main className="mx-auto max-w-md px-4 py-12 text-center"><p role="alert" className="text-dispute">{loadError}</p></main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 pb-32">
      <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Course builder</p>
      <h1 className="mt-1 font-display text-3xl">{title || 'Your course'}</h1>
      <p className="mt-2 text-sm text-ink/65">Add modules and lessons, then quizzes where you want learners tested. Upload text files and Escrit tidies the formatting for easy reading.</p>
      <div className="mt-2 flex items-center gap-3"><AutosaveStatus state={draft.saveState} />{draft.restored && <span className="text-xs text-ink/55">Restored your unpublished changes.</span>}</div>

      <section className="mt-8" aria-label="Modules and lessons">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl">Curriculum</h2><button type="button" onClick={() => setModules([...content.modules, newModule()])} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Add module</button></div>
        {content.modules.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink/60">No modules yet. Add your first module to start.</p>}
        <div className="mt-3 space-y-5">
          {content.modules.map((module, mi) => (
            <div key={module.id} className="rounded-2xl border border-line bg-paper-2 p-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-sm font-medium">Module {mi + 1} title<input value={module.title} maxLength={160} onChange={(e) => setModules(content.modules.map((m, i) => i === mi ? { ...m, title: e.target.value } : m))} className={FIELD} /></label>
                <Mini label="Move up" onClick={() => setModules(moveItem(content.modules, mi, -1))}>↑</Mini>
                <Mini label="Move down" onClick={() => setModules(moveItem(content.modules, mi, 1))}>↓</Mini>
                <Mini label="Delete module" danger onClick={() => { if (confirm('Delete this module and its lessons?')) setModules(content.modules.filter((_, i) => i !== mi)); }}>✕</Mini>
              </div>
              <div className="mt-4 space-y-4">
                {module.lessons.map((lesson, li) => (
                  <LessonEditor key={lesson.id} courseId={id} lesson={lesson} index={li}
                    onChange={(next) => setModules(content.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? next : l) } : m))}
                    onMove={(delta) => setModules(content.modules.map((m, i) => i === mi ? { ...m, lessons: moveItem(m.lessons, li, delta) } : m))}
                    onDelete={() => setModules(content.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m))} />
                ))}
              </div>
              <button type="button" onClick={() => setModules(content.modules.map((m, i) => i === mi ? { ...m, lessons: [...m.lessons, newLesson()] } : m))} className="mt-3 min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold">Add lesson</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-label="Assessments">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl">Assessments</h2><button type="button" onClick={() => setAssessments([...content.assessments, newAssessment()])} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">Add assessment</button></div>
        <div className="mt-3 space-y-5">
          {content.assessments.map((assessment, ai) => (
            <AssessmentEditor key={assessment.id} assessment={assessment} index={ai} lessons={allLessons}
              onChange={(next) => setAssessments(content.assessments.map((a, i) => i === ai ? next : a))}
              onDelete={() => { if (confirm('Delete this assessment?')) setAssessments(content.assessments.filter((_, i) => i !== ai)); }} />
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm" role="status" aria-live="polite">
            {error ? <span className="text-dispute">{error}</span> : message ? <span className="text-released">{message}</span> : problems.length ? <span className="text-ink/65">{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}</span> : <span className="text-ink/55">Ready to publish.</span>}
          </div>
          <div className="flex gap-2">
            <Link to={`/learn/${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold">Preview as learner</Link>
            <button type="button" onClick={publish} disabled={saving || problems.length > 0} className="min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-50">{saving ? 'Saving…' : 'Publish changes'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Mini({ children, label, onClick, danger }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`min-h-11 min-w-11 rounded-lg border text-sm ${danger ? 'border-dispute/40 text-dispute' : 'border-line'}`}>{children}</button>;
}

function LessonEditor({ courseId, lesson, index, onChange, onMove, onDelete }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const textInput = useRef(null);
  const set = (patch) => onChange({ ...lesson, ...patch });

  async function run(label, task) {
    setBusy(label); setNote('');
    try { await task(); } catch (cause) { setNote(cause?.message || 'That did not work. Please try again.'); }
    setBusy('');
  }
  const importText = (file) => run('import', async () => {
    const { markdown } = await api.importCourseText(courseId, file);
    set({ bodyMarkdown: lesson.bodyMarkdown ? `${lesson.bodyMarkdown}\n\n${markdown}` : markdown });
    setNote('Imported and tidied.');
  });
  const uploadVideo = (file) => run('video', async () => { const url = await uploadItemVideo(file, (p) => setBusy(`video ${p}%`)); set({ videoUrl: url }); });
  const uploadDoc = (file) => run('doc', async () => {
    const url = await uploadItemDocument(file);
    const kind = /\.pdf$/i.test(file.name) ? 'pdf' : /\.docx?$/i.test(file.name) ? 'doc' : /\.txt$/i.test(file.name) ? 'text' : 'other';
    set({ attachments: [...lesson.attachments, { name: file.name, url, kind }] });
  });

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-medium">Lesson {index + 1} title<input value={lesson.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} className={FIELD} /></label>
        <Mini label="Move lesson up" onClick={() => onMove(-1)}>↑</Mini>
        <Mini label="Move lesson down" onClick={() => onMove(1)}>↓</Mini>
        <Mini label="Delete lesson" danger onClick={onDelete}>✕</Mini>
      </div>
      <label className="mt-3 block text-sm font-medium">One-line summary (optional)<input value={lesson.summary} maxLength={400} onChange={(e) => set({ summary: e.target.value })} className={FIELD} /></label>
      <label className="mt-3 block text-sm font-medium">Lesson text
        <textarea value={lesson.bodyMarkdown} rows={8} onChange={(e) => set({ bodyMarkdown: e.target.value })} className={`${FIELD} py-2 font-mono leading-6`} placeholder="Write here, or import a .txt or .docx file below. Use ## for headings and - for bullet points." />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input ref={textInput} type="file" accept=".txt,.md,.docx" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importText(f); }} />
        <button type="button" onClick={() => textInput.current?.click()} disabled={Boolean(busy)} className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium">Import text file (.txt, .docx)</button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 text-sm font-medium">{lesson.videoUrl ? 'Replace video' : 'Upload short video'}<input type="file" accept="video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadVideo(f); }} /></label>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-3 text-sm font-medium">Attach PDF or document<input type="file" accept=".pdf,.doc,.docx,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDoc(f); }} /></label>
      </div>
      {busy && <p role="status" className="mt-2 text-xs text-ink/60">Working… {busy.startsWith('video') ? busy : ''}</p>}
      {note && <p role="status" className="mt-2 text-xs text-ink/70">{note}</p>}
      {lesson.videoUrl && <p className="mt-2 flex items-center gap-2 text-xs text-released">Video added <button type="button" className="underline" onClick={() => set({ videoUrl: '' })}>Remove</button></p>}
      {lesson.attachments.length > 0 && <ul className="mt-2 space-y-1 text-xs">{lesson.attachments.map((file, i) => <li key={file.url} className="flex items-center gap-2"><span className="truncate">{file.name}</span><button type="button" className="underline" onClick={() => set({ attachments: lesson.attachments.filter((_, j) => j !== i) })}>Remove</button></li>)}</ul>}
    </div>
  );
}

function AssessmentEditor({ assessment, index, lessons, onChange, onDelete }) {
  const set = (patch) => onChange({ ...assessment, ...patch });
  const setQuestion = (qi, next) => set({ questions: assessment.questions.map((q, i) => i === qi ? next : q) });
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-medium">Assessment {index + 1} title<input value={assessment.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} className={FIELD} /></label>
        <Mini label="Delete assessment" danger onClick={onDelete}>✕</Mini>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* WHAT: the junction: learners take this assessment right after the chosen lesson. */}
        <label className="text-sm font-medium">Taken after
          <select value={assessment.afterLessonId || ''} onChange={(e) => set({ afterLessonId: e.target.value || null })} className={FIELD}>
            <option value="">End of the course</option>
            {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Pass mark (%)<input type="number" min={1} max={100} value={assessment.passMark} onChange={(e) => set({ passMark: Number(e.target.value) })} className={FIELD} /></label>
      </div>
      <div className="mt-4 space-y-4">
        {assessment.questions.map((question, qi) => (
          <div key={question.id} className="rounded-xl border border-line bg-paper p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-medium">Question {qi + 1}<input value={question.prompt} maxLength={1000} onChange={(e) => setQuestion(qi, { ...question, prompt: e.target.value })} className={FIELD} /></label>
              <label className="text-sm font-medium">Type
                <select value={question.type} onChange={(e) => { const next = newQuestion(e.target.value); setQuestion(qi, { ...next, id: question.id, prompt: question.prompt, explanation: question.explanation }); }} className={FIELD}>
                  <option value="single">One correct answer</option><option value="multiple">Several correct answers</option><option value="truefalse">True / false</option>
                </select>
              </label>
              <Mini label="Delete question" danger onClick={() => set({ questions: assessment.questions.filter((_, i) => i !== qi) })}>✕</Mini>
            </div>
            <div className="mt-3 space-y-2">
              {question.options.map((option, oi) => {
                const correct = question.correct.includes(option.id);
                const toggle = () => setQuestion(qi, { ...question, correct: question.type === 'multiple' ? (correct ? question.correct.filter((x) => x !== option.id) : [...question.correct, option.id]) : [option.id] });
                return (
                  <div key={option.id} className="flex items-center gap-2">
                    <input type={question.type === 'multiple' ? 'checkbox' : 'radio'} name={`correct-${question.id}`} checked={correct} onChange={toggle} aria-label={`Mark option ${oi + 1} as correct`} className="h-5 w-5 accent-ink" />
                    {question.type === 'truefalse'
                      ? <span className="min-h-11 flex-1 content-center text-sm">{option.text}</span>
                      : <input value={option.text} maxLength={300} placeholder={`Option ${oi + 1}`} onChange={(e) => setQuestion(qi, { ...question, options: question.options.map((o, i) => i === oi ? { ...o, text: e.target.value } : o) })} className={`${FIELD} mt-0 flex-1`} />}
                    {question.type !== 'truefalse' && question.options.length > 2 && <Mini label="Remove option" onClick={() => setQuestion(qi, { ...question, options: question.options.filter((_, i) => i !== oi), correct: question.correct.filter((x) => x !== option.id) })}>−</Mini>}
                  </div>
                );
              })}
              {question.type !== 'truefalse' && question.options.length < 8 && <button type="button" onClick={() => setQuestion(qi, { ...question, options: [...question.options, newOption()] })} className="min-h-11 rounded-lg border border-line px-3 text-sm">Add option</button>}
            </div>
            <label className="mt-3 block text-sm font-medium">Explanation (optional, shown after the learner answers)<textarea rows={2} value={question.explanation} maxLength={1500} onChange={(e) => setQuestion(qi, { ...question, explanation: e.target.value })} className={`${FIELD} py-2`} /></label>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => set({ questions: [...assessment.questions, newQuestion()] })} className="mt-3 min-h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold">Add question</button>
    </div>
  );
}
