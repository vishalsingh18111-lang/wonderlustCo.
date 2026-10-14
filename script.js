/* =====================================================================
   Wanderlust Co. — core: utilities, i18n, theme, header, homepage
   sections. Booking flows live in booking.js.
   ===================================================================== */
(function(){
  "use strict";
  var D = window.WL_DATA;
  var WL = window.WL = {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */
  function $(s, r){ return (r || document).querySelector(s); }
  function $$(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  var store = {
    get: function(k, def){ try { var v = localStorage.getItem('wl_' + k); return v == null ? def : JSON.parse(v); } catch(e){ return def; } },
    set: function(k, v){ try { localStorage.setItem('wl_' + k, JSON.stringify(v)); } catch(e){} }
  };
  function toast(msg){
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function(){ t.classList.remove('show'); }, 3400);
  }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s){ if(!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n){ var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function today(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
  function daysBetween(a, b){ return Math.round((b - a) / 86400000); }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function fmtDate(s, withDay){ var d = typeof s === 'string' ? parseISO(s) : s; if(!d) return '—'; return (withDay ? DAYS[d.getDay()] + ', ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtDateShort(s){ var d = typeof s === 'string' ? parseISO(s) : s; return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function hm(mins){ mins = ((mins % 1440) + 1440) % 1440; return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60); }
  function dur(mins){ var h = Math.floor(mins / 60), m = mins % 60; return h + 'h ' + (m ? pad(m) + 'm' : '00m'); }
  function hashStr(s){ var h = 1779033703 ^ s.length; for(var i = 0; i < s.length; i++){ h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
  function rng(seed){ var a = typeof seed === 'string' ? hashStr(seed) : seed; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pick(r, arr){ return arr[Math.floor(r() * arr.length)]; }
  function haversine(a, b){
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function uid(prefix, len){ var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for(var i = 0; i < (len || 6); i++) s += c[Math.floor(Math.random() * c.length)]; return (prefix || '') + s; }
  function digits(n){ var s = String(Math.floor(Math.random() * 9) + 1); for(var i = 1; i < n; i++) s += Math.floor(Math.random() * 10); return s; }

  /* ---------- Money & currency ---------- */
  var currency = store.get('currency', 'INR');
  function fmtMoney(inr){
    inr = Math.round(inr || 0);
    if(currency === 'USD'){
      var v = inr / D.usdRate;
      return '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 100 ? 2 : 0, minimumFractionDigits: v < 100 ? 2 : 0 });
    }
    return (inr < 0 ? '−₹' : '₹') + Math.abs(inr).toLocaleString('en-IN');
  }
  function money(inr){ return '<span data-inr="' + Math.round(inr || 0) + '">' + fmtMoney(inr) + '</span>'; }
  function refreshMoney(){ $$('[data-inr]').forEach(function(el){ el.textContent = fmtMoney(+el.getAttribute('data-inr')); }); }

  /* ---------- Places ---------- */
  var INDIA = D.cities.filter(function(c){ return !c.intl; });
  function parseCode(text){ var m = /\(([A-Z0-9]{2,5})\)\s*$/.exec(text || ''); return m ? m[1] : null; }
  function findAirport(text){
    if(!text) return null; text = text.trim();
    var code = parseCode(text) || (/^[A-Za-z]{3}$/.test(text) ? text.toUpperCase() : null);
    if(code){ var c = D.cities.filter(function(x){ return x.air === code; })[0]; if(c) return c; }
    var n = text.replace(/\(.*\)/, '').trim().toLowerCase();
    return D.cities.filter(function(x){ return x.air && (x.name.toLowerCase() === n); })[0] ||
           D.cities.filter(function(x){ return x.air && x.name.toLowerCase().indexOf(n) === 0; })[0] || null;
  }
  function findStation(text){
    if(!text) return null; text = text.trim();
    var code = parseCode(text) || (/^[A-Za-z]{2,5}$/.test(text) ? text.toUpperCase() : null);
    if(code){ var c = D.cities.filter(function(x){ return x.rail === code; })[0]; if(c) return c; }
    var n = text.replace(/\(.*\)/, '').trim().toLowerCase();
    return D.cities.filter(function(x){ return x.rail && (x.name.toLowerCase() === n || x.railName.toLowerCase() === n); })[0] ||
           D.cities.filter(function(x){ return x.rail && (x.name.toLowerCase().indexOf(n) === 0 || x.railName.toLowerCase().indexOf(n) === 0); })[0] || null;
  }
  function findPlace(text){
    if(!text) return null; var n = text.replace(/\(.*\)/, '').trim().toLowerCase(); if(!n) return null;
    var c = D.cities.filter(function(x){ return x.name.toLowerCase() === n; })[0];
    if(c) return { name:c.name, state:c.state, lat:c.lat, lng:c.lng, intl:c.intl, city:c };
    var d = D.destinations.filter(function(x){ return x.name.toLowerCase() === n || x.id === n; })[0];
    if(d) return { name:d.name, state:d.state, lat:d.lat, lng:d.lng, intl:!!d.intl, dest:d };
    var g = D.getaways.filter(function(x){ return x[0].toLowerCase() === n; })[0];
    if(g) return { name:g[0], state:'', lat:g[1], lng:g[2], intl:false };
    c = D.cities.filter(function(x){ return x.name.toLowerCase().indexOf(n) === 0; })[0];
    if(c) return { name:c.name, state:c.state, lat:c.lat, lng:c.lng, intl:c.intl, city:c };
    d = D.destinations.filter(function(x){ return x.name.toLowerCase().indexOf(n) === 0; })[0];
    if(d) return { name:d.name, state:d.state, lat:d.lat, lng:d.lng, intl:!!d.intl, dest:d };
    return null;
  }
  function nearestAirport(p){
    var best = null, bd = 1e9;
    D.cities.forEach(function(c){ if(!c.air || c.intl !== !!p.intl) return; var d = haversine(p, c); if(d < bd){ bd = d; best = c; } });
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Scene illustrations (SVG, generated)                               */
  /* ------------------------------------------------------------------ */
  var sceneN = 0;
  function scene(kind, c, label){
    var id = 'sg' + (++sceneN), c1 = c[0], c2 = c[1], c3 = c[2];
    var g = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + c1 + '"/><stop offset="100%" stop-color="' + c2 + '"/></linearGradient></defs><rect width="200" height="200" fill="url(#' + id + ')"/>';
    var s = '', cream = '#FBF7EC', dark = '#123832', wood = '#5A3A22';
    switch(kind){
      case 'beach':
        s = '<circle cx="150" cy="48" r="22" fill="' + cream + '" opacity=".9"/><path d="M0,118 Q100,92 200,114 V200 H0Z" fill="' + c3 + '"/><path d="M0,150 Q100,140 200,152 V200 H0Z" fill="#F2DDA4"/><rect x="38" y="76" width="6" height="80" fill="' + wood + '" transform="rotate(-6 41 116)"/><path d="M40,76 Q66,80 76,96 Q56,86 40,82 Q22,90 10,104 Q20,82 40,76Z" fill="#1F7A4E"/><path d="M40,76 Q52,60 72,62 Q54,68 42,80Z" fill="#1F7A4E"/>';
        break;
      case 'mountain':
        s = '<circle cx="46" cy="44" r="16" fill="' + cream + '" opacity=".85"/><path d="M0,130 L45,70 L80,110 L120,58 L165,112 L200,90 V200 H0Z" fill="' + c3 + '" opacity=".55"/><path d="M0,150 Q60,118 110,140 T200,132 V200 H0Z" fill="' + c3 + '"/><path d="M30,170 L40,140 L50,170Z M150,175 L161,140 L172,175Z M168,178 L176,154 L184,178Z" fill="' + dark + '"/>';
        break;
      case 'snow':
        s = '<path d="M0,150 L50,66 L86,118 L128,46 L170,108 L200,86 V200 H0Z" fill="' + cream + '"/><path d="M50,66 L62,86 L50,82 L42,92Z M128,46 L142,70 L128,64 L118,78Z" fill="#fff"/><path d="M0,150 L50,66 L86,118 L128,46 L170,108 L200,86 V200 H0Z" fill="' + c3 + '" opacity=".25"/><path d="M0,170 Q100,150 200,168 V200 H0Z" fill="#E7EFF4"/><path d="M34,178 L46,140 L58,178Z M140,182 L152,146 L164,182Z M160,184 L169,160 L178,184Z" fill="' + dark + '"/>';
        break;
      case 'fort':
        s = '<circle cx="40" cy="40" r="18" fill="#FDEBD0" opacity=".85"/><path d="M0,150 Q100,128 200,148 V200 H0Z" fill="' + c3 + '" opacity=".6"/><rect x="26" y="104" width="148" height="96" fill="' + c3 + '"/><path d="M26,96 h12 v8 h-12z M48,96 h12 v8 h-12z M70,96 h12 v8 h-12z M92,96 h12 v8 h-12z M114,96 h12 v8 h-12z M136,96 h12 v8 h-12z M158,96 h16 v8 h-16z" fill="' + c3 + '"/><path d="M46,140 a12,12 0 0,1 24,0 V200 H46Z M88,140 a12,12 0 0,1 24,0 V200 H88Z M130,140 a12,12 0 0,1 24,0 V200 H130Z" fill="#F4E3C3" opacity=".85"/><rect x="88" y="66" width="24" height="30" fill="' + c3 + '"/><path d="M84,66 Q100,46 116,66Z" fill="' + c3 + '"/>';
        break;
      case 'palace':
        s = '<circle cx="160" cy="40" r="16" fill="' + cream + '" opacity=".85"/><rect x="40" y="96" width="120" height="50" fill="#F6EBDD"/><path d="M76,96 Q100,58 124,96Z" fill="#F6EBDD"/><rect x="98" y="58" width="4" height="12" fill="#F6EBDD"/><path d="M40,96 Q52,80 64,96Z M136,96 Q148,80 160,96Z" fill="#F6EBDD"/><rect x="34" y="86" width="6" height="60" fill="#F6EBDD"/><rect x="160" y="86" width="6" height="60" fill="#F6EBDD"/><path d="M60,146 v-22 a8,8 0 0,1 16,0 v22Z M92,146 v-26 a8,8 0 0,1 16,0 v26Z M124,146 v-22 a8,8 0 0,1 16,0 v22Z" fill="' + c3 + '" opacity=".35"/><rect x="0" y="146" width="200" height="54" fill="' + c3 + '"/><path d="M40,152 h120 M60,162 h80 M80,172 h40" stroke="#F6EBDD" stroke-opacity=".5" stroke-width="2"/>';
        break;
      case 'lake':
        s = '<path d="M0,120 L40,70 L80,104 L130,52 L200,110 V200 H0Z" fill="' + cream + '" opacity=".85"/><path d="M0,124 L40,92 L80,118 L130,84 L200,122 V200 H0Z" fill="#3E6B52"/><rect y="132" width="200" height="68" fill="' + c3 + '"/><path d="M60,160 Q100,172 140,160 L134,168 Q100,176 66,168Z" fill="' + wood + '"/><path d="M84,160 v-16 h32 v16" fill="none" stroke="' + wood + '" stroke-width="3"/><path d="M80,144 h40 l-6,-8 h-28Z" fill="#B5121B"/>';
        break;
      case 'desert':
        s = '<circle cx="150" cy="54" r="24" fill="#FFF3D6" opacity=".9"/><path d="M0,130 Q60,100 120,130 T200,122 V200 H0Z" fill="' + c2 + '"/><path d="M0,160 Q80,128 140,156 T200,150 V200 H0Z" fill="' + c3 + '"/><path d="M52,124 q4,-12 12,-10 q4,-10 10,-2 q6,-2 6,6 l-2,14 h-3 l-1,-10 h-14 l-2,10 h-3Z M62,114 q-6,-8 -10,-6" fill="' + dark + '" opacity=".85"/>';
        break;
      case 'backwater':
        s = '<path d="M0,140 H200 V200 H0Z" fill="' + c3 + '"/><path d="M44,140 Q96,120 146,140 L154,156 Q96,138 36,156Z" fill="#E9D8B4"/><path d="M60,134 Q96,116 130,134 Z" fill="' + wood + '"/><path d="M30,140 Q30,90 10,80" stroke="#154A2E" stroke-width="6" fill="none"/><path d="M10,80 Q-10,75 -20,90 M10,80 Q20,62 36,64" stroke="#2C7A4B" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M172,140 Q172,96 190,84" stroke="#154A2E" stroke-width="6" fill="none"/><path d="M190,84 Q210,80 218,95 M190,84 Q176,66 160,70" stroke="#2C7A4B" stroke-width="10" fill="none" stroke-linecap="round"/>';
        break;
      case 'temple':
        s = '<circle cx="160" cy="44" r="16" fill="' + cream + '" opacity=".85"/><path d="M0,160 H200 V200 H0Z" fill="' + c3 + '"/><path d="M70,160 L76,104 L86,84 L94,62 L100,50 L106,62 L114,84 L124,104 L130,160Z" fill="' + c3 + '"/><path d="M80,120 h40 M78,138 h44 M86,98 h28" stroke="#F4E3C3" stroke-opacity=".5" stroke-width="2"/><rect x="98" y="38" width="3" height="14" fill="' + c3 + '"/><path d="M101,38 l14,4 l-14,4Z" fill="#E1572B"/><path d="M40,160 L46,130 L52,118 L58,130 L64,160Z M136,160 L142,130 L148,118 L154,130 L160,160Z" fill="' + c3 + '" opacity=".75"/><path d="M90,160 v-14 a10,10 0 0,1 20,0 v14Z" fill="#F4E3C3" opacity=".7"/>';
        break;
      case 'ghat':
        s = '<circle cx="150" cy="46" r="18" fill="#FFE7B0" opacity=".9"/><path d="M0,98 h200 v16 h-200Z M0,112 h200" fill="' + c3 + '" opacity=".4"/><path d="M10,98 L18,70 L26,98Z M60,98 L70,62 L80,98Z M130,98 L138,74 L146,98Z" fill="#8C4A2A"/><path d="M0,104 h200 v6 h-200Z M0,114 h200 v6 h-200Z M0,124 h200 v6 h-200Z" fill="#E9C99B"/><rect y="132" width="200" height="68" fill="' + c3 + '"/><path d="M30,160 Q60,168 90,160 L86,166 Q60,172 34,166Z" fill="' + wood + '"/><circle cx="120" cy="150" r="2.5" fill="#FFC857"/><circle cx="140" cy="158" r="2.5" fill="#FFC857"/><circle cx="160" cy="148" r="2.5" fill="#FFC857"/>';
        break;
      case 'city':
        s = '<circle cx="40" cy="40" r="16" fill="' + cream + '" opacity=".8"/><rect x="20" y="110" width="22" height="90" fill="' + c3 + '" opacity=".7"/><rect x="46" y="88" width="20" height="112" fill="' + c3 + '"/><rect x="72" y="56" width="16" height="144" fill="' + dark + '"/><polygon points="80,22 88,56 72,56" fill="' + dark + '"/><rect x="94" y="96" width="22" height="104" fill="' + c3 + '"/><rect x="122" y="76" width="18" height="124" fill="' + c3 + '" opacity=".8"/><rect x="146" y="118" width="30" height="82" fill="' + dark + '" opacity=".85"/><path d="M0,184 H200 V200 H0Z" fill="' + dark + '"/>';
        break;
      case 'forest':
        s = '<circle cx="150" cy="44" r="18" fill="#FFE9B8" opacity=".85"/><path d="M0,150 Q100,130 200,150 V200 H0Z" fill="' + c3 + '"/><path d="M20,170 L36,104 L52,170Z M56,176 L76,92 L96,176Z M110,172 L126,110 L142,172Z M146,178 L166,96 L186,178Z" fill="' + dark + '" opacity=".9"/><path d="M100,180 q6,-14 18,-12 q8,-2 10,6 l-2,8 h-3 l-1,-5 h-14 l-2,5 h-3Z" fill="#D9862E"/><path d="M106,174 l2,4 M112,172 l2,5 M118,172 l1,5" stroke="' + dark + '" stroke-width="1.5"/>';
        break;
      case 'tea':
        s = '<circle cx="156" cy="42" r="16" fill="' + cream + '" opacity=".85"/><path d="M0,96 Q60,70 120,92 T200,84 V200 H0Z" fill="' + c2 + '"/><path d="M0,130 Q80,100 200,126 V200 H0Z" fill="' + c3 + '"/><path d="M0,146 Q80,118 200,142 M0,162 Q80,136 200,158 M0,178 Q80,154 200,174 M0,194 Q80,172 200,190" stroke="#E4F0D0" stroke-opacity=".45" stroke-width="3" fill="none"/>';
        break;
      case 'island':
        s = '<circle cx="160" cy="40" r="18" fill="' + cream + '" opacity=".9"/><path d="M0,130 H200 V200 H0Z" fill="' + c3 + '"/><path d="M20,132 Q60,112 100,132Z" fill="#F2DDA4"/><path d="M58,126 Q58,96 70,86" stroke="' + wood + '" stroke-width="4" fill="none"/><path d="M70,86 Q86,84 92,96 M70,86 Q60,74 46,80" stroke="#1F7A4E" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="128" y="120" width="4" height="22" fill="' + wood + '"/><rect x="156" y="120" width="4" height="22" fill="' + wood + '"/><polygon points="118,122 144,122 136,108 126,108" fill="#EFE1C4"/><polygon points="146,122 172,122 164,108 154,108" fill="#EFE1C4"/><path d="M120,142 h56" stroke="' + wood + '" stroke-width="3"/>';
        break;
      case 'monastery':
        s = '<path d="M0,120 L50,60 L90,100 L140,44 L200,104 V200 H0Z" fill="' + c2 + '" opacity=".7"/><path d="M0,150 Q100,126 200,150 V200 H0Z" fill="' + c3 + '"/><rect x="66" y="104" width="68" height="46" fill="#F7F1E4"/><rect x="66" y="104" width="68" height="8" fill="#8E2A2A"/><rect x="84" y="88" width="32" height="16" fill="#F7F1E4"/><rect x="84" y="88" width="32" height="5" fill="#8E2A2A"/><path d="M96,88 l4,-10 l4,10Z" fill="#D8A73C"/><path d="M76,124 h8 v10 h-8Z M96,124 h8 v10 h-8Z M116,124 h8 v10 h-8Z" fill="' + dark + '" opacity=".6"/><path d="M10,70 Q50,86 90,74" stroke="#fff" stroke-width="1" fill="none"/><g><rect x="20" y="74" width="6" height="6" fill="#E1572B"/><rect x="34" y="78" width="6" height="6" fill="#F2C94C"/><rect x="48" y="80" width="6" height="6" fill="#2D9CDB"/><rect x="62" y="79" width="6" height="6" fill="#27AE60"/><rect x="76" y="76" width="6" height="6" fill="#fff"/></g>';
        break;
      case 'falls':
        s = '<path d="M0,40 L70,40 L80,200 H0Z" fill="' + c3 + '"/><path d="M130,30 L200,30 V200 H120Z" fill="' + c3 + '"/><rect x="78" y="40" width="44" height="130" fill="#EAF6F6" opacity=".9"/><path d="M80,60 v100 M92,50 v120 M104,46 v124 M116,56 v110" stroke="#BFE3E6" stroke-width="2"/><ellipse cx="100" cy="176" rx="50" ry="12" fill="#fff" opacity=".7"/><path d="M0,180 H200 V200 H0Z" fill="#2B6B78"/>';
        break;
      default: s = '';
    }
    return '<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + g + s + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* i18n (English / Hindi)                                             */
  /* ------------------------------------------------------------------ */
  var I18N = {
    hi: {
      support:'24×7 सहायता', nav_explore:'भारत घूमें', nav_holidays:'हॉलिडे पैकेज', nav_offers:'ऑफ़र', nav_festivals:'त्योहार', nav_tools:'ट्रैवल टूल्स', nav_contact:'संपर्क',
      my_trips:'मेरी यात्राएँ', login:'लॉग इन / साइन अप',
      hero_eyebrow:'फ़्लाइट · होटल · ट्रेन · बस · हॉलिडे', hero_title:'कश्मीर से कन्याकुमारी, <em>सब एक जगह</em>',
      hero_sub:'अपनी पूरी यात्रा एक ही जगह बुक करें — तत्काल ट्रेन से हाउसबोट तक, सही दाम और GST बिल के साथ।',
      tab_flights:'फ़्लाइट', tab_hotels:'होटल', tab_trains:'ट्रेन', tab_buses:'बस', tab_cabs:'कैब', tab_holidays:'हॉलिडे', tab_visa:'वीज़ा', tab_forex:'फ़ॉरेक्स', tab_insurance:'बीमा',
      oneway:'एक तरफ़', round:'आना-जाना', from:'कहाँ से', to:'कहाँ तक', depart:'प्रस्थान', 'return':'वापसी', return_hint:'वापसी जोड़ने के लिए टैप करें', travellers_class:'यात्री और क्लास',
      special_fares:'विशेष किराया', search_flights:'फ़्लाइट खोजें', city_property:'शहर, इलाका या होटल', checkin:'चेक-इन', checkout:'चेक-आउट', rooms_guests:'कमरे और मेहमान', price_night:'प्रति रात कीमत',
      search_hotels:'होटल खोजें', journey_date:'यात्रा की तारीख़', 'class':'क्लास', quota:'कोटा', check_pnr:'PNR स्थिति देखें', search_trains:'ट्रेन खोजें', search_buses:'बस खोजें', search_cabs:'कैब खोजें', find_packages:'पैकेज खोजें',
      recent:'हाल की खोजें', trust1:'24×7 सहायता', trust1s:'कॉल, चैट या WhatsApp — हिंदी या अंग्रेज़ी में', trust2:'सुरक्षित भुगतान', trust2s:'UPI, कार्ड, नेट बैंकिंग और EMI', trust3:'कोई छुपा शुल्क नहीं', trust3s:'भुगतान से पहले पूरा किराया और GST', trust4:'हर यात्रा पर WL कॉइन्स', trust4s:'2% वापस पाएँ, अगली बुकिंग में इस्तेमाल करें',
      offers_eyebrow:'कूपन और डील', offers_title:'आपके लिए ऑफ़र', explore_eyebrow:'अगला सफ़र कहाँ?', explore_title:'अतुल्य भारत घूमें', explore_sub:'हिमालय के दर्रों से अंडमान की चट्टानों तक तीस से ज़्यादा ठिकाने। सही मौसम, पहुँचने का तरीका और खाने की जानकारी के लिए टिकट पर टैप करें।',
      pkg_eyebrow:'किराया और कार्यक्रम', pkg_title:'हॉलिडे पैकेज', pkg_sub:'होटल, ट्रांसफ़र और दर्शनीय स्थल शामिल। ₹10,000 से ऊपर के पैकेज आसान EMI में।',
      fest_eyebrow:'मेले के हिसाब से योजना', fest_title:'त्योहार कैलेंडर', fest_sub:'कई तारीख़ें चंद्र पंचांग से तय होती हैं और हर साल बदलती हैं। त्योहारों के हफ़्ते जल्दी भर जाते हैं।',
      tools_eyebrow:'जाने से पहले', tools_title:'ट्रैवल टूल्स', guides_eyebrow:'पैकिंग से पहले पढ़ें', guides_title:'यात्रा गाइड', rev_eyebrow:'यात्रियों के पोस्टकार्ड', rev_title:'हमारे मेहमान क्या कहते हैं', faq_title:'अक्सर पूछे जाने वाले सवाल',
      contact_eyebrow:'संपर्क करें', contact_title:'अपनी पसंद की यात्रा बनवाएँ'
    }
  };
  var lang = store.get('lang', 'en');
  var EN = {};
  function applyLang(){
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    $$('[data-i18n]').forEach(function(el){
      var k = el.getAttribute('data-i18n');
      if(!(k in EN)) EN[k] = el.textContent;
      el.textContent = lang === 'hi' && I18N.hi[k] ? I18N.hi[k] : EN[k];
    });
    $$('[data-i18n-html]').forEach(function(el){
      var k = el.getAttribute('data-i18n-html');
      if(!(k in EN)) EN[k] = el.innerHTML;
      el.innerHTML = lang === 'hi' && I18N.hi[k] ? I18N.hi[k] : EN[k];
    });
    if(WL.user && WL.user()) { var ll = $('#loginLabel'); if(ll) ll.textContent = WL.user().name.split(' ')[0]; }
  }

  /* ------------------------------------------------------------------ */
  /* Theme                                                              */
  /* ------------------------------------------------------------------ */
  var theme = store.get('theme', null);
  function currentDark(){ return theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function applyTheme(){
    if(theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme');
    var btn = $('#themeToggle'); btn.innerHTML = '<svg class="ic"><use href="#' + (currentDark() ? 'i-sun' : 'i-moon') + '"/></svg>';
    btn.setAttribute('aria-label', currentDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }

  /* ------------------------------------------------------------------ */
  /* Header & navigation                                                */
  /* ------------------------------------------------------------------ */
  function initHeader(){
    var navToggle = $('#navToggle'), navLinks = $('#navLinks');
    function setNav(open){
      navLinks.classList.toggle('open', open); navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false'); navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    navToggle.addEventListener('click', function(){ setNav(!navLinks.classList.contains('open')); });
    $$('.nav-link').forEach(function(l){ l.addEventListener('click', function(){ setNav(false); }); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && navLinks.classList.contains('open')) setNav(false); });

    var header = $('#header');
    window.addEventListener('scroll', function(){ header.classList.toggle('scrolled', window.scrollY > 10); }, { passive:true });

    // smooth anchor scroll with header offset
    document.addEventListener('click', function(e){
      var a = e.target.closest('a[href^="#"]'); if(!a) return;
      var id = a.getAttribute('href'); if(id.length < 2) return;
      var target = document.getElementById(id.slice(1)); if(!target) return;
      e.preventDefault();
      var tab = a.getAttribute('data-tab-link'); if(tab && WL.selectTab) WL.selectTab(tab);
      var top = target.getBoundingClientRect().top + window.scrollY - header.offsetHeight + 1;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    var sections = $$('main section[id]'), links = $$('.nav-link');
    if('IntersectionObserver' in window){
      var obs = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ if(en.isIntersecting){ links.forEach(function(l){ l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id); }); } });
      }, { rootMargin:'-45% 0px -50% 0px' });
      sections.forEach(function(s){ obs.observe(s); });
    }

    $('#langSelect').value = lang;
    $('#langSelect').addEventListener('change', function(){ lang = this.value; store.set('lang', lang); applyLang(); toast(lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English'); });
    $('#currencySelect').value = currency;
    $('#currencySelect').addEventListener('change', function(){ currency = this.value; store.set('currency', currency); refreshMoney(); toast(currency === 'USD' ? 'Showing prices in US$ (indicative)' : 'Showing prices in ₹ INR'); });
    $('#themeToggle').addEventListener('click', function(){ theme = currentDark() ? 'light' : 'dark'; store.set('theme', theme); applyTheme(); });

    $('#year').textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------ */
  /* Datalists                                                          */
  /* ------------------------------------------------------------------ */
  function initDatalists(){
    $('#airportList').innerHTML = D.cities.filter(function(c){ return c.air; }).map(function(c){ return '<option value="' + esc(c.name + ' (' + c.air + ')') + '">' + esc(c.airName + ', ' + c.state) + '</option>'; }).join('');
    $('#stationList').innerHTML = D.cities.filter(function(c){ return c.rail; }).map(function(c){ return '<option value="' + esc(c.railName + ' (' + c.rail + ')') + '">' + esc(c.name + ', ' + c.state) + '</option>'; }).join('');
    var names = {}; INDIA.forEach(function(c){ names[c.name] = c.state; });
    D.destinations.forEach(function(d){ if(!names[d.name]) names[d.name] = d.state; });
    D.cities.filter(function(c){ return c.intl; }).forEach(function(c){ names[c.name] = c.state; });
    $('#cityList').innerHTML = Object.keys(names).sort().map(function(n){ return '<option value="' + esc(n) + '">' + esc(names[n]) + '</option>'; }).join('');
    var themes = ['Honeymoon','Pilgrimage','Adventure','Hill stations','Beaches','Heritage','Wildlife','North East','International','Weekend'];
    $('#holidayList').innerHTML = D.destinations.map(function(d){ return '<option value="' + esc(d.name) + '"></option>'; }).join('') + themes.map(function(t){ return '<option value="' + t + '">Theme</option>'; }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Wishlist                                                           */
  /* ------------------------------------------------------------------ */
  var wish = store.get('wish', []);
  function isWished(id){ return wish.indexOf(id) > -1; }
  function toggleWish(id){
    var i = wish.indexOf(id);
    if(i > -1) wish.splice(i, 1); else wish.push(id);
    store.set('wish', wish); updateWishUI();
    toast(i > -1 ? 'Removed from wishlist' : 'Saved to wishlist');
    return i === -1;
  }
  function updateWishUI(){
    var b = $('#wishCount'); b.textContent = wish.length; b.hidden = wish.length === 0;
    $$('[data-wish]').forEach(function(btn){
      var on = isWished(btn.getAttribute('data-wish'));
      btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-wish]'); if(!b) return;
    e.preventDefault(); e.stopPropagation(); toggleWish(b.getAttribute('data-wish'));
  });
  function heartBtn(id, name){ return '<button class="heart-btn' + (isWished(id) ? ' on' : '') + '" data-wish="' + id + '" aria-pressed="' + (isWished(id) ? 'true' : 'false') + '" aria-label="Save ' + esc(name) + ' to wishlist"><svg class="ic"><use href="#i-heart"/></svg></button>'; }

  /* ------------------------------------------------------------------ */
  /* Offers                                                             */
  /* ------------------------------------------------------------------ */
  var CAT_LABEL = { flights:'Flights', hotels:'Hotels', holidays:'Holidays', trains:'Trains', buses:'Bus', cabs:'Cabs', all:'All bookings' };
  function renderOffers(cat){
    var list = D.offers.filter(function(o){ return cat === 'all' || o.cat === cat || o.cat === 'all' || (cat === 'buses' && o.cat === 'cabs'); });
    $('#offerRail').innerHTML = list.map(function(o){
      return '<article class="coupon"><div class="coupon-top"><span class="coupon-cat">' + CAT_LABEL[o.cat] + '</span><h3>' + esc(o.title) + '</h3><p>' + esc(o.detail) + '</p></div>' +
        '<div class="coupon-foot"><span class="code">' + o.code + '</span><button class="copy-code" data-copy="' + o.code + '">Copy code</button></div></article>';
    }).join('');
  }
  function initOffers(){
    renderOffers('all');
    $('#offerTabs').addEventListener('click', function(e){
      var b = e.target.closest('.f-tab'); if(!b) return;
      $$('#offerTabs .f-tab').forEach(function(x){ x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      renderOffers(b.getAttribute('data-cat'));
    });
  }
  // generic copy buttons
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-copy]'); if(!b) return;
    var txt = b.getAttribute('data-copy');
    function done(){ var o = b.textContent; b.textContent = 'Copied'; setTimeout(function(){ b.textContent = o; }, 1500); toast('Copied: ' + txt); }
    try {
      navigator.clipboard.writeText(txt).then(done, function(){ toast(txt + ' — select and copy it manually'); });
    } catch(err){ toast(txt + ' — select and copy it manually'); }
  });

  /* ------------------------------------------------------------------ */
  /* Destinations                                                       */
  /* ------------------------------------------------------------------ */
  var THEMES = [['all','All'],['hill','Hill stations'],['beach','Beaches'],['heritage','Heritage'],['spiritual','Spiritual'],['wildlife','Wildlife'],['adventure','Adventure'],['northeast','North East'],['desert','Desert'],['honeymoon','Honeymoon'],['weekend','Weekend'],['international','International']];
  var destTheme = 'all', destAll = false;
  function destCard(d){
    return '<div class="dest-card">' + heartBtn('d:' + d.id, d.name) +
      '<button class="dest-open" data-dest="' + d.id + '" aria-label="' + esc(d.name + ' — details') + '"><div class="stamp">' + scene(d.scene[0], d.scene[1]) + '</div>' +
      '<h3 class="dest-name">' + esc(d.name) + '</h3><span class="dest-code">' + d.code + ' · ' + (d.intl ? d.state.toUpperCase().slice(0, 3) : 'IN') + '</span>' +
      '<p class="dest-tagline">' + esc(d.tagline) + '</p><p class="dest-from">from ' + money(d.from) + '</p></button></div>';
  }
  function renderDest(){
    var list = D.destinations.filter(function(d){ return destTheme === 'all' ? !d.intl : d.themes.indexOf(destTheme) > -1; });
    var shown = destAll ? list : list.slice(0, 12);
    $('#destGrid').innerHTML = shown.length ? shown.map(destCard).join('') : '<p class="muted">No destinations for this theme yet.</p>';
    var more = $('#destMore'); more.hidden = list.length <= 12; more.textContent = destAll ? 'Show fewer' : 'Show all ' + list.length + ' destinations';
  }
  function initDest(){
    $('#themeChips').innerHTML = THEMES.map(function(t){ return '<button class="f-tab' + (t[0] === 'all' ? ' active' : '') + '" data-theme-f="' + t[0] + '" aria-pressed="' + (t[0] === 'all') + '">' + t[1] + '</button>'; }).join('');
    $('#themeChips').addEventListener('click', function(e){
      var b = e.target.closest('[data-theme-f]'); if(!b) return;
      destTheme = b.getAttribute('data-theme-f'); destAll = false;
      $$('#themeChips .f-tab').forEach(function(x){ x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderDest();
    });
    $('#destMore').addEventListener('click', function(){ destAll = !destAll; renderDest(); });
    renderDest();
    document.addEventListener('click', function(e){
      var b = e.target.closest('[data-dest]'); if(!b) return;
      openDestination(b.getAttribute('data-dest'));
    });
  }
  function openDestination(id){
    var d = D.destinations.filter(function(x){ return x.id === id; })[0]; if(!d) return;
    var pk = D.packages.filter(function(p){ return p.dest === d.id; });
    var months = MONTHS.map(function(m, i){ return '<span class="' + (d.months.indexOf(i + 1) > -1 ? 'good' : '') + '" title="' + MONTHS_FULL[i] + (d.months.indexOf(i + 1) > -1 ? ': good time to visit' : '') + '">' + m[0] + '</span>'; }).join('');
    var html = '<div class="d-hero">' + scene(d.scene[0], d.scene[1], d.name + ' illustration') + '</div>' +
      '<p class="eyebrow">' + esc(d.state) + ' · ' + esc(d.tagline) + '</p><p>' + esc(d.about) + '</p>' +
      '<div class="facts"><div class="fact"><span>Best time</span><b>' + esc(d.best) + '</b></div><div class="fact"><span>Ideal trip</span><b>' + esc(d.days) + '</b></div>' +
      '<div class="fact"><span>By air</span><b>' + esc(d.reach.air) + '</b></div><div class="fact"><span>By rail</span><b>' + esc(d.reach.rail) + '</b></div></div>' +
      '<div><p class="chip-label" style="margin-bottom:6px">Month by month</p><div class="month-bar" aria-label="Good months highlighted">' + months + '</div></div>' +
      '<div><h3 style="font-size:1.05rem;margin-bottom:8px">Top things to do</h3><ul class="d-list">' + d.todo.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h3 style="font-size:1.05rem;margin-bottom:8px">Must-try food</h3><div class="incl">' + d.food.map(function(f){ return '<span class="pill">' + esc(f) + '</span>'; }).join('') + '</div></div>' +
      '<div class="d-actions">' +
        '<button class="btn btn-accent btn-sm" data-plan="flights" data-to="' + d.id + '"><svg class="ic"><use href="#i-plane"/></svg> Flights</button>' +
        '<button class="btn btn-ink btn-sm" data-plan="hotels" data-to="' + d.id + '"><svg class="ic"><use href="#i-hotel"/></svg> Hotels</button>' +
        (pk.length ? '<button class="btn btn-outline-ink btn-sm" data-plan="packages" data-to="' + d.id + '" style="grid-column:1/-1"><svg class="ic"><use href="#i-palm"/></svg> ' + pk.length + ' package' + (pk.length > 1 ? 's' : '') + ' from ' + money(Math.min.apply(null, pk.map(function(p){ return p.price; }))) + '</button>' : '') +
      '</div>' + heartBtn('d:' + d.id, d.name).replace('heart-btn', 'heart-btn inline-heart');
    WL.openDrawer(d.name, html);
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-plan]'); if(!b) return;
    var kind = b.getAttribute('data-plan'), id = b.getAttribute('data-to');
    var d = D.destinations.filter(function(x){ return x.id === id; })[0];
    WL.closeDrawer(); WL.closeModal();
    if(kind === 'packages'){ WL.filterPackages({ dest:id, label:d.name }); return; }
    if(WL.prefillSearch) WL.prefillSearch(kind, d);
  });
  WL.openDestination = openDestination;

  /* ------------------------------------------------------------------ */
  /* Weekend getaways                                                   */
  /* ------------------------------------------------------------------ */
  function initGetaways(){
    var hubs = ['Delhi','Mumbai','Bengaluru','Chennai','Kolkata','Hyderabad','Pune','Ahmedabad','Jaipur','Lucknow','Chandigarh','Kochi','Guwahati','Bhubaneswar','Indore'];
    var sel = $('#getawayCity');
    sel.innerHTML = hubs.map(function(h){ return '<option>' + h + '</option>'; }).join('');
    sel.value = store.get('homeCity', 'Delhi');
    function render(){
      var c = D.cities.filter(function(x){ return x.name === sel.value; })[0];
      var pool = D.getaways.map(function(g){ return { name:g[0], lat:g[1], lng:g[2], type:g[3] }; })
        .concat(D.destinations.filter(function(d){ return !d.intl; }).map(function(d){ return { name:d.name, lat:d.lat, lng:d.lng, type:d.themes[0], id:d.id }; }))
        .concat(INDIA.filter(function(x){ return x.name !== c.name; }).map(function(x){ return { name:x.name, lat:x.lat, lng:x.lng, type:'city' }; }));
      var seen = {};
      var list = pool.map(function(p){ return { p:p, km:Math.round(haversine(c, p) * 1.3 / 10) * 10 }; })
        .filter(function(x){ if(seen[x.p.name] || x.km < 60 || x.km > 450) return false; seen[x.p.name] = 1; return true; })
        .sort(function(a, b){ return (a.p.type === 'city') - (b.p.type === 'city') || a.km - b.km; }).slice(0, 12);
      $('#getawayList').innerHTML = list.length ? list.map(function(x){
        var hrs = Math.max(1, Math.round(x.km / 50));
        return '<button class="getaway" ' + (x.p.id ? 'data-dest="' + x.p.id + '"' : 'data-getaway="' + esc(x.p.name) + '"') + '><span class="km">' + x.km + '<small>km</small></span><span><strong>' + esc(x.p.name) + '</strong><span class="t">' + (x.p.type === 'city' ? 'city break' : x.p.type) + ' · ~' + hrs + ' hr drive</span></span></button>';
      }).join('') : '<p class="muted">No getaways within 450 km in our list yet.</p>';
    }
    sel.addEventListener('change', function(){ store.set('homeCity', sel.value); render(); });
    render();
    document.addEventListener('click', function(e){
      var b = e.target.closest('[data-getaway]'); if(!b) return;
      WL.prefillSearch('cab-getaway', { name:b.getAttribute('data-getaway'), from:sel.value });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Holiday packages                                                   */
  /* ------------------------------------------------------------------ */
  var pkgState = { tab:'all', sort:'pop', q:null };
  function destOf(p){ return D.destinations.filter(function(d){ return d.id === p.dest; })[0]; }
  function pkgCard(p){
    var d = destOf(p);
    var emi = p.price >= 10000 ? '<span class="emi">EMI from ' + money(Math.ceil(p.price * 2 / 6)) + '/mo</span>' : '';
    var incl = ['Stay','Transfers','Sightseeing'].concat(p.flights ? ['Flights'] : []).concat([p.meals]).concat(p.visa ? ['Visa assistance'] : []);
    return '<article class="ticket-card" data-pkg-card="' + p.id + '">' +
      '<div class="ticket-main"><div class="ticket-scene">' + scene(d.scene[0], d.scene[1], d.name) + '<span class="ticket-tag">' + esc(p.tag) + '</span>' + heartBtn('p:' + p.id, p.title) + '</div>' +
      '<h3>' + esc(p.title) + '</h3><p class="route">' + esc(p.route) + '</p>' +
      '<div class="incl">' + incl.map(function(i){ return '<span>' + esc(i) + '</span>'; }).join('') + '</div>' +
      '<div class="ticket-actions"><button class="text-link" data-pkg="' + p.id + '">View itinerary</button></div></div>' +
      '<div class="perforation"></div>' +
      '<div class="ticket-stub"><span class="duration">' + p.nights + 'N / ' + (p.nights + 1) + 'D</span>' +
      '<span class="was">' + money(p.was) + '</span><span class="price">' + money(p.price) + '</span><span class="pp">per person' + (p.flights ? ', incl. flights' : '') + '</span>' + emi +
      '<div class="barcode" aria-hidden="true"></div><button class="btn btn-accent book-btn" data-book-pkg="' + p.id + '">Book now</button></div></article>';
  }
  function renderPackages(){
    var s = pkgState, list = D.packages.slice();
    if(s.tab === 'india') list = list.filter(function(p){ return !destOf(p).intl; });
    else if(s.tab !== 'all') list = list.filter(function(p){ return p.themes.indexOf(s.tab) > -1; });
    if(s.q){
      list = list.filter(function(p){
        var d = destOf(p), ok = true;
        if(s.q.dest) ok = ok && p.dest === s.q.dest;
        if(s.q.theme) ok = ok && p.themes.indexOf(s.q.theme) > -1;
        if(s.q.text) ok = ok && (p.title + ' ' + d.name + ' ' + d.state + ' ' + p.route).toLowerCase().indexOf(s.q.text) > -1;
        if(s.q.nights) ok = ok && p.nights >= s.q.nights[0] && p.nights <= s.q.nights[1];
        if(s.q.budget) ok = ok && p.price >= s.q.budget[0] && p.price <= s.q.budget[1];
        if(s.q.month) ok = ok && d.months.indexOf(s.q.month) > -1;
        return ok;
      });
    }
    if(s.sort === 'low') list.sort(function(a, b){ return a.price - b.price; });
    if(s.sort === 'high') list.sort(function(a, b){ return b.price - a.price; });
    if(s.sort === 'short') list.sort(function(a, b){ return a.nights - b.nights; });
    var note = $('#pkgNote');
    if(s.q){ note.hidden = false; note.innerHTML = '<span>Showing ' + list.length + ' package' + (list.length === 1 ? '' : 's') + ' for <strong>' + esc(s.q.label) + '</strong></span><button class="text-link" id="clearPkg">Clear filter</button>'; }
    else note.hidden = true;
    $('#packagesGrid').innerHTML = list.length ? list.map(pkgCard).join('') :
      '<div class="empty" style="grid-column:1/-1"><strong>No ready-made package matches yet.</strong><span>Our trip experts can build one around your dates and budget.</span><a class="btn btn-accent btn-sm" href="#contact">Request a custom trip</a></div>';
  }
  function initPackages(){
    renderPackages();
    $('#pkgTabs').addEventListener('click', function(e){
      var b = e.target.closest('.f-tab'); if(!b) return;
      $$('#pkgTabs .f-tab').forEach(function(x){ x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      pkgState.tab = b.getAttribute('data-pf'); renderPackages();
    });
    $('#pkgSort').addEventListener('change', function(){ pkgState.sort = this.value; renderPackages(); });
    document.addEventListener('click', function(e){
      if(e.target.id === 'clearPkg'){ pkgState.q = null; renderPackages(); return; }
      var v = e.target.closest('[data-pkg]'); if(v){ openPackage(v.getAttribute('data-pkg')); return; }
      var b = e.target.closest('[data-book-pkg]'); if(b){ WL.closeModal(); WL.bookPackage(b.getAttribute('data-book-pkg')); }
    });
  }
  function openPackage(id){
    var p = D.packages.filter(function(x){ return x.id === id; })[0], d = destOf(p);
    var inc = ['Hotel: ' + p.hotel + ' (' + p.nights + ' nights, twin sharing)', 'Meals: ' + p.meals, 'All transfers & sightseeing by private AC vehicle', 'Driver allowance, tolls & parking'].concat(p.flights ? ['Return economy flights from Delhi or Mumbai'] : []).concat(p.visa ? ['Tourist visa assistance'] : []);
    var exc = ['Personal expenses & tips','Entry tickets unless mentioned','Anything not listed under inclusions'].concat(p.flights ? [] : ['Flights / trains to the start point']).concat(d.intl ? ['TCS (5%) collected at payment, adjustable against income tax'] : []);
    var html = '<p class="modal-eyebrow">' + esc(p.tag) + ' · ' + p.nights + 'N / ' + (p.nights + 1) + 'D</p><h3 id="modalTitle">' + esc(p.title) + '</h3><p class="route">' + esc(p.route) + '</p>' +
      '<div class="modal-body"><div class="ticket-scene" style="height:150px">' + scene(d.scene[0], d.scene[1], d.name) + '</div>' +
      '<ol class="itin">' + p.days.map(function(t, i){ return '<li><b>Day ' + (i + 1) + '</b>' + esc(t) + '</li>'; }).join('') + '</ol>' +
      '<div class="ie-grid"><div><h4 style="color:var(--ok)">Included</h4><ul>' + inc.map(function(x){ return '<li>✓ ' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h4 style="color:var(--bad)">Not included</h4><ul>' + exc.map(function(x){ return '<li>✕ ' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
      '<div class="sum-total" style="font-size:1.2rem"><span>From</span><span>' + money(p.price) + ' <small style="font-family:var(--font-body);font-size:.75rem;font-weight:400;color:var(--muted)">per person</small></span></div>' +
      '<div class="d-actions"><button class="btn btn-accent" data-book-pkg="' + p.id + '">Book this package</button><a class="btn btn-outline-ink" href="#contact" data-customise="' + esc(p.title) + '">Customise it</a></div></div>';
    WL.openModal(html, true);
  }
  document.addEventListener('click', function(e){
    var c = e.target.closest('[data-customise]'); if(!c) return;
    WL.closeModal(); $('#cdest').value = c.getAttribute('data-customise'); $('#cmessage').value = 'I would like to customise the "' + c.getAttribute('data-customise') + '" package.';
  });
  WL.filterPackages = function(q){
    pkgState.q = q; pkgState.tab = 'all';
    $$('#pkgTabs .f-tab').forEach(function(x, i){ x.classList.toggle('active', i === 0); x.setAttribute('aria-selected', i === 0 ? 'true' : 'false'); });
    renderPackages();
    var t = $('#holidays'); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - $('#header').offsetHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  /* ------------------------------------------------------------------ */
  /* Festivals                                                          */
  /* ------------------------------------------------------------------ */
  function initFestivals(){
    var cur = new Date().getMonth() + 1;
    function has(m){ return D.festivals.some(function(f){ return f.m.indexOf(m) > -1; }); }
    $('#monthStrip').innerHTML = MONTHS.map(function(m, i){ return '<button class="m-btn' + (i + 1 === cur ? ' active' : '') + '" role="tab" aria-selected="' + (i + 1 === cur) + '" data-m="' + (i + 1) + '" aria-label="' + MONTHS_FULL[i] + '">' + m + (has(i + 1) ? '<i class="dot" aria-hidden="true"></i>' : '') + '</button>'; }).join('');
    function render(m){
      var list = D.festivals.filter(function(f){ return f.m.indexOf(m) > -1; });
      $('#festGrid').innerHTML = list.length ? list.map(function(f){
        return '<article class="fest"><span class="when">' + f.m.map(function(x){ return MONTHS[x - 1]; }).join(' / ') + '</span><h3>' + esc(f.name) + '</h3><span class="place"><svg class="ic"><use href="#i-pin"/></svg>' + esc(f.place) + '</span><p>' + esc(f.text) + '</p>' +
          (f.dest ? '<button class="text-link" data-dest="' + f.dest + '">Plan a trip →</button>' : '') + '</article>';
      }).join('') : '<p style="color:var(--on-deep-muted)">A quieter month for big festivals, which means better hotel prices.</p>';
    }
    $('#monthStrip').addEventListener('click', function(e){
      var b = e.target.closest('.m-btn'); if(!b) return;
      $$('#monthStrip .m-btn').forEach(function(x){ x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      render(+b.getAttribute('data-m'));
    });
    render(cur);
  }

  /* ------------------------------------------------------------------ */
  /* Tools: budget planner & EMI (PNR handled in booking.js)            */
  /* ------------------------------------------------------------------ */
  function initTools(){
    var sel = $('#bdDest');
    sel.innerHTML = D.destinations.map(function(d){ return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('');
    sel.value = 'kerala';
    function budget(){
      var d = D.destinations.filter(function(x){ return x.id === sel.value; })[0];
      var days = Math.min(30, Math.max(1, +$('#bdDays').value || 1)), ppl = Math.min(20, Math.max(1, +$('#bdPeople').value || 1)), style = +$('#bdStyle').value;
      var intl = !!d.intl, rooms = Math.ceil(ppl / 2);
      var nightly = (intl ? 5500 : 3200) * style, food = (intl ? 1800 : 900) * style, local = (intl ? 2200 : 1400) * style;
      var travel = (intl ? 26000 : 7000) * (style > 1 ? 1.4 : style < 1 ? 0.7 : 1);
      var parts = [['Stay', nightly * rooms * Math.max(1, days - 1)], ['Travel', travel * ppl], ['Food', food * days * ppl], ['Local & sights', local * days * Math.ceil(ppl / 3)]];
      var total = parts.reduce(function(s, p){ return s + p[1]; }, 0);
      var max = Math.max.apply(null, parts.map(function(p){ return p[1]; }));
      $('#budgetOut').innerHTML = '<p class="muted small">Estimated total for ' + ppl + ' traveller' + (ppl > 1 ? 's' : '') + ', ' + days + ' day' + (days > 1 ? 's' : '') + '</p><div class="big-num">' + money(Math.round(total / 500) * 500) + '</div>' +
        '<p class="small muted">≈ ' + money(Math.round(total / ppl / 100) * 100) + ' per person</p><div class="split">' +
        parts.map(function(p){ return '<div class="split-row"><span>' + p[0] + '</span><span class="split-bar"><i style="width:' + Math.round(p[1] / max * 100) + '%"></i></span><b>' + money(Math.round(p[1] / 100) * 100) + '</b></div>'; }).join('') + '</div>';
    }
    ['#bdDest','#bdDays','#bdPeople','#bdStyle'].forEach(function(s){ $(s).addEventListener('input', budget); $(s).addEventListener('change', budget); });
    $('#budgetForm').addEventListener('submit', function(e){ e.preventDefault(); budget(); });
    budget();

    function emi(){
      var P = Math.max(0, +$('#emiAmt').value || 0), n = +$('#emiTenure').value;
      var rate = n === 9 ? 0.13 : n === 12 ? 0.14 : 0, r = rate / 12;
      var m = r ? P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : P / n;
      var interest = m * n - P;
      $('#emiOut').innerHTML = P < 10000 ? '<p class="small" style="color:var(--bad)">EMI is available on trips of ₹10,000 or more.</p>' :
        '<p class="muted small">Monthly instalment</p><div class="big-num">' + money(Math.ceil(m)) + '<small style="font-size:.9rem;font-weight:500"> × ' + n + '</small></div>' +
        '<p class="small muted">' + (rate ? 'Interest ' + money(Math.round(interest)) + ' at ' + (rate * 100) + '% p.a. Total ' + money(Math.round(m * n)) + '.' : 'No-cost EMI: the interest is given back as an instant discount.') + ' Eligible credit cards only.</p>';
    }
    ['#emiAmt','#emiTenure'].forEach(function(s){ $(s).addEventListener('input', emi); $(s).addEventListener('change', emi); });
    $('#emiForm').addEventListener('submit', function(e){ e.preventDefault(); emi(); });
    emi();
  }

  /* ------------------------------------------------------------------ */
  /* Guides, FAQ                                                        */
  /* ------------------------------------------------------------------ */
  function initGuides(){
    $('#guideGrid').innerHTML = D.guides.map(function(g){
      return '<button class="guide" data-guide="' + g.id + '"><span class="g-tag">' + esc(g.tag) + '</span><h3>' + esc(g.title) + '</h3><p>' + esc(g.body[0]) + '</p><span class="g-read"><svg class="ic"><use href="#i-clock"/></svg>' + g.read + ' read</span></button>';
    }).join('');
    document.addEventListener('click', function(e){
      var b = e.target.closest('[data-guide]'); if(!b) return;
      var g = D.guides.filter(function(x){ return x.id === b.getAttribute('data-guide'); })[0];
      WL.openModal('<p class="modal-eyebrow">' + esc(g.tag) + ' · ' + g.read + ' read</p><h3 id="modalTitle">' + esc(g.title) + '</h3><div class="modal-body"><ol class="itin">' + g.body.map(function(p, i){ return '<li><b>Tip ' + (i + 1) + '</b>' + esc(p) + '</li>'; }).join('') + '</ol><p class="small muted">Rules and timings change. Check the official source before you travel.</p></div>');
    });
    $('#faqList').innerHTML = D.faqs.map(function(f, i){ return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Reviews carousel                                                   */
  /* ------------------------------------------------------------------ */
  function stars(n){ var s = ''; for(var i = 1; i <= 5; i++) s += '<svg class="ic' + (i > n ? ' off' : '') + '"><use href="#i-star"/></svg>'; return '<div class="stars" aria-label="' + n + ' out of 5 stars">' + s + '</div>'; }
  function initReviews(){
    var track = $('#carouselTrack'), dotsWrap = $('#carDots');
    function render(){
      var mine = store.get('reviews', []);
      var all = mine.map(function(r){ r.mine = true; return r; }).concat(D.reviews);
      track.innerHTML = all.map(function(r){
        return '<div class="postcard">' + stars(r.stars) + '<blockquote>“' + esc(r.text) + '”</blockquote><p class="author"><span>' + esc(r.who) + ' — ' + esc(r.city) + '</span><span class="' + (r.mine ? 'yours' : '') + '">' + (r.mine ? 'Your review' : esc(r.trip)) + '</span></p></div>';
      }).join('');
      dotsWrap.innerHTML = all.map(function(_, i){ return '<button class="car-dot' + (i === 0 ? ' active' : '') + '" aria-label="Go to review ' + (i + 1) + '"></button>'; }).join('');
    }
    render();
    function step(){ var c = track.querySelector('.postcard'); return c ? c.getBoundingClientRect().width + 24 : 300; }
    $('#carPrev').addEventListener('click', function(){ track.scrollBy({ left:-step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    $('#carNext').addEventListener('click', function(){ track.scrollBy({ left:step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    dotsWrap.addEventListener('click', function(e){ var b = e.target.closest('.car-dot'); if(!b) return; var i = $$('.car-dot', dotsWrap).indexOf(b); track.scrollTo({ left:i * step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    var t; track.addEventListener('scroll', function(){ clearTimeout(t); t = setTimeout(function(){ var i = Math.round(track.scrollLeft / step()); $$('.car-dot', dotsWrap).forEach(function(d, j){ d.classList.toggle('active', i === j); }); }, 90); }, { passive:true });

    $('#writeReviewBtn').addEventListener('click', function(){
      var u = WL.user ? WL.user() : null;
      WL.openModal('<p class="modal-eyebrow">Your postcard</p><h3 id="modalTitle">Write a review</h3><form class="modal-body" id="reviewForm" novalidate>' +
        '<div class="form-row"><label for="rvStars">Rating</label><select id="rvStars"><option value="5">★★★★★ Loved it</option><option value="4">★★★★ Great</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select></div>' +
        '<div class="two-col"><div class="form-row"><label for="rvName">Name</label><input id="rvName" value="' + esc(u ? u.name : '') + '"></div><div class="form-row"><label for="rvCity">City</label><input id="rvCity" placeholder="e.g. Lucknow"></div></div>' +
        '<div class="form-row"><label for="rvTrip">Trip</label><input id="rvTrip" list="holidayList" placeholder="e.g. Kerala"></div>' +
        '<div class="form-row"><label for="rvText">Review</label><textarea id="rvText" placeholder="What made the trip memorable?"></textarea></div>' +
        '<p class="form-msg" id="rvMsg"></p><button class="btn btn-accent btn-block" type="submit">Post review</button></form>');
      $('#reviewForm').addEventListener('submit', function(e){
        e.preventDefault();
        var name = $('#rvName').value.trim(), text = $('#rvText').value.trim();
        if(name.length < 2 || text.length < 15){ $('#rvMsg').textContent = 'Add your name and at least 15 characters of review.'; return; }
        var list = store.get('reviews', []);
        list.unshift({ stars:+$('#rvStars').value, who:name, city:$('#rvCity').value.trim() || 'India', trip:$('#rvTrip').value.trim() || 'Trip', text:text });
        store.set('reviews', list.slice(0, 10)); render(); WL.closeModal(); toast('Thanks! Your review is live.'); track.scrollTo({ left:0 });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Contact & newsletter                                               */
  /* ------------------------------------------------------------------ */
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, mobileRe = /^[6-9]\d{9}$/;
  function setErr(input, errEl, show){ errEl.classList.toggle('show', show); input.classList.toggle('invalid-input', show); input.setAttribute('aria-invalid', show ? 'true' : 'false'); }
  function initContact(){
    var f = $('#contactForm');
    $('#cdate').min = iso(today());
    $('#cphone').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); });
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var n = $('#cname'), em = $('#cemail'), ph = $('#cphone'), ok = true;
      var bad1 = n.value.trim().length < 2, bad2 = !emailRe.test(em.value.trim()), bad3 = !mobileRe.test(ph.value.trim());
      setErr(n, $('#cnameError'), bad1); setErr(em, $('#cemailError'), bad2); setErr(ph, $('#cphoneError'), bad3);
      ok = !(bad1 || bad2 || bad3);
      if(!ok){ (bad1 ? n : bad2 ? em : ph).focus(); return; }
      var ref = 'ENQ-' + digits(6);
      var leads = store.get('leads', []); leads.unshift({ ref:ref, name:n.value.trim(), type:$('#ctype').value, dest:$('#cdest').value, at:Date.now() }); store.set('leads', leads.slice(0, 20));
      $('#contactSuccessText').textContent = 'Thanks, ' + n.value.trim().split(' ')[0] + '! Your enquiry ' + ref + ' is in. A trip expert will call +91 ' + ph.value + ' within 2 working hours.';
      $('#contactFormFields').hidden = true; $('#contactSuccess').hidden = false; toast('Enquiry received — ' + ref);
    });
    $('#contactAgain').addEventListener('click', function(){ f.reset(); $('#contactFormFields').hidden = false; $('#contactSuccess').hidden = true; });
    $('#newsForm').addEventListener('submit', function(e){
      e.preventDefault(); var v = $('#newsEmail').value.trim();
      if(!emailRe.test(v)){ $('#newsMsg').textContent = 'Enter a valid email address.'; return; }
      $('#newsMsg').textContent = 'Subscribed! Watch your inbox every Thursday.'; $('#newsEmail').value = '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* Footer routes & policy pages                                       */
  /* ------------------------------------------------------------------ */
  var POLICIES = {
    about:['About Wanderlust Co.','<p>We are a travel company for Indian travellers, booking flights, trains, buses, hotels and holidays in one place. Our trip experts plan family trips, pilgrimages, honeymoons and corporate offsites across India and abroad.</p><p class="small muted">This is a demo website. Replace this text with your company story, registration details and team.</p>'],
    cancellation:['Cancellation & refunds','<ol class="itin"><li><b>Flights</b>Airline cancellation charges apply, plus our ₹300 per traveller service fee. Zero-cancellation add-on waives airline charges up to 24 hours before departure.</li><li><b>Trains</b>Railway cancellation rules apply: a flat charge per passenger more than 48 hours before departure, 25% between 48 and 12 hours, 50% between 12 and 4 hours.</li><li><b>Hotels</b>Free cancellation until the date shown on your booking; after that, the first night is charged.</li><li><b>Buses & cabs</b>Buses: 10% charge more than 24 hours before departure, 50% after. Cabs: free until 6 hours before pick-up.</li><li><b>Holidays</b>30+ days before: 10% charge. 15–30 days: 25%. 7–15 days: 50%. Under 7 days: 100%.</li><li><b>Refund timeline</b>Refunds reach the original payment method in 5–7 working days.</li></ol>'],
    terms:['Terms of use','<p>By booking you confirm the traveller names match government ID, and that you accept the supplier\'s fare rules. Prices are dynamic until payment completes. Travel documents (passport, visa, permits) are the traveller\'s responsibility.</p><p class="small muted">Demo text. Have your legal team draft final terms.</p>'],
    privacy:['Privacy policy','<p>We collect only what is needed to book your trip: names, contact details, ID numbers where the supplier requires them, and payment confirmation from our gateway. We never store full card numbers. You can ask us to delete your data at any time.</p><p class="small muted">On this demo site, everything stays in your own browser storage.</p>'],
    partner:['List your property','<p>Hotels, homestays and villas can join with zero listing fee. We pay out within 7 days of guest check-out.</p><a class="btn btn-accent btn-sm" href="#contact" data-close-modal>Talk to our partner team</a>'],
    agent:['Become a travel agent','<p>Get B2B fares on flights, hotels and holidays, a white-label booking engine and weekly settlements.</p><a class="btn btn-accent btn-sm" href="#contact" data-close-modal>Apply now</a>']
  };
  function initFooter(){
    var routes = [['Delhi','Mumbai'],['Mumbai','Goa'],['Bengaluru','Delhi'],['Delhi','Srinagar'],['Chennai','Kolkata'],['Hyderabad','Bengaluru'],['Delhi','Dubai']];
    $('#footerRoutes').innerHTML = routes.map(function(r){ return '<li><button class="link-btn" data-route="' + r[0] + '|' + r[1] + '">' + r[0] + ' → ' + r[1] + ' flights</button></li>'; }).join('');
    document.addEventListener('click', function(e){
      var r = e.target.closest('[data-route]');
      if(r){ var p = r.getAttribute('data-route').split('|'); WL.prefillSearch('route', { from:p[0], to:p[1] }); return; }
      var pl = e.target.closest('[data-policy]');
      if(pl){ var P = POLICIES[pl.getAttribute('data-policy')]; WL.openModal('<p class="modal-eyebrow">Wanderlust Co.</p><h3 id="modalTitle">' + P[0] + '</h3><div class="modal-body">' + P[1] + '</div>'); return; }
      if(e.target.closest('[data-close-modal]')) WL.closeModal();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Modal & drawer                                                     */
  /* ------------------------------------------------------------------ */
  var lastFocus = { modal:null, drawer:null };
  function trap(container, e){
    if(e.key !== 'Tab') return;
    var f = $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', container).filter(function(x){ return x.offsetParent !== null; });
    if(!f.length) return;
    if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
  }
  function lockScroll(){ document.body.style.overflow = ($('#modal').hidden && $('#drawer').hidden && $('#panel').hidden) ? '' : 'hidden'; }
  WL.openModal = function(html, wide){
    var m = $('#modal'); if(m.hidden) lastFocus.modal = document.activeElement;
    $('#modalBody').innerHTML = html; $('.modal', m).classList.toggle('wide', !!wide);
    m.hidden = false; lockScroll();
    var first = $('#modalBody input, #modalBody select, #modalBody button', m);
    (first && first.tagName === 'INPUT' ? first : $('#modalClose')).focus();
  };
  WL.closeModal = function(){ var m = $('#modal'); if(m.hidden) return; m.hidden = true; $('#modalBody').innerHTML = ''; lockScroll(); if(lastFocus.modal && document.contains(lastFocus.modal)) lastFocus.modal.focus(); };
  WL.openDrawer = function(title, html){
    var d = $('#drawer'); if(d.hidden) lastFocus.drawer = document.activeElement;
    $('#drawerTitle').textContent = title; $('#drawerBody').innerHTML = html; $('#drawerBody').scrollTop = 0;
    d.hidden = false; lockScroll(); $('#drawerClose').focus();
  };
  WL.closeDrawer = function(){ var d = $('#drawer'); if(d.hidden) return; d.hidden = true; lockScroll(); if(lastFocus.drawer && document.contains(lastFocus.drawer)) lastFocus.drawer.focus(); };
  function initOverlays(){
    $('#modalClose').addEventListener('click', WL.closeModal);
    $('#modal').addEventListener('click', function(e){ if(e.target === this) WL.closeModal(); });
    $('#modal').addEventListener('keydown', function(e){ trap(this, e); });
    $('#drawerClose').addEventListener('click', WL.closeDrawer);
    $('#drawer').addEventListener('click', function(e){ if(e.target === this) WL.closeDrawer(); });
    $('#drawer').addEventListener('keydown', function(e){ trap(this, e); });
    document.addEventListener('keydown', function(e){
      if(e.key !== 'Escape') return;
      if(!$('#modal').hidden) WL.closeModal();
      else if(!$('#drawer').hidden) WL.closeDrawer();
      else if(!$('#panel').hidden && WL.panelBack) WL.panelBack();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Chat assistant (rule-based)                                         */
  /* ------------------------------------------------------------------ */
  function initChat(){
    var fab = $('#chatFab'), box = $('#chatBox'), log = $('#chatLog');
    var QUICK = ['Refund status','Baggage allowance','Check PNR','Tatkal timings','Talk to an agent'];
    var RULES = [
      [/refund|cancel/i, 'Open <b>My Trips</b> and tap <b>Cancel</b> on a booking to see the exact refund before you confirm. Refunds reach your original payment method in 5–7 working days.'],
      [/bag|luggage|kg/i, 'Most domestic economy fares include about <b>15 kg check-in + 7 kg cabin</b>. Sale fares can be cabin-only, so check the fare details on your ticket.'],
      [/pnr|status/i, 'Use the <b>PNR & booking status</b> tool in Travel tools, or type your 10-digit PNR here.'],
      [/tatkal/i, 'Tatkal opens one day before the journey: <b>10:00 AM for AC</b> classes and <b>11:00 AM for non-AC</b>. Your IRCTC account must be Aadhaar-verified.'],
      [/agent|human|call|talk/i, 'A trip expert is available 24×7 on <b>+91 74609 62727</b>. You can also leave your number in the custom trip form and we\'ll call you back.'],
      [/visa/i, 'Pick the <b>Visa</b> tab in the search box for a document checklist and to request help from our visa desk.'],
      [/emi|instal/i, 'Holiday packages over ₹10,000 can be paid in 3 or 6 month no-cost EMI, or 9 and 12 months with interest.'],
      [/coupon|offer|discount|code/i, 'Try <b>FIRSTTRIP</b> for 12% off your first booking, or see all codes in the Offers section.'],
      [/gst|invoice/i, 'Add your GSTIN under "GST details" at checkout and the invoice is issued in your company name.'],
      [/hello|hi|namaste|hey/i, 'Namaste! 🙏 How can I help with your trip today?']
    ];
    function add(text, who){ var d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = text; log.appendChild(d); log.scrollTop = log.scrollHeight; }
    function reply(q){
      var m = /\b(\d{10})\b/.exec(q);
      if(m && WL.lookupPnr){ add(WL.lookupPnr(m[1], true), 'bot'); return; }
      for(var i = 0; i < RULES.length; i++){ if(RULES[i][0].test(q)){ add(RULES[i][1], 'bot'); return; } }
      add('I can help with refunds, baggage, PNR, Tatkal, visas, EMI and coupons. For anything else, call <b>+91 74609 62727</b>.', 'bot');
    }
    function setOpen(open){
      box.hidden = !open; fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(open){ if(!log.children.length) add('Namaste! 🙏 I\'m Sahayak, your Wanderlust travel helper. Ask me anything about your booking.', 'bot'); $('#chatText').focus(); }
    }
    $('#chatQuick').innerHTML = QUICK.map(function(q){ return '<button type="button">' + q + '</button>'; }).join('');
    $('#chatQuick').addEventListener('click', function(e){ var b = e.target.closest('button'); if(!b) return; add(esc(b.textContent), 'me'); setTimeout(function(){ reply(b.textContent); }, 300); });
    fab.addEventListener('click', function(){ setOpen(box.hidden); });
    $('#chatClose').addEventListener('click', function(){ setOpen(false); fab.focus(); });
    $('#chatForm').addEventListener('submit', function(e){ e.preventDefault(); var v = $('#chatText').value.trim(); if(!v) return; add(esc(v), 'me'); $('#chatText').value = ''; setTimeout(function(){ reply(v); }, 350); });
  }

  /* ------------------------------------------------------------------ */
  /* Expose & boot                                                      */
  /* ------------------------------------------------------------------ */
  Object.assign(WL, {
    $:$, $$:$$, esc:esc, store:store, toast:toast, iso:iso, parseISO:parseISO, addDays:addDays, today:today, daysBetween:daysBetween,
    fmtDate:fmtDate, fmtDateShort:fmtDateShort, hm:hm, dur:dur, rng:rng, pick:pick, hashStr:hashStr, haversine:haversine, uid:uid, digits:digits,
    money:money, fmtMoney:fmtMoney, refreshMoney:refreshMoney, findAirport:findAirport, findStation:findStation, findPlace:findPlace, nearestAirport:nearestAirport,
    scene:scene, heartBtn:heartBtn, isWished:isWished, updateWishUI:updateWishUI, wishList:function(){ return wish; }, toggleWish:toggleWish,
    MONTHS:MONTHS, MONTHS_FULL:MONTHS_FULL, DAYS:DAYS, applyLang:applyLang, emailRe:emailRe, mobileRe:mobileRe, stars:stars, reduceMotion:reduceMotion, lockScroll:lockScroll, trap:trap
  });

  (function(){ var ph = $('#heroPhoto'); if(!ph) return;
    function ok(){ ph.classList.add('loaded'); $('#home').classList.add('has-photo'); }
    function bad(){ ph.remove(); }
    if(ph.complete && ph.naturalWidth) ok(); else if(ph.complete) bad(); else { ph.addEventListener('load', ok); ph.addEventListener('error', bad); } })();
  applyTheme();
  initHeader();
  initDatalists();
  initOverlays();
  initOffers();
  initDest();
  initGetaways();
  initPackages();
  initFestivals();
  initTools();
  initGuides();
  initReviews();
  initContact();
  initFooter();
  initChat();
  updateWishUI();
  // booking.js calls applyLang() once it has restored the user session
})();
