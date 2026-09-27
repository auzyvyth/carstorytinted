import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { CAR_SIZES, JPJ, displayPhone } from '../shared/shop.js';
import { shopDate } from '../shared/api.js';
import { NEXT, vltWarnings, certUrl, balance, num, firstName, waCustomer, slotUse, walkInSlot, isClosedDay } from './logic.js';
import { DEMO } from '../shared/api.js';
import { Sheet, StageChip, Icon, rmFmt } from './ui.jsx';

const FIELDS = ['customer_name', 'phone', 'car_model', 'plate', 'car_size', 'film_id', 'scheduled_date', 'scheduled_slot',
  'price', 'paid_amount', 'vlt_windscreen', 'vlt_front', 'vlt_rear', 'notes', 'no_followup'];
const NUMERIC = ['price', 'paid_amount', 'vlt_windscreen', 'vlt_front', 'vlt_rear'];
const ERR = {
  jobs_phone_check: 'Nombor telefon tidak sah.',
  jobs_customer_name_check: 'Isi nama pelanggan.',
  slot_full: 'Slot ini sudah penuh. Pilih masa lain.',
};
const errText = (e) => ERR[Object.keys(ERR).find((k) => String(e?.message).includes(k))] || 'Gagal simpan. Cuba lagi.';

function toForm(job, settings, jobs = []) {
  const f = {};
  for (const k of FIELDS) f[k] = job?.[k] ?? '';
  // A new job is usually a walk-in being done now: today, in the slot running now.
  if (!job) Object.assign(f, { car_size: 'small', film_id: settings?.films?.[0]?.id || 'standard', scheduled_date: shopDate(0),
    scheduled_slot: walkInSlot(settings, jobs), paid_amount: 0, no_followup: false });
  // Staff read and type Malaysian numbers the local way; the DB stores 60xxxxxxxxx.
  if (job?.phone) f.phone = displayPhone(job.phone);
  if (job && (job.price === null || job.price === undefined) && job.quoted_price !== null) f.price = job.quoted_price ?? '';
  return f;
}

function toRow(f) {
  const r = {};
  for (const k of FIELDS) {
    const v = f[k];
    r[k] = NUMERIC.includes(k) ? (v === '' || v === null ? (k === 'paid_amount' ? 0 : null) : Number(v))
      : k === 'no_followup' ? Boolean(v) : (typeof v === 'string' ? v.trim() || null : v);
  }
  return r;
}

export default function JobDrawer({ job, jobs = [], settings, staff, me, api, onClose, toast }) {
  const isNew = !job;
  const [f, setF] = useState(() => toForm(job, settings, jobs));
  const [source, setSource] = useState('walk_in');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState(false);
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const loadEvents = useCallback(async () => {
    if (!job) return;
    const { data } = await supabase.from('job_events').select('*').eq('job_id', job.id).order('at', { ascending: false }).limit(50);
    setEvents(data || []);
  }, [job]);
  useEffect(() => { loadEvents(); }, [loadEvents, job?.stage, job?.paid_amount]);
  useEffect(() => { if (job) setF(toForm(job, settings)); }, [job, settings]);

  const who = (id) => staff.find((s) => s.id === id)?.name || 'Pelanggan (online)';
  const warns = vltWarnings(f);
  const cap = settings?.cars_per_slot || 1;
  const use = f.scheduled_date ? slotUse(jobs, f.scheduled_date, job?.id) : {};
  const digits = String(f.phone).replace(/\D/g, '');

  async function save(extra = {}) {
    setErr('');
    if (!String(f.customer_name).trim()) return setErr('Isi nama pelanggan.'), null;
    if (digits.length < 9) return setErr('Nombor telefon terlalu pendek.'), null;
    // A dated job with no slot is invisible to capacity: the website would sell that time again.
    const moved = isNew || f.scheduled_date !== (job.scheduled_date || '') || f.scheduled_slot !== (job.scheduled_slot || '');
    if (moved && f.scheduled_date && !f.scheduled_slot && (extra.stage || job?.stage) !== 'batal') return setErr('Pilih slot, supaya laman web tidak jual masa yang sama.'), null;
    setBusy(true);
    try {
      const row = { ...toRow(f), ...extra };
      const saved = isNew ? await api.create({ ...row, source, stage: extra.stage || 'disahkan' }) : await api.update(job.id, row);
      return saved;
    } catch (e) {
      setErr(errText(e)); return null;
    } finally { setBusy(false); }
  }

  async function advance() {
    const n = NEXT[job.stage];
    if (!n) return;
    if (n.to === 'siap' && [f.vlt_windscreen, f.vlt_front, f.vlt_rear].every((v) => v === '' || v === null)
      && !window.confirm('Tiada bacaan VLT direkod. Sijil akan tunjuk "tidak direkodkan". Teruskan?')) return;
    if (n.to === 'siap' && warns.length && !window.confirm(`${warns.join('. ')}. Kereta ini akan GAGAL ujian JPJ. Teruskan juga?`)) return;
    const extra = { stage: n.to };
    if (n.to === 'selesai') extra.paid_amount = Math.max(num(f.paid_amount) || 0, num(f.price) || 0);
    const saved = await save(extra);
    if (saved) toast(`${saved.customer_name}: ${n.label.toLowerCase()}`);
  }

  async function setStage(stage, extra = {}) {
    setMenu(false);
    const saved = await save({ stage, ...extra });
    if (saved) toast('Dikemaskini');
  }

  async function addNote() {
    const t = note.trim();
    if (!t) return;
    const { error } = await supabase.from('job_events').insert({ job_id: job.id, actor: me.id, kind: 'note', note: t.slice(0, 500) });
    if (!error) { setNote(''); loadEvents(); }
  }

  async function sendCert() {
    const url = certUrl(job);
    window.open(waCustomer(job.phone, `Terima kasih ${firstName(job)}! Ini sijil tinted anda (bacaan VLT dan waranti). Simpan pautan ini: ${url}`), '_blank', 'noopener');
    await api.update(job.id, { cert_sent_at: new Date().toISOString() }).catch(() => {});
  }

  const next = job && NEXT[job.stage];
  const title = isNew ? 'Kerja baru' : `${job.customer_name} · ${job.ref}`;

  const menuEl = !isNew && (
    <div className="menu">
      <button className="icon-btn" aria-label="Lagi" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{Icon.more}</button>
      {menu && (
        <div className="menu-list" role="menu">
          {job.stage !== 'batal'
            ? <button role="menuitem" onClick={() => { const r = window.prompt('Sebab batal? (pilihan)'); if (r !== null) setStage('batal', { lost_reason: r.slice(0, 200) || null }); }}>Batal kerja</button>
            : <button role="menuitem" onClick={() => setStage('baru')}>Buka semula</button>}
          {job.stage !== 'baru' && job.stage !== 'batal' && <button role="menuitem" onClick={() => setStage('baru')}>Kembali ke Baru</button>}
          {me.role === 'owner' && <button role="menuitem" className="btn-danger" onClick={async () => {
            setMenu(false);
            if (window.confirm('Padam kerja ini terus? Tidak boleh dibatalkan.')) { await api.remove(job.id); toast('Dipadam'); onClose(); }
          }}>Padam</button>}
        </div>
      )}
    </div>
  );

  const footer = isNew
    ? <button className="btn btn-primary" disabled={busy} onClick={async () => { const s = await save(); if (s) { toast('Kerja ditambah'); onClose(); } }}>Simpan kerja</button>
    : <>
        <button className="btn" disabled={busy} onClick={async () => { if (await save()) toast('Disimpan'); }}>Simpan</button>
        {next && <button className="btn btn-primary" disabled={busy} onClick={advance}>{next.label}</button>}
      </>;

  return (
    <Sheet title={title} onClose={onClose} footer={footer} headerExtra={menuEl}>
      {!isNew && (
        <div className="card box">
          <div className="box-h"><StageChip stage={job.stage} />
            <span className="row-actions">
              {!DEMO && <a className="btn btn-sm" href={`tel:+${job.phone}`}>Telefon</a>}
              <a className="btn btn-sm" href={waCustomer(job.phone)} target="_blank" rel="noopener">{Icon.wa}WhatsApp</a>
            </span>
          </div>
          {job.lost_reason && <div className="muted">Sebab batal: {job.lost_reason}</div>}
          {['siap', 'selesai'].includes(job.stage) && balance({ ...job, price: f.price, paid_amount: f.paid_amount }) > 0 &&
            <div className="warnline">Baki belum bayar: {rmFmt(balance({ ...job, price: f.price, paid_amount: f.paid_amount }))}</div>}
        </div>
      )}
      {isNew && (
        <label className="fld"><span>Datang dari</span>
          <select className="in" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="walk_in">Walk-in</option><option value="whatsapp">WhatsApp</option><option value="phone">Telefon</option>
          </select></label>
      )}

      <div className="card box">
        <div className="micro">Pelanggan</div>
        <div className="grid2">
          <label className="fld"><span>Nama</span><input className="in" value={f.customer_name} onChange={set('customer_name')} maxLength={80} /></label>
          <label className="fld"><span>Telefon</span><input className="in" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="012-345 6789" /></label>
          <label className="fld"><span>Model kereta</span><input className="in" value={f.car_model} onChange={set('car_model')} maxLength={60} /></label>
          <label className="fld"><span>No. plat</span><input className="in" value={f.plate} onChange={set('plate')} maxLength={12} style={{ textTransform: 'uppercase' }} /></label>
          <label className="fld"><span>Saiz</span><select className="in" value={f.car_size} onChange={set('car_size')}>{CAR_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="fld"><span>Filem</span><select className="in" value={f.film_id} onChange={set('film_id')}>{(settings?.films || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </div>
      </div>

      <div className="card box">
        <div className="micro">Jadual dan bayaran</div>
        <div className="grid2">
          <label className="fld"><span>Tarikh</span><input className="in" type="date" value={f.scheduled_date || ''} onChange={set('scheduled_date')} /></label>
          <label className="fld"><span>Slot</span><select className="in" value={f.scheduled_slot || ''} onChange={set('scheduled_slot')}>
            <option value="">{f.scheduled_date ? 'Pilih slot' : 'Tiada'}</option>
            {(settings?.slots || []).map((t) => {
              const n = use[t] || 0;
              const full = n >= cap && t !== job?.scheduled_slot;
              return <option key={t} value={t} disabled={full}>{t} · {full ? 'penuh' : `${n}/${cap}`}</option>;
            })}
            {f.scheduled_slot && !(settings?.slots || []).includes(f.scheduled_slot) && <option value={f.scheduled_slot}>{f.scheduled_slot}</option>}
          </select></label>
          <label className="fld"><span>Harga (RM)</span><input className="in tab-num" type="number" inputMode="decimal" min="0" value={f.price} onChange={set('price')} /></label>
          <label className="fld"><span>Sudah dibayar (RM)</span><input className="in tab-num" type="number" inputMode="decimal" min="0" value={f.paid_amount} onChange={set('paid_amount')} /></label>
        </div>
        {isClosedDay(settings, f.scheduled_date) && <div className="warnline">Tarikh ini ditanda tutup dalam tetapan kedai.</div>}
        {f.scheduled_date && (settings?.slots || []).length > 0 && settings.slots.every((t) => (use[t] || 0) >= cap && t !== job?.scheduled_slot) && <div className="warnline">Semua slot pada tarikh ini penuh.</div>}
        {job?.quoted_price !== null && job?.quoted_price !== undefined && <div className="muted" style={{ fontSize: 12 }}>Harga di laman web semasa tempah: {rmFmt(job.quoted_price)}</div>}
      </div>

      <div className="card box">
        <div className="box-h"><span className="micro">Bacaan VLT selepas pasang (%)</span>{!warns.length && f.vlt_windscreen !== '' && f.vlt_front !== '' && <span className="okline">Lulus had JPJ</span>}</div>
        <div className="grid3">
          <label className="fld"><span>Cermin depan · min {JPJ.windscreen}</span><input className="in tab-num" type="number" inputMode="numeric" min="0" max="100" value={f.vlt_windscreen} onChange={set('vlt_windscreen')} /></label>
          <label className="fld"><span>Sisi depan · min {JPJ.frontSide}</span><input className="in tab-num" type="number" inputMode="numeric" min="0" max="100" value={f.vlt_front} onChange={set('vlt_front')} /></label>
          <label className="fld"><span>Belakang · bebas</span><input className="in tab-num" type="number" inputMode="numeric" min="0" max="100" value={f.vlt_rear} onChange={set('vlt_rear')} /></label>
        </div>
        {warns.map((w) => <div key={w} className="warnline">{w}</div>)}
      </div>

      {!isNew && job.cert_token && (
        <div className="card box">
          <div className="box-h"><span className="micro">Sijil pelanggan</span>{job.cert_sent_at ? <span className="okline">Dihantar</span> : <span className="warnline">Belum dihantar</span>}</div>
          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-wa" onClick={sendCert}>{Icon.wa}Hantar sijil</button>
            <a className="btn btn-sm" href={certUrl(job)} target="_blank" rel="noopener">Lihat</a>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(certUrl(job)).then(() => toast('Pautan disalin'))}>Salin pautan</button>
          </div>
        </div>
      )}

      <div className="card box">
        <label className="fld"><span>Nota kerja</span><textarea className="in" rows={2} value={f.notes} onChange={set('notes')} maxLength={1000} /></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={Boolean(f.no_followup)} onChange={set('no_followup')} /> Pelanggan minta jangan dihubungi untuk susulan
        </label>
      </div>

      {!isNew && (
        <div className="card box">
          <div className="micro">Rekod</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="in" placeholder="Tambah catatan (cth. pelanggan minta datang lewat 30 minit)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }} />
            <button className="btn" onClick={addNote} disabled={!note.trim()}>Tambah</button>
          </div>
          <div className="log">
            {events.map((ev) => (
              <div key={ev.id}>
                <time>{new Date(ev.at).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}</time>
                <span><b>{ev.actor ? who(ev.actor) : (ev.kind === 'created' && job.source === 'web' ? 'Pelanggan (online)' : 'Sistem')}</b>{' '}
                  {ev.kind === 'created' ? 'mencipta kerja' : ev.kind === 'stage' ? <>ubah ke <StageChip stage={ev.to_stage} /></> : ev.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <div className="warnline" role="alert">{err}</div>}
    </Sheet>
  );
}
