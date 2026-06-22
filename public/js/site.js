(function () {
  'use strict';

  function formatPhone(num) {
    if (!num) return '';
    var d = num.replace(/[^0-9]/g, '');
    if (d.length === 10) return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
    if (d.length === 9) return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6);
    return d;
  }

  function getRawPhone(num) {
    if (!num) return '';
    return num.replace(/[^0-9]/g, '');
  }

  function to12h(str) {
    if (!str) return '';
    var p = str.split(':');
    var h = parseInt(p[0], 10);
    var ampm = h >= 12 ? 'pm' : 'am';
    if (h === 0) h = 12; else if (h > 12) h -= 12;
    return h + (p[1] === '00' ? '' : ':' + p[1]) + ampm;
  }

  function buildHoursLine1(hours) {
    if (!hours || typeof hours !== 'object') return 'Mon\u2013Sat: 8am\u20136pm';
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var abbr = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    var groups = [], cur = null;
    for (var i = 0; i < 7; i++) {
      var h = hours[days[i]] || {};
      var key = h.closed ? 'x' : (h.open||'')+'-'+(h.close||'');
      if (!cur || cur.key !== key) { cur = { key: key, days: [], closed: !!h.closed, open: h.open, close: h.close }; groups.push(cur); }
      cur.days.push(abbr[i]);
    }
    var parts = [];
    groups.forEach(function (g) {
      if (g.closed) return;
      var range = g.days.length === 1 ? g.days[0] : g.days[0] + '\u2013' + g.days[g.days.length-1];
      parts.push(range + ': ' + to12h(g.open) + '\u2013' + to12h(g.close));
    });
    return parts.join(', ') || 'Hours not set';
  }

  function buildHoursLine2(hours) {
    if (!hours || typeof hours !== 'object') return 'Sunday: Closed';
    var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    var abbr = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    var closed = [];
    for (var i = 0; i < 7; i++) {
      var h = hours[days[i]] || {};
      if (h.closed) closed.push(abbr[i]);
    }
    return closed.length ? (closed.length === 1 ? closed[0] : closed.join(', ')) + ': Closed' : '';
  }

  Promise.all([
    fetch('/api/settings').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch('/api/profile').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (results) {
    var settings = results[0];
    var profile = results[1];
    var general = profile.general || {};
    var social = settings.socialLinks || {};
    var siteName = settings.siteName || general.name || 'Japan Link Motors LTD MSA';

    var phone = general.phone || '';
    var phone2 = general.phone2 || '';
    var phoneRaw = getRawPhone(phone);
    var phone2Raw = getRawPhone(phone2);

    var data = {
      'business-name': siteName,
      'phone': formatPhone(phone),
      'phone2': formatPhone(phone2),
      'email': general.email || '',
      'address': general.address || '',
      'hours-line1': buildHoursLine1(general.hours),
      'hours-line2': buildHoursLine2(general.hours),
      'copyright': '\u00A9 ' + new Date().getFullYear() + ' ' + siteName + '. All rights reserved.',
      'logo': general.logo || '/images/logo.jpg',
      'whatsapp-float': social.whatsapp || (phoneRaw ? 'https://wa.me/' + (phoneRaw.indexOf('254') === 0 ? phoneRaw : '254' + phoneRaw.replace(/^0+/, '')) : '#'),
      'og-image': general.logo || 'https://japanlinkmotors.co.ke/images/logo.jpg',
      'og-site-name': siteName,
      'meta-title': settings.metaTitle || siteName + ' - Your Trusted Car Dealer in Mombasa',
      'meta-description': settings.metaDescription || 'Premium imported vehicles in Mombasa, Kenya.',
      'favicon': '/images/logo.jpg'
    };

    function setAttr(el, attr, val) {
      if (attr === 'href') {
        var key = el.getAttribute('data-site');
        if (key === 'phone-link') { el.href = 'tel:' + val; return; }
        if (key === 'phone2-link') { el.href = 'tel:' + val; return; }
        if (key === 'email-link') { el.href = 'mailto:' + val; return; }
        el.href = val;
      } else if (attr === 'src') {
        el.src = val;
      } else if (attr === 'content') {
        el.setAttribute('content', val);
      } else if (attr === 'href' && el.getAttribute('rel') === 'icon') {
        el.setAttribute('href', val);
      } else {
        el.setAttribute(attr, val);
      }
    }

    document.querySelectorAll('[data-site]').forEach(function (el) {
      var key = el.getAttribute('data-site');
      var value = data[key];
      if (value === undefined || value === '') return;

      // Handle phone-link and phone2-link specially (raw numbers)
      if (key === 'phone-link') { el.href = 'tel:' + phoneRaw; return; }
      if (key === 'phone2-link') { el.href = 'tel:' + phone2Raw; return; }
      if (key === 'email-link') { el.href = 'mailto:' + (general.email || ''); return; }

      var tag = el.tagName.toLowerCase();
      if (tag === 'a') {
        el.href = value;
      } else if (tag === 'img') {
        el.src = value;
        if (key === 'logo') el.alt = siteName;
      } else if (tag === 'meta') {
        el.setAttribute('content', value);
      } else if (tag === 'link' && el.getAttribute('rel') === 'icon') {
        el.setAttribute('href', value);
      } else {
        el.textContent = value;
      }
    });

    // Social links: map data-site social-* to the social object keys
    document.querySelectorAll('[data-site^="social-"]').forEach(function (el) {
      var key = el.getAttribute('data-site').replace('social-', '');
      var url = social[key] || '#';
      if (url) el.href = url;
    });
  }).catch(function () {});
})();
