const http = require('http');
const path = require('path');

const BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return fn().then(() => {
    console.log(`  PASS: ${name}`);
    passed++;
  }).catch(err => {
    console.log(`  FAIL: ${name} — ${err.message || err.code || err}`);
    failed++;
  });
}

function fetch(method, url, body, cookie) {
  const opts = { method, headers: {} };
  if (body && typeof body === 'object') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (cookie) opts.headers['Cookie'] = cookie;
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
    if (opts.body) req.write(opts.body);
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
  let sessionCookie = '';
  await test('POST /api/login with correct password succeeds', async () => {
    const res = await fetch('POST', '/api/login', { password: 'admin123' });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) throw new Error('No session cookie set');
    sessionCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  });

  await test('POST /api/login with wrong password fails', async () => {
    const res = await fetch('POST', '/api/login', { password: 'wrong' });
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  await test('GET /api/check-auth returns authenticated', async () => {
    const res = await fetch('GET', '/api/check-auth', null, sessionCookie);
    const data = JSON.parse(res.body);
    if (!data.authenticated) throw new Error('Should be authenticated');
  });

  // Inquiries API
  await test('POST /api/inquiries creates inquiry', async () => {
    const res = await fetch('POST', '/api/inquiries', {
      name: 'Test', email: 'test@test.com', subject: 'Test', message: 'Hello'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!data.id) throw new Error('No inquiry ID returned');
  });

  await test('GET /api/inquiries returns inquiries', async () => {
    const res = await fetch('GET', '/api/inquiries', null, sessionCookie);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data.inquiries)) throw new Error('inquiries must be an array');
  });

  // Summary
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
