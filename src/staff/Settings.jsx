import { useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { CAR_SIZES } from '../shared/shop.js';
import { videoOf } from '../shared/render.js';
import { DEMO } from '../shared/api.js';

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
  ['laman', 'Laman web'],
  ['staf', 'Staf'],
];

// What each tab owns, so a tab can show "unsaved" on its own.
const slice = {
  harga: (s) => ({ p: s.films.map((f) => f.prices), a: s.addons || [] }),
  filem: (s) => s.films.map(({ prices, ...rest }) => rest),
  slot: (s) => ({ t: s.slotsText, b: String(s.cars_per_slot), o: String(s.online_per_slot ?? ''), d: String(s.booking_days_ahead) }),
  cuti: (s) => ({ w: s.closed_weekdays, d: s.closed_dates }),
  laman: (s) => s.site,
};
const SITE0 = { services: [], team: [], videos: [] };
const draftOf = (settings) => ({ ...clone(settings), site: { ...SITE0, ...clone(settings.site || {}) }, slotsText: settings.slots.join(', ') });
const newId = () => Math.random().toString(36).slice(2, 10);

// Team photo: shrunk on the phone to 480x600 WebP (tens of KB, not a 4 MB camera file),
// then uploaded to the public 'site' bucket (owner-only writes, 0005_site_content.sql).
async function uploadPhoto(file) {
  const img = await createImageBitmap(file);
  const W = 480, H = 600, r = Math.max(W / img.width, H / img.height);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const w = img.width * r, h = img.height * r;
  c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  if (DEMO) return c.toDataURL('image/webp', 0.8);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.82));
  const path = `team/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from('site').upload(path, blob, { contentType: 'image/webp' });
  if (error) throw error;
  return supabase.storage.from('site').getPublicUrl(path).data.publicUrl;
}

function SiteEditor({ site, setSite, toast }) {
  const upd = (key, i, patch) => setSite({ ...site, [key]: site[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const del = (key, i) => setSite({ ...site, [key]: site[key].filter((_, j) => j !== i) });
  const add = (key, row) => setSite({ ...site, [key]: [...site[key], row] });
  const move = (key, i, d) => { const a = [...site[key]]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setSite({ ...site, [key]: a }); };
  const [busy, setBusy] = useState('');
  async function pick(i, file) {
    if (!file) return;
    setBusy(String(i));
    try { upd('team', i, { photo_url: await uploadPhoto(file) }); } catch { toast('Gagal muat naik gambar. Cuba lagi.'); }
    setBusy('');
  }
  return (
    <div className="set-grid">
      <div className="card box">
        <div className="micro">Servis lain (polish, karpet...)</div>
        <div className="set-note">Tunjuk di laman web dengan butang WhatsApp. Belum boleh ditempah online. Harga kosong = "Tanya harga".</div>
        {site.services.map((x, i) => (
          <div key={x.id || i} className="site-row">
            <div className="grid2">
              <label className="fld"><span>Nama servis</span><input className="in" value={x.name || ''} maxLength={40} onChange={(e) => upd('services', i, { name: e.target.value })} /></label>
              <label className="fld"><span>Harga dari (RM)</span><input className="in tab-num" type="number" inputMode="numeric" min="0" placeholder="Tanya" value={x.price_from ?? ''} onChange={(e) => upd('services', i, { price_from: e.target.value })} /></label>
            </div>
            <label className="fld"><span>Penerangan ringkas</span><textarea className="in" rows={2} maxLength={200} value={x.desc || ''} onChange={(e) => upd('services', i, { desc: e.target.value })} /></label>
            <div className="row-actions"><button className="btn btn-sm" onClick={() => del('services', i)}>Buang</button></div>
          </div>
        ))}
        <div><button className="btn btn-sm" onClick={() => add('services', { id: newId(), name: '', desc: '', price_from: null })}>+ Tambah servis</button></div>
      </div>

      <div className="card box">
        <div className="micro">Pasukan kami</div>
        <div className="set-note">Bahagian "Kenali pasukan kami" di laman utama. Kosong = bahagian itu tidak ditunjuk.</div>
        {site.team.map((x, i) => (
          <div key={x.id || i} className="site-row team-row">
            <label className="photo-pick" aria-label={`Gambar ${x.name || 'ahli'}`}>
              {x.photo_url ? <img src={x.photo_url} alt="" /> : <span>{busy === String(i) ? '...' : '+ Gambar'}</span>}
              <input type="file" accept="image/*" onChange={(e) => pick(i, e.target.files?.[0])} hidden />
            </label>
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <div className="grid2">
                <label className="fld"><span>Nama</span><input className="in" value={x.name || ''} maxLength={40} onChange={(e) => upd('team', i, { name: e.target.value })} /></label>
                <label className="fld"><span>Tugas</span><input className="in" value={x.role || ''} maxLength={40} placeholder="cth. Pemasang" onChange={(e) => upd('team', i, { role: e.target.value })} /></label>
              </div>
              <label className="fld"><span>Satu ayat (pilihan)</span><input className="in" value={x.bio || ''} maxLength={140} onChange={(e) => upd('team', i, { bio: e.target.value })} /></label>
              <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => move('team', i, -1)} disabled={!i}>Naik</button>
                <button className="btn btn-sm" onClick={() => move('team', i, 1)} disabled={i === site.team.length - 1}>Turun</button>
                {x.photo_url && <button className="btn btn-sm" onClick={() => upd('team', i, { photo_url: null })}>Buang gambar</button>}
                <button className="btn btn-sm" onClick={() => del('team', i)}>Buang</button>
              </div>
            </div>
          </div>
        ))}
        <div><button className="btn btn-sm" onClick={() => add('team', { id: newId(), name: '', role: '', bio: '', photo_url: null })}>+ Tambah ahli</button></div>
      </div>

      <div className="card box">
        <div className="micro">Video</div>
        <div className="set-note">Tampal pautan YouTube (termasuk Shorts) atau TikTok. Video hanya dimuatkan bila pelawat tekan main.</div>
        {site.videos.map((x, i) => {
          const ok = videoOf(x.url);
          return (
            <div key={x.id || i} className="site-row">
              <div className="grid2">
                <label className="fld"><span>Pautan video</span><input className="in" value={x.url || ''} placeholder="https://youtu.be/..." onChange={(e) => upd('videos', i, { url: e.target.value })} /></label>
                <label className="fld"><span>Tajuk (pilihan)</span><input className="in" value={x.title || ''} maxLength={80} onChange={(e) => upd('videos', i, { title: e.target.value })} /></label>
              </div>
              {x.url && !ok && <div className="warnline">Bukan pautan YouTube atau TikTok yang sah.</div>}
              {ok && <div className="okline">{ok.kind === 'youtube' ? 'YouTube' : 'TikTok'}{ok.tall ? ' (menegak)' : ''}</div>}
              <div className="row-actions"><button className="btn btn-sm" onClick={() => move('videos', i, -1)} disabled={!i}>Naik</button><button className="btn btn-sm" onClick={() => del('videos', i)}>Buang</button></div>
            </div>
          );
        })}
        <div><button className="btn btn-sm" onClick={() => add('videos', { id: newId(), url: '', title: '' })}>+ Tambah video</button></div>
      </div>
    </div>
  );
}

// Owner-only account actions run server-side (supabase/functions/staff-admin): a
// browser cannot create logins. Every error comes back as a short code.
const STAFF_ERR = {
  not_owner: 'Hanya pemilik aktif boleh urus staf.',
  email_taken: 'Emel ini sudah ada akaun. Guna emel lain.',
  bad_email: 'Emel tidak sah.',
  bad_name: 'Isi nama staf.',
  weak_password: 'Kata laluan sekurang-kurangnya 8 aksara.',
  not_found: 'Staf tidak dijumpai.',
};
async function staffAdmin(body) {
  const { data, error } = await supabase.functions.invoke('staff-admin', { body });
  if (!error) return data;
  const code = await error.context?.json?.().then((j) => j?.error).catch(() => null);
  throw new Error(STAFF_ERR[code] || 'Gagal. Semak internet dan cuba lagi.');
}
// Easy to read out loud or type on a phone: no 0/O or 1/l look-alikes.
const tempPassword = () => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => a[n % a.length]).join('');
};

function AddStaff({ onDone, toast }) {
  const [f, setF] = useState({ name: '', email: '', password: tempPassword(), role: 'staff' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [made, setMade] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await staffAdmin({ action: 'create', ...f });
      setMade({ ...f }); setF({ name: '', email: '', password: tempPassword(), role: 'staff' }); onDone();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const login = `${location.origin}/staff/`;
  if (made) {
    const text = `Akaun staf Tinted Carstory\nLog masuk: ${login}\nEmel: ${made.email}\nKata laluan: ${made.password}`;
    return (
      <div className="card box">
        <div className="okline">{made.name} boleh log masuk sekarang</div>
        <div className="set-note">Beri butiran ini kepada {made.name}. Sebaik-baiknya beritahu secara bersemuka.</div>
        <div className="cred"><span>Log masuk</span><b>{login}</b><span>Emel</span><b>{made.email}</b><span>Kata laluan</span><b className="tab-num">{made.password}</b></div>
        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Disalin'))}>Salin butiran</button>
          <button className="btn btn-sm" onClick={() => setMade(null)}>Tambah seorang lagi</button>
        </div>
      </div>
    );
  }
  return (
    <form className="card box" onSubmit={submit}>
      <div className="micro">Tambah staf</div>
      <div className="grid2">
        <label className="fld"><span>Nama</span><input className="in" value={f.name} onChange={set('name')} maxLength={60} required /></label>
        <label className="fld"><span>Emel (untuk log masuk)</span><input className="in" type="email" value={f.email} onChange={set('email')} autoComplete="off" required /></label>
        <label className="fld"><span>Kata laluan sementara</span>
          <div style={{ display: 'flex', gap: 6 }}><input className="in tab-num" value={f.password} onChange={set('password')} minLength={8} maxLength={72} required autoComplete="off" />
            <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, password: tempPassword() })}>Jana</button></div></label>
        <label className="fld"><span>Peranan</span><select className="in" value={f.role} onChange={set('role')}>
          <option value="staff">Staf (tiada laporan / tetapan)</option><option value="owner">Pemilik (akses penuh)</option></select></label>
      </div>
      {err && <div className="warnline" role="alert">{err}</div>}
      <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Mencipta...' : 'Cipta akaun'}</button></div>
    </form>
  );
}

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
    const site = {
      services: s.site.services.filter((x) => (x.name || '').trim()).map((x) => ({ id: x.id || newId(), name: x.name.trim(), desc: (x.desc || '').trim(), price_from: numOrNull(x.price_from) })),
      team: s.site.team.filter((x) => (x.name || '').trim()).map((x) => ({ id: x.id || newId(), name: x.name.trim(), role: (x.role || '').trim(), bio: (x.bio || '').trim(), photo_url: x.photo_url || null })),
      videos: s.site.videos.filter((x) => (x.url || '').trim()).map((x) => ({ id: x.id || newId(), url: x.url.trim(), title: (x.title || '').trim() })),
    };
    if (site.videos.some((x) => !videoOf(x.url))) return fail('laman', 'Pautan video mesti YouTube atau TikTok.');
    setBusy(true);
    const { data, error } = await supabase.from('shop_settings').update({
      films, addons, site, slots: [...new Set(slots)].sort(), cars_per_slot: bays, online_per_slot: online,
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

  async function resetPassword(p) {
    const pw = tempPassword();
    if (!window.confirm(`Tetapkan kata laluan baru untuk ${p.name}? Kata laluan lama tidak boleh digunakan lagi.`)) return;
    try {
      await staffAdmin({ action: 'set_password', staff_id: p.id, password: pw });
      window.prompt(`Kata laluan baru ${p.name} (salin dan beritahu dia):`, pw);
    } catch (x) { toast(x.message); }
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

      {tab === 'laman' && <SiteEditor site={s.site} setSite={(site) => setS((p) => ({ ...p, site }))} toast={toast} />}

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
        <div className="set-grid">
          <AddStaff onDone={onSaved} toast={toast} />
          <div className="card rows">
            {staff.map((p) => (
              <div key={p.id} className="row row-act" style={{ cursor: 'default' }}>
                <span className="avatar">{(p.name || '?')[0].toUpperCase()}</span>
                <span className="row-main"><span className="row-title">{p.name}{p.id === me.id ? ' (anda)' : ''}</span>
                  <span className="row-sub">{p.role === 'owner' ? 'Pemilik' : 'Staf'}{p.active ? '' : ' · tidak aktif'}</span></span>
                {p.id !== me.id && (
                  <span className="row-actions">
                    <button className="btn btn-sm" onClick={() => resetPassword(p)}>Kata laluan baru</button>
                    <button className="btn btn-sm" onClick={() => toggleStaff(p)}>{p.active ? 'Nyahaktif' : 'Aktifkan'}</button>
                  </span>
                )}
              </div>
            ))}
            <div className="box" style={{ borderTop: '1px solid var(--line-2)' }}><div className="set-note">Nyahaktif serta-merta menyekat akses (rekod kerja mereka kekal). Staf lupa kata laluan? Tekan "Kata laluan baru" dan beritahu mereka.</div></div>
          </div>
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
