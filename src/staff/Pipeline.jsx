import { useEffect, useMemo, useState } from 'react';
import { STAGES, CAR_SIZES } from '../shared/shop.js';
import { dayParts, slotLabel } from '../shared/api.js';
import { matches, byScheduled, balance, num, OPEN_STAGES } from './logic.js';
import { searchAllJobs } from './useJobs.js';
import { StageChip, Icon, rmFmt } from './ui.jsx';

const SOURCE = { web: 'Online', walk_in: 'Walk-in', whatsapp: 'WhatsApp', phone: 'Telefon' };

function JobCard({ j, onOpen }) {
  const when = j.scheduled_date ? `${dayParts(j.scheduled_date).short} ${dayParts(j.scheduled_date).date} ${dayParts(j.scheduled_date).mon}${j.scheduled_slot ? ` · ${slotLabel(j.scheduled_slot)}` : ''}` : 'Tiada tarikh';
  const price = num(j.price) ?? num(j.quoted_price);
  const owed = ['siap', 'selesai'].includes(j.stage) ? balance(j) : 0;
  return (
    <button className="card jcard" onClick={() => onOpen(j)}>
      <div className="jline"><b>{j.customer_name}</b><span className="tag">{SOURCE[j.source]}</span></div>
      <div className="row-sub">{[j.car_model, j.plate, CAR_SIZES.find((s) => s.id === j.car_size)?.label].filter(Boolean).join(' · ') || '-'}</div>
      <div className="jline"><span className="tab-num">{when}</span>
        <span className="tab-num">{owed > 0 ? <span className="down">Baki {rmFmt(owed)}</span> : price !== null ? rmFmt(price) : ''}</span></div>
    </button>
  );
}

export default function Pipeline({ jobs, onOpen, onNew, focusStage }) {
  // Open on the first stage that has work in it, not an empty "Baru".
  const [stage, setStage] = useState(() => focusStage || OPEN_STAGES.find((id) => jobs.some((j) => j.stage === id)) || 'baru');
  const [q, setQ] = useState('');
  const [older, setOlder] = useState([]);

  useEffect(() => { if (focusStage) setStage(focusStage); }, [focusStage]);

  // Search also reaches finished jobs older than the preload window.
  useEffect(() => {
    if (q.trim().length < 3) { setOlder([]); return undefined; }
    const t = setTimeout(() => searchAllJobs(q).then(setOlder).catch(() => setOlder([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s.id, jobs.filter((j) => j.stage === s.id).length])), [jobs]);
  const shown = useMemo(() => {
    if (q.trim()) {
      const seen = new Set(jobs.map((j) => j.id));
      return [...jobs.filter((j) => matches(j, q)), ...older.filter((j) => !seen.has(j.id))]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }
    const list = jobs.filter((j) => j.stage === stage);
    // Open work: soonest first. Finished work: most recent first.
    return ['selesai', 'batal'].includes(stage)
      ? list.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      : list.sort(byScheduled);
  }, [jobs, stage, q, older]);

  const stageButtons = (cls) => STAGES.map((s) => (
    <button key={s.id} aria-pressed={!q && stage === s.id} onClick={() => { setStage(s.id); setQ(''); }} className={cls}>
      <span className="chip"><i style={{ background: s.color }} /></span>
      <span>{s.label}</span><span className="n">{counts[s.id]}</span>
    </button>
  ));

  return (
    <div className="page">
      <div className="page-h">
        <div><div className="micro">Semua kerja</div><h1>Pipeline</h1></div>
        <button className="btn btn-primary" onClick={onNew}>{Icon.plus}Kerja baru</button>
      </div>
      <input className="search" type="search" placeholder="Cari nama, telefon, no. plat atau rujukan" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari kerja" style={{ marginBottom: 12 }} />
      <div className="pills" role="group" aria-label="Peringkat">{stageButtons('')}</div>
      <div className="pipe">
        <nav className="card rail" aria-label="Peringkat">{stageButtons('')}</nav>
        <div>
          <div className="micro" style={{ marginBottom: 8 }}>
            {q ? `Hasil carian · ${shown.length}` : `${STAGES.find((s) => s.id === stage).hint} · ${shown.length}`}
          </div>
          {shown.length ? <div className="cards">{shown.map((j) => <div key={j.id} style={{ display: 'grid' }}><JobCard j={j} onOpen={onOpen} />{q && <div style={{ padding: '4px 2px' }}><StageChip stage={j.stage} /></div>}</div>)}</div>
            : <div className="card empty">{q ? 'Tiada padanan.' : 'Tiada kerja di peringkat ini.'}</div>}
        </div>
      </div>
    </div>
  );
}
