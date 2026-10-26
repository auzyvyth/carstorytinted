// "Simpan gambar": the receipt / certificate as one PNG the customer keeps in their
// gallery. Drawn straight onto a canvas (no library, no screenshot of the page), so it
// looks the same on every phone and never picks up the site header or buttons.
// Phones get the share sheet (Save image / WhatsApp); desktops get a download.
import { SHOP, JPJ, fullAddress } from '../shared/shop.js';

const W = 1080, PAD = 72;
const C = { ink: '#0a0a0a', text: '#1f2733', muted: '#6b7280', line: '#eceaea', accent: '#1d3fc4', ok: '#15803d', bad: '#b91c1c' };
const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

// blocks: [{ heading?: 'Resit', rows: [[label, value, tone?]], note?: '...' }]
// tone: 'ok' | 'bad' | undefined (colours the value, e.g. "Lulus JPJ" / "Bawah had")
function draw(ctx, { title, ref, customer, blocks }, measureOnly = false) {
  let y = PAD;
  const put = (fn) => { if (!measureOnly) fn(); };
  // brand: blue "Tinted" + ink "Carstory", reference on the right
  put(() => {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 52px ${FONT}`; ctx.fillStyle = C.accent; ctx.fillText('Tinted', PAD, y + 44);
    const w = ctx.measureText('Tinted ').width;
    ctx.fillStyle = C.ink; ctx.fillText('Carstory', PAD + w, y + 44);
    ctx.font = `500 30px ${FONT}`; ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(`No. ${ref}`, W - PAD, y + 40); ctx.textAlign = 'left';
  });
  y += 72;
  put(() => { const g = ctx.createLinearGradient(PAD, 0, W - PAD, 0); ['#1d3fc4', '#3b6cf0', '#f47b20', '#ffc71a'].forEach((c, i) => g.addColorStop(i / 3, c)); ctx.fillStyle = g; ctx.fillRect(PAD, y, W - 2 * PAD, 5); });
  y += 56;
  put(() => { ctx.font = `700 26px ${FONT}`; ctx.fillStyle = C.accent; ctx.fillText(title.toUpperCase(), PAD, y); });
  y += 50;
  if (customer) { put(() => { ctx.font = `800 46px ${FONT}`; ctx.fillStyle = C.ink; ctx.fillText(customer, PAD, y); }); y += 30; }
  for (const b of blocks) {
    if (!b.rows?.length && !b.note) continue;
    // A heading needs clear air above it, or it reads as part of the row before.
    y += b.heading ? 92 : 34;
    if (b.heading) { put(() => { ctx.font = `700 24px ${FONT}`; ctx.fillStyle = C.accent; ctx.fillText(b.heading.toUpperCase(), PAD, y); }); y += 6; }
    for (const [label, value, tone] of b.rows || []) {
      y += 56;
      // A long value (film + several add-ons) drops to its own line instead of
      // running into the label. Measured in both passes, so the height is right.
      ctx.font = `500 32px ${FONT}`; const lw = ctx.measureText(label).width;
      ctx.font = `700 32px ${FONT}`; const vw = ctx.measureText(String(value)).width;
      const wrap = lw + vw + 32 > W - 2 * PAD;
      const ly = y;
      if (wrap) y += 46;
      put(() => {
        ctx.font = `500 32px ${FONT}`; ctx.fillStyle = C.muted; ctx.fillText(label, PAD, ly);
        ctx.font = `700 32px ${FONT}`; ctx.fillStyle = tone ? C[tone] : C.ink; ctx.textAlign = 'right';
        ctx.fillText(String(value), W - PAD, y, W - 2 * PAD); ctx.textAlign = 'left';
        ctx.fillStyle = C.line; ctx.fillRect(PAD, y + 22, W - 2 * PAD, 2);
      });
    }
    if (b.note) { y += 58; put(() => { ctx.font = `600 30px ${FONT}`; ctx.fillStyle = C.ok; ctx.fillText(b.note, PAD, y); }); }
  }
  y += 80;
  put(() => {
    ctx.font = `500 24px ${FONT}`; ctx.fillStyle = C.muted;
    ctx.fillText(`${SHOP.legalName} · ${SHOP.name}`, PAD, y);
    ctx.fillText(fullAddress(), PAD, y + 36);
  });
  return y + 36 + PAD;
}

export async function saveImage(doc, fileName) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const H = draw(ctx, doc, true);
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  draw(ctx, doc);
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

// VLT readings as image rows, same verdicts as vltRows() on the page.
export function vltData(c) {
  return [['Cermin depan', c.vlt_windscreen, JPJ.windscreen], ['Tingkap sisi depan', c.vlt_front, JPJ.frontSide], ['Belakang', c.vlt_rear, 0]]
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([label, v, min]) => [label, `${v}%  ${min ? (v >= min ? 'Lulus JPJ' : 'Bawah had') : 'Tiada had'}`, min ? (v >= min ? 'ok' : 'bad') : undefined]);
}
