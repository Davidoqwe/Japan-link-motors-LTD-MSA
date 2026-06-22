/* ============================================================
   Japan Link Motors LTD MSA — Admin Panel
   ============================================================ */

// ─── STATE ───────────────────────────────────────────────────
let carsData = [];
let contactsData = [];
let reviewsData = [];
let tradeinsData = [];

let selectedContactId = null;
let inboxFilterType = 'all';
let inboxSearchQuery = '';

let profileData = null;
let profileDirty = false;
let profileSubTab = 'general';
let quillEditor = null;

let salesChartInstance = null;

// Inventory state
let invView = 'table';
let invSort = 'year_desc';
let invPage = 1;
let invPerPage = 10;
let invFilters = {
  status: 'all',
  condition: 'all',
  make: 'all',
  yearFrom: '',
  yearTo: '',
  priceFrom: '',
  priceTo: ''
};
let invSearchQuery = '';
let invDebounceTimer = null;
let carExistingImages = [];

// ─── API HELPERS ─────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatPrice(p) {
  return Number(p).toLocaleString('en-KE');
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── LAYOUT ──────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
}

function toggleMobileSidebar() {
  const sb = document.getElementById('sidebar');
  const isOpen = sb.classList.toggle('open');
  let overlay = document.getElementById('sidebarOverlay');
  if (isOpen) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.addEventListener('click', () => {
        sb.classList.remove('open');
        overlay.remove();
      });
      document.body.appendChild(overlay);
    }
  } else {
    overlay?.remove();
  }
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('adminDarkMode', document.documentElement.classList.contains('dark'));
  const btn = document.getElementById('darkModeToggle');
  btn.textContent = document.documentElement.classList.contains('dark') ? '\u2600' : '\u{1F319}';
}

function toggleProfileDropdown(e) {
  e.stopPropagation();
  document.getElementById('profileDropdown').classList.toggle('open');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabName}"]`).classList.add('active');
  if (tabName === 'cars') loadCars();
  if (tabName === 'inbox') renderInboxPage();
  if (tabName === 'profile') renderProfilePage();
  if (tabName === 'reviews') renderReviewsPage();
  if (tabName === 'tradeins') renderTradeInsPage();
  if (tabName === 'sales') renderSalesPage();
  if (tabName === 'blog') renderBlogPage();
  if (tabName === 'customers') renderCustomersPage();
  if (tabName === 'media') renderMediaPage();
  if (tabName === 'activity') renderActivityLogPage();
  if (tabName === 'settings') renderSettingsPage();
  if (tabName === 'dashboard') loadDashboard();
}

// ─── AUTH ────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const data = await apiFetch('/api/check-auth');
    if (!data.authenticated) {
      window.location.href = 'login.html';
      return;
    }
    initAdmin();
  } catch {
    window.location.href = 'login.html';
  }
}

function doLogout() {
  fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = 'login.html');
}

// ─── DASHBOARD ──────────────────────────────────────────────
const activityDots = { sale: 'green', lead: 'blue', tradein: 'amber', review: 'green', car: 'blue', finance: 'amber' };

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min ago';
  if (diffHrs < 24) return diffHrs + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function formatKES(amount) {
  if (amount >= 1000000) return 'KES ' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return 'KES ' + (amount / 1000).toFixed(0) + 'K';
  return 'KES ' + Number(amount).toLocaleString('en-KE');
}

async function loadDashboard() {
  try {
    const data = await apiFetch('/api/dashboard');
    const kpis = data.kpis || {};

    document.getElementById('kpiCars').textContent = kpis.totalCars || 0;
    document.getElementById('kpiRevenue').textContent = formatKES(kpis.monthRevenue || 0);
    document.getElementById('kpiLeads').textContent = kpis.activeLeads || 0;
    document.getElementById('kpiSales').textContent = kpis.monthSales || 0;

    const list = document.getElementById('activityList');
    const activities = data.recentActivity || [];
    list.innerHTML = activities.length ? activities.map(a =>
      `<div class="activity-item">
        <div class="activity-dot ${activityDots[a.type] || 'blue'}"></div>
        <div>
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${timeAgo(a.time)}</div>
        </div>
      </div>`
    ).join('') : '<div style="padding:20px;text-align:center;color:var(--admin-text-secondary);">No activity yet</div>';

    renderSalesChart(data.monthlySales || []);
    document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    const unread = data.kpis.totalInquiries - 0;
    const badge = document.querySelector('.notif-badge');
    if (badge) {
      badge.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
  } catch {
    document.getElementById('kpiCars').textContent = '—';
    document.getElementById('kpiRevenue').textContent = '—';
    document.getElementById('kpiLeads').textContent = '—';
    document.getElementById('kpiSales').textContent = '—';
  }
}

// ─── INVENTORY MANAGEMENT ────────────────────────────────────
async function loadCars() {
  try {
    const data = await apiFetch('/api/cars?admin=true');
    carsData = data.cars || [];
    renderInventory();
  } catch (err) { console.error('Load cars error:', err); }
}

function debounceSearch() {
  clearTimeout(invDebounceTimer);
  invDebounceTimer = setTimeout(() => {
    invSearchQuery = document.getElementById('invSearch').value;
    invPage = 1;
    renderInventory();
  }, 300);
}

function setInventoryView(view) {
  invView = view;
  document.querySelectorAll('.inv-view-toggle .view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('invTableView').classList.toggle('active', view === 'table');
  document.getElementById('invGridView').classList.toggle('active', view === 'grid');
}

function toggleFilter(type, value) {
  const chips = document.querySelectorAll(`#filter${type.charAt(0).toUpperCase() + type.slice(1)} .chip`);
  const current = invFilters[type];
  if (value === 'all') {
    invFilters[type] = 'all';
    chips.forEach(c => c.classList.toggle('active', c.dataset.value === 'all'));
  } else {
    const newVal = current === value ? 'all' : value;
    invFilters[type] = newVal;
    chips.forEach(c => c.classList.toggle('active', c.dataset.value === newVal));
  }
  invPage = 1;
  renderInventory();
}

function onFilterChange() {
  invFilters.make = document.getElementById('filterMake').value;
  invFilters.yearFrom = document.getElementById('filterYearFrom').value;
  invFilters.yearTo = document.getElementById('filterYearTo').value;
  invFilters.priceFrom = document.getElementById('filterPriceFrom').value;
  invFilters.priceTo = document.getElementById('filterPriceTo').value;
  invPage = 1;
  renderInventory();
}

function clearAllFilters() {
  invFilters = { status: 'all', condition: 'all', make: 'all', yearFrom: '', yearTo: '', priceFrom: '', priceTo: '' };
  document.getElementById('filterMake').value = 'all';
  document.getElementById('filterYearFrom').value = '';
  document.getElementById('filterYearTo').value = '';
  document.getElementById('filterPriceFrom').value = '';
  document.getElementById('filterPriceTo').value = '';
  document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.value === 'all'));
  invPage = 1;
  renderInventory();
}

function sortInventory(key) {
  const current = document.getElementById('invSort').value;
  const [sortKey, sortDir] = current.split('_');
  if (sortKey === key) {
    const newDir = sortDir === 'asc' ? 'desc' : 'asc';
    document.getElementById('invSort').value = `${key}_${newDir}`;
  } else {
    document.getElementById('invSort').value = `${key}_desc`;
  }
  renderInventory();
}

function getFilteredInventory() {
  let filtered = [...carsData];
  const q = invSearchQuery.toLowerCase().trim();

  if (q) {
    filtered = filtered.filter(c =>
      (c.vin || '').toLowerCase().includes(q) ||
      (c.make || '').toLowerCase().includes(q) ||
      (c.model || '').toLowerCase().includes(q) ||
      (c.stockNumber || '').toLowerCase().includes(q) ||
      String(c.year).includes(q)
    );
  }

  if (invFilters.status !== 'all') {
    filtered = filtered.filter(c => c.status === invFilters.status);
  }
  if (invFilters.condition !== 'all') {
    filtered = filtered.filter(c => (c.condition || 'Used') === invFilters.condition);
  }
  if (invFilters.make !== 'all') {
    filtered = filtered.filter(c => (c.make || '').toLowerCase() === invFilters.make.toLowerCase());
  }
  if (invFilters.yearFrom) {
    filtered = filtered.filter(c => (c.year || 0) >= parseInt(invFilters.yearFrom));
  }
  if (invFilters.yearTo) {
    filtered = filtered.filter(c => (c.year || 0) <= parseInt(invFilters.yearTo));
  }
  if (invFilters.priceFrom) {
    filtered = filtered.filter(c => (c.price || 0) >= parseInt(invFilters.priceFrom));
  }
  if (invFilters.priceTo) {
    filtered = filtered.filter(c => (c.price || 0) <= parseInt(invFilters.priceTo));
  }

  const sortVal = document.getElementById('invSort').value;
  const [sk, sd] = sortVal.split('_');
  filtered.sort((a, b) => {
    let va, vb;
    if (sk === 'name') {
      va = `${a.year || ''} ${a.make || ''} ${a.model || ''}`.toLowerCase();
      vb = `${b.year || ''} ${b.make || ''} ${b.model || ''}`.toLowerCase();
    } else if (sk === 'stockNumber') {
      va = (a.stockNumber || '').toLowerCase();
      vb = (b.stockNumber || '').toLowerCase();
    } else if (sk === 'vin') {
      va = (a.vin || '').toLowerCase();
      vb = (b.vin || '').toLowerCase();
    } else {
      va = Number(a[sk]) || 0;
      vb = Number(b[sk]) || 0;
    }
    if (va < vb) return sd === 'asc' ? -1 : 1;
    if (va > vb) return sd === 'asc' ? 1 : -1;
    return 0;
  });

  return filtered;
}

function renderInventory() {
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 70'%3E%3Crect width='100' height='70' fill='%23f0f0f0'/%3E%3Ctext x='50' y='38' text-anchor='middle' fill='%23999' font-size='12' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
  const filtered = getFilteredInventory();
  const total = filtered.length;
  invPage = Math.max(1, invPage);
  const totalPages = Math.ceil(total / invPerPage) || 1;
  if (invPage > totalPages) invPage = totalPages;
  const start = (invPage - 1) * invPerPage;
  const pageItems = filtered.slice(start, start + invPerPage);

  document.getElementById('invResultsCount').textContent =
    `Showing ${total ? start + 1 : 0}-${Math.min(start + invPerPage, total)} of ${total} vehicle${total !== 1 ? 's' : ''}`;

  const tags = [];
  if (invFilters.status !== 'all') tags.push(`Status: ${invFilters.status}`);
  if (invFilters.condition !== 'all') tags.push(`Condition: ${invFilters.condition}`);
  if (invFilters.make !== 'all') tags.push(`Make: ${invFilters.make}`);
  if (invFilters.yearFrom || invFilters.yearTo) tags.push(`Year: ${invFilters.yearFrom || 'any'}-${invFilters.yearTo || 'any'}`);
  if (invFilters.priceFrom || invFilters.priceTo) tags.push(`Price: ${invFilters.priceFrom || '0'}-${invFilters.priceTo || '∞'}`);
  document.getElementById('filterActiveTags').innerHTML = tags.map(t =>
    `<span class="filter-active-tag">${t} <button onclick="clearAllFilters()">&times;</button></span>`
  ).join('');

  renderInventoryTable(pageItems, placeholder);
  renderInventoryGrid(pageItems, placeholder);
  renderInvPagination(total, totalPages);
}

function renderInventoryTable(items, placeholder) {
  const tbody = document.getElementById('invTableBody');
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">&#128663;</div><h3>No vehicles found</h3><p>${invSearchQuery ? 'Try a different search term.' : 'Click "Add New Vehicle" to get started.'}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => {
    const imgSrc = c.images && c.images.length ? c.images[0] : placeholder;
    const imgHtml = `<img class="thumb" src="${imgSrc}" alt="${c.make}" onerror="this.src='${placeholder}';this.onerror=null">`;
    return `<tr>
      <td>${imgHtml}</td>
      <td><div class="vehicle-cell">${c.year || ''} ${c.make || ''} ${c.model || ''}<small>${c.condition || 'Used'} &middot; ${c.bodyStyle || c.body || '-'}</small></div></td>
      <td class="vin-cell">${c.vin || '-'}</td>
      <td>${c.stockNumber || '-'}</td>
      <td>${c.mileage ? c.mileage.toLocaleString() + ' km' : '-'}</td>
      <td><strong>KES ${formatPrice(c.price)}</strong></td>
      <td>${statusBadge(c.status)}</td>
      <td>
        <div class="quick-actions-wrap">
          <button class="quick-actions-btn" onclick="toggleQuickActions('${c.id}')" title="Quick actions">&#8943;</button>
          <div class="quick-actions-dropdown" id="qa-${c.id}">
            <button class="quick-action-item" onclick="editVehicle('${c.id}')"><span class="qa-icon">&#9998;</span> Edit</button>
            <button class="quick-action-item" onclick="markSold('${c.id}')"><span class="qa-icon">&#10003;</span> Mark as Sold</button>
            <button class="quick-action-item" onclick="duplicateVehicle('${c.id}')"><span class="qa-icon">&#128203;</span> Duplicate</button>
            <button class="quick-action-item danger" onclick="deleteVehicle('${c.id}')"><span class="qa-icon">&#128465;</span> Delete</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const sortVal = document.getElementById('invSort').value;
  document.querySelectorAll('.inv-table th[onclick]').forEach(th => {
    const match = th.getAttribute('onclick').match(/sortInventory\('(\w+)'\)/);
    if (match) {
      th.classList.toggle('sorted', sortVal.startsWith(match[1]));
    }
  });
}

function renderInventoryGrid(items, placeholder) {
  const grid = document.getElementById('invGrid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">&#128663;</div><h3>No vehicles found</h3></div>`;
    return;
  }
  grid.innerHTML = items.map(c => {
    const imgSrc = c.images && c.images.length ? c.images[0] : placeholder;
    const imgHtml = `<img class="card-img" src="${imgSrc}" alt="${c.make}" onerror="this.src='${placeholder}';this.onerror=null">`;
    return `<div class="inv-grid-card">
      ${imgHtml}
      <div class="card-body">
        <div class="card-title">${c.year || ''} ${c.make || ''} ${c.model || ''}</div>
        <div class="card-subtitle">${c.vin ? 'VIN: ' + c.vin : c.stockNumber ? 'Stock: ' + c.stockNumber : ''}</div>
        <div class="card-meta">
          <span class="card-price">KES ${formatPrice(c.price)}</span>
          <span class="card-mileage">${c.mileage ? c.mileage.toLocaleString() + ' km' : ''}</span>
        </div>
        <div>${statusBadge(c.status)}</div>
      </div>
      <div class="card-footer">
        <button class="btn-admin btn-admin-primary btn-admin-xs" onclick="editVehicle('${c.id}')">Edit</button>
        <button class="btn-admin btn-admin-danger btn-admin-xs" onclick="deleteVehicle('${c.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function statusBadge(status) {
  const labels = { available: 'Available', pending: 'Pending', sold: 'Sold' };
  const s = status || 'available';
  return `<span class="inv-status-badge ${s}"><span class="dot"></span>${labels[s] || s}</span>`;
}

function renderInvPagination(total, totalPages) {
  document.getElementById('invPageInfo').textContent =
    `Showing ${total ? (invPage - 1) * invPerPage + 1 : 0}-${Math.min(invPage * invPerPage, total)} of ${total}`;

  const btns = document.getElementById('invPageBtns');
  let pHtml = '';
  pHtml += `<button ${invPage <= 1 ? 'disabled' : ''} onclick="invPage=1;renderInventory()">&laquo;</button>`;
  pHtml += `<button ${invPage <= 1 ? 'disabled' : ''} onclick="invPage--;renderInventory()">&#9664;</button>`;
  for (let i = Math.max(1, invPage - 2); i <= Math.min(totalPages, invPage + 2); i++) {
    pHtml += `<button class="${i === invPage ? 'active' : ''}" onclick="invPage=${i};renderInventory()">${i}</button>`;
  }
  pHtml += `<button ${invPage >= totalPages ? 'disabled' : ''} onclick="invPage++;renderInventory()">&#9654;</button>`;
  pHtml += `<button ${invPage >= totalPages ? 'disabled' : ''} onclick="invPage=${totalPages};renderInventory()">&raquo;</button>`;
  btns.innerHTML = pHtml;
}

function toggleQuickActions(id) {
  const dd = document.getElementById(`qa-${id}`);
  const isOpen = dd.classList.contains('open');
  document.querySelectorAll('.quick-actions-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) dd.classList.add('open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.quick-actions-wrap')) {
    document.querySelectorAll('.quick-actions-dropdown').forEach(d => d.classList.remove('open'));
  }
});

async function markSold(id) {
  try {
    const res = await fetch(`/api/cars/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sold' })
    });
    if (res.ok) { loadCars(); showToast('Vehicle marked as Sold', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

async function duplicateVehicle(id) {
  try {
    const data = await apiFetch(`/api/cars/${id}`);
    const c = data.car;
    delete c.id;
    delete c.images;
    c.stockNumber = c.stockNumber ? c.stockNumber + '-copy' : '';
    c.status = 'available';
    const res = await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) { loadCars(); showToast('Vehicle duplicated', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

async function deleteVehicle(id) {
  if (!confirm('Delete this vehicle permanently?')) return;
  try {
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' });
    if (res.ok) { loadCars(); showToast('Vehicle deleted', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

function exportCSV() {
  const filtered = getFilteredInventory();
  if (!filtered.length) { showToast('No vehicles to export', 'error'); return; }
  const headers = ['Year', 'Make', 'Model', 'VIN', 'Stock #', 'Condition', 'Exterior Color', 'Interior Color', 'Body Style', 'Engine', 'Transmission', 'Drivetrain', 'Fuel', 'Mileage', 'Price (KES)', 'Cost (KES)', 'Status', 'Featured'];
  const rows = filtered.map(c => [
    c.year, c.make, c.model, c.vin, c.stockNumber, c.condition || 'Used',
    c.exteriorColor || '', c.interiorColor || '', c.bodyStyle || '',
    c.engine || '', c.transmission || '', c.drivetrain || '', c.fuel || '',
    c.mileage || 0, c.price || 0, c.costPrice || 0, c.status || 'available', c.featured ? 'Yes' : 'No'
  ]);
  let csv = '\uFEFF' + headers.join(',') + '\n';
  csv += rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV exported', 'success');
}

function previewImages(input) {
  const area = document.getElementById('imagePreview');
  area.innerHTML = '';
  for (const f of input.files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${e.target.result}" alt="preview">`;
      area.appendChild(div);
    };
    reader.readAsDataURL(f);
  }
}

function handleFileSelect(input) {
  previewImages(input);
}

function setupFileDropZone() {
  const zone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('carImages');
  if (!zone || !fileInput) return;
  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelect(fileInput);
    }
  });
}

function openAddVehicle() {
  document.getElementById('drawerTitle').textContent = 'Add New Vehicle';
  document.getElementById('vehicleForm').reset();
  document.getElementById('carId').value = '';
  document.getElementById('carFeatured').checked = false;
  document.getElementById('carCondition').value = 'Used';
  document.getElementById('carStatus').value = 'available';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('carImages').value = '';
  document.getElementById('vehicleDrawer').classList.add('open');
  document.getElementById('vehicleDrawerOverlay').classList.add('active');
}

async function editVehicle(id) {
  try {
    const data = await apiFetch(`/api/cars/${id}`);
    const c = data.car;
    fillVehicleForm(c);
    document.getElementById('vehicleDrawer').classList.add('open');
    document.getElementById('vehicleDrawerOverlay').classList.add('active');
  } catch { showToast('Failed to load vehicle details', 'error'); }
}

function fillVehicleForm(c) {
  document.getElementById('drawerTitle').textContent = 'Edit Vehicle';
  document.getElementById('carId').value = c.id;
  document.getElementById('carVin').value = c.vin || '';
  document.getElementById('carStockNumber').value = c.stockNumber || '';
  document.getElementById('carYear').value = c.year;
  document.getElementById('carMake').value = c.make;
  document.getElementById('carModel').value = c.model;
  document.getElementById('carCondition').value = c.condition || 'Used';
  document.getElementById('carMileage').value = c.mileage || '';
  document.getElementById('carExteriorColor').value = c.exteriorColor || c.color || '';
  document.getElementById('carInteriorColor').value = c.interiorColor || '';
  document.getElementById('carBodyStyle').value = c.bodyStyle || c.body || 'SUV';
  document.getElementById('carEngine').value = c.engine || '';
  document.getElementById('carTransmission').value = c.transmission || 'Automatic';
  document.getElementById('carDrivetrain').value = c.drivetrain || 'FWD';
  document.getElementById('carFuel').value = c.fuel || 'Petrol';
  document.getElementById('carCostPrice').value = c.costPrice || '';
  document.getElementById('carPrice').value = c.price;
  document.getElementById('carStatus').value = c.status || 'available';
  document.getElementById('carFeatured').checked = c.featured || false;
  carExistingImages = (c.images && c.images.length) ? [...c.images] : [];
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';
  if (carExistingImages.length) {
    preview.innerHTML = carExistingImages.map((img, i) =>
      `<div class="preview-item existing">
        <img src="${img}" alt="Image ${i+1}">
        <button type="button" class="remove-img" title="Remove" data-img-index="${i}">&times;</button>
      </div>`
    ).join('');
  }
  document.getElementById('carImages').value = '';
  preview.style.setProperty('--existing-count', carExistingImages.length);
}

function closeVehicleDrawer() {
  document.getElementById('vehicleDrawer').classList.remove('open');
  document.getElementById('vehicleDrawerOverlay').classList.remove('active');
}

async function saveVehicle() {
  const id = document.getElementById('carId').value;
  const isEdit = !!id;
  const fd = new FormData();

  const files = document.getElementById('carImages').files;
  if (files.length) {
    for (const f of files) fd.append('images', f);
  }
  fd.append('carExistingImages', JSON.stringify(carExistingImages));

  fd.append('vin', document.getElementById('carVin').value);
  fd.append('stockNumber', document.getElementById('carStockNumber').value);
  fd.append('year', document.getElementById('carYear').value);
  fd.append('make', document.getElementById('carMake').value);
  fd.append('model', document.getElementById('carModel').value);
  fd.append('condition', document.getElementById('carCondition').value);
  fd.append('mileage', document.getElementById('carMileage').value || '');
  fd.append('exteriorColor', document.getElementById('carExteriorColor').value);
  fd.append('interiorColor', document.getElementById('carInteriorColor').value);
  fd.append('bodyStyle', document.getElementById('carBodyStyle').value);
  fd.append('engine', document.getElementById('carEngine').value);
  fd.append('transmission', document.getElementById('carTransmission').value);
  fd.append('drivetrain', document.getElementById('carDrivetrain').value);
  fd.append('fuel', document.getElementById('carFuel').value);
  fd.append('costPrice', document.getElementById('carCostPrice').value || '0');
  fd.append('price', document.getElementById('carPrice').value);
  fd.append('status', document.getElementById('carStatus').value);
  fd.append('featured', document.getElementById('carFeatured').checked ? 'true' : 'false');

  const url = isEdit ? `/api/cars/${id}` : '/api/cars';
  const method = isEdit ? 'PUT' : 'POST';
  const btn = document.getElementById('saveCarBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const res = await fetch(url, { method, body: fd });
    if (res.ok) {
      closeVehicleDrawer();
      loadCars();
      showToast(isEdit ? 'Vehicle updated' : 'Vehicle added', 'success');
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save', 'error');
    }
  } catch { showToast('Connection error', 'error'); }
  finally { btn.textContent = 'Save Vehicle'; btn.disabled = false; }
}

function exportTableCSV(tableId, filename, columns) {
  const rows = [];
  const container = document.getElementById(tableId);
  if (!container) { showToast('Export table not found', 'error'); return; }
  const isTable = container.tagName === 'TABLE';
  const isTbody = container.tagName === 'TBODY';
  const items = isTable
    ? container.querySelectorAll('tbody tr')
    : isTbody
      ? container.querySelectorAll('tr')
      : container.querySelectorAll('.inbox-item');
  items.forEach(item => {
    const cells = isTable || isTbody ? item.querySelectorAll('td') : item.querySelectorAll('strong, .inbox-item-subject, .inbox-item-preview');
    const row = [];
    columns.forEach((col, i) => {
      if (cells[i]) row.push(cells[i].textContent.trim());
    });
    if (row.length) rows.push(row);
  });
  if (!rows.length) { showToast('No data to export', 'error'); return; }
  let csv = '\uFEFF' + columns.join(',') + '\n';
  csv += rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV exported', 'success');
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || 'success') + ' visible';
  setTimeout(() => t.classList.remove('visible'), 3000);
}

// ─── INIT ──────────────────────────────────────────────────
function initAdmin() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
  document.getElementById('hamburger')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('profileToggle')?.addEventListener('click', toggleProfileDropdown);
  document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
  document.getElementById('darkModeToggle')?.addEventListener('click', toggleDarkMode);
  document.getElementById('globalSearch')?.addEventListener('input', (e) => {
    invSearchQuery = e.target.value;
    clearTimeout(invDebounceTimer);
    invDebounceTimer = setTimeout(() => {
      invPage = 1;
      renderInventory();
    }, 300);
  });
  document.getElementById('imagePreview')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-img');
    if (!btn) return;
    const idx = parseInt(btn.dataset.imgIndex);
    carExistingImages.splice(idx, 1);
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = carExistingImages.length
      ? carExistingImages.map((img, i) =>
          `<div class="preview-item existing">
            <img src="${img}" alt="Image ${i+1}">
            <button type="button" class="remove-img" title="Remove" data-img-index="${i}">&times;</button>
          </div>`
        ).join('')
      : '';
  });
  if (localStorage.getItem('adminDarkMode') === 'true') {
    document.documentElement.classList.add('dark');
    document.getElementById('darkModeToggle').textContent = '\u2600';
  }
  const pf = document.getElementById('profileDropdown');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.admin-profile')) pf?.classList.remove('open');
  });
  document.getElementById('teamForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTeamMember();
  });
  setupFileDropZone();
  loadDashboard();
}

// ─── INBOX ─────────────────────────────────────────────────
function renderInboxPage() {
  loadInbox();
}

async function loadInbox() {
  try {
    const data = await apiFetch('/api/inquiries');
    contactsData = data.inquiries || [];
  } catch { contactsData = []; }
  renderInboxList();
}

function renderInboxList() {
  const container = document.getElementById('inboxItems');
  const countEl = document.getElementById('inboxCount');
  let filtered = contactsData;
  if (inboxFilterType !== 'all') filtered = filtered.filter(c => c.subject === inboxFilterType);
  if (inboxSearchQuery) {
    const q = inboxSearchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.message || '').toLowerCase().includes(q)
    );
  }
  countEl.textContent = filtered.length;
  container.innerHTML = filtered.length ? filtered.map(c => `
    <div class="inbox-item ${c.id === selectedContactId ? 'selected' : ''}" onclick="selectContact('${c.id}')">
      <div class="inbox-item-top">
        <strong>${c.name || 'Unknown'}</strong>
        <span class="inbox-item-date">${formatDate(c.createdAt || c.date || new Date())}</span>
      </div>
      <div class="inbox-item-subject">${c.subject || 'General Inquiry'}</div>
      <div class="inbox-item-preview">${(c.message || '').substring(0, 80)}...</div>
    </div>
  `).join('') : '<div style="padding:20px;text-align:center;color:var(--admin-text-secondary);">No messages found</div>';
}

function selectContact(id) {
  selectedContactId = id;
  renderInboxList();
  const c = contactsData.find(x => x.id === id);
  if (!c) return;
  document.getElementById('inboxDetailEmpty').style.display = 'none';
  document.getElementById('inboxDetailContent').style.display = 'block';
  document.getElementById('inboxDetailBody').innerHTML = `
    <div class="inbox-detail-from"><strong>${c.name || 'Unknown'}</strong> &lt;${c.email || '—'}&gt;</div>
    <div class="inbox-detail-meta">${c.phone ? 'Phone: ' + c.phone + '<br>' : ''}Date: ${formatDate(c.createdAt || c.date || new Date())}</div>
    <div class="inbox-detail-subject"><strong>${c.subject || 'General Inquiry'}</strong></div>
    <div class="inbox-detail-msg">${(c.message || 'No message').replace(/\n/g, '<br>')}</div>
  `;
}

function filterInboxByType(type) {
  inboxFilterType = type;
  document.querySelectorAll('.inbox-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  renderInboxList();
}

function onInboxSearch() {
  inboxSearchQuery = document.getElementById('inboxSearch').value;
  renderInboxList();
}

function closeInboxDetail() {
  selectedContactId = null;
  document.getElementById('inboxDetailEmpty').style.display = 'block';
  document.getElementById('inboxDetailContent').style.display = 'none';
  renderInboxList();
}

function replyViaEmail() {
  const c = contactsData.find(x => x.id === selectedContactId);
  if (c?.email) window.location.href = `mailto:${c.email}`;
}

async function markResolved() {
  if (!selectedContactId) return;
  try {
    await fetch(`/api/inquiries/${selectedContactId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadStatus: 'Resolved' }) });
    showToast('Marked as resolved', 'success');
    loadInbox();
  } catch { showToast('Failed to update', 'error'); }
}

async function convertToLead() {
  if (!selectedContactId) return;
  try {
    await fetch(`/api/inquiries/${selectedContactId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadStatus: 'Contacted' }) });
    showToast('Converted to lead', 'success');
    loadInbox();
  } catch { showToast('Failed', 'error'); }
}

async function deleteContact() {
  if (!selectedContactId || !confirm('Delete this message?')) return;
  try {
    await fetch(`/api/inquiries/${selectedContactId}`, { method: 'DELETE' });
    showToast('Deleted', 'success');
    closeInboxDetail();
    loadInbox();
  } catch { showToast('Failed to delete', 'error'); }
}

function saveQuickReply() {
  const note = document.getElementById('inboxQuickReply').value;
  if (!note.trim()) return;
  showToast('Note saved', 'success');
  document.getElementById('inboxQuickReply').value = '';
}

// ─── SALES ──────────────────────────────────────────────────
function renderSalesPage() {
  loadSalesData();
}

async function loadSalesData() {
  try {
    const [txData, appData] = await Promise.all([
      apiFetch('/api/sales/transactions'),
      apiFetch('/api/sales/applications')
    ]);
    const transactions = txData.transactions || [];
    const applications = appData.applications || [];
    document.getElementById('transactionsBody').innerHTML = transactions.length ? transactions.map(t => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${t.customer}</td>
        <td>${t.vehicle || '—'}</td>
        <td><strong>KES ${formatPrice(t.amount)}</strong></td>
        <td><span class="status-badge ${t.status === 'Completed' ? 'green' : t.status === 'Pending' ? 'amber' : 'blue'}">${t.status}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="5"><div class="empty-state" style="padding:20px;">No transactions recorded yet</div></td></tr>';
    document.getElementById('financingBody').innerHTML = applications.length ? applications.map(a => `
      <tr>
        <td>${formatDate(a.date)}</td>
        <td>${a.customer}</td>
        <td>${a.vehicle || '—'}</td>
        <td>KES ${formatPrice(a.loanAmount)}</td>
        <td><span class="status-badge ${a.status === 'Approved' ? 'green' : a.status === 'Pending' ? 'amber' : 'blue'}">${a.status}</span></td>
      </tr>
    `).join('') : '<tr><td colspan="5"><div class="empty-state" style="padding:20px;">No financing applications yet</div></td></tr>';
  } catch {
    document.getElementById('transactionsBody').innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:20px;">Failed to load data</div></td></tr>';
    document.getElementById('financingBody').innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:20px;">Failed to load data</div></td></tr>';
  }
}

// ─── REVIEWS ────────────────────────────────────────────────
function renderReviewsPage() {
  loadReviews();
}

async function loadReviews() {
  try {
    const data = await apiFetch('/api/reviews/all');
    reviewsData = data.reviews || [];
  } catch { reviewsData = []; }
  renderReviewsTable();
}

function renderReviewsTable() {
  const tbody = document.getElementById('reviewsTableBody');
  const count = document.getElementById('reviewsCount');
  count.textContent = reviewsData.length + ' total';
  tbody.innerHTML = reviewsData.map(r => {
    const approved = r.approved || r.status === 'approved';
    return `<tr>
      <td>${formatDate(r.createdAt || r.date || new Date())}</td>
      <td>${r.name || 'Anonymous'}</td>
      <td>${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}</td>
      <td>${(r.message || '').substring(0, 60)}...</td>
      <td><span class="status-badge ${approved ? 'green' : 'amber'}">${approved ? 'Approved' : 'Pending'}</span></td>
      <td>
        <button class="btn-admin btn-admin-sm btn-admin-outline" onclick="openEditReview('${r.id}')">Edit</button>
        <button class="btn-admin btn-admin-sm btn-admin-success" onclick="approveReview('${r.id}')" ${approved ? 'disabled style="opacity:0.4"' : ''}>Approve</button>
        <button class="btn-admin btn-admin-sm btn-admin-danger" onclick="deleteReview('${r.id}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function approveReview(id) {
  try {
    await fetch(`/api/reviews/${id}/approve`, { method: 'PUT' });
    showToast('Review approved', 'success');
    loadReviews();
  } catch { showToast('Failed', 'error'); }
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  try {
    await fetch(`/api/reviews/${id}`, { method: 'DELETE' });
    showToast('Review deleted', 'success');
    loadReviews();
  } catch { showToast('Failed', 'error'); }
}

function openAddReview() {
  document.getElementById('reviewDrawerTitle').textContent = 'New Review';
  document.getElementById('reviewForm').reset();
  document.getElementById('reviewId').value = '';
  document.getElementById('reviewApproved').checked = true;
  document.getElementById('reviewDrawer').classList.add('open');
  document.getElementById('reviewDrawerOverlay').classList.add('active');
}

function openEditReview(id) {
  const r = reviewsData.find(x => x.id === id);
  if (!r) return;
  document.getElementById('reviewDrawerTitle').textContent = 'Edit Review';
  document.getElementById('reviewId').value = r.id;
  document.getElementById('reviewName').value = r.name || '';
  document.getElementById('reviewRating').value = r.rating || 5;
  document.getElementById('reviewMessage').value = r.message || '';
  document.getElementById('reviewApproved').checked = r.approved || false;
  document.getElementById('reviewDrawer').classList.add('open');
  document.getElementById('reviewDrawerOverlay').classList.add('active');
}

function closeReviewDrawer() {
  document.getElementById('reviewDrawer').classList.remove('open');
  document.getElementById('reviewDrawerOverlay').classList.remove('active');
}

async function saveReview() {
  const id = document.getElementById('reviewId').value;
  const isEdit = !!id;
  const name = document.getElementById('reviewName').value.trim();
  const rating = document.getElementById('reviewRating').value;
  const message = document.getElementById('reviewMessage').value.trim();
  const approved = document.getElementById('reviewApproved').checked;
  if (!name) { showToast('Name is required', 'error'); return; }
  if (!rating) { showToast('Rating is required', 'error'); return; }
  if (!message) { showToast('Review text is required', 'error'); return; }
  const url = isEdit ? `/api/reviews/${id}` : '/api/reviews/create';
  const method = isEdit ? 'PUT' : 'POST';
  const btn = document.getElementById('saveReviewBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, rating: parseInt(rating), message, approved }) });
    if (res.ok) {
      closeReviewDrawer();
      loadReviews();
      showToast(isEdit ? 'Review updated' : 'Review added', 'success');
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save', 'error');
    }
  } catch { showToast('Connection error', 'error'); }
  finally { btn.textContent = 'Save Review'; btn.disabled = false; }
}

// ─── TRADE-INS ──────────────────────────────────────────────
function renderTradeInsPage() {
  loadTradeIns();
}

async function loadTradeIns() {
  try {
    const data = await apiFetch('/api/trade-ins');
    tradeinsData = data.tradeIns || [];
  } catch { tradeinsData = []; }
  renderTradeInsTable();
}

function renderTradeInsTable() {
  const tbody = document.getElementById('tradeinsTableBody');
  const count = document.getElementById('tradeinsCount');
  count.textContent = tradeinsData.length + ' total';
  tbody.innerHTML = tradeinsData.map(t => `
    <tr>
      <td>${formatDate(t.createdAt || t.date || new Date())}</td>
      <td>${t.name || 'Unknown'}</td>
      <td>${t.phone || t.email || '—'}</td>
      <td>${t.vehicleMake || ''} ${t.vehicleModel || ''} (${t.vehicleYear || ''})</td>
      <td>${t.mileage || '—'}</td>
      <td>${t.condition || '—'}</td>
      <td>
        <button class="btn-admin btn-admin-sm btn-admin-success" onclick="showToast('Contact customer for follow-up','success')">Contact</button>
        <button class="btn-admin btn-admin-sm btn-admin-danger" onclick="deleteTradeIn('${t.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteTradeIn(id) {
  if (!confirm('Delete this trade-in request?')) return;
  try {
    await fetch(`/api/trade-ins/${id}`, { method: 'DELETE' });
    showToast('Trade-in deleted', 'success');
    loadTradeIns();
  } catch { showToast('Failed', 'error'); }
}

// ─── BLOG ────────────────────────────────────────────────────
let blogPostsData = [];
let blogQuillEditor = null;
let blogSearchQuery = '';
let blogDebounceTimer = null;

function debounceBlogSearch() {
  clearTimeout(blogDebounceTimer);
  blogDebounceTimer = setTimeout(() => {
    blogSearchQuery = document.getElementById('blogSearch').value;
    renderBlogList();
  }, 300);
}

function renderBlogPage() {
  loadBlogPosts();
}

async function loadBlogPosts() {
  try {
    const data = await apiFetch('/api/posts');
    blogPostsData = data.posts || [];
  } catch { blogPostsData = []; }
  renderBlogList();
}

function getFilteredBlogPosts() {
  let filtered = [...blogPostsData];
  const q = blogSearchQuery.toLowerCase().trim();
  if (q) {
    filtered = filtered.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.author || '').toLowerCase().includes(q)
    );
  }
  const statusFilter = document.getElementById('blogFilterStatus').value;
  if (statusFilter === 'published') filtered = filtered.filter(p => p.published);
  if (statusFilter === 'draft') filtered = filtered.filter(p => !p.published);
  return filtered;
}

function renderBlogList() {
  const tbody = document.getElementById('blogTableBody');
  const filtered = getFilteredBlogPosts();
  tbody.innerHTML = filtered.length ? filtered.map(p => `
    <tr>
      <td><strong>${p.title}</strong></td>
      <td>${p.author || 'Admin'}</td>
      <td>${formatDate(p.createdAt)}</td>
      <td><span class="status-badge ${p.published ? 'green' : 'amber'}">${p.published ? 'Published' : 'Draft'}</span></td>
      <td>
        <button class="btn-admin btn-admin-sm btn-admin-outline" onclick="editBlogPost('${p.id}')">Edit</button>
        <button class="btn-admin btn-admin-sm ${p.published ? 'btn-admin-warning' : 'btn-admin-success'}" onclick="toggleBlogPostStatus('${p.id}')">${p.published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn-admin btn-admin-sm btn-admin-danger" onclick="deleteBlogPost('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty-state" style="padding:20px;">No posts yet. Click "New Post" to create one.</div></td></tr>';
}

function openAddPost() {
  document.getElementById('blogDrawerTitle').textContent = 'New Blog Post';
  document.getElementById('blogPostForm').reset();
  document.getElementById('blogPostId').value = '';
  document.getElementById('blogPostPublished').checked = true;
  document.getElementById('blogImagePreview').innerHTML = '';
  if (blogQuillEditor) blogQuillEditor.root.innerHTML = '';
  document.getElementById('blogDrawer').classList.add('open');
  document.getElementById('blogDrawerOverlay').classList.add('active');
  setTimeout(() => {
    if (typeof Quill !== 'undefined' && document.getElementById('blogEditor')) {
      if (!blogQuillEditor) {
        blogQuillEditor = new Quill('#blogEditor', { theme: 'snow', placeholder: 'Write your blog post here...' });
      }
    }
  }, 100);
}

async function editBlogPost(id) {
  const p = blogPostsData.find(x => x.id === id);
  if (!p) return;
  document.getElementById('blogDrawerTitle').textContent = 'Edit Blog Post';
  document.getElementById('blogPostId').value = p.id;
  document.getElementById('blogPostTitle').value = p.title;
  document.getElementById('blogPostAuthor').value = p.author || 'Admin';
  document.getElementById('blogPostPublished').checked = p.published;
  document.getElementById('blogPostExcerpt').value = p.excerpt || '';
  if (p.image) {
    document.getElementById('blogImagePreview').innerHTML = `<img src="${p.image}" style="max-width:200px;border-radius:8px;">`;
  } else {
    document.getElementById('blogImagePreview').innerHTML = '';
  }
  document.getElementById('blogDrawer').classList.add('open');
  document.getElementById('blogDrawerOverlay').classList.add('active');
  setTimeout(() => {
    if (typeof Quill !== 'undefined' && document.getElementById('blogEditor')) {
      if (!blogQuillEditor) {
        blogQuillEditor = new Quill('#blogEditor', { theme: 'snow', placeholder: 'Write your blog post here...' });
      }
      blogQuillEditor.root.innerHTML = p.content || '';
    }
  }, 100);
}

function closeBlogDrawer() {
  document.getElementById('blogDrawer').classList.remove('open');
  document.getElementById('blogDrawerOverlay').classList.remove('active');
}

function previewBlogImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('blogImagePreview').innerHTML = `<img src="${e.target.result}" style="max-width:200px;border-radius:8px;">`;
  };
  reader.readAsDataURL(file);
}

async function saveBlogPost() {
  const id = document.getElementById('blogPostId').value;
  const isEdit = !!id;
  const fd = new FormData();
  const fileInput = document.getElementById('blogPostImage');
  if (fileInput.files?.[0]) fd.append('image', fileInput.files[0]);
  fd.append('title', document.getElementById('blogPostTitle').value);
  fd.append('content', blogQuillEditor ? blogQuillEditor.root.innerHTML : '');
  fd.append('excerpt', document.getElementById('blogPostExcerpt').value);
  fd.append('author', document.getElementById('blogPostAuthor').value);
  fd.append('published', document.getElementById('blogPostPublished').checked ? 'true' : 'false');
  if (!document.getElementById('blogPostTitle').value) { showToast('Title is required', 'error'); return; }
  const url = isEdit ? `/api/posts/${id}` : '/api/posts';
  const method = isEdit ? 'PUT' : 'POST';
  const btn = document.getElementById('saveBlogPostBtn');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    const res = await fetch(url, { method, body: fd });
    if (res.ok) {
      closeBlogDrawer();
      loadBlogPosts();
      showToast(isEdit ? 'Post updated' : 'Post created', 'success');
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to save', 'error');
    }
  } catch { showToast('Connection error', 'error'); }
  finally { btn.textContent = 'Save Post'; btn.disabled = false; }
}

async function toggleBlogPostStatus(id) {
  const p = blogPostsData.find(x => x.id === id);
  if (!p) return;
  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !p.published })
    });
    if (res.ok) { loadBlogPosts(); showToast(p.published ? 'Post unpublished' : 'Post published', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

async function deleteBlogPost(id) {
  if (!confirm('Delete this post permanently?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (res.ok) { loadBlogPosts(); showToast('Post deleted', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

// ─── CUSTOMERS ──────────────────────────────────────────────
let customersData = [];
let customerSearchTimer = null;

function debounceCustomerSearch() {
  clearTimeout(customerSearchTimer);
  customerSearchTimer = setTimeout(renderCustomersPage, 300);
}

function renderCustomersPage() {
  loadCustomers();
}

async function loadCustomers() {
  try {
    const q = document.getElementById('customerSearch')?.value || '';
    const data = await apiFetch('/api/customers' + (q ? '?search=' + encodeURIComponent(q) : ''));
    customersData = data.customers || [];
  } catch { customersData = []; }
  renderCustomersTable();
}

function renderCustomersTable() {
  const tbody = document.getElementById('customersTableBody');
  tbody.innerHTML = customersData.length ? customersData.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email || '—'}</td>
      <td>${c.phone || '—'}</td>
      <td><span class="status-badge blue">${c.source || 'Manual'}</span></td>
      <td>${formatDate(c.createdAt)}</td>
      <td>
        <button class="btn-admin btn-admin-sm btn-admin-outline" onclick="editCustomer('${c.id}')">Edit</button>
        <button class="btn-admin btn-admin-sm btn-admin-danger" onclick="deleteCustomer('${c.id}')">Delete</button>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6"><div class="empty-state" style="padding:20px;">No customers yet</div></td></tr>';
}

function openAddCustomer() {
  document.getElementById('customerModalTitle').textContent = 'Add Customer';
  document.getElementById('customerId').value = '';
  document.getElementById('custName').value = '';
  document.getElementById('custEmail').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custSource').value = 'Manual';
  document.getElementById('custNotes').value = '';
  document.getElementById('customerModal').classList.add('active');
}

function editCustomer(id) {
  const c = customersData.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customerModalTitle').textContent = 'Edit Customer';
  document.getElementById('customerId').value = c.id;
  document.getElementById('custName').value = c.name;
  document.getElementById('custEmail').value = c.email || '';
  document.getElementById('custPhone').value = c.phone || '';
  document.getElementById('custSource').value = c.source || 'Manual';
  document.getElementById('custNotes').value = (c.notes && c.notes.length ? c.notes.map(n => n.text).join('\n') : '');
  document.getElementById('customerModal').classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('active');
}

async function saveCustomer() {
  const id = document.getElementById('customerId').value;
  const data = {
    name: document.getElementById('custName').value,
    email: document.getElementById('custEmail').value,
    phone: document.getElementById('custPhone').value,
    source: document.getElementById('custSource').value,
    notes: [{ text: document.getElementById('custNotes').value, date: new Date().toISOString() }]
  };
  if (!data.name) { showToast('Name is required', 'error'); return; }
  try {
    const url = id ? `/api/customers/${id}` : '/api/customers';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (res.ok) {
      closeCustomerModal();
      loadCustomers();
      showToast(id ? 'Customer updated' : 'Customer added', 'success');
    } else {
      const e = await res.json();
      showToast(e.error || 'Failed', 'error');
    }
  } catch { showToast('Connection error', 'error'); }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  try {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) { loadCustomers(); showToast('Customer deleted', 'success'); }
    else { const e = await res.json(); showToast(e.error || 'Failed', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

function exportCustomersCSV() {
  if (!customersData.length) { showToast('No customers to export', 'error'); return; }
  const headers = ['Name', 'Email', 'Phone', 'Source', 'Date Added'];
  const rows = customersData.map(c => [c.name, c.email, c.phone, c.source || 'Manual', c.createdAt]);
  let csv = '\uFEFF' + headers.join(',') + '\n';
  csv += rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `customers_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('CSV exported', 'success');
}

// ─── MEDIA LIBRARY ──────────────────────────────────────────
function renderMediaPage() {
  loadMedia();
}

async function loadMedia() {
  try {
    const data = await apiFetch('/api/media');
    renderMediaGrid(data.media || []);
  } catch { renderMediaGrid([]); }
}

function renderMediaGrid(media) {
  const grid = document.getElementById('mediaGrid');
  if (!media.length) {
    grid.innerHTML = '<div class="empty-state" style="padding:60px;"><div class="empty-icon">&#128247;</div><h3>No media uploaded</h3><p>Upload images through the vehicle or blog forms.</p></div>';
    return;
  }
  grid.innerHTML = media.map(m => `
    <div class="media-item">
      <img src="${m.url}" alt="${m.filename}" loading="lazy">
      <div class="media-item-overlay">
        <span class="media-size">${(m.size / 1024).toFixed(0)} KB</span>
        <button class="media-delete-btn" onclick="deleteMedia('${m.filename}')">&#128465;</button>
      </div>
      <div class="media-item-name">${m.filename}</div>
    </div>
  `).join('');
}

async function deleteMedia(filename) {
  if (!confirm(`Delete ${filename}?`)) return;
  try {
    const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    if (res.ok) { loadMedia(); showToast('File deleted', 'success'); }
    else { showToast('Failed to delete', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

// ─── ACTIVITY LOG ───────────────────────────────────────────
function renderActivityLogPage() {
  loadActivityLog();
}

async function loadActivityLog() {
  try {
    const data = await apiFetch('/api/activity');
    renderActivityLogList(data.activities || []);
  } catch { renderActivityLogList([]); }
}

function renderActivityLogList(activities) {
  const list = document.getElementById('activityLogList');
  const dots = { sale: 'green', lead: 'blue', tradein: 'amber', review: 'green', car: 'blue', finance: 'amber' };
  list.innerHTML = activities.length ? activities.map(a => `
    <div class="activity-log-item">
      <span class="activity-dot ${dots[a.type] || 'blue'}"></span>
      <div class="activity-log-content">
        <div class="activity-log-text">${a.text}</div>
        <div class="activity-log-time">${timeAgo(a.time)}</div>
      </div>
    </div>
  `).join('') : '<div style="padding:40px;text-align:center;color:var(--admin-text-secondary);">No activity recorded yet</div>';
}

async function clearActivityLog() {
  if (!confirm('Clear the entire activity log?')) return;
  try {
    await fetch('/api/activity', { method: 'DELETE' });
    loadActivityLog();
    showToast('Activity log cleared', 'success');
  } catch { showToast('Failed', 'error'); }
}

// ─── SETTINGS ───────────────────────────────────────────────
function renderSettingsPage() {
  loadSettings();
}

async function loadSettings() {
  try {
    const [data, profile] = await Promise.all([
      apiFetch('/api/settings'),
      apiFetch('/api/profile')
    ]);
    document.getElementById('setSiteName').value = data.siteName || '';
    document.getElementById('setCurrency').value = data.currency || 'KES';
    document.getElementById('setCurrencySymbol').value = data.currencySymbol || 'KES';
    document.getElementById('setMetaTitle').value = data.metaTitle || '';
    document.getElementById('setMetaDescription').value = data.metaDescription || '';
    document.getElementById('setWhatsApp').value = (data.socialLinks && data.socialLinks.whatsapp) || '';
    document.getElementById('setFacebook').value = (data.socialLinks && data.socialLinks.facebook) || '';
    document.getElementById('setInstagram').value = (data.socialLinks && data.socialLinks.instagram) || '';
    document.getElementById('setTikTok').value = (data.socialLinks && data.socialLinks.tiktok) || '';
    document.getElementById('setEmailInquiry').value = (data.emailTemplates && data.emailTemplates.inquiryConfirmation) || '';
    document.getElementById('setEmailTradein').value = (data.emailTemplates && data.emailTemplates.tradeInConfirmation) || '';
    const g = profile.general || {};
    document.getElementById('setContactEmail').value = g.email || '';
    document.getElementById('setContactPhone').value = g.phone || '';
    document.getElementById('setContactPhone2').value = g.phone2 || '';
  } catch { showToast('Failed to load settings', 'error'); }
}

async function saveSettings() {
  const data = {
    siteName: document.getElementById('setSiteName').value,
    currency: document.getElementById('setCurrency').value,
    currencySymbol: document.getElementById('setCurrencySymbol').value,
    metaTitle: document.getElementById('setMetaTitle').value,
    metaDescription: document.getElementById('setMetaDescription').value,
    socialLinks: {
      whatsapp: document.getElementById('setWhatsApp').value,
      facebook: document.getElementById('setFacebook').value,
      instagram: document.getElementById('setInstagram').value,
      tiktok: document.getElementById('setTikTok').value
    },
    emailTemplates: {
      inquiryConfirmation: document.getElementById('setEmailInquiry').value,
      tradeInConfirmation: document.getElementById('setEmailTradein').value
    }
  };
  try {
    const [res] = await Promise.all([
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }),
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general: {
            email: document.getElementById('setContactEmail').value,
            phone: document.getElementById('setContactPhone').value,
            phone2: document.getElementById('setContactPhone2').value
          }
        })
      })
    ]);
    if (res.ok) { showToast('Settings saved', 'success'); }
    else { showToast('Failed to save', 'error'); }
  } catch { showToast('Connection error', 'error'); }
}

// ─── PROFILE (SETTINGS) ─────────────────────────────────────
function renderProfilePage() {
  loadProfile();
}

async function loadProfile() {
  try {
    profileData = await apiFetch('/api/profile');
  } catch { profileData = {}; }
  fillProfileForm();
  if (typeof Quill !== 'undefined' && document.getElementById('aboutEditor')) {
    if (!quillEditor) {
      quillEditor = new Quill('#aboutEditor', { theme: 'snow', placeholder: 'Write about your dealership...' });
      quillEditor.on('text-change', markProfileDirty);
    }
    quillEditor.root.innerHTML = (profileData.about && profileData.about.content) || '';
  }
  renderTeamGrid();
}

function fillProfileForm() {
  if (!profileData) return;
  const g = profileData.general || {};
  const a = profileData.about || {};
  document.getElementById('profName').value = g.name || '';
  document.getElementById('profEmail').value = g.email || '';
  document.getElementById('profPhone').value = g.phone || '';
  document.getElementById('profPhone2').value = g.phone2 || '';
  document.getElementById('profAddress').value = g.address || '';
  document.getElementById('profMission').value = a.mission || '';
  document.getElementById('profVision').value = a.vision || '';
  if (g.logo) {
    document.getElementById('profLogoPreview').src = g.logo;
    document.getElementById('profLogoPreview').style.display = 'block';
    document.getElementById('logoPlaceholder').style.display = 'none';
  }
  if (a.heroImage) {
    document.getElementById('profHeroPreview').src = a.heroImage;
    document.getElementById('profHeroPreview').style.display = 'block';
    document.getElementById('heroPlaceholder').style.display = 'none';
  }
  renderHoursGrid();
  profileDirty = false;
  document.getElementById('profileSaveBar').style.display = 'none';
}

function renderHoursGrid() {
  const grid = document.getElementById('hoursGrid');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = (profileData?.general?.hours) || {};
  grid.innerHTML = '<div class="hours-header"><span>Day</span><span>Open</span><span>Close</span><span>Closed</span></div>' +
    days.map(d => {
      const h = hours[d] || {};
      return `<div class="hours-row">
        <span>${d}</span>
        <input type="time" value="${h.open || '08:00'}" onchange="markProfileDirty()">
        <input type="time" value="${h.close || '18:00'}" onchange="markProfileDirty()">
        <input type="checkbox" ${h.closed ? 'checked' : ''} onchange="markProfileDirty()">
      </div>`;
    }).join('');
}

function switchProfileSubTab(tab) {
  profileSubTab = tab;
  document.querySelectorAll('.profile-sub-tab').forEach(b => b.classList.toggle('active', b.dataset.subtab === tab));
  document.querySelectorAll('.profile-sub-content').forEach(c => c.classList.toggle('active', c.id === 'subtab-' + tab));
}

function markProfileDirty() {
  profileDirty = true;
  document.getElementById('profileSaveBar').style.display = 'block';
}

async function saveProfile() {
  const data = {
    general: {
      name: document.getElementById('profName').value,
      email: document.getElementById('profEmail').value,
      phone: document.getElementById('profPhone').value,
      phone2: document.getElementById('profPhone2').value,
      address: document.getElementById('profAddress').value,
      hours: {}
    },
    about: {
      mission: document.getElementById('profMission').value,
      vision: document.getElementById('profVision').value,
      content: quillEditor ? quillEditor.root.innerHTML : (profileData?.about?.content || '')
    }
  };
  document.querySelectorAll('.hours-row').forEach(row => {
    const cells = row.querySelectorAll('input');
    const day = row.querySelector('span')?.textContent;
    if (day) data.general.hours[day] = { open: cells[0]?.value || '', close: cells[1]?.value || '', closed: cells[2]?.checked || false };
  });
  try {
    await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    profileDirty = false;
    document.getElementById('profileSaveBar').style.display = 'none';
    showToast('Profile saved', 'success');
  } catch { showToast('Failed to save', 'error'); }
}

async function uploadProfileLogo(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profLogoPreview').src = e.target.result;
    document.getElementById('profLogoPreview').style.display = 'block';
    document.getElementById('logoPlaceholder').style.display = 'none';
    markProfileDirty();
  };
  reader.readAsDataURL(file);
  const fd = new FormData();
  fd.append('logo', file);
  try {
    const res = await fetch('/api/profile/logo', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      if (profileData && data.url) profileData.general.logo = data.url;
    }
  } catch {}
}

async function uploadProfileAboutImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profHeroPreview').src = e.target.result;
    document.getElementById('profHeroPreview').style.display = 'block';
    document.getElementById('heroPlaceholder').style.display = 'none';
    markProfileDirty();
  };
  reader.readAsDataURL(file);
  const fd = new FormData();
  fd.append('image', file);
  try {
    const res = await fetch('/api/profile/about-image', { method: 'POST', body: fd });
    if (res.ok) {
      const data = await res.json();
      if (profileData && data.url) profileData.about.heroImage = data.url;
    }
  } catch {}
}

function renderTeamGrid() {
  const grid = document.getElementById('teamGrid');
  const members = profileData?.team || [];
  grid.innerHTML = members.length ? members.map((m, i) => `
    <div class="team-card">
      <div class="team-card-img">${m.image ? `<img src="${m.image}" alt="${m.name}">` : '<span style="font-size:2rem;">&#128100;</span>'}</div>
      <h4>${m.name}</h4>
      <span class="team-card-role">${m.title}</span>
      <p>${m.bio || ''}</p>
      <div class="team-card-actions">
        <button class="btn-admin btn-admin-sm btn-admin-outline" onclick="editTeamMember(${i})">Edit</button>
        <button class="btn-admin btn-admin-sm btn-admin-danger" onclick="deleteTeamMember(${i})">Delete</button>
      </div>
    </div>
  `).join('') : '<p style="grid-column:1/-1;text-align:center;color:var(--admin-text-secondary);">No team members yet. Click "Add Team Member" to get started.</p>';
}

function openAddTeamMember() {
  document.getElementById('teamModalTitle').textContent = 'Add Team Member';
  document.getElementById('teamMemberId').value = '';
  document.getElementById('teamName').value = '';
  document.getElementById('teamTitle').value = '';
  document.getElementById('teamBio').value = '';
  document.getElementById('teamImagePreview').style.display = 'none';
  document.getElementById('teamImagePlaceholder').style.display = 'flex';
  document.getElementById('teamImageInput').value = '';
  document.getElementById('teamImagePreview').src = '';
  document.getElementById('teamModal').classList.add('active');
}

function editTeamMember(index) {
  const m = profileData?.team?.[index];
  if (!m) return;
  document.getElementById('teamModalTitle').textContent = 'Edit Team Member';
  document.getElementById('teamMemberId').value = index;
  document.getElementById('teamName').value = m.name || '';
  document.getElementById('teamTitle').value = m.title || '';
  document.getElementById('teamBio').value = m.bio || '';
  if (m.image) {
    document.getElementById('teamImagePreview').src = m.image;
    document.getElementById('teamImagePreview').style.display = 'block';
    document.getElementById('teamImagePlaceholder').style.display = 'none';
  }
  document.getElementById('teamModal').classList.add('active');
}

function closeTeamModal() {
  document.getElementById('teamModal').classList.remove('active');
}

function previewTeamImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('teamImagePreview').src = e.target.result;
    document.getElementById('teamImagePreview').style.display = 'block';
    document.getElementById('teamImagePlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function saveTeamMember() {
  const id = document.getElementById('teamMemberId').value;
  let imageUrl = document.getElementById('teamImagePreview').src || '';
  if (imageUrl && imageUrl.startsWith('data:')) {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const fd = new FormData();
      fd.append('image', blob, 'team-photo.jpg');
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.url;
      } else {
        showToast('Image upload failed, keeping previous image', 'warning');
        const oldIdx = document.getElementById('teamMemberId').value;
        imageUrl = (oldIdx !== '' && profileData?.team?.[parseInt(oldIdx)]?.image) || '';
      }
    } catch {
      showToast('Image upload failed, keeping previous image', 'warning');
      const oldIdx = document.getElementById('teamMemberId').value;
      imageUrl = (oldIdx !== '' && profileData?.team?.[parseInt(oldIdx)]?.image) || '';
    }
  }
  const member = {
    name: document.getElementById('teamName').value,
    title: document.getElementById('teamTitle').value,
    bio: document.getElementById('teamBio').value,
    image: imageUrl
  };
  if (!member.name || !member.title) { showToast('Name and Title are required', 'error'); return; }
  const members = profileData?.team || [];
  if (id !== '') members[parseInt(id)] = member;
  else members.push(member);
  const currentGeneral = {
    name: document.getElementById('profName')?.value || profileData?.general?.name || '',
    email: document.getElementById('profEmail')?.value || profileData?.general?.email || '',
    phone: document.getElementById('profPhone')?.value || profileData?.general?.phone || '',
    phone2: document.getElementById('profPhone2')?.value || profileData?.general?.phone2 || '',
    address: document.getElementById('profAddress')?.value || profileData?.general?.address || '',
    hours: profileData?.general?.hours || {},
    logo: profileData?.general?.logo || ''
  };
  const currentAbout = {
    mission: document.getElementById('profMission')?.value || profileData?.about?.mission || '',
    vision: document.getElementById('profVision')?.value || profileData?.about?.vision || '',
    content: quillEditor ? quillEditor.root.innerHTML : (profileData?.about?.content || ''),
    heroImage: profileData?.about?.heroImage || ''
  };
  try {
    await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team: members, general: currentGeneral, about: currentAbout }) });
    profileData.team = members;
    closeTeamModal();
    renderTeamGrid();
    showToast('Team member saved', 'success');
  } catch { showToast('Failed to save', 'error'); }
}

function deleteTeamMember(index) {
  if (!confirm('Remove this team member?')) return;
  const members = profileData?.team || [];
  members.splice(index, 1);
  const currentGeneral = {
    name: document.getElementById('profName')?.value || profileData?.general?.name || '',
    email: document.getElementById('profEmail')?.value || profileData?.general?.email || '',
    phone: document.getElementById('profPhone')?.value || profileData?.general?.phone || '',
    phone2: document.getElementById('profPhone2')?.value || profileData?.general?.phone2 || '',
    address: document.getElementById('profAddress')?.value || profileData?.general?.address || '',
    hours: profileData?.general?.hours || {},
    logo: profileData?.general?.logo || ''
  };
  const currentAbout = {
    mission: document.getElementById('profMission')?.value || profileData?.about?.mission || '',
    vision: document.getElementById('profVision')?.value || profileData?.about?.vision || '',
    content: quillEditor ? quillEditor.root.innerHTML : (profileData?.about?.content || ''),
    heroImage: profileData?.about?.heroImage || ''
  };
  fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team: members, general: currentGeneral, about: currentAbout }) })
    .then(() => { profileData.team = members; renderTeamGrid(); showToast('Team member removed', 'success'); })
    .catch(() => showToast('Failed', 'error'));
}

function renderSalesChart(monthlyData) {
  const canvas = document.getElementById('salesChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (salesChartInstance) { salesChartInstance.destroy(); }
  const labels = monthlyData.map(d => d.label);
  const counts = monthlyData.map(d => d.count);
  salesChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Sales',
        data: counts.length ? counts : [0, 0, 0, 0, 0, 0],
        borderColor: '#d4a74b',
        backgroundColor: 'rgba(212,167,75,0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

// ─── BOOT ───────────────────────────────────────────────────
checkAuth();