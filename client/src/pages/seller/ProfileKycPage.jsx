import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShopifyIntegration from '../../components/ShopifyIntegration.jsx';
import { CheckCircleIcon, ShieldCheckIcon } from '../../components/icons.jsx';
import { useKyc } from '../../hooks/useKyc.js';
import { useFormDraft } from '../../hooks/useFormDraft.js';
import SigningSetup from '../../components/SigningSetup.jsx';
import AutosaveStatus from '../../components/AutosaveStatus.jsx';
import { useProfile } from '../../hooks/useProfile.js';
import FaceLivenessCheck from '../../components/FaceLivenessCheck.jsx';
import DocumentCaptureModal from '../../components/DocumentCaptureModal.jsx';
import { clearPickerMark, dropStashedFile, pickerWasInterrupted, readStashedFile, stashFile } from '../../lib/fileStash.js';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { kycMocksEnabled } from '../../lib/kycMocks.js';
import {
  KYC_ID_TYPES,
  KYC_STEPS,
  maskIdNumber,
  nextWizardStep,
  previousWizardStep,
  statusScreenFor,
  validateFile,
  validatePersonalDetails,
  validateStep,
} from '../../lib/kycState.js';
import { usePageTitle } from '../../lib/usePageTitle.js';
import { KycPreviewIcon } from '../../components/admin/AdminNavIcon.jsx';

const FIELD_CLASS = 'mt-1 min-h-11 w-full rounded-xl border border-line bg-input px-3 py-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus';

export function StatusCard({ seller, kyc }) {
  const name = seller?.displayName || seller?.businessName || seller?.fullName || 'Your profile';
  const status = kyc?.status || 'none';
  const activeStep = status === 'verified' ? 2 : status === 'pending' ? 1 : 0;
  const caption = status === 'verified'
    ? 'Verified seller'
    : status === 'pending'
      ? 'Verification under review'
      : 'Identity not verified yet';
  const badge = status === 'verified' ? 'Verified' : status === 'pending' ? 'Pending' : status === 'rejected' ? 'Needs attention' : 'Not started';

  return (
    <section aria-label="Identity verification status" className="rounded-2xl border border-line bg-paper-2 p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden="true" className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-semibold ${status === 'verified' ? 'bg-released-soft text-released' : 'bg-accent/10 text-accent'}`}>
          {name.trim().charAt(0).toUpperCase() || 'U'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl">{name}</h2>
          <p className="mt-1 text-sm text-ink/60">{caption}</p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${status === 'verified' ? 'border-released/35 bg-released-soft text-released' : 'border-ochre/35 bg-ochre/10 text-ochre'}`}>
          {badge}
        </span>
      </div>
      <ol aria-label="Verification progress" className="mt-5 grid grid-cols-3 gap-2">
        {['Not started', 'Under review', 'Verified'].map((label, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <li key={label} className={`border-t-2 pt-2 text-xs sm:text-sm ${complete || active ? status === 'verified' && index <= activeStep ? 'border-released text-released' : 'border-accent text-ink' : 'border-line-strong text-ink/45'}`}>
              <span className="font-medium">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function StepperNav({ step, maxVisited, onSelect }) {
  return (
    <nav aria-label="Identity verification steps" className="grid grid-cols-4 gap-1 min-[860px]:grid-cols-1 min-[860px]:gap-2">
      {KYC_STEPS.map((label, index) => {
        const complete = index < maxVisited;
        const enabled = index <= maxVisited;
        return (
          <button
            key={label}
            type="button"
            disabled={!enabled}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => onSelect(index)}
            className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2 py-2 text-left text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 sm:px-3 sm:text-sm min-[860px]:w-full ${step === index ? 'border-accent/40 bg-accent/10 text-ink' : 'border-transparent text-ink/60 hover:bg-paper-2'}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${complete ? 'border-released bg-released text-white' : step === index ? 'border-accent text-accent' : 'border-line-strong'}`}>
              {complete ? '✓' : index + 1}
            </span>
            <span className="min-w-0 leading-tight">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function FileDropzone({ label, file, onChange, allowPdf = false, required = false, stashKey = '' }) {
  const [error, setError] = useState('');
  
  const { seller } = useAuthContext();
  const [modalOpen, setModalOpen] = useState(false);
  // WHAT: scope the stash and the picker mark to the signed-in user and this field.
  const pickerKey = `${seller?._id || seller?.id || 'anon'}:${stashKey || label}`;
  const [interrupted] = useState(() => pickerWasInterrupted(pickerKey));

  // WHAT: bring a previously chosen file back after a reload, and reopen the dialog if the page was killed mid-pick.
  useEffect(() => {
    let cancelled = false;
    if (!file && stashKey) readStashedFile(pickerKey).then((restored) => { if (restored && !cancelled) onChange(restored); });
    if (!file && interrupted) { setModalOpen(true); clearPickerMark(pickerKey); }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseFile(nextFile) {
    const validation = validateFile(nextFile, { allowPdf });
    setError(validation);
    onChange(validation ? null : nextFile);
    // WHY stash: so the file survives a reload. Removing the file removes the stash.
    if (stashKey) { if (!validation && nextFile) stashFile(pickerKey, nextFile); else dropStashedFile(pickerKey); }
  }

  return (
    <div>
      <span className="text-sm font-medium">{label}{required ? ' (required)' : ' (optional)'}</span>
      {/* WHAT: a button that opens the in-page capture dialog (see DocumentCaptureModal).
          WHY not a file input: on phones a file input leaves the page, and low-memory phones can
          reload it on return, losing the file. The dialog keeps the whole flow on this page. */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-2 flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-paper-2 p-4 text-center transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="text-sm font-semibold">{file ? 'Replace document' : 'Add document'}</span>
        <span className="mt-1 text-xs text-ink/55">{allowPdf ? 'Take a photo, or choose an image or PDF (up to 5 MB)' : 'Take a photo or choose an image (up to 5 MB)'}</span>
      </button>
      {modalOpen && (
        <DocumentCaptureModal
          title={label}
          allowPdf={allowPdf}
          pickerKey={pickerKey}
          notice={interrupted ? 'Your phone closed this page while you were choosing a file. Taking a photo here avoids that, and your answers were saved.' : ''}
          onClose={() => setModalOpen(false)}
          onSelect={(picked) => { setModalOpen(false); chooseFile(picked); }}
        />
      )}
      {file && !error && (
        <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg bg-released-soft px-3 py-2 text-sm text-released">
          <CheckCircleIcon aria-hidden="true" width={18} height={18} />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => { onChange(null); setError(''); if (stashKey) dropStashedFile(pickerKey); }} className="min-h-11 rounded-lg px-3 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Remove</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-dispute">{error}</p>}
      <span className="sr-only" aria-live="polite">{error}</span>
    </div>
  );
}

export function ReviewStep({ form, files, consent, onConsent }) {
  const idTypeLabel = KYC_ID_TYPES.find((item) => item.value === form.idType)?.label || form.idType;
  const documents = [
    ['ID front', files.idFront],
    ['ID back', files.idBack],
    ['Face check', files.liveness ? { name: 'Completed' } : null],
  ];
  return (
    <div>
      <h2 className="font-display text-xl">Review your details</h2>
      <dl className="mt-4 grid gap-3 rounded-xl border border-line bg-paper-2 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-ink/55">Legal name</dt><dd className="mt-1 font-medium">{form.legalName}</dd></div>
        <div><dt className="text-ink/55">Date of birth</dt><dd className="mt-1 font-medium">{form.dob}</dd></div>
        <div><dt className="text-ink/55">ID type</dt><dd className="mt-1 font-medium">{idTypeLabel}</dd></div>
        <div><dt className="text-ink/55">ID number</dt><dd className="mt-1 font-mono font-medium">{maskIdNumber(form.idNumber)}</dd></div>
      </dl>
      <ul aria-label="Document checklist" className="mt-4 space-y-2">
        {documents.map(([label, file]) => (
          <li key={label} className="flex min-h-11 items-center gap-2 text-sm">
            <CheckCircleIcon className="text-released" width={18} height={18} />
            <span>{label}: {file ? file.name : label === 'ID back' ? 'Not provided (optional)' : 'Not provided'}</span>
          </li>
        ))}
      </ul>
      <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm leading-6 focus-within:outline focus-within:outline-2 focus-within:outline-focus">
        <input type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
        <span>I confirm these details are mine and accurate. My bank account name must match my legal name.</span>
      </label>
    </div>
  );
}

function StepContent({ step, form, setForm, files, setFiles, consent, setConsent, onClearError }) {
  const detailsErrors = validatePersonalDetails(form);
  if (step === 0) {
    return (
      <div>
        <h2 className="font-display text-xl">Personal details</h2>
        <p className="mt-1 text-sm text-ink/60">Use your name exactly as it appears on your ID.</p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">Legal full name
            <input autoComplete="name" value={form.legalName} onChange={(event) => { setForm((current) => ({ ...current, legalName: event.target.value })); onClearError(); }} className={FIELD_CLASS} />
            {detailsErrors.legalName && <span aria-live="polite" className="mt-1 block text-sm text-dispute">{detailsErrors.legalName}</span>}
          </label>
          <label className="block text-sm font-medium">Date of birth
            <input type="date" autoComplete="bday" value={form.dob} onChange={(event) => { setForm((current) => ({ ...current, dob: event.target.value })); onClearError(); }} className={FIELD_CLASS} />
            {detailsErrors.dob && <span aria-live="polite" className="mt-1 block text-sm text-dispute">{detailsErrors.dob}</span>}
          </label>
          <label className="block text-sm font-medium">ID type
            <select value={form.idType} onChange={(event) => { setForm((current) => ({ ...current, idType: event.target.value, idNumber: '' })); onClearError(); }} className={FIELD_CLASS}>
              <option value="">Choose an ID type</option>
              {KYC_ID_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            {detailsErrors.idType && <span aria-live="polite" className="mt-1 block text-sm text-dispute">{detailsErrors.idType}</span>}
          </label>
          <label className="block text-sm font-medium">ID number
            <input inputMode={form.idType === 'nin' ? 'numeric' : 'text'} autoComplete="off" value={form.idNumber} onChange={(event) => { setForm((current) => ({ ...current, idNumber: event.target.value })); onClearError(); }} className={FIELD_CLASS} />
            {detailsErrors.idNumber && <span aria-live="polite" className="mt-1 block text-sm text-dispute">{detailsErrors.idNumber}</span>}
          </label>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div>
        <h2 className="font-display text-xl">Face check</h2>
        <p className="mt-1 text-sm text-ink/60">A quick live check that you’re really here. No photo is taken.</p>
        <div className="mt-4">
          {/* WHAT: guided, automatic face check. WHY onVerified stores a proof, not an image: see FaceLivenessCheck. */}
          <FaceLivenessCheck
            completed={Boolean(files.liveness)}
            fetchSession={() => api.startKycLiveness()}
            onVerified={(result) => setFiles((current) => ({ ...current, liveness: result }))}
          />
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div>
        <h2 className="font-display text-xl">ID document</h2>
        <p className="mt-1 text-sm text-ink/60">Make sure every detail is clear and readable.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FileDropzone label="Front of ID" stashKey="kyc-idFront" file={files.idFront} required allowPdf onChange={(file) => setFiles((current) => ({ ...current, idFront: file }))} />
          <FileDropzone label="Back of ID" stashKey="kyc-idBack" file={files.idBack} allowPdf onChange={(file) => setFiles((current) => ({ ...current, idBack: file }))} />
        </div>
      </div>
    );
  }
  return <ReviewStep form={form} files={files} consent={consent} onConsent={setConsent} />;
}

// WHAT: remove the locally stashed ID photos once they have been submitted.
// WHY: they are personal documents; they should not linger in the browser after upload.
function dropAllKycStashes(userId) {
  ['kyc-idFront', 'kyc-idBack'].forEach((name) => dropStashedFile(`${userId || 'anon'}:${name}`));
}

export function KycWizard({ initialKyc, onSubmit, error, progress, onClearError }) {
  // WHAT: text answers, consent and the current step are autosaved to this device and the server.
  // WHY: KYC is long and people get interrupted (calls, low data, a phone that kills the tab).
  // They can now reload, sign out, or continue on another device and find the same answers.
  // WHY files are not saved: a File cannot be serialised, and ID photos should not sit in a
  // plain-text draft. After a restore the person re-adds only the photos, never retypes details.
  const { seller } = useAuthContext();
  const draft = useFormDraft('kyc', {
    legalName: initialKyc?.legalName || '',
    dob: initialKyc?.dob || '',
    idType: initialKyc?.idType || '',
    idNumber: initialKyc?.idNumber || '',
    consent: false,
  }, { extraDefaults: { step: 0, maxVisited: 0 } });
  const [files, setFiles] = useState({ idFront: null, idBack: null, liveness: null });
  const [submitted, setSubmitted] = useState(false);

  // WHAT: adapters so the step components keep their existing setForm/setConsent API.
  const form = draft.values;
  const setForm = draft.setValues;
  const consent = Boolean(draft.values.consent);
  const setConsent = (value) => draft.setField('consent', Boolean(value));

  // WHAT: the step to show, never past a step whose file is missing.
  // WHY: files are not restored, so landing on "Review" with no photos would be a dead end.
  const savedStep = Math.min(Number(draft.extra.step) || 0, KYC_STEPS.length - 1);
  const furthestAllowed = !files.liveness ? 1 : !files.idFront ? 2 : KYC_STEPS.length - 1;
  const step = Math.min(savedStep, furthestAllowed);
  const maxVisited = Math.min(Math.max(step, Number(draft.extra.maxVisited) || 0), furthestAllowed);
  const setStep = (next) => draft.setExtra('step', next);
  const setMaxVisited = (updater) => draft.setExtra('maxVisited', typeof updater === 'function' ? updater(maxVisited) : updater);
  const stepError = validateStep(step, form, files, consent);
  const busy = progress !== null;

  function changeStep(next) {
    if (next < 0 || next > maxVisited) return;
    setStep(next);
    setSubmitted(false);
    onClearError();
  }

  async function continueWizard() {
    setSubmitted(true);
    if (stepError) return;
    if (step < KYC_STEPS.length - 1) {
      const next = nextWizardStep(step, true);
      setStep(next);
      setMaxVisited((current) => Math.max(current, next));
      setSubmitted(false);
      onClearError();
      return;
    }
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append('consent', 'true');
    // WHAT: only real files are attached; the face-check result goes as two text fields.
    // WHY: the server verifies the signed session and the timings instead of receiving a selfie.
    ['idFront', 'idBack'].forEach((key) => { if (files[key]) body.append(key, files[key]); });
    body.append('livenessToken', files.liveness.token);
    body.append('livenessProof', JSON.stringify(files.liveness.proof));
    // WHY clear only on success: if the upload fails, the answers must still be there to retry.
    const accepted = await onSubmit(body);
    if (accepted === true) { draft.clear(); dropAllKycStashes(seller?._id || seller?.id); }
  }

  return (
    <div className="grid gap-4 min-[860px]:grid-cols-[240px_minmax(0,1fr)]">
      <StepperNav step={step} maxVisited={maxVisited} onSelect={changeStep} />
      <section className="min-w-0 rounded-2xl border border-line bg-paper p-4 shadow-card sm:p-6">
        <div aria-live="polite" className="sr-only">{submitted && stepError ? stepError : ''}</div>
        <div className="mb-3 flex min-h-5 justify-end"><AutosaveStatus state={draft.saveState} /></div>
        <StepContent step={step} form={form} setForm={setForm} files={files} setFiles={setFiles} consent={consent} setConsent={setConsent} onClearError={onClearError} />
        {error && <p role="alert" className="mt-4 rounded-xl border border-dispute/30 bg-dispute-soft p-3 text-sm text-dispute">{error}</p>}
        {busy && (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-xs text-ink/55">Uploading securely… {progress}%</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-line pt-4">
          <button type="button" disabled={step === 0 || busy} onClick={() => changeStep(previousWizardStep(step))} className="min-h-11 rounded-xl border border-line px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45">Back</button>
          <button type="button" disabled={Boolean(stepError) || busy} onClick={continueWizard} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? 'Submitting…' : step === KYC_STEPS.length - 1 ? 'Submit for review' : 'Continue'}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProfileForm({ profile }) {
  const { form, update, save, saving, saved, error, saveState } = profile;
  async function submit(event) {
    event.preventDefault();
    await save();
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-paper p-4 shadow-card sm:p-6">
      <h2 className="font-display text-xl">Public profile</h2>
      <p className="mt-1 text-sm text-ink/60">These details help people recognize your store.</p>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-medium">Display name
          <input required maxLength={80} value={form.displayName} onChange={(event) => update('displayName', event.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="block text-sm font-medium">Store name
          <input required minLength={2} maxLength={80} value={form.businessName} onChange={(event) => update('businessName', event.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="block text-sm font-medium">Phone
          <input type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(event) => update('phone', event.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="block text-sm font-medium">Email
          <input type="email" value={form.email} readOnly className={`${FIELD_CLASS} opacity-70`} />
        </label>
        <label className="block text-sm font-medium">City
          <input autoComplete="address-level2" maxLength={100} value={form.city} onChange={(event) => update('city', event.target.value)} className={FIELD_CLASS} />
        </label>
      </div>
      <div className="mt-3 min-h-5"><AutosaveStatus state={saveState} /></div>
      {error && <p role="alert" className="mt-4 text-sm text-dispute">{error}</p>}
      {saved && <p role="status" className="mt-4 text-sm font-medium text-released">Profile saved.</p>}
      <button type="submit" disabled={saving} className="mt-5 min-h-11 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}</button>
    </form>
  );
}

function UnlockCard() {
  return (
    <aside className="rounded-2xl border border-line bg-paper-2 p-4 sm:p-5">
      <h2 className="font-display text-lg">What verification unlocks</h2>
      <ul className="mt-4 space-y-3 text-sm text-ink/70">
        {['Create payment links', 'Receive payouts', 'Show your Verified seller badge'].map((item) => <li key={item} className="flex items-center gap-2"><ShieldCheckIcon className="text-released" width={17} height={17} />{item}</li>)}
      </ul>
    </aside>
  );
}

function VerificationScreen({ status, kyc, onRetry, onSimulate, error, bankAccount }) {
  if (status === 'pending') {
    return (
      <section className="rounded-2xl border border-line bg-paper p-6 text-center shadow-card">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ochre/10"><KycPreviewIcon width={24} height={24} /></div>
        <h2 className="mt-4 font-display text-2xl">Documents submitted</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/65">Documents submitted. We&apos;re reviewing your details and will notify you when it&apos;s done.</p>
        {error && <p role="alert" className="mt-4 text-sm text-dispute">{error}</p>}
        {import.meta.env.DEV && kycMocksEnabled && <button type="button" onClick={onSimulate} className="mt-5 min-h-11 rounded-xl border border-line px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Simulate approval</button>}
      </section>
    );
  }
  if (status === 'verified') {
    return (
      <section className="rounded-2xl border border-released/30 bg-released-soft p-6 text-center">
        <CheckCircleIcon className="mx-auto text-released" width={44} height={44} />
        <h2 className="mt-3 font-display text-2xl">You&apos;re verified</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/70">Your bank account name must match your legal name before payouts can be sent.</p>
        {!bankAccount && <Link to="/account/bank" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Add verified bank account</Link>}
        {bankAccount && <Link to="/dashboard/new" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">New payment link</Link>}
      </section>
    );
  }
  if (status === 'rejected') {
    return (
      <section className="rounded-2xl border border-dispute/30 bg-dispute-soft p-5">
        <h2 className="font-display text-xl">We need another look</h2>
        <p className="mt-2 text-sm leading-6 text-ink/70">{kyc?.reviewReason || 'Your documents could not be verified. Review your details and submit them again.'}</p>
        <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Try again</button>
      </section>
    );
  }
  return null;
}

export function ProfileKycPage() {
  usePageTitle('Profile & KYC');
  const { seller, hasBankAccount, updateSeller } = useAuthContext();
  const kycController = useKyc({ updateSeller });
  const profile = useProfile(seller, updateSeller);
  const [tab, setTab] = useState('verification');
  const [retrying, setRetrying] = useState(false);
  const screen = statusScreenFor(kycController.kyc?.status);

  if (kycController.loading && !kycController.kyc) {
    return <main className="mx-auto max-w-7xl space-y-5" aria-busy="true" aria-label="Loading Profile and KYC"><div className="skeleton h-10 w-64" /><div className="skeleton h-36 w-full" /><div className="skeleton h-72 w-full" /></main>;
  }
  if (kycController.error && !kycController.kyc) {
    return <main className="mx-auto max-w-7xl"><h1 className="font-display text-3xl">Profile &amp; KYC</h1><div className="mt-5 rounded-2xl border border-dispute/30 bg-dispute-soft p-5"><p role="alert" className="text-sm text-dispute">{kycController.error}</p><button type="button" onClick={kycController.retry} className="mt-3 min-h-11 rounded-xl border border-dispute px-4 text-sm font-semibold text-dispute focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Retry</button></div></main>;
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 border-b border-line pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Your account</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl"><KycPreviewIcon width={30} height={30} />Profile &amp; KYC</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">Verify your identity so you can create payment links and get paid.</p>
      </header>
      <StatusCard seller={{
        ...seller,
        displayName: seller?.displayName || profile.form.displayName,
        businessName: seller?.businessName || profile.form.businessName,
      }} kyc={kycController.kyc} />
      <div role="tablist" aria-label="Profile and verification" className="mt-5 inline-flex rounded-xl border border-line bg-paper-2 p-1">
        {[
          ['verification', 'Verification'],
          ['profile', 'Profile'],
        ].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${tab === value ? 'bg-accent text-accent-ink' : 'text-ink/65 hover:text-ink'}`}>{value === 'verification' && <KycPreviewIcon width={17} height={17} />}{label}</button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'profile' ? (
          <div className="grid gap-4 min-[860px]:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.8fr)]">
            <div>
              <ProfileForm profile={profile} />
              {/* WHAT: PIN + fingerprint setup for signing deliveries. WHY here: it needs the phone number from this profile. Skipped in mock mode, which has no server. */}
              {!kycMocksEnabled && <SigningSetup />}
            </div>
            <UnlockCard />
          </div>
        ) : screen === 'pending' || screen === 'verified' || screen === 'rejected' && !retrying ? (
          <VerificationScreen
            status={screen}
            kyc={kycController.kyc}
            onRetry={() => { setRetrying(true); }}
            onSimulate={kycController.simulateApproval}
            error={kycController.error}
            bankAccount={hasBankAccount}
          />
        ) : (
          <div>
            <KycWizard
              key={retrying ? 'retrying' : 'new'}
              initialKyc={kycController.kyc}
              onSubmit={async (formData) => {
                const success = await kycController.submit(formData);
                if (success) setRetrying(false);
                // WHY return it: the wizard clears its autosaved draft only when the upload succeeded.
                return success;
              }}
              error={kycController.error}
              progress={kycController.progress}
              onClearError={kycController.clearError}
            />
          </div>
        )}
        {tab === 'verification' && screen !== 'wizard' && !(screen === 'rejected' && retrying) && <p className="mt-4 text-center text-xs leading-5 text-ink/50">Your documents are used only to verify you. They are never shown to buyers.</p>}
      </div>
      {!kycMocksEnabled && <ShopifyIntegration />}
      {kycController.toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-released/30 bg-paper px-5 py-3 text-sm text-released shadow-card-md">{kycController.toast}</div>}
    </main>
  );
}

export default ProfileKycPage;
