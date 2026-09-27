import { useMemo } from 'react';
import { actionsFor, monthStats, byScheduled } from './logic.js';
import { StageChip, Tile, Icon, rmFmt } from './ui.jsx';
import { shopDate, dayParts, slotLabel } from '../shared/api.js';
import { CAR_SIZES } from '../shared/shop.js';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));
  return h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
}

// Required on staff phones: a web booking nobody hears about is a lost customer.
// Only states nothing on the page can fix (iOS not installed, browser-blocked) explain instead.
function PushNotice({ push }) {
  if (push.state === 'on' || push.state === 'working' || push.state === 'unsupported') return null;
  if (push.state === 'ios-install') {
    return <div className="notice"><p><b>Pasang app untuk dapat notifikasi</b>Tekan butang Kongsi di Safari, pilih "Add to Home Screen", kemudian buka app dari skrin utama.</p></div>;
  }
  if (push.state === 'denied') {
    return <div className="notice"><p><b>Notifikasi disekat</b>Buka tetapan pelayar, cari laman ini dan benarkan Notifikasi. Tanpa ini, tempahan online baru tidak akan sampai ke telefon anda.</p></div>;
  }
  return (
    <div className="notice">
      <p><b>Hidupkan notifikasi tempahan</b>Telefon ini akan berbunyi setiap kali pelanggan tempah online.{push.error && <span className="warnline"> {push.error}</span>}</p>
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

export default function Dashboard({ me, jobs, settings, push, onOpen, onAction, onNew, error }) {
  const today = shopDate(0);
  const todays = useMemo(() => jobs.filter((j) => j.scheduled_date === today && j.stage !== 'batal').sort(byScheduled), [jobs, today]);
  const actions = useMemo(() => actionsFor(jobs, today), [jobs, today]);
  const stats = useMemo(() => monthStats(jobs, today), [jobs, today]);
  const size = (id) => CAR_SIZES.find((s) => s.id === id)?.label || '';

  return (
    <div className="page">
      <PushNotice push={push} />
      {error && <div className="notice"><p className="warnline">{error}</p></div>}
      <div className="page-h">
        <div><div className="micro">{dayParts(today).dow}, {dayParts(today).date} {dayParts(today).mon}</div><h1>{greeting()}, {me.name}</h1></div>
        <button className="btn btn-primary" onClick={onNew}>{Icon.plus}Kerja baru</button>
      </div>

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
                <span className="row-sub">{[j.car_model, j.plate, size(j.car_size)].filter(Boolean).join(' · ')}</span></span>
              <StageChip stage={j.stage} />
            </button>
          )) : <div className="empty">Tiada kereta dijadualkan hari ini.</div>}
        </div>
      </div>

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
