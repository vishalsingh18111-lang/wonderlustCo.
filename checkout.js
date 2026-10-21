/* =====================================================================
   Wanderlust Co. — checkout, payments (simulated), account, My Trips,
   wishlist, PNR lookup.
   ===================================================================== */
(function(){
  "use strict";
  var D = window.WL_DATA, WL = window.WL;
  var $ = WL.$, $$ = WL.$$, esc = WL.esc, money = WL.money, fmtMoney = WL.fmtMoney, store = WL.store, toast = WL.toast;
  var iso = WL.iso, parseISO = WL.parseISO, addDays = WL.addDays, today = WL.today, daysBetween = WL.daysBetween, fmtDate = WL.fmtDate, fmtDateShort = WL.fmtDateShort, hm = WL.hm, dur = WL.dur;
  var framed = (function(){ try { return window.self !== window.top; } catch(e){ return true; } })();

  /* ------------------------------------------------------------------ */
  /* Account                                                            */
  /* ------------------------------------------------------------------ */
  function user(){ return store.get('user', null); }
  function setUser(u){ store.set('user', u); updateLoginUI(); }
  WL.user = user;
  function updateLoginUI(){
    var u = user(), l = $('#loginLabel');
    if(u){ l.textContent = u.name.split(' ')[0]; l.removeAttribute('data-i18n'); }
    else { l.setAttribute('data-i18n', 'login'); l.textContent = 'Login / Sign up'; }
  }
  function openLogin(after){
    var otp = null, mobile = '';
    WL.openModal('<p class="modal-eyebrow">Welcome to Wanderlust</p><h3 id="modalTitle">Login or create an account</h3><div class="modal-body" id="loginBody">' +
      '<p class="small muted">Get 100 WL Coins (worth ₹100) when you sign up, plus member-only fares.</p>' +
      '<form id="loginForm" novalidate><div class="form-row"><label for="lgMobile">Mobile number</label><div class="phone-input"><span>+91</span><input id="lgMobile" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10-digit mobile"></div></div>' +
      '<p class="form-msg" id="lgMsg"></p><button class="btn btn-accent btn-block" type="submit">Send OTP</button></form>' +
      '<p class="small muted">By continuing you agree to our terms and privacy policy.</p></div>');
    $('#lgMobile').addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); });
    $('#loginForm').addEventListener('submit', function(e){
      e.preventDefault(); mobile = $('#lgMobile').value;
      if(!WL.mobileRe.test(mobile)){ $('#lgMsg').textContent = 'Enter a valid 10-digit Indian mobile number.'; return; }
      otp = String(1000 + Math.floor(Math.random() * 9000));
      $('#loginBody').innerHTML = '<p>Enter the 4-digit code sent to <b>+91 ' + mobile.replace(/(\d{5})(\d{5})/, '$1 $2') + '</b></p>' +
        '<p class="demo-note">Demo site: no SMS is sent. Your code is <b class="mono">' + otp + '</b>.</p>' +
        '<form id="otpForm" novalidate><div class="otp-row" role="group" aria-label="One-time password">' + [0,1,2,3].map(function(i){ return '<input inputmode="numeric" maxlength="1" aria-label="Digit ' + (i + 1) + '" data-otp="' + i + '">'; }).join('') + '</div>' +
        '<p class="form-msg" id="otpMsg"></p><button class="btn btn-accent btn-block" type="submit" style="margin-top:12px">Verify &amp; continue</button></form><button class="text-link small" id="otpBack">Change number</button>';
      var boxes = $$('[data-otp]'); boxes[0].focus();
      boxes.forEach(function(b, i){
        b.addEventListener('input', function(){ b.value = b.value.replace(/\D/g, '').slice(-1); if(b.value && boxes[i + 1]) boxes[i + 1].focus(); });
        b.addEventListener('keydown', function(e){ if(e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
        b.addEventListener('paste', function(e){ var t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 4); if(t.length){ e.preventDefault(); t.split('').forEach(function(c, k){ if(boxes[k]) boxes[k].value = c; }); boxes[Math.min(3, t.length - 1)].focus(); } });
      });
      $('#otpBack').addEventListener('click', function(){ WL.closeModal(); openLogin(after); });
      $('#otpForm').addEventListener('submit', function(ev){
        ev.preventDefault(); var code = boxes.map(function(b){ return b.value; }).join('');
        if(code !== otp){ $('#otpMsg').textContent = 'That code doesn\'t match. Check it and try again.'; return; }
        var existing = store.get('accounts', {})[mobile];
        if(existing){ setUser(existing); WL.closeModal(); toast('Welcome back, ' + existing.name.split(' ')[0] + '!'); if(after) after(); return; }
        $('#loginBody').innerHTML = '<form id="profForm" novalidate><div class="form-row"><label for="pfName">Full name</label><input id="pfName" autocomplete="name"></div><div class="form-row"><label for="pfEmail">Email (for tickets & invoices)</label><input id="pfEmail" type="email" autocomplete="email"></div><p class="form-msg" id="pfMsg"></p><button class="btn btn-accent btn-block" type="submit">Create account</button></form>';
        $('#pfName').focus();
        $('#profForm').addEventListener('submit', function(e2){
          e2.preventDefault(); var n = $('#pfName').value.trim(), em = $('#pfEmail').value.trim();
          if(n.length < 2){ $('#pfMsg').textContent = 'Enter your name.'; return; }
          if(!WL.emailRe.test(em)){ $('#pfMsg').textContent = 'Enter a valid email address.'; return; }
          var u = { name:n, mobile:mobile, email:em, coins:100, ref:(n.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'WL') + WL.digits(3), joined:Date.now() };
          saveAccount(u); setUser(u); WL.closeModal(); toast('Account created — 100 WL Coins added!'); if(after) after();
        });
      });
    });
  }
  function saveAccount(u){ var a = store.get('accounts', {}); a[u.mobile] = u; store.set('accounts', a); }
  function addCoins(n){ var u = user(); if(!u) return; u.coins = Math.max(0, (u.coins || 0) + n); saveAccount(u); setUser(u); }
  function openAccount(){
    var u = user(); if(!u){ openLogin(openAccount); return; }
    var trips = store.get('trips', []), trav = store.get('travellers', []);
    WL.openDrawer('My account', '<div class="wallet"><div><small style="color:var(--on-deep-muted)">WL Coins balance</small><br><b>' + (u.coins || 0) + '</b> <small style="color:var(--on-deep-muted)">= ' + money(u.coins || 0) + '</small></div><svg class="ic" style="width:40px;height:40px;color:var(--marigold)"><use href="#i-gift"/></svg></div>' +
      '<div class="co-card"><h3>' + esc(u.name) + '</h3><p class="small muted">+91 ' + esc(u.mobile) + '<br>' + esc(u.email) + '</p><p class="small">' + trips.length + ' booking' + (trips.length === 1 ? '' : 's') + ' · member since ' + fmtDate(new Date(u.joined)) + '</p></div>' +
      '<div class="co-card"><h3>Refer &amp; earn</h3><p class="small muted">Friends get ₹250 off their first trip; you get 250 coins when they travel.</p><div class="coupon-foot" style="border-radius:10px"><span class="code">' + u.ref + '</span><button class="copy-code" data-copy="' + u.ref + '">Copy code</button></div></div>' +
      (trav.length ? '<div class="co-card"><h3>Saved travellers</h3><div class="incl">' + trav.map(function(t){ return '<span class="pill">' + esc(t) + '</span>'; }).join('') + '</div></div>' : '') +
      '<button class="btn btn-ink" id="accTrips">My trips</button><button class="btn btn-outline-ink" id="accLogout">Log out</button>' +
      '<details class="co-card"><summary class="small" style="cursor:pointer;font-weight:600">Delete my data</summary><p class="small muted" style="margin-top:8px">Removes your account, bookings, wishlist and reviews from this browser.</p><button class="btn btn-sm" style="background:var(--bad);color:#fff;align-self:flex-start" id="accDelete">Delete everything</button></details>');
    $('#accTrips').addEventListener('click', openTrips);
    $('#accLogout').addEventListener('click', function(){ store.set('user', null); updateLoginUI(); WL.closeDrawer(); toast('Logged out'); });
    $('#accDelete').addEventListener('click', function(){
      ['user','accounts','trips','travellers','wish','reviews','recent','leads','alerts'].forEach(function(k){ store.set(k, k === 'wish' || k === 'trips' || k === 'travellers' || k === 'reviews' || k === 'recent' || k === 'leads' || k === 'alerts' ? [] : null); });
      updateLoginUI(); WL.closeDrawer(); toast('Your data has been deleted from this browser'); setTimeout(function(){ location.reload(); }, 900);
    });
  }
  $('#loginBtn').addEventListener('click', function(){ user() ? openAccount() : openLogin(); });
  $('#bnAccount').addEventListener('click', function(){ user() ? openAccount() : openLogin(); });

  /* ------------------------------------------------------------------ */
  /* Checkout engine                                                    */
  /* ------------------------------------------------------------------ */
  var OFFERS = D.offers;
  function calc(item, st){
    var paxN = item.paxDynamic ? st.paxCount : item.paxCount || 1;
    var base = 0, lines = [];
    if(item.kind === 'package'){
      var a = st.adults, c = st.children, single = a % 2 === 1 ? Math.round(item.unit * 0.35) : 0;
      lines.push(['Adults × ' + a, item.unit * a]); if(c) lines.push(['Children × ' + c + ' (with bed)', Math.round(item.unit * 0.65) * c]); if(single) lines.push(['Single-room supplement', single]);
      base = lines.reduce(function(s, l){ return s + l[1]; }, 0); paxN = a + c;
    } else if(item.paxDynamic){
      lines.push([item.unitLabel + ' × ' + paxN, item.unit * paxN]); base = item.unit * paxN;
    } else { lines = item.lines.slice(); base = lines.reduce(function(s, l){ return s + l[1]; }, 0); }
    var taxes = item.kind === 'package' ? Math.round(base * 0.05) : item.taxesFn ? item.taxesFn(base, paxN) : (item.taxes || 0);
    var fee = item.feePer ? item.feePer * paxN : (item.fee || 0);
    if(st.coupon && st.coupon.type === 'fee') fee = 0;
    var add = 0, addLines = [];
    (item.addons || []).forEach(function(a){ if(st.addons[a.id]){ var p = a.per === 'pax' ? a.price * paxN : a.price; add += p; addLines.push([a.label, p]); } });
    var gross = base + taxes + fee + add, disc = 0;
    if(st.coupon && st.coupon.type !== 'fee'){ var o = st.coupon; disc = o.type === 'flat' ? o.value : Math.min(o.cap || 1e9, Math.round(base * o.value / 100)); disc = Math.min(disc, base); }
    var afterDisc = gross - disc;
    var u = user(), coinsAvail = u ? u.coins || 0 : 0, coins = st.useCoins ? Math.min(coinsAvail, Math.floor(afterDisc * 0.1)) : 0;
    var tcs = item.intl && item.kind === 'package' ? Math.round((afterDisc - coins) * 0.05) : 0;
    return { lines:lines, base:base, taxes:taxes, fee:fee, addLines:addLines, add:add, disc:disc, coins:coins, coinsAvail:coinsAvail, tcs:tcs, total:afterDisc - coins + tcs, paxN:paxN };
  }
  function summaryHtml(item, st){
    var t = calc(item, st);
    var rows = t.lines.map(function(l){ return '<div class="sum-row"><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></div>'; }).join('');
    if(t.taxes) rows += '<div class="sum-row"><span>' + esc(item.taxLabel || 'Taxes & fees') + '</span><span>' + money(t.taxes) + '</span></div>';
    if(item.feePer || item.fee) rows += '<div class="sum-row"><span>' + esc(item.feeLabel || 'Convenience fee') + '</span><span>' + (t.fee ? money(t.fee) : '<s>' + money(item.feePer ? item.feePer * t.paxN : item.fee) + '</s> Free') + '</span></div>';
    rows += t.addLines.map(function(l){ return '<div class="sum-row"><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></div>'; }).join('');
    if(t.disc) rows += '<div class="sum-row disc"><span>Coupon ' + st.coupon.code + '</span><span>−' + money(t.disc) + '</span></div>';
    if(t.coins) rows += '<div class="sum-row disc"><span>WL Coins used</span><span>−' + money(t.coins) + '</span></div>';
    if(t.tcs) rows += '<div class="sum-row"><span>TCS 5% (adjustable against income tax)</span><span>' + money(t.tcs) + '</span></div>';
    return '<div class="summary"><h3>Fare summary</h3><div class="sum-item"><strong>' + esc(item.title) + '</strong>' + esc(item.sub) + '</div>' + rows +
      '<div class="sum-total"><span>Total</span><span>' + money(t.total) + '</span></div>' + (item.payLater ? '<p class="small muted">Pay at hotel available on the payment step.</p>' : '') + '</div>';
  }
  function couponBox(item, st){
    var sug = OFFERS.filter(function(o){ return o.cat === item.cat || o.cat === 'all'; });
    var u = user(), coinsHtml = u && u.coins ? '<label class="addon" style="padding:10px"><input type="checkbox" id="useCoins"' + (st.useCoins ? ' checked' : '') + '><div><strong>Use WL Coins</strong><small>' + u.coins + ' available · up to 10% of the fare</small></div></label>' :
      (!u ? '<p class="small muted"><button class="text-link" id="coLogin">Log in</button> to use WL Coins and earn 2% back.</p>' : '');
    return '<div class="summary"><h3>Offers &amp; coupons</h3><form class="coupon-box" id="couponForm"><label for="couponIn" class="sr-only">Coupon code</label><input id="couponIn" placeholder="Enter coupon" value="' + (st.coupon ? st.coupon.code : '') + '" autocomplete="off"><button class="btn btn-ink btn-sm" type="submit">' + (st.coupon ? 'Remove' : 'Apply') + '</button></form><p class="coupon-msg" id="couponMsg" aria-live="polite"></p>' +
      (sug.length ? '<div class="coupon-suggest">' + sug.map(function(o){ return '<button type="button" data-apply="' + o.code + '"><span class="code">' + o.code + '</span><span>' + esc(o.title) + '</span></button>'; }).join('') + '</div>' : '') + coinsHtml + '</div>';
  }
  function applyCoupon(item, st, code){
    code = (code || '').trim().toUpperCase();
    var o = OFFERS.filter(function(x){ return x.code === code; })[0];
    if(!o) return 'That code isn\'t valid. Check the spelling or pick one below.';
    if(o.cat !== 'all' && o.cat !== item.cat) return o.code + ' works on ' + o.cat + ' only.';
    if(o.code === 'FIRSTTRIP' && store.get('trips', []).some(function(t){ return t.status !== 'Cancelled'; })) return 'FIRSTTRIP is for your first booking only.';
    var base = calc(item, Object.assign({}, st, { coupon:null })).base;
    if(base < o.min) return o.code + ' needs a minimum booking of ' + fmtMoney(o.min) + '.';
    st.coupon = o; return null;
  }

  // traveller form blocks
  var NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,49}$/, PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/, PASS_RE = /^[A-Z][0-9]{7}$/, GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  function fld(id, label, v, attrs, type, opts){
    var val = v[id] != null ? v[id] : (opts && opts.def) || '';
    var input = type === 'select' ? '<select id="' + id + '" ' + (attrs || '') + '>' + opts.list.map(function(o){ return '<option' + (String(o) === String(val) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
      : '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val) + '" ' + (attrs || '') + '>';
    return '<div class="form-row"><label for="' + id + '">' + label + '</label>' + input + '<span class="form-error" id="' + id + 'Err"></span></div>';
  }
  function paxBlocks(item, st){
    var v = st.vals, html = '', n = item.kind === 'package' ? 1 : item.paxDynamic ? st.paxCount : (item.paxSpec || [{ label:'Lead guest', type:'adult' }]).length;
    var spec = item.paxSpec || [];
    var saved = store.get('travellers', []);
    if(saved.length && item.paxFields !== 'forex') html += '<div class="fare-chips"><span class="chip-label">Saved travellers</span>' + saved.slice(0, 6).map(function(s){ return '<button type="button" class="link-chip" data-fill="' + esc(s) + '">+ ' + esc(s) + '</button>'; }).join('') + '</div>';
    for(var i = 0; i < n; i++){
      var lab = item.kind === 'package' ? 'Lead traveller' : item.paxFields === 'bus' ? 'Seat ' + item.seats[i] : spec[i] ? spec[i].label : 'Passenger ' + (i + 1), type = spec[i] ? spec[i].type : 'adult';
      html += '<div class="pax-block"><strong>' + esc(lab) + '</strong>';
      if(item.paxFields === 'flight'){
        var titles = type === 'adult' ? ['Mr','Ms','Mrs'] : ['Master','Miss'];
        html += '<div class="grid3">' + fld('p' + i + 'title', 'Title', v, '', 'select', { list:titles }) + fld('p' + i + 'first', 'First &amp; middle name', v, 'data-v="name" autocomplete="off"') + fld('p' + i + 'last', 'Last name', v, 'data-v="name" autocomplete="off"') + '</div>';
        if(type !== 'adult') html += '<div class="grid3">' + fld('p' + i + 'dob', 'Date of birth', v, 'data-v="date" max="' + iso(today()) + '"', 'date') + '</div>';
        if(item.intl) html += '<div class="grid3">' + fld('p' + i + 'pp', 'Passport number', v, 'data-v="passport" autocomplete="off" style="text-transform:uppercase"') + fld('p' + i + 'ppx', 'Passport expiry', v, 'data-v="date" min="' + iso(today()) + '"', 'date') + fld('p' + i + 'nat', 'Nationality', v, '', 'select', { list:['Indian','Other'] }) + '</div>';
      } else if(item.paxFields === 'train' || item.paxFields === 'bus'){
        html += '<div class="grid4">' + fld('p' + i + 'name', 'Full name (as on ID)', v, 'data-v="name" autocomplete="off"') + fld('p' + i + 'age', 'Age', v, 'data-v="age" inputmode="numeric" maxlength="3"') + fld('p' + i + 'gender', 'Gender', v, '', 'select', { list:['Male','Female','Transgender'] }) +
          (item.paxFields === 'train' ? fld('p' + i + 'berth', 'Berth preference', v, '', 'select', { list: /CC|EC/.test(item.cls) ? ['No preference','Window','Aisle'] : ['No preference','Lower','Middle','Upper','Side lower','Side upper'] }) : '<div></div>') + '</div>';
        if(item.paxFields === 'train' && item.premium) html += '<div class="grid3">' + fld('p' + i + 'food', 'Meal', v, '', 'select', { list:['Veg','Non-veg','Jain','No food'] }) + '</div>';
      } else if(item.paxFields === 'visa' || item.paxFields === 'insurance'){
        html += '<div class="grid3">' + fld('p' + i + 'name', 'Full name (as on passport)', v, 'data-v="name" autocomplete="off"') + (item.paxFields === 'insurance' ? fld('p' + i + 'dob', 'Date of birth', v, 'data-v="date" max="' + iso(today()) + '"', 'date') : '') + (item.paxFields === 'visa' || item.intl ? fld('p' + i + 'pp', 'Passport number', v, 'data-v="passport" autocomplete="off" style="text-transform:uppercase"') : '') + '</div>';
      } else if(item.paxFields === 'forex'){
        html += '<div class="grid3">' + fld('p0name', 'Full name (as on PAN)', v, 'data-v="name"') + fld('p0pan', 'PAN', v, 'data-v="pan" style="text-transform:uppercase" maxlength="10"') + fld('p0pp', 'Passport number', v, 'data-v="passport" style="text-transform:uppercase" maxlength="8"') + '</div>' +
          '<div class="grid3">' + fld('p0travel', 'Travel date', v, 'data-v="date" min="' + iso(today()) + '"', 'date') + fld('p0addr', 'Delivery address', v, 'data-v="text"') + '</div>';
      } else {
        html += '<div class="grid3">' + fld('p' + i + 'name', 'Full name', v, 'data-v="name" autocomplete="name"') + '</div>';
      }
      html += '</div>';
    }
    if(item.paxDynamic){
      html += '<div class="fare-chips">' + (st.paxCount < item.paxMax ? '<button type="button" class="link-chip" id="addPax">+ Add passenger</button>' : '<span class="small muted">Maximum ' + item.paxMax + ' passengers per ' + (item.quota === 'Tatkal' ? 'Tatkal ' : '') + 'booking</span>') + (st.paxCount > 1 ? '<button type="button" class="link-chip" id="remPax">− Remove last</button>' : '') + '</div>';
      if(item.paxFields === 'train') html += '<p class="small muted">Children under 5 travel free without a berth and don\'t need to be added.</p>';
    }
    return html;
  }
  function extraFields(item, st){
    var v = st.vals, h = '';
    if(item.kind === 'package'){
      h += '<div class="co-card"><h3>Trip details</h3><div class="grid3">' + fld('pkStart', 'Start date', v, 'data-v="date" min="' + iso(addDays(today(), 3)) + '"', 'date', { def:iso(addDays(today(), 21)) }) +
        (item.flights ? fld('pkCity', 'Flying from', v, '', 'select', { list:['Delhi','Mumbai','Bengaluru','Chennai','Kolkata','Hyderabad'] }) : fld('pkCity', 'Pick-up point', v, '', 'select', { list:['Airport','Railway station','Hotel in the start city'] })) + '</div>' +
        '<div class="pop-row" style="max-width:340px"><div><strong>Adults</strong><small>Twin sharing</small></div><div class="stepper"><button type="button" class="step-btn" data-pk="a" data-d="-1" aria-label="Fewer adults"' + (st.adults <= 1 ? ' disabled' : '') + '>−</button><output>' + st.adults + '</output><button type="button" class="step-btn" data-pk="a" data-d="1" aria-label="More adults"' + (st.adults >= 12 ? ' disabled' : '') + '>+</button></div></div>' +
        '<div class="pop-row" style="max-width:340px"><div><strong>Children</strong><small>5–11 yrs, with bed</small></div><div class="stepper"><button type="button" class="step-btn" data-pk="c" data-d="-1" aria-label="Fewer children"' + (st.children <= 0 ? ' disabled' : '') + '>−</button><output>' + st.children + '</output><button type="button" class="step-btn" data-pk="c" data-d="1" aria-label="More children"' + (st.children >= 6 ? ' disabled' : '') + '>+</button></div></div>' +
        (item.intl ? fld('pkPan', 'PAN of lead traveller (required for TCS)', v, 'data-v="pan" style="text-transform:uppercase" maxlength="10"') : '') + '</div>';
    }
    if(item.kind === 'train') h += '<div class="co-card"><h3>IRCTC account</h3><p class="small muted">Train tickets are issued on your IRCTC account. Your password is entered on the IRCTC page, never here.</p><div class="grid3">' + fld('irctc', 'IRCTC user ID', v, 'data-v="irctc" autocomplete="username"') + '</div></div>';
    if(item.kind === 'cab') h += '<div class="co-card"><h3>Pick-up</h3>' + fld('cabAddr', 'Pick-up address', v, 'data-v="text" placeholder="House no., street, landmark"') + fld('cabDrop', 'Drop address (optional)', v, 'placeholder="Hotel or area at destination"') + '</div>';
    if(item.kind === 'hotel') h += '<div class="co-card"><h3>Special requests</h3><div class="form-row"><label for="hReq">Requests (not guaranteed)</label><textarea id="hReq" placeholder="Early check-in, high floor, twin beds…">' + esc(v.hReq || '') + '</textarea></div><p class="small muted">Check-in from 12:00 PM, check-out by 11:00 AM. Carry a government photo ID for every adult guest.</p></div>';
    return h;
  }
  function contactCard(st){
    var v = st.vals, u = user();
    if(u){ if(v.cMobile == null) v.cMobile = u.mobile; if(v.cEmail == null) v.cEmail = u.email; }
    return '<div class="co-card"><h3>Contact details</h3><p class="small muted">Your ticket and updates go here.</p><div class="grid3">' +
      '<div class="form-row"><label for="cMobile">Mobile</label><div class="phone-input"><span>+91</span><input id="cMobile" inputmode="numeric" maxlength="10" data-v="mobile" value="' + esc(v.cMobile || '') + '" autocomplete="tel-national"></div><span class="form-error" id="cMobileErr"></span></div>' +
      fld('cEmail', 'Email', v, 'data-v="email" autocomplete="email"', 'email') + '</div>' +
      '<details' + (v.gstin ? ' open' : '') + '><summary class="small" style="cursor:pointer;font-weight:600;color:var(--heading)">Add GST details (optional, for business travel)</summary><div class="grid3" style="margin-top:10px">' + fld('gstin', 'GSTIN', v, 'data-v="gstin-opt" style="text-transform:uppercase" maxlength="15"') + fld('gstCo', 'Company name', v, '') + '</div></details></div>';
  }
  function addonsCard(item, st){
    if(!item.addons || !item.addons.length) return '';
    return '<div class="co-card"><h3>Add-ons</h3>' + item.addons.map(function(a){
      return '<label class="addon"><input type="checkbox" data-addon="' + a.id + '"' + (st.addons[a.id] ? ' checked' : '') + '><div><strong>' + esc(a.label) + '</strong><small>' + esc(a.desc) + '</small></div><span class="ap">' + money(a.price) + (a.per === 'pax' ? '<small style="display:block;font-weight:400;color:var(--muted)">per person</small>' : '') + '</span></label>';
    }).join('') + '</div>';
  }
  function collect(root, st){ $$('input,select,textarea', root).forEach(function(el){ if(el.id && el.type !== 'checkbox' && el.type !== 'radio') st.vals[el.id] = el.value; }); }
  function validate(root){
    var first = null;
    $$('[data-v]', root).forEach(function(el){
      var t = el.getAttribute('data-v'), v = el.value.trim(), msg = '';
      if(el.style.textTransform === 'uppercase') { v = v.toUpperCase(); el.value = v; }
      if(t === 'name' && !NAME_RE.test(v)) msg = 'Enter the name as on the ID (letters only).';
      if(t === 'age' && !(+v >= 1 && +v <= 120 && /^\d+$/.test(v))) msg = 'Enter age 1–120.';
      if(t === 'mobile' && !WL.mobileRe.test(v)) msg = 'Enter a 10-digit mobile starting 6–9.';
      if(t === 'email' && !WL.emailRe.test(v)) msg = 'Enter a valid email.';
      if(t === 'pan' && !PAN_RE.test(v)) msg = 'PAN looks like ABCDE1234F.';
      if(t === 'passport' && !PASS_RE.test(v)) msg = 'Indian passport numbers look like A1234567.';
      if(t === 'gstin-opt' && v && !GST_RE.test(v)) msg = 'GSTIN has 15 characters, e.g. 07ABCDE1234F1Z5.';
      if(t === 'irctc' && !/^[A-Za-z0-9_.]{3,35}$/.test(v)) msg = 'Enter your IRCTC user ID.';
      if(t === 'date' && !v) msg = 'Choose a date.';
      if(t === 'date' && v && el.min && v < el.min) msg = 'Pick a later date.';
      if(t === 'text' && v.length < 5) msg = 'Please add a little more detail.';
      var err = $('#' + el.id + 'Err'); if(err){ err.textContent = msg; err.classList.toggle('show', !!msg); }
      el.classList.toggle('invalid-input', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if(msg && !first) first = el;
    });
    if(first){ first.focus(); first.scrollIntoView({ block:'center' }); }
    return !first;
  }

  function startCheckout(item){
    var st = { vals:{}, addons:{}, coupon:null, useCoins:false, paxCount:1, adults:2, children:0, method:item.payLater ? 'upi' : 'upi' };
    (item.addons || []).forEach(function(a){ if(a.def) st.addons[a.id] = true; });
    WL.panelPush('Review & traveller details', item.title, function(body){ renderDetails(body, item, st); });
  }
  function steps(n){ return '<div class="container"><div class="co-steps">' + ['Traveller details','Payment','Confirmed'].map(function(s, i){ return '<span class="co-step' + (i + 1 === n ? ' on' : i + 1 < n ? ' done' : '') + '"><b>' + (i + 1 < n ? '✓' : i + 1) + '</b>' + s + '</span>'; }).join('') + '</div></div>'; }
  function renderDetails(body, item, st){
    body.innerHTML = steps(1) + '<div class="container co-wrap"><form class="co-main" id="coForm" novalidate>' +
      '<div class="co-card"><h3>' + esc(item.title) + '</h3><p class="small muted">' + esc(item.sub) + '</p>' + (item.detailHtml || '') + '</div>' +
      extraFields(item, st) +
      (item.kind === 'package' ? '' : '<div class="co-card"><h3>' + (item.paxFields === 'lead' ? 'Guest details' : 'Traveller details') + '</h3>' + (item.paxFields === 'flight' ? '<p class="small muted">Enter names exactly as on government ID. Airlines can deny boarding for mismatches.</p>' : '') + paxBlocks(item, st) + '</div>') +
      (item.kind === 'package' ? '<div class="co-card"><h3>Lead traveller</h3>' + paxBlocks(item, st) + '</div>' : '') +
      addonsCard(item, st) + contactCard(st) +
      '<button class="btn btn-accent" type="submit" style="align-self:flex-start">Continue to payment</button></form>' +
      '<aside class="co-side">' + summaryHtml(item, st) + couponBox(item, st) + '</aside></div>';
    var form = $('#coForm', body);
    function refreshSide(){ var side = $('.co-side', body); side.innerHTML = summaryHtml(item, st) + couponBox(item, st); bindSide(); }
    function bindSide(){
      $('#couponForm', body).addEventListener('submit', function(e){
        e.preventDefault();
        if(st.coupon){ st.coupon = null; refreshSide(); return; }
        var err = applyCoupon(item, st, $('#couponIn', body).value); refreshSide();
        var m = $('#couponMsg', body); m.textContent = err || st.coupon.code + ' applied. You save ' + fmtMoney(calc(item, st).disc || (st.coupon.type === 'fee' ? (item.feePer ? item.feePer * calc(item, st).paxN : item.fee) : 0)) + '.'; m.className = 'coupon-msg ' + (err ? 'bad' : 'ok');
      });
      $$('[data-apply]', body).forEach(function(b){ b.addEventListener('click', function(){ st.coupon = null; var err = applyCoupon(item, st, b.getAttribute('data-apply')); refreshSide(); var m = $('#couponMsg', body); m.textContent = err || st.coupon.code + ' applied.'; m.className = 'coupon-msg ' + (err ? 'bad' : 'ok'); }); });
      var uc = $('#useCoins', body); if(uc) uc.addEventListener('change', function(){ st.useCoins = uc.checked; refreshSide(); });
      var lg = $('#coLogin', body); if(lg) lg.addEventListener('click', function(){ openLogin(function(){ collect(form, st); renderDetails(body, item, st); }); });
    }
    bindSide();
    form.addEventListener('change', function(e){ var a = e.target.getAttribute('data-addon'); if(a){ st.addons[a] = e.target.checked; if(st.coupon){ var err = applyCoupon(item, st, st.coupon.code); if(err) st.coupon = null; } refreshSide(); } });
    form.addEventListener('click', function(e){
      var pk = e.target.closest('[data-pk]');
      if(pk && !pk.disabled){ collect(form, st); var d = +pk.getAttribute('data-d'); if(pk.getAttribute('data-pk') === 'a') st.adults = Math.max(1, Math.min(12, st.adults + d)); else st.children = Math.max(0, Math.min(6, st.children + d)); if(st.coupon && applyCoupon(item, st, st.coupon.code)) st.coupon = null; var y = $('.panel-body').scrollTop; renderDetails(body, item, st); $('.panel-body').scrollTop = y; return; }
      if(e.target.id === 'addPax' || e.target.id === 'remPax'){ collect(form, st); st.paxCount += e.target.id === 'addPax' ? 1 : -1; var y2 = $('.panel-body').scrollTop; renderDetails(body, item, st); $('.panel-body').scrollTop = y2; return; }
      var f = e.target.closest('[data-fill]');
      if(f){ var name = f.getAttribute('data-fill'); var target = $$('input[data-v="name"]', form).filter(function(i){ return !i.value; })[0];
        if(!target){ toast('All name fields are filled'); return; }
        if(/first$/.test(target.id)){ var parts = name.split(' '); target.value = parts.slice(0, -1).join(' ') || parts[0]; var last = $('#' + target.id.replace('first', 'last'), form); if(last && parts.length > 1) last.value = parts[parts.length - 1]; } else target.value = name; }
    });
    $('#cMobile', body).addEventListener('input', function(){ this.value = this.value.replace(/\D/g, '').slice(0, 10); });
    form.addEventListener('submit', function(e){
      e.preventDefault(); collect(form, st);
      if(!validate(form)) { toast('Please fix the highlighted fields'); return; }
      WL.panelPush('Payment', item.title, function(b){ renderPayment(b, item, st); });
    });
  }

  /* ---------- Payment ---------- */
  function luhn(n){ var s = 0, alt = false; for(var i = n.length - 1; i >= 0; i--){ var d = +n[i]; if(alt){ d *= 2; if(d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  function network(n){ if(/^4/.test(n)) return 'Visa'; if(/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard'; if(/^(60|65|81|82|508)/.test(n)) return 'RuPay'; if(/^3[47]/.test(n)) return 'Amex'; return ''; }
  function fakeQR(seed){
    var r = WL.rng(seed), cells = '', n = 25;
    for(var y = 0; y < n; y++) for(var x = 0; x < n; x++){
      var finder = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
      var on = finder ? ((x % 18 === 0 || x % 18 === 6 || y % 18 === 0 || y % 18 === 6) || (x % 18 >= 2 && x % 18 <= 4 && y % 18 >= 2 && y % 18 <= 4)) : r() < 0.48;
      if(on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg class="qr" viewBox="0 0 25 25" shape-rendering="crispEdges" role="img" aria-label="Demo QR code"><rect width="25" height="25" fill="#fff"/><g fill="#111">' + cells + '</g></svg>';
  }
  function cardFields(){
    return '<div class="form-row"><label for="cardNo">Card number <span id="cardNet" class="pill" style="margin-left:6px" hidden></span></label><input id="cardNo" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000" maxlength="23"><span class="form-error" id="cardNoErr"></span></div>' +
      '<div class="grid3"><div class="form-row"><label for="cardName">Name on card</label><input id="cardName" autocomplete="off"><span class="form-error" id="cardNameErr"></span></div><div class="form-row"><label for="cardExp">Expiry (MM/YY)</label><input id="cardExp" inputmode="numeric" placeholder="MM/YY" maxlength="5" autocomplete="off"><span class="form-error" id="cardExpErr"></span></div><div class="form-row"><label for="cardCvv">CVV</label><input id="cardCvv" type="password" inputmode="numeric" maxlength="4" autocomplete="off"><span class="form-error" id="cardCvvErr"></span></div></div>' +
      '<button type="button" class="text-link small" id="testCard" style="align-self:flex-start">Use demo test card</button>';
  }
  function renderPayment(body, item, st){
    var t = calc(item, st), methods = [['upi','UPI','Any UPI app'],['card','Credit / debit card','Visa, Mastercard, RuPay'],['nb','Net banking','All major banks']];
    if(t.total >= 10000) methods.push(['emi','EMI','No-cost on 3 & 6 months']);
    if(item.payLater) methods.push(['hotel','Pay at hotel','₹0 now, pay at check-in']);
    if(!methods.some(function(m){ return m[0] === st.method; })) st.method = 'upi';
    body.innerHTML = steps(2) + '<div class="container co-wrap"><div class="co-main"><div class="demo-warn">Demo checkout: no money moves and nothing is charged. Don\'t enter real card details.</div>' +
      '<div class="pay-tabs"><div class="pay-list" role="tablist" aria-label="Payment method">' + methods.map(function(m){ return '<button class="pay-opt' + (m[0] === st.method ? ' active' : '') + '" role="tab" aria-selected="' + (m[0] === st.method) + '" data-pm="' + m[0] + '">' + m[1] + '<small>' + m[2] + '</small></button>'; }).join('') + '</div><form class="pay-pane" id="payForm" novalidate></form></div></div>' +
      '<aside class="co-side">' + summaryHtml(item, st) + '</aside></div>';
    function pane(){
      var f = $('#payForm', body), h = '';
      if(st.method === 'upi') h = '<h3 style="font-size:1.05rem">Pay with UPI</h3><div class="form-row"><label for="upiId">UPI ID</label><input id="upiId" placeholder="yourname@bank" autocomplete="off"><span class="form-error" id="upiIdErr"></span></div><p class="small muted">You\'ll get a collect request in your UPI app. Or scan this code with any UPI app:</p>' + fakeQR(item.title + t.total);
      if(st.method === 'card') h = '<h3 style="font-size:1.05rem">Credit or debit card</h3>' + cardFields() + '<label class="check-line"><input type="checkbox" checked> Save card securely as per RBI tokenisation rules</label>';
      if(st.method === 'nb') h = '<h3 style="font-size:1.05rem">Net banking</h3><div class="form-row"><label for="nbBank">Choose your bank</label><select id="nbBank"><option value="">Select a bank</option>' + D.banks.map(function(b){ return '<option>' + esc(b) + '</option>'; }).join('') + '</select><span class="form-error" id="nbBankErr"></span></div><p class="small muted">You\'ll be redirected to your bank\'s secure page.</p>';
      if(st.method === 'emi'){ var rows = [[3,0],[6,0],[9,0.13],[12,0.14]].map(function(x){ var r = x[1] / 12, m = r ? t.total * r * Math.pow(1 + r, x[0]) / (Math.pow(1 + r, x[0]) - 1) : t.total / x[0]; return '<label class="addon" style="padding:10px"><input type="radio" name="emiT" value="' + x[0] + '"' + (x[0] === 6 ? ' checked' : '') + '><div><strong>' + x[0] + ' months</strong><small>' + (x[1] ? (x[1] * 100) + '% p.a.' : 'No-cost EMI') + '</small></div><span class="ap">' + money(Math.ceil(m)) + '/mo</span></label>'; }).join(''); h = '<h3 style="font-size:1.05rem">Pay in EMIs</h3>' + rows + cardFields(); }
      if(st.method === 'hotel') h = '<h3 style="font-size:1.05rem">Pay at hotel</h3><p>Your room is held with no payment now. Pay ' + money(t.total) + ' at check-in by cash, card or UPI.</p><p class="small muted">The hotel may cancel unconfirmed bookings if you don\'t check in by 6 PM.</p>';
      h += '<p class="form-msg" id="payMsg"></p><button class="btn btn-accent" type="submit" id="payBtn">' + (st.method === 'hotel' ? 'Confirm booking' : 'Pay ' + fmtMoney(t.total) + ' securely') + '</button><p class="small muted">🔒 256-bit encrypted. PCI-DSS compliant gateway on live sites.</p>';
      f.innerHTML = h;
      var no = $('#cardNo', f);
      if(no){
        no.addEventListener('input', function(){ var d = no.value.replace(/\D/g, '').slice(0, 19); no.value = d.replace(/(.{4})/g, '$1 ').trim(); var nw = network(d), b = $('#cardNet', f); b.hidden = !nw; b.textContent = nw; });
        $('#cardExp', f).addEventListener('input', function(){ var d = this.value.replace(/\D/g, '').slice(0, 4); this.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; });
        $('#testCard', f).addEventListener('click', function(){ no.value = '4111 1111 1111 1111'; no.dispatchEvent(new Event('input')); $('#cardName', f).value = 'Demo User'; $('#cardExp', f).value = '12/' + String((new Date().getFullYear() + 3) % 100); $('#cardCvv', f).value = '123'; });
      }
    }
    pane();
    body.addEventListener('click', function(e){
      var b = e.target.closest('[data-pm]'); if(!b) return;
      st.method = b.getAttribute('data-pm'); $$('[data-pm]', body).forEach(function(x){ x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); pane();
    });
    body.addEventListener('submit', function(e){
      if(e.target.id !== 'payForm') return; e.preventDefault();
      var f = e.target, bad = null;
      function err(id, m){ var el = $('#' + id + 'Err', f); if(el){ el.textContent = m; el.classList.toggle('show', !!m); } $('#' + id, f).classList.toggle('invalid-input', !!m); if(m && !bad) bad = $('#' + id, f); }
      if(st.coupon && st.coupon.upiOnly && st.method !== 'upi'){ $('#payMsg', f).textContent = st.coupon.code + ' works only with UPI. Switch to UPI or remove the coupon.'; return; }
      if(st.method === 'upi') err('upiId', /^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$/.test($('#upiId', f).value.trim()) ? '' : 'Enter a UPI ID like name@okbank.');
      if(st.method === 'card' || st.method === 'emi'){
        var n = $('#cardNo', f).value.replace(/\s/g, ''), ex = $('#cardExp', f).value, m = /^(\d{2})\/(\d{2})$/.exec(ex);
        err('cardNo', n.length >= 13 && luhn(n) ? '' : 'That card number isn\'t valid.');
        err('cardName', $('#cardName', f).value.trim().length >= 2 ? '' : 'Enter the name on the card.');
        var okExp = m && +m[1] >= 1 && +m[1] <= 12 && new Date(2000 + +m[2], +m[1], 0) >= today();
        err('cardExp', okExp ? '' : 'Enter a future expiry as MM/YY.');
        err('cardCvv', /^\d{3,4}$/.test($('#cardCvv', f).value) ? '' : 'Enter the 3 or 4-digit CVV.');
      }
      if(st.method === 'nb') err('nbBank', $('#nbBank', f).value ? '' : 'Choose your bank.');
      if(bad){ bad.focus(); return; }
      var btn = $('#payBtn', f); btn.disabled = true; btn.textContent = st.method === 'hotel' ? 'Confirming…' : 'Processing payment…';
      setTimeout(function(){ confirmBooking(item, st, t); }, 1300);
    });
  }

  /* ---------- Confirm ---------- */
  function confirmBooking(item, st, t){
    t = calc(item, st);
    var id = WL.uid('WL-', 6), pnr = item.kind === 'train' ? WL.digits(10) : item.kind === 'flight' ? WL.uid('', 6) : WL.digits(8);
    var names = [];
    Object.keys(st.vals).forEach(function(k){ var m = /^p(\d+)(first|name)$/.exec(k); if(m){ var last = st.vals['p' + m[1] + 'last']; names[+m[1]] = (st.vals['p' + m[1] + 'title'] ? st.vals['p' + m[1] + 'title'] + ' ' : '') + st.vals[k].trim() + (last ? ' ' + last.trim() : ''); } });
    names = names.filter(Boolean);
    var status = 'Confirmed', seats = null;
    if(item.kind === 'train'){
      var c = item.avail;
      if(c.st === 'AVL'){ var coach = (item.cls === 'SL' ? 'S' : item.cls === '3A' ? 'B' : item.cls === '3E' ? 'M' : item.cls === '2A' ? 'A' : item.cls === '1A' ? 'H' : item.cls === 'EC' ? 'E' : 'C') + (1 + Math.floor(Math.random() * 6)); var b0 = 1 + Math.floor(Math.random() * 50); seats = names.map(function(_, i){ return coach + '/' + (b0 + i); }); }
      else { status = c.st === 'RAC' ? 'RAC ' + c.n : 'WL ' + c.n; }
    }
    if(item.seats) seats = item.seats;
    var meta = (item.meta || []).slice();
    if(st.vals.pkStart) meta.push(['Start date', fmtDate(st.vals.pkStart)]);
    if(st.vals.pkCity) meta.push([item.flights ? 'Flying from' : 'Pick-up', st.vals.pkCity]);
    if(item.kind === 'package') meta.push(['Travellers', st.adults + ' adult' + (st.adults > 1 ? 's' : '') + (st.children ? ', ' + st.children + ' child' + (st.children > 1 ? 'ren' : '') : '')]);
    if(st.vals.cabAddr) meta.push(['Pick-up address', st.vals.cabAddr]);
    if(st.vals.gstin) meta.push(['GSTIN', st.vals.gstin + (st.vals.gstCo ? ' · ' + st.vals.gstCo : '')]);
    var addNames = (item.addons || []).filter(function(a){ return st.addons[a.id]; }).map(function(a){ return a.label; });
    if(addNames.length) meta.push(['Add-ons', addNames.join(', ')]);
    var u = user(), earned = u ? Math.floor(t.total * 0.02) : 0;
    if(u){ addCoins(earned - t.coins); }
    var date = st.vals.pkStart || item.date;
    var bk = { id:id, pnr:pnr, kind:item.kind, title:item.title, sub:item.sub, date:date, time:item.time || null, created:Date.now(), total:t.total, paid: st.method === 'hotel' ? 0 : t.total,
      method:{ upi:'UPI', card:'Card', nb:'Net banking', emi:'EMI', hotel:'Pay at hotel' }[st.method], names:names.length ? names : [st.vals.p0name || (u ? u.name : 'Guest')], seats:seats, status:status, meta:meta,
      fare:{ lines:t.lines, taxes:t.taxes, taxLabel:item.taxLabel, fee:t.fee, add:t.addLines, disc:t.disc, coupon:st.coupon ? st.coupon.code : null, coins:t.coins, tcs:t.tcs },
      cancel:Object.assign({}, item.cancel || {}, { pax:t.paxN, zero:!!st.addons.zero, convFee:t.fee }), coinsEarned:earned, coinsUsed:t.coins, contact:{ mobile:st.vals.cMobile, email:st.vals.cEmail } };
    var trips = store.get('trips', []); trips.unshift(bk); store.set('trips', trips);
    var trav = store.get('travellers', []); bk.names.forEach(function(n){ var clean = n.replace(/^(Mr|Ms|Mrs|Master|Miss) /, ''); if(trav.indexOf(clean) < 0) trav.unshift(clean); }); store.set('travellers', trav.slice(0, 12));
    WL.panelReset('Booking confirmed', bk.id, function(body){
      body.innerHTML = steps(3) + '<div class="container">' + ticketHtml(bk) +
        '<div class="et-actions"><button class="btn btn-accent" id="cfTrips">View My Trips</button>' + (!framed ? '<button class="btn btn-outline-ink" id="cfPrint">Print / save PDF</button>' : '') + '<button class="btn btn-outline-ink" data-panel-close>Back to home</button></div>' +
        (earned ? '<p class="center-row small" style="margin-top:-14px">🎉 ' + earned + ' WL Coins added to your wallet.</p>' : !u ? '<p class="center-row small" style="margin-top:-14px">Log in next time to earn 2% back in WL Coins.</p>' : '') + '</div>';
      $('#cfTrips', body).addEventListener('click', function(){ WL.panelClose(); openTrips(); });
      var pr = $('#cfPrint', body); if(pr) pr.addEventListener('click', function(){ window.print(); });
    });
    toast(bk.status === 'Confirmed' ? 'Booking confirmed — ' + bk.id : 'Booked — status ' + bk.status);
  }
  var KIND_LABEL = { flight:'Flight', hotel:'Hotel', train:'Train', bus:'Bus', cab:'Cab', package:'Holiday', visa:'Visa', forex:'Forex', insurance:'Insurance' };
  function ticketHtml(bk){
    var refLabel = bk.kind === 'train' ? 'PNR' : bk.kind === 'flight' ? 'Airline PNR' : bk.kind === 'hotel' ? 'Hotel conf. no.' : 'Ticket no.';
    var f = bk.fare, rows = f.lines.map(function(l){ return '<div class="sum-row"><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></div>'; }).join('') +
      (f.taxes ? '<div class="sum-row"><span>' + esc(f.taxLabel || 'Taxes & fees') + '</span><span>' + money(f.taxes) + '</span></div>' : '') + (f.fee ? '<div class="sum-row"><span>Convenience fee</span><span>' + money(f.fee) + '</span></div>' : '') +
      f.add.map(function(l){ return '<div class="sum-row"><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></div>'; }).join('') + (f.disc ? '<div class="sum-row disc"><span>Coupon ' + f.coupon + '</span><span>−' + money(f.disc) + '</span></div>' : '') +
      (f.coins ? '<div class="sum-row disc"><span>WL Coins</span><span>−' + money(f.coins) + '</span></div>' : '') + (f.tcs ? '<div class="sum-row"><span>TCS</span><span>' + money(f.tcs) + '</span></div>' : '');
    var stCls = bk.status === 'Confirmed' ? 'ok' : bk.status === 'Cancelled' ? 'bad' : 'warn';
    return '<article class="eticket"><div class="et-head"><div><p class="modal-eyebrow" style="color:var(--marigold)">' + KIND_LABEL[bk.kind] + ' e-ticket · Wanderlust Co.</p><h3>' + esc(bk.title) + '</h3><p class="small" style="color:var(--on-deep-muted)">' + esc(bk.sub) + '</p></div><div style="text-align:right"><span class="ref">' + bk.id + '</span><br><span class="pill ' + stCls + '">' + esc(bk.status) + '</span></div></div>' +
      '<div class="et-body"><div><span>' + refLabel + '</span><b class="mono">' + bk.pnr + '</b></div><div><span>Date</span><b>' + fmtDate(bk.date, true) + (bk.time ? ', ' + bk.time : '') + '</b></div>' +
      '<div><span>Traveller' + (bk.names.length > 1 ? 's' : '') + '</span><b>' + bk.names.map(esc).join('<br>') + '</b></div>' + (bk.seats ? '<div><span>Seat / berth</span><b>' + bk.seats.map(esc).join(', ') + '</b></div>' : '') +
      bk.meta.map(function(m){ return '<div><span>' + esc(m[0]) + '</span><b>' + esc(m[1]) + '</b></div>'; }).join('') +
      '<div><span>Paid via</span><b>' + esc(bk.method) + '</b></div><div><span>Contact</span><b>+91 ' + esc(bk.contact.mobile || '') + '</b></div></div>' +
      '<div class="et-foot" style="display:block"><details><summary class="small" style="cursor:pointer;font-weight:600">Fare breakdown &amp; GST invoice</summary><div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">' + rows + '</div></details>' +
      '<div class="sum-total" style="font-size:1.2rem"><span>' + (bk.paid ? 'Total paid' : 'Pay at hotel') + '</span><span>' + money(bk.total) + '</span></div>' + (bk.refund != null ? '<p class="small" style="color:var(--ok)">Refund of ' + money(bk.refund) + ' initiated. It reaches your ' + esc(bk.method) + ' in 5–7 working days.</p>' : '') + '</div></article>';
  }

  /* ---------- Refund rules ---------- */
  function refundFor(bk){
    var now = new Date(), when = parseISO(bk.date); if(bk.time){ var p = bk.time.split(':'); when.setHours(+p[0], +p[1]); } else when.setHours(12, 0);
    var hrs = (when - now) / 3600000, days = hrs / 24, paid = bk.paid, c = bk.cancel || {}, charge = 0, note = '';
    if(hrs < 0) return { ok:false, note:'This trip has already started, so it can\'t be cancelled online.' };
    switch(bk.kind){
      case 'flight': charge = c.zero && hrs > 24 ? 0 : Math.min(paid, (c.intl ? 6000 : 3500) * c.pax); charge += c.convFee || 0; note = c.zero && hrs > 24 ? 'Zero cancellation applies: airline penalty waived.' : 'Airline cancellation charge of ' + fmtMoney((c.intl ? 6000 : 3500)) + ' per traveller, plus convenience fee.'; break;
      case 'train':
        if(/^WL/.test(bk.status)){ charge = 60 * c.pax; note = 'Waitlisted ticket: ₹60 per passenger clerkage.'; }
        else if(hrs > 48){ charge = (c.flat || 120) * c.pax; note = 'More than 48 hrs before departure: flat ' + fmtMoney(c.flat || 120) + ' per passenger.'; }
        else if(hrs > 12){ charge = Math.max((c.flat || 120) * c.pax, paid * 0.25); note = '48–12 hrs before departure: 25% of fare.'; }
        else if(hrs > 4){ charge = Math.max((c.flat || 120) * c.pax, paid * 0.5); note = '12–4 hrs before departure: 50% of fare.'; }
        else return { ok:false, note:'Confirmed tickets can\'t be cancelled within 4 hours of departure. File a TDR instead.' };
        if(c.tatkal && !/^WL/.test(bk.status)) return { ok:false, note:'Confirmed Tatkal tickets are non-refundable.' };
        break;
      case 'hotel': if(c.free && days >= 1){ charge = 0; note = 'Free cancellation applies.'; } else { charge = Math.min(paid, c.night || 0); note = c.free ? 'Less than 24 hrs to check-in: first night charged.' : 'Non-refundable rate: first night charged.'; } break;
      case 'bus': charge = hrs > 24 ? paid * 0.1 : paid * 0.5; note = hrs > 24 ? 'More than 24 hrs before departure: 10% charge.' : 'Within 24 hrs of departure: 50% charge.'; break;
      case 'cab': charge = hrs > 6 ? 0 : paid; note = hrs > 6 ? 'Free cancellation (more than 6 hrs before pick-up).' : 'Within 6 hrs of pick-up: no refund.'; break;
      case 'package': var pct = days > 30 ? 0.1 : days > 15 ? 0.25 : days > 7 ? 0.5 : 1; charge = paid * pct; note = Math.round(pct * 100) + '% cancellation charge (' + Math.floor(days) + ' days before start).'; break;
      case 'insurance': charge = 0; note = 'Free-look cancellation before the policy starts.'; break;
      default: charge = paid * 0.2; note = 'Service fee of 20% retained for work already done.';
    }
    charge = Math.round(Math.min(paid, charge));
    return { ok:true, charge:charge, refund:Math.max(0, paid - charge), note:note };
  }

  /* ------------------------------------------------------------------ */
  /* My Trips & wishlist                                                 */
  /* ------------------------------------------------------------------ */
  var tripTab = 'up';
  function openTrips(){
    var trips = store.get('trips', []), now = iso(today());
    var groups = { up: trips.filter(function(t){ return t.status !== 'Cancelled' && t.date >= now; }), past: trips.filter(function(t){ return t.status !== 'Cancelled' && t.date < now; }), can: trips.filter(function(t){ return t.status === 'Cancelled'; }) };
    var list = groups[tripTab];
    var html = '<div class="filter-tabs" role="tablist">' + [['up','Upcoming'],['past','Completed'],['can','Cancelled']].map(function(x){ return '<button class="f-tab' + (x[0] === tripTab ? ' active' : '') + '" data-tt="' + x[0] + '" role="tab" aria-selected="' + (x[0] === tripTab) + '">' + x[1] + ' (' + groups[x[0]].length + ')</button>'; }).join('') + '</div>' +
      (list.length ? list.map(function(t){
        return '<div class="trip-card' + (t.status === 'Cancelled' ? ' cancelled' : '') + '"><div class="tc-top"><div><p class="eyebrow">' + KIND_LABEL[t.kind] + ' · ' + t.id + '</p><h4>' + esc(t.title) + '</h4><p class="tc-meta">' + fmtDate(t.date, true) + ' · ' + esc(t.sub) + '</p></div><span class="pill ' + (t.status === 'Confirmed' ? 'ok' : t.status === 'Cancelled' ? 'bad' : 'warn') + '">' + esc(t.status) + '</span></div>' +
          '<div class="sum-row"><span class="small muted">' + (t.paid ? 'Paid' : 'Due at hotel') + '</span><b>' + money(t.total) + '</b></div>' + (t.refund != null ? '<p class="small" style="color:var(--ok)">Refund ' + money(t.refund) + ' initiated</p>' : '') +
          '<div class="tc-actions"><button class="btn btn-ink btn-sm" data-vt="' + t.id + '">View ticket</button>' + (t.status !== 'Cancelled' && t.date >= now ? '<button class="btn btn-outline-ink btn-sm" data-ct="' + t.id + '">Cancel</button>' : '') + '</div></div>';
      }).join('') : '<div class="empty"><strong>' + (tripTab === 'up' ? 'No upcoming trips yet.' : tripTab === 'past' ? 'No completed trips.' : 'No cancellations.') + '</strong>' + (tripTab === 'up' ? '<span>Where to next? Search above or browse holiday packages.</span><a class="btn btn-accent btn-sm" href="#holidays" data-close-drawer>Browse holidays</a>' : '') + '</div>');
    WL.openDrawer('My Trips', html);
  }
  WL.openTrips = openTrips;
  document.addEventListener('click', function(e){
    var tt = e.target.closest('[data-tt]'); if(tt){ tripTab = tt.getAttribute('data-tt'); openTrips(); return; }
    if(e.target.closest('[data-close-drawer]')) WL.closeDrawer();
    var vt = e.target.closest('[data-vt]');
    if(vt){ var bk = store.get('trips', []).filter(function(t){ return t.id === vt.getAttribute('data-vt'); })[0]; WL.openModal('<h3 id="modalTitle" class="sr-only">Ticket ' + bk.id + '</h3>' + ticketHtml(bk) + (!framed ? '<div class="et-actions"><button class="btn btn-outline-ink btn-sm" data-print>Print / save PDF</button></div>' : ''), true); return; }
    var ct = e.target.closest('[data-ct]');
    if(ct){
      var id = ct.getAttribute('data-ct'), trips = store.get('trips', []), b = trips.filter(function(t){ return t.id === id; })[0], r = refundFor(b);
      if(!r.ok){ WL.openModal('<h3 id="modalTitle">Can\'t cancel online</h3><div class="modal-body"><p>' + esc(r.note) + '</p><p class="small muted">Call us on +91 74609 62727 for help.</p></div>'); return; }
      WL.openModal('<p class="modal-eyebrow">' + b.id + '</p><h3 id="modalTitle">Cancel this booking?</h3><div class="modal-body"><p><b>' + esc(b.title) + '</b><br><span class="small muted">' + fmtDate(b.date, true) + '</span></p>' +
        '<div class="summary" style="padding:14px"><div class="sum-row"><span>Amount paid</span><span>' + money(b.paid) + '</span></div><div class="sum-row"><span>Cancellation charges</span><span>−' + money(r.charge) + '</span></div><div class="sum-total" style="font-size:1.2rem"><span>Refund</span><span>' + money(r.refund) + '</span></div><p class="small muted">' + esc(r.note) + '</p>' + (b.coinsUsed ? '<p class="small muted">' + b.coinsUsed + ' WL Coins used will be returned.</p>' : '') + '</div>' +
        '<div class="d-actions"><button class="btn btn-outline-ink" data-close-modal>Keep booking</button><button class="btn btn-accent" id="doCancel">Yes, cancel</button></div></div>');
      $('#doCancel').addEventListener('click', function(){
        b.status = 'Cancelled'; b.refund = r.refund; store.set('trips', trips);
        if(user()) addCoins((b.coinsUsed || 0) - (b.coinsEarned || 0));
        WL.closeModal(); tripTab = 'can'; openTrips(); toast('Cancelled. Refund of ' + fmtMoney(r.refund) + ' initiated.');
      });
    }
  });
  document.addEventListener('click', function(e){ if(e.target.closest('[data-print]')) window.print(); });
  $('#tripsBtn').addEventListener('click', openTrips);
  $('#bnTrips').addEventListener('click', openTrips);

  $('#wishlistBtn').addEventListener('click', openWishlist);
  function openWishlist(){
    var w = WL.wishList();
    var items = w.map(function(k){
      var p = k.split(':');
      if(p[0] === 'd'){ var d = D.destinations.filter(function(x){ return x.id === p[1]; })[0]; return d && '<div class="trip-card" style="border-left-color:var(--marigold)"><div class="tc-top"><div><p class="eyebrow">Destination</p><h4>' + esc(d.name) + '</h4><p class="tc-meta">' + esc(d.tagline) + ' · from ' + money(d.from) + '</p></div></div><div class="tc-actions"><button class="btn btn-ink btn-sm" data-dest="' + d.id + '">Open</button><button class="btn btn-outline-ink btn-sm" data-unwish="' + k + '">Remove</button></div></div>'; }
      if(p[0] === 'p'){ var pk = D.packages.filter(function(x){ return x.id === p[1]; })[0]; return pk && '<div class="trip-card" style="border-left-color:var(--marigold)"><div class="tc-top"><div><p class="eyebrow">Holiday package</p><h4>' + esc(pk.title) + '</h4><p class="tc-meta">' + esc(pk.route) + ' · ' + money(pk.price) + ' pp</p></div></div><div class="tc-actions"><button class="btn btn-ink btn-sm" data-pkg="' + pk.id + '">View</button><button class="btn btn-outline-ink btn-sm" data-unwish="' + k + '">Remove</button></div></div>'; }
      if(p[0] === 'h') return '<div class="trip-card" style="border-left-color:var(--marigold)"><div class="tc-top"><div><p class="eyebrow">Stay in ' + esc(p[1]) + '</p><h4>Saved hotel</h4><p class="tc-meta">Search ' + esc(p[1]) + ' hotels to see it again.</p></div></div><div class="tc-actions"><button class="btn btn-outline-ink btn-sm" data-unwish="' + k + '">Remove</button></div></div>';
      return '';
    }).filter(Boolean);
    WL.openDrawer('Wishlist', items.length ? items.join('') : '<div class="empty"><strong>Your wishlist is empty.</strong><span>Tap the ♥ on any destination, package or hotel to save it here.</span></div>');
  }
  document.addEventListener('click', function(e){ var u = e.target.closest('[data-unwish]'); if(!u) return; e.stopPropagation(); WL.toggleWish(u.getAttribute('data-unwish')); openWishlist(); }, true);

  /* ------------------------------------------------------------------ */
  /* PNR / booking lookup                                               */
  /* ------------------------------------------------------------------ */
  WL.lookupPnr = function(q, short){
    q = (q || '').trim().toUpperCase();
    var bk = store.get('trips', []).filter(function(t){ return t.pnr === q || t.id === q; })[0];
    if(bk){
      var s = '<div class="status-card"><span class="eyebrow">' + KIND_LABEL[bk.kind] + ' · ' + bk.id + '</span><strong>' + esc(bk.title) + '</strong><span class="small">' + fmtDate(bk.date, true) + '</span>' +
        bk.names.map(function(n, i){ return '<span class="small">' + esc(n) + ' — <b>' + esc(bk.status === 'Confirmed' && bk.seats ? 'CNF ' + bk.seats[i] : bk.status) + '</b></span>'; }).join('') + '</div>';
      return short ? 'Found it: <b>' + esc(bk.title) + '</b> on ' + fmtDate(bk.date) + ' — status <b>' + esc(bk.status) + '</b>.' : s;
    }
    var msg = /^\d{10}$/.test(q) ? 'PNR ' + q + ' isn\'t among bookings made on this site. For tickets booked elsewhere, check the official Indian Railways enquiry site.' : 'Enter a 10-digit PNR or a Wanderlust booking ID (WL-…).';
    return short ? msg : '<p class="small" style="color:var(--bad)">' + esc(msg) + '</p>' + (/^\d{10}$/.test(q) ? '<a class="text-link small" href="https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html" target="_blank" rel="noopener">Open Indian Railways PNR enquiry ↗</a>' : '');
  };
  $('#pnrInput').addEventListener('input', function(){ if(/^\d/.test(this.value)) this.value = this.value.replace(/\D/g, '').slice(0, 10); });
  $('#pnrForm').addEventListener('submit', function(e){ e.preventDefault(); $('#pnrOut').innerHTML = WL.lookupPnr($('#pnrInput').value); });

  /* ------------------------------------------------------------------ */
  /* Builders: turn a selected result into a checkout item               */
  /* ------------------------------------------------------------------ */
  var AIRN = {}; D.airlines.forEach(function(a){ AIRN[a.code] = a.name; });
  WL.checkoutFlight = function(q, out, ret){
    var intl = q.from.intl || q.to.intl, spec = [];
    for(var i = 0; i < q.adults; i++) spec.push({ label:'Adult ' + (i + 1), type:'adult' });
    for(var j = 0; j < q.children; j++) spec.push({ label:'Child ' + (j + 1) + ' (2–12 yrs)', type:'child' });
    for(var k = 0; k < q.infants; k++) spec.push({ label:'Infant ' + (k + 1) + ' (under 2)', type:'infant' });
    var legs = [out].concat(ret ? [ret] : []), baseA = 0, taxA = 0;
    legs.forEach(function(f){ baseA += f.base; taxA += f.tax; });
    var lines = [['Adult base fare × ' + q.adults, baseA * q.adults]];
    if(q.children) lines.push(['Child base fare × ' + q.children, Math.round(baseA * 0.9) * q.children]);
    if(q.infants) lines.push(['Infant fare × ' + q.infants, (intl ? Math.round(baseA * 0.1) : 1500 * legs.length) * q.infants]);
    var seatsPax = q.adults + q.children;
    var legTxt = function(f, a, b){ return AIRN[f.al] + ' ' + f.no + ' · ' + a.air + ' ' + hm(f.dep) + ' → ' + b.air + ' ' + hm(f.arr) + ' · ' + dur(f.dur) + (f.stops ? ' · via ' + f.via : ' · non-stop'); };
    var meta = [['Onward', legTxt(out, q.from, q.to)]]; if(ret) meta.push(['Return (' + fmtDateShort(parseISO(q.ret)) + ')', legTxt(ret, q.to, q.from)]);
    meta.push(['Cabin', q.cls + (q.fare !== 'Regular' ? ' · ' + q.fare + ' fare' : '')], ['Baggage', out.bag]);
    startCheckout({ kind:'flight', cat:'flights', intl:intl, title:q.from.name + ' → ' + q.to.name + (ret ? ' (round trip)' : ''), sub:fmtDate(q.date, true) + (ret ? ' – ' + fmtDate(q.ret, true) : '') + ' · ' + q.paxLabel + ' · ' + q.cls,
      date:q.date, time:hm(out.dep), lines:lines, taxes:(taxA * seatsPax), taxLabel:'Airline taxes & fees', feePer:249, feeLabel:'Convenience fee', paxCount:seatsPax,
      paxSpec:spec, paxFields:'flight', meta:meta,
      detailHtml:'<div class="r-tags" style="border:none;padding:0">' + meta.map(function(m){ return '<span class="pill">' + esc(m[0]) + ': ' + esc(m[1]) + '</span>'; }).join('') + '</div>' + (q.fare !== 'Regular' ? '<p class="demo-note">' + esc(q.fare) + ' fare: carry valid proof (student ID, senior citizen ID, service ID or medical registration) to check-in.</p>' : ''),
      addons:[{ id:'zero', label:'Zero cancellation', desc:'Cancel up to 24 hrs before departure and pay no airline penalty.', price:intl ? 999 : 549, per:'pax' },
              { id:'ins', label:'Trip protection insurance', desc:'Medical cover, flight delay over 3 hrs and baggage loss.', price:intl ? 449 : 199, per:'pax', def:false },
              { id:'flexi', label:'Free date change', desc:'Change your travel date once; pay only the fare difference.', price:intl ? 1499 : 699, per:'pax' }].concat(out.meal === 'Free meal' ? [] : [{ id:'meal', label:'Pre-book a meal', desc:'Hot veg or non-veg meal served on board.', price:349, per:'pax' }]),
      cancel:{ intl:intl } });
  };
  WL.checkoutHotel = function(q, h, room, nightly){
    var rate = nightly <= 1000 ? 0 : nightly <= 7500 ? 0.05 : 0.18, base = nightly * q.nights * q.rooms;
    startCheckout({ kind:'hotel', cat:'hotels', title:h.name + ', ' + q.place.name, sub:fmtDate(q.checkin) + ' – ' + fmtDate(q.checkout) + ' · ' + q.nights + 'N · ' + q.rooms + ' room' + (q.rooms > 1 ? 's' : '') + ', ' + (q.adults + q.children) + ' guests',
      date:q.checkin, time:'12:00', lines:[[room + ' × ' + q.rooms + ' × ' + q.nights + 'N', base]], taxes:Math.round(base * rate), taxLabel:'GST (' + Math.round(rate * 100) + '%)', paxFields:'lead', payLater:h.payAtHotel,
      meta:[['Room', room], ['Check-in', fmtDate(q.checkin, true) + ', 12:00 PM'], ['Check-out', fmtDate(q.checkout, true) + ', 11:00 AM'], ['Address', h.area + ', ' + q.place.name]],
      detailHtml:'<div class="amen">' + (h.freeCancel ? '<span class="pill ok">Free cancellation until 24 hrs before check-in</span>' : '<span class="pill bad">Non-refundable</span>') + (h.payAtHotel ? '<span class="pill warn">Pay at hotel available</span>' : '') + '</div>',
      addons:[{ id:'late', label:'Late check-out till 2 PM', desc:'Subject to availability; refunded if unavailable.', price:799, per:'booking' }, { id:'transfer', label:'Airport / station pick-up', desc:'Private AC sedan to the property.', price:1199, per:'booking' }],
      cancel:{ free:h.freeCancel, night:nightly * q.rooms } });
  };
  WL.checkoutTrain = function(q, t, c){
    var flat = { SL:120, '3E':180, '3A':180, '2A':200, '1A':240, CC:180, EC:240 }[c.c];
    startCheckout({ kind:'train', cat:'trains', title:t.no + ' ' + t.name, sub:fmtDate(q.date, true) + ' · ' + c.c + ' · ' + q.quota + ' quota · ' + q.from.rail + ' ' + hm(t.dep) + ' → ' + q.to.rail + ' ' + hm(t.arr),
      date:q.date, time:hm(t.dep), cls:c.c, premium:t.premium, quota:q.quota, avail:c, paxDynamic:true, paxMax:q.quota === 'Tatkal' ? 4 : 6, unit:c.fare, unitLabel:c.c + ' fare (incl. GST)', fee:30, feeLabel:'Service fee', paxFields:'train',
      meta:[['Train', t.no + ' ' + t.name], ['From', q.from.railName + ' (' + q.from.rail + ') ' + hm(t.dep)], ['To', q.to.railName + ' (' + q.to.rail + ') ' + hm(t.arr)], ['Class / quota', c.c + ' · ' + q.quota], ['Distance', t.km + ' km']],
      detailHtml:'<p>Current status: ' + (c.st === 'AVL' ? '<b style="color:var(--ok)">Available ' + c.n + '</b>' : '<b style="color:var(--warn)">' + c.st + ' ' + c.n + '</b> · ' + (c.chance || '') + ' chance to confirm. Waitlisted e-tickets that stay unconfirmed after charting are cancelled and refunded automatically.') + '</p>',
      addons:[{ id:'assure', label:'Free cancellation cover', desc:'Get the full ticket fare back if you cancel up to 6 hrs before departure.', price:69, per:'pax' }],
      cancel:{ flat:flat, tatkal:q.quota === 'Tatkal' } });
  };
  WL.checkoutBus = function(q, b, seats, board, drop){
    var base = b.fare * seats.length;
    startCheckout({ kind:'bus', cat:'buses', title:b.op + ' · ' + q.from.name + ' → ' + q.to.name, sub:fmtDate(q.date, true) + ' · ' + b.type.t + ' · Seats ' + seats.join(', '),
      date:q.date, time:hm(b.dep), seats:seats, paxCount:seats.length, paxSpec:seats.map(function(s){ return { label:'Seat ' + s, type:'adult' }; }), paxFields:'bus',
      lines:[['Bus fare × ' + seats.length, base]], taxes:b.type.ac ? Math.round(base * 0.05) : 0, taxLabel:'GST (5%)',
      meta:[['Boarding', board], ['Dropping', drop], ['Bus', b.type.t]], addons:[{ id:'ins', label:'Travel insurance', desc:'Accident cover up to ₹5 lakh for this journey.', price:15, per:'pax' }], cancel:{} });
  };
  WL.checkoutCab = function(q, x, title, sub){
    var base = Math.round(x.fare / 1.05);
    startCheckout({ kind:'cab', cat:'cabs', title:x.car.t + ' · ' + title, sub:sub, date:q.date, time:q.time, paxFields:'lead', lines:[[x.car.t + ' fare (' + x.incl + ')', base]], taxes:x.fare - base, taxLabel:'GST (5%)',
      meta:[['Car', x.car.t + ' (' + x.car.eg + ')'], ['Includes', x.incl], ['Extra', x.extra]], addons:[{ id:'carrier', label:'Roof carrier for luggage', desc:'Useful for 4+ bags.', price:200, per:'booking' }], cancel:{} });
  };
  WL.bookPackage = function(id){
    var p = D.packages.filter(function(x){ return x.id === id; })[0], d = D.destinations.filter(function(x){ return x.id === p.dest; })[0];
    startCheckout({ kind:'package', cat:'holidays', intl:!!d.intl, flights:p.flights, title:p.title, sub:p.nights + 'N/' + (p.nights + 1) + 'D · ' + p.route, unit:p.price, paxFields:'lead', taxLabel:'GST (5%)',
      date:iso(addDays(today(), 21)), meta:[['Route', p.route], ['Hotels', p.hotel], ['Meals', p.meals]],
      detailHtml:'<ol class="itin" style="margin-top:6px">' + p.days.map(function(t, i){ return '<li><b>Day ' + (i + 1) + '</b>' + esc(t) + '</li>'; }).join('') + '</ol>',
      addons:[{ id:'ins', label:'Travel insurance for the group', desc:'Medical, trip cancellation and baggage cover.', price:d.intl ? 1499 : 499, per:'pax' }, { id:'upgrade', label:'Upgrade to 4★ / 5★ hotels', desc:'Better stays across the itinerary.', price:Math.round(p.price * 0.18 / 100) * 100, per:'pax' }],
      cancel:{} });
  };
  WL.checkoutService = function(o){
    var n = o.paxCount || o.count || 1, base = o.unit * (o.count || 1), spec = [];
    for(var i = 0; i < n; i++) spec.push({ label:'Traveller ' + (i + 1), type:'adult' });
    startCheckout({ kind:o.kind, cat:'none', intl:o.intl, title:o.title, sub:o.sub, date:o.date, lines:[[o.kind === 'forex' ? 'Currency value' : o.title + (o.count > 1 ? ' × ' + o.count : ''), base]],
      taxes:o.gstFixed != null ? o.gstFixed : Math.round(base * (o.gst || 0)), taxLabel:o.kind === 'forex' ? 'GST on currency conversion' : 'GST (18%)', paxSpec:o.paxFields === 'forex' ? [{ label:'Applicant', type:'adult' }] : spec, paxCount:n, paxFields:o.paxFields, meta:[], cancel:{} });
  };

  updateLoginUI();
  WL.applyLang();
})();
