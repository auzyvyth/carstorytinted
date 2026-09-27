// ONE place for every fact about the shop. The website and the CRM both read it.
// Anything marked TODO was NOT verifiable online (their Facebook/Linktree could
// not be read) — confirm with the owner before this goes live. Never publish a
// price, phone or review that the owner has not given us.
window.SHOP = {
  name: 'Carstory Pro Auto',
  tagline: 'Tinted Bumiputera',
  // Verified via search listing: 61, Jln Sungai Jawi, 14200 Sungai Jawi, Pulau Pinang
  address: '61, Jalan Sungai Jawi, 14200 Sungai Jawi, Pulau Pinang',
  mapsQuery: '61 Jalan Sungai Jawi 14200 Sungai Jawi Pulau Pinang',
  // TODO: owner's WhatsApp number in 60xxxxxxxxx form. Empty = WhatsApp buttons hide.
  whatsapp: '',
  // TODO: confirm opening hours
  hours: 'Isnin - Sabtu, 9:30 pagi - 7:00 petang',
  facebook: 'https://www.facebook.com/people/Tinted-Carstory-AUTO/100083588581977/',
  linktree: 'https://linktr.ee/carstoryproauto1988',
  tiktok: '', // TODO

  // Film ranges. Prices are "from" prices for a standard sedan, full car.
  // TODO: every price below is 0 until the owner gives real numbers — a 0 price
  // renders "Tanya harga" instead of a figure.
  films: [
    { id: 'basic',   name: 'Standard',      heat: 'Tolak haba asas',   warrantyYears: 3,  price: 0 },
    { id: 'ceramic', name: 'Nano Ceramic',  heat: 'Tolak haba tinggi', warrantyYears: 5,  price: 0 },
    { id: 'premium', name: 'Premium IR',    heat: 'Tolak haba maksimum', warrantyYears: 7, price: 0 },
  ],
  // Size multiplier on the base price. Owner can tune.
  carSizes: [
    { id: 'small', label: 'Kecil (Axia, Myvi, Saga)', factor: 1 },
    { id: 'sedan', label: 'Sedan (Bezza, City, Vios)', factor: 1.15 },
    { id: 'suv',   label: 'SUV / MPV (Ativa, X50, Alza)', factor: 1.35 },
    { id: 'large', label: 'Besar (Hilux, Alphard, Vellfire)', factor: 1.6 },
  ],
  otherServices: [
    'Tinted rumah & pejabat',
    'Buang tinted lama',
    'Tinted cermin depan sahaja',
  ],
};

// JPJ limits (verified 2026-09-27 against published 2026 JPJ guides):
// VLT = light that passes through glass + film combined.
window.JPJ = {
  windscreen: 70, // front windscreen: at least 70% light through
  frontSide: 50,  // front side windows: at least 50%
  rear: 0,        // rear side + rear windscreen: no minimum
  fine: 'Denda sehingga RM2,000 atau penjara 6 bulan (kesalahan pertama)',
};
