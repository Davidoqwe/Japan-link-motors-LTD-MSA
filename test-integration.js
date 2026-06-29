const http = require('http');
const path = require('path');

const BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;

// Simple cookie jar — automatically tracks Set-Cookie and sends cookies
let cookieJar = '';

function test(name, fn) {
  return fn().then(() => {
    console.log(`  PASS: ${name}`);
    passed++;
  }).catch(err => {
    console.log(`  FAIL: ${name} — ${err.message || err.code || err}`);
    failed++;
  });
}

function fetch(method, url, body, useCookie) {
  const opts = { method, headers: {} };
  if (body && typeof body === 'object') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  // Always send stored cookie unless explicitly opted out
  if (cookieJar && useCookie !== false) {
    opts.headers['Cookie'] = cookieJar;
  }
  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: opts.headers
    };
    const req = http.request(options, res => {
      // Update cookie jar from Set-Cookie header
      const sc = res.headers['set-cookie'];
      if (sc) {
        const raw = Array.isArray(sc) ? sc[0] : sc;
        // Extract just the name=value part before any ; or full cookie
        const nameEq = raw.split(';')[0];
        // Replace the matching cookie name in our jar
        const cookieName = nameEq.split('=')[0];
        const re = new RegExp(`(^|,\\s*)${cookieName}=[^,]*`);
        if (cookieJar && cookieJar.match(re)) {
          cookieJar = cookieJar.replace(re, nameEq);
        } else {
          cookieJar = cookieJar ? cookieJar + ', ' + nameEq : nameEq;
        }
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        res.body = data;
        resolve(res);
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Submit a multipart/form-data request (simulates admin form submission)
function fetchMultipart(method, url, fields) {
  const boundary = '----TestBoundary' + Date.now().toString(36);
  const lines = [];
  for (const [k, v] of Object.entries(fields)) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${k}"`);
    lines.push('');
    lines.push(String(v));
  }
  lines.push(`--${boundary}--`);
  const body = lines.join('\r\n');

  const opts = {
    method,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(body)
    }
  };
  if (cookieJar) opts.headers['Cookie'] = cookieJar;

  return new Promise((resolve, reject) => {
    const u = new URL(url, BASE);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: opts.headers
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        res.body = data;
        resolve(res);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForServer(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000/', res => { req.destroy(); resolve(); });
        req.on('error', reject);
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('Server not ready after ' + retries + ' retries');
}

async function main() {
  console.log('\nIntegration Tests\n');
  await waitForServer();

  // Public pages
  await test('GET / returns 200', async () => {
    const res = await fetch('GET', '/');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.body.includes('Japan Link Motors')) throw new Error('Missing content');
  });

  await test('GET /inventory.html returns 200', async () => {
    const res = await fetch('GET', '/inventory.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /vehicle-detail.html returns 200', async () => {
    const res = await fetch('GET', '/vehicle-detail.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /vehicle-detail.html?id=1 returns 200 redirect from car.html', async () => {
    const res = await fetch('GET', '/car.html?id=1');
    if (res.statusCode !== 302 && res.statusCode !== 301) throw new Error(`Expected 301/302 redirect, got ${res.statusCode}`);
  });

  await test('GET /contact.html returns 200', async () => {
    const res = await fetch('GET', '/contact.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /about.html returns 200', async () => {
    const res = await fetch('GET', '/about.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /blog.html returns 200', async () => {
    const res = await fetch('GET', '/blog.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /admin/login.html returns 200', async () => {
    const res = await fetch('GET', '/admin/login.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /admin/dashboard.html returns 200', async () => {
    const res = await fetch('GET', '/admin/dashboard.html');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Security: sensitive files should NOT be served
  await test('GET /server.js returns 404', async () => {
    const res = await fetch('GET', '/server.js');
    if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
  });

  await test('GET /.env returns 404', async () => {
    const res = await fetch('GET', '/.env');
    if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
  });

  // API: public car listing
  await test('GET /api/cars returns public cars', async () => {
    const res = await fetch('GET', '/api/cars');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.cars)) throw new Error('cars must be an array');
    if (data.cars.length === 0) throw new Error('Expected some cars');
  });

  await test('GET /api/cars hides sold cars', async () => {
    const res = await fetch('GET', '/api/cars');
    const data = JSON.parse(res.body);
    for (const c of data.cars) {
      if (c.status === 'sold') throw new Error('Sold car visible in public API');
    }
  });

  // API: admin car listing (includes sold)
  await test('GET /api/cars?admin=true includes sold cars', async () => {
    const res = await fetch('GET', '/api/cars?admin=true');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.cars)) throw new Error('cars must be an array');
  });

  // API: single car
  await test('GET /api/cars/:id returns single car', async () => {
    const listRes = await fetch('GET', '/api/cars');
    const list = JSON.parse(listRes.body);
    if (!list.cars.length) throw new Error('No cars to test');
    const id = list.cars[0].id;
    const res = await fetch('GET', `/api/cars/${id}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!data.car || data.car.id !== id) throw new Error('Wrong car returned');
    if (!Array.isArray(data.car.images)) throw new Error('images should be an array');
  });

  // API: sorting
  await test('GET /api/cars?sort=price_asc sorts correctly', async () => {
    const res = await fetch('GET', '/api/cars?sort=price_asc');
    const data = JSON.parse(res.body);
    const prices = data.cars.map(c => c.price);
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < prices[i-1]) throw new Error('Not sorted ascending');
    }
  });

  // API: pagination
  await test('GET /api/cars?page=1&limit=3 returns 3 or fewer', async () => {
    const res = await fetch('GET', '/api/cars?page=1&limit=3');
    const data = JSON.parse(res.body);
    if (data.cars.length > 3) throw new Error(`Expected ≤3 cars, got ${data.cars.length}`);
    if (typeof data.total !== 'number') throw new Error('Missing total');
    if (typeof data.pages !== 'number') throw new Error('Missing pages');
  });

  // Admin auth
  await test('POST /api/login with correct password succeeds', async () => {
    const res = await fetch('POST', '/api/login', { password: 'admin123' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!cookieJar) throw new Error('No session cookie set');
  });

  await test('POST /api/login with wrong password fails', async () => {
    // Don't send the admin cookie to test unauthenticated
    const res = await fetch('POST', '/api/login', { password: 'wrong' }, false);
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  await test('GET /api/check-auth returns authenticated', async () => {
    const res = await fetch('GET', '/api/check-auth');
    const data = JSON.parse(res.body);
    if (!data.authenticated) throw new Error('Should be authenticated');
  });

  // Inquiries API
  let firstInquiryId = '';
  await test('POST /api/inquiries creates inquiry', async () => {
    const res = await fetch('POST', '/api/inquiries', {
      name: 'Test', email: 'test@test.com', subject: 'Test', message: 'Hello'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!data.id) throw new Error('No inquiry ID returned');
    firstInquiryId = data.id;
  });

  await test('GET /api/inquiries returns inquiries', async () => {
    const res = await fetch('GET', '/api/inquiries');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.inquiries)) throw new Error('inquiries must be an array');
  });

  // Inquiry mutations
  let inquiryId = '';
  await test('POST /api/inquiries creates inquiry for mutations', async () => {
    const res = await fetch('POST', '/api/inquiries', {
      name: 'Mutation Test', email: 'mut@test.com', subject: 'Mut', message: 'Test mutation'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    inquiryId = JSON.parse(res.body).id;
  });

  await test('PUT /api/inquiries/:id updates inquiry', async () => {
    const res = await fetch('PUT', `/api/inquiries/${inquiryId}`, { type: 'Test Type', leadStatus: 'contacted' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('PATCH /api/inquiries/:id/read marks as read', async () => {
    const res = await fetch('PATCH', `/api/inquiries/${inquiryId}/read`, { read: true });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/inquiries/:id removes inquiry', async () => {
    const res = await fetch('DELETE', `/api/inquiries/${inquiryId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Clean up first inquiry
  await test('DELETE /api/inquiries/:id removes first inquiry', async () => {
    const res = await fetch('DELETE', `/api/inquiries/${firstInquiryId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Trade-ins API
  let tradeInId = '';
  await test('POST /api/trade-ins creates trade-in', async () => {
    const res = await fetch('POST', '/api/trade-ins', {
      name: 'Trade Test', phone: '0712345678', email: 'trade@test.com',
      year: 2015, make: 'Toyota', model: 'Corolla', mileage: 80000, condition: 'Good'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    tradeInId = JSON.parse(res.body).id;
  });

  await test('POST /api/trade-ins rejects missing required fields', async () => {
    const res = await fetch('POST', '/api/trade-ins', { name: 'Bad' });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('GET /api/trade-ins returns trade-ins (admin)', async () => {
    const res = await fetch('GET', '/api/trade-ins');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.tradeIns)) throw new Error('tradeIns must be an array');
  });

  await test('DELETE /api/trade-ins/:id removes trade-in', async () => {
    const res = await fetch('DELETE', `/api/trade-ins/${tradeInId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Reviews API
  let reviewId = '';
  await test('POST /api/reviews creates unapproved review', async () => {
    const res = await fetch('POST', '/api/reviews', { name: 'Reviewer', rating: 5, message: 'Great dealer!' });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    reviewId = JSON.parse(res.body).id;
    if (JSON.parse(res.body).approved !== false) throw new Error('New review should not be approved');
  });

  await test('POST /api/reviews rejects missing fields', async () => {
    const res = await fetch('POST', '/api/reviews', { name: 'Bad' });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('GET /api/reviews returns only approved reviews', async () => {
    const res = await fetch('GET', '/api/reviews');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.reviews)) throw new Error('reviews must be an array');
    for (const r of data.reviews) {
      if (!r.approved) throw new Error('Unapproved review leaked to public');
    }
  });

  await test('GET /api/reviews/all returns all reviews (admin)', async () => {
    const res = await fetch('GET', '/api/reviews/all');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.reviews)) throw new Error('reviews must be an array');
  });

  await test('PUT /api/reviews/:id/approve approves review', async () => {
    const res = await fetch('PUT', `/api/reviews/${reviewId}/approve`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('PUT /api/reviews/:id updates review', async () => {
    const res = await fetch('PUT', `/api/reviews/${reviewId}`, { message: 'Updated!' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  let adminReviewId = '';
  await test('POST /api/reviews/create creates admin review', async () => {
    const res = await fetch('POST', '/api/reviews/create', { name: 'Admin', rating: 4, message: 'Auto-generated' });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    adminReviewId = JSON.parse(res.body).id;
  });

  await test('DELETE /api/reviews/:id removes review', async () => {
    const res = await fetch('DELETE', `/api/reviews/${reviewId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/reviews/:id removes admin review', async () => {
    const res = await fetch('DELETE', `/api/reviews/${adminReviewId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Sales & Financing API
  let txId = '';
  await test('GET /api/sales/transactions returns empty list', async () => {
    const res = await fetch('GET', '/api/sales/transactions');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.transactions)) throw new Error('transactions must be an array');
  });

  await test('POST /api/sales/transactions creates transaction', async () => {
    const res = await fetch('POST', '/api/sales/transactions', {
      customer: 'John Doe', vehicle: 'Toyota Prado', amount: 5000000, status: 'Completed', paymentMethod: 'Bank Transfer'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    txId = JSON.parse(res.body).transaction.id;
  });

  await test('PUT /api/sales/transactions/:id updates transaction', async () => {
    const res = await fetch('PUT', `/api/sales/transactions/${txId}`, { status: 'Refunded' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/sales/transactions/:id removes transaction', async () => {
    const res = await fetch('DELETE', `/api/sales/transactions/${txId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  let appId = '';
  await test('GET /api/sales/applications returns empty list', async () => {
    const res = await fetch('GET', '/api/sales/applications');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.applications)) throw new Error('applications must be an array');
  });

  await test('POST /api/sales/applications creates financing application', async () => {
    const res = await fetch('POST', '/api/sales/applications', {
      customer: 'Jane Doe', vehicle: 'Mazda CX-5', loanAmount: 2000000, status: 'Pending'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    appId = JSON.parse(res.body).application.id;
  });

  await test('PUT /api/sales/applications/:id updates application', async () => {
    const res = await fetch('PUT', `/api/sales/applications/${appId}`, { status: 'Approved' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/sales/applications/:id removes application', async () => {
    const res = await fetch('DELETE', `/api/sales/applications/${appId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Cars mutations (admin)
  let newCarId = '';
  await test('POST /api/cars creates car (admin)', async () => {
    const res = await fetch('POST', '/api/cars', {
      year: 2022, make: 'Honda', model: 'Fit', price: 1800000, mileage: 30000,
      engine: '1.3L', transmission: 'Automatic', fuel: 'Petrol',
      exteriorColor: 'Red', bodyStyle: 'Hatchback', condition: 'Used',
      status: 'available', featured: 'true'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    newCarId = JSON.parse(res.body).car.id;
  });

  await test('PUT /api/cars/:id updates car (admin)', async () => {
    const res = await fetch('PUT', `/api/cars/${newCarId}`, { price: 1750000 });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (data.car.price !== 1750000) throw new Error('Price not updated');
  });

  await test('DELETE /api/cars/:id removes car (admin)', async () => {
    const res = await fetch('DELETE', `/api/cars/${newCarId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Car CRUD via multipart/form-data (simulates real admin form)
  let mpCarId = '';
  await test('POST /api/cars multipart creates car (admin)', async () => {
    const res = await fetchMultipart('POST', '/api/cars', {
      year: '2023', make: 'Suzuki', model: 'Swift', price: '1500000', mileage: '10000',
      engine: '1.2L', transmission: 'Automatic', fuel: 'Petrol',
      exteriorColor: 'Blue', bodyStyle: 'Hatchback', condition: 'New',
      status: 'available', featured: 'true'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    mpCarId = JSON.parse(res.body).car.id;
    const car = JSON.parse(res.body).car;
    if (car.featured !== true) throw new Error('featured should be true');
    if (car.make !== 'Suzuki') throw new Error('make mismatch');
  });

  await test('PUT /api/cars/:id multipart updates car (admin)', async () => {
    const res = await fetchMultipart('PUT', `/api/cars/${mpCarId}`, {
      price: '1450000', featured: 'false'
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const car = JSON.parse(res.body).car;
    if (car.featured !== false) throw new Error('featured should be false');
  });

  await test('DELETE /api/cars/:id multipart removes car (admin)', async () => {
    const res = await fetch('DELETE', `/api/cars/${mpCarId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Blog API
  let postId = '';
  await test('GET /api/posts returns blog posts', async () => {
    const res = await fetch('GET', '/api/posts');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.posts)) throw new Error('posts must be an array');
  });

  await test('POST /api/posts creates blog post (admin)', async () => {
    const res = await fetch('POST', '/api/posts', {
      title: 'Test Post', content: '<p>Hello world</p>', published: 'true', author: 'Admin'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    postId = JSON.parse(res.body).post.id;
  });

  await test('GET /api/posts returns published only', async () => {
    const res = await fetch('GET', '/api/posts?published=true');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /api/posts/:slug returns single post', async () => {
    const listRes = await fetch('GET', '/api/posts');
    const posts = JSON.parse(listRes.body).posts;
    if (posts.length) {
      const slug = posts[0].slug;
      const res = await fetch('GET', `/api/posts/${slug}`);
      if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
      const data = JSON.parse(res.body);
      if (!data.post) throw new Error('Missing post object');
    }
  });

  await test('PUT /api/posts/:id updates blog post (admin)', async () => {
    const res = await fetch('PUT', `/api/posts/${postId}`, { title: 'Updated Post' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/posts/:id removes blog post (admin)', async () => {
    const res = await fetch('DELETE', `/api/posts/${postId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Customers API
  let customerId = '';
  await test('POST /api/customers creates customer (admin)', async () => {
    const res = await fetch('POST', '/api/customers', {
      name: 'Test Customer', email: 'cust@test.com', phone: '0711111111', source: 'Website'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    customerId = JSON.parse(res.body).customer.id;
  });

  await test('GET /api/customers returns customers (admin)', async () => {
    const res = await fetch('GET', '/api/customers');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.customers)) throw new Error('customers must be an array');
  });

  await test('GET /api/customers/:id returns single customer (admin)', async () => {
    const res = await fetch('GET', `/api/customers/${customerId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /api/customers?search= filters customers (admin)', async () => {
    const res = await fetch('GET', '/api/customers?search=Test');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('PUT /api/customers/:id updates customer (admin)', async () => {
    const res = await fetch('PUT', `/api/customers/${customerId}`, { email: 'updated@test.com' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('DELETE /api/customers/:id removes customer (admin)', async () => {
    const res = await fetch('DELETE', `/api/customers/${customerId}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Settings API
  let originalSiteName = '';
  await test('GET /api/settings returns settings', async () => {
    const res = await fetch('GET', '/api/settings');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!data.siteName) throw new Error('Missing siteName');
    originalSiteName = data.siteName;
  });

  await test('PUT /api/settings updates settings (admin)', async () => {
    const res = await fetch('PUT', '/api/settings', { siteName: 'JLM Motors' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('PUT /api/settings restores original settings', async () => {
    const res = await fetch('PUT', '/api/settings', { siteName: originalSiteName });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Profile API
  let originalProfile = null;
  await test('GET /api/profile returns profile', async () => {
    const res = await fetch('GET', '/api/profile');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    originalProfile = JSON.parse(res.body);
  });

  await test('PUT /api/profile updates profile (admin)', async () => {
    const res = await fetch('PUT', '/api/profile', {
      about: { ...originalProfile.about, mission: 'Test mission' }
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('PUT /api/profile restores original profile', async () => {
    const res = await fetch('PUT', '/api/profile', { about: originalProfile.about });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Dashboard API
  await test('GET /api/dashboard returns KPIs (admin)', async () => {
    const res = await fetch('GET', '/api/dashboard');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!data.kpis || typeof data.kpis.totalCars !== 'number') throw new Error('Missing KPI data');
    if (!Array.isArray(data.monthlySales)) throw new Error('Missing monthlySales');
    if (!Array.isArray(data.recentActivity)) throw new Error('Missing recentActivity');
  });

  // Activity API
  await test('GET /api/activity returns activity log (admin)', async () => {
    const res = await fetch('GET', '/api/activity');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.activities)) throw new Error('activities must be an array');
  });

  await test('DELETE /api/activity clears activity log (admin)', async () => {
    const res = await fetch('DELETE', '/api/activity');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  // Auth: logout
  await test('POST /api/logout clears session', async () => {
    const res = await fetch('POST', '/api/logout');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
  });

  await test('GET /api/check-auth returns unauthenticated after logout', async () => {
    // Cookie jar should have been updated by logout's Set-Cookie
    const res = await fetch('GET', '/api/check-auth');
    const data = JSON.parse(res.body);
    if (data.authenticated) throw new Error('Should not be authenticated after logout');
  });

  // Auth: admin-only endpoints reject unauthenticated
  await test('GET /api/inquiries rejects without auth', async () => {
    // Explicitly skip cookie to test unauthenticated access
    const res = await fetch('GET', '/api/inquiries', null, false);
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  await test('POST /api/cars rejects without auth', async () => {
    const res = await fetch('POST', '/api/cars', { make: 'Test', model: 'Test' }, false);
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  // Summary
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
