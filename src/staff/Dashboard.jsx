import { useEffect, useMemo, useState } from 'react';
import { actionsFor, monthStats, byScheduled, klDate } from './logic.js';
import { StageChip, Tile, Icon, rmFmt } from './ui.jsx';
import { shopDate, dayParts, slotLabel } from '../shared/api.js';
import { CAR_SIZES } from '../shared/shop.js';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));
  return h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
}

// Required on staff phones: a web booking nobody hears about is a lost customer.
// Only states nothing on the page can fix (iOS not installed, browser-blocked) explain instead.
function PushNotice({ push, devices }) {
  // devices = phones that will ring for an online booking, shop-wide (null = unknown).
  const nobody = devices === 0 && <span className="warnline"> Sekarang tiada satu telefon pun di kedai yang akan berbunyi.</span>;
  if (push.state === 'on' || push.state === 'working') return null;
  if (push.state === 'unsupported') {
    return devices === 0 ? <div className="notice"><p><b>Tiada telefon terima notifikasi tempahan</b>Pelayar ini tidak boleh terima notifikasi. Buka app ini di telefon Android atau iPhone (pasang ke skrin utama) dan hidupkan notifikasi.</p></div> : null;
  }
  if (push.state === 'ios-install') {
    return <div className="notice"><p><b>Pasang app untuk dapat notifikasi</b>Tekan butang Kongsi di Safari, pilih "Add to Home Screen", kemudian buka app dari skrin utama.{nobody}</p></div>;
  }
  if (push.state === 'denied') {
    return <div className="notice"><p><b>Notifikasi disekat</b>Buka tetapan pelayar, cari laman ini dan benarkan Notifikasi. Tanpa ini, tempahan online baru tidak akan sampai ke telefon anda.{nobody}</p></div>;
  }
  return (
    <div className="notice">
      <p><b>Hidupkan notifikasi tempahan</b>Telefon ini akan berbunyi setiap kali pelanggan tempah online.{nobody}{push.error && <span className="warnline"> {push.error}</span>}</p>
      <button className="btn btn-primary" onClick={push.enable}>Hidupkan</button>
    </div>
  );
}

function WeekStrip({ jobs, settings }) {
  const days = Array.from({ length: 7 }, (_, i) => shopDate(i));
  const cap = (settings?.slots?.length || 0) * (settings?.cars_per_slot || 1);
  return (
    <div className="week">
      {days.map((iso, i) => {
        const p = dayParts(iso);
        const [y, m, d] = iso.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const closed = settings && (settings.closed_weekdays.includes(dow) || settings.closed_dates.includes(iso));
        const n = jobs.filter((j) => j.scheduled_date === iso && j.stage !== 'batal').length;
        return (
          <div key={iso} className={`card day${closed ? ' closed' : ''}${i === 0 ? ' today' : ''}`} title={closed ? 'Tutup' : `${n} daripada ${cap}`}>
            <div className="micro">{i === 0 ? 'Hari ini' : p.short}</div>
            <b>{closed ? '-' : n}</b>
            <div className="muted" style={{ fontSize: 11 }}>{closed ? 'Tutup' : `/${cap}`}</div>
            {!closed && <div className="track"><i style={{ width: `${cap ? Math.min(100, (n / cap) * 100) : 0}%` }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ me, jobs, settings, staff = [], push, devices, onOpen, onAction, onNew, error }) {
  const today = shopDate(0);
  const todays = useMemo(() => jobs.filter((j) => j.scheduled_date === today && j.stage !== 'batal' && !(j.waitlist_at && !j.scheduled_slot)).sort(byScheduled), [jobs, today]);
  // Re-evaluated every minute: "15 minutes late" and "a bay just freed up" are about the clock.
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60e3); return () => clearInterval(t); }, []);
  const actions = useMemo(() => actionsFor(jobs, today, { settings }), [jobs, today, settings, tick]);
  const waiting = useMemo(() => jobs.filter((j) => j.waitlist_at && !j.scheduled_slot && j.stage !== 'batal' && j.scheduled_date === today)
    .sort((a, b) => String(a.waitlist_at).localeCompare(String(b.waitlist_at))), [jobs, today]);
  const stats = useMemo(() => monthStats(jobs, today), [jobs, today]);
  const size = (id) => CAR_SIZES.find((s) => s.id === id)?.label || '';
  const fitter = (id) => (id === me.id ? 'Anda' : staff.find((p) => p.id === id)?.name || '');
  // A worker's own month: cars they finished (no money, same rule as the owner tiles).
  const mine = useMemo(() => {
    const ym = today.slice(0, 7);
    const lastYm = shopDate(-Number(today.slice(8, 10))).slice(0, 7);
    const count = (k) => jobs.filter((j) => j.installer_id === me.id && ['siap', 'selesai'].includes(j.stage) && klDate(j.completed_at)?.slice(0, 7) === k).length;
    return { cur: count(ym), prev: count(lastYm), today: todays.filter((j) => j.installer_id === me.id).length };
  }, [jobs, me.id, today, todays]);

  return (
    <div className="page">
      <PushNotice push={push} devices={devices} />
      {error && <div className="notice"><p className="warnline">{error}</p></div>}
      <div className="page-h">
        <div><div className="micro">{dayParts(today).dow}, {dayParts(today).date} {dayParts(today).mon}</div><h1>{greeting()}, {me.name}</h1></div>
        <button className="btn btn-primary" onClick={onNew}>{Icon.plus}Kerja baru</button>
      </div>

      {me.role !== 'owner' && (
        <div className="tiles">
          <Tile label="Kereta anda siap bulan ini" value={mine.cur} cur={mine.cur} prev={mine.prev} note="vs bulan lepas" />
          <Tile label="Kerja anda hari ini" value={mine.today} note={`daripada ${todays.length} kereta hari ini`} />
        </div>
      )}
      {me.role === 'owner' && (
        <div className="tiles">
          <Tile label="Jualan bulan ini" value={rmFmt(stats.cur.sales)} cur={stats.cur.sales} prev={stats.prev.sales} note="vs bulan lepas" />
          <Tile label="Kereta siap" value={stats.cur.cars} cur={stats.cur.cars} prev={stats.prev.cars} note="vs bulan lepas" />
          <Tile label="Tempahan online" value={stats.cur.online} cur={stats.cur.online} prev={stats.prev.online} note="vs bulan lepas" />
          <Tile label="Belum dibayar" value={rmFmt(stats.cur.owed)} note="kereta siap, baki tertunggak" />
        </div>
      )}

      <div className="section">
        <div className="section-h"><span className="micro">Kereta hari ini · {todays.length}</span></div>
        <div className="card rows">
          {todays.length ? todays.map((j) => (
            <button key={j.id} className="row" onClick={() => onOpen(j)}>
              <span className="row-time">{j.scheduled_slot || '--:--'}</span>
              <span className="row-main"><span className="row-title">{j.customer_name}</span>
                <span className="row-sub">{[j.car_model, j.plate, size(j.car_size), fitter(j.installer_id), j.wait_mode === 'tinggal' ? 'tinggal kereta' : j.wait_mode === 'tunggu' ? 'tunggu di kedai' : '', j.customer_confirmed_at ? 'pelanggan sahkan' : ''].filter(Boolean).join(' · ')}</span></span>
              <StageChip stage={j.stage} />
            </button>
          )) : <div className="empty">Tiada kereta dijadualkan hari ini.</div>}
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="section">
          <div className="section-h"><span className="micro">Senarai menunggu walk-in · {waiting.length}</span><span className="muted" style={{ fontSize: 12 }}>yang pertama ditawarkan bay kosong dulu</span></div>
          <div className="card rows">
            {waiting.map((j, i) => (
              <button key={j.id} className="row" onClick={() => onOpen(j)}>
                <span className="row-time">#{i + 1}</span>
                <span className="row-main"><span className="row-title">{j.customer_name}</span>
                  <span className="row-sub">{[j.car_model, size(j.car_size), `sejak ${new Date(j.waitlist_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}`].filter(Boolean).join(' · ')}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-h"><span className="micro">Perlu tindakan · {actions.length}</span></div>
        <div className="card rows">
          {actions.length ? actions.map((a) => (
            <div key={a.job.id + a.kind} className="row row-act" onClick={() => onOpen(a.job)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onOpen(a.job); }}>
              <span className="row-main">
                <span className="row-title">{a.job.customer_name}</span>
                <span className="row-sub">{a.why}{a.job.scheduled_date ? ` · ${dayParts(a.job.scheduled_date).short} ${dayParts(a.job.scheduled_date).date} ${a.job.scheduled_slot ? slotLabel(a.job.scheduled_slot) : ''}` : ''}</span>
              </span>
              <span className="row-actions" onClick={(e) => e.stopPropagation()}>
                {a.stamp && <button className="btn btn-sm" onClick={() => onAction(a, false)} title="Tandakan selesai tanpa WhatsApp">Dah buat</button>}
                {a.alt && <button className="btn btn-sm" onClick={() => onAction(a, false)}>{a.alt.label}</button>}
                {a.wa ? <button className="btn btn-sm btn-wa" onClick={() => onAction(a, true)}>{Icon.wa}{a.cta}</button>
                  : <button className="btn btn-sm" onClick={() => onOpen(a.job)}>{a.cta}</button>}
              </span>
            </div>
          )) : <div className="empty">Semua pelanggan sudah diurus.</div>}
        </div>
      </div>

      <div className="section">
        <div className="section-h"><span className="micro">7 hari akan datang · kereta / kapasiti</span></div>
        <WeekStrip jobs={jobs} settings={settings} />
      </div>
    </div>
  );
}
