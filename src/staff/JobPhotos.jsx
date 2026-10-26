// Photo proof for the certificate (0006_job_photos.sql): one slot per window plus the
// finished car. The installer photographs the VLT meter ON the glass; the photo shows on
// the customer's certificate beside the reading. A retake replaces the old photo.
// The photo's time is the server's upload time, never the phone's clock.
import { useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { DEMO } from '../shared/api.js';
import { JPJ } from '../shared/shop.js';

export const PHOTO_SLOTS = [
  { kind: 'windscreen', label: 'Cermin depan', min: JPJ.windscreen, vlt: 'vlt_windscreen', required: true },
  { kind: 'front', label: 'Sisi depan', min: JPJ.frontSide, vlt: 'vlt_front', required: true },
  { kind: 'rear', label: 'Belakang', min: 0, vlt: 'vlt_rear' },
  { kind: 'car', label: 'Kereta siap' },
];
// The windows JPJ sets a limit on: Siap asks before going ahead without them.
export const missingRequired = (photos) => PHOTO_SLOTS.filter((s) => s.required && !photos.some((p) => p.kind === s.kind));

const BUCKET = 'bukti';
const pathOf = (url) => String(url).split(`/object/public/${BUCKET}/`)[1];

// Shrunk on the phone (a 4 MB camera file becomes ~150 KB) and re-encoded, which also
// drops EXIF: no GPS or phone model ever leaves the device. 1280px keeps meter digits sharp.
async function shrink(file, max) {
  const img = await createImageBitmap(file);
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function upload(file) {
  if (DEMO) return (await shrink(file, 720)).toDataURL('image/webp', 0.7);
  const c = await shrink(file, 1280);
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.82));
  // A random name: the bucket can't be listed, so the URL is only known to whoever has
  // the certificate link (or staff).
  const path = `${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp' });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const time = (iso) => new Date(iso).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

export default function JobPhotos({ job, photos, setPhotos, form, toast }) {
  const [busy, setBusy] = useState('');
  const input = useRef(null);
  const target = useRef(null);

  function pick(kind) {
    target.current = kind;
    input.current.value = '';
    input.current.click();
  }

  async function onFile(e) {
    const file = e.target.files?.[0], kind = target.current;
    if (!file || !kind) return;
    setBusy(kind);
    let url = null;
    try {
      url = await upload(file);
      const old = photos.find((p) => p.kind === kind);
      if (old) {
        const { error } = await supabase.from('job_photos').delete().eq('id', old.id);
        if (error) throw error;
      }
      const { data, error } = await supabase.from('job_photos').insert({ job_id: job.id, kind, url }).select().single();
      if (error) throw error;
      if (old && pathOf(old.url)) supabase.storage.from(BUCKET).remove([pathOf(old.url)]).catch(() => {});
      setPhotos((cur) => [...cur.filter((p) => p.kind !== kind), data]);
      toast(old ? 'Foto diganti' : 'Foto disimpan');
    } catch {
      // The row didn't save: don't leave an orphan file behind.
      if (url && pathOf(url)) supabase.storage.from(BUCKET).remove([pathOf(url)]).catch(() => {});
      toast('Gagal muat naik foto. Cuba lagi.');
    } finally { setBusy(''); }
  }

  async function remove(p) {
    if (!window.confirm('Buang foto ini? Ia juga hilang dari sijil pelanggan.')) return;
    setBusy(p.kind);
    const { error } = await supabase.from('job_photos').delete().eq('id', p.id);
    setBusy('');
    if (error) return toast('Gagal buang foto.');
    if (pathOf(p.url)) supabase.storage.from(BUCKET).remove([pathOf(p.url)]).catch(() => {});
    setPhotos((cur) => cur.filter((x) => x.id !== p.id));
  }

  return (
    <div className="shots">
      <div className="shots-h"><span className="micro">Foto meter VLT</span>
        <span className="muted">{photos.length}/{PHOTO_SLOTS.length} · tampil di sijil pelanggan</span></div>
      <div className="shot-grid">
        {PHOTO_SLOTS.map((s) => {
          const p = photos.find((x) => x.kind === s.kind);
          const v = s.vlt ? form[s.vlt] : '';
          const reading = v !== '' && v !== null && v !== undefined ? `${v}%` : null;
          const fail = reading && s.min && Number(v) < s.min;
          return (
            <div key={s.kind} className={`shot-slot${p ? ' has' : ''}`}>
              <button type="button" className="shot-btn" disabled={busy === s.kind} onClick={() => pick(s.kind)}
                aria-label={`${p ? 'Ambil semula' : 'Ambil'} foto ${s.label}`}>
                {p ? <img src={p.url} alt="" loading="lazy" />
                  : <span className="shot-empty">
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                      {busy === s.kind ? 'Memuat naik...' : 'Ambil foto'}
                    </span>}
                {p && busy === s.kind && <span className="shot-busy">Memuat naik...</span>}
              </button>
              <div className="shot-meta">
                <b>{s.label}{s.required && !p ? <span className="shot-need"> · perlu</span> : ''}</b>
                <span className={fail ? 'warnline' : 'muted'}>{reading || (s.vlt ? 'Tiada bacaan' : 'Gambar penuh kereta')}</span>
                {p && <span className="muted">{time(p.created_at)} · <button type="button" className="linkbtn" onClick={() => remove(p)}>Buang</button></span>}
              </div>
            </div>
          );
        })}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
  );
}
