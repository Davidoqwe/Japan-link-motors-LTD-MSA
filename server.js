require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const DATA_FILE = path.join(__dirname, 'data', 'cars.json');
const INQ_FILE = path.join(__dirname, 'data', 'inquiries.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.get('/car.html', (req, res) => {
  res.redirect(301, '/vehicle-detail.html' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''));
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

function ensureDir(fp) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCars() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { cars: [] }; }
}
function writeCars(data) {
  ensureDir(DATA_FILE);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function readInquiries() {
  try {
    const raw = fs.readFileSync(INQ_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { inquiries: [] }; }
}
function writeInquiries(data) {
  ensureDir(INQ_FILE);
  fs.writeFileSync(INQ_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function requireAdmin(req, res, next) {
  if (req.cookies && req.cookies.admin_token === 'authenticated') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Auth
app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie('admin_token', 'authenticated', { httpOnly: true, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 });
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});
app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: req.cookies && req.cookies.admin_token === 'authenticated' });
});

// Cars API
app.get('/api/cars', (req, res) => {
  const data = readCars();
  let cars = data.cars.map(c => ({
    ...c,
    color: c.color || c.exteriorColor || '',
    body: c.body || c.bodyStyle || '',
    exteriorColor: c.exteriorColor || c.color || '',
    bodyStyle: c.bodyStyle || c.body || ''
  }));

  // Filter: hide sold/pending from public (unless admin requests all)
  const isAdmin = req.query.admin === 'true';
  if (!isAdmin) cars = cars.filter(c => c.status !== 'sold' && c.status !== 'pending');

  if (req.query.featured === 'true') cars = cars.filter(c => c.featured);
  if (req.query.make && req.query.make !== 'all') cars = cars.filter(c => c.make.toLowerCase() === req.query.make.toLowerCase());
  if (req.query.body && req.query.body !== 'all') cars = cars.filter(c => c.body.toLowerCase() === req.query.body.toLowerCase());

  // Filter out specific car ID (for "similar vehicles")
  if (req.query.exclude) cars = cars.filter(c => c.id !== req.query.exclude);

  // Sort
  const sort = req.query.sort || 'year_desc';
  const sortMap = {
    'year_desc': (a, b) => b.year - a.year,
    'year_asc': (a, b) => a.year - b.year,
    'price_desc': (a, b) => b.price - a.price,
    'price_asc': (a, b) => a.price - b.price,
    'mileage_asc': (a, b) => a.mileage - b.mileage,
    'mileage_desc': (a, b) => b.mileage - a.mileage,
  };
  if (sortMap[sort]) cars.sort(sortMap[sort]);

  // Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
  const total = cars.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paginated = cars.slice(start, start + limit);

  res.json({ cars: paginated, total, page, pages: totalPages, limit });
});

app.get('/api/cars/:id', (req, res) => {
  const data = readCars();
  const car = data.cars.find(c => c.id === req.params.id);
  if (!car) return res.status(404).json({ error: 'Car not found' });
  res.json({
    car: {
      ...car,
      color: car.color || car.exteriorColor || '',
      body: car.body || car.bodyStyle || '',
      exteriorColor: car.exteriorColor || car.color || '',
      bodyStyle: car.bodyStyle || car.body || ''
    }
  });
});

app.post('/api/cars', requireAdmin, upload.array('images', 10), (req, res) => {
  const data = readCars();
  let images = [];
  if (req.files && req.files.length) {
    images = req.files.map(f => `/uploads/${f.filename}`);
  } else if (req.body.images) {
    try { images = Array.isArray(req.body.images) ? req.body.images : JSON.parse(req.body.images); } catch {}
  }
  const car = {
    id: uuidv4(),
    images,
    status: req.body.status || 'available',
    year: parseInt(req.body.year) || 0,
    make: req.body.make || '',
    model: req.body.model || '',
    vin: req.body.vin || '',
    stockNumber: req.body.stockNumber || '',
    condition: req.body.condition || 'Used',
    color: req.body.exteriorColor || req.body.color || '',
    exteriorColor: req.body.exteriorColor || req.body.color || '',
    interiorColor: req.body.interiorColor || '',
    body: req.body.bodyStyle || req.body.body || '',
    bodyStyle: req.body.bodyStyle || req.body.body || '',
    engine: req.body.engine || '',
    transmission: req.body.transmission || '',
    drivetrain: req.body.drivetrain || '',
    fuel: req.body.fuel || '',
    mileage: parseInt(req.body.mileage) || 0,
    price: parseInt(req.body.price) || 0,
    costPrice: parseInt(req.body.costPrice) || 0,
    featured: req.body.featured === 'true' || req.body.featured === 'on' || req.body.featured === true
  };
  data.cars.push(car);
  writeCars(data);
  logActivity('car', `<strong>${esc(car.year)} ${esc(car.make)} ${esc(car.model)}</strong> added to inventory`);
  res.status(201).json({ car });
});

app.put('/api/cars/:id', requireAdmin, upload.array('images', 10), (req, res) => {
  const data = readCars();
  const idx = data.cars.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Car not found' });

  const existing = data.cars[idx];
  let images = existing.images;
  if (req.body.carExistingImages) {
    try { images = typeof req.body.carExistingImages === 'string' ? JSON.parse(req.body.carExistingImages) : req.body.carExistingImages; } catch {}
  }
  if (req.files && req.files.length) {
    const newImgs = req.files.map(f => `/uploads/${f.filename}`);
    images = [...images, ...newImgs];
  }

  data.cars[idx] = {
    ...existing,
    images,
    status: req.body.status || existing.status,
    year: parseInt(req.body.year) || existing.year,
    make: req.body.make || existing.make,
    model: req.body.model || existing.model,
    vin: req.body.vin !== undefined ? req.body.vin : existing.vin,
    stockNumber: req.body.stockNumber !== undefined ? req.body.stockNumber : existing.stockNumber,
    condition: req.body.condition !== undefined ? req.body.condition : existing.condition,
    color: req.body.exteriorColor !== undefined ? req.body.exteriorColor : (req.body.color || existing.color || existing.exteriorColor),
    exteriorColor: req.body.exteriorColor !== undefined ? req.body.exteriorColor : (req.body.color || existing.exteriorColor || existing.color),
    interiorColor: req.body.interiorColor !== undefined ? req.body.interiorColor : existing.interiorColor,
    body: req.body.bodyStyle !== undefined ? req.body.bodyStyle : (req.body.body || existing.body || existing.bodyStyle),
    bodyStyle: req.body.bodyStyle !== undefined ? req.body.bodyStyle : (req.body.body || existing.bodyStyle || existing.body),
    engine: req.body.engine !== undefined ? req.body.engine : existing.engine,
    transmission: req.body.transmission !== undefined ? req.body.transmission : existing.transmission,
    drivetrain: req.body.drivetrain !== undefined ? req.body.drivetrain : existing.drivetrain,
    fuel: req.body.fuel !== undefined ? req.body.fuel : existing.fuel,
    mileage: parseInt(req.body.mileage) || existing.mileage,
    price: parseInt(req.body.price) || existing.price,
    costPrice: parseInt(req.body.costPrice) || existing.costPrice || 0,
    featured: req.body.featured === 'true' || req.body.featured === 'on' || req.body.featured === true
  };
  writeCars(data);
  if (req.body.status && req.body.status === 'sold' && existing.status !== 'sold') {
    logActivity('sale', `<strong>${esc(data.cars[idx].year)} ${esc(data.cars[idx].make)} ${esc(data.cars[idx].model)}</strong> marked as Sold`);
  } else {
    logActivity('car', `<strong>${esc(data.cars[idx].year)} ${esc(data.cars[idx].make)} ${esc(data.cars[idx].model)}</strong> updated`);
  }
  res.json({ car: data.cars[idx] });
});

app.delete('/api/cars/:id', requireAdmin, (req, res) => {
  const data = readCars();
  const idx = data.cars.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Car not found' });

  const [removed] = data.cars.splice(idx, 1);
  writeCars(data);
  logActivity('car', `<strong>${esc(removed.year)} ${esc(removed.make)} ${esc(removed.model)}</strong> deleted from inventory`);

  if (removed.images) {
    removed.images.forEach(img => {
      if (img.startsWith('/uploads/')) {
        const imgPath = path.join(__dirname, img);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    });
  }
  res.json({ success: true });
});

// Inquiries API
app.get('/api/inquiries', requireAdmin, (req, res) => {
  const data = readInquiries();
  data.inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(data);
});

app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, subject, message, type } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  const data = readInquiries();
  const inquiry = {
    id: uuidv4(),
    name, email, phone: phone || '',
    subject: subject || 'General',
    message,
    type: type || 'General Inquiry',
    read: false,
    createdAt: new Date().toISOString()
  };
  data.inquiries.push(inquiry);
  writeInquiries(data);
  logActivity('lead', `New inquiry from <strong>${esc(inquiry.name)}</strong> — ${esc(inquiry.subject)}`);
  res.status(201).json({ ...inquiry });
});

app.delete('/api/inquiries/:id', requireAdmin, (req, res) => {
  const data = readInquiries();
  const idx = data.inquiries.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Inquiry not found' });
  data.inquiries.splice(idx, 1);
  writeInquiries(data);
  res.json({ success: true });
});

app.put('/api/inquiries/:id', requireAdmin, (req, res) => {
  const data = readInquiries();
  const inquiry = data.inquiries.find(i => i.id === req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
  const allowed = ['leadStatus', 'type', 'read', 'notes', 'relatedCarId', 'subject'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) inquiry[key] = req.body[key];
  }
  writeInquiries(data);
  res.json({ success: true, inquiry });
});

app.patch('/api/inquiries/:id/read', requireAdmin, (req, res) => {
  const data = readInquiries();
  const inquiry = data.inquiries.find(i => i.id === req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
  inquiry.read = req.body.read !== undefined ? !!req.body.read : true;
  writeInquiries(data);
  res.json({ success: true, inquiry });
});

// Trade-ins API
const TRADE_FILE = path.join(__dirname, 'data', 'trade-ins.json');
function readTradeIns() {
  try {
    const raw = fs.readFileSync(TRADE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { tradeIns: [] }; }
}
function writeTradeIns(data) {
  ensureDir(TRADE_FILE);
  fs.writeFileSync(TRADE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.post('/api/trade-ins', (req, res) => {
  const { name, phone, email, year, make, model, mileage, condition, notes } = req.body;
  if (!name || !phone || !make || !model) {
    return res.status(400).json({ error: 'Name, phone, make, and model are required' });
  }
  const data = readTradeIns();
  const entry = {
    id: uuidv4(),
    name, phone, email: email || '',
    year: parseInt(year) || 0,
    make, model,
    mileage: parseInt(mileage) || 0,
    condition: condition || 'Good',
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  data.tradeIns.push(entry);
  writeTradeIns(data);
  logActivity('tradein', `Trade-in request from <strong>${esc(entry.name)}</strong> — ${esc(entry.year)} ${esc(entry.make)} ${esc(entry.model)}`);
  res.status(201).json({ ...entry });
});

app.get('/api/trade-ins', requireAdmin, (req, res) => {
  const data = readTradeIns();
  data.tradeIns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(data);
});

app.delete('/api/trade-ins/:id', requireAdmin, (req, res) => {
  const data = readTradeIns();
  const idx = data.tradeIns.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Trade-in not found' });
  data.tradeIns.splice(idx, 1);
  writeTradeIns(data);
  res.json({ success: true });
});

// Reviews API
const REVIEW_FILE = path.join(__dirname, 'data', 'reviews.json');
function readReviews() {
  try {
    const raw = fs.readFileSync(REVIEW_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { reviews: [] }; }
}
function writeReviews(data) {
  ensureDir(REVIEW_FILE);
  fs.writeFileSync(REVIEW_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/reviews', (req, res) => {
  const data = readReviews();
  const approved = data.reviews.filter(r => r.approved);
  approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reviews: approved });
});

app.get('/api/reviews/all', requireAdmin, (req, res) => {
  const data = readReviews();
  data.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(data);
});

app.post('/api/reviews', (req, res) => {
  const { name, rating, message } = req.body;
  if (!name || !rating || !message) {
    return res.status(400).json({ error: 'Name, rating, and message are required' });
  }
  const data = readReviews();
  const review = {
    id: uuidv4(),
    name,
    rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
    message,
    approved: false,
    createdAt: new Date().toISOString()
  };
  data.reviews.push(review);
  writeReviews(data);
  logActivity('review', `New review submitted by <strong>${esc(review.name)}</strong> (${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)})`);
  res.status(201).json({ ...review });
});

app.put('/api/reviews/:id/approve', requireAdmin, (req, res) => {
  const data = readReviews();
  const review = data.reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  review.approved = true;
  writeReviews(data);
  logActivity('review', `Review by <strong>${esc(review.name)}</strong> approved`);
  res.json({ success: true });
});

app.put('/api/reviews/:id', requireAdmin, (req, res) => {
  const data = readReviews();
  const review = data.reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  const { name, rating, message, approved } = req.body;
  if (name !== undefined) review.name = name;
  if (rating !== undefined) review.rating = Math.min(5, Math.max(1, parseInt(rating) || 5));
  if (message !== undefined) review.message = message;
  if (approved !== undefined) review.approved = approved;
  writeReviews(data);
  logActivity('review', `Review by <strong>${esc(review.name)}</strong> updated`);
  res.json({ success: true, review });
});

app.post('/api/reviews/create', requireAdmin, (req, res) => {
  const { name, rating, message, approved } = req.body;
  if (!name || !rating || !message) {
    return res.status(400).json({ error: 'Name, rating, and message are required' });
  }
  const data = readReviews();
  const review = {
    id: uuidv4(),
    name,
    rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
    message,
    approved: approved === undefined ? true : approved,
    createdAt: new Date().toISOString()
  };
  data.reviews.push(review);
  writeReviews(data);
  logActivity('review', `Review added by admin: <strong>${esc(review.name)}</strong> (${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)})`);
  res.status(201).json({ ...review });
});

app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  const data = readReviews();
  const idx = data.reviews.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Review not found' });
  data.reviews.splice(idx, 1);
  writeReviews(data);
  res.json({ success: true });
});

// ─── SALES & FINANCING API ─────────────────────────────────
const SALES_FILE = path.join(__dirname, 'data', 'sales.json');
function readSales() {
  try {
    const raw = fs.readFileSync(SALES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { transactions: [], applications: [] }; }
}
function writeSales(data) {
  ensureDir(SALES_FILE);
  fs.writeFileSync(SALES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/sales/transactions', requireAdmin, (req, res) => {
  const data = readSales();
  data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ transactions: data.transactions });
});

app.post('/api/sales/transactions', requireAdmin, (req, res) => {
  const { customer, vehicle, vehicleId, amount, status, paymentMethod } = req.body;
  if (!customer || !amount) {
    return res.status(400).json({ error: 'Customer and amount are required' });
  }
  const data = readSales();
  const tx = {
    id: uuidv4(),
    customer,
    vehicle: vehicle || '',
    vehicleId: vehicleId || '',
    amount: parseInt(amount) || 0,
    status: status || 'Completed',
    paymentMethod: paymentMethod || '',
    date: new Date().toISOString()
  };
  data.transactions.push(tx);
  writeSales(data);
  logActivity('sale', `Sale recorded: <strong>${esc(tx.customer)}</strong> — KES ${tx.amount.toLocaleString('en-KE')}${tx.vehicle ? ' for ' + esc(tx.vehicle) : ''}`);
  res.status(201).json({ transaction: tx });
});

app.put('/api/sales/transactions/:id', requireAdmin, (req, res) => {
  const data = readSales();
  const tx = data.transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  const allowed = ['customer', 'vehicle', 'vehicleId', 'amount', 'status', 'paymentMethod'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) tx[key] = req.body[key];
  }
  writeSales(data);
  res.json({ success: true, transaction: tx });
});

app.delete('/api/sales/transactions/:id', requireAdmin, (req, res) => {
  const data = readSales();
  const idx = data.transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  data.transactions.splice(idx, 1);
  writeSales(data);
  res.json({ success: true });
});

app.get('/api/sales/applications', requireAdmin, (req, res) => {
  const data = readSales();
  data.applications.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ applications: data.applications });
});

app.post('/api/sales/applications', requireAdmin, (req, res) => {
  const { customer, vehicle, vehicleId, loanAmount, status, notes } = req.body;
  if (!customer || !loanAmount) {
    return res.status(400).json({ error: 'Customer and loan amount are required' });
  }
  const data = readSales();
  const app = {
    id: uuidv4(),
    customer,
    vehicle: vehicle || '',
    vehicleId: vehicleId || '',
    loanAmount: parseInt(loanAmount) || 0,
    status: status || 'Pending',
    notes: notes || '',
    date: new Date().toISOString()
  };
  data.applications.push(app);
  writeSales(data);
  logActivity('finance', `Financing application from <strong>${esc(app.customer)}</strong> — KES ${app.loanAmount.toLocaleString('en-KE')}`);
  res.status(201).json({ application: app });
});

app.put('/api/sales/applications/:id', requireAdmin, (req, res) => {
  const data = readSales();
  const app = data.applications.find(a => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const allowed = ['customer', 'vehicle', 'vehicleId', 'loanAmount', 'status', 'notes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) app[key] = req.body[key];
  }
  writeSales(data);
  res.json({ success: true, application: app });
});

app.delete('/api/sales/applications/:id', requireAdmin, (req, res) => {
  const data = readSales();
  const idx = data.applications.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Application not found' });
  data.applications.splice(idx, 1);
  writeSales(data);
  res.json({ success: true });
});

// ─── DASHBOARD API ──────────────────────────────────────────
app.get('/api/dashboard', requireAdmin, (req, res) => {
  const carsData = readCars();
  const inqData = readInquiries();
  const salesData = readSales();
  const cars = carsData.cars || [];
  const inquiries = inqData.inquiries || [];
  const transactions = salesData.transactions || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalCars = cars.length;
  const availableCars = cars.filter(c => c.status === 'available').length;
  const soldCars = cars.filter(c => c.status === 'sold').length;

  const monthTransactions = transactions.filter(t => new Date(t.date) >= monthStart);
  const monthRevenue = monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const monthSales = monthTransactions.length;

  const activeLeads = inquiries.filter(i => i.leadStatus !== 'won' && i.leadStatus !== 'lost').length;

  // Monthly sales for chart (last 12 months)
  const monthlySales = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    const label = `${month} ${year}`;
    const count = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    }).length;
    monthlySales.push({ label, count });
  }

  const recentActivity = readActivity().activities.slice(0, 10);

  res.json({
    kpis: {
      totalCars,
      availableCars,
      soldCars,
      monthRevenue,
      monthSales,
      activeLeads,
      totalInquiries: inquiries.length,
      unreadInquiries: inquiries.filter(i => !i.read).length
    },
    monthlySales,
    recentActivity
  });
});

// ─── ACTIVITY LOG ───────────────────────────────────────────
const ACTIVITY_FILE = path.join(__dirname, 'data', 'activity.json');
function readActivity() {
  try {
    const raw = fs.readFileSync(ACTIVITY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { activities: [] }; }
}
function writeActivity(data) {
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function logActivity(type, text) {
  try {
    const data = readActivity();
    data.activities.unshift({
      id: uuidv4(),
      type,
      text,
      time: new Date().toISOString()
    });
    if (data.activities.length > 200) {
      data.activities = data.activities.slice(0, 200);
    }
    writeActivity(data);
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

app.get('/api/activity', requireAdmin, (req, res) => {
  const data = readActivity();
  data.activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(data);
});

app.delete('/api/activity', requireAdmin, (req, res) => {
  writeActivity({ activities: [] });
  res.json({ success: true });
});

// ─── BLOG API ───────────────────────────────────────────────
const BLOG_FILE = path.join(__dirname, 'data', 'posts.json');
function readPosts() {
  try {
    const raw = fs.readFileSync(BLOG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { posts: [] }; }
}
function writePosts(data) {
  ensureDir(BLOG_FILE);
  fs.writeFileSync(BLOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/posts', (req, res) => {
  const data = readPosts();
  let posts = data.posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (req.query.published === 'true') posts = posts.filter(p => p.published);
  res.json({ posts });
});

app.get('/api/posts/:slug', (req, res) => {
  const data = readPosts();
  const post = data.posts.find(p => p.slug === req.params.slug || p.id === req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!post.published) return res.status(404).json({ error: 'Post not found' });
  res.json({ post });
});

app.post('/api/posts', requireAdmin, upload.single('image'), (req, res) => {
  const { title, content, excerpt, published, author } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  const data = readPosts();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  const post = {
    id: uuidv4(),
    title,
    slug,
    content,
    excerpt: excerpt || content.substring(0, 200).replace(/<[^>]+>/g, '') + '...',
    author: author || 'Admin',
    published: published === 'true' || published === 'on',
    image: req.file ? '/uploads/' + req.file.filename : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.posts.push(post);
  writePosts(data);
  logActivity('blog', `Blog post <strong>${esc(post.title)}</strong> ${post.published ? 'published' : 'saved as draft'}`);
  res.status(201).json({ post });
});

app.put('/api/posts/:id', requireAdmin, upload.single('image'), (req, res) => {
  const data = readPosts();
  const idx = data.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  const existing = data.posts[idx];
  if (req.body.title) {
    existing.title = req.body.title;
    existing.slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  }
  if (req.body.content !== undefined) existing.content = req.body.content;
  if (req.body.excerpt !== undefined) existing.excerpt = req.body.excerpt;
  if (req.body.author !== undefined) existing.author = req.body.author;
  if (req.body.published !== undefined) existing.published = req.body.published === 'true' || req.body.published === 'on';
  if (req.file) existing.image = '/uploads/' + req.file.filename;
  existing.updatedAt = new Date().toISOString();
  writePosts(data);
  res.json({ success: true, post: existing });
});

app.delete('/api/posts/:id', requireAdmin, (req, res) => {
  const data = readPosts();
  const idx = data.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  const [removed] = data.posts.splice(idx, 1);
  writePosts(data);
  if (removed.image && removed.image.startsWith('/uploads/')) {
    const imgPath = path.join(__dirname, removed.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  res.json({ success: true });
});

// ─── CUSTOMERS API ──────────────────────────────────────────
const CUSTOMER_FILE = path.join(__dirname, 'data', 'customers.json');
function readCustomers() {
  try {
    const raw = fs.readFileSync(CUSTOMER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return { customers: [] }; }
}
function writeCustomers(data) {
  ensureDir(CUSTOMER_FILE);
  fs.writeFileSync(CUSTOMER_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/customers', requireAdmin, (req, res) => {
  const data = readCustomers();
  data.customers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const q = (req.query.search || '').toLowerCase();
  let filtered = data.customers;
  if (q) {
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }
  res.json({ customers: filtered });
});

app.get('/api/customers/:id', requireAdmin, (req, res) => {
  const data = readCustomers();
  const customer = data.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

app.post('/api/customers', requireAdmin, (req, res) => {
  const { name, email, phone, source, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const data = readCustomers();
  const customer = {
    id: uuidv4(),
    name,
    email: email || '',
    phone: phone || '',
    source: source || 'Manual',
    notes: notes ? [{ text: notes, date: new Date().toISOString() }] : [],
    relatedCars: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.customers.push(customer);
  writeCustomers(data);
  logActivity('lead', `New customer added: <strong>${esc(customer.name)}</strong>`);
  res.status(201).json({ customer });
});

app.put('/api/customers/:id', requireAdmin, (req, res) => {
  const data = readCustomers();
  const customer = data.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const allowed = ['name', 'email', 'phone', 'source', 'notes', 'relatedCars'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) customer[key] = req.body[key];
  }
  customer.updatedAt = new Date().toISOString();
  writeCustomers(data);
  res.json({ success: true, customer });
});

app.delete('/api/customers/:id', requireAdmin, (req, res) => {
  const data = readCustomers();
  const idx = data.customers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const [removed] = data.customers.splice(idx, 1);
  writeCustomers(data);
  res.json({ success: true });
});

// ─── SETTINGS API ───────────────────────────────────────────
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { siteName: 'Japan Link Motors LTD MSA', metaTitle: '', metaDescription: '', currency: 'KES', currencySymbol: 'KES', socialLinks: {}, emailTemplates: {} };
  }
}
function writeSettings(data) {
  ensureDir(SETTINGS_FILE);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/settings', (req, res) => {
  res.json(readSettings());
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const data = readSettings();
  const allowed = ['siteName', 'metaTitle', 'metaDescription', 'currency', 'currencySymbol', 'socialLinks', 'emailTemplates'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }
  writeSettings(data);
  res.json({ success: true, settings: data });
});

// ─── MEDIA LIBRARY API ─────────────────────────────────────
app.get('/api/media', requireAdmin, (req, res) => {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return res.json({ media: [] });
  }
  const files = fs.readdirSync(uploadsDir).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f));
  const media = files.map(f => {
    const stat = fs.statSync(path.join(uploadsDir, f));
    return {
      filename: f,
      url: '/uploads/' + f,
      size: stat.size,
      createdAt: stat.birthtime || stat.mtime
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ media });
});

app.delete('/api/media/:filename', requireAdmin, (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

// ─── PROFILE API ─────────────────────────────────────────
const PROFILE_FILE = path.join(__dirname, 'data', 'profile.json');
function readProfile() {
  try {
    const raw = fs.readFileSync(PROFILE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { general: { name: '', email: '', phone: '', phone2: '', address: '', logo: '', hours: {} }, about: { heroImage: '', content: '', mission: '', vision: '' }, team: [] };
  }
}
function writeProfile(data) {
  ensureDir(PROFILE_FILE);
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/profile', (req, res) => {
  res.json(readProfile());
});

app.put('/api/profile', requireAdmin, (req, res) => {
  const data = readProfile();
  if (req.body.general) {
    Object.assign(data.general, req.body.general);
  }
  if (req.body.about) {
    Object.assign(data.about, req.body.about);
  }
  if (req.body.team) {
    data.team = req.body.team;
  }
  writeProfile(data);
  res.json({ success: true, profile: data });
});

app.post('/api/profile/logo', requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  const data = readProfile();
  data.general.logo = url;
  writeProfile(data);
  res.json({ success: true, url });
});

app.post('/api/profile/about-image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  const data = readProfile();
  data.about.heroImage = url;
  writeProfile(data);
  res.json({ success: true, url });
});

app.post('/api/profile/team', requireAdmin, upload.single('image'), (req, res) => {
  const { name, title, bio } = req.body;
  if (!name || !title) return res.status(400).json({ error: 'Name and title are required' });
  const data = readProfile();
  const member = {
    id: uuidv4(),
    name,
    title,
    bio: bio || '',
    image: req.file ? '/uploads/' + req.file.filename : ''
  };
  data.team.push(member);
  writeProfile(data);
  res.status(201).json({ success: true, member });
});

app.put('/api/profile/team/:id', requireAdmin, upload.single('image'), (req, res) => {
  const data = readProfile();
  const member = data.team.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Team member not found' });
  if (req.body.name) member.name = req.body.name;
  if (req.body.title) member.title = req.body.title;
  if (req.body.bio !== undefined) member.bio = req.body.bio;
  if (req.file) member.image = '/uploads/' + req.file.filename;
  writeProfile(data);
  res.json({ success: true, member });
});

app.delete('/api/profile/team/:id', requireAdmin, (req, res) => {
  const data = readProfile();
  const idx = data.team.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Team member not found' });
  data.team.splice(idx, 1);
  writeProfile(data);
  res.json({ success: true });
});

app.post('/api/profile/team/:id/image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const data = readProfile();
  const member = data.team.find(m => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Team member not found' });
  member.image = '/uploads/' + req.file.filename;
  writeProfile(data);
  res.json({ success: true, url: member.image });
});

app.post('/api/upload/image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.use((req, res) => { res.status(404).send('Not found'); });

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large. Max 5MB per image.' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    if (err.field === 'images') return res.status(400).json({ error: 'Maximum 10 images allowed.' });
    return res.status(400).json({ error: 'Unexpected file field: ' + err.field });
  }
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '::', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/login.html`);
  console.log('Japan Link Motors LTD MSA - Your Trusted Car Dealer');
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the existing process or set a different PORT.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
