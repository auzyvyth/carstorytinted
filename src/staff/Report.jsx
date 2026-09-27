import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { report, PERIODS, toCsv } from './report.js';
import { Tile, rmFmt } from './ui.jsx';
import { shopDate } from '../shared/api.js';

// Owner only. Where the business stands over a period; the Dashboard stays "what to do today".
// The app's live list only preloads closed jobs from the last 120 days, so this screen
// reads the whole table once (slim columns, no notes or contact details beyond phone,
// which the returning-customer count needs).
const COLS = 'id, ref, created_at, completed_at, updated_at, source, stage, no_show, archived_at, customer_name, phone, plate, car_model, car_size, film_id, scheduled_date, scheduled_slot, price, quoted_price, paid_amount, payment_method, installer_id, lost_reason, thanked_at';

function Bars({ rows, money = false, empty = 'Tiada data dalam tempoh ini.', sub }) {
  const vals = rows.map((r) => (money ? r.v : r.n));
  const max = Math.max(0, ...vals);
  if (!rows.length || max === 0) return <div className="empty">{empty}</div>;
  return (
    <div className="bars">
      {rows.map((r) => {
        const v = money ? r.v : r.n;
        return (
          <div key={r.key} className="bar" title={`${r.key}: ${money ? rmFmt(v) : v}${sub ? ` (${sub(r)})` : ''}`}>
            <div className="bar-top"><span>{r.key}</span><b className="tab-num">{money ? rmFmt(v) : v}{sub && <small> · {sub(r)}</small>}</b></div>
            <div className="bar-track">{v > 0 && <i style={{ width: `${(v / max) * 100}%` }} />}</div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div className="section">
      <div className="section-h"><span className="micro">{title}</span>{note && <span className="muted" style={{ fontSize: 12 }}>{note}</span>}</div>
      <div className="card box">{children}</div>
    </div>
  );
}

const pct = (x) => `${Math.round(x * 100)}%`;

export default function Report({ jobs, settings, staff }) {
  const [period, setPeriod] = useState('mtd');
  const [all, setAll] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('jobs').select(COLS).is('archived_at', null).limit(20000)
      .then(({ data, error }) => { if (error) setErr('Tidak dapat muat turun semua rekod. Laporan guna 120 hari terakhir sahaja.'); else setAll(data); });
  }, []);

  const rows = all || jobs;
  const today = shopDate(0);
  const r = useMemo(() => report(rows, { today, period, settings, staff }), [rows, today, period, settings, staff]);

  function download() {
    const csv = toCsv(rows, r.range, { settings, staff });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const last = new Date(Date.parse(r.range.to) - 864e5).toISOString().slice(0, 10);  // range.to is exclusive
    a.download = `carstory-jualan-${r.range.from}-hingga-${last}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="page">
      <div className="page-h">
        <div><div className="micro">Pemilik sahaja</div><h1>Laporan</h1></div>
        <button className="btn" onClick={download} disabled={!r.cars}>Muat turun CSV</button>
      </div>
      {err && <div className="notice"><p className="warnline">{err}</p></div>}
      <div className="seg" role="group" aria-label="Tempoh">
        {PERIODS.map((p) => <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
      </div>

      <div className="tiles">
        <Tile label="Jualan (kerja siap)" value={rmFmt(r.sales)} cur={r.sales} prev={r.prevSales} note={period === 'mtd' ? 'vs tempoh sama bulan lepas' : 'vs tempoh sebelum'} />
        <Tile label="Kereta siap" value={r.cars} cur={r.cars} prev={r.prevCars} note={period === 'mtd' ? 'vs tempoh sama bulan lepas' : 'vs tempoh sebelum'} />
        <Tile label="Purata setiap kereta" value={r.avg === null ? '-' : rmFmt(r.avg)} note="harga kerja siap" />
        <Tile label="Belum dibayar" value={rmFmt(r.owed)} note={`sudah terima ${rmFmt(r.collected)}`} />
      </div>

      <div className="rgrid">
      <Section title={`Tempahan online · ${r.web.total}`} note={r.web.doneRate === null ? (r.web.total ? 'peratus dipapar bila 5 tempahan atau lebih' : '') : `${pct(r.web.doneRate)} jadi pelanggan`}>
        <Bars rows={r.web.out.map((o) => ({ ...o, v: o.n }))} empty="Tiada tempahan online dalam tempoh ini." />
      </Section>

      <Section title="Jualan ikut filem">
        <Bars rows={r.byFilm} money sub={(x) => `${x.n} kereta`} />
      </Section>

      <Section title="Jualan ikut saiz kereta">
        <Bars rows={r.bySize} money sub={(x) => `${x.n} kereta`} />
      </Section>

      <Section title="Kereta siap ikut hari" note={r.bay ? `slot terisi ${pct(r.bay.rate)} (${r.bay.used}/${r.bay.offered})` : ''}>
        <Bars rows={r.byDay} />
      </Section>

      <Section title="Kereta siap ikut pemasang">
        <Bars rows={r.byInstaller} />
      </Section>

      <Section title="Kaedah bayaran">
        <Bars rows={r.byMethod} money sub={(x) => `${x.n} kerja`} empty="Tiada bayaran direkod dalam tempoh ini." />
      </Section>

      <Section title="Sebab batal">
        <Bars rows={r.reasons} empty="Tiada kerja dibatalkan dalam tempoh ini." />
      </Section>

      </div>

      <div className="tiles">
        <Tile label="Pelanggan ulangan" value={r.returning} note={r.cars ? `daripada ${r.cars} kereta siap` : ''} />
        <Tile label="Minta ulasan dihantar" value={r.reviewsAsked} note="WhatsApp minta ulasan" />
      </div>
    </div>
  );
}
