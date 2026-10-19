import { useState } from 'react';
import { Link } from 'react-router-dom';
import ShopifyIntegration from '../../components/ShopifyIntegration.jsx';
import { CheckCircleIcon, IdentityVerificationIcon, ShieldCheckIcon } from '../../components/icons.jsx';
import { useKyc } from '../../hooks/useKyc.js';
import { useProfile } from '../../hooks/useProfile.js';
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

export function FileDropzone({ label, file, onChange, allowPdf = false, capture, required = false }) {
  const [error, setError] = useState('');
  const accept = allowPdf ? 'image/*,application/pdf' : 'image/*';

  function chooseFile(nextFile) {
    const validation = validateFile(nextFile, { allowPdf });
    setError(validation);
    onChange(validation ? null : nextFile);
  }

  return (
    <div>
      <label className="block">
        <span className="text-sm font-medium">{label}{required ? ' (required)' : ' (optional)'}</span>
        <span
          className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line-strong bg-paper-2 p-4 text-center transition-colors hover:border-accent focus-within:outline focus-within:outline-2 focus-within:outline-focus"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            type="file"
            accept={accept}
            capture={capture}
            required={required && !file}
            aria-label={label}
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = '';
            }}
            className="sr-only"
          />
          <span className="text-sm font-semibold">{file ? 'Replace file' : 'Choose or drop a file'}</span>
          <span className="mt-1 text-xs text-ink/55">{allowPdf ? 'Image or PDF, up to 5 MB' : 'Image, up to 5 MB'}</span>
        </span>
      </label>
      {file && !error && (
        <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg bg-released-soft px-3 py-2 text-sm text-released">
          <CheckCircleIcon aria-hidden="true" width={18} height={18} />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => { onChange(null); setError(''); }} className="min-h-11 rounded-lg px-3 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">Remove</button>
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
    ['Selfie', files.selfie],
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
            <span>{label}: {file ? file.name : 'Not provided (optional)'}</span>
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
        <h2 className="font-display text-xl">ID document</h2>
        <p className="mt-1 text-sm text-ink/60">Make sure every detail is clear and readable.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <FileDropzone label="Front of ID" file={files.idFront} required allowPdf onChange={(file) => setFiles((current) => ({ ...current, idFront: file }))} />
          <FileDropzone label="Back of ID" file={files.idBack} allowPdf onChange={(file) => setFiles((current) => ({ ...current, idBack: file }))} />
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div>
        <h2 className="font-display text-xl">Selfie check</h2>
        <p className="mt-1 text-sm text-ink/60">Take a clear photo of your face. Good light; no hats or sunglasses.</p>
        <div className="mt-5 max-w-md"><FileDropzone label="Selfie" file={files.selfie} required capture="user" onChange={(file) => setFiles((current) => ({ ...current, selfie: file }))} /></div>
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-ink/60"><li>Face the camera in a well-lit place.</li><li>Remove hats and sunglasses.</li></ul>
      </div>
    );
  }
  return <ReviewStep form={form} files={files} consent={consent} onConsent={setConsent} />;
}

export function KycWizard({ initialKyc, onSubmit, error, progress, onClearError }) {
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [form, setForm] = useState(() => ({
    legalName: initialKyc?.legalName || '',
    dob: initialKyc?.dob || '',
    idType: initialKyc?.idType || '',
    idNumber: initialKyc?.idNumber || '',
  }));
  const [files, setFiles] = useState({ idFront: null, idBack: null, selfie: null });
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
    Object.entries(files).forEach(([key, file]) => { if (file) body.append(key, file); });
    await onSubmit(body);
  }

  return (
    <div className="grid gap-4 min-[860px]:grid-cols-[240px_minmax(0,1fr)]">
      <StepperNav step={step} maxVisited={maxVisited} onSelect={changeStep} />
      <section className="min-w-0 rounded-2xl border border-line bg-paper p-4 shadow-card sm:p-6">
        <div aria-live="polite" className="sr-only">{submitted && stepError ? stepError : ''}</div>
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
  const { form, update, save, saving, saved, error } = profile;
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
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ochre/10"><IdentityVerificationIcon width={24} height={24} /></div>
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
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl"><IdentityVerificationIcon width={30} height={30} />Profile &amp; KYC</h1>
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
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus ${tab === value ? 'bg-accent text-accent-ink' : 'text-ink/65 hover:text-ink'}`}>{value === 'verification' && <IdentityVerificationIcon width={17} height={17} />}{label}</button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'profile' ? (
          <div className="grid gap-4 min-[860px]:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.8fr)]">
            <ProfileForm profile={profile} />
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
