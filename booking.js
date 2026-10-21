/* =====================================================================
   Wanderlust Co. — search widget & results (flights, hotels, trains,
   buses, cabs, holidays, visa, forex, insurance).
   Inventory is generated deterministically from route + date so the
   same search always shows the same sample results.
   ===================================================================== */
(function(){
  "use strict";
  var D = window.WL_DATA, WL = window.WL;
  var $ = WL.$, $$ = WL.$$, esc = WL.esc, money = WL.money, store = WL.store, toast = WL.toast;
  var iso = WL.iso, parseISO = WL.parseISO, addDays = WL.addDays, today = WL.today, daysBetween = WL.daysBetween, fmtDate = WL.fmtDate, fmtDateShort = WL.fmtDateShort, hm = WL.hm, dur = WL.dur, rng = WL.rng, pick = WL.pick, haversine = WL.haversine;

  /* ------------------------------------------------------------------ */
  /* Panel (full-screen results / checkout) with a back stack           */
  /* ------------------------------------------------------------------ */
  var stack = [], panelLast = null;
  function renderTop(){
    var v = stack[stack.length - 1];
    $('#panelTitle').textContent = v.title; $('#panelSub').textContent = v.sub || '';
    var body = $('#panelBody'); body.innerHTML = ''; body.scrollTop = 0;
    var inner = document.createElement('div'); body.appendChild(inner); // fresh node so listeners never pile up
    v.render(inner);
    $('#panelBack').setAttribute('aria-label', stack.length > 1 ? 'Back' : 'Close results');
  }
  WL.panelPush = function(title, sub, render){
    var p = $('#panel');
    if(p.hidden){ panelLast = document.activeElement; p.hidden = false; WL.lockScroll(); }
    stack.push({ title:title, sub:sub, render:render }); renderTop(); $('#panelClose').focus();
  };
  WL.panelReplace = function(title, sub, render){ stack.pop(); WL.panelPush(title, sub, render); };
  WL.panelReset = function(title, sub, render){ stack = []; WL.panelPush(title, sub, render); };
  document.addEventListener('click', function(e){ if(e.target.closest('[data-panel-close]')) WL.panelClose(); });
  WL.panelRefresh = function(){ if(stack.length) renderTop(); };
  WL.panelBack = function(){ if(stack.length > 1){ stack.pop(); renderTop(); } else WL.panelClose(); };
  WL.panelClose = function(){ stack = []; $('#panel').hidden = true; $('#panelBody').innerHTML = ''; WL.lockScroll(); if(panelLast && document.contains(panelLast)) panelLast.focus(); };
  $('#panelBack').addEventListener('click', WL.panelBack);
  $('#panelClose').addEventListener('click', WL.panelClose);
  $('#panel').addEventListener('keydown', function(e){ WL.trap(this, e); });

  /* ------------------------------------------------------------------ */
  /* Search widget                                                      */
  /* ------------------------------------------------------------------ */
  var tabs = $$('.s-tab');
  function selectTab(name){
    tabs.forEach(function(t){ var on = t.getAttribute('data-tab') === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
    $$('.s-pane').forEach(function(p){ var on = p.id === 'pane-' + name; p.hidden = !on; p.classList.toggle('active', on); });
    var t = $('.s-tab.active'); if(t && t.scrollIntoView) t.scrollIntoView({ block:'nearest', inline:'nearest' });
    store.set('tab', name);
  }
  WL.selectTab = selectTab;
  tabs.forEach(function(t, i){
    t.addEventListener('click', function(){ selectTab(t.getAttribute('data-tab')); });
    t.addEventListener('keydown', function(e){
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if(!d) return;
      e.preventDefault(); var n = tabs[(i + d + tabs.length) % tabs.length]; selectTab(n.getAttribute('data-tab')); n.focus();
    });
  });

  // default dates
  var T = today();
  function setDate(id, offset, minOffset){ var el = $('#' + id); el.min = iso(addDays(T, minOffset == null ? 0 : minOffset)); el.value = iso(addDays(T, offset)); }
  setDate('fDepart', 7); setDate('fReturn', 11); setDate('hIn', 7); setDate('hOut', 9, 1); setDate('tDate', 5); $('#tDate').max = iso(addDays(T, 60));
  setDate('bDate', 1); setDate('cDate', 1); setDate('cRet', 3, 1); setDate('vDate', 30); setDate('iStart', 20); setDate('iEnd', 27, 1);
  $('#fDepart').max = $('#fReturn').max = iso(addDays(T, 350));
  function linkDates(a, b, gap){ $(a).addEventListener('change', function(){ var d = parseISO(this.value); if(!d) return; var min = iso(addDays(d, gap)); $(b).min = min; if(!$(b).value || $(b).value < min) $(b).value = iso(addDays(d, Math.max(gap, 2))); }); }
  linkDates('#fDepart', '#fReturn', 0); linkDates('#hIn', '#hOut', 1); linkDates('#cDate', '#cRet', 0); linkDates('#iStart', '#iEnd', 1);
  $$('[data-date-for]').forEach(function(b){ b.addEventListener('click', function(){ $('#' + b.getAttribute('data-date-for')).value = iso(addDays(T, +b.getAttribute('data-offset'))); }); });

  // holiday month list
  $('#pMonth').innerHTML = '<option value="0">Any month</option>' + Array.apply(null, Array(12)).map(function(_, i){ var d = new Date(T.getFullYear(), T.getMonth() + i, 1); return '<option value="' + (d.getMonth() + 1) + '">' + WL.MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear() + '</option>'; }).join('');
  // forex currencies
  $('#xCur').innerHTML = D.forex.map(function(f){ return '<option value="' + f.code + '">' + f.code + ' — ' + esc(f.name) + '</option>'; }).join('');
  function forexNote(){ var f = D.forex.filter(function(x){ return x.code === $('#xCur').value; })[0]; $('#xLive').textContent = 'Indicative: 1 ' + f.code + ' ≈ ₹' + f.rate.toFixed(2) + '. Your rate is locked when you place the order.'; }
  $('#xCur').addEventListener('change', forexNote); forexNote();

  // flight trip type
  function setTrip(round){
    $('#fReturn').disabled = !round;
    $$('input[name="ftrip"]').forEach(function(r){ r.checked = (r.value === 'round') === round; });
    $('#fReturn').nextElementSibling.textContent = round ? 'Return flight' : 'Tap to add a return';
  }
  $$('input[name="ftrip"]').forEach(function(r){ r.addEventListener('change', function(){ setTrip(r.value === 'round' && r.checked); }); });
  $('#fReturn').parentElement.addEventListener('click', function(){ if($('#fReturn').disabled){ setTrip(true); $('#fReturn').focus(); } });

  // airport hints
  function hint(inputId, hintId){
    var f = function(){ var c = WL.findAirport($('#' + inputId).value); $('#' + hintId).textContent = c ? c.airName + (c.intl ? ', ' + c.state : '') : 'Pick a city from the list'; };
    $('#' + inputId).addEventListener('input', f); $('#' + inputId).addEventListener('change', f); f();
  }
  hint('fFrom', 'fFromHint'); hint('fTo', 'fToHint');

  // swap
  $$('[data-swap]').forEach(function(b){ b.addEventListener('click', function(){ var ids = b.getAttribute('data-swap').split(','), a = $('#' + ids[0]), c = $('#' + ids[1]), t = a.value; a.value = c.value; c.value = t; a.dispatchEvent(new Event('change')); c.dispatchEvent(new Event('change')); }); });

  // popovers & steppers
  function closePops(except){ $$('.popover').forEach(function(p){ if(p !== except && !p.hidden){ p.hidden = true; var t = p.parentElement.querySelector('.pop-trigger'); t.setAttribute('aria-expanded', 'false'); } }); }
  $$('.pop-trigger').forEach(function(t){
    var pop = t.parentElement.querySelector('.popover');
    t.addEventListener('click', function(e){ e.stopPropagation(); var open = pop.hidden; closePops(pop); pop.hidden = !open; t.setAttribute('aria-expanded', open ? 'true' : 'false'); if(open){ var b = pop.querySelector('button'); if(b) b.focus(); } });
    pop.addEventListener('click', function(e){ e.stopPropagation(); });
    pop.querySelector('.pop-done').addEventListener('click', function(){ pop.hidden = true; t.setAttribute('aria-expanded', 'false'); t.focus(); });
  });
  document.addEventListener('click', function(){ closePops(null); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePops(null); });
  function stepperVal(id){ return +$('#' + id).textContent; }
  function syncSteppers(){
    // infants cannot exceed adults
    var ad = stepperVal('fAdults'), inf = $('#fInfants');
    if(+inf.textContent > ad) inf.textContent = ad;
    if(stepperVal('hAdults') < stepperVal('hRooms')) $('#hAdults').textContent = stepperVal('hRooms');
    $$('.stepper[data-min]').forEach(function(s){
      var out = s.querySelector('output'), v = +out.textContent, min = +s.getAttribute('data-min'), max = +s.getAttribute('data-max');
      if(out.id === 'fInfants') max = Math.min(max, ad);
      if(out.id === 'fAdults' || out.id === 'fChildren'){ max = Math.min(max, 9 - (out.id === 'fAdults' ? stepperVal('fChildren') : stepperVal('fAdults'))); }
      if(out.id === 'hAdults') min = Math.max(min, stepperVal('hRooms'));
      if(out.id === 'hAdults' || out.id === 'hChildren') max = Math.min(max, stepperVal('hRooms') * (out.id === 'hAdults' ? 3 : 2));
      s.querySelector('[data-step="-1"]').disabled = v <= min; s.querySelector('[data-step="1"]').disabled = v >= max;
    });
    var pax = stepperVal('fAdults') + stepperVal('fChildren') + stepperVal('fInfants');
    $('#fPaxBtn').textContent = pax + ' Traveller' + (pax > 1 ? 's' : '') + ' · ' + document.querySelector('input[name="fclass"]:checked').value;
    var r = stepperVal('hRooms'), a = stepperVal('hAdults'), c = stepperVal('hChildren');
    $('#hGuestBtn').textContent = r + ' Room' + (r > 1 ? 's' : '') + ' · ' + a + ' Adult' + (a > 1 ? 's' : '') + (c ? ' · ' + c + ' Child' + (c > 1 ? 'ren' : '') : '');
  }
  $$('.stepper[data-min] .step-btn').forEach(function(b){
    b.addEventListener('click', function(){ var out = b.parentElement.querySelector('output'); out.textContent = +out.textContent + +b.getAttribute('data-step'); syncSteppers(); });
  });
  $$('input[name="fclass"]').forEach(function(r){ r.addEventListener('change', syncSteppers); });
  syncSteppers();

  // cab type toggles
  function cabMode(){
    var m = document.querySelector('input[name="ctype"]:checked').value;
    $('#cToWrap').hidden = m === 'airport' || m === 'rental';
    $('#cAirWrap').hidden = m !== 'airport'; $('#cPkgWrap').hidden = m !== 'rental'; $('#cRetWrap').hidden = m !== 'round';
    $('#cFromLabel').textContent = m === 'airport' ? 'City' : 'Pick-up city';
  }
  $$('input[name="ctype"]').forEach(function(r){ r.addEventListener('change', cabMode); }); cabMode();

  // restore last tab
  selectTab(store.get('tab', 'flights'));

  function formMsg(form, msg, field){
    $('.form-msg', form).textContent = msg || '';
    $$('.field.invalid', form).forEach(function(f){ f.classList.remove('invalid'); });
    if(field){ var el = $('#' + field); el.closest('.field').classList.add('invalid'); el.focus(); }
    return false;
  }

  /* ---------- Recent searches ---------- */
  function saveRecent(tab, label){
    var form = $('#pane-' + tab), vals = {};
    $$('input,select', form).forEach(function(el){ if(!el.id) return; vals[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value; });
    $$('input[type="radio"]', form).forEach(function(el){ vals['r:' + el.name + ':' + el.value] = el.checked; });
    $$('output', form).forEach(function(o){ vals['o:' + o.id] = o.textContent; });
    var list = store.get('recent', []).filter(function(r){ return r.label !== label; });
    list.unshift({ tab:tab, label:label, vals:vals }); store.set('recent', list.slice(0, 5)); renderRecent();
  }
  function renderRecent(){
    var list = store.get('recent', []);
    $('#recentSearches').hidden = !list.length;
    $('#recentList').innerHTML = list.map(function(r, i){ return '<button class="recent-chip" data-recent="' + i + '"><svg class="ic"><use href="#i-clock"/></svg>' + esc(r.label) + '</button>'; }).join('');
  }
  $('#recentList').addEventListener('click', function(e){
    var b = e.target.closest('[data-recent]'); if(!b) return;
    var r = store.get('recent', [])[+b.getAttribute('data-recent')]; if(!r) return;
    selectTab(r.tab); var form = $('#pane-' + r.tab);
    Object.keys(r.vals).forEach(function(k){
      if(k.indexOf('r:') === 0){ var p = k.split(':'); var el = form.querySelector('input[name="' + p[1] + '"][value="' + p.slice(2).join(':') + '"]'); if(el) el.checked = r.vals[k]; return; }
      if(k.indexOf('o:') === 0){ var o = $('#' + k.slice(2)); if(o) o.textContent = r.vals[k]; return; }
      var el2 = $('#' + k); if(!el2) return;
      if(el2.type === 'checkbox') el2.checked = r.vals[k];
      else if(el2.type === 'date' && r.vals[k] < el2.min) el2.value = el2.min;
      else if(el2.type !== 'radio') el2.value = r.vals[k];
    });
    if(r.tab === 'flights') setTrip(document.querySelector('input[name="ftrip"]:checked').value === 'round');
    if(r.tab === 'cabs') cabMode();
    syncSteppers(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable:true }));
  });
  renderRecent();

  /* ------------------------------------------------------------------ */
  /* Shared result helpers                                              */
  /* ------------------------------------------------------------------ */
  function slotOf(min){ min = ((min % 1440) + 1440) % 1440; return min < 360 ? 0 : min < 720 ? 1 : min < 1080 ? 2 : 3; }
  var SLOTS = ['Before 6 AM','6 AM – 12 PM','12 PM – 6 PM','After 6 PM'];
  function demoNote(){ return '<p class="demo-note">Sample inventory for this demo. Prices and seats are generated, not live.</p>'; }
  function dateNav(dateISO, onChange){
    var wrap = document.createElement('div'); wrap.className = 'res-bar';
    var d = parseISO(dateISO), prevOk = addDays(d, -1) >= today();
    wrap.innerHTML = '<div class="sort-tabs"><button class="f-tab" data-dn="-1"' + (prevOk ? '' : ' disabled') + '>‹ Previous day</button><span class="f-tab active" aria-current="date">' + fmtDateShort(d) + '</span><button class="f-tab" data-dn="1">Next day ›</button></div>';
    wrap.addEventListener('click', function(e){ var b = e.target.closest('[data-dn]'); if(!b || b.disabled) return; onChange(iso(addDays(d, +b.getAttribute('data-dn')))); });
    return wrap;
  }
  // Build a filter/sort/list layout. cfg: { items, filters:[{key,label,type:'check'|'slot'|'range',options:[{v,l,count}] , test(item, selected)}], sorts:[[key,label,cmp]], card(item), empty, top(el) }
  function resultsLayout(body, cfg){
    var state = { sort: cfg.sorts[0][0], sel:{}, open:false };
    cfg.filters.forEach(function(f){ state.sel[f.key] = f.type === 'range' ? f.max : []; });
    body.innerHTML = '<div class="container res-wrap"><aside class="res-filters" aria-label="Filters"></aside><div class="res-main"><div class="res-top"></div><div class="res-bar"><span class="res-count"></span><div class="sort-tabs" role="group" aria-label="Sort"></div><button class="f-tab mobile-filter-btn" aria-expanded="false"><svg class="ic"><use href="#i-filter"/></svg> Filters</button></div><div class="res-list" style="display:flex;flex-direction:column;gap:14px"></div></div></div>';
    var aside = $('.res-filters', body), list = $('.res-list', body), sortEl = $('.sort-tabs', $('.res-bar', body));
    if(cfg.top) cfg.top($('.res-top', body));
    function renderFilters(){
      aside.innerHTML = '<h3>Filters <button type="button" data-reset>Clear all</button></h3>' + cfg.filters.map(function(f){
        if(f.type === 'range') return '<div class="fgroup"><span>' + f.label + '</span><input type="range" min="' + f.min + '" max="' + f.max + '" step="' + (f.step || 100) + '" value="' + state.sel[f.key] + '" data-f="' + f.key + '" aria-label="' + f.label + '"><label>Up to <b style="margin-left:4px">' + money(state.sel[f.key]) + '</b></label></div>';
        var cls = f.type === 'slot' ? ' slot-grid' : '';
        return '<div class="fgroup"><span>' + f.label + '</span><div class="' + cls.trim() + '"' + (cls ? '' : ' style="display:flex;flex-direction:column;gap:8px"') + '>' + f.options.map(function(o){
          var c = state.sel[f.key].indexOf(String(o.v)) > -1;
          return '<label><input type="checkbox" data-f="' + f.key + '" value="' + esc(o.v) + '"' + (c ? ' checked' : '') + '> ' + esc(o.l) + (o.extra ? '<small>' + o.extra + '</small>' : '') + '</label>';
        }).join('') + '</div></div>';
      }).join('');
    }
    sortEl.innerHTML = cfg.sorts.map(function(s){ return '<button class="f-tab' + (s[0] === state.sort ? ' active' : '') + '" data-s="' + s[0] + '" aria-pressed="' + (s[0] === state.sort) + '">' + s[1] + '</button>'; }).join('');
    function apply(){
      var items = cfg.items.filter(function(it){
        return cfg.filters.every(function(f){ var s = state.sel[f.key]; if(f.type === 'range') return f.test(it, s); return !s.length || f.test(it, s); });
      });
      var srt = cfg.sorts.filter(function(s){ return s[0] === state.sort; })[0]; items.sort(srt[2]);
      $('.res-count', body).textContent = items.length + ' of ' + cfg.items.length + ' ' + (cfg.noun || 'results');
      list.innerHTML = items.length ? items.map(cfg.card).join('') : '<div class="empty"><strong>No results match these filters.</strong><button class="btn btn-ink btn-sm" data-reset>Clear filters</button></div>';
      if(cfg.after) cfg.after(list, items);
    }
    aside.addEventListener('change', function(e){
      var el = e.target, k = el.getAttribute('data-f'); if(!k) return;
      if(el.type === 'range'){ state.sel[k] = +el.value; el.nextElementSibling.querySelector('b').innerHTML = money(+el.value); }
      else { var arr = state.sel[k], i = arr.indexOf(el.value); if(el.checked && i < 0) arr.push(el.value); if(!el.checked && i > -1) arr.splice(i, 1); }
      apply();
    });
    aside.addEventListener('input', function(e){ if(e.target.type === 'range'){ state.sel[e.target.getAttribute('data-f')] = +e.target.value; e.target.nextElementSibling.querySelector('b').innerHTML = money(+e.target.value); apply(); } });
    body.addEventListener('click', function(e){
      if(e.target.closest('[data-reset]')){ cfg.filters.forEach(function(f){ state.sel[f.key] = f.type === 'range' ? f.max : []; }); renderFilters(); apply(); return; }
      var s = e.target.closest('[data-s]'); if(s){ state.sort = s.getAttribute('data-s'); $$('[data-s]', sortEl).forEach(function(x){ x.classList.toggle('active', x === s); x.setAttribute('aria-pressed', x === s ? 'true' : 'false'); }); apply(); return; }
      var m = e.target.closest('.mobile-filter-btn'); if(m){ state.open = !state.open; aside.classList.toggle('open', state.open); m.setAttribute('aria-expanded', state.open ? 'true' : 'false'); }
    });
    renderFilters(); apply();
    return { apply:apply };
  }
  function countOpts(items, fn, labels){
    var c = {}; items.forEach(function(it){ var v = fn(it); c[v] = (c[v] || 0) + 1; });
    return Object.keys(c).map(function(k){ return { v:k, l:labels ? labels(k) : k, extra:c[k] }; });
  }
  function emptyState(msg, sub){ return '<div class="container" style="padding-top:28px"><div class="empty"><strong>' + msg + '</strong>' + (sub ? '<span>' + sub + '</span>' : '') + '<button class="btn btn-ink btn-sm" data-panel-close>Modify search</button></div></div>'; }

  /* ------------------------------------------------------------------ */
  /* FLIGHTS                                                            */
  /* ------------------------------------------------------------------ */
  var AIR = {}; D.airlines.forEach(function(a){ AIR[a.code] = a; });
  var AL_F = { '6E':1, 'AI':1.12, 'IX':0.92, 'QP':0.96, 'SG':0.93 };
  var CLS_M = { 'Economy':1, 'Premium Economy':1.75, 'Business':3.3, 'First':5.2 };
  var FARE_D = { 'Regular':0, 'Student':0.06, 'Senior Citizen':0.06, 'Armed Forces':0.06, 'Doctors & Nurses':0.05 };
  var HUBS = ['DEL','BOM','BLR','HYD','MAA','CCU'];
  function cityByAir(code){ return D.cities.filter(function(c){ return c.air === code; })[0]; }
  function genFlights(from, to, date, cls, fareType){
    var dist = haversine(from, to), intl = from.intl || to.intl, r = rng(from.air + to.air + date);
    var ahead = daysBetween(today(), parseISO(date));
    var demand = ahead < 3 ? 1.75 : ahead < 7 ? 1.42 : ahead < 15 ? 1.2 : ahead < 30 ? 1.06 : 0.97;
    var dow = parseISO(date).getDay(), wk = (dow === 5 || dow === 0) ? 1.08 : 1;
    var als = intl ? (dist > 5000 ? ['AI'] : ['AI','6E','IX'].concat(dist < 3500 ? ['SG'] : [])) : ['6E','AI','IX','QP','SG'];
    als = als.filter(function(a){ if(cls === 'Economy') return true; if(cls === 'Premium Economy') return a === 'AI'; if(cls === 'Business') return a === 'AI' || a === '6E'; return a === 'AI' && intl; });
    var out = [];
    als.forEach(function(code){
      var n = intl ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3);
      if(dist < 350 && code !== '6E' && code !== 'AI') n = r() < 0.5 ? 0 : 1;
      for(var i = 0; i < n; i++){
        var dep = 330 + Math.floor(r() * 210) * 5; if(dep > 1430) dep -= 900;
        var stops = dist > 500 && r() < (intl ? 0.25 : 0.2) ? 1 : 0, via = null, mins;
        var nonstopMins = Math.round((dist / 780 * 60 + 40) / 5) * 5;
        if(stops){
          var hubs = HUBS.filter(function(h){ return h !== from.air && h !== to.air; }).map(function(h){ var c = cityByAir(h); return { h:h, c:c, d:haversine(from, c) + haversine(c, to) }; }).sort(function(a, b){ return a.d - b.d; });
          var hb = hubs[Math.floor(r() * Math.min(2, hubs.length))];
          via = hb.h; mins = Math.round(((hb.d / 780) * 60 + 80 + 70 + Math.floor(r() * 26) * 5) / 5) * 5;
        } else mins = nonstopMins;
        var slotF = [0.88, 1.08, 0.98, 1.1][slotOf(dep)];
        var base = (intl ? 3800 + dist * 4.0 : 1650 + dist * 3.3) * demand * wk * AL_F[code] * slotF * (0.9 + r() * 0.22) * CLS_M[cls] * (stops ? 0.9 : 1);
        base = Math.round(base * (1 - (FARE_D[fareType] || 0)));
        var tax = Math.round(intl ? 2600 + base * 0.1 : 780 + base * 0.05);
        out.push({
          id: code + i + dep, al: code, no: code + ' ' + (100 + Math.floor(r() * 6800)), dep: dep, arr: dep + mins, dur: mins, stops: stops, via: via,
          base: base, tax: tax, price: base + tax, seats: r() < 0.3 ? 1 + Math.floor(r() * 7) : 0,
          bag: cls === 'Economy' ? (intl ? (code === 'AI' ? '30 kg' : '20 kg') : '15 kg') + ' check-in · 7 kg cabin' : '30–40 kg check-in · 10 kg cabin',
          meal: code === 'AI' || cls !== 'Economy' ? 'Free meal' : 'Meals to buy', refundable: code === 'AI' || r() < 0.5
        });
      }
    });
    return out;
  }
  function flightCard(f, ctx){
    var a = AIR[f.al], nextDay = Math.floor(f.arr / 1440);
    return '<article class="r-card r-flight"><div class="airline"><span class="al-logo" style="background:' + a.color + '">' + f.al + '</span><div><strong>' + a.name + '</strong><small>' + f.no + '</small></div></div>' +
      '<div class="leg"><div><div class="t">' + hm(f.dep) + '</div><div class="c">' + ctx.from.air + '</div></div>' +
      '<div class="mid">' + dur(f.dur) + '<div class="line">' + (f.stops ? '<i class="stopdot"></i>' : '') + '</div>' + (f.stops ? '1 stop via ' + f.via : '<span class="nonstop">Non-stop</span>') + '</div>' +
      '<div class="end"><div class="t">' + hm(f.arr) + (nextDay ? '<sup style="font-size:.6em;color:var(--accent-strong)"> +' + nextDay + '</sup>' : '') + '</div><div class="c">' + ctx.to.air + '</div></div></div>' +
      '<div class="price-col"><span class="p">' + money(f.price) + '</span><small>per adult, incl. taxes</small><button class="btn btn-accent btn-sm" data-fl="' + f.id + '">' + (ctx.select ? 'Select' : 'Book') + '</button></div>' +
      '<div class="r-tags"><span class="pill">' + f.bag + '</span><span class="pill">' + f.meal + '</span>' + (f.refundable ? '<span class="pill ok">Partially refundable</span>' : '<span class="pill">Non-refundable fare</span>') + (f.seats ? '<span class="pill bad">Only ' + f.seats + ' seat' + (f.seats > 1 ? 's' : '') + ' left</span>' : '') + (ctx.fare !== 'Regular' ? '<span class="pill warn">' + esc(ctx.fare) + ' fare · ID needed at check-in</span>' : '') + '</div></article>';
  }
  function showFlights(q, leg, chosenOut){
    var from = leg === 'ret' ? q.to : q.from, to = leg === 'ret' ? q.from : q.to, date = leg === 'ret' ? q.ret : q.date;
    var flights = genFlights(from, to, date, q.cls, q.fare);
    var title = from.name + ' → ' + to.name, sub = fmtDateShort(parseISO(date)) + ' · ' + q.paxLabel + ' · ' + q.cls + (q.ret ? (leg === 'ret' ? ' · Return' : ' · Onward') : '');
    var render = function(body){
      if(!flights.length){ body.innerHTML = emptyState('No ' + q.cls + ' flights on this route.', 'Try Economy, or a different date.'); return; }
      var maxP = Math.max.apply(null, flights.map(function(f){ return f.price; })), minP = Math.min.apply(null, flights.map(function(f){ return f.price; }));
      resultsLayout(body, {
        items: flights, noun:'flights',
        top: function(el){
          el.appendChild(dateNav(date, function(nd){
            var nq = Object.assign({}, q); if(leg === 'ret'){ if(nd < q.date) { toast('Return can\'t be before departure'); return; } nq.ret = nd; } else { nq.date = nd; if(nq.ret && nq.ret < nd) nq.ret = nd; }
            WL.panelReplace.apply(null, flightView(nq, leg, chosenOut));
          }));
          var cal = document.createElement('div'); cal.className = 'fare-cal'; cal.setAttribute('aria-label', 'Cheapest fares by date');
          var d0 = parseISO(date), cells = [];
          for(var k = -3; k <= 3; k++){ var dd = addDays(d0, k); if(dd < today()) continue; var fl = genFlights(from, to, iso(dd), q.cls, q.fare); var mp = fl.length ? Math.min.apply(null, fl.map(function(f){ return f.price; })) : 0; cells.push({ d:dd, p:mp }); }
          var low = Math.min.apply(null, cells.map(function(c){ return c.p || 1e9; }));
          cal.innerHTML = cells.map(function(c){ return '<button class="fare-day' + (iso(c.d) === date ? ' active' : '') + (c.p === low ? ' cheap' : '') + '" data-cal="' + iso(c.d) + '"><span>' + fmtDateShort(c.d) + '</span><b>' + (c.p ? money(c.p) : '—') + '</b></button>'; }).join('');
          cal.addEventListener('click', function(e){ var b = e.target.closest('[data-cal]'); if(!b) return; var nd = b.getAttribute('data-cal'); var nq = Object.assign({}, q); if(leg === 'ret'){ if(nd < q.date){ toast('Return can\'t be before departure'); return; } nq.ret = nd; } else { nq.date = nd; if(nq.ret && nq.ret < nd) nq.ret = nd; } WL.panelReplace.apply(null, flightView(nq, leg, chosenOut)); });
          el.appendChild(cal);
          if(chosenOut){ var s = document.createElement('div'); s.className = 'demo-note'; s.style.background = 'var(--ok-bg)'; s.innerHTML = 'Onward selected: <b>' + AIR[chosenOut.al].name + ' ' + chosenOut.no + '</b>, ' + hm(chosenOut.dep) + ' → ' + hm(chosenOut.arr) + ', ' + money(chosenOut.price) + '. Now pick your return.'; el.appendChild(s); }
          var dn = document.createElement('div'); dn.innerHTML = demoNote() + '<button class="text-link small" data-alert style="margin-top:8px">🔔 Alert me if this fare drops</button>'; el.appendChild(dn);
        },
        filters: [
          { key:'stops', label:'Stops', options: countOpts(flights, function(f){ return f.stops; }, function(k){ return k === '0' ? 'Non-stop' : '1 stop'; }), test:function(f, s){ return s.indexOf(String(f.stops)) > -1; } },
          { key:'slot', label:'Departure', type:'slot', options: SLOTS.map(function(l, i){ return { v:i, l:l }; }), test:function(f, s){ return s.indexOf(String(slotOf(f.dep))) > -1; } },
          { key:'al', label:'Airlines', options: countOpts(flights, function(f){ return f.al; }, function(k){ return AIR[k].name; }), test:function(f, s){ return s.indexOf(f.al) > -1; } },
          { key:'price', label:'Price', type:'range', min: Math.floor(minP / 100) * 100, max: Math.ceil(maxP / 100) * 100, test:function(f, v){ return f.price <= v; } }
        ],
        sorts: [['cheap','Cheapest',function(a, b){ return a.price - b.price; }],['fast','Fastest',function(a, b){ return a.dur - b.dur; }],['early','Earliest',function(a, b){ return a.dep - b.dep; }],['late','Latest',function(a, b){ return b.dep - a.dep; }]],
        card: function(f){ return flightCard(f, { from:from, to:to, fare:q.fare, select: !!q.ret && leg !== 'ret' }); }
      });
      body.addEventListener('click', function(e){
        if(e.target.closest('[data-alert]')){ var al = store.get('alerts', []); al.unshift({ route:from.air + '-' + to.air, date:date, price:minP }); store.set('alerts', al.slice(0, 10)); toast('Fare alert set for ' + from.air + ' → ' + to.air + ' below ' + WL.fmtMoney(minP)); return; }
        var b = e.target.closest('[data-fl]'); if(!b) return;
        var f = flights.filter(function(x){ return x.id === b.getAttribute('data-fl'); })[0];
        if(q.ret && leg !== 'ret'){ WL.panelPush.apply(null, flightView(q, 'ret', f)); return; }
        WL.checkoutFlight(q, leg === 'ret' ? chosenOut : f, leg === 'ret' ? f : null);
      });
    };
    return [title, sub, render];
  }
  function flightView(q, leg, chosenOut){ return showFlights(q, leg || 'out', chosenOut); }

  $('#pane-flights').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var from = WL.findAirport($('#fFrom').value), to = WL.findAirport($('#fTo').value);
    if(!from) return formMsg(form, 'We couldn\'t find that departure city. Pick one from the list.', 'fFrom');
    if(!to) return formMsg(form, 'We couldn\'t find that destination. Pick one from the list.', 'fTo');
    if(from === to) return formMsg(form, 'Departure and destination can\'t be the same.', 'fTo');
    if(from.intl && to.intl) return formMsg(form, 'We sell flights to and from India. Choose an Indian city at one end.', 'fFrom');
    var date = $('#fDepart').value, round = !$('#fReturn').disabled, ret = round ? $('#fReturn').value : null;
    if(!date || date < iso(today())) return formMsg(form, 'Choose a departure date from today onwards.', 'fDepart');
    if(round && (!ret || ret < date)) return formMsg(form, 'Return date must be on or after the departure date.', 'fReturn');
    formMsg(form, '');
    var ad = +$('#fAdults').textContent, ch = +$('#fChildren').textContent, inf = +$('#fInfants').textContent;
    var q = { from:from, to:to, date:date, ret:ret, adults:ad, children:ch, infants:inf, cls:document.querySelector('input[name="fclass"]:checked').value, fare:document.querySelector('input[name="ffare"]:checked').value };
    q.paxLabel = (ad + ch + inf) + ' traveller' + (ad + ch + inf > 1 ? 's' : '');
    saveRecent('flights', from.air + ' → ' + to.air + ', ' + fmtDateShort(parseISO(date)) + (round ? ' (return)' : ''));
    WL.panelPush.apply(null, flightView(q, 'out'));
  });

  /* ------------------------------------------------------------------ */
  /* HOTELS                                                             */
  /* ------------------------------------------------------------------ */
  var NAME_A = ['Marigold','Saffron','Banyan','Lotus','Peacock','Sandalwood','Tamarind','Neem','Amaltas','Kesar','Monsoon','Mango Tree','Indigo','Coral','Moonstone','Silver Oak','Jasmine','Champak','Riverstone','Deodar','Ashoka','Gulmohar','Ruby','Emerald','Sunbird','Kingfisher'];
  var FAM = ["D'Souza",'Thakur','Nair','Negi','Bhutia','Sharma','Menon','Rathore','Lepcha','Kharbuli','Iyer','Bisht'];
  var AREAS = {
    'Goa':['Calangute','Baga','Candolim','Anjuna','Panaji','Palolem','Colva'], 'Jaipur':['MI Road','C-Scheme','Bani Park','Near Amer','Old City'], 'Manali':['Mall Road','Old Manali','Vashisht','Aleo','Solang Road'],
    'Udaipur':['Lake Pichola','Fateh Sagar','Old City','Ambamata'], 'Mumbai':['Colaba','Andheri East','Bandra West','Juhu','Lower Parel'], 'Delhi':['Connaught Place','Paharganj','Aerocity','Karol Bagh','Saket'],
    'Bengaluru':['MG Road','Indiranagar','Koramangala','Whitefield','Hebbal'], 'Kochi':['Fort Kochi','Marine Drive','Edappally'], 'Rishikesh':['Tapovan','Swarg Ashram','Ram Jhula','Shivpuri'],
    'Varanasi':['Assi Ghat','Dashashwamedh','Godowlia','Cantonment'], 'Shimla':['Mall Road','The Ridge','Kufri','Chotta Shimla'], 'Kerala':['Munnar','Alleppey','Kumarakom','Thekkady','Fort Kochi'],
    'Kashmir':['Dal Lake','Rajbagh','Gulmarg','Pahalgam'], 'Srinagar':['Dal Lake','Rajbagh','Boulevard Road','Nigeen Lake'], 'Darjeeling':['Mall Road','Chowrasta','Ghoom'], 'Andaman':['Port Blair','Havelock','Neil Island']
  };
  var AMEN = ['Free Wi-Fi','Restaurant','Parking','Room service','Power backup','Airport shuttle','Gym','Spa','Pool','Kids\' play area','Jain food on request','Bonfire','Pet friendly'];
  function sceneForPlace(p){
    if(p.dest) return p.dest.scene;
    var d = D.destinations.filter(function(x){ return x.name === p.name || haversine(x, p) < 60; })[0];
    return d ? d.scene : ['city', ['#F7E1C4','#E2A773','#2F5E4A']];
  }
  function genHotels(p, inISO, rooms){
    var r = rng('h' + p.name), list = [], n = 12, scn = sceneForPlace(p);
    var kind = scn[0], scenic = ['beach','island','snow','mountain','tea','lake','backwater','monastery','falls'].indexOf(kind) > -1, heritage = ['fort','palace','desert','temple'].indexOf(kind) > -1;
    var cityF = ['Mumbai','Delhi','Bengaluru','Goa','Udaipur','Maldives','Dubai','Singapore'].indexOf(p.name) > -1 ? 1.2 : 1;
    var month = parseISO(inISO).getMonth() + 1, d = p.dest || D.destinations.filter(function(x){ return haversine(x, p) < 60; })[0];
    var season = d && d.months.indexOf(month) > -1 ? 1.15 : 0.92;
    var areas = AREAS[p.name] || ['City Centre','Near Railway Station','Old Town','Near Airport','Market Area','Bypass Road'];
    var used = {};
    for(var i = 0; i < n; i++){
      var x = r(), type, stars;
      if(x < 0.5){ type = 'Hotel'; stars = 2 + Math.floor(r() * 4); }
      else if(x < 0.62){ type = scenic ? 'Resort' : 'Hotel'; stars = scenic ? 4 + Math.floor(r() * 2) : 3; }
      else if(x < 0.76){ type = 'Homestay'; stars = 0; }
      else if(x < 0.84){ type = 'Villa'; stars = 0; }
      else if(x < 0.93){ type = heritage ? 'Heritage' : 'Hotel'; stars = heritage ? 4 + Math.floor(r() * 2) : 3; }
      else { type = 'Hostel'; stars = 0; }
      var A = pick(r, NAME_A), name;
      if(type === 'Hotel') name = pick(r, ['Hotel ' + A, 'The ' + A + ' Grand', A + ' Residency', A + ' Inn', A + ' Suites', 'Hotel ' + A + ' Palace']);
      else if(type === 'Resort') name = pick(r, [A + ' Resort & Spa', A + ' Retreat', A + ' Valley Resort', A + ' Bay Resort']);
      else if(type === 'Homestay') name = pick(r, [A + ' Homestay', pick(r, FAM) + '\'s Homestay', A + ' Cottage']);
      else if(type === 'Villa') name = pick(r, ['Villa ' + A, A + ' Private Pool Villa']);
      else if(type === 'Heritage') name = pick(r, [A + ' Haveli', A + ' Kothi', A + ' Mahal Heritage Hotel']);
      else name = pick(r, [A + ' Backpackers', 'The ' + A + ' Hostel']);
      if(used[name]){ i--; continue; } used[name] = 1;
      var base = { Hotel:[0, 0, 1300, 2600, 5200, 9500][stars], Resort:[0,0,0,0,6800,12500][stars], Homestay:1900, Villa:9000, Heritage:[0,0,0,0,6500,13500][stars] || 6500, Hostel:750 }[type];
      if(typeof base === 'object') base = 3000;
      var price = Math.round(base * cityF * season * (0.82 + r() * 0.4) / 10) * 10;
      var am = type === 'Hostel' ? ['Lockers','Common kitchen','Café','Laundry'].filter(function(){ return r() < 0.7; }) : type === 'Homestay' ? ['Home-cooked meals','Parking','Bonfire','Garden','Pet friendly'].filter(function(){ return r() < 0.5; }) : AMEN.filter(function(){ return r() < 0.4; });
      if(stars >= 4 && am.indexOf('Pool') < 0) am.push('Pool');
      if(kind === 'beach' || kind === 'island') am.unshift('Sea view'); if(kind === 'snow' || kind === 'mountain') am.unshift('Mountain view'); if(kind === 'lake' || kind === 'palace') am.unshift('Lake view');
      list.push({ id:'H' + i + WL.hashStr(name) % 1000, name:name, type:type, stars:stars, area:pick(r, areas), km:(0.3 + r() * 7.5).toFixed(1), price:price,
        freeCancel:r() < 0.62, breakfast:r() < 0.55, payAtHotel:r() < 0.35, couple:type !== 'Hostel' && r() < 0.65, amen:['Free Wi-Fi'].concat(am.filter(function(a){ return a !== 'Free Wi-Fi'; })).slice(0, 6),
        scene:[{ Hotel:i % 3 === 0 ? scn[0] : i % 3 === 1 ? 'city' : 'palace', Resort:scenic ? scn[0] : 'tea', Homestay:'mountain', Villa:'island', Heritage:'fort', Hostel:'city' }[type], scn[1]], rank:i });
    }
    return list;
  }
  function gstRate(nightly){ return nightly <= 1000 ? 0 : nightly <= 7500 ? 0.05 : 0.18; }
  function hotelCard(h, q){
    var starsHtml = h.stars ? '<span class="h-stars" aria-label="' + h.stars + ' star">' + Array(h.stars + 1).join('<svg class="ic"><use href="#i-star"/></svg>') + '</span>' : '<span class="pill">' + h.type + '</span>';
    var total = h.price * q.nights * q.rooms, tax = Math.round(total * gstRate(h.price));
    return '<article class="r-card r-hotel"><div class="h-img">' + WL.scene(h.scene[0], h.scene[1], h.name) + WL.heartBtn('h:' + q.place.name + ':' + h.id, h.name) + '</div>' +
      '<div class="h-info"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + starsHtml + (h.type !== 'Hotel' && h.stars ? '<span class="pill">' + h.type + '</span>' : '') + '</div><h3>' + esc(h.name) + '</h3>' +
      '<span class="h-loc"><svg class="ic"><use href="#i-pin"/></svg>' + esc(h.area) + ', ' + esc(q.place.name) + ' · ' + h.km + ' km from centre</span>' +
      '<div class="amen">' + h.amen.map(function(a){ return '<span class="pill">' + esc(a) + '</span>'; }).join('') + '</div>' +
      '<div class="amen">' + (h.freeCancel ? '<span class="pill ok">✓ Free cancellation</span>' : '') + (h.breakfast ? '<span class="pill ok">✓ Breakfast included</span>' : '') + (h.payAtHotel ? '<span class="pill warn">Pay at hotel</span>' : '') + (h.couple ? '<span class="pill">Couple friendly</span>' : '') + '</div></div>' +
      '<div class="price-col"><small>per night' + (h.type === 'Hostel' ? ' per bed' : '') + '</small><span class="p">' + money(h.price) + '</span><small>+ ' + money(tax) + ' taxes · ' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + ', ' + q.rooms + ' room' + (q.rooms > 1 ? 's' : '') + '</small><button class="btn btn-accent btn-sm" data-ht="' + h.id + '">Select room</button></div></article>';
  }
  function showHotels(q){
    var hotels = genHotels(q.place, q.checkin, q.rooms);
    var title = 'Stays in ' + q.place.name, sub = fmtDateShort(parseISO(q.checkin)) + ' – ' + fmtDateShort(parseISO(q.checkout)) + ' · ' + q.rooms + ' room' + (q.rooms > 1 ? 's' : '') + ', ' + (q.adults + q.children) + ' guests';
    return [title, sub, function(body){
      var prices = hotels.map(function(h){ return h.price; });
      var rangeMax = Math.ceil(Math.max.apply(null, prices) / 500) * 500;
      var initType = q.types.length ? q.types : [];
      var ui = resultsLayout(body, {
        items: hotels, noun:'properties',
        top: function(el){ el.innerHTML = demoNote(); },
        filters: [
          { key:'type', label:'Property type', options: countOpts(hotels, function(h){ return h.type; }), test:function(h, s){ return s.indexOf(h.type) > -1; } },
          { key:'stars', label:'Star category', options: countOpts(hotels.filter(function(h){ return h.stars; }), function(h){ return h.stars; }, function(k){ return k + ' star'; }), test:function(h, s){ return s.indexOf(String(h.stars)) > -1; } },
          { key:'perks', label:'Good to have', options:[{ v:'freeCancel', l:'Free cancellation' },{ v:'breakfast', l:'Breakfast included' },{ v:'payAtHotel', l:'Pay at hotel' },{ v:'couple', l:'Couple friendly' }], test:function(h, s){ return s.every(function(k){ return h[k]; }); } },
          { key:'price', label:'Price per night', type:'range', min: 500, max: rangeMax, step:250, test:function(h, v){ return h.price <= v; } }
        ],
        sorts: [['pop','Popular',function(a, b){ return a.rank - b.rank; }],['low','Price: low',function(a, b){ return a.price - b.price; }],['high','Price: high',function(a, b){ return b.price - a.price; }],['star','Stars',function(a, b){ return b.stars - a.stars; }]],
        card: function(h){ return hotelCard(h, q); }
      });
      // pre-apply chips from the search form
      var aside = $('.res-filters', body);
      initType.forEach(function(t){ var cb = aside.querySelector('input[data-f="type"][value="' + t + '"]'); if(cb){ cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles:true })); } });
      if(q.couple){ var cc = aside.querySelector('input[data-f="perks"][value="couple"]'); cc.checked = true; cc.dispatchEvent(new Event('change', { bubbles:true })); }
      if(q.maxPrice < 99999){ var rg = aside.querySelector('input[type="range"]'); rg.value = Math.min(q.maxPrice, rangeMax); rg.dispatchEvent(new Event('input', { bubbles:true })); }
      body.addEventListener('click', function(e){
        var b = e.target.closest('[data-ht]'); if(!b) return;
        roomPicker(hotels.filter(function(h){ return h.id === b.getAttribute('data-ht'); })[0], q);
      });
      WL.updateWishUI();
    }];
  }
  function roomPicker(h, q){
    var opts = [['Deluxe Room · Room only', 1, false], ['Deluxe Room · With breakfast', 1.12, true], ['Premium Room · Breakfast + dinner', 1.42, true]];
    if(h.type === 'Hostel') opts = [['Bed in 6-bed dorm', 1, false], ['Private room', 2.4, false]];
    if(h.breakfast) opts = opts.filter(function(o){ return o[2]; }).map(function(o){ return [o[0], o[1] - 0.12 + 0.0001, true]; });
    var html = '<p class="modal-eyebrow">' + esc(h.name) + '</p><h3 id="modalTitle">Choose your room</h3><div class="modal-body">' +
      opts.map(function(o, i){ var night = Math.round(h.price * o[1] / 10) * 10, tot = night * q.nights * q.rooms;
        return '<label class="addon"><input type="radio" name="roomOpt" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><div><strong>' + esc(o[0]) + '</strong><small>' + (h.freeCancel ? 'Free cancellation until 24 hrs before check-in' : 'Non-refundable') + (h.payAtHotel ? ' · Pay at hotel available' : '') + '</small></div><span class="ap">' + money(night) + '<small style="display:block;font-weight:400;color:var(--muted)">/night · ' + money(tot) + ' total</small></span></label>';
      }).join('') + '<button class="btn btn-accent btn-block" id="roomGo">Continue</button></div>';
    WL.openModal(html);
    $('#roomGo').addEventListener('click', function(){
      var o = opts[+document.querySelector('input[name="roomOpt"]:checked').value];
      WL.closeModal(); WL.checkoutHotel(q, h, o[0], Math.round(h.price * o[1] / 10) * 10);
    });
  }
  $('#pane-hotels').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var place = WL.findPlace($('#hCity').value);
    if(!place) return formMsg(form, 'We couldn\'t find that place. Try a city like Jaipur, Manali or Goa.', 'hCity');
    var ci = $('#hIn').value, co = $('#hOut').value;
    if(!ci || ci < iso(today())) return formMsg(form, 'Check-in must be today or later.', 'hIn');
    if(!co || co <= ci) return formMsg(form, 'Check-out must be after check-in.', 'hOut');
    var nights = daysBetween(parseISO(ci), parseISO(co));
    if(nights > 30) return formMsg(form, 'For stays longer than 30 nights, contact us for monthly rates.', 'hOut');
    formMsg(form, '');
    var pr = $('#hPrice').value.split('-');
    var q = { place:place, checkin:ci, checkout:co, nights:nights, rooms:+$('#hRooms').textContent, adults:+$('#hAdults').textContent, children:+$('#hChildren').textContent,
      maxPrice:+pr[1], types: $$('input[name="htype"]:checked').map(function(c){ return c.value; }), couple: !!document.querySelector('input[name="htag"]:checked') };
    saveRecent('hotels', place.name + ', ' + fmtDateShort(parseISO(ci)) + ' · ' + nights + 'N');
    WL.panelPush.apply(null, showHotels(q));
  });

  /* ------------------------------------------------------------------ */
  /* TRAINS                                                             */
  /* ------------------------------------------------------------------ */
  var CLS = {
    SL:{ n:'Sleeper', pk:0.56, min:150, res:20, sf:30, flat:120, tk:[100,200] }, '3E':{ n:'AC 3 Economy', pk:1.32, min:450, res:40, sf:45, flat:180, tk:[300,400] },
    '3A':{ n:'AC 3 Tier', pk:1.46, min:500, res:40, sf:45, flat:180, tk:[300,400] }, '2A':{ n:'AC 2 Tier', pk:2.08, min:700, res:50, sf:45, flat:200, tk:[400,500] },
    '1A':{ n:'AC First Class', pk:3.45, min:1200, res:60, sf:75, flat:240, tk:[400,500] }, CC:{ n:'AC Chair Car', pk:1.32, min:300, res:40, sf:45, flat:180, tk:[125,225] },
    EC:{ n:'Executive Chair', pk:2.62, min:600, res:60, sf:75, flat:240, tk:[400,500] }
  };
  function trainFare(cls, km, premium, tatkal){
    var c = CLS[cls], base = Math.max(c.min, km * c.pk) * (premium ? 1.22 : 1);
    var t = tatkal ? Math.min(c.tk[1], Math.max(c.tk[0], base * 0.3)) : 0;
    var gst = cls === 'SL' ? 0 : (base + c.res + c.sf + t) * 0.05;
    return Math.round(base + c.res + c.sf + t + gst);
  }
  function genTrains(a, b, date, quota){
    var km = Math.round(haversine(a, b) * 1.22), r = rng('t' + a.rail + b.rail + date), list = [];
    var abbr = function(c){ return c.name.split(' ')[0]; };
    var types = [];
    if(km >= 120 && km <= 800 && r() < 0.85) types.push({ t:'Vande Bharat Express', cls:['CC','EC'], sp:84, no:'22', premium:true });
    if(km >= 120 && km <= 700 && r() < 0.6) types.push({ t:'Shatabdi Express', cls:['CC','EC'], sp:78, no:'120', premium:true });
    if(km >= 380 && (a.name === 'Delhi' || b.name === 'Delhi')) types.push({ t:'Rajdhani Express', cls:['3A','2A','1A'], sp:76, no:'12', premium:true });
    if(km >= 700 && r() < 0.6) types.push({ t:'Duronto Express', cls:['SL','3A','2A','1A'], sp:72, no:'122', premium:false });
    if(km >= 500 && r() < 0.6) types.push({ t:'Humsafar Express', cls:['3E','3A'], sp:62, no:'22', premium:false });
    var nSF = 2 + Math.floor(r() * 2);
    for(var i = 0; i < nSF; i++) types.push({ t:pick(r, ['Superfast Express','SF Express','Sampark Kranti Express','Express']), cls: ['SL','3E','3A','2A'].concat(r() < 0.4 ? ['1A'] : []), sp:58 - Math.floor(r() * 6), no:'1', premium:false });
    if(km > 150) types.push({ t:'Mail', cls:['SL','3A','2A'], sp:47, no:'1', premium:false });
    types.forEach(function(ty, i){
      var dep = ty.t.indexOf('Rajdhani') > -1 || ty.t.indexOf('Duronto') > -1 ? 960 + Math.floor(r() * 30) * 10 : ty.premium ? 330 + Math.floor(r() * 30) * 10 : 240 + Math.floor(r() * 120) * 10;
      var mins = Math.round(km / ty.sp * 60 / 5) * 5;
      var num = (ty.no + String(Math.floor(r() * Math.pow(10, 5 - ty.no.length) + Math.pow(10, 4 - ty.no.length)))).slice(0, 5);
      var runs = ty.t.indexOf('Vande') > -1 ? [1,1,1,1,1,1,0].map(function(_, k){ return k === Math.floor(r() * 7) ? 0 : 1; }) : ty.premium || r() < 0.5 ? [1,1,1,1,1,1,1] : [0,1,0,1,0,1,0].map(function(v){ return r() < 0.3 ? 1 - v : v; });
      var classes = ty.cls.map(function(c){
        var x = r(), st, n;
        if(quota === 'Tatkal'){ st = x < 0.35 ? 'AVL' : x < 0.6 ? 'WL' : x < 0.8 ? 'RAC' : 'REGRET'; n = 1 + Math.floor(r() * (st === 'AVL' ? 40 : 30)); }
        else { st = x < 0.45 ? 'AVL' : x < 0.62 ? 'RAC' : x < 0.93 ? 'WL' : 'REGRET'; n = 1 + Math.floor(r() * (st === 'AVL' ? 220 : st === 'WL' ? 120 : 40)); }
        var chance = st === 'WL' ? (n < 25 ? 'High' : n < 70 ? 'Medium' : 'Low') : null;
        return { c:c, st:st, n:n, chance:chance, fare:trainFare(c, km, ty.premium, quota === 'Tatkal') };
      });
      list.push({ id:num, name:abbr(a) + ' – ' + abbr(b) + ' ' + ty.t, no:num, dep:dep, arr:dep + mins, dur:mins, km:km, runs:runs, classes:classes, premium:ty.premium });
    });
    var day = parseISO(date).getDay();
    return list.filter(function(t){ return t.runs[day]; });
  }
  function availHtml(c){
    if(c.st === 'AVL') return '<span class="av ok">AVL ' + pad3(c.n) + '</span>';
    if(c.st === 'RAC') return '<span class="av warn">RAC ' + c.n + '</span>';
    if(c.st === 'WL') return '<span class="av warn">WL ' + c.n + '</span><small>' + c.chance + ' chance to confirm</small>';
    return '<span class="av bad">Regret / not available</span>';
  }
  function pad3(n){ return ('00' + n).slice(-3); }
  function showTrains(q){
    var title = q.from.railName + ' → ' + q.to.railName, sub = fmtDateShort(parseISO(q.date)) + ' · ' + (q.cls === 'ALL' ? 'All classes' : CLS[q.cls].n) + ' · ' + q.quota;
    return [title, sub, function(body){
      var tatkalOpen = addDays(parseISO(q.date), -1);
      if(q.quota === 'Tatkal' && tatkalOpen > today()){
        body.innerHTML = '<div class="container" style="padding-top:20px"></div>';
        var c = $('.container', body); c.appendChild(dateNav(q.date, function(nd){ WL.panelReplace.apply(null, showTrains(Object.assign({}, q, { date:nd }))); }));
        c.insertAdjacentHTML('beforeend', '<div class="empty" style="margin-top:14px"><strong>Tatkal booking for ' + fmtDate(q.date, true) + ' opens on ' + fmtDate(tatkalOpen, true) + '.</strong><span>10:00 AM for AC classes, 11:00 AM for Sleeper. Book in General quota now, or come back then.</span><button class="btn btn-ink btn-sm" id="toGeneral">Show General quota</button></div>');
        $('#toGeneral').addEventListener('click', function(){ WL.panelReplace.apply(null, showTrains(Object.assign({}, q, { quota:'General' }))); });
        return;
      }
      var trains = genTrains(q.from, q.to, q.date, q.quota);
      if(q.cls !== 'ALL') trains = trains.filter(function(t){ return t.classes.some(function(c){ return c.c === q.cls; }); });
      if(!trains.length){
        body.innerHTML = '<div class="container" style="padding-top:20px"></div>';
        $('.container', body).appendChild(dateNav(q.date, function(nd){ WL.panelReplace.apply(null, showTrains(Object.assign({}, q, { date:nd }))); }));
        $('.container', body).insertAdjacentHTML('beforeend', '<div class="empty" style="margin-top:14px"><strong>No trains run on this day in the selected class.</strong><span>Try the next day, or switch to All classes.</span></div>');
        return;
      }
      resultsLayout(body, {
        items: trains, noun:'trains',
        top: function(el){ el.appendChild(dateNav(q.date, function(nd){ WL.panelReplace.apply(null, showTrains(Object.assign({}, q, { date:nd }))); })); el.insertAdjacentHTML('beforeend', demoNote()); },
        filters: [
          { key:'cls', label:'Class', options: Object.keys(CLS).filter(function(k){ return trains.some(function(t){ return t.classes.some(function(c){ return c.c === k; }); }); }).map(function(k){ return { v:k, l:CLS[k].n + ' (' + k + ')' }; }), test:function(t, s){ return t.classes.some(function(c){ return s.indexOf(c.c) > -1; }); } },
          { key:'avl', label:'Availability', options:[{ v:'AVL', l:'Confirmed seats available' }], test:function(t){ return t.classes.some(function(c){ return c.st === 'AVL'; }); } },
          { key:'slot', label:'Departure', type:'slot', options: SLOTS.map(function(l, i){ return { v:i, l:l }; }), test:function(t, s){ return s.indexOf(String(slotOf(t.dep))) > -1; } }
        ],
        sorts: [['dep','Departure',function(a, b){ return a.dep - b.dep; }],['fast','Fastest',function(a, b){ return a.dur - b.dur; }],['arr','Arrival',function(a, b){ return a.arr - b.arr; }]],
        card: function(t){
          var shown = q.cls === 'ALL' ? t.classes : t.classes.filter(function(c){ return c.c === q.cls; });
          return '<article class="r-card r-train"><div class="t-head"><div><h3><span class="no">' + t.no + '</span>' + esc(t.name) + '</h3><div class="rundays" aria-label="Runs on">' + 'SMTWTFS'.split('').map(function(d, i){ return '<span class="' + (t.runs[i] ? 'on' : '') + '">' + d + '</span>'; }).join('') + '</div></div>' +
            '<div class="leg" style="min-width:min(100%,320px)"><div><div class="t">' + hm(t.dep) + '</div><div class="c">' + q.from.rail + '</div></div><div class="mid">' + dur(t.dur) + '<div class="line"></div>' + t.km + ' km</div><div class="end"><div class="t">' + hm(t.arr) + (Math.floor(t.arr / 1440) ? '<sup style="font-size:.6em;color:var(--accent-strong)"> +' + Math.floor(t.arr / 1440) + '</sup>' : '') + '</div><div class="c">' + q.to.rail + '</div></div></div></div>' +
            '<div class="cls-row">' + shown.map(function(c){ return '<button class="cls" data-tr="' + t.id + '" data-cl="' + c.c + '"' + (c.st === 'REGRET' ? ' disabled' : '') + '><span class="cn"><span>' + c.c + '</span><span>' + money(c.fare) + '</span></span>' + availHtml(c) + '<small>' + (q.quota === 'Tatkal' ? 'Tatkal · ' : '') + 'Tap to book</small></button>'; }).join('') + '</div>' +
            (t.premium ? '<div class="r-tags"><span class="pill">Meals included in fare</span></div>' : '') + '</article>';
        }
      });
      body.addEventListener('click', function(e){
        var b = e.target.closest('[data-tr]'); if(!b || b.disabled) return;
        var t = trains.filter(function(x){ return x.id === b.getAttribute('data-tr'); })[0];
        var c = t.classes.filter(function(x){ return x.c === b.getAttribute('data-cl'); })[0];
        WL.checkoutTrain(q, t, c);
      });
    }];
  }
  $('#pane-trains').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var a = WL.findStation($('#tFrom').value), b = WL.findStation($('#tTo').value);
    if(!a) return formMsg(form, 'Pick a departure station from the list.', 'tFrom');
    if(!b) return formMsg(form, 'Pick a destination station from the list.', 'tTo');
    if(a === b) return formMsg(form, 'Stations can\'t be the same.', 'tTo');
    var date = $('#tDate').value;
    if(!date || date < iso(today())) return formMsg(form, 'Choose a journey date from today onwards.', 'tDate');
    if(date > iso(addDays(today(), 60))) return formMsg(form, 'Train bookings open 60 days before the journey date.', 'tDate');
    formMsg(form, '');
    var q = { from:a, to:b, date:date, cls:$('#tClass').value, quota:$('#tQuota').value };
    saveRecent('trains', a.rail + ' → ' + b.rail + ', ' + fmtDateShort(parseISO(date)));
    WL.panelPush.apply(null, showTrains(q));
  });

  /* ------------------------------------------------------------------ */
  /* BUSES                                                              */
  /* ------------------------------------------------------------------ */
  var OPS = ['Kesari Roadways','Gaurav Express Travels','Nandi Travels','Moonlight Sleeper Coaches','Ghat Line Travels','Highway Star','Sahyadri Travels','Shree Ganesh Travels','Blue Pearl Tours','Ganga Darshan Travels'];
  var BTYPES = [
    { t:'AC Sleeper (2+1)', ac:true, sleeper:true, pk:2.05 }, { t:'Volvo Multi-Axle AC Semi-Sleeper (2+2)', ac:true, sleeper:false, pk:1.85 },
    { t:'Non-AC Seater (2+2)', ac:false, sleeper:false, pk:1.05 }, { t:'AC Seater / Sleeper (2+1)', ac:true, sleeper:true, pk:1.75 }, { t:'Electric AC Seater (2+2)', ac:true, sleeper:false, pk:1.55 },
    { t:'Non-AC Sleeper (2+1)', ac:false, sleeper:true, pk:1.35 }
  ];
  function genBuses(a, b, date){
    var km = Math.round(haversine(a, b) * 1.3), r = rng('b' + a.name + b.name + date), list = [], n = 7 + Math.floor(r() * 4);
    for(var i = 0; i < n; i++){
      var ty = pick(r, BTYPES), long = km > 280;
      var dep = long ? 1020 + Math.floor(r() * 80) * 5 : 300 + Math.floor(r() * 200) * 5;
      var mins = Math.round(km / (ty.ac ? 52 : 46) * 60 / 15) * 15;
      var fare = Math.round(Math.max(250, km * ty.pk) * (0.9 + r() * 0.25) / 10) * 10 - 1;
      var seats = ty.sleeper ? 30 : 40, booked = [], ladies = [];
      for(var s = 0; s < seats; s++){ var x = r(); if(x < 0.45) booked.push(s); else if(x < 0.52) ladies.push(s); }
      list.push({ id:'B' + i, op:OPS[(WL.hashStr(a.name + b.name) + i * 3) % OPS.length], type:ty, dep:dep, arr:dep + mins, dur:mins, km:km, fare:fare, seats:seats, booked:booked, ladies:ladies,
        amen: ['Water bottle','Charging point','Reading light','Blanket','CCTV','Emergency contact'].filter(function(){ return r() < 0.55; }), track:r() < 0.8 });
    }
    return list;
  }
  function seatMap(bus, sel){
    function seat(i, label){
      var cls = 'seat' + (bus.type.sleeper ? ' sleeper' : '') + (bus.booked.indexOf(i) > -1 ? ' booked' : bus.ladies.indexOf(i) > -1 ? ' ladies' : '') + (sel.indexOf(i) > -1 ? ' sel' : '');
      var dis = bus.booked.indexOf(i) > -1;
      return '<button class="' + cls + '" data-seat="' + i + '"' + (dis ? ' disabled aria-label="' + label + ' booked"' : ' aria-label="Seat ' + label + (bus.ladies.indexOf(i) > -1 ? ', reserved for women' : '') + '" aria-pressed="' + (sel.indexOf(i) > -1) + '"') + '>' + label + '</button>';
    }
    if(bus.type.sleeper){
      var deck = function(start, pre){ var h = '<div class="seat-grid" style="grid-template-columns:repeat(4,30px)">'; for(var r = 0; r < 5; r++){ h += seat(start + r * 3, pre + (r * 3 + 1)) + '<span class="seat gap"></span>' + seat(start + r * 3 + 1, pre + (r * 3 + 2)) + seat(start + r * 3 + 2, pre + (r * 3 + 3)); } return h + '</div>'; };
      return '<div class="decks"><div class="deck"><span class="deck-title">Lower deck</span>' + deck(0, 'L') + '</div><div class="deck"><span class="deck-title">Upper deck</span>' + deck(15, 'U') + '</div></div>';
    }
    var h = '<div class="seat-grid" style="grid-template-columns:repeat(5,30px)">';
    for(var r2 = 0; r2 < 10; r2++){ h += seat(r2 * 4, r2 * 4 + 1) + seat(r2 * 4 + 1, r2 * 4 + 2) + '<span class="seat gap"></span>' + seat(r2 * 4 + 2, r2 * 4 + 3) + seat(r2 * 4 + 3, r2 * 4 + 4); }
    return '<div class="decks"><div class="deck"><span class="deck-title">Seats · driver at front</span>' + h + '</div></div></div>';
  }
  function seatLabel(bus, i){ return bus.type.sleeper ? (i < 15 ? 'L' + (i + 1) : 'U' + (i - 14)) : String(i + 1); }
  function showBuses(q){
    var buses = genBuses(q.from, q.to, q.date);
    var title = q.from.name + ' → ' + q.to.name + ' buses', sub = fmtDateShort(parseISO(q.date)) + ' · ' + buses[0].km + ' km';
    return [title, sub, function(body){
      var openBus = null, sel = [];
      var ui = resultsLayout(body, {
        items: buses, noun:'buses',
        top: function(el){ el.appendChild(dateNav(q.date, function(nd){ WL.panelReplace.apply(null, showBuses(Object.assign({}, q, { date:nd }))); })); el.insertAdjacentHTML('beforeend', demoNote()); },
        filters: [
          { key:'ac', label:'Bus type', options:[{ v:'ac', l:'AC' },{ v:'nonac', l:'Non-AC' },{ v:'sleeper', l:'Sleeper' },{ v:'seater', l:'Seater' }], test:function(b, s){ return s.every(function(k){ return k === 'ac' ? b.type.ac : k === 'nonac' ? !b.type.ac : k === 'sleeper' ? b.type.sleeper : !b.type.sleeper; }); } },
          { key:'slot', label:'Departure', type:'slot', options: SLOTS.map(function(l, i){ return { v:i, l:l }; }), test:function(b, s){ return s.indexOf(String(slotOf(b.dep))) > -1; } },
          { key:'op', label:'Operator', options: countOpts(buses, function(b){ return b.op; }), test:function(b, s){ return s.indexOf(b.op) > -1; } }
        ],
        sorts: [['low','Cheapest',function(a, b){ return a.fare - b.fare; }],['dep','Departure',function(a, b){ return a.dep - b.dep; }],['fast','Fastest',function(a, b){ return a.dur - b.dur; }]],
        card: function(b){
          var left = b.seats - b.booked.length;
          var html = '<article class="r-card r-bus" data-bus-card="' + b.id + '"><div><h3>' + esc(b.op) + '</h3><p class="btype">' + esc(b.type.t) + '</p></div>' +
            '<div class="leg"><div><div class="t">' + hm(b.dep) + '</div><div class="c">' + esc(q.from.name) + '</div></div><div class="mid">' + dur(b.dur) + '<div class="line"></div></div><div class="end"><div class="t">' + hm(b.arr) + (Math.floor(b.arr / 1440) ? '<sup style="font-size:.6em;color:var(--accent-strong)"> +1</sup>' : '') + '</div><div class="c">' + esc(q.to.name) + '</div></div></div>' +
            '<div class="price-col"><small>Starts from</small><span class="p">' + money(b.fare) + '</span><small>' + left + ' seats left</small><button class="btn btn-accent btn-sm" data-bus="' + b.id + '" aria-expanded="' + (openBus === b.id) + '">' + (openBus === b.id ? 'Hide seats' : 'Select seats') + '</button></div>' +
            '<div class="r-tags">' + b.amen.map(function(a){ return '<span class="pill">' + a + '</span>'; }).join('') + (b.track ? '<span class="pill ok">Live tracking</span>' : '') + '</div>';
          if(openBus === b.id){
            html += '<div class="seat-area">' + seatMap(b, sel) + '<div class="seat-side"><div class="seat-legend"><span><i></i>Available</span><span><i class="lb"></i>Booked</span><span><i class="ll"></i>Women only</span></div>' +
              '<div class="form-row"><label for="bBoard">Boarding point</label><select id="bBoard">' + [q.from.name + ' Central Bus Stand', q.from.name + ' Railway Station', q.from.name + ' Bypass Toll Plaza'].map(function(p, i){ return '<option>' + hm(b.dep + i * 20) + ' · ' + esc(p) + '</option>'; }).join('') + '</select></div>' +
              '<div class="form-row"><label for="bDrop">Dropping point</label><select id="bDrop">' + [q.to.name + ' Bypass', q.to.name + ' City Bus Stand', q.to.name + ' Railway Station'].map(function(p, i){ return '<option>' + hm(b.arr - 30 + i * 20) + ' · ' + esc(p) + '</option>'; }).join('') + '</select></div>' +
              '<div class="sum-row"><span>Seats: <b>' + (sel.length ? sel.map(function(i){ return seatLabel(b, i); }).join(', ') : 'none') + '</b></span><b>' + money(b.fare * sel.length) + '</b></div>' +
              '<button class="btn btn-accent" data-bus-go="' + b.id + '"' + (sel.length ? '' : ' disabled') + '>Continue with ' + sel.length + ' seat' + (sel.length === 1 ? '' : 's') + '</button></div></div>';
          }
          return html + '</article>';
        }
      });
      body.addEventListener('click', function(e){
        var t = e.target.closest('[data-bus]');
        if(t){ var id = t.getAttribute('data-bus'); openBus = openBus === id ? null : id; sel = []; ui.apply(); var c = $('[data-bus-card="' + id + '"]', body); if(c && openBus) c.scrollIntoView({ block:'nearest' }); return; }
        var s = e.target.closest('[data-seat]');
        if(s && !s.disabled){
          var bus = buses.filter(function(x){ return x.id === openBus; })[0], i = +s.getAttribute('data-seat');
          if(bus.ladies.indexOf(i) > -1 && !q.women && sel.indexOf(i) < 0){ toast('This seat is reserved for women. Tick "Booking for women" in the search to select it.'); return; }
          var k = sel.indexOf(i); if(k > -1) sel.splice(k, 1); else { if(sel.length >= 6){ toast('You can book up to 6 seats at a time'); return; } sel.push(i); }
          var y = $('.panel-body').scrollTop; ui.apply(); $('.panel-body').scrollTop = y; return;
        }
        var g = e.target.closest('[data-bus-go]');
        if(g && !g.disabled){
          var bus2 = buses.filter(function(x){ return x.id === g.getAttribute('data-bus-go'); })[0];
          WL.checkoutBus(q, bus2, sel.map(function(i){ return seatLabel(bus2, i); }), $('#bBoard').value, $('#bDrop').value);
        }
      });
    }];
  }
  $('#pane-buses').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var a = WL.findPlace($('#bFrom').value), b = WL.findPlace($('#bTo').value);
    if(!a || a.intl) return formMsg(form, 'Pick a departure city in India.', 'bFrom');
    if(!b || b.intl) return formMsg(form, 'Pick a destination city in India.', 'bTo');
    if(a.name === b.name) return formMsg(form, 'Cities can\'t be the same.', 'bTo');
    var km = haversine(a, b) * 1.3;
    if(/Andaman|Port Blair/.test(a.name + b.name)) return formMsg(form, 'The Andaman Islands have no road link to the mainland. Try flights.', 'bTo');
    if(km > 1400) return formMsg(form, 'That\'s about ' + Math.round(km / 10) * 10 + ' km by road. Buses run up to ~1,400 km; try a train or flight.', 'bTo');
    var date = $('#bDate').value; if(!date || date < iso(today())) return formMsg(form, 'Choose a journey date from today onwards.', 'bDate');
    formMsg(form, '');
    var q = { from:a, to:b, date:date, women: $('#bLadies').checked };
    saveRecent('buses', a.name + ' → ' + b.name + ', ' + fmtDateShort(parseISO(date)));
    WL.panelPush.apply(null, showBuses(q));
  });

  /* ------------------------------------------------------------------ */
  /* CABS                                                               */
  /* ------------------------------------------------------------------ */
  var CARS = [
    { t:'Hatchback', eg:'Wagon R, Swift or similar', seats:4, bags:1, rate:11, ac:true },
    { t:'Sedan', eg:'Dzire, Etios or similar', seats:4, bags:2, rate:12.5, ac:true },
    { t:'SUV', eg:'Ertiga or similar', seats:6, bags:3, rate:16, ac:true },
    { t:'Premium SUV', eg:'Innova Crysta or similar', seats:6, bags:4, rate:19.5, ac:true },
    { t:'Tempo Traveller', eg:'12-seater', seats:12, bags:8, rate:26, ac:true }
  ];
  function showCabs(q){
    var title, sub, km, days = 1;
    if(q.mode === 'oneway' || q.mode === 'round'){ km = Math.max(80, Math.round(haversine(q.from, q.to) * 1.3)); }
    if(q.mode === 'oneway'){ title = q.from.name + ' → ' + q.to.name + ' one-way'; sub = '~' + km + ' km · ' + fmtDateShort(parseISO(q.date)) + ', ' + q.time; }
    if(q.mode === 'round'){ days = Math.max(1, daysBetween(parseISO(q.date), parseISO(q.ret)) + 1); title = q.from.name + ' ⇄ ' + q.to.name; sub = days + ' day' + (days > 1 ? 's' : '') + ' · ~' + (km * 2) + ' km · from ' + fmtDateShort(parseISO(q.date)); }
    if(q.mode === 'airport'){ km = 32; title = (q.dir === 'to' ? q.from.name + ' → Airport' : 'Airport → ' + q.from.name); sub = fmtDateShort(parseISO(q.date)) + ', ' + q.time; }
    if(q.mode === 'rental'){ title = q.from.name + ' local rental'; sub = q.hours + ' hrs / ' + (q.hours * 10) + ' km · ' + fmtDateShort(parseISO(q.date)); }
    var cars = CARS.map(function(c){
      var fare, incl, extra;
      if(q.mode === 'oneway'){ fare = km * c.rate + (km > 350 ? 600 : 300); incl = km + ' km'; extra = '₹' + c.rate + '/km after ' + km + ' km'; }
      else if(q.mode === 'round'){ var billKm = Math.max(km * 2, 250 * days); fare = billKm * c.rate + 350 * days; incl = billKm + ' km (min 250 km/day)'; extra = '₹' + c.rate + '/km extra · driver allowance ₹350/day incl.'; }
      else if(q.mode === 'airport'){ fare = km * c.rate + 150; incl = 'Up to ' + km + ' km · 45 min free waiting'; extra = '₹' + c.rate + '/km extra'; }
      else { fare = { 4:900, 8:1600, 12:2300 }[q.hours] * c.rate / 11; incl = q.hours + ' hrs / ' + (q.hours * 10) + ' km'; extra = '₹' + c.rate + '/km and ₹' + Math.round(c.rate * 14) + '/hr extra'; }
      fare = Math.round(fare * 1.05 / 10) * 10;
      return { car:c, fare:fare, incl:incl, extra:extra };
    });
    return [title, sub, function(body){
      body.innerHTML = '<div class="container" style="padding-top:20px;display:flex;flex-direction:column;gap:14px">' + demoNote() + cars.map(function(x, i){
        return '<article class="r-card r-cab"><div class="cab-ic"><svg class="ic"><use href="#' + (x.car.seats > 6 ? 'i-bus' : 'i-car') + '"/></svg></div><div><h3 style="font-size:1.08rem">' + x.car.t + ' <small class="muted" style="font-family:var(--font-body);font-weight:400;font-size:.8rem">' + esc(x.car.eg) + '</small></h3>' +
          '<p class="small muted">' + x.car.seats + ' seats · ' + x.car.bags + ' bags · AC · ' + esc(x.incl) + '</p><div class="amen" style="margin-top:6px"><span class="pill ok">Free cancellation till 6 hrs before</span><span class="pill">Verified driver</span><span class="pill">' + esc(x.extra) + '</span></div></div>' +
          '<div class="price-col"><span class="p">' + money(x.fare) + '</span><small>incl. GST & driver allowance</small><button class="btn btn-accent btn-sm" data-cab="' + i + '">Book</button></div></article>';
      }).join('') + '<p class="small muted">Tolls, parking, state entry taxes and night charges (10 PM – 6 AM) are paid to the driver at actuals.</p></div>';
      body.addEventListener('click', function(e){ var b = e.target.closest('[data-cab]'); if(!b) return; var x = cars[+b.getAttribute('data-cab')]; WL.checkoutCab(q, x, title, sub); });
    }];
  }
  $('#pane-cabs').addEventListener('submit', function(e){
    e.preventDefault(); var form = this, mode = document.querySelector('input[name="ctype"]:checked').value;
    var a = WL.findPlace($('#cFrom').value); if(!a || a.intl) return formMsg(form, 'Pick a pick-up city in India.', 'cFrom');
    var q = { mode:mode, from:a, date:$('#cDate').value, time:$('#cTime').value || '07:00' };
    if(!q.date || q.date < iso(today())) return formMsg(form, 'Choose a pick-up date from today onwards.', 'cDate');
    if(mode === 'oneway' || mode === 'round'){
      var b = WL.findPlace($('#cTo').value); if(!b || b.intl) return formMsg(form, 'Pick a drop city in India.', 'cTo');
      if(b.name === a.name) return formMsg(form, 'For travel within a city, choose Hourly rental.', 'cTo');
      if(haversine(a, b) * 1.3 > 2500) return formMsg(form, 'That trip is too long for a cab. Try a train or flight.', 'cTo');
      q.to = b;
    }
    if(mode === 'round'){ q.ret = $('#cRet').value; if(!q.ret || q.ret < q.date) return formMsg(form, 'Return date must be on or after the pick-up date.', 'cRet'); }
    if(mode === 'airport') q.dir = $('#cAirDir').value;
    if(mode === 'rental') q.hours = +$('#cPkg').value;
    formMsg(form, '');
    saveRecent('cabs', 'Cab: ' + a.name + (q.to ? ' → ' + q.to.name : mode === 'airport' ? ' airport' : ' rental'));
    WL.panelPush.apply(null, showCabs(q));
  });

  /* ------------------------------------------------------------------ */
  /* HOLIDAYS (filters the packages section)                            */
  /* ------------------------------------------------------------------ */
  var THEME_MAP = { 'honeymoon':'honeymoon','pilgrimage':'spiritual','spiritual':'spiritual','adventure':'adventure','hill stations':'hill','hills':'hill','beaches':'beach','beach':'beach','heritage':'heritage','wildlife':'wildlife','north east':'northeast','northeast':'northeast','international':'international','weekend':'weekend','char dham':null };
  $('#pane-holidays').addEventListener('submit', function(e){
    e.preventDefault();
    var txt = $('#pDest').value.trim(), low = txt.toLowerCase(), q = { label: txt || 'your filters' };
    var d = D.destinations.filter(function(x){ return x.name.toLowerCase() === low; })[0];
    if(d) q.dest = d.id; else if(THEME_MAP[low]) q.theme = THEME_MAP[low]; else if(low) q.text = low;
    var n = $('#pNights').value.split('-'), b = $('#pBudget').value.split('-'), m = +$('#pMonth').value;
    if($('#pNights').value !== '0-99') q.nights = [+n[0], +n[1]];
    if($('#pBudget').value !== '0-9999999') q.budget = [+b[0], +b[1]];
    if(m) q.month = m;
    var parts = []; if(txt) parts.push(txt); if(m) parts.push(WL.MONTHS_FULL[m - 1]); if(q.nights) parts.push($('#pNights').selectedOptions[0].text); if(q.budget) parts.push($('#pBudget').selectedOptions[0].text);
    q.label = parts.join(' · ') || 'all packages';
    WL.filterPackages(q);
  });

  /* ------------------------------------------------------------------ */
  /* VISA                                                               */
  /* ------------------------------------------------------------------ */
  var VISA_NOTES = {
    'Schengen (Europe)':'Travel medical insurance with at least €30,000 cover is mandatory for a Schengen visa. Apply at the embassy of the country where you spend the most nights.',
    'United States':'Fill the DS-160 form online, pay the fee and book a biometrics and interview appointment at a US consulate. Wait times can be long, so apply early.',
    'United Kingdom':'Apply online and give biometrics at a visa application centre. Standard processing usually takes about three weeks.',
    'Australia':'Apply online through ImmiAccount. Health checks may be required depending on your history.',
    'Japan':'Submit through an accredited agency or visa centre. An itinerary and proof of funds are essential.'
  };
  function showVisa(q){
    var docs = ['Passport valid for at least 6 months from your return date, with 2 blank pages','Two recent passport-size photos with white background','Confirmed return flight tickets','Hotel bookings for the full stay','Last 6 months\' bank statements, signed and stamped','Last 3 years\' ITR or Form 16','Cover letter with your travel plan'];
    if(q.purpose === 'Business') docs.push('Invitation letter from the host company','Letter from your employer on letterhead');
    if(q.purpose === 'Visiting family') docs.push('Invitation letter and ID or residence permit of your host');
    return ['Visa: ' + q.country, q.purpose + ' · ' + q.pax + ' traveller' + (q.pax > 1 ? 's' : '') + ' · travel ' + fmtDateShort(parseISO(q.date)), function(body){
      body.innerHTML = '<div class="container" style="padding-top:20px;display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));align-items:start">' +
        '<div class="co-card"><h3>Document checklist</h3><ul class="d-list">' + docs.map(function(d){ return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        (VISA_NOTES[q.country] ? '<p class="demo-note">' + esc(VISA_NOTES[q.country]) + '</p>' : '<p class="demo-note">Depending on current rules, ' + esc(q.country) + ' may offer an e-visa, visa on arrival or visa-free entry for Indian passport holders. Our visa desk confirms the latest before you apply.</p>') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:14px">' + [['Standard assistance', 1499, 'Document review, form filling and appointment booking.'], ['Express with doorstep pickup', 2999, 'Everything in Standard, plus priority handling and document pickup and drop.']].map(function(p, i){
          return '<div class="plan' + (i === 1 ? ' rec' : '') + '"><h3 style="font-size:1.1rem">' + p[0] + '</h3><p class="small muted">' + p[2] + '</p><div class="big-num" style="font-size:1.6rem">' + money(p[1]) + '<small style="font-size:.8rem;font-weight:400"> per person + GST</small></div><p class="small muted">Embassy / government fees are paid separately at actuals.</p><button class="btn btn-accent btn-sm" data-visa="' + i + '">Book visa help</button></div>';
        }).join('') + '</div></div>';
      body.addEventListener('click', function(e){ var b = e.target.closest('[data-visa]'); if(!b) return; var plan = [['Standard visa assistance', 1499], ['Express visa assistance', 2999]][+b.getAttribute('data-visa')]; WL.checkoutService({ kind:'visa', title:plan[0] + ' · ' + q.country, sub:q.purpose + ' visa · travel ' + fmtDate(q.date), date:q.date, unit:plan[1], count:q.pax, gst:0.18, paxFields:'visa' }); });
    }];
  }
  $('#pane-visa').addEventListener('submit', function(e){
    e.preventDefault(); var form = this, date = $('#vDate').value, pax = +$('#vPax').value;
    if(!date || date < iso(today())) return formMsg(form, 'Choose your travel date.', 'vDate');
    if(!(pax >= 1 && pax <= 20)) return formMsg(form, 'Enter between 1 and 20 travellers.', 'vPax');
    formMsg(form, ''); WL.panelPush.apply(null, showVisa({ country:$('#vCountry').value, purpose:$('#vPurpose').value, date:date, pax:pax }));
  });

  /* ------------------------------------------------------------------ */
  /* FOREX                                                              */
  /* ------------------------------------------------------------------ */
  function forexGst(v){ if(v <= 100000) return Math.max(45, v * 0.0018); if(v <= 1000000) return 180 + (v - 100000) * 0.0009; return Math.min(10800, 990 + (v - 1000000) * 0.00018); }
  $('#pane-forex').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var f = D.forex.filter(function(x){ return x.code === $('#xCur').value; })[0], amt = +$('#xAmt').value, dir = document.querySelector('input[name="xdir"]:checked').value, prod = $('#xProd').value;
    var city = WL.findPlace($('#xCity').value);
    if(!(amt > 0)) return formMsg(form, 'Enter the amount of foreign currency you need.', 'xAmt');
    if(!city || city.intl) return formMsg(form, 'Enter a delivery city in India.', 'xCity');
    formMsg(form, '');
    var rate = f.rate * (dir === 'buy' ? (prod === 'card' ? 1.012 : 1.018) : 0.98), value = rate * amt, gst = forexGst(value), total = dir === 'buy' ? value + gst : value - gst;
    var title = (dir === 'buy' ? 'Buy ' : 'Sell ') + amt.toLocaleString('en-IN') + ' ' + f.code;
    WL.panelPush(title, (prod === 'card' ? 'Forex card' : 'Currency notes') + ' · ' + city.name, function(body){
      body.innerHTML = '<div class="container" style="padding-top:20px;max-width:640px"><div class="co-card"><p class="demo-note">Indicative demo rates, not live. Your rate is locked when the order is confirmed.</p>' +
        '<div class="sum-row"><span>Rate</span><b>1 ' + f.code + ' = ₹' + rate.toFixed(2) + '</b></div><div class="sum-row"><span>' + amt.toLocaleString('en-IN') + ' ' + f.code + '</span><b>' + money(value) + '</b></div>' +
        '<div class="sum-row"><span>GST on currency conversion</span><b>' + (dir === 'buy' ? '' : '−') + money(gst) + '</b></div><div class="sum-total"><span>' + (dir === 'buy' ? 'You pay' : 'You receive') + '</span><span>' + money(total) + '</span></div>' +
        '<p class="small muted">' + (dir === 'buy' ? 'PAN and passport are mandatory under RBI rules. Delivery in 24–48 hours in ' + esc(city.name) + '.' : 'Our executive collects the currency and transfers INR to your bank account the same day.') + '</p>' +
        '<button class="btn btn-accent" id="fxGo">' + (dir === 'buy' ? 'Place order' : 'Book pickup') + '</button></div></div>';
      $('#fxGo').addEventListener('click', function(){
        if(dir === 'buy') WL.checkoutService({ kind:'forex', title:title + (prod === 'card' ? ' on forex card' : ' in notes'), sub:'Delivery to ' + city.name, date:iso(addDays(today(), 2)), unit:Math.round(value), count:1, gst:0, gstFixed:Math.round(gst), paxFields:'forex' });
        else { toast('Pickup booked. Our executive will call you to confirm a time.'); WL.panelClose(); }
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /* INSURANCE                                                          */
  /* ------------------------------------------------------------------ */
  $('#pane-insurance').addEventListener('submit', function(e){
    e.preventDefault(); var form = this;
    var scope = document.querySelector('input[name="iscope"]:checked').value, region = $('#iRegion').value, s = $('#iStart').value, en = $('#iEnd').value;
    var ages = $('#iAges').value.split(/[,\s]+/).filter(Boolean).map(Number);
    if(!s || s < iso(today())) return formMsg(form, 'Trip start must be today or later.', 'iStart');
    if(!en || en < s) return formMsg(form, 'Trip end must be after the start.', 'iEnd');
    if(!ages.length || ages.some(function(a){ return !(a >= 0 && a <= 85); })) return formMsg(form, 'Enter each traveller\'s age (0–85), separated by commas.', 'iAges');
    formMsg(form, '');
    var days = daysBetween(parseISO(s), parseISO(en)) + 1;
    var per = { asia:[40,65,100], schengen:[70,110,160], usa:[120,180,260], world:[130,200,290] }[region];
    var cover = { asia:['$50,000','$1,00,000','$2,50,000'], schengen:['€30,000','€1,00,000','€2,50,000'], usa:['$1,00,000','$2,50,000','$5,00,000'], world:['$1,00,000','$2,50,000','$5,00,000'] }[region];
    var ageF = function(a){ return a < 18 ? 0.7 : a <= 60 ? 1 : a <= 70 ? 2 : 3; };
    var plans = ['Basic','Plus','Max'].map(function(n, i){
      var prem = scope === 'domestic' ? [99,199,349][i] * ages.length * Math.ceil(days / 30) : ages.reduce(function(sum, a){ return sum + per[i] * days * ageF(a); }, 0);
      return { name:n, prem:Math.round(prem), cover: scope === 'domestic' ? ['₹1,00,000','₹3,00,000','₹5,00,000'][i] : cover[i],
        feats: (scope === 'domestic' ? ['Accidental hospitalisation','Trip cancellation','Missed connection'] : ['Emergency medical & evacuation','Trip delay (after 6 hrs)','Loss of passport']).concat(i > 0 ? ['Lost or delayed baggage'] : []).concat(i > 1 ? ['Adventure sports cover','Home burglary while away'] : []) };
    });
    WL.panelPush('Travel insurance plans', (scope === 'domestic' ? 'Domestic' : $('#iRegion').selectedOptions[0].text) + ' · ' + days + ' days · ' + ages.length + ' traveller' + (ages.length > 1 ? 's' : ''), function(body){
      body.innerHTML = '<div class="container" style="padding-top:20px;display:flex;flex-direction:column;gap:14px"><p class="demo-note">Sample plans for this demo. Real plans come from IRDAI-registered insurers; read the policy wording before buying.</p><div class="plan-grid">' + plans.map(function(p, i){
        return '<div class="plan' + (i === 1 ? ' rec' : '') + '">' + (i === 1 ? '<span class="pill warn" style="align-self:flex-start">Most chosen</span>' : '') + '<h3 style="font-size:1.2rem">' + p.name + '</h3><p class="small muted">Medical cover up to <b>' + p.cover + '</b></p><ul>' + p.feats.map(function(f){ return '<li><svg class="ic"><use href="#i-check"/></svg>' + f + '</li>'; }).join('') + '</ul><div class="big-num" style="font-size:1.6rem">' + money(p.prem) + '</div><small class="muted">for all travellers, before 18% GST</small><button class="btn btn-accent btn-sm" data-ins="' + i + '">Buy ' + p.name + '</button></div>';
      }).join('') + '</div></div>';
      body.addEventListener('click', function(e){ var b = e.target.closest('[data-ins]'); if(!b) return; var p = plans[+b.getAttribute('data-ins')];
        WL.checkoutService({ kind:'insurance', title:p.name + ' travel insurance', sub:(scope === 'domestic' ? 'Domestic' : 'International') + ' · ' + fmtDate(s) + ' – ' + fmtDate(en), date:s, unit:p.prem, count:1, gst:0.18, paxFields:'insurance', paxCount:ages.length, intl:scope !== 'domestic' }); });
    });
  });

  /* ------------------------------------------------------------------ */
  /* Prefill from elsewhere on the page                                 */
  /* ------------------------------------------------------------------ */
  function goSearch(){ var t = $('#home'); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY, behavior: WL.reduceMotion ? 'auto' : 'smooth' }); }
  WL.prefillSearch = function(kind, d){
    if(kind === 'flights'){
      var ap = d.intl ? D.cities.filter(function(c){ return c.air === d.code; })[0] : null;
      ap = ap || WL.nearestAirport({ lat:d.lat, lng:d.lng, intl:!!d.intl });
      selectTab('flights'); $('#fTo').value = ap.name + ' (' + ap.air + ')'; $('#fTo').dispatchEvent(new Event('input'));
      if(WL.findAirport($('#fFrom').value) === ap) $('#fFrom').value = 'Delhi (DEL)', $('#fFrom').dispatchEvent(new Event('input'));
      goSearch(); toast('Flights to ' + ap.name + ' (nearest airport for ' + d.name + ')'); return;
    }
    if(kind === 'hotels'){ selectTab('hotels'); $('#hCity').value = d.name; goSearch(); toast('Pick your dates and search stays in ' + d.name); return; }
    if(kind === 'cab-getaway'){ selectTab('cabs'); document.querySelector('input[name="ctype"][value="oneway"]').checked = true; cabMode(); $('#cFrom').value = d.from; $('#cTo').value = d.name; goSearch(); toast('Cab from ' + d.from + ' to ' + d.name + ' — pick a date and search'); return; }
    if(kind === 'route'){ selectTab('flights'); $('#fFrom').value = d.from; $('#fTo').value = d.to; $('#fFrom').dispatchEvent(new Event('input')); $('#fTo').dispatchEvent(new Event('input')); setTrip(false); var f = $('#pane-flights'); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable:true })); }
  };
  $$('[data-open="pnr"]').forEach(function(b){ b.addEventListener('click', function(){ var t = $('#tools'); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - $('#header').offsetHeight, behavior: WL.reduceMotion ? 'auto' : 'smooth' }); setTimeout(function(){ $('#pnrInput').focus(); }, 400); }); });
})();
