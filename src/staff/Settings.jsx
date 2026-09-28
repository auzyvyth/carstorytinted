import { useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { CAR_SIZES } from '../shared/shop.js';

const DOW = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const clone = (o) => JSON.parse(JSON.stringify(o));
// The tint preview slider runs between these two, so it is both numbers or neither (false = half-filled).
const vltOf = (v) => {
  const [a, b] = (v || []).map(numOrNull);
  if (a === null && b === null) return null;
  if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) return false;
  return [Math.min(a, b), Math.max(a, b)];
};

// One category per tab. Pricing is its own tab (films + add-ons as a size grid);
// what a film IS (name, specs, warranty) lives under Filem.
const TABS = [
  ['harga', 'Harga'],
  ['filem', 'Filem'],
  ['slot', 'Slot & bay'],
  ['cuti', 'Hari tutup'],
  ['staf', 'Staf'],
];

// What each tab owns, so a tab can show "unsaved" on its own.
const slice = {
  harga: (s) => ({ p: s.films.map((f) => f.prices), a: s.addons || [] }),
  filem: (s) => s.films.map(({ prices, ...rest }) => rest),
  slot: (s) => ({ t: s.slotsText, b: String(s.cars_per_slot), o: String(s.online_per_slot ?? ''), d: String(s.booking_days_ahead) }),
  cuti: (s) => ({ w: s.closed_weekdays, d: s.closed_dates }),
};
const draftOf = (settings) => ({ ...clone(settings), slotsText: settings.slots.join(', ') });

function Rm({ value, onChange, label }) {
  return (
    <div className="rm"><input className="in" type="number" inputMode="numeric" min="0" aria-label={label}
      value={value ?? ''} placeholder="Tanya" onChange={(e) => onChange(e.target.value)} /></div>
  );
}

// Desktop: the whole grid at once. Phone: pick a size, then one price per row.
function PriceGrid({ title, note, rows, getPrice, setPrice, nameCell, size }) {
  return (
    <div className="card">
      <div className="card-h"><div className="micro">{title}</div></div>
      <div className="price-desk">
        <table className="matrix">
          <thead><tr><th>Nama</th>{CAR_SIZES.map((z) => <th key={z.id}>{z.label}<small>{z.eg.split(',')[0]}</small></th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.id}><td>{nameCell(r, i)}</td>
              {CAR_SIZES.map((z) => <td key={z.id}><Rm value={getPrice(r, z.id)} onChange={(v) => setPrice(i, z.id, v)} label={`${r.name} ${z.label}`} /></td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="price-phone">
        <div className="plist">{rows.map((r, i) => (
          <div key={r.id} className="row"><div className="row-main">{nameCell(r, i)}</div>
            <Rm value={getPrice(r, size)} onChange={(v) => setPrice(i, size, v)} label={`${r.name} ${size}`} /></div>
        ))}</div>
      </div>
      <div className="box" style={{ borderTop: '1px solid var(--line-2)' }}><div className="set-note">{note}</div></div>
    </div>
  );
}

// Owner only (the database refuses anyone else's write anyway).
export default function Settings({ settings, staff, me, onSaved, toast, hidden }) {
  const [base, setBase] = useState(() => draftOf(settings));
  const [s, setS] = useState(() => draftOf(settings));
  const [tab, setTab] = useState('harga');
  const [size, setSize] = useState(CAR_SIZES[0].id);
  const [newClosed, setNewClosed] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dirty = useMemo(() => Object.fromEntries(Object.keys(slice).map((k) => [k, JSON.stringify(slice[k](s)) !== JSON.stringify(slice[k](base))])), [s, base]);
  const anyDirty = Object.values(dirty).some(Boolean);

  const setFilm = (i, k, v) => setS((p) => { const films = [...p.films]; films[i] = { ...films[i], [k]: v }; return { ...p, films }; });
  const setPrice = (i, size, v) => setS((p) => { const films = [...p.films]; films[i] = { ...films[i], prices: { ...films[i].prices, [size]: v } }; return { ...p, films }; });
  const setAddon = (i, k, v) => setS((p) => { const addons = [...(p.addons || [])]; addons[i] = { ...addons[i], [k]: v }; return { ...p, addons }; });
  const setAddonPrice = (i, size, v) => setS((p) => { const addons = [...(p.addons || [])]; addons[i] = { ...addons[i], prices: { ...addons[i].prices, [size]: v } }; return { ...p, addons }; });
  const setVlt = (i, j, v) => setS((p) => { const films = [...p.films]; const vlt = [...(films[i].vlt || [null, null])]; vlt[j] = v; films[i] = { ...films[i], vlt }; return { ...p, films }; });
  const fail = (t, m) => { setTab(t); setErr(m); };

  async function save() {
    setErr('');
    const slots = s.slotsText.split(/[,\s]+/).filter(Boolean).map((t) => t.padStart(5, '0'));
    if (!slots.length || slots.some((t) => !/^[0-2]\d:[0-5]\d$/.test(t))) return fail('slot', 'Slot mesti format 09:30, dipisah koma.');
    const films = s.films.map((f) => ({
      ...f, name: f.name.trim(), tagline: (f.tagline || '').trim(), ir: (f.ir || '').trim() || null, grade: (f.grade || '').trim() || null,
      heat_rejection: numOrNull(f.heat_rejection), uv: numOrNull(f.uv), warranty_years: numOrNull(f.warranty_years),
      vlt: vltOf(f.vlt),
      prices: Object.fromEntries(CAR_SIZES.map((z) => [z.id, numOrNull(f.prices?.[z.id])])),
    }));
    if (films.some((f) => !f.name)) return fail('filem', 'Setiap filem perlukan nama.');
    if (films.some((f) => f.vlt === false)) return fail('filem', 'Isi kedua-dua kegelapan (paling gelap dan paling cerah), atau kosongkan kedua-duanya.');
    const addons = (s.addons || []).map((a) => ({ ...a, name: a.name.trim(),
      prices: Object.fromEntries(CAR_SIZES.map((z) => [z.id, numOrNull(a.prices?.[z.id])])) }));
    if (addons.some((a) => !a.name)) return fail('harga', 'Setiap tambahan perlukan nama.');
    const bays = Number(s.cars_per_slot);
    const online = s.online_per_slot === '' || s.online_per_slot === null || s.online_per_slot === undefined ? null : Number(s.online_per_slot);
    if (online !== null && (online < 0 || online > bays)) return fail('slot', 'Bay untuk online tidak boleh lebih dari jumlah bay.');
    setBusy(true);
    const { data, error } = await supabase.from('shop_settings').update({
      films, addons, slots: [...new Set(slots)].sort(), cars_per_slot: bays, online_per_slot: online,
      closed_weekdays: s.closed_weekdays, closed_dates: s.closed_dates, booking_days_ahead: Number(s.booking_days_ahead),
      updated_at: new Date().toISOString(),
    }).eq('id', 1).select().single();
    setBusy(false);
    if (error || !data) return setErr('Gagal simpan. Hanya pemilik boleh ubah tetapan.');
    setBase(draftOf(data)); setS(draftOf(data));
    onSaved(data); toast('Tetapan disimpan. Laman web kini guna harga baru.');
  }

  async function toggleStaff(p) {
    if (p.id === me.id) return;
    const { error } = await supabase.from('staff').update({ active: !p.active }).eq('id', p.id);
    if (!error) { toast(p.active ? `${p.name} tidak boleh log masuk lagi` : `${p.name} diaktifkan`); onSaved(); }
  }

  const filmName = (f) => <span className="nm">{f.name || 'Tanpa nama'}{f.grade && <small>Gred {f.grade}{f.warranty_years ? ` · waranti ${f.warranty_years} thn` : ''}</small>}</span>;

  return (
    <div className="page" hidden={hidden}>
      <div className="page-h"><div><div className="micro">Pemilik sahaja</div><h1>Tetapan kedai</h1></div></div>
      <div className="subtabs" role="tablist" aria-label="Kategori tetapan">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setErr(''); }}>
            {label}{dirty[id] && <i className="dot" aria-label="belum disimpan" />}
          </button>
        ))}
      </div>

      {tab === 'harga' && (
        <div className="set-grid">
          {/* Phone: one size at a time, chosen once for both lists. */}
          <div className="price-phone">
            <div className="micro" style={{ marginBottom: 6 }}>Harga untuk saiz</div>
            <div className="seg" role="tablist" aria-label="Saiz kereta">
              {CAR_SIZES.map((z) => <button key={z.id} role="tab" aria-pressed={size === z.id} aria-selected={size === z.id} onClick={() => setSize(z.id)}>{z.label}</button>)}
            </div>
          </div>
          <PriceGrid title="Filem cermin sisi (4 tingkap)" rows={s.films} size={size}
            getPrice={(f, z) => f.prices?.[z]} setPrice={setPrice} nameCell={filmName}
            note='Kosong = laman web tunjuk "Tanya harga". Nama dan spesifikasi filem ditukar di tab Filem.' />
          <PriceGrid title="Tambahan (cermin depan, belakang, dll.)" rows={s.addons || []} size={size}
            getPrice={(a, z) => a.prices?.[z]} setPrice={setAddonPrice}
            nameCell={(a, i) => <input className="in" value={a.name} aria-label="Nama tambahan" onChange={(e) => setAddon(i, 'name', e.target.value)} maxLength={40} />}
            note='Jumlah di laman web = filem cermin sisi + tambahan yang dipilih. Jika satu bahagian kosong, laman web tunjuk "dari" dan anda sahkan di kedai.' />
        </div>
      )}

      {tab === 'filem' && (
        <div className="set-grid">
          {s.films.map((f, i) => (
            <div key={f.id} className="card">
              <div className="card-h"><b>{f.name || 'Tanpa nama'}</b><span className="tag">Filem {i + 1}</span></div>
              <div className="box">
                <div className="grid2">
                  <label className="fld"><span>Nama</span><input className="in" value={f.name} onChange={(e) => setFilm(i, 'name', e.target.value)} maxLength={40} /></label>
                  <label className="fld"><span>Gred</span><input className="in" value={f.grade || ''} placeholder="cth. Korea, US" onChange={(e) => setFilm(i, 'grade', e.target.value)} maxLength={20} /></label>
                </div>
                <label className="fld"><span>Penerangan ringkas</span><input className="in" value={f.tagline || ''} onChange={(e) => setFilm(i, 'tagline', e.target.value)} maxLength={80} /></label>
                <div className="grid2">
                  <label className="fld"><span>Tolak IR</span><input className="in" value={f.ir || ''} placeholder="cth. 80%" onChange={(e) => setFilm(i, 'ir', e.target.value)} maxLength={20} /></label>
                  <label className="fld"><span>Waranti (tahun)</span><input className="in tab-num" type="number" min="0" value={f.warranty_years ?? ''} onChange={(e) => setFilm(i, 'warranty_years', e.target.value)} /></label>
                  <label className="fld"><span>Tolak haba (%)</span><input className="in tab-num" type="number" min="0" max="100" value={f.heat_rejection ?? ''} onChange={(e) => setFilm(i, 'heat_rejection', e.target.value)} /></label>
                  <label className="fld"><span>Sekat UV (%)</span><input className="in tab-num" type="number" min="0" max="100" value={f.uv ?? ''} onChange={(e) => setFilm(i, 'uv', e.target.value)} /></label>
                  <label className="fld"><span>Kegelapan paling gelap (VLT %)</span><input className="in tab-num" type="number" min="0" max="100" value={f.vlt?.[0] ?? ''} onChange={(e) => setVlt(i, 0, e.target.value)} /></label>
                  <label className="fld"><span>Paling cerah (VLT %)</span><input className="in tab-num" type="number" min="0" max="100" value={f.vlt?.[1] ?? ''} onChange={(e) => setVlt(i, 1, e.target.value)} /></label>
                </div>
              </div>
            </div>
          ))}
          <div className="set-note">Hanya tulis angka yang dibekalkan pembekal filem. Jangan teka peratus.</div>
        </div>
      )}

      {tab === 'slot' && (
        <div className="card box">
          <label className="fld"><span>Masa slot (dipisah koma)</span><input className="in" value={s.slotsText} onChange={(e) => setS({ ...s, slotsText: e.target.value })} placeholder="09:30, 12:30, 15:30" /></label>
          <div className="grid2">
            <label className="fld"><span>Bay (kereta serentak) setiap slot</span><input className="in tab-num" type="number" min="1" max="10" value={s.cars_per_slot} onChange={(e) => setS({ ...s, cars_per_slot: e.target.value })} /></label>
            {/* Owner's rule: a booking holds its slot, walk-ins get what is left. Hold some bays back. */}
            <label className="fld"><span>Daripadanya, dijual online</span><input className="in tab-num" type="number" min="0" max="10" value={s.online_per_slot ?? ''} placeholder="semua" onChange={(e) => setS({ ...s, online_per_slot: e.target.value })} /></label>
          </div>
          <label className="fld"><span>Boleh tempah berapa hari ke depan</span><input className="in tab-num" type="number" min="1" max="90" value={s.booking_days_ahead} onChange={(e) => setS({ ...s, booking_days_ahead: e.target.value })} /></label>
          <div className="set-note">Bay yang tidak dijual online dikhaskan untuk walk-in.</div>
        </div>
      )}

      {tab === 'cuti' && (
        <div className="set-grid">
          <div className="card box">
            <div className="micro">Tutup setiap minggu</div>
            <div className="chips">
              {DOW.map((d, i) => {
                const on = s.closed_weekdays.includes(i);
                return <button key={d} className="chipbtn" aria-pressed={on}
                  onClick={() => setS({ ...s, closed_weekdays: on ? s.closed_weekdays.filter((x) => x !== i) : [...s.closed_weekdays, i].sort() })}>{d}</button>;
              })}
            </div>
          </div>
          <div className="card box">
            <div className="micro">Cuti / tarikh tutup</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="in" type="date" value={newClosed} onChange={(e) => setNewClosed(e.target.value)} aria-label="Tarikh tutup" />
              <button className="btn" disabled={!newClosed} onClick={() => { setS({ ...s, closed_dates: [...new Set([...s.closed_dates, newClosed])].sort() }); setNewClosed(''); }}>Tambah</button>
            </div>
            {s.closed_dates.length ? (
              <div className="chips">{s.closed_dates.map((d) => <button key={d} className="chipbtn" aria-label={`Buang ${d}`} onClick={() => setS({ ...s, closed_dates: s.closed_dates.filter((x) => x !== d) })}>{d} ×</button>)}</div>
            ) : <div className="set-note">Tiada tarikh cuti.</div>}
          </div>
        </div>
      )}

      {tab === 'staf' && (
        <div className="card rows">
          {staff.map((p) => (
            <div key={p.id} className="row" style={{ cursor: 'default' }}>
              <span className="avatar">{(p.name || '?')[0].toUpperCase()}</span>
              <span className="row-main"><span className="row-title">{p.name}</span>
                <span className="row-sub">{p.role === 'owner' ? 'Pemilik' : 'Staf'}{p.active ? '' : ' · tidak aktif'}</span></span>
              {p.id !== me.id && <button className="btn btn-sm" onClick={() => toggleStaff(p)}>{p.active ? 'Nyahaktif' : 'Aktifkan'}</button>}
            </div>
          ))}
          <div className="box" style={{ borderTop: '1px solid var(--line-2)' }}><div className="set-note">Staf baru ditambah oleh pembangun anda (akaun log masuk perlu dicipta). Nyahaktif serta-merta menyekat akses. Perubahan di sini terus berkuat kuasa.</div></div>
        </div>
      )}

      {err && <div className="warnline" role="alert" style={{ marginTop: 12 }}>{err}</div>}
      {anyDirty && (
        <div className="savebar">
          <p><b>Ada perubahan belum disimpan</b>{TABS.filter(([id]) => dirty[id]).map(([, l]) => l).join(', ')}</p>
          <button className="btn" onClick={() => { setS(clone(base)); setErr(''); }} disabled={busy}>Batal</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      )}
    </div>
  );
}
