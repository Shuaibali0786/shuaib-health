/* Renders the live design preview from URL params:
   ?screen=overview|bookings  &theme=light|dark|system  &state=list|drawer|confirm  &at=HH:MM (start the clinic clock at this time)
   Everything runs on the real clock in Asia/Karachi. Tests freeze it with Playwright's page.clock. */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var screen = q.get("screen") === "bookings" ? "bookings" : "overview";
  var state = ["drawer", "confirm"].indexOf(q.get("state")) >= 0 ? q.get("state") : "list";
  var root = document.documentElement;
  var TZ = "Asia/Karachi";
  var REFRESH_MS = 30000;          // KPIs and lists (real mode: GET /admin/overview, research R19)
  var SIM_FIRST_MS = 50000;        // demo only: first simulated online booking
  var SIM_EVERY_MS = 75000;        // demo only: then one every 75 s
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Clinic clock ---------- */
  var partsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23"
  });
  var clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  function clinicParts(ms) {
    var p = {};
    partsFmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
  }
  var offsetMs = 0;
  var at = /^(\d{1,2}):(\d{2})$/.exec(q.get("at") || "");
  if (at) {
    var p0 = clinicParts(Date.now());
    offsetMs = ((+at[1] * 60 + +at[2]) - (p0.h * 60 + p0.mi)) * 60000 - p0.s * 1000;
  }
  function nowMs() { return Date.now() + offsetMs; }
  function nowMin() { var p = clinicParts(nowMs()); return p.h * 60 + p.mi; }

  var start = clinicParts(nowMs());
  var today = { y: start.y, m: start.m, d: start.d };
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var wd = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();
  var dateLabel = WEEKDAYS[wd] + " " + today.d + " " + MONTHS[today.m - 1] + " " + today.y;
  var shortDate = WEEKDAYS[wd].slice(0, 3) + " " + today.d + " " + MONTHS[today.m - 1].slice(0, 3);
  var lastWeekLabel = "last " + WEEKDAYS[wd].slice(0, 3);

  var D = window.PREVIEW_DATA.build(today, start.h * 60 + start.mi);
  var STATUS = { confirmed: "Confirmed", arrived: "Arrived", completed: "Completed", no_show: "No-show", cancelled: "Cancelled" };
  function greeting(h) { return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening"; }

  /* ---------- Theme: Light / Night / Auto, remembered on this device ---------- */
  var THEME_KEY = "cc_theme"; // the real app uses the cc_theme cookie (contracts/website-admin.md)
  var mqDark = window.matchMedia("(prefers-color-scheme: dark)");
  var PREFS = ["light", "dark", "system"];
  var PREF_LABEL = { light: "Light", dark: "Night", system: "Auto" };
  function storedPref() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  var themePref = PREFS.indexOf(q.get("theme")) >= 0 ? q.get("theme") : (PREFS.indexOf(storedPref()) >= 0 ? storedPref() : "light");
  function applyTheme() {
    root.dataset.theme = themePref === "system" ? (mqDark.matches ? "dark" : "light") : themePref;
    root.dataset.themePref = themePref;
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-pref]"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.themePref === themePref));
    });
    var mb = document.getElementById("m-theme");
    if (mb) {
      var next = PREFS[(PREFS.indexOf(themePref) + 1) % 3];
      mb.setAttribute("aria-label", "Theme: " + PREF_LABEL[themePref] + ". Switch to " + PREF_LABEL[next]);
      mb.innerHTML = icon(themePref === "dark" ? "moon" : themePref === "system" ? "system" : "sun");
    }
  }
  function setTheme(p) {
    themePref = p;
    try { localStorage.setItem(THEME_KEY, p); } catch (e) { /* private mode: still applies for this visit */ }
    applyTheme();
  }
  mqDark.addEventListener("change", function () { if (themePref === "system") applyTheme(); });
  applyTheme();

  /* ---------- Icons (lucide-style strokes) ---------- */
  var P = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    bookings: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    insights: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    doctors: '<circle cx="12" cy="8" r="4.5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    staff: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    system: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    confirmed: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
    arrived: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
    completed: '<circle cx="12" cy="12" r="9.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    no_show: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
    cancelled: '<circle cx="12" cy="12" r="9.5"/><path d="m15 9-6 6M9 9l6 6"/>',
    gauge: '<path d="M3.34 19a10 10 0 1 1 17.32 0"/><path d="m12 14 4-4"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    flat: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    chevRight: '<path d="m9 18 6-6-6-6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
    calPlus: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v5M9.5 16.5h5"/>'
  };
  function icon(name, cls) {
    return '<svg class="i ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + P[name] + "</svg>";
  }
  function pill(st) {
    return '<span class="pill ' + st + " st-" + st + '">' + icon(st, "i-sm") + '<span class="lbl">' + STATUS[st] + "</span></span>";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function byRef(ref) { return D.bookings.filter(function (b) { return b.ref === ref; })[0]; }
  function upcoming() { var n = nowMin(); return D.bookings.filter(function (b) { return b.status === "confirmed" && b.startMin > n; }); }

  /* ---------- Chrome ---------- */
  function sidebar() {
    var items = [
      ["overview", "Overview"], ["bookings", "Bookings"], ["insights", "Insights"],
      ["doctors", "Doctors today"], ["activity", "Activity"], ["staff", "Staff"]
    ];
    return '<aside class="side" aria-label="Command Centre">' +
      '<div class="brand"><div class="mono" aria-hidden="true">SH</div><div><div class="brand-name">Shuaib Health</div><div class="brand-sub">Command Centre</div></div></div>' +
      '<ul class="nav">' + items.map(function (it) {
        return '<li><a href="' + (it[0] === "overview" || it[0] === "bookings" ? "?screen=" + it[0] : "#") + '"' + (it[0] === screen ? ' aria-current="page"' : "") + ">" + icon(it[0]) + it[1] +
          (it[0] === "activity" || it[0] === "staff" ? '<span class="badge">Admin</span>' : "") + "</a></li>";
      }).join("") + "</ul>" +
      '<div class="side-foot">' +
      '<div class="theme-switch" role="group" aria-label="Theme">' +
      '<button type="button" data-theme-pref="light">' + icon("sun", "i-sm") + "Light</button>" +
      '<button type="button" data-theme-pref="dark">' + icon("moon", "i-sm") + "Night</button>" +
      '<button type="button" data-theme-pref="system">' + icon("system", "i-sm") + "Auto</button></div>" +
      '<div class="who"><div class="avatar">DV</div><div><b>Demo visitor</b><span>Read-only · Admin view</span></div></div>' +
      "</div></aside>";
  }
  function mobileTop() {
    return '<header class="m-top"><div class="mono" aria-hidden="true">SH</div><div><div class="brand-name">Shuaib Health</div><div class="brand-sub">Command Centre</div></div>' +
      '<button type="button" class="icon-btn" id="m-theme" style="margin-left:auto"></button>' +
      '<button type="button" class="icon-btn" aria-label="Search bookings">' + icon("search") + "</button></header>";
  }
  function ribbon() {
    return '<div class="ribbon" role="note"><span class="dot" aria-hidden="true"></span><strong>Demo mode — changes are not saved.</strong><span>All names and numbers are sample data.</span>' +
      '<span class="links"><a href="#">Back to website</a><a href="#">Staff sign-in</a></span></div>';
  }
  function bottomNav() {
    var items = [["overview", "Overview"], ["bookings", "Bookings"], ["insights", "Insights"], ["doctors", "Doctors"], ["more", "More"]];
    return '<nav class="bottom-nav" aria-label="Main">' + items.map(function (it) {
      return '<a href="' + (it[0] === "overview" || it[0] === "bookings" ? "?screen=" + it[0] : "#") + '"' + (it[0] === screen ? ' aria-current="page"' : "") + ">" + icon(it[0]) + it[1] + "</a>";
    }).join("") + "</nav>";
  }
  function footer() {
    return '<footer class="foot"><span>Portfolio demo — not a real clinic, not medical advice.</span>' +
      '<span class="credit">Designed &amp; built by <a href="https://github.com/Shuaibali0786">Shuaib Ali</a></span></footer>';
  }
  function statusBar() {
    return '<div class="statusbar"><span class="eyebrow">Command Centre · ' + shortDate + "</span>" +
      '<span class="statusbar-right">' +
      '<span class="clock">' + icon("clock", "i-sm") + '<time id="clock" aria-live="off">' + clockFmt.format(new Date(nowMs())) + '</time><span class="tz">· Karachi</span></span>' +
      '<span class="live-pill"><span class="live-dot" aria-hidden="true"></span>Live<span class="sep" aria-hidden="true">·</span><span id="updated"><span class="upd-word">updated </span>just now</span></span>' +
      "</span></div>";
  }
  function head(title, sub, actions, titleId) {
    return '<div class="page-head"><div><h1 class="display"' + (titleId ? ' id="' + titleId + '"' : "") + ">" + title + '</h1><div class="sub" id="page-sub">' + sub + "</div></div>" +
      (actions ? '<div class="actions">' + actions + "</div>" : "") + "</div>";
  }

  /* ---------- KPIs ---------- */
  var KPI_DEFS = [
    ["appointments", "Appointments", "bookings"], ["arrived", "Arrived", "arrived"], ["completed", "Completed", "completed"],
    ["no_show", "No-shows", "no_show"], ["cancelled", "Cancellations", "cancelled"], ["utilisation", "Chair utilisation", "gauge"]
  ];
  function trendHtml(key, now, before) {
    var unit = key === "utilisation" ? " pts" : "";
    var d = now - before, cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
    var words = d === 0 ? "same as " + lastWeekLabel : (d > 0 ? "up " : "down ") + Math.abs(d) + unit + " on " + lastWeekLabel;
    return '<span class="trend ' + cls + '">' + icon(cls, "i-sm") + '<span aria-hidden="true">' + Math.abs(d) + unit + '</span></span><span class="vs" aria-hidden="true">vs ' + lastWeekLabel + '</span><span class="sr-only">' + words + "</span>";
  }
  function kpis() {
    return '<section class="kpis" aria-label="Today in numbers">' + KPI_DEFS.map(function (k) {
      return '<div class="card kpi"><div class="label">' + icon(k[2], "i-sm") + k[1] + '</div><div class="value"><span class="v" aria-hidden="true" data-kpi="' + k[0] + '">0</span>' +
        (k[0] === "utilisation" ? '<small aria-hidden="true">%</small>' : "") + '<span class="sr-only" data-kpi-sr="' + k[0] + '"></span></div><div class="kfoot" data-kpi-trend="' + k[0] + '"></div></div>';
    }).join("") + "</section>";
  }
  function animateTo(el, to) {
    var from = +(el.dataset.value || 0);
    el.dataset.value = to;
    if (reduceMotion.matches || from === to) { el.textContent = to; return; }
    var t0 = performance.now(), dur = from === 0 ? 900 : 500;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function updateKpis() {
    var K = D.kpi(), L = D.kpiLastWeek;
    KPI_DEFS.forEach(function (k) {
      var key = k[0], v = K[key];
      var el = document.querySelector('[data-kpi="' + key + '"]');
      if (!el) return;
      animateTo(el, v);
      document.querySelector('[data-kpi-sr="' + key + '"]').textContent = v + (key === "utilisation" ? "%" : "");
      document.querySelector('[data-kpi-trend="' + key + '"]').innerHTML = trendHtml(key, v, L[key]);
    });
  }

  /* ---------- Agenda (desktop timeline) ---------- */
  var DAY_START = 9 * 60, DAY_END = 20 * 60, SPAN = DAY_END - DAY_START;
  function pct(min) { return ((min - DAY_START) / SPAN) * 100; }
  function chipLabel(b) { return b.time + ", patient " + b.initials + ", " + STATUS[b.status] + ". Open booking."; }
  function agendaRows() {
    return D.doctors.map(function (d) {
      var s = D.toMin(d.start), e = D.toMin(d.end);
      var mine = D.bookings.filter(function (b) { return b.doctor === d; });
      var lane = '<div class="tl-off" style="left:0;width:' + pct(s) + '%"></div>' +
        '<div class="tl-off" style="left:' + pct(e) + '%;right:0"></div>' +
        mine.map(function (b) {
          return '<button type="button" class="tl-b ' + b.status + " st-" + b.status + (b.isNew ? " is-new" : "") + '" data-ref="' + b.ref + '" style="left:calc(' + pct(b.startMin) + '% + 2px);width:calc(' + (D.slotMin / SPAN) * 100 + '% - 4px)" aria-label="' + esc(chipLabel(b)) + '">' + icon(b.status, "i-sm") + "</button>";
        }).join("");
      return '<div class="tl-row"><div class="tl-doc"><b>' + d.name + "</b><span>" + d.dept + " · " + d.start + "–" + d.end + '</span></div><div class="tl-lane" style="background-size:' + (100 / 11) + '% 100%">' + lane + "</div></div>";
    }).join("");
  }
  function agendaMeta() {
    var cancelled = D.bookings.filter(function (b) { return b.status === "cancelled"; }).length;
    return D.doctors.length + " doctors working · " + D.bookings.length + " bookings incl. " + cancelled + " cancelled";
  }
  function agendaDesktop() {
    var hours = "";
    for (var h = 9; h < 20; h++) hours += '<span style="width:' + (100 / 11) + '%">' + (h < 10 ? "0" : "") + h + ":00</span>";
    return '<section class="card agenda d-only" aria-labelledby="ag-h"><div class="card-head"><h2 class="display" id="ag-h">Today’s agenda</h2><span class="meta" id="ag-meta">' +
      agendaMeta() + '</span><span class="right"><a class="btn btn-quiet btn-sm" href="#">Doctors today ' + icon("chevRight", "i-sm") + "</a></span></div>" +
      '<p class="sr-only">Each booking is a button: focus or hover shows its time, patient initials and status; activate it to open the booking.</p>' +
      '<div class="tl-wrap"><div class="tl" id="tl"><div class="tl-hours">' + hours + '</div><div id="tl-rows">' + agendaRows() + "</div>" +
      '<div class="tl-now" id="tl-now" aria-hidden="true"></div><div class="tl-tip" id="tl-tip" aria-hidden="true" hidden></div></div></div>' +
      '<div class="legend">' + ["confirmed", "arrived", "completed", "no_show", "cancelled"].map(pill).join("") + "</div></section>";
  }
  function moveNow() {
    var n = nowMin(), line = document.getElementById("tl-now");
    if (!line) return;
    var f = (n - DAY_START) / SPAN;
    line.hidden = f < 0 || f > 1;
    line.style.left = "calc(var(--doc-w) + (100% - var(--doc-w)) * " + Math.max(0, Math.min(1, f)) + ")";
    line.dataset.label = "Now " + D.fmt(n);
  }

  /* Agenda chip tooltip: hover, focus or tap shows time, initials and status (WCAG 1.4.13: hoverable, dismissible). */
  var tipHide = 0;
  function showTip(chip) {
    var b = byRef(chip.dataset.ref), tip = document.getElementById("tl-tip"), tl = document.getElementById("tl");
    if (!b || !tip) return;
    clearTimeout(tipHide);
    tip.innerHTML = '<b class="num">' + b.time + "</b><span>" + esc(b.initials) + "</span>" + pill(b.status);
    tip.hidden = false;
    var cr = chip.getBoundingClientRect(), tr = tl.getBoundingClientRect();
    var half = tip.offsetWidth / 2;
    var x = Math.max(half, Math.min(tr.width - half, cr.left - tr.left + cr.width / 2));
    tip.style.left = x + "px";
    tip.style.top = (cr.top - tr.top - 8) + "px";
  }
  function hideTip(delay) {
    clearTimeout(tipHide);
    tipHide = setTimeout(function () { var t = document.getElementById("tl-tip"); if (t) t.hidden = true; }, delay || 0);
  }

  /* ---------- Next up, status mix, mobile agenda ---------- */
  function nextUpList() {
    var five = upcoming().slice(0, 5);
    if (!five.length) return '<p class="empty">No more confirmed patients today.</p>';
    return '<ul class="next">' + five.map(function (b) {
      return '<li><span class="time">' + b.time + '</span><div class="who2"><b>' + esc(b.masked) + "</b><span>" + b.doctor.short + " · " + b.doctor.dept + '</span></div><button type="button" class="btn btn-sm">' + icon("arrived", "i-sm") + "Mark arrived</button></li>";
    }).join("") + "</ul>";
  }
  function nextUp() {
    return '<section class="card" aria-labelledby="nu-h"><div class="card-head"><h2 class="display" id="nu-h">Next patients up</h2><span class="meta">Confirmed, not yet arrived</span></div><div id="next-up">' + nextUpList() + "</div></section>";
  }
  function mixInner() {
    var order = ["completed", "arrived", "confirmed", "no_show", "cancelled"];
    var counts = {}; order.forEach(function (s) { counts[s] = 0; });
    D.bookings.forEach(function (b) { counts[b.status]++; });
    var total = D.bookings.length;
    var summary = "Status of today's " + total + " bookings: " + order.map(function (s) { return counts[s] + " " + STATUS[s].toLowerCase(); }).join(", ") + ".";
    return '<div class="mix-bar" role="img" aria-label="' + summary + '">' + order.map(function (s) {
      return counts[s] ? '<span class="' + s + " st-" + s + '" style="flex:' + counts[s] + '"></span>' : "";
    }).join("") + '</div><ul class="mix-list">' + order.map(function (s) {
      return "<li>" + pill(s) + '<span class="n num">' + counts[s] + '</span><span class="pc num">' + Math.round((counts[s] / total) * 100) + "%</span></li>";
    }).join("") + '</ul><div class="mix-note">Chair utilisation = booked (not cancelled) ÷ scheduled slots for doctors working today.</div>';
  }
  function statusMix() {
    return '<section class="card" aria-labelledby="mx-h"><div class="card-head"><h2 class="display" id="mx-h">Today by status</h2><span class="meta" id="mx-meta">' + D.bookings.length + ' bookings</span></div><div class="mix" id="mix">' + mixInner() + "</div></section>";
  }
  function mobileDocs(openIds) {
    var n = nowMin();
    return D.doctors.map(function (d) {
      var mine = D.bookings.filter(function (b) { return b.doctor === d; });
      var open = openIds ? openIds.indexOf(d.id) >= 0 : d.id === "iq";
      var nowPlaced = false;
      var items = mine.map(function (b) {
        var marker = "";
        if (!nowPlaced && b.startMin > n) { nowPlaced = true; marker = '<li class="m-now">Now ' + D.fmt(n) + "</li>"; }
        return marker + '<li><button type="button" class="m-row' + (b.isNew ? " is-new" : "") + '" data-ref="' + b.ref + '"><span class="tm">' + b.time + "</span><span>" + esc(b.masked) + "</span>" + pill(b.status) + "</button></li>";
      }).join("");
      var left = mine.filter(function (b) { return b.status === "confirmed" || b.status === "arrived"; }).length;
      return '<details class="m-doc" data-doc="' + d.id + '"' + (open ? " open" : "") + "><summary><div><b>" + d.name + "</b><span>" + d.dept + " · " + d.start + "–" + d.end + '</span></div><span class="count">' +
        mine.length + " booked<br>" + left + " to see</span>" + icon("chevDown", "i-sm") + "</summary><ol>" + items + "</ol></details>";
    }).join("");
  }
  function agendaMobile() {
    return '<section class="card m-only" aria-labelledby="mag-h" style="margin-top:14px"><div class="card-head"><h2 class="display" id="mag-h">Today’s agenda</h2><span class="meta">' + D.doctors.length + ' doctors</span></div><div class="m-agenda" id="m-agenda">' + mobileDocs() + "</div></section>";
  }
  function overview() {
    var h = clinicParts(nowMs()).h;
    return statusBar() + head(greeting(h), "Today at the clinic · " + dateLabel,
      '<a class="btn" href="?screen=bookings">' + icon("search", "i-sm") + 'Find a booking</a><a class="btn btn-primary" href="?screen=bookings">' + icon("bookings", "i-sm") + "Open bookings</a>", "greeting") +
      kpis() + agendaDesktop() + '<div class="grid-2">' + nextUp() + statusMix() + "</div>" + agendaMobile();
  }

  /* ---------- Bookings ---------- */
  function quickAction(b) {
    if (b.status === "confirmed" && b.startMin - nowMin() <= 120) return '<button type="button" class="btn btn-sm">' + icon("arrived", "i-sm") + "Arrived</button>";
    if (b.status === "arrived") return '<button type="button" class="btn btn-sm">' + icon("completed", "i-sm") + "Complete</button>";
    return '<span class="muted" aria-label="No quick action">—</span>';
  }
  function chips() {
    var c = { all: D.bookings.length };
    D.bookings.forEach(function (b) { c[b.status] = (c[b.status] || 0) + 1; });
    var list = [["all", "All"], ["confirmed", "Confirmed"], ["arrived", "Arrived"], ["completed", "Completed"], ["no_show", "No-show"], ["cancelled", "Cancelled"]];
    return '<div class="chips" role="group" aria-label="Status">' + list.map(function (s) {
      return '<button type="button" class="chip" aria-pressed="' + (s[0] === "all") + '">' + (s[0] !== "all" ? icon(s[0], "i-sm") : "") + s[1] + ' <span class="c">' + (c[s[0]] || 0) + "</span></button>";
    }).join("") + "</div>";
  }
  var selected = upcoming()[0] || D.bookings[0];
  function tableRows() {
    return D.bookings.slice(0, 20).map(function (b) {
      var sel = state !== "list" && b === selected;
      return "<tr" + (sel ? ' class="sel"' : "") + '><td><span class="t">' + b.time + '</span></td><td class="pt"><button type="button" class="pt-open" data-ref="' + b.ref + '">' + esc(b.masked) + '</button><span class="sample">Sample</span><div class="muted" style="font-size:12.5px">' + b.phoneMasked + "</div></td><td>" + b.doctor.name +
        '<div class="muted" style="font-size:12.5px">' + b.doctor.dept + '</div></td><td><span class="ref">' + b.ref + "</span></td><td>" + pill(b.status) + "</td><td>" + quickAction(b) + "</td></tr>";
    }).join("");
  }
  function bookingsDesktop() {
    return '<section class="card d-only" aria-label="Bookings"><div class="filters">' +
      '<label class="field search">' + icon("search", "i-sm") + "<span>Search reference or patient name</span></label>" +
      '<div class="field">' + icon("bookings", "i-sm") + '<span class="val">Today, ' + today.d + " " + MONTHS[today.m - 1].slice(0, 3) + "</span>" + icon("chevDown", "i-sm chev") + "</div>" +
      '<div class="field"><span class="val">All doctors</span>' + icon("chevDown", "i-sm chev") + "</div>" +
      '<div class="field"><span class="val">All departments</span>' + icon("chevDown", "i-sm chev") + '</div></div><div class="chips-slot">' + chips() + "</div>" +
      '<table class="bk"><thead><tr><th scope="col">Time</th><th scope="col">Patient</th><th scope="col">Doctor</th><th scope="col">Reference</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Quick action</span></th></tr></thead><tbody id="bk-rows">' +
      tableRows() + "</tbody></table>" +
      '<div class="table-foot"><span id="bk-count">Showing 1–20 of ' + D.bookings.length + ' bookings</span><div class="pager"><button type="button" aria-current="page">1</button><button type="button">2</button><button type="button">3</button><button type="button" aria-label="Next page">' + icon("chevRight", "i-sm") + "</button></div></div></section>";
  }
  function cards() {
    return D.bookings.slice(0, 10).map(function (b) {
      var sel = state !== "list" && b === selected;
      return '<li><button type="button" class="bcard' + (sel ? " sel" : "") + '" data-ref="' + b.ref + '"><span class="t">' + b.time + "<small>" + b.endTime + "</small></span><b>" + esc(b.masked) + '</b><span class="sub">' + b.doctor.short + " · " + b.doctor.dept + "</span>" + pill(b.status) + '<span class="go">' + icon("chevRight", "i-sm") + "</span></button></li>";
    }).join("");
  }
  function bookingsMobile() {
    return '<div class="m-only"><div class="m-filters"><div class="row"><label class="field search">' + icon("search", "i-sm") + '<span>Reference or name</span></label><button type="button" class="btn" aria-label="Filters, 1 active">' + icon("sliders", "i-sm") + 'Today</button></div><div class="chips-slot">' + chips() + "</div></div>" +
      '<p class="count-line" id="m-count">' + D.bookings.length + " bookings today · all doctors</p>" +
      '<ul class="bcards" id="bcards">' + cards() + '</ul><button type="button" class="btn load-more">Show more · page 1 of ' + Math.ceil(D.bookings.length / 20) + "</button></div>";
  }
  function bookingsScreen() {
    return statusBar() + head("Bookings", "Today · " + D.bookings.length + " bookings · clinic time (Karachi)") +
      bookingsDesktop() + bookingsMobile();
  }

  /* ---------- Drawer and dialogs ---------- */
  function ageText(b) {
    var a = b.age < 1 ? "Under 1 year" : b.age + (b.age === 1 ? " year" : " years");
    return a + (b.bookedBy ? " · booked by " + b.bookedBy : "");
  }
  function historyHtml(b) {
    var rows = ['<li class="st-confirmed"><b>Confirmed</b><span>Booked online · ' + b.bookedAt + "</span></li>"];
    var arr = D.fmt(Math.max(b.startMin - 12, 0));
    if (b.status === "arrived" || b.status === "completed") rows.push('<li class="st-arrived"><b>Arrived</b><span>Today ' + arr + " · Sample Receptionist A</span></li>");
    if (b.status === "completed") rows.push('<li class="st-completed"><b>Completed</b><span>Today ' + b.endTime + " · Sample Receptionist A</span></li>");
    if (b.status === "no_show") rows.push('<li class="st-no_show"><b>No-show</b><span>Today ' + D.fmt(b.startMin + 25) + " · Sample Receptionist B</span></li>");
    if (b.status === "cancelled") rows.push('<li class="st-cancelled"><b>Cancelled</b><span>Phone request · Sample Receptionist A</span></li>');
    return rows.join("");
  }
  function nextStepHtml(b) {
    if (b.status === "confirmed") {
      return '<div class="lbl">Next step</div><div class="acts"><button type="button" class="btn btn-primary">' + icon("arrived", "i-sm") + 'Mark arrived</button><button type="button" class="btn">' + icon("cancelled", "i-sm") + "Cancel booking</button></div>" +
        '<div class="hint">' + icon("clock", "i-sm") + "Arrived can be marked from " + D.fmt(Math.max(b.startMin - 120, 0)) + ". No-show becomes available at " + b.time + ".</div>";
    }
    if (b.status === "arrived") {
      return '<div class="lbl">Next step</div><div class="acts"><button type="button" class="btn btn-primary">' + icon("completed", "i-sm") + 'Mark completed</button><button type="button" class="btn">' + icon("no_show", "i-sm") + "Mark no-show</button></div>";
    }
    return '<div class="lbl">Final status — no further steps.</div>';
  }
  function drawerHtml(b) {
    return '<div class="scrim" data-close aria-hidden="true"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-h">' +
      '<div class="dr-head"><div class="top"><span class="eyebrow">Booking ' + b.ref + "</span>" + '<button type="button" class="x" data-close aria-label="Close">' + icon("x") + "</button></div>" +
      '<h2 class="display" id="dr-h">' + esc(b.first + " " + b.last) + '</h2><div style="display:flex;gap:8px;align-items:center">' + pill(b.status) + '<span class="bk"><span class="sample" style="margin:0">Sample patient</span></span></div></div>' +
      '<div class="dr-body"><dl class="dl">' +
      "<dt>When</dt><dd><b>" + shortDate + " · " + b.time + "–" + b.endTime + '</b><div class="muted" style="font-size:12.5px">Clinic time (Karachi)</div></dd>' +
      "<dt>Doctor</dt><dd>" + b.doctor.name + '<div class="muted" style="font-size:12.5px">' + b.doctor.dept + "</div></dd>" +
      "<dt>Patient</dt><dd>" + ageText(b) + "</dd>" +
      '<dt>Phone</dt><dd><span class="reveal"><span class="num">' + b.phoneMasked + '</span><button type="button" class="btn btn-sm">' + icon("eye", "i-sm") + "Reveal</button></span></dd>" +
      "<dt>Email</dt><dd>" + b.emailMasked + "</dd>" +
      "<dt>Reason</dt><dd>" + b.reason + "</dd>" +
      '<dt>Fee</dt><dd class="num">PKR ' + b.fee.toLocaleString("en-GB") + "</dd>" +
      "<dt>Booked</dt><dd>" + b.bookedAt + " · website</dd></dl>" +
      '<div class="section-title">Status history</div><ol class="history">' + historyHtml(b) + "</ol></div>" +
      '<div class="dr-foot">' + nextStepHtml(b) +
      '<div class="hint">' + icon("shield", "i-sm") + "Every change and phone reveal is recorded in Activity.</div></div></aside>";
  }
  function confirmDialog(b) {
    return '<div class="scrim over" aria-hidden="true"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-d">' +
      '<div class="ic">' + icon("arrived") + '</div><h2 class="display" id="cf-h">Mark ' + esc(b.masked) + " as arrived for " + b.time + "?</h2>" +
      '<p id="cf-d">' + b.doctor.name + " · " + b.doctor.dept + ". You can undo this for 10 seconds.</p>" +
      '<div class="acts"><button type="button" class="btn">Not now</button><button type="button" class="btn btn-primary">' + icon("arrived", "i-sm") + "Mark arrived</button></div></div>";
  }
  function undoToast() {
    var b = D.bookings.filter(function (x) { return x.status === "arrived"; })[0];
    if (!b) return "";
    return '<div class="toast" role="status"><span>Marked <b>' + esc(b.masked) + '</b> as arrived.</span><button type="button" class="undo">Undo</button><span class="ring" aria-label="7 seconds left">7</span></div>';
  }

  var overlay, returnFocus = null;
  function openDrawer(b, from) {
    hideTip();
    returnFocus = from || null;
    overlay.innerHTML = drawerHtml(b);
    var x = overlay.querySelector(".x");
    if (x) x.focus();
  }
  function closeDrawer() {
    overlay.innerHTML = "";
    if (returnFocus && document.body.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  /* ---------- New-booking toasts ---------- */
  function showNewBooking(b) {
    var host = document.getElementById("toasts");
    while (host.children.length >= 3) host.removeChild(host.firstChild);
    var t = document.createElement("div");
    t.className = "nb-toast";
    t.innerHTML = '<span class="nb-ic">' + icon("calPlus") + '</span><div class="nb-body"><div class="nb-eyebrow">New booking</div>' +
      "<div><b>" + esc(b.masked) + "</b> with " + b.doctor.short + '</div><div class="nb-sub">' + b.doctor.dept + " · today " + b.time + " · booked just now</div>" +
      '<button type="button" class="btn btn-sm nb-view">View booking</button></div>' +
      '<div class="nb-acts"><button type="button" class="nb-x" aria-label="Dismiss notification">' + icon("x", "i-sm") + "</button></div>" +
      '<span class="nb-progress" aria-hidden="true"></span>';
    host.appendChild(t);
    var left = 8000, last = Date.now(), paused = false, timer;
    function close() { clearInterval(timer); t.classList.add("leaving"); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reduceMotion.matches ? 0 : 250); }
    timer = setInterval(function () {
      var n = Date.now();
      if (!paused) left -= n - last;
      last = n;
      if (left <= 0) close();
    }, 250);
    t.addEventListener("mouseenter", function () { paused = true; t.classList.add("paused"); });
    t.addEventListener("mouseleave", function () { paused = t.contains(document.activeElement); t.classList.toggle("paused", paused); });
    t.addEventListener("focusin", function () { paused = true; t.classList.add("paused"); });
    t.addEventListener("focusout", function () { paused = false; t.classList.remove("paused"); });
    t.querySelector(".nb-x").addEventListener("click", close);
    t.querySelector(".nb-view").addEventListener("click", function () { close(); openDrawer(b, null); });
  }

  /* ---------- Live updates ---------- */
  var lastUpdated = nowMs(), seenVersion = D.version, lastMinute = nowMin();
  function swap(id, html) {
    var el = document.getElementById(id);
    if (!el) return;
    var a = document.activeElement, ref = a && el.contains(a) ? a.dataset.ref : null;
    var openIds = id === "m-agenda" ? Array.prototype.map.call(el.querySelectorAll("details[open]"), function (d) { return d.dataset.doc; }) : null;
    el.innerHTML = typeof html === "function" ? html(openIds) : html;
    if (ref) { var again = el.querySelector('[data-ref="' + ref + '"]'); if (again) again.focus(); }
  }
  function rerenderLists() {
    swap("tl-rows", agendaRows);
    swap("ag-meta", agendaMeta());
    swap("next-up", nextUpList());
    swap("mix", mixInner());
    swap("mx-meta", D.bookings.length + " bookings");
    swap("m-agenda", mobileDocs);
    swap("bk-rows", tableRows());
    swap("bcards", cards());
    Array.prototype.forEach.call(document.querySelectorAll(".chips-slot"), function (s) { s.innerHTML = chips(); });
    swap("bk-count", "Showing 1–20 of " + D.bookings.length + " bookings");
    swap("m-count", D.bookings.length + " bookings today · all doctors");
    if (screen === "bookings") swap("page-sub", "Today · " + D.bookings.length + " bookings · clinic time (Karachi)");
  }
  function refresh() {
    // Demo: recompute from the in-memory day. Real mode: GET /admin/overview every 30 s (research R19).
    updateKpis();
    if (D.version !== seenVersion) { seenVersion = D.version; rerenderLists(); }
    lastUpdated = nowMs();
    tick();
  }
  function tick() {
    var clock = document.getElementById("clock");
    if (clock) clock.textContent = clockFmt.format(new Date(nowMs()));
    var s = Math.floor((nowMs() - lastUpdated) / 1000);
    var up = document.getElementById("updated");
    if (up) up.innerHTML = '<span class="upd-word">updated </span>' + (s < 10 ? "just now" : s < 60 ? Math.floor(s / 5) * 5 + " s ago" : Math.floor(s / 60) + " min ago");
    var m = nowMin();
    if (m !== lastMinute) { lastMinute = m; onMinute(); }
  }
  function onMinute() {
    var p = clinicParts(nowMs());
    if (p.y !== today.y || p.m !== today.m || p.d !== today.d) { location.reload(); return; } // new clinic day
    moveNow();
    swap("next-up", nextUpList());
    swap("m-agenda", mobileDocs);
    var g = document.getElementById("greeting");
    if (g) g.textContent = greeting(p.h);
  }
  function simulate() {
    var b = D.simulateBooking(nowMin());
    if (!b) return null;
    refresh();
    showNewBooking(b);
    setTimeout(function () {
      b.isNew = false;
      Array.prototype.forEach.call(document.querySelectorAll('[data-ref="' + b.ref + '"]'), function (el) { el.classList.remove("is-new"); });
    }, 10000);
    return b;
  }

  /* ---------- Mount ---------- */
  document.title = (screen === "overview" ? "Overview" : "Bookings") + " · Command Centre preview";
  document.getElementById("app").innerHTML =
    '<div class="shell">' + sidebar() + '<div class="main">' + mobileTop() + ribbon() +
    '<main class="content">' + (screen === "overview" ? overview() : bookingsScreen()) + "</main>" + footer() + "</div></div>" + bottomNav() +
    '<div id="overlay"></div><div class="toasts" id="toasts" aria-live="polite" aria-label="Notifications"></div>' +
    (screen === "bookings" && state === "list" ? undoToast() : "");
  overlay = document.getElementById("overlay");
  applyTheme();
  moveNow();
  updateKpis();
  if (state !== "list") overlay.innerHTML = drawerHtml(selected) + (state === "confirm" ? confirmDialog(selected) : "");

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    var pref = t.closest("[data-theme-pref]");
    if (pref) { setTheme(pref.dataset.themePref); return; }
    if (t.closest("#m-theme")) { setTheme(PREFS[(PREFS.indexOf(themePref) + 1) % 3]); return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
    var opener = t.closest(".tl-b, .m-row, .bcard, .pt-open");
    if (opener && opener.dataset.ref) { var b = byRef(opener.dataset.ref); if (b) openDrawer(b, opener); }
  });
  var tlEl = document.getElementById("tl");
  if (tlEl) {
    tlEl.addEventListener("mouseover", function (e) { var c = e.target.closest(".tl-b"); if (c) showTip(c); else if (e.target.closest(".tl-tip")) clearTimeout(tipHide); });
    tlEl.addEventListener("mouseout", function (e) { if (e.target.closest(".tl-b, .tl-tip")) hideTip(150); });
    tlEl.addEventListener("focusin", function (e) { var c = e.target.closest(".tl-b"); if (c) showTip(c); });
    tlEl.addEventListener("focusout", function () { hideTip(0); });
    tlEl.addEventListener("pointerdown", function (e) { var c = e.target.closest(".tl-b"); if (c) showTip(c); });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var tip = document.getElementById("tl-tip");
      if (tip && !tip.hidden) { hideTip(0); return; }
      if (overlay.querySelector(".drawer")) closeDrawer();
    }
    if (e.key === "Tab" && overlay.querySelector(".drawer")) { // keep focus inside the open drawer
      var f = overlay.querySelectorAll("button, a[href]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      else if (!overlay.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    }
  });

  setInterval(tick, 1000);
  setInterval(refresh, REFRESH_MS);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  setTimeout(function loop() { simulate(); setTimeout(loop, SIM_EVERY_MS); }, SIM_FIRST_MS);

  // Hooks for the screenshot script (capture.mjs).
  window.__preview = { simulate: simulate, refresh: refresh, open: function (ref) { var b = byRef(ref) || selected; openDrawer(b, null); return b.ref; } };
})();
