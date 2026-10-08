/* Design-preview fixture. Synthetic sample data only (FR-038).
   Deterministic: same Karachi date -> same clinic day, so screenshots are stable.
   Statuses are derived from the clinic-time "now" passed in by render.js.
   Patients fit the department: Gynecology = women, Pediatrics = children (booked by a parent). */
(function () {
  "use strict";

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Public sample doctors from the catalog (labelled Sample on the website).
  var DOCTORS = [
    { id: "hm", name: "Dr. Hassan Mirza", short: "Dr. Mirza", dept: "General Medicine", fee: 2000, start: "09:00", end: "13:00" },
    { id: "iq", name: "Dr. Imran Qureshi", short: "Dr. Qureshi", dept: "Cardiology", fee: 4000, start: "10:00", end: "14:00" },
    { id: "sf", name: "Dr. Sana Farooqui", short: "Dr. Farooqui", dept: "Pediatrics", fee: 2500, start: "09:00", end: "12:00" },
    { id: "ar", name: "Dr. Ayesha Rahman", short: "Dr. Rahman", dept: "Gynecology", fee: 3500, start: "11:00", end: "15:00" },
    { id: "ba", name: "Dr. Bilal Ansari", short: "Dr. Ansari", dept: "Dental", fee: 3000, start: "14:00", end: "18:00" },
    { id: "os", name: "Dr. Omar Sheikh", short: "Dr. Sheikh", dept: "General Medicine", fee: 2000, start: "16:00", end: "20:00" }
  ];

  var WOMEN = ["Ayesha", "Fatima", "Hira", "Zara", "Sadia", "Mahnoor", "Nimra", "Amna", "Iqra", "Rabia",
    "Maryam", "Khadija", "Saba", "Mehwish", "Noor", "Areeba", "Javeria", "Sana"];
  var MEN = ["Bilal", "Usman", "Ahmed", "Kamran", "Hamza", "Faraz", "Saad", "Danish", "Talha", "Yasir",
    "Ali", "Junaid", "Fahad", "Waqas", "Zubair", "Asad"];
  var GIRLS = ["Inaya", "Hoorain", "Anaya", "Eshal", "Haniya", "Alishba", "Zoya", "Fiza", "Minahil", "Aiza"];
  var BOYS = ["Ayaan", "Zayan", "Rayyan", "Musa", "Arham", "Ibrahim", "Abdullah", "Hadi", "Shayan", "Azlan"];
  var LAST = ["Khan", "Siddiqui", "Tariq", "Shah", "Raza", "Hussain", "Malik", "Iqbal", "Javed", "Aslam",
    "Butt", "Rehman", "Nadeem", "Akhtar", "Anwar", "Latif", "Baig", "Zaidi"];

  // Who each department sees, and why they come.
  var PROFILE = {
    "General Medicine": { who: "adult", age: [18, 70], reasons: ["Fever and cough", "Blood pressure review", "Follow-up visit", "Routine check-up", "Prescription renewal", "Skin rash", "Annual review"] },
    "Cardiology": { who: "adult", age: [38, 78], reasons: ["Chest discomfort", "ECG review", "Blood pressure review", "Palpitations", "Follow-up after echo"] },
    "Pediatrics": { who: "child", age: [0, 12], reasons: ["Vaccination", "Fever", "Growth check", "Ear pain", "Well-child check-up", "Cough and cold"] },
    "Gynecology": { who: "woman", age: [21, 46], reasons: ["Antenatal check-up", "Ultrasound review", "Follow-up visit", "Annual check-up", "Menstrual concerns"] },
    "Dental": { who: "adult", age: [16, 72], reasons: ["Tooth pain", "Scale and polish", "Filling", "Dental check-up", "Braces review"] }
  };
  var CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var SLOT_MIN = 20;

  function toMin(hhmm) { var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
  function fmt(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function pick(rnd, list) { return list[Math.floor(rnd() * list.length)]; }

  function makePatient(rnd, dept) {
    var p = PROFILE[dept];
    var age = p.age[0] + Math.floor(rnd() * (p.age[1] - p.age[0] + 1));
    var female = p.who === "woman" ? true : rnd() < 0.5;
    var first = p.who === "child" ? pick(rnd, female ? GIRLS : BOYS) : pick(rnd, female ? WOMEN : MEN);
    var last = pick(rnd, LAST);
    var bookedBy = p.who === "child" ? (rnd() < 0.7 ? "mother" : "father") : null;
    var contact = bookedBy ? pick(rnd, bookedBy === "mother" ? WOMEN : MEN) : first; // the email belongs to whoever booked
    return {
      first: first, last: last, age: age, female: female, bookedBy: bookedBy,
      masked: first + " " + last[0] + ".",
      initials: first[0] + "." + last[0] + ".",
      emailMasked: contact[0].toLowerCase() + "****@example.com",
      reason: pick(rnd, p.reasons)
    };
  }

  function makeBooking(rnd, d, t, status, bookedAt) {
    var pt = makePatient(rnd, d.dept);
    var ref = "D";
    for (var i = 0; i < 9; i++) ref += CROCKFORD[Math.floor(rnd() * 32)];
    var phone = "03" + Math.floor(rnd() * 5) + Math.floor(rnd() * 10);
    var tail = String(100 + Math.floor(rnd() * 900));
    var b = {
      ref: ref, doctor: d, startMin: t, time: fmt(t), endTime: fmt(t + SLOT_MIN), status: status,
      phoneMasked: phone + "****" + tail,
      fee: d.fee,
      bookedAt: bookedAt
    };
    for (var k in pt) b[k] = pt[k];
    return b;
  }

  function sortBookings(list) {
    list.sort(function (a, b) { return a.startMin - b.startMin || a.doctor.name.localeCompare(b.doctor.name); });
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function generateDay(seed, nowMin, day) {
    var rnd = mulberry32(seed);
    var bookings = [], totalSlots = 0;
    DOCTORS.forEach(function (d) {
      for (var t = toMin(d.start); t + SLOT_MIN <= toMin(d.end); t += SLOT_MIN) {
        totalSlots++;
        if (rnd() > 0.84) continue; // free slot
        var r = rnd(), status;
        if (r < 0.06) status = "cancelled";
        else if (t + SLOT_MIN <= nowMin) status = rnd() < 0.09 ? "no_show" : (t + SLOT_MIN > nowMin - 30 && rnd() < 0.5 ? "arrived" : "completed");
        else if (t <= nowMin) status = "arrived";
        else if (t - nowMin <= 120 && rnd() < 0.35) status = "arrived";
        else status = "confirmed";
        var bd = new Date(Date.UTC(day.y, day.m - 1, day.d - 1 - Math.floor(rnd() * 4)));
        var bookedAt = bd.getUTCDate() + " " + MONTHS[bd.getUTCMonth()] + " " + bd.getUTCFullYear() + ", " + fmt(8 * 60 + Math.floor(rnd() * 13 * 60));
        bookings.push(makeBooking(rnd, d, t, status, bookedAt));
      }
    });
    sortBookings(bookings);
    return { bookings: bookings, totalSlots: totalSlots };
  }

  function kpis(bookings, totalSlots) {
    var c = { appointments: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
    bookings.forEach(function (b) {
      if (b.status !== "cancelled") c.appointments++;
      if (b.status === "arrived") c.arrived++;
      if (b.status === "completed") c.completed++;
      if (b.status === "no_show") c.no_show++;
      if (b.status === "cancelled") c.cancelled++;
    });
    c.utilisation = totalSlots ? Math.round((c.appointments / totalSlots) * 100) : null;
    return c;
  }

  /* date: { y, m, d } in clinic time; nowMin: minutes since clinic midnight. */
  function build(date, nowMin) {
    var key = date.y * 10000 + date.m * 100 + date.d;
    var today = generateDay(key, nowMin, date);
    var lw = new Date(Date.UTC(date.y, date.m - 1, date.d - 7));
    var lwDate = { y: lw.getUTCFullYear(), m: lw.getUTCMonth() + 1, d: lw.getUTCDate() };
    // "Same weekday last week" at the same clock time, for honest computed trends.
    var lastWeek = generateDay(lwDate.y * 10000 + lwDate.m * 100 + lwDate.d, nowMin, lwDate);
    var simRnd = mulberry32(key ^ 0x5eed);

    var data = {
      nowMin: nowMin,
      slotMin: SLOT_MIN,
      doctors: DOCTORS,
      bookings: today.bookings,
      totalSlots: today.totalSlots,
      kpiLastWeek: kpis(lastWeek.bookings, lastWeek.totalSlots),
      version: 0,
      fmt: fmt,
      toMin: toMin,
      kpi: function () { return kpis(data.bookings, data.totalSlots); },
      /* Demo only: a new online booking lands in a free future slot. Returns null when the day is full. */
      simulateBooking: function (atMin) {
        var free = [];
        DOCTORS.forEach(function (d) {
          for (var t = toMin(d.start); t + SLOT_MIN <= toMin(d.end); t += SLOT_MIN) {
            if (t <= atMin + 30) continue;
            var taken = data.bookings.some(function (b) { return b.doctor === d && b.startMin === t; });
            if (!taken) free.push([d, t]);
          }
        });
        if (!free.length) return null;
        var slot = free[Math.floor(simRnd() * free.length)];
        var b = makeBooking(simRnd, slot[0], slot[1], "confirmed", "Just now");
        b.isNew = true;
        data.bookings.push(b);
        sortBookings(data.bookings);
        data.version++;
        return b;
      }
    };
    return data;
  }

  window.PREVIEW_DATA = { build: build, doctors: DOCTORS };
})();
