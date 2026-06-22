document.addEventListener('DOMContentLoaded', () => {

  // --- Hero Carousel ---
  const heroSlides = document.querySelectorAll('.hero-slide');
  let currentSlide = 0;
  if (heroSlides.length > 1) {
    setInterval(() => {
      heroSlides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % heroSlides.length;
      heroSlides[currentSlide].classList.add('active');
    }, 5000);
  }

  // --- Scroll Animations ---
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal, .section, .service-card, .car-card, .brand-item, .body-item, .stat-item, .step, .milestone, .team-card, .gallery-item, .blog-card, .testimonial-card, .review-card, .partners-grid img, .faq-item').forEach(el => {
    if (!el.classList.contains('reveal')) el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // --- Header ---
  const header = document.querySelector('header');
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('nav');

  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  }
  if (hamburger && nav) {
    const overlay = document.createElement('div');
    overlay.id = 'navOverlay';
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);
    function toggleNav(open) {
      hamburger.classList.toggle('active', open);
      nav.classList.toggle('open', open);
      overlay.classList.toggle('active', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }
    hamburger.addEventListener('click', () => toggleNav(!nav.classList.contains('open')));
    overlay.addEventListener('click', () => toggleNav(false));
    document.querySelectorAll('nav a').forEach(link => {
      link.addEventListener('click', () => toggleNav(false));
    });
  }

  const activePage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.getAttribute('href') === activePage) link.classList.add('active');
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // --- FAQ Accordion ---
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const wasOpen = item.classList.contains('open');
      item.closest('.faq-list')?.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // --- Contact Form ---
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('.btn');
      const fname = document.getElementById('conFname')?.value || '';
      const lname = document.getElementById('conLname')?.value || '';
      const subjectVal = document.getElementById('conSubject')?.value || 'General Inquiry';
      const data = {
        name: (fname + ' ' + lname).trim() || 'Unknown',
        email: document.getElementById('conEmail')?.value || '',
        phone: document.getElementById('conPhone')?.value || '',
        subject: document.getElementById('conSubject')?.selectedOptions?.[0]?.text || subjectVal,
        message: document.getElementById('conMessage')?.value || '',
        type: subjectVal
      };
      btn.textContent = 'Sending...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (res.ok) {
          const result = await res.json();
          contactForm.style.display = 'none';
          document.getElementById('successName').textContent = (fname + ' ' + lname).trim() || '—';
          document.getElementById('successRef').textContent = (result.id || '').slice(0, 8).toUpperCase();
          document.getElementById('formSuccess').style.display = 'block';
          btn.innerHTML = 'Send Message \u2192';
          btn.style.background = '';
          btn.style.color = '';
          btn.disabled = false;
        } else {
          btn.textContent = 'Error - Try Again';
          btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
      }
    });

    document.getElementById('resetFormBtn')?.addEventListener('click', () => {
      contactForm.reset();
      contactForm.style.display = '';
      document.getElementById('formSuccess').style.display = 'none';
    });
  }

  // --- Car Search Widget ---
  const searchForm = document.getElementById('carSearchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const make = document.getElementById('searchMake')?.value;
      const body = document.getElementById('searchBody')?.value;
      const minPrice = document.getElementById('searchMinPrice')?.value;
      const maxPrice = document.getElementById('searchMaxPrice')?.value;
      const condition = document.getElementById('searchCondition')?.value;
      if (make && make !== 'all') params.set('make', make);
      if (body && body !== 'all') params.set('body', body);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (condition && condition !== 'all') params.set('condition', condition);
      window.location.href = 'inventory.html' + (params.toString() ? '?' + params.toString() : '');
    });
  }

  // --- Finance Calculator ---
  function calcFinance() {
    const priceInput = document.getElementById('calcPrice');
    const depositInput = document.getElementById('calcDeposit');
    const termInput = document.getElementById('calcTerm');
    const rateInput = document.getElementById('calcRate');
    if (!priceInput) return;

    const price = parseFloat(priceInput.value) || 0;
    const depositPct = parseFloat(depositInput?.value) || 20;
    const term = parseFloat(termInput?.value) || 36;
    const rate = parseFloat(rateInput?.value) || 14;

    const deposit = price * (depositPct / 100);
    const loan = price - deposit;
    const monthlyRate = rate / 100 / 12;
    const payment = loan * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);

    document.getElementById('calcDepositDisplay').textContent = 'KES ' + Math.round(deposit).toLocaleString();
    document.getElementById('calcLoanDisplay').textContent = 'KES ' + Math.round(loan).toLocaleString();
    document.getElementById('calcPaymentDisplay').textContent = 'KES ' + (payment > 0 ? Math.round(payment).toLocaleString() : '0');

    if (depositInput) document.getElementById('calcDepositVal').textContent = Math.round(depositPct) + '%';
    if (termInput) document.getElementById('calcTermVal').textContent = term + ' months';
    if (rateInput) document.getElementById('calcRateVal').textContent = rate + '%';
    const priceVal = document.querySelector('#calcPrice + .range-val');
    if (priceVal) priceVal.textContent = 'KES ' + Math.round(price).toLocaleString();
  }

  document.querySelectorAll('#calcPrice, #calcDeposit, #calcTerm, #calcRate').forEach(el => {
    if (el) el.addEventListener('input', calcFinance);
  });
  calcFinance();

  // --- Duty Calculator ---
  function calcDuty() {
    const fob = parseFloat(document.getElementById('dutyFob')?.value) || 0;
    const engine = parseInt(document.getElementById('dutyEngine')?.value) || 1500;
    const age = document.getElementById('dutyAge')?.value || 'used';
    const jpyToKes = 0.85;
    const freightMap = { 1000: 120000, 1500: 140000, 2000: 160000, 3000: 200000, 9999: 280000 };
    const freight = freightMap[engine] || 150000;
    const fobKes = fob * jpyToKes;
    const cif = fobKes + freight;
    let importDutyRate = 0.25;
    if (engine > 3000) importDutyRate = 0.35;
    const importDuty = cif * importDutyRate;
    let exciseRate = 0.20;
    if (engine > 1500 && engine <= 3000) exciseRate = 0.25;
    else if (engine > 3000) exciseRate = 0.30;
    if (age === 'old') exciseRate += 0.05;
    if (age === 'new') exciseRate -= 0.05;
    const exciseDuty = (cif + importDuty) * exciseRate;
    const vat = (cif + importDuty + exciseDuty) * 0.16;
    const idf = cif * 0.035;
    const rdLevy = cif * 0.015;
    const total = importDuty + exciseDuty + vat + idf + rdLevy;
    document.getElementById('dFobKes').textContent = 'KES ' + Math.round(fobKes).toLocaleString();
    document.getElementById('dFreight').textContent = 'KES ' + Math.round(freight).toLocaleString();
    document.getElementById('dCif').textContent = 'KES ' + Math.round(cif).toLocaleString();
    document.getElementById('dDuty').textContent = 'KES ' + Math.round(importDuty).toLocaleString();
    document.getElementById('dExcise').textContent = 'KES ' + Math.round(exciseDuty).toLocaleString();
    document.getElementById('dVat').textContent = 'KES ' + Math.round(vat).toLocaleString();
    document.getElementById('dTotal').textContent = 'KES ' + Math.round(total).toLocaleString();
    const fobVal = document.getElementById('dutyFobVal');
    if (fobVal) fobVal.textContent = 'JPY ' + fob.toLocaleString();
  }
  document.querySelectorAll('#dutyFob, #dutyEngine, #dutyAge').forEach(el => {
    if (el) el.addEventListener('input', calcDuty);
  });
  if (document.getElementById('dutyFob')) calcDuty();

  // --- Image Gallery Lightbox ---
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lbImg = lightbox.querySelector('img');
    const lbClose = lightbox.querySelector('.lightbox-close');
    const lbPrev = lightbox.querySelector('.lightbox-prev');
    const lbNext = lightbox.querySelector('.lightbox-next');
    let currentImages = [];
    let currentIndex = 0;

    document.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const container = thumb.closest('[data-images]');
        if (container) currentImages = JSON.parse(container.dataset.images);
        currentIndex = parseInt(thumb.dataset.index) || 0;
        openLightbox(currentIndex);
      });
    });

    function openLightbox(index) {
      if (!currentImages.length) return;
      currentIndex = index;
      lbImg.src = currentImages[currentIndex];
      lbImg.alt = 'Vehicle image';
      lightbox.classList.add('open');
      lbPrev.style.display = currentImages.length > 1 ? 'block' : 'none';
      lbNext.style.display = currentImages.length > 1 ? 'block' : 'none';
    }

    if (lbClose) lbClose.addEventListener('click', () => lightbox.classList.remove('open'));
    if (lbPrev) lbPrev.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
      lbImg.src = currentImages[currentIndex];
    });
    if (lbNext) lbNext.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % currentImages.length;
      lbImg.src = currentImages[currentIndex];
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') lightbox.classList.remove('open');
      if (e.key === 'ArrowLeft') lbPrev?.click();
      if (e.key === 'ArrowRight') lbNext?.click();
    });
  }

  // --- Dynamic Car Rendering ---

  function formatPrice(price) {
    return 'KES ' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function placeholdUrl(text) {
    return 'https://placehold.co/400x300/F4A800/0A1628?text=' + encodeURIComponent(text);
  }

  function buildCarCard(car) {
    const badges = [];
    if (car.status === 'sold') badges.push('<span class="car-card-badge" style="background:#C8102E;color:#fff;">Sold</span>');
    else if (car.featured) badges.push('<span class="car-card-badge" style="background:#F4A800;color:#0A1628;">Featured</span>');
    const imgSrc = car.images && car.images.length ? car.images[0] : placeholdUrl(car.make + ' ' + car.model);
    const fallback = placeholdUrl(car.make + ' ' + car.model);
    return `
      <div class="car-card" data-make="${(car.make||'').toLowerCase()}" data-body="${(car.body||'').toLowerCase()}" data-price="${car.price}">
        <div class="car-card-image">
          ${badges.join('')}
          <img src="${imgSrc}" alt="${car.year} ${car.make} ${car.model}" loading="lazy" onerror="this.src='${fallback}';this.onerror=null">
          ${car.status !== 'sold' ? '<div class="car-card-overlay"><a href="vehicle-detail.html?id=' + car.id + '" class="btn btn-primary btn-sm">View Details</a></div>' : ''}
        </div>
        <div class="car-card-body">
          <h3><a href="vehicle-detail.html?id=${car.id}" style="color:inherit;">${car.year} &ndash; ${car.make} ${car.model}</a></h3>
          <p class="car-meta">${car.color || ''} &middot; ${(car.mileage||0).toLocaleString()} km</p>
          <div class="car-card-specs">
            <span>&#9881; ${car.fuel || '-'}</span>
            <span>&#9881; ${car.transmission || '-'}</span>
            <span>&#128205; Mombasa</span>
          </div>
          <div class="car-card-price">${formatPrice(car.price)}</div>
          ${car.status !== 'sold'
            ? '<a href="vehicle-detail.html?id=' + car.id + '" class="btn btn-primary btn-sm">View Details</a>'
            : '<button class="btn btn-sm" style="background:#6c757d;color:#fff;cursor:default;width:100%;justify-content:center;" disabled>Sold</button>'}
        </div>
      </div>
    `;
  }

  // Homepage featured cars
  const featuredGrid = document.querySelector('.featured-grid');
  if (featuredGrid) {
    fetch('/api/cars?featured=true')
      .then(r => r.json())
      .then(data => {
        if (data.cars && data.cars.length) featuredGrid.innerHTML = data.cars.slice(0, 6).map(buildCarCard).join('');
      })
      .catch(() => {});
  }

  // Inventory page
  const inventoryGrid = document.getElementById('inventory-grid');
  const filterMake = document.getElementById('filter-make');
  const filterBody = document.getElementById('filter-body');
  const filterPrice = document.getElementById('filter-price');
  const sortSelect = document.getElementById('sort-select');
  const filterBtn = document.getElementById('filter-btn');
  const resetBtn = document.getElementById('reset-btn');
  const paginationDiv = document.getElementById('pagination');
  const resultsCount = document.getElementById('results-count');

  let currentPage = 1;
  let currentSort = 'year_desc';
  let totalPages = 1;

  if (inventoryGrid) {
    function loadInventory() {
      const params = new URLSearchParams(window.location.search);
      const urlMake = params.get('make');
      const urlBody = params.get('body');
      const urlMinPrice = params.get('minPrice');
      const urlMaxPrice = params.get('maxPrice');

      if (filterMake && urlMake && filterMake.value === 'all') filterMake.value = urlMake;
      if (filterBody && urlBody && filterBody.value === 'all') filterBody.value = urlBody;

      const apiParams = new URLSearchParams();
      apiParams.set('page', currentPage);
      apiParams.set('sort', currentSort);
      apiParams.set('limit', '100');
      const mk = filterMake?.value || 'all';
      const bd = filterBody?.value || 'all';
      if (mk !== 'all') apiParams.set('make', mk);
      if (bd !== 'all') apiParams.set('body', bd);

      fetch(`/api/cars?${apiParams}`)
        .then(r => r.json())
        .then(data => {
          let cars = data.cars;
          totalPages = data.totalPages;

          const pr = filterPrice?.value || 'all';
          if (pr !== 'all') {
            const [min, max] = pr.split('-').map(Number);
            cars = cars.filter(c => max ? (c.price >= min && c.price <= max) : (c.price >= min));
          }

          const queryMin = urlMinPrice ? parseInt(urlMinPrice) : null;
          const queryMax = urlMaxPrice ? parseInt(urlMaxPrice) : null;
          if (queryMin) cars = cars.filter(c => c.price >= queryMin);
          if (queryMax) cars = cars.filter(c => c.price <= queryMax);

          renderInventory(cars);
          renderPagination(data.page, totalPages);
        })
        .catch(() => {});
    }

    function renderInventory(cars) {
      if (resultsCount) resultsCount.textContent = cars.length;
      if (!cars.length) {
        inventoryGrid.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">No cars match your filters.</p>';
        return;
      }
      inventoryGrid.innerHTML = cars.map(buildCarCard).join('');
    }

    function renderPagination(page, total) {
      if (!paginationDiv) return;
      if (total <= 1) { paginationDiv.innerHTML = ''; return; }
      let html = '<div class="pagination-inner">';
      if (page > 1) html += `<button class="page-btn" data-page="${page - 1}">&laquo; Prev</button>`;
      for (let i = 1; i <= total; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
      if (page < total) html += `<button class="page-btn" data-page="${page + 1}">Next &raquo;</button>`;
      html += '</div>';
      paginationDiv.innerHTML = html;
      paginationDiv.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentPage = parseInt(btn.dataset.page);
          loadInventory();
          const ctrl = document.querySelector('.inventory-controls');
          if (ctrl) window.scrollTo({ top: ctrl.offsetTop - 100, behavior: 'smooth' });
        });
      });
    }

    if (filterBtn) filterBtn.addEventListener('click', () => { currentPage = 1; loadInventory(); });
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (filterMake) filterMake.value = 'all';
        if (filterBody) filterBody.value = 'all';
        if (filterPrice) filterPrice.value = 'all';
        if (sortSelect) sortSelect.value = 'year_desc';
        currentSort = 'year_desc';
        currentPage = 1;
        loadInventory();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        currentPage = 1;
        loadInventory();
      });
    }

    loadInventory();
  }

  // Vehicle detail page
  const detailContainer = document.getElementById('vehicleDetailContainer');
  if (detailContainer) {
    const params = new URLSearchParams(window.location.search);
    const carId = params.get('id');
    if (!carId) { detailContainer.innerHTML = '<p style="text-align:center;padding:60px;color:#999;">No car specified.</p>'; }
    else {
      fetch(`/api/cars/${carId}`)
        .then(r => r.json())
        .then(data => {
          if (!data.car) throw new Error('Not found');
          renderCarDetail(data.car);
        })
        .catch(() => {
          detailContainer.innerHTML = '<p style="text-align:center;padding:60px;color:#999;">Car not found.</p>';
        });
    }

    function renderCarDetail(car) {
      const images = car.images && car.images.length ? car.images : [placeholdUrl(car.make + ' ' + car.model)];
      const imgSrc = images[0];

      document.title = `${car.year} ${car.make} ${car.model} - Japan Link Motors LTD MSA`;

      const titleEl = document.getElementById('vehicleTitle');
      const subtitleEl = document.getElementById('vehicleSubtitle');
      if (titleEl) titleEl.textContent = car.year + ' ' + car.make + ' ' + car.model;
      if (subtitleEl) subtitleEl.textContent = (car.condition || 'Used') + ' ' + (car.bodyStyle || car.body || '') + ' — Stock #' + (car.stockNumber || 'N/A');

      const placehold = placeholdUrl(car.make + ' ' + car.model);

      detailContainer.innerHTML = `
        <div class="detail-layout" data-images='${JSON.stringify(images)}'>
          <div class="detail-gallery">
            <div class="detail-main-img">
              <img src="${imgSrc}" id="mainImage" alt="${car.year} ${car.make} ${car.model}" onerror="this.src='${placehold}';this.onerror=null">
              ${car.status === 'sold' ? '<div class="sold-ribbon">Sold</div>' : ''}
            </div>
            <div class="gallery-thumbs">
              ${images.map((img, i) => `<img src="${img}" alt="${car.make} ${car.model}" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}" onerror="this.src='${placehold}';this.onerror=null">`).join('')}
            </div>
          </div>
          <div class="detail-info">
            <h1>${car.year} ${car.make} ${car.model}</h1>
            <div class="detail-price">${formatPrice(car.price)}</div>
            ${car.status !== 'sold' ? '<span class="detail-badge available">In Stock</span>' : '<span class="detail-badge sold">Sold</span>'}
            <div class="detail-specs-grid">
              <div class="detail-spec"><span class="label">Year</span><span class="value">${car.year}</span></div>
              <div class="detail-spec"><span class="label">Make</span><span class="value">${car.make}</span></div>
              <div class="detail-spec"><span class="label">Model</span><span class="value">${car.model}</span></div>
              <div class="detail-spec"><span class="label">Color</span><span class="value">${car.color || '-'}</span></div>
              <div class="detail-spec"><span class="label">Mileage</span><span class="value">${(car.mileage||0).toLocaleString()} km</span></div>
              <div class="detail-spec"><span class="label">Engine</span><span class="value">${car.engine || (car.fuel ? car.fuel : '-')}</span></div>
              <div class="detail-spec"><span class="label">Fuel</span><span class="value">${car.fuel || '-'}</span></div>
              <div class="detail-spec"><span class="label">Transmission</span><span class="value">${car.transmission || '-'}</span></div>
              <div class="detail-spec"><span class="label">Body</span><span class="value">${car.body || '-'}</span></div>
              <div class="detail-spec"><span class="label">Location</span><span class="value">Mombasa</span></div>
            </div>
            ${car.status !== 'sold' ? `
              <div class="detail-actions">
                <a href="tel:0701007662" class="btn btn-primary" style="flex:1;">Call 0701 007 662</a>
                <a href="contact.html?car=${car.id}" class="btn btn-outline" style="flex:1;">Send Inquiry</a>
                <a href="https://wa.me/254701007662?text=${encodeURIComponent('Hi Japan Link Motors, I am interested in the ' + car.year + ' ' + car.make + ' ' + car.model + ' (KES ' + car.price.toLocaleString() + '). Please send me more details.')}" target="_blank" class="btn btn-success" style="flex:1;">&#x1F4AC; WhatsApp</a>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      window.switchImage = (index) => {
        const main = document.getElementById('mainImage');
        if (main && images[index]) {
          main.src = images[index];
          document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
          document.querySelector(`.gallery-thumb[data-index="${index}"]`)?.classList.add('active');
        }
      };

      // Load similar vehicles
      const simGrid = document.getElementById('similarVehicles');
      if (simGrid && car.body) {
        fetch('/api/cars?body=' + encodeURIComponent(car.body) + '&limit=4&exclude=' + car.id)
          .then(function(r) { return r.json(); })
          .then(function(d) {
            var similar = d.cars || [];
            if (!similar.length) { simGrid.style.display = 'none'; return; }
            simGrid.innerHTML = similar.map(function(c) { return buildCarCard(c); }).join('');
          })
          .catch(function() { simGrid.style.display = 'none'; });
      }
    }
  }

  // --- Back to Top Button ---
  const backToTop = document.createElement('button');
  backToTop.id = 'backToTop';
  backToTop.innerHTML = '&#8593;';
  backToTop.setAttribute('aria-label', 'Back to top');
  Object.assign(backToTop.style, {
    position: 'fixed', bottom: '90px', right: '20px', zIndex: '99',
    width: '44px', height: '44px', borderRadius: '50%', border: 'none',
    background: 'var(--gold)', color: 'var(--navy)', fontSize: '1.2rem',
    cursor: 'pointer', opacity: '0', transform: 'translateY(20px)',
    transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    pointerEvents: 'none'
  });
  document.body.appendChild(backToTop);
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTop.style.opacity = '1';
      backToTop.style.transform = 'translateY(0)';
      backToTop.style.pointerEvents = 'auto';
    } else {
      backToTop.style.opacity = '0';
      backToTop.style.transform = 'translateY(20px)';
      backToTop.style.pointerEvents = 'none';
    }
  });
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- Newsletter Signup ---
  const footerCol = document.querySelector('.footer-col:first-child');
  if (footerCol) {
    const nlForm = document.createElement('div');
    nlForm.style.marginTop = '15px';
    nlForm.innerHTML = `
      <h4 style="color:#fff;margin-bottom:8px;font-family:var(--font-heading);">&#9993; Newsletter</h4>
      <form id="newsletterForm" style="display:flex;gap:8px;">
        <input type="email" id="nlEmail" placeholder="Your email" required
          style="flex:1;padding:8px 12px;border:none;border-radius:6px;font-family:var(--font-body);font-size:0.85rem;">
        <button type="submit" style="padding:8px 14px;background:var(--gold);color:var(--navy);border:none;border-radius:6px;cursor:pointer;font-family:var(--font-heading);font-weight:600;">Join</button>
      </form>
    `;
    footerCol.appendChild(nlForm);
    document.getElementById('newsletterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('nlEmail').value;
      const btn = e.target.querySelector('button');
      btn.textContent = '...';
      btn.disabled = true;
      try {
        await fetch('/api/inquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Newsletter', email, subject: 'Newsletter Signup', message: 'Newsletter signup from ' + email })
        });
        btn.innerHTML = '&#10003;';
        btn.style.background = '#28a745';
        setTimeout(() => { btn.textContent = 'Join'; btn.style.background = ''; btn.disabled = false; }, 3000);
      } catch { btn.textContent = 'Join'; btn.disabled = false; }
    });
  }

  // --- Customer Reviews ---
  const reviewsGrid = document.getElementById('reviewsGrid');
  if (reviewsGrid) {
    fetch('/api/reviews')
      .then(r => r.json())
      .then(data => {
        if (data.reviews && data.reviews.length) {
          reviewsGrid.innerHTML = data.reviews.map(r => {
            const stars = '&#9733;'.repeat(r.rating) + '&#9734;'.repeat(5 - r.rating);
            return '<div class="review-card"><div class="review-stars">' + stars + '</div><blockquote>"' + r.message + '"</blockquote><div class="review-author">&mdash; ' + r.name + '</div></div>';
          }).join('');
        } else {
          reviewsGrid.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-light);">No reviews yet. Be the first to leave one!</div>';
        }
      })
      .catch(() => {
        reviewsGrid.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text-light);">Could not load reviews.</div>';
      });
  }

  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('reviewName').value;
      const rating = document.querySelector('input[name="rating"]:checked')?.value;
      const message = document.getElementById('reviewMessage').value;
      if (!rating) { alert('Please select a rating'); return; }
      const btn = reviewForm.querySelector('.btn');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, rating: parseInt(rating), message })
        });
        if (res.ok) {
          btn.innerHTML = 'Review Submitted! \u2713 (Pending Approval)';
          btn.style.background = '#28a745';
          btn.style.color = '#fff';
          setTimeout(() => {
            btn.textContent = 'Submit Review';
            btn.style.background = '';
            btn.style.color = '';
            reviewForm.reset();
            btn.disabled = false;
          }, 4000);
        } else {
          btn.textContent = 'Error - Try Again';
          btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
      }
    });
  }

  // --- Service Booking Form ---
  const sbForm = document.getElementById('serviceBookingForm');
  if (sbForm) {
    sbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('sbName')?.value || 'Unknown',
        phone: document.getElementById('sbPhone')?.value || '',
        email: document.getElementById('sbEmail')?.value || '',
        subject: 'Service Booking',
        message: 'Service: ' + (document.getElementById('sbService')?.value || 'N/A')
          + '\nDate: ' + (document.getElementById('sbDate')?.value || 'N/A')
          + '\nTime: ' + (document.getElementById('sbTime')?.value || 'N/A')
          + '\nNotes: ' + (document.getElementById('sbNotes')?.value || '')
      };
      const btn = sbForm.querySelector('.btn');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (res.ok) {
          btn.innerHTML = 'Appointment Booked! \u2713';
          btn.style.background = '#28a745'; btn.style.color = '#fff';
          setTimeout(() => { btn.textContent = 'Book Appointment'; btn.style.background = ''; btn.style.color = ''; sbForm.reset(); btn.disabled = false; }, 4000);
        } else {
          btn.textContent = 'Error - Try Again'; btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error - Try Again'; btn.disabled = false;
      }
    });
  }

  // --- Finance Apply Form ---
  const faForm = document.getElementById('financeApplyForm');
  if (faForm) {
    faForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: (document.getElementById('faFname')?.value || '') + ' ' + (document.getElementById('faLname')?.value || ''),
        phone: document.getElementById('faPhone')?.value || '',
        email: document.getElementById('faEmail')?.value || '',
        subject: 'Financing Application',
        message: 'Employment: ' + (document.getElementById('faEmployment')?.value || '')
          + '\nIncome: KES ' + (document.getElementById('faIncome')?.value || '')
          + '\nVehicle: ' + (document.getElementById('faVehicle')?.value || '')
          + '\nPrice: KES ' + (document.getElementById('faPrice')?.value || '')
          + '\nDeposit: KES ' + (document.getElementById('faDeposit')?.value || '')
          + '\nTerm: ' + (document.getElementById('faTerm')?.value || '') + ' months'
          + '\nNotes: ' + (document.getElementById('faNotes')?.value || '')
      };
      const btn = faForm.querySelector('.btn');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/inquiries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        if (res.ok) {
          btn.innerHTML = 'Application Submitted! \u2713';
          btn.style.background = '#28a745'; btn.style.color = '#fff';
          setTimeout(() => { btn.textContent = 'Submit Application'; btn.style.background = ''; btn.style.color = ''; faForm.reset(); btn.disabled = false; }, 4000);
        } else {
          btn.textContent = 'Error - Try Again'; btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error - Try Again'; btn.disabled = false;
      }
    });
  }

  // --- Latest Arrivals (Instagram-style grid) ---
  const arrivalsGrid = document.getElementById('arrivalsGrid');
  if (arrivalsGrid) {
    fetch('/api/cars?limit=6')
      .then(r => r.json())
      .then(data => {
        if (data.cars && data.cars.length) {
          arrivalsGrid.innerHTML = data.cars.slice(0, 6).map(c => {
            const img = c.images && c.images.length ? c.images[0] : placeholdUrl(c.make + ' ' + c.model);
            const label = c.year + ' ' + c.make + ' ' + c.model;
            return '<a href="vehicle-detail.html?id=' + c.id + '" class="arrival-item">' +
              '<img src="' + img + '" alt="' + label + '" loading="lazy" onerror="this.src=\'' + placeholdUrl(c.make + ' ' + c.model) + '\';this.onerror=null">' +
              '<div class="arrival-overlay">' + label + '<br>KES ' + c.price.toLocaleString() + '</div></a>';
          }).join('');
        }
      })
      .catch(() => {});
  }

  // --- Trade-In Form ---
  const tradeinForm = document.getElementById('tradeinForm');
  if (tradeinForm) {
    tradeinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('tiName').value,
        phone: document.getElementById('tiPhone').value,
        email: document.getElementById('tiEmail')?.value || '',
        year: document.getElementById('tiYear').value,
        make: document.getElementById('tiMake').value,
        model: document.getElementById('tiModel').value,
        mileage: document.getElementById('tiMileage')?.value || 0,
        condition: document.getElementById('tiCondition')?.value || 'Good',
        notes: document.getElementById('tiNotes')?.value || ''
      };
      const btn = tradeinForm.querySelector('.btn');
      btn.textContent = 'Submitting...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/trade-ins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          btn.innerHTML = 'Request Submitted! We\'ll Call You \u2713';
          btn.style.background = '#28a745';
          btn.style.color = '#fff';
          setTimeout(() => {
            btn.textContent = 'Submit Request';
            btn.style.background = '';
            btn.style.color = '';
            tradeinForm.reset();
            btn.disabled = false;
          }, 4000);
        } else {
          btn.textContent = 'Error - Try Again';
          btn.disabled = false;
        }
      } catch {
        btn.textContent = 'Error - Try Again';
        btn.disabled = false;
      }
    });
  }

  // --- Classic Carousel ---
  const carouselSlides = document.querySelectorAll('.carousel-slide');
  const carouselDots = document.querySelectorAll('.carousel-dot');
  if (carouselSlides.length) {
    let current = 0;
    const interval = 5000;
    let timer;
    function goTo(index) {
      carouselSlides[current].classList.remove('active');
      carouselDots[current].classList.remove('active');
      current = index;
      carouselSlides[current].classList.add('active');
      carouselDots[current].classList.add('active');
    }
    function next() { goTo((current + 1) % carouselSlides.length); }
    function startTimer() { timer = setInterval(next, interval); }
    function stopTimer() { clearInterval(timer); }
    carouselDots.forEach((dot, i) => {
      dot.addEventListener('click', () => { goTo(i); stopTimer(); startTimer(); });
    });
    const carousel = document.querySelector('.carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', stopTimer);
      carousel.addEventListener('mouseleave', startTimer);
      let touchStartX = 0;
      let touchEndX = 0;
      carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopTimer();
      }, { passive: true });
      carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) next();
          else goTo((current - 1 + carouselSlides.length) % carouselSlides.length);
        }
        startTimer();
      }, { passive: true });
    }
    startTimer();
  }
});
