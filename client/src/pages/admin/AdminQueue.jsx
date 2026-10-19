import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

export default function AdminQueue({ mode }) {
  const { seller } = useAuthContext();
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const isKyc = mode === 'kyc';
  const isListings = mode === 'listings';
  const isComplaints = mode === 'complaints';
  const isCategories = mode === 'categories';
  const title = isKyc ? 'KYC review' : isListings ? 'Listing review' : isComplaints ? 'Buyer complaints' : isCategories ? 'Category requests' : 'Account roles';
  usePageTitle(title);

  async function load() {
    try {
      const response = isKyc ? await api.listAdminKyc() : isListings ? await api.listUnverifiedListings() : isComplaints ? await api.listAdminComplaints() : isCategories ? await api.listCategoryRequests() : await api.listAdminUsers();
      setRows(isKyc || !isListings && !isComplaints && !isCategories ? response.users : isListings ? response.listings : isComplaints ? response.complaints : response.requests);
    } catch (err) {
      setError(err.message || `Unable to load ${title.toLowerCase()}.`);
    }
  }

  useEffect(() => { load(); }, [mode]);

  async function review(id, approved) {
    setBusyId(id);
    setError('');
    try {
      await api.reviewKyc(id, { status: approved ? 'verified' : 'rejected', note: notes[id] || '' });
      setRows((current) => current.filter((row) => row._id !== id));
    } catch (err) {
      setError(err.message || 'Unable to update this KYC record.');
    } finally {
      setBusyId('');
    }
  }

  async function moderate(listing, approved) {
    setBusyId(listing._id);
    setError('');
    try {
      await api.reviewListing(listing.listingType, listing._id, { approved, note: notes[listing._id] || '' });
      setRows((current) => current.filter((row) => row._id !== listing._id));
    } catch (err) {
      setError(err.message || 'Unable to review this listing.');
    } finally {
      setBusyId('');
    }
  }

  async function changeRole(user, role) {
    setBusyId(user._id);
    setError('');
    try {
      await api.setUserRole(user._id, role);
      setRows((current) => current.map((row) => row._id === user._id ? { ...row, role } : row));
    } catch (err) {
      setError(err.message || 'Unable to update this account role.');
    } finally {
      setBusyId('');
    }
  }

  async function reviewCategory(category, decision, assignedCategoryId) {
    setBusyId(category._id);
    setError('');
    try {
      await api.reviewCategoryRequest(category.listingType, category._id, { decision, ...(assignedCategoryId ? { assignedCategoryId } : {}) });
      setRows((current) => current.filter((row) => row._id !== category._id));
    } catch (err) {
      setError(err.message || 'Unable to resolve this category request.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-xs uppercase tracking-wider text-ink/50">Admin</p><h1 className="mt-2 font-display text-3xl">{title}</h1></div>
        <nav aria-label="Admin tools" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/admin/disputes" className="underline underline-offset-4">Disputes</Link>
          <Link to="/admin/complaints" className="underline underline-offset-4">Complaints</Link>
          <Link to="/admin/kyc" className="underline underline-offset-4">KYC</Link>
          <Link to="/admin/listings" className="underline underline-offset-4">Listings</Link>
          <Link to="/admin/categories" className="underline underline-offset-4">Categories</Link>
          <Link to="/admin/settings" className="underline underline-offset-4">Settings</Link>
          {seller?.isOwner && <Link to="/admin/users" className="underline underline-offset-4">Roles</Link>}
        </nav>
      </header>
      {error && <p role="alert" className="mt-5 text-sm text-dispute">{error}</p>}
      {rows === null && !error && <p className="py-8 text-sm text-ink/55">Loading review queue…</p>}
      {rows?.length === 0 && <p className="mt-6 border-y border-line py-8 text-center text-sm text-ink/55">Nothing needs review right now.</p>}

      <ul className="mt-5 divide-y divide-line">
        {rows?.map((row) => (
          <li key={row._id} className="py-5">
            {isKyc ? <KycRow user={row} note={notes[row._id] || ''} onNote={(value) => setNotes((current) => ({ ...current, [row._id]: value }))} onReview={(approved) => review(row._id, approved)} busy={busyId === row._id} /> : isListings ? <ListingRow listing={row} note={notes[row._id] || ''} onNote={(value) => setNotes((current) => ({ ...current, [row._id]: value }))} onReview={(approved) => moderate(row, approved)} busy={busyId === row._id} /> : isComplaints ? <ComplaintRow entry={row} /> : isCategories ? <CategoryRow category={row} busy={busyId === row._id} onReview={(decision, target) => reviewCategory(row, decision, target)} /> : <UserRow user={row} onChange={(role) => changeRole(row, role)} busy={busyId === row._id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KycRow({ user, note, onNote, onReview, busy }) {
  const documents = [
    ['ID front', user.idFrontUrl],
    ['ID back', user.idBackUrl],
    ['Selfie', user.selfieUrl],
    ['Legacy ID document', user.idDocumentUrl],
  ].filter(([, url]) => url);
  return <section className="grid gap-4 md:grid-cols-[1fr_18rem]">
    <div>
      <p className="font-medium">{user.fullName || user.businessName}</p>
      <p className="mt-1 text-sm text-ink/60">{user.email} · {user.businessName}</p>
      {user.dob && <p className="mt-2 text-sm">Date of birth: {new Date(user.dob).toLocaleDateString()}</p>}
      {user.idType && <p className="mt-1 text-sm">ID type: {user.idType}</p>}
      <p className="mt-1 text-sm">ID: <span className="font-mono">{user.idNumber || user.nin || 'Not provided'}</span></p>
      {documents.length > 0 && <ul className="mt-3 flex flex-wrap gap-3">{documents.map(([label, url]) => <li key={label}><a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{label}</a></li>)}</ul>}
    </div>
    <div className="space-y-2"><label className="block text-xs text-ink/55">Review note<textarea aria-label="Review note" value={note} onChange={(event) => onNote(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full border border-line bg-input px-2 py-1.5 text-sm" /></label><div className="flex gap-2"><button disabled={busy} onClick={() => onReview(true)} className="min-h-11 flex-1 rounded-md bg-released px-3 py-2 text-xs font-medium text-paper disabled:opacity-50">Verify</button><button disabled={busy} onClick={() => onReview(false)} className="min-h-11 flex-1 rounded-md border border-dispute/40 px-3 py-2 text-xs font-medium text-dispute disabled:opacity-50">Reject</button></div></div>
  </section>;
}

function ListingRow({ listing, note, onNote, onReview, busy }) {
  return <section className="grid gap-4 md:grid-cols-[8rem_1fr_18rem]">
    {listing.images?.[0] ? <img src={listing.images[0]} alt="" className="aspect-square w-full rounded-md object-cover" /> : <div className="aspect-square rounded-md bg-line/40" />}
    <div><p className="text-xs uppercase tracking-wider text-ink/50">{listing.listingType} · {listing.category}</p><h2 className="mt-1 font-medium">{listing.title}</h2><p className="mt-1 text-sm text-ink/60">{listing.seller?.businessName} · {listing.seller?.email}</p><p className="mt-2 line-clamp-3 text-sm leading-5 text-ink/60">{listing.description}</p></div>
    <div className="space-y-2"><label className="block text-xs text-ink/55">Moderation note<textarea value={note} onChange={(event) => onNote(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full border border-line bg-input px-2 py-1.5 text-sm" /></label><div className="flex gap-2"><button disabled={busy} onClick={() => onReview(true)} className="flex-1 rounded-md bg-released px-3 py-2 text-xs font-medium text-paper disabled:opacity-50">Approve</button><button disabled={busy} onClick={() => onReview(false)} className="flex-1 rounded-md border border-dispute/40 px-3 py-2 text-xs font-medium text-dispute disabled:opacity-50">Reject</button></div></div>
  </section>;
}

function UserRow({ user, onChange, busy }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{user.businessName}</p><p className="mt-1 text-sm text-ink/55">{user.email} · {user.role}</p></div>{user.role === 'admin' ? <button disabled={busy} onClick={() => onChange('user')} className="rounded-md border border-line-strong px-3 py-2 text-xs font-medium">Revoke admin</button> : <button disabled={busy} onClick={() => onChange('admin')} className="rounded-md bg-ink px-3 py-2 text-xs font-medium text-paper">Grant admin</button>}</div>;
}

function ComplaintRow({ entry }) {
  const { transaction, link } = entry;
  return <section className="space-y-3"><div><p className="font-medium">{link?.itemName || 'Listing complaint'}</p><p className="mt-1 text-sm text-ink/55">{transaction.buyerEmail} · {transaction.disputeRaisedAt ? new Date(transaction.disputeRaisedAt).toLocaleString() : ''}</p></div><p className="text-sm leading-6">{transaction.complaintReason || transaction.disputeReason}</p>{transaction.evidence?.map((evidence) => <div key={evidence._id} className="border-l-2 border-line pl-3 text-sm"><p className="text-xs font-medium uppercase text-ink/50">{evidence.party} evidence</p>{evidence.text && <p className="mt-1">{evidence.text}</p>}{evidence.mediaUrl && <a href={evidence.mediaUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-4">Open attachment</a>}</div>)}</section>;
}

function CategoryRow({ category, busy, onReview }) {
  const [approved, setApproved] = useState([]);
  const [target, setTarget] = useState('');
  useEffect(() => {
    api.listApprovedCategories(category.listingType).then(({ categories }) => {
      setApproved(categories || []);
      setTarget(categories?.[0]?._id || '');
    }).catch(() => {});
  }, [category.listingType]);
  return <section className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-ink/50">{category.listingType} category request</p><h2 className="mt-1 font-display text-xl">{category.name}</h2><p className="mt-1 text-sm text-ink/55">Requested by {category.requestedBy?.businessName || category.requestedBy?.email || 'seller'}</p></div><div className="flex flex-wrap items-center gap-2"><button disabled={busy} onClick={() => onReview('approve')} className="rounded-md bg-released px-3 py-2 text-xs font-medium text-paper disabled:opacity-50">Approve category</button><select aria-label="Assign category to existing category" value={target} onChange={(event) => setTarget(event.target.value)} className="max-w-44 border border-line bg-input px-2 py-2 text-xs">{approved.map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}</select><button disabled={busy || !target} onClick={() => onReview('assign', target)} className="rounded-md border border-line px-3 py-2 text-xs font-medium disabled:opacity-50">Assign existing</button><button disabled={busy} onClick={() => onReview('reject')} className="rounded-md border border-dispute/40 px-3 py-2 text-xs font-medium text-dispute disabled:opacity-50">Reject</button></div></section>;
}