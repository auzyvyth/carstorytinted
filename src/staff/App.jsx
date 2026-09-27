import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { useJobs, clearJobCache } from './useJobs.js';
import { usePush, forgetThisDevice } from './usePush.js';
import Dashboard from './Dashboard.jsx';
import Pipeline from './Pipeline.jsx';
import JobDrawer from './JobDrawer.jsx';
import Settings from './Settings.jsx';
import { Icon } from './ui.jsx';
import { DEMO } from '../shared/api.js';

// Sales demo only: say so on every screen, and let the viewer start over.
function DemoBar() {
  if (!DEMO) return null;
  const reset = async () => {
    const m = await import('../shared/demoBackend.js');
    m.resetDemo(); location.href = '/staff/';
  };
  return <div className="demo-bar" role="note"><b>Versi demo</b>Data contoh, disimpan dalam telefon ini sahaja.<button onClick={reset}>Mula semula</button></div>;
}

// URL holds the view (?tab=pipeline&job=<id>) so a push notification can open
// the exact job, and the phone's back button closes a drawer instead of the app.
const readUrl = () => { const p = new URLSearchParams(location.search); return { tab: p.get('tab') === 'pipeline' ? 'pipeline' : 'dashboard', job: p.get('job') }; };
function writeUrl(tab, job, push) {
  const p = new URLSearchParams();
  if (tab === 'pipeline') p.set('tab', 'pipeline');
  if (job) p.set('job', job);
  const url = `/staff/${p.toString() ? `?${p}` : ''}`;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
}

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function demoLogin(em) {
    const { DEMO_PASSWORD } = await import('../shared/demoBackend.js');
    await supabase.auth.signInWithPassword({ email: em, password: DEMO_PASSWORD });
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr(error.status === 400 ? 'Emel atau kata laluan salah.' : 'Tidak dapat log masuk. Semak internet.');
  }
  return (
    <><DemoBar /><div className="login"><form className="card" onSubmit={submit}>
      <div className="micro">Tinted Carstory</div><h1>Log masuk staf</h1>
      <label className="fld"><span>Emel</span><input className="in" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="fld"><span>Kata laluan</span><input className="in" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {err && <div className="warnline" role="alert">{err}</div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Sebentar...' : 'Masuk'}</button>
      <div className="muted" style={{ fontSize: 12 }}>Lupa kata laluan? Hubungi pemilik kedai.</div>
      {DEMO && (
        <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="micro">Cuba demo</div>
          <button type="button" className="btn" onClick={() => demoLogin('pemilik@demo.my')}>Masuk sebagai pemilik (Maliki)</button>
          <button type="button" className="btn" onClick={() => demoLogin('staf@demo.my')}>Masuk sebagai staf (Tam)</button>
        </div>
      )}
    </form></div></>
  );
}

function Workspace({ me, signOut }) {
  const [toastMsg, setToastMsg] = useState('');
  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2600); }, []);
  // App open when a customer books: say so on screen too (push may be off on this phone).
  const { jobs: allJobs, loading, error, update, create } = useJobs(me.id, {
    onWebBooking: (j) => { toast(`Tempahan online baru: ${j.customer_name}`); navigator.vibrate?.([120, 80, 120]); },
  });
  // Archived (owner "delete") jobs leave every list and count; the owner can reopen them from Batal.
  const jobs = useMemo(() => allJobs.filter((j) => !j.archived_at), [allJobs]);
  const archived = useMemo(() => (me.role === 'owner' ? allJobs.filter((j) => j.archived_at) : []), [allJobs, me.role]);
  const push = usePush();
  const [devices, setDevices] = useState(null);
  useEffect(() => { supabase.rpc('push_device_count').then(({ data }) => setDevices(typeof data === 'number' ? data : null)); }, [push.state]);
  const [view, setView] = useState(readUrl);
  const [settings, setSettings] = useState(null);
  const [staff, setStaff] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const loadMeta = useCallback(async () => {
    const [{ data: s }, { data: st }] = await Promise.all([
      supabase.from('shop_settings').select('*').eq('id', 1).single(),
      supabase.from('staff').select('id, name, role, active').order('name'),
    ]);
    if (s) setSettings(s);
    if (st) setStaff(st);
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { const onPop = () => { pushed.current = false; setView(readUrl()); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  // A notification tapped while the app is already open.
  useEffect(() => {
    const onMsg = (e) => { if (e.data?.type === 'open-job') { pushed.current = true; setView((v) => ({ ...v, job: e.data.job })); writeUrl(view.tab, e.data.job, true); } };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, [view.tab]);

  const go = (tab) => { setView({ tab, job: null }); writeUrl(tab, null, false); window.scrollTo(0, 0); };
  // Opening a job adds a history entry, so the phone's back gesture closes it.
  const pushed = useRef(false);
  const openJob = (j) => { pushed.current = true; setView((v) => ({ ...v, job: j.id })); writeUrl(view.tab, j.id, true); };
  const closeJob = useCallback(() => {
    if (pushed.current) { pushed.current = false; history.back(); return; }  // popstate clears the job
    setView((v) => ({ ...v, job: null })); writeUrl(view.tab, null, false);
  }, [view.tab]);
  const openJobRow = view.job ? allJobs.find((j) => j.id === view.job) : null;

  // "Perlu tindakan" buttons. WhatsApp opens synchronously (popup blockers), then we stamp.
  async function onAction(a, sendWa) {
    if (sendWa && a.wa) window.open(a.wa, '_blank', 'noopener');
    const patch = a.alt && !sendWa ? { ...a.alt.patch } : {};
    if (a.stamp) patch[a.stamp] = new Date().toISOString();
    if (a.advance) patch.stage = a.advance;
    try { await update(a.job.id, patch); toast(a.alt && !sendWa ? a.alt.done : a.advance ? 'Disahkan' : 'Ditanda selesai'); } catch { toast('Gagal kemaskini. Cuba lagi.'); }
  }

  const tabs = [['dashboard', 'Dashboard', Icon.home], ['pipeline', 'Pipeline', Icon.board]];
  return (
    <>
      <DemoBar />
      <header className="top"><div className="top-in">
        <span className="wm"><span>Tinted</span> Carstory</span>
        <nav className="top-tabs">{tabs.map(([id, label]) => <button key={id} aria-current={view.tab === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}</nav>
        <div className="top-right">
          <span className="who">{me.name}</span>
          {me.role === 'owner' && settings && <button className="icon-btn" aria-label="Tetapan kedai" onClick={() => setShowSettings(true)}>{Icon.gear}</button>}
          <button className="icon-btn" aria-label="Log keluar" onClick={signOut}>{Icon.out}</button>
        </div>
      </div></header>

      {loading ? <div className="page"><div className="card empty">Memuatkan kerja...</div></div>
        : view.tab === 'pipeline'
          ? <Pipeline jobs={jobs} archived={archived} onOpen={openJob} onNew={() => setCreating(true)} />
          : <Dashboard me={me} jobs={jobs} settings={settings} push={push} devices={devices} onOpen={openJob} onAction={onAction} onNew={() => setCreating(true)} error={error} />}

      <nav className="bnav">{tabs.map(([id, label, icon]) => <button key={id} aria-current={view.tab === id ? 'page' : undefined} onClick={() => go(id)}>{icon}{label}</button>)}</nav>

      {(openJobRow || creating) && settings && (
        <JobDrawer key={openJobRow?.id || 'new'} job={creating ? null : openJobRow} jobs={jobs} settings={settings} staff={staff} me={me}
          api={{ update, create }} toast={toast}
          onClose={() => (creating ? setCreating(false) : closeJob())} />
      )}
      {showSettings && <Settings settings={settings} staff={staff} me={me} toast={toast} onClose={() => setShowSettings(false)}
        onSaved={(s) => { if (s) setSettings(s); loadMeta(); }} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMe(session === null ? null : undefined); return; }
    setMe(undefined);
    supabase.from('staff').select('id, name, role, active').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setMe(data && data.active ? data : false));
  }, [session]);

  const signOut = async () => {
    await forgetThisDevice();
    if (session) clearJobCache(session.user.id);
    await supabase.auth.signOut();
  };

  if (session === undefined) return <div className="login"><div className="muted">Memuatkan...</div></div>;
  if (!session) return <Login />;
  // Just signed in: the staff row is still loading (me is null/undefined). Never render
  // the workspace without it; that crashed on the first frame after login.
  if (me === null || me === undefined) return <div className="login"><div className="muted">Memuatkan...</div></div>;
  if (me === false) {
    return <div className="login"><div className="card"><h1>Tiada akses</h1><p className="muted">Akaun ini bukan staf aktif kedai.</p><button className="btn" onClick={signOut}>Log keluar</button></div></div>;
  }
  return <Workspace me={me} signOut={signOut} />;
}
