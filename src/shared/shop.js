// Every fact about the shop, in ONE place. Read by the static pages (at build,
// via vite.config.js), the page scripts, the staff app and the JSON-LD.
// Films + prices are NOT here: they live in the database (shop_settings.films)
// so the owner can edit them. catalog.default.json is only the build-time copy.
export const SHOP = {
  name: 'Tinted Carstory',
  legalName: 'Car Story Pro Auto',
  tagline: 'Kedai Tinted Bumiputera',
  street: '61, Jalan Sungai Jawi',
  postcode: '14200',
  town: 'Sungai Jawi',
  state: 'Pulau Pinang',
  mapsQuery: '61 Jalan Sungai Jawi 14200 Sungai Jawi Pulau Pinang',
  // From the shop signboard (owner's photo, 2026-09-27).
  contacts: [
    { name: 'Maliki', phone: '60175059882' },
    { name: 'Tam', phone: '60106530484' },
  ],
  // TODO(owner): opening hours. Empty = hours are not shown or claimed anywhere.
  // Shape: [{ days: ['Mo','Tu','We','Th','Fr','Sa'], opens: '09:30', closes: '18:30' }]
  hours: [],
  facebook: 'https://www.facebook.com/people/Tinted-Carstory-AUTO/100083588581977/',
  // TODO(owner): Google Business review link, e.g. https://g.page/r/XXXX/review
  googleReviewUrl: '',
  // TODO(owner): before/after photos, e.g. { src: '/gallery/myvi.webp', alt: 'Myvi, Nano Ceramic' }.
  // Empty = the gallery section is not rendered at all (no stock photos, ever).
  gallery: [],
  // Towns within a short drive; used for "kawasan" copy and JSON-LD areaServed.
  areaServed: ['Sungai Jawi', 'Sungai Bakap', 'Nibong Tebal', 'Simpang Ampat', 'Parit Buntar', 'Bandar Baharu'],
};

export const CAR_SIZES = [
  { id: 'small', label: 'Kecil', eg: 'Axia, Myvi, Saga, Iriz' },
  { id: 'sedan', label: 'Sedan', eg: 'Bezza, City, Vios, Persona' },
  { id: 'suv', label: 'SUV / MPV', eg: 'Ativa, X50, Alza, HR-V' },
  { id: 'large', label: 'Besar', eg: 'Hilux, Triton, Alphard, Vellfire' },
];

// JPJ limits, verified 2026-09-27 against published 2026 JPJ guidance:
// minimum light that must pass through glass + film combined (VLT).
export const JPJ = { windscreen: 70, frontSide: 50, fine: 'RM2,000 atau penjara 6 bulan' };

export const STAGES = [
  { id: 'baru', label: 'Baru', hint: 'Tempahan belum disahkan', color: '#2563eb' },
  { id: 'disahkan', label: 'Disahkan', hint: 'Slot disahkan dengan pelanggan', color: '#0891b2' },
  { id: 'dalam_kerja', label: 'Dalam kerja', hint: 'Kereta di kedai', color: '#d97706' },
  { id: 'siap', label: 'Siap', hint: 'Siap, tunggu bayaran', color: '#7c3aed' },
  { id: 'selesai', label: 'Selesai', hint: 'Dibayar penuh', color: '#16a34a' },
  { id: 'batal', label: 'Batal', hint: 'Tak jadi', color: '#9ca3af' },
];

export const waLink = (phone, text = '') =>
  `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const displayPhone = (p) => p.replace(/^60(\d{2})(\d{3,4})(\d{4})$/, '0$1-$2 $3');
export const fullAddress = () => `${SHOP.street}, ${SHOP.postcode} ${SHOP.town}, ${SHOP.state}`;
