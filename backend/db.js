/* db.js — MongoDB Atlas persistence layer (Mongoose)
   Source of truth: MongoDB. JSON files act only as an offline fallback.
   Connection string: process.env.MONGODB_URI (.env file, never in frontend). */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

var state = { on: false, connecting: false, error: null, lastSave: null, lastError: null };

function markError(tag, err) {
  var msg = (err && err.message) ? err.message : String(err);
  state.lastError = { at: Date.now(), tag: tag, error: msg.slice(0, 300) };
  console.log('[mongo] ' + tag + ' error: ' + msg.slice(0, 200));
}
function markOk() {
  state.on = true;
  state.error = null;
  state.lastSave = Date.now();
}

/* ---------- Schemas (validation at the edges; strict:false preserves existing shapes) ---------- */

var orderItemSchema = new mongoose.Schema({
  id: String, name: { type: String, default: '' }, size: String,
  qty: { type: Number, min: 1, max: 200, default: 1 },
  boxes: { type: Number, min: 0, default: 0 },
  bottles: { type: Number, min: 0, default: 0 },
  bottlesPerBox: { type: Number, min: 1, default: 12 },
  price: { type: Number, min: 0, default: 0 },
  lineTotal: { type: Number, min: 0, default: 0 }
}, { strict: false });

var orderSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  seq: { type: Number, required: true },
  name: { type: String, required: true, maxlength: 120 },
  phone: { type: String, required: true, match: /^[6-9]\d{9}$/, maxlength: 10 },
  address: { type: String, required: true, maxlength: 500 },
  city: { type: String, required: true, maxlength: 80 },
  pincode: { type: String, required: true, match: /^\d{6}$/, maxlength: 6 },
  items: { type: [orderItemSchema], default: [] },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, default: 'received' },
  createdAt: { type: Number, required: true }
}, { strict: false, timestamps: false, _id: false });

/* One canonical document per store (fixed String _id) — mirrors the file format 1:1. */
var ordersDocSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 10000 },
  orders: { type: [orderSchema], default: [] }
}, { strict: false });
var OrderDoc = mongoose.model('OrdersDoc', ordersDocSchema);

var bizItemSchema = new mongoose.Schema({
  id: String, name: String, brand: String, category: String, size: String,
  bottlesPerBox: { type: Number, min: 1, default: 12 },
  price: { type: Number, min: 0, default: 0 },
  cost: { type: Number, min: 0, default: 0 },
  units: { type: String, default: 'box' },
  stock: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 }
}, { strict: false });
var bizSaleSchema = new mongoose.Schema({
  id: String, ref: String, customer: String, phone: String,
  productId: String, product: String, size: String,
  boxes: { type: Number, min: 0, default: 0 },
  bottles: { type: Number, min: 0, default: 0 },
  bottlesPerBox: { type: Number, min: 1, default: 12 },
  pricePerBox: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  cost: { type: Number, min: 0, default: 0 },
  profit: Number, payment: String, paid: Number,
  status: { type: String, default: 'completed' },
  source: { type: String, default: 'manual' },
  notes: String, date: String, at: Number
}, { strict: false });

var bizDocSchema = new mongoose.Schema({
  _id: String,
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  products: { type: [bizItemSchema], default: [] },
  purchases: { type: Array, default: [] },
  sales: { type: [bizSaleSchema], default: [] },
  adjustments: { type: Array, default: [] },
  pendingOrders: { type: Array, default: [] },
  opened: Number
}, { strict: false });
var BizDoc = mongoose.model('BizDoc', bizDocSchema);

var reviewSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 60 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, maxlength: 800 },
  product: { type: String, default: '' },
  date: { type: String, default: '' },
  at: Number
}, { strict: false, _id: false });
var reviewsDocSchema = new mongoose.Schema({ _id: String, list: { type: [reviewSchema], default: [] } }, { strict: false });
var ReviewDoc = mongoose.model('ReviewDoc', reviewsDocSchema);

var siteDocSchema = new mongoose.Schema({ _id: String, data: { type: mongoose.Schema.Types.Mixed, default: {} } }, { strict: false });
var SiteDoc = mongoose.model('SiteDoc', siteDocSchema);

/* Truecaller verification state - persisted so serverless instances share it */
var tcStateSchema = new mongoose.Schema({ _id: String, data: { type: mongoose.Schema.Types.Mixed, default: {} } }, { strict: false });
var TcStateDoc = mongoose.model('TcStateDoc', tcStateSchema);

async function saveTcState(obj) {
  await upsert(TcStateDoc, 'tcstate', { _id: 'tcstate', data: obj || {} });
  markOk();
}
async function loadTcState() {
  var d = await getDoc(TcStateDoc, 'tcstate');
  return (d && d.data) || null;
}

/* ---------- Validation helpers (throw with a readable message) ---------- */

function checkOrdersDoc(d) {
  if (!d || typeof d !== 'object') throw new Error('orders doc must be an object');
  if (!Array.isArray(d.orders)) throw new Error('orders.orders must be an array');
  d.orders.slice(0, 5).forEach(function (o) {
    if (!o || typeof o.id !== 'string' || !o.id) throw new Error('order missing id');
    if (!o.name) throw new Error('order ' + o.id + ' missing name');
    if (!/^[6-9]\d{9}$/.test(String(o.phone))) throw new Error('order ' + o.id + ' bad phone');
    if (!o.address || !o.city) throw new Error('order ' + o.id + ' missing address');
    if (!Array.isArray(o.items)) throw new Error('order ' + o.id + ' missing items');
    if (typeof o.total !== 'number' || o.total < 0) throw new Error('order ' + o.id + ' bad total');
  });
  return true;
}
function checkBizDoc(b) {
  if (!b || typeof b !== 'object') throw new Error('biz doc must be an object');
  if (!Array.isArray(b.products)) throw new Error('biz.products must be an array');
  b.products.slice(0, 5).forEach(function (p) {
    if (!p || typeof p.id !== 'string' || !p.id) throw new Error('product missing id');
    if (!p.name) throw new Error('product missing name');
    var pp = Number(p.price); var cp = Number(p.cost);
    if (isNaN(pp) || pp < 0) throw new Error('product ' + p.name + ' bad price');
    if (isNaN(cp) || cp < 0) throw new Error('product ' + p.name + ' bad cost');
  });
  return true;
}
function checkReviewsDoc(r) {
  if (!Array.isArray(r)) throw new Error('reviews must be an array');
  r.slice(0, 5).forEach(function (x) {
    if (!x || !x.id || !x.name || !x.text) throw new Error('review missing id/name/text');
    var rt = Number(x.rating);
    if (isNaN(rt) || rt < 1 || rt > 5) throw new Error('review ' + x.id + ' rating must be 1-5');
  });
  return true;
}
function checkSiteData(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('site data must be an object');
  return true;
}

/* ---------- Read/write helpers (upsert canonical docs) ---------- */

var upsert = function (Model, fixedId, obj) {
  return Model.replaceOne({ _id: fixedId }, obj, { upsert: true });
};
var getDoc = function (Model, fixedId) {
  return Model.findById(fixedId).lean();
};

async function saveOrders(d) {
  checkOrdersDoc(d);
  var final = { _id: 'orders', seq: Number(d.seq) || 10000, orders: d.orders || [] };
  await upsert(OrderDoc, 'orders', final);
  markOk();
}
async function loadOrders() {
  var d = await getDoc(OrderDoc, 'orders');
  if (d) { d.seq = Number(d.seq) || 10000; return d; }
  return null;
}
async function saveBiz(b) {
  checkBizDoc(b);
  var final = Object.assign({ _id: 'biz' }, b);
  await upsert(BizDoc, 'biz', final);
  markOk();
}
async function loadBiz() {
  var d = await getDoc(BizDoc, 'biz');
  return d || null;
}
async function saveReviews(list) {
  checkReviewsDoc(list);
  await upsert(ReviewDoc, 'reviews', { _id: 'reviews', list: list || [] });
  markOk();
}
async function loadReviews() {
  var d = await getDoc(ReviewDoc, 'reviews');
  return (d && d.list) || null;
}
async function saveSiteData(obj) {
  checkSiteData(obj);
  await upsert(SiteDoc, 'sitedata', { _id: 'sitedata', data: obj });
  markOk();
}
async function loadSiteData() {
  var d = await getDoc(SiteDoc, 'sitedata');
  return (d && d.data) || null;
}

/* ---------- Connect ---------- */

async function initDb() {
  var uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    try {
      var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'server-config.json'), 'utf8'));
      if (cfg && typeof cfg.mongodbUri === 'string' && cfg.mongodbUri.trim()) uri = cfg.mongodbUri.trim();
    } catch (e) {}
  }
  if (!uri) {
    console.log('[mongo] MONGODB_URI .env me set nahi hai — MongoDB off, files as fallback chalta rahega.');
    return state;
  }
  if (uri.indexOf('<db_password>') !== -1) {
    console.log('[mongo] MONGODB_URI me abhi bhi <db_password> placeholder hai — .env me asli password dalo. Files fallback chalti rahengi.');
    state.error = 'placeholder db_password in MONGODB_URI';
    return state;
  }
  try {
    state.connecting = true;
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, appName: 'rajesh-water' });
    state.on = true;
    state.error = null;
    console.log('[mongo] MongoDB Atlas CONNECTED ✓ — data ab MongoDB me save hoga.');
  } catch (e) {
    state.on = false;
    state.error = (e && e.message || String(e)).slice(0, 400);
    console.log('[mongo] Atlas connect FAIL: ' + state.error + ' — files fallback chalenge.');
  } finally {
    state.connecting = false;
  }
  return state;
}

function dbState() { return { on: state.on, error: state.error, lastSave: state.lastSave, lastError: state.lastError }; }

module.exports = {
  initDb: initDb,
  state: dbState,
  markError: markError,
  saveOrders: saveOrders, loadOrders: loadOrders,
  saveBiz: saveBiz, loadBiz: loadBiz,
  saveReviews: saveReviews, loadReviews: loadReviews,
  saveSiteData: saveSiteData, loadSiteData: loadSiteData,
  saveTcState: saveTcState, loadTcState: loadTcState
};