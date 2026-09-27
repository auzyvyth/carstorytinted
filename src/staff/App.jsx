import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { useJobs, clearJobCache } from './useJobs.js';
import { usePush, forgetThisDevice } from './usePush.js';
import Dashboard from './Dashboard.jsx';
import Pipeline from './Pipeline.jsx';
import JobDrawer from './JobDrawer.jsx';
import Settings from './Settings.jsx';
import { Icon } from './ui.jsx';

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
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr(error.status === 400 ? 'Emel atau kata laluan salah.' : 'Tidak dapat log masuk. Semak internet.');
  }
  return (
    <div className="login"><form className="card" onSubmit={submit}>
      <div className="micro">Tinted Carstory</div><h1>Log masuk staf</h1>
      <label className="fld"><span>Emel</span><input className="in" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="fld"><span>Kata laluan</span><input className="in" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {err && <div className="warnline" role="alert">{err}</div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Sebentar...' : 'Masuk'}</button>
      <div className="muted" style={{ fontSize: 12 }}>Lupa kata laluan? Hubungi pemilik kedai.</div>
    </form></div>
  );
}

function Workspace({ me, signOut }) {
  const { jobs, loading, error, update, create, remove } = useJobs(me.id);
  const push = usePush();
  const [view, setView] = useState(readUrl);
  const [settings, setSettings] = useState(null);
  const [staff, setStaff] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2600); }, []);
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
  const openJobRow = view.job ? jobs.find((j) => j.id === view.job) : null;

  // "Perlu tindakan" buttons. WhatsApp opens synchronously (popup blockers), then we stamp.
  async function onAction(a, sendWa) {
    if (sendWa && a.wa) window.open(a.wa, '_blank', 'noopener');
    const patch = {};
    if (a.stamp) patch[a.stamp] = new Date().toISOString();
    if (a.advance) patch.stage = a.advance;
    try { await update(a.job.id, patch); toast(a.advance ? 'Disahkan' : 'Ditanda selesai'); } catch { toast('Gagal kemaskini. Cuba lagi.'); }
  }

  const tabs = [['dashboard', 'Dashboard', Icon.home], ['pipeline', 'Pipeline', Icon.board]];
  return (
    <>
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
          ? <Pipeline jobs={jobs} onOpen={openJob} onNew={() => setCreating(true)} />
          : <Dashboard me={me} jobs={jobs} settings={settings} push={push} onOpen={openJob} onAction={onAction} onNew={() => setCreating(true)} error={error} />}

      <nav className="bnav">{tabs.map(([id, label, icon]) => <button key={id} aria-current={view.tab === id ? 'page' : undefined} onClick={() => go(id)}>{icon}{label}</button>)}</nav>

      {(openJobRow || creating) && settings && (
        <JobDrawer key={openJobRow?.id || 'new'} job={creating ? null : openJobRow} settings={settings} staff={staff} me={me}
          api={{ update, create, remove }} toast={toast}
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
    supabase.from('staff').select('id, name, role, active').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setMe(data && data.active ? data : false));
  }, [session]);

  const signOut = async () => {
    await forgetThisDevice();
    if (session) clearJobCache(session.user.id);
    await supabase.auth.signOut();
  };

  if (session === undefined || (session && me === undefined)) return <div className="login"><div className="muted">Memuatkan...</div></div>;
  if (!session) return <Login />;
  if (me === false) {
    return <div className="login"><div className="card"><h1>Tiada akses</h1><p className="muted">Akaun ini bukan staf aktif kedai.</p><button className="btn" onClick={signOut}>Log keluar</button></div></div>;
  }
  return <Workspace me={me} signOut={signOut} />;
}
