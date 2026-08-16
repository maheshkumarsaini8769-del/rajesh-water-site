/* ============================================================
   Rajesh Water — Product Catalog (single source of truth)
   Add / edit products here. Images repeat across sizes —
   swap src for real brand photos later.
   NOTE: if data/site-data.js loaded first (admin-managed
   catalog), its PRODUCTS win and this file is a no-op.
   ============================================================ */
if (!window.PRODUCTS) {
window.PRODUCTS = [
  /* ---------- Water bottles ---------- */
  { id: 'p001', name: 'Bisleri', label: 'Bisleri 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 20, boxSize: 12, minBoxes: 1, img: '../images/bisleri.png', badge: 'Bestseller', featured: true },
  { id: 'p002', name: 'Bisleri', label: 'Bisleri 500 ML', size: '500 ML', category: 'Premium Water', price: 10, boxSize: 24, minBoxes: 1, img: '../images/bisleri.png' },
  { id: 'p003', name: 'Bisleri', label: 'Bisleri 200 ML', size: '200 ML', category: 'Premium Water', price: 1, boxSize: 78, minBoxes: 4, img: '../images/bisleri.png' },
  { id: 'p004', name: 'Kinley', label: 'Kinley 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 20, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-1.png' },
  { id: 'p005', name: 'Kinley', label: 'Kinley 500 ML', size: '500 ML', category: 'Premium Water', price: 10, boxSize: 24, minBoxes: 1, img: '../images/bottle-new-1.png' },
  { id: 'p006', name: 'Aquafina', label: 'Aquafina 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 20, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-1.png', featured: true },
  { id: 'p007', name: 'Aquafina', label: 'Aquafina 500 ML', size: '500 ML', category: 'Premium Water', price: 12, boxSize: 24, minBoxes: 1, img: '../images/bottle-v2-1.png' },
  { id: 'p008', name: 'Himalayan', label: 'Himalayan 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 30, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-2.png', badge: 'Premium' },
  { id: 'p009', name: 'Himalayan', label: 'Himalayan 500 ML', size: '500 ML', category: 'Premium Water', price: 15, boxSize: 24, minBoxes: 1, img: '../images/bottle-new-2.png' },
  { id: 'p010', name: 'Rail Neer', label: 'Rail Neer 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 15, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-2.png' },
  { id: 'p011', name: 'Oxyrich', label: 'Oxyrich 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 20, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-3.png' },
  { id: 'p012', name: 'Kingfisher', label: 'Kingfisher 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 25, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-3.png' },
  { id: 'p013', name: 'Bailey', label: 'Bailey 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 25, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-4.png' },
  { id: 'p014', name: 'Manikchand', label: 'Manikchand 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 20, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-4.png' },
  { id: 'p015', name: 'Spring Pure', label: 'Spring Pure 1 LITRE', size: '1 LITRE', category: 'Premium Water', price: 18, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-5.png' },
  { id: 'p016', name: 'Aqua Fresh', label: 'Aqua Fresh 500 ML', size: '500 ML', category: 'Premium Water', price: 9, boxSize: 24, minBoxes: 1, img: '../images/bottle-v2-5.png' },
  { id: 'p017', name: 'Cool Valley', label: 'Cool Valley 2 LITRE', size: '2 LITRE', category: 'Premium Water', price: 35, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-5.png' },
  { id: 'p018', name: 'Jal Pure', label: 'Jal Pure 2 LITRE', size: '2 LITRE', category: 'Premium Water', price: 35, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-2.png' },
  { id: 'p019', name: 'Kingfisher', label: 'Kingfisher 2 LITRE', size: '2 LITRE', category: 'Premium Water', price: 45, boxSize: 12, minBoxes: 1, img: '../images/bottle-v2-3.png' },
  { id: 'p020', name: 'Himalayan', label: 'Himalayan 2 LITRE', size: '2 LITRE', category: 'Premium Water', price: 55, boxSize: 12, minBoxes: 1, img: '../images/bottle-new-2.png' },

  /* ---------- Cold drinks ---------- */
  { id: 'p021', name: 'Coca-Cola', label: 'Coca-Cola 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/coke.png', badge: 'Bestseller', featured: true },
  { id: 'p022', name: 'Pepsi', label: 'Pepsi 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/pepsi.png' },
  { id: 'p023', name: 'Sprite', label: 'Sprite 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/sprite.png' },
  { id: 'p024', name: 'Fanta', label: 'Fanta 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/fanta.png' },
  { id: 'p025', name: 'Mountain Dew', label: 'Mountain Dew 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/dew.png' },
  { id: 'p026', name: 'Thums Up', label: 'Thums Up 750 ML', size: '750 ML', category: 'Cold Drinks', price: 45, boxSize: 12, minBoxes: 1, img: '../images/coke.png' },
  { id: 'p027', name: 'Limca', label: 'Limca 750 ML', size: '750 ML', category: 'Cold Drinks', price: 35, boxSize: 12, minBoxes: 1, img: '../images/sprite.png' },
  { id: 'p028', name: '7UP', label: '7UP 750 ML', size: '750 ML', category: 'Cold Drinks', price: 40, boxSize: 12, minBoxes: 1, img: '../images/pepsi.png' },
  { id: 'p029', name: 'Mirinda', label: 'Mirinda 750 ML', size: '750 ML', category: 'Cold Drinks', price: 35, boxSize: 12, minBoxes: 1, img: '../images/dew.png' },
  { id: 'p030', name: 'Sting', label: 'Sting 500 ML', size: '500 ML', category: 'Cold Drinks', price: 25, boxSize: 12, minBoxes: 1, img: '../images/dew.png', featured: true },
  { id: 'p031', name: 'Appy Fizz', label: 'Appy Fizz 750 ML', size: '750 ML', category: 'Cold Drinks', price: 45, boxSize: 12, minBoxes: 1, img: '../images/fanta.png' },
  { id: 'p032', name: 'Maaza', label: 'Maaza 1 LITRE', size: '1 LITRE', category: 'Cold Drinks', price: 50, boxSize: 12, minBoxes: 1, img: '../images/coke.png' },
];
}