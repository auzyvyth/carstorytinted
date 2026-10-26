// "Simpan gambar": the certificate (and receipt) as one PNG the customer keeps in their
// gallery. Drawn straight onto a canvas (no library, no screenshot of the page), so it
// looks the same on every phone and never picks up the site header or buttons.
// Phones get the share sheet (Save image / WhatsApp); desktops get a download.
// Look = design C, the same as the certificate page: the site blue with its two soft
// lights, the finished car on top, the readings over the top-down car, the meter photos,
// the warranty ring. Wording follows render.js: "Dalam had", never "Lulus JPJ".
import { SHOP, JPJ, fullAddress } from '../shared/shop.js';
import { VLT_WINDOWS, verdictOf, VERDICT_WORD, MEETS_JPJ, jpjSummary, carPlanSvg } from '../shared/render.js';
import { dateLabel } from '../shared/api.js';

const W = 1080, PAD = 64;
const C = { ink: '#ffffff', dim: 'rgba(255,255,255,.68)', faint: 'rgba(255,255,255,.12)', panel: 'rgba(255,255,255,.07)',
  y: '#ffc71a', ok: '#4ade80', bad: '#fca5a5', card: '#ffffff', cardInk: '#0b1231', cardDim: '#5b6475' };
const BODY = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
const DISPLAY = "'Exo 2', 'Plus Jakarta Sans', system-ui, sans-serif";
const SAFE_URL = /^(https:|data:image\/|\/)/;

// ---------------------------------------------------------------- helpers
function ground(ctx, h) {
  const g = ctx.createLinearGradient(0, 0, W * 0.35, h);
  g.addColorStop(0, '#0b1231'); g.addColorStop(0.55, '#101b48'); g.addColorStop(1, '#15276c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  const glow = (x, y, r, col) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, h); };
  glow(W * 0.5, h + 60, 620, 'rgba(244,123,32,.30)');
  glow(W + 40, 120, 520, 'rgba(59,108,240,.40)');
}
function round(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function text(ctx, s, x, y, { size = 30, weight = 500, color = C.ink, font = BODY, align = 'left', max } = {}) {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(s), x, y, max); ctx.textAlign = 'left';
}
// Wrap a sentence into lines that fit `max` px; returns the lines.
function lines(ctx, s, max, size, weight = 500) {
  ctx.font = `${weight} ${size}px ${BODY}`;
  const out = []; let cur = '';
  for (const w of String(s).split(' ')) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
// A photo for the canvas. Supabase Storage answers with CORS headers, so the canvas
// stays exportable; anything that fails to load is simply left out.
function loadImage(url) {
  return new Promise((res) => {
    if (!url || !SAFE_URL.test(String(url))) return res(null);
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => res(img); img.onerror = () => res(null); img.src = url;
  });
}
function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
// The certificate's own top-down car (render.js carPlanSvg), drawn from its path data.
function drawPlan(ctx, x, y, w) {
  const svg = carPlanSvg(null), s = w / 360, h = 142 * s;
  ctx.save(); ctx.translate(x, y - 14 * s); ctx.scale(s, s);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const fill = { 'pp-body': '#e9eef8', 'pp-roof': '#f6f8fc', 'pp-mirror': '#c9d3e6', 'pp-glass': 'rgba(29,63,196,.55)' };
  for (const el of doc.documentElement.children) {
    ctx.fillStyle = fill[el.getAttribute('class')?.split(' ')[0]] || '#e9eef8';
    if (el.tagName === 'path') ctx.fill(new Path2D(el.getAttribute('d')));
    else if (el.tagName === 'rect') { ctx.beginPath(); ctx.roundRect(+el.getAttribute('x'), +el.getAttribute('y'), +el.getAttribute('width'), +el.getAttribute('height'), +el.getAttribute('rx')); ctx.fill(); }
    else if (el.tagName === 'ellipse') { ctx.beginPath(); ctx.ellipse(+el.getAttribute('cx'), +el.getAttribute('cy'), +el.getAttribute('rx'), +el.getAttribute('ry'), 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  return h;
}

async function share(canvas, fileName) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], fileName, { type: 'image/png' });
  // Phones: the share sheet has "Save image" and WhatsApp. A cancelled share is fine.
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title: fileName }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------------------------------------------------------------- the certificate
// c: the get_certificate / get_booking answer. receipt (optional): [[label, value, tone]]
// rows shown in a white card under the certificate (the customer page's "resit + sijil").
function drawCert(ctx, c, imgs, receipt, measure) {
  const put = (fn) => { if (!measure) fn(); };
  const hasYears = c.warranty_until && c.completed_at;
  const years = hasYears ? Math.round((Date.parse(c.warranty_until) - Date.parse(c.completed_at)) / (365.25 * 864e5)) : null;
  let y = 0;
  // 1. the finished car, fading into the blue; else a plain top
  if (imgs.car) {
    const h = 620;
    put(() => {
      cover(ctx, imgs.car, 0, 0, W, h);
      const f = ctx.createLinearGradient(0, h * 0.45, 0, h); f.addColorStop(0, 'rgba(11,18,49,0)'); f.addColorStop(1, 'rgba(11,18,49,1)');
      ctx.fillStyle = f; ctx.fillRect(0, 0, W, h);
    });
    y = h - 150;
  } else y = PAD + 30;
  put(() => text(ctx, `PASPORT TINT · NO. ${c.ref}`, PAD, y, { size: 24, weight: 700, color: C.y }));
  y += 76;
  put(() => text(ctx, c.car_model || 'Sijil pemasangan tinted', PAD, y, { size: 72, weight: 800, font: DISPLAY, max: W - 2 * PAD }));
  y += 52;
  put(() => text(ctx, [c.plate, c.film, c.completed_at && dateLabel(c.completed_at)].filter(Boolean).join(' · '), PAD, y, { size: 30, color: C.dim, max: W - 2 * PAD }));
  if (c.customer) { y += 44; put(() => text(ctx, `Untuk ${c.customer}`, PAD, y, { size: 28, color: C.dim })); }

  // 2. the readings over the car
  y += 48;
  const panelTop = y, sum = jpjSummary(c), anyReading = VLT_WINDOWS.some((w) => c[w.key] !== null && c[w.key] !== undefined);
  let py = panelTop + 64;
  const panelBody = () => {
    if (sum) put(() => text(ctx, sum === 'ok' ? `✓  ${MEETS_JPJ}` : 'Ada cermin di bawah had JPJ semasa diukur', W / 2, py, { size: 30, weight: 700, color: sum === 'ok' ? C.ok : C.bad, align: 'center' }));
    py += sum ? 70 : 10;
    if (anyReading) {
      const cols = [PAD + 48, W / 2, W - PAD - 48], align = ['left', 'center', 'right'];
      VLT_WINDOWS.forEach((w, i) => {
        const v = c[w.key], vd = verdictOf(v, w.min);
        put(() => {
          text(ctx, w.short, cols[i], py, { size: 24, color: C.dim, align: align[i] });
          text(ctx, v === null || v === undefined ? '-' : `${v}%`, cols[i], py + 50, { size: 46, weight: 800, color: vd === 'ok' ? C.ok : vd === 'bad' ? C.bad : C.ink, align: align[i] });
          if (vd && vd !== 'free') text(ctx, VERDICT_WORD[vd], cols[i], py + 86, { size: 22, color: C.dim, align: align[i] });
        });
      });
      py += 124;
      const pw = 620, ph = measure ? 142 * pw / 360 : drawPlan(ctx, (W - pw) / 2, py, pw);
      py += ph + 24;
    } else { put(() => text(ctx, 'Bacaan VLT tidak direkodkan untuk kerja ini.', W / 2, py + 20, { size: 28, color: C.dim, align: 'center' })); py += 60; }
    // meter photos, up to three, with the window and time
    const shots = VLT_WINDOWS.map((w) => [w, imgs[w.kind], (c.photos || []).find((p) => p.kind === w.kind)]).filter(([, im]) => im);
    if (shots.length) {
      const gap = 20, sw = (W - 2 * PAD - 2 * 36 - gap * 2) / 3, sh = sw * 0.75;
      shots.forEach(([w, im, p], i) => {
        const sx = PAD + 36 + i * (sw + gap);
        put(() => {
          ctx.save(); ctx.beginPath(); ctx.roundRect(sx, py, sw, sh, 14); ctx.clip(); cover(ctx, im, sx, py, sw, sh); ctx.restore();
          const t = /T(\d{2}:\d{2})/.exec(String(p?.at || ''))?.[1];
          text(ctx, `${w.short}${c[w.key] !== null && c[w.key] !== undefined ? ` ${c[w.key]}%` : ''}${t ? ` · ${t}` : ''}`, sx, py + sh + 34, { size: 22, color: C.dim, max: sw });
        });
      });
      py += sh + 60;
    }
    if (c.installer) { put(() => text(ctx, `Diukur oleh ${c.installer}`, W / 2, py + 26, { size: 24, color: C.dim, align: 'center' })); py += 56; }
    py += 20;
  };
  // Measure the panel's height first, then paint it behind its contents.
  const real = measure; measure = true; const save = py; panelBody(); const panelH = py - panelTop; py = save; measure = real;
  put(() => round(ctx, PAD - 16, panelTop, W - 2 * (PAD - 16), panelH, 28, C.panel));
  panelBody();
  y = panelTop + panelH + 28;

  // 3. warranty
  const wy = y;
  put(() => {
    round(ctx, PAD - 16, wy, W - 2 * (PAD - 16), 150, 28, C.panel);
    ctx.beginPath(); ctx.arc(PAD + 72, wy + 75, 46, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = C.y; ctx.stroke();
    text(ctx, years >= 1 ? String(years) : '?', PAD + 72, wy + 82, { size: 36, weight: 800, align: 'center' });
    if (years >= 1) text(ctx, 'thn', PAD + 72, wy + 104, { size: 16, color: C.dim, align: 'center' });
    text(ctx, years >= 1 ? `Waranti ${years} tahun` : 'Waranti', PAD + 150, wy + 66, { size: 34, weight: 700 });
    text(ctx, c.warranty_until ? `Hingga ${dateLabel(c.warranty_until)}` : 'Tempoh waranti: rujuk kedai', PAD + 150, wy + 108, { size: 28, color: C.dim });
  });
  y = wy + 150 + 28;

  // 4. receipt (customer page only), as a white card
  if (receipt?.length) {
    const ry = y, rowH = 64, rh = 90 + receipt.length * rowH;
    put(() => {
      round(ctx, PAD - 16, ry, W - 2 * (PAD - 16), rh, 28, C.card);
      text(ctx, 'Resit', PAD + 20, ry + 62, { size: 32, weight: 800, color: C.cardInk });
      receipt.forEach(([k, v, tone], i) => {
        const ly = ry + 120 + i * rowH;
        text(ctx, k, PAD + 20, ly, { size: 28, color: C.cardDim, max: 520 });
        text(ctx, v, W - PAD - 20, ly, { size: 30, weight: 700, color: tone === 'bad' ? '#b91c1c' : tone === 'ok' ? '#15803d' : C.cardInk, align: 'right', max: 420 });
      });
    });
    y = ry + rh + 28;
  }

  // 5. fine print + shop
  const fine = lines(ctx, `Bacaan diukur pada cermin kilang dan filem bersama, selepas pasang.${(c.photos || []).length ? ' Masa pada foto dicatat oleh sistem semasa dimuat naik.' : ''} Sijil ini rekod kedai, bukan dokumen JPJ.`, W - 2 * PAD, 22);
  y += 16;
  fine.forEach((l) => { put(() => text(ctx, l, PAD, y, { size: 22, color: C.dim })); y += 34; });
  y += 14;
  put(() => text(ctx, `${SHOP.legalName} · ${fullAddress()}`, PAD, y, { size: 22, color: C.dim, max: W - 2 * PAD }));
  return y + PAD;
}

export async function saveCertImage(c, fileName, { receipt = null } = {}) {
  await document.fonts?.ready;
  const urls = Object.fromEntries((c.photos || []).map((p) => [p.kind, p.url]));
  const imgs = Object.fromEntries(await Promise.all(['car', ...VLT_WINDOWS.map((w) => w.kind)].map(async (k) => [k, await loadImage(urls[k])])));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = 10;
  const H = drawCert(ctx, c, imgs, receipt, true);
  canvas.width = W; canvas.height = H;
  ground(ctx, H);
  drawCert(ctx, c, imgs, receipt, false);
  await share(canvas, fileName);
}

// ---------------------------------------------------------------- before the car is done
// The booking / price as one image (customer page, not yet done): the same blue, one card.
// blocks: [{ heading?: 'Harga', rows: [[label, value, tone?]], note?: '...' }]
export async function saveImage({ title, ref, customer, blocks }, fileName) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const rows = blocks.flatMap((b) => [...(b.heading ? [[b.heading, null, 'h']] : []), ...(b.rows || [])]);
  const H = PAD + 200 + rows.length * 66 + 160;
  canvas.width = W; canvas.height = H;
  ground(ctx, H);
  text(ctx, `${title.toUpperCase()} · NO. ${ref}`, PAD, PAD + 30, { size: 24, weight: 700, color: C.y });
  text(ctx, customer ? `Salam, ${customer}` : SHOP.name, PAD, PAD + 110, { size: 64, weight: 800, font: DISPLAY, max: W - 2 * PAD });
  let y = PAD + 200;
  round(ctx, PAD - 16, y - 20, W - 2 * (PAD - 16), rows.length * 66 + 40, 28, C.card);
  for (const [k, v, tone] of rows) {
    y += 44;
    if (tone === 'h') text(ctx, k, PAD + 20, y, { size: 26, weight: 800, color: C.cardInk });
    else {
      text(ctx, k, PAD + 20, y, { size: 28, color: C.cardDim, max: 480 });
      text(ctx, v, W - PAD - 20, y, { size: 30, weight: 700, color: tone === 'bad' ? '#b91c1c' : C.cardInk, align: 'right', max: 460 });
    }
    y += 22;
  }
  text(ctx, `${SHOP.legalName} · ${fullAddress()}`, PAD, H - PAD, { size: 22, color: C.dim, max: W - 2 * PAD });
  await share(canvas, fileName);
}

// VLT readings as rows, same verdicts as the certificate (verdictOf in render.js).
export function vltData(c) {
  return [['Cermin depan', c.vlt_windscreen, JPJ.windscreen], ['Tingkap sisi depan', c.vlt_front, JPJ.frontSide], ['Belakang', c.vlt_rear, 0]]
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([label, v, min]) => [label, `${v}%  ${min ? (v >= min ? 'Dalam had' : 'Bawah had') : 'Tiada had'}`, min ? (v >= min ? 'ok' : 'bad') : undefined]);
}
