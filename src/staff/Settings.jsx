import { useState } from 'react';
import { supabase } from './supabase.js';
import { CAR_SIZES } from '../shared/shop.js';
import { Sheet } from './ui.jsx';

const DOW = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// Owner only (the database refuses anyone else's write anyway).
export default function Settings({ settings, staff, me, onClose, onSaved, toast }) {
  const [s, setS] = useState(() => JSON.parse(JSON.stringify(settings)));
  const [slotsText, setSlotsText] = useState(settings.slots.join(', '));
  const [newClosed, setNewClosed] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const setFilm = (i, k, v) => setS((p) => { const films = [...p.films]; films[i] = { ...films[i], [k]: v }; return { ...p, films }; });
  const setAddon = (i, k, v) => setS((p) => { const addons = [...(p.addons || [])]; addons[i] = { ...addons[i], [k]: v }; return { ...p, addons }; });
  const setAddonPrice = (i, size, v) => setS((p) => { const addons = [...(p.addons || [])]; addons[i] = { ...addons[i], prices: { ...addons[i].prices, [size]: v } }; return { ...p, addons }; });
  const setPrice = (i, size, v) => setS((p) => { const films = [...p.films]; films[i] = { ...films[i], prices: { ...films[i].prices, [size]: v } }; return { ...p, films }; });

  async function save() {
    setErr('');
    const slots = slotsText.split(/[,\s]+/).filter(Boolean).map((t) => t.padStart(5, '0'));
    if (!slots.length || slots.some((t) => !/^[0-2]\d:[0-5]\d$/.test(t))) return setErr('Slot mesti format 09:30, dipisah koma.');
    const films = s.films.map((f) => ({
      ...f, name: f.name.trim(), tagline: (f.tagline || '').trim(),
      heat_rejection: numOrNull(f.heat_rejection), uv: numOrNull(f.uv), warranty_years: numOrNull(f.warranty_years),
      prices: Object.fromEntries(CAR_SIZES.map((z) => [z.id, numOrNull(f.prices?.[z.id])])),
    }));
    if (films.some((f) => !f.name)) return setErr('Setiap filem perlukan nama.');
    const addons = (s.addons || []).map((a) => ({ ...a, name: a.name.trim(),
      prices: Object.fromEntries(CAR_SIZES.map((z) => [z.id, numOrNull(a.prices?.[z.id])])) }));
    if (addons.some((a) => !a.name)) return setErr('Setiap tambahan perlukan nama.');
    const bays = Number(s.cars_per_slot);
    const online = s.online_per_slot === '' || s.online_per_slot === null || s.online_per_slot === undefined ? null : Number(s.online_per_slot);
    if (online !== null && (online < 0 || online > bays)) return setErr('Bay untuk online tidak boleh lebih dari jumlah bay.');
    setBusy(true);
    const { data, error } = await supabase.from('shop_settings').update({
      films, addons, slots: [...new Set(slots)].sort(), cars_per_slot: bays, online_per_slot: online,
      closed_weekdays: s.closed_weekdays, closed_dates: s.closed_dates, booking_days_ahead: Number(s.booking_days_ahead),
      updated_at: new Date().toISOString(),
    }).eq('id', 1).select().single();
    setBusy(false);
    if (error || !data) return setErr('Gagal simpan. Hanya pemilik boleh ubah tetapan.');
    onSaved(data); toast('Tetapan disimpan. Laman web kini guna harga baru.'); onClose();
  }

  async function toggleStaff(p) {
    if (p.id === me.id) return;
    const { error } = await supabase.from('staff').update({ active: !p.active }).eq('id', p.id);
    if (!error) { toast(p.active ? `${p.name} tidak boleh log masuk lagi` : `${p.name} diaktifkan`); onSaved(); }
  }

  const footer = <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan tetapan'}</button>;

  return (
    <Sheet title="Tetapan kedai" onClose={onClose} footer={footer}>
      <div className="card box">
        <div className="micro">Filem dan harga (kosong = "Tanya harga")</div>
        {s.films.map((f, i) => (
          <div key={f.id} style={{ display: 'grid', gap: 8, paddingTop: i ? 12 : 0, borderTop: i ? '1px solid var(--line-2)' : 0 }}>
            <div className="grid2">
              <label className="fld"><span>Nama</span><input className="in" value={f.name} onChange={(e) => setFilm(i, 'name', e.target.value)} maxLength={40} /></label>
              <label className="fld"><span>Waranti (tahun)</span><input className="in tab-num" type="number" min="0" value={f.warranty_years ?? ''} onChange={(e) => setFilm(i, 'warranty_years', e.target.value)} /></label>
            </div>
            <label className="fld"><span>Penerangan ringkas</span><input className="in" value={f.tagline || ''} onChange={(e) => setFilm(i, 'tagline', e.target.value)} maxLength={80} /></label>
            <div className="grid2">
              <label className="fld"><span>Tolak haba (%)</span><input className="in tab-num" type="number" min="0" max="100" value={f.heat_rejection ?? ''} onChange={(e) => setFilm(i, 'heat_rejection', e.target.value)} /></label>
              <label className="fld"><span>Sekat UV (%)</span><input className="in tab-num" type="number" min="0" max="100" value={f.uv ?? ''} onChange={(e) => setFilm(i, 'uv', e.target.value)} /></label>
            </div>
            <div className="grid2">
              {CAR_SIZES.map((z) => (
                <label key={z.id} className="fld"><span>Harga {z.label} (RM)</span>
                  <input className="in tab-num" type="number" min="0" value={f.prices?.[z.id] ?? ''} onChange={(e) => setPrice(i, z.id, e.target.value)} /></label>
              ))}
            </div>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12 }}>Hanya tulis angka yang dibekalkan pembekal filem. Jangan teka peratus.</div>
      </div>

      <div className="card box">
        <div className="micro">Tambahan dan harga (kosong = "Tanya")</div>
        {(s.addons || []).map((a, i) => (
          <div key={a.id} style={{ display: 'grid', gap: 8, paddingTop: i ? 12 : 0, borderTop: i ? '1px solid var(--line-2)' : 0 }}>
            <label className="fld"><span>Nama</span><input className="in" value={a.name} onChange={(e) => setAddon(i, 'name', e.target.value)} maxLength={40} /></label>
            <div className="grid2">
              {CAR_SIZES.map((z) => (
                <label key={z.id} className="fld"><span>{z.label} (RM)</span>
                  <input className="in tab-num" type="number" min="0" value={a.prices?.[z.id] ?? ''} onChange={(e) => setAddonPrice(i, z.id, e.target.value)} /></label>
              ))}
            </div>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12 }}>Jumlah di laman web = filem cermin sisi + tambahan yang dipilih. Jika satu bahagian kosong, laman web tunjuk "dari" dan anda sahkan di kedai.</div>
      </div>

      <div className="card box">
        <div className="micro">Slot tempahan online</div>
        <div className="grid2">
          <label className="fld"><span>Masa slot</span><input className="in" value={slotsText} onChange={(e) => setSlotsText(e.target.value)} placeholder="09:30, 12:30, 15:30" /></label>
          <label className="fld"><span>Bay (kereta serentak) setiap slot</span><input className="in tab-num" type="number" min="1" max="10" value={s.cars_per_slot} onChange={(e) => setS({ ...s, cars_per_slot: e.target.value })} /></label>
          {/* Owner's rule: a booking holds its slot, walk-ins get what is left. Hold some bays back. */}
          <label className="fld"><span>Daripadanya, dijual online</span><input className="in tab-num" type="number" min="0" max="10" value={s.online_per_slot ?? ''} placeholder="semua" onChange={(e) => setS({ ...s, online_per_slot: e.target.value })} /></label>
          <label className="fld"><span>Boleh tempah berapa hari ke depan</span><input className="in tab-num" type="number" min="1" max="90" value={s.booking_days_ahead} onChange={(e) => setS({ ...s, booking_days_ahead: e.target.value })} /></label>
        </div>
        <div className="fld"><span className="micro">Hari tutup setiap minggu</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {DOW.map((d, i) => (
              <label key={d} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={s.closed_weekdays.includes(i)}
                  onChange={(e) => setS({ ...s, closed_weekdays: e.target.checked ? [...s.closed_weekdays, i].sort() : s.closed_weekdays.filter((x) => x !== i) })} />{d}
              </label>
            ))}
          </div>
        </div>
        <div className="fld"><span className="micro">Cuti / tarikh tutup</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="in" type="date" value={newClosed} onChange={(e) => setNewClosed(e.target.value)} />
            <button className="btn" disabled={!newClosed} onClick={() => { setS({ ...s, closed_dates: [...new Set([...s.closed_dates, newClosed])].sort() }); setNewClosed(''); }}>Tambah</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {s.closed_dates.map((d) => <button key={d} className="btn btn-sm" onClick={() => setS({ ...s, closed_dates: s.closed_dates.filter((x) => x !== d) })}>{d} ×</button>)}
          </div>
        </div>
      </div>

      <div className="card box">
        <div className="micro">Staf</div>
        {staff.map((p) => (
          <div key={p.id} className="box-h">
            <span><b>{p.name}</b> <span className="muted">{p.role === 'owner' ? 'Pemilik' : 'Staf'}{p.active ? '' : ' · tidak aktif'}</span></span>
            {p.id !== me.id && <button className="btn btn-sm" onClick={() => toggleStaff(p)}>{p.active ? 'Nyahaktif' : 'Aktifkan'}</button>}
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12 }}>Staf baru ditambah oleh pembangun anda (akaun log masuk perlu dicipta). Nyahaktif serta-merta menyekat akses.</div>
      </div>
      {err && <div className="warnline" role="alert">{err}</div>}
    </Sheet>
  );
}
