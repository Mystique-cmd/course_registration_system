const $ = (sel) => document.querySelector(sel);

const API_BASE = (window.__API_BASE__ || '').trim() || 'http://localhost:3000';

function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  });
}


function getPage() {
  const main = $('main.app');
  return main?.dataset?.page || 'index';
}

function getAdminMode() {
  // Backend decides admin-gated analytics; this helper is no longer used for auth.
  // Keep returning false by default.
  return false;
}



// localStorage-based persistence removed; backend is now source of truth.





function normalize(s) {
  return String(s || '').trim();
}

function migrateUserModel(user) {
  const migrated = { ...user };

  const courseCatalog = {
    'Computer Science': { code: 'CS 101', title: 'Intro to Programming', instructor: 'Dr. A. Mwangi', schedule: 'Mon/Wed 10:00-11:30', location: 'Room C-201', testDateOffsetDays: 4 },
    'Data Structures': { code: 'CS 201', title: 'Data Structures', instructor: 'Prof. J. Otieno', schedule: 'Tue/Thu 09:00-10:30', location: 'Room B-104', testDateOffsetDays: 10 },
    'Advanced React Patterns': { code: 'CS 305', title: 'Advanced React Patterns', instructor: 'Dr. S. Njoroge', schedule: 'Wed 13:00-15:00', location: 'Lab 3', testDateOffsetDays: 18 },
    'Business Administration': { code: 'BIT 210', title: 'Business & Technology', instructor: 'Prof. K. Wambui', schedule: 'Mon 15:00-17:00', location: 'Room D-110', testDateOffsetDays: 25 },
    'Engineering Fundamentals': { code: 'ENG 110', title: 'Engineering Fundamentals', instructor: 'Dr. P. Kimani', schedule: 'Fri 09:00-12:00', location: 'Room E-205', testDateOffsetDays: 8 },
  };

  migrated.program = migrated.program || 'BSc Computer Science';
  migrated.creditsRequired = Number(migrated.creditsRequired || 120);
  migrated.creditsEarned = Number(migrated.creditsEarned || 0);

  const regs = migrated.registrations || [];
  // If creditsEarned is not set meaningfully, approximate from number of registrations.
  if (!migrated.creditsEarned || migrated.creditsEarned === 0) {
    migrated.creditsEarned = regs.length * 3; // simple approximation
  }

  // Seed registered course details for dashboard.
  if (!migrated.registeredCourses || !Array.isArray(migrated.registeredCourses)) {
    migrated.registeredCourses = regs.map((r, idx) => {
      const c = courseCatalog[r.courseName] || {
        code: 'TBA',
        title: r.courseName,
        instructor: 'TBA',
        schedule: 'TBA',
        location: 'TBA',
        testDateOffsetDays: 14 + idx * 7,
      };

      return {
        courseName: r.courseName,
        courseCode: c.code,
        title: c.title,
        instructor: c.instructor,
        schedule: c.schedule,
        location: c.location,
        testDate: nextTestDateISO(c.testDateOffsetDays),
        kcseGrade: r.kcseGrade,
      };
    });
  }

  if (!migrated.pendingTasks || !Array.isArray(migrated.pendingTasks)) {
    migrated.pendingTasks = [
      { id: 't1', title: 'Review lecture notes (1–2 hrs)', dueInDays: 2 },
      { id: 't2', title: 'Practice past questions (45 min)', dueInDays: 4 },
      { id: 't3', title: 'Summarize key concepts (30 min)', dueInDays: 6 },
    ];
  }

  if (!migrated.waitlist || !Array.isArray(migrated.waitlist)) {
    migrated.waitlist = [
      { position: 1, probability: 0.78, courseName: 'Data Structures' },
      { position: 2, probability: 0.52, courseName: 'Computer Science' },
    ];
  }

  if (!migrated.notifications || !Array.isArray(migrated.notifications)) {
    migrated.notifications = [
      { id: 'n1', type: 'course', message: 'Your course schedule has been updated.', date: new Date().toISOString() },
      { id: 'n2', type: 'payment', message: 'Payment reminder: ensure tuition is up to date.', date: new Date().toISOString() },
    ];
  }

  return migrated;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function nextTestDateISO(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function setText(el, txt) {
  if (el) el.textContent = txt;
}

function fmtPct(p) {
  const n = Number(p);
  if (Number.isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s) {
  const str = String(s || '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getDepartmentForCourseName(courseName) {
  const catalog = getCourseCatalogData();
  const item = catalog.find((c) => c.title === courseName || c.courseCode === courseName || c.department === courseName || c.title === courseName || c.courseName === courseName);
  if (item) return item.department;

  // Fallback heuristics
  if (/react|computer|data structures|programming|program/i.test(courseName)) return 'Computer Science';
  if (/it\b|fundamentals/i.test(courseName)) return 'IT';
  if (/business/i.test(courseName)) return 'Business IT';
  if (/eng|engineering/i.test(courseName)) return 'Engineering';
  return 'Other';
}

function buildAdminAnalyticsData() {
  // Client-side fallback removed for backend-first architecture.
  // Admin data must be provided by GET /api/admin/analytics.
  return window.__adminAnalyticsData || {
    studentCount: 0,
    activeCourses: 0,
    newRegistrations: 0,
    pctChange: 0,
    deptPctArr: [],
    deptColors: [],
    weeklySeries: [0, 0, 0, 0, 0, 0, 0],
    monthlySeries: new Array(12).fill(0),
    activities: [],
  };
}



function collectAdminAnalyticsPayload() {
  const data = buildAdminAnalyticsData();
  return {
    generatedAt: new Date().toISOString(),
    ...data,
  };
}


function generateDownloadFile(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function drawLineChart(ctx, values, labels, color) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.clearRect(0, 0, w, h);

  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 28;

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);

  const xFor = (i) => padL + (plotW * (values.length === 1 ? 0 : i / (values.length - 1)));
  const yFor = (v) => {
    const t = (v - minV) / Math.max(1e-9, (maxV - minV));
    return padT + plotH * (1 - t);
  };

  // grid
  ctx.strokeStyle = 'rgba(190,160,255,.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = 'rgba(190,160,255,.35)';
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, h - padB);
  ctx.lineTo(w - padR, h - padB);
  ctx.stroke();

  // line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = color;
  values.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // labels (sparse)
  ctx.fillStyle = 'rgba(169,169,214,.95)';
  ctx.font = '700 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  const step = values.length > 10 ? Math.ceil(values.length / 6) : 1;
  for (let i = 0; i < values.length; i += step) {
    const x = xFor(i);
    const label = labels[i] ?? '';
    ctx.fillText(label, x - 10, h - 10);
  }
}

function drawDonutChart(ctx, pctArr, colors) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;
  const inner = r * 0.62;

  let start = -Math.PI / 2;
  const total = pctArr.reduce((s, d) => s + d.pct, 0) || 1;

  pctArr.forEach((d, idx) => {
    const frac = d.pct / total;
    const end = start + frac * Math.PI * 2;
    const color = colors[idx % colors.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // cut inner
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, inner, start, end);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    start = end;
  });

  // center label
  ctx.fillStyle = 'rgba(233,233,255,.95)';
  ctx.font = '900 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('100%', cx, cy + 5);
  ctx.textAlign = 'start';
}

function renderAdminTrendsChart(mode) {
  const data = window.__adminAnalyticsData || buildAdminAnalyticsData();
  const canvas = $('#trend-chart');
  if (!canvas) return;

  // set internal resolution to avoid blurry charts
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor((rect.width || 560) * dpr);
  canvas.height = Math.floor((rect.height || 220) * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const color = 'rgba(139,92,246,.95)';

  if (mode === 'monthly') {
    const values = data.monthlySeries;
    const labels = values.map((_, i) => `M${i + 1}`);
    drawLineChart(ctx, values, labels, color);
  } else {
    const values = data.weeklySeries;
    const labels = values.map((_, i) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] || `D${i + 1}`);
    drawLineChart(ctx, values, labels, color);
  }

  const legend = $('#trend-legend');
  if (legend) {
    legend.textContent = mode === 'monthly' ? 'Trend: registrations per month (demo)' : 'Trend: registrations per week (demo)';
  }
}

function renderAdminDashboard({ isAdmin }) {
  const data = buildAdminAnalyticsData();
  window.__adminAnalyticsData = data;

  $('#a-total-students') && ($('#a-total-students').textContent = String(data.studentCount));
  $('#a-active-courses') && ($('#a-active-courses').textContent = String(data.activeCourses));
  $('#a-new-registrations') && ($('#a-new-registrations').textContent = String(data.newRegistrations));

  const pctEl = $('#a-new-registrations-pct');
  if (pctEl) {
    const delta = data.pctChange;
    const label = Number.isFinite(delta) ? (delta >= 0 ? `+${Math.round(delta * 100)}%` : `${Math.round(delta * 100)}%`) : '—';
    pctEl.textContent = label;
  }

  // Department distribution
  const deptCanvas = $('#dept-chart');
  if (deptCanvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = deptCanvas.getBoundingClientRect();
    deptCanvas.width = Math.floor((rect.width || 220) * dpr);
    deptCanvas.height = Math.floor((rect.height || 220) * dpr);

    const ctx = deptCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawDonutChart(ctx, data.deptPctArr.slice(0, 6), data.deptColors);
  }

  const deptList = $('#dept-list');
  if (deptList) {
    const items = data.deptPctArr.slice(0, 6);
    if (!items.length) {
      deptList.innerHTML = `<div class="muted small">No department breakdown available.</div>`;
    } else {
      deptList.innerHTML = '';
      items.forEach((d, i) => {
        const color = data.deptColors[i % data.deptColors.length];
        const pct = Math.round(d.pct * 100);
        const row = document.createElement('div');
        row.className = 'dept-item';
        row.innerHTML = `
          <div class="dept-left">
            <span class="dept-swatch" style="background:${color};"></span>
            <span class="dept-name">${escapeHtml(d.dept)}</span>
          </div>
          <span class="dept-pct">${pct}%</span>
        `;
        deptList.appendChild(row);
      });
    }
  }

  // Activities feed
  const feed = $('#activities-feed');
  const empty = $('#activities-empty');
  if (feed) {
    const acts = (data.activities || []).slice(0, 8);
    feed.innerHTML = '';
    if (!acts.length) {
      empty && (empty.style.display = 'block');
    } else {
      empty && (empty.style.display = 'none');
      acts.forEach((a) => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        const typeLabel = a.kind === 'enrollment' ? 'Enrollment' : a.kind === 'update' ? 'Update' : 'Payment';
        item.innerHTML = `
          <div class="activity-main">
            <div class="activity-title">${typeLabel} • ${escapeHtml(a.courseName)}</div>
            <div class="activity-sub">${escapeHtml(a.detail)}</div>
          </div>
          <div class="activity-date">${escapeHtml(formatDateShort(a.when))}</div>
        `;
        feed.appendChild(item);
      });
    }
  }

  // Render initial trends
  renderAdminTrendsChart('weekly');

  const updatedEl = $('#activities-updated');
  if (updatedEl) {
    updatedEl.textContent = `Updated ${formatDateShort(new Date().toISOString())}`;
  }
}


function renderDashboard(student) {
  const dashGreeting = $('#dash-greeting');

  // Weekly Schedule (optional - dashboard-only)
  renderWeeklySchedule(student);
  renderUpcomingTests(student);
  renderPendingTasks(student);
  renderStudySuggestion(student);

  const dashProgram = $('#dash-program');
  const earnedEl = $('#progress-earned');
  const requiredEl = $('#progress-required');
  const fillEl = $('#progress-fill');
  const progressBar = $('.progress-bar[role="progressbar"]');

  setText(dashGreeting, `Hello, ${student.studentName || 'Student'}!`);
  setText(dashProgram, student.program || 'Program');

  const earned = Number(student.creditsEarned || 0);
  const required = Number(student.creditsRequired || 0);
  const pct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;

  setText(earnedEl, earned);
  setText(requiredEl, required);
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (progressBar) {
    progressBar.setAttribute('aria-valuenow', String(pct));
    progressBar.setAttribute('aria-valuemax', String(100));
  }

  // Courses table
  const coursesTable = $('#courses-dashboard-list');
  if (coursesTable) {
    coursesTable.innerHTML = '';
    const courses = student.registeredCourses || [];
    if (courses.length === 0) {
      coursesTable.innerHTML = `
        <div class="trow" role="row">
          <div role="cell" class="td">No registered courses</div>
          <div role="cell" class="td">—</div>
          <div role="cell" class="td">—</div>
          <div role="cell" class="td">—</div>
        </div>
      `;
    } else {
      for (const c of courses) {
        const row = document.createElement('div');
        row.className = 'trow';
        row.setAttribute('role', 'row');
        row.innerHTML = `
          <div role="cell" class="td td-strong">
            <span class="course-code-badge" style="font-size:11px; background:rgba(167,139,250,0.15); color:rgba(167,139,250,0.95); padding:2px 6px; border-radius:4px; margin-right:6px; font-weight:800;">${escapeHtml(c.courseCode || 'TBA')}</span>
            ${escapeHtml(c.courseName)}
          </div>
          <div role="cell" class="td">${escapeHtml(c.instructor || 'TBA')}</div>
          <div role="cell" class="td">${escapeHtml(c.schedule || 'TBA')}</div>
          <div role="cell" class="td">${escapeHtml(c.location || 'TBA')}</div>
          <div role="cell" class="td" style="display:flex; align-items:center;">
            <button class="btn btn-danger btn-drop" style="margin:0; padding:6px 10px; font-size:11px; border-radius:8px; width:auto;" data-code="${escapeHtml(c.courseCode)}">Drop</button>
          </div>
        `;

        const dropBtn = row.querySelector('.btn-drop');
        if (dropBtn) {
          dropBtn.addEventListener('click', async () => {
            const confirmDrop = confirm(`Are you sure you want to drop "${c.courseName}"?`);
            if (!confirmDrop) return;

            try {
              await apiFetch('/api/registrations/drop', {
                method: 'POST',
                body: JSON.stringify({ courseCode: c.courseCode }),
              });
              alert(`Successfully dropped ${c.courseName}!`);
              const updated = await apiFetch('/api/students/me');
              const migratedAfter = migrateUserModel({
                ...updated,
                registrations: (updated.registeredCourses || []).map((rc) => ({
                  courseName: rc.courseName,
                  kcseGrade: rc.kcseGrade,
                })),
                registeredCourses: updated.registeredCourses,
                waitlist: updated.waitlist,
                notifications: updated.notifications,
                creditsEarned: updated.creditsEarned,
                creditsRequired: updated.creditsRequired,
                studentName: updated.studentName,
                program: updated.program,
              });
              renderDashboard(migratedAfter);
            } catch (err) {
              alert(String(err?.message || 'Drop course failed.'));
            }
          });
        }

        coursesTable.appendChild(row);
      }
    }
  }

  // Waitlist
  const waitlistList = $('#waitlist-list');
  const waitlistEmpty = $('#waitlist-empty');
  const wl = student.waitlist || [];
  if (waitlistList) {
    waitlistList.innerHTML = '';
    if (wl.length === 0) {
      if (waitlistEmpty) waitlistEmpty.hidden = false;
    } else {
      if (waitlistEmpty) waitlistEmpty.hidden = true;
      for (const w of wl) {
        const item = document.createElement('div');
        item.className = 'list-item';
        const badgeClass = Number(w.probability) >= 0.7 ? 'badge-good' : Number(w.probability) >= 0.4 ? 'badge-mid' : 'badge-low';
        item.innerHTML = `
          <div class="list-item-main">
            <div class="list-item-title">#${escapeHtml(w.position)}</div>
            <div class="list-item-sub">${escapeHtml(w.courseName || 'Course')}</div>
          </div>
          <span class="badge ${badgeClass}">${fmtPct(w.probability)}</span>
        `;
        waitlistList.appendChild(item);
      }
    }
  }

  // Notifications
  const notifList = $('#notifications-list');
  const notifEmpty = $('#notifications-empty');
  const notifs = student.notifications || [];
  if (notifList) {
    notifList.innerHTML = '';
    if (notifs.length === 0) {
      if (notifEmpty) notifEmpty.hidden = false;
    } else {
      if (notifEmpty) notifEmpty.hidden = true;
      for (const n of notifs.slice(0, 6)) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(n.type || 'Update')}</div>
            <div class="list-item-sub">${escapeHtml(n.message || '')}</div>
          </div>
          <div class="muted small">${escapeHtml(formatDateShort(n.date))}</div>
        `;
        notifList.appendChild(item);
      }
    }
  }

  // Calendar
  renderCalendar(student);
}

function formatDateShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function parseScheduleString(scheduleStr) {
  // Examples: "Mon/Wed 10:00-11:30", "Tue/Thu 09:00-10:30", "Wed 13:00-15:00", "Fri 09:00-12:00"
  const s = String(scheduleStr || '').trim();
  if (!s || s === 'TBA') return [];

  const [daysPart, timePart] = s.split(' ');
  if (!daysPart || !timePart) return [];

  const dayTokens = daysPart.split('/').map((d) => d.trim().toLowerCase());
  const dayMap = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
  };

  const days = dayTokens.map((t) => dayMap[t]).filter(Boolean);

  const [startStr, endStr] = timePart.split('-');
  if (!startStr || !endStr) return [];

  const toMinutes = (hhmm) => {
    const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  };

  const startMin = toMinutes(startStr);
  const endMin = toMinutes(endStr);
  if (startMin == null || endMin == null) return [];

  return days.map((day) => ({ day, startMin, endMin }));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function minutesToTimeLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const WEEK_START_MIN = 8 * 60; // 8:00
const WEEK_END_MIN = 16 * 60; // 4:00
const SLOT_MIN = 30; // 30-minute rows
const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function timeToSlotIndex(min) {
  // returns 0..15 for [8:00..16:00) with 30 min slots
  return Math.floor((min - WEEK_START_MIN) / SLOT_MIN);
}

function renderWeeklySchedule(student) {
  const wrap = $('#weekly-schedule');
  if (!wrap) return;

  const courses = student.registeredCourses || [];

  // Build base grid
  wrap.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'weekly-grid';

  const timeHead = document.createElement('div');
  timeHead.className = 'weekly-time-head';
  timeHead.textContent = 'Time';
  grid.appendChild(timeHead);

  for (const d of DOW_ORDER) {
    const head = document.createElement('div');
    head.className = 'weekly-dow-head';
    head.textContent = d;
    grid.appendChild(head);
  }

  // 16 slots from 8:00 to 16:00 in 30-min increments
  for (let slot = 0; slot < 16; slot++) {
    const min = WEEK_START_MIN + slot * SLOT_MIN;

    const label = document.createElement('div');
    label.className = 'weekly-time-label';
    label.textContent = minutesToTimeLabel(min).replace(':00', ':00');
    grid.appendChild(label);

    for (let col = 0; col < DOW_ORDER.length; col++) {
      const cell = document.createElement('div');
      cell.className = 'weekly-cell';
      cell.dataset.day = DOW_ORDER[col];
      cell.dataset.slot = String(slot);
      grid.appendChild(cell);
    }
  }

  wrap.appendChild(grid);

  const colors = [
    { bg: 'rgba(167,139,250,.95)', border: 'rgba(167,139,250,.55)', fg: '#0b0b12' },
    { bg: 'rgba(134,239,172,.95)', border: 'rgba(134,239,172,.55)', fg: '#0b0b12' },
    { bg: 'rgba(253,224,71,.95)', border: 'rgba(253,224,71,.55)', fg: '#0b0b12' },
    { bg: 'rgba(251,113,133,.95)', border: 'rgba(251,113,133,.55)', fg: '#0b0b12' },
    { bg: 'rgba(96,165,250,.95)', border: 'rgba(96,165,250,.55)', fg: '#0b0b12' },
    { bg: 'rgba(45,212,191,.95)', border: 'rgba(45,212,191,.55)', fg: '#0b0b12' },
  ];

  const courseIndex = new Map();
  courses.forEach((c, i) => courseIndex.set(c.courseName + i, i));

  const slotHeightPx = null; // computed via layout

  // Position blocks by scanning the DOM for cell anchors
  const cellFor = (day, slot) => {
    const cell = grid.querySelector(`.weekly-cell[data-day="${day}"][data-slot="${slot}"]`);
    return cell;
  };

  courses.forEach((c, idx) => {
    const parsed = parseScheduleString(c.schedule);
    if (!parsed.length) return;

    const color = colors[idx % colors.length];

    parsed.forEach((p) => {
      if (!DOW_ORDER.includes(p.day)) return;

      const startClamped = clamp(p.startMin, WEEK_START_MIN, WEEK_END_MIN);
      const endClamped = clamp(p.endMin, WEEK_START_MIN, WEEK_END_MIN);
      if (endClamped <= startClamped) return;

      const startSlot = timeToSlotIndex(startClamped);
      const spanSlots = Math.max(1, Math.ceil((endClamped - startClamped) / SLOT_MIN));

      const firstCell = cellFor(p.day, startSlot);
      if (!firstCell) return;

      const cellRect = firstCell.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();

      const yTop = cellRect.top - gridRect.top;
      const blockHeight = cellRect.height * spanSlots;

      const block = document.createElement('div');
      block.className = 'course-block';
      block.setAttribute('role', 'group');
      block.setAttribute('aria-label', `${c.courseCode || c.courseName} schedule`);
      block.style.background = `linear-gradient(180deg, ${color.bg}, rgba(255,255,255,.35))`;
      block.style.borderColor = color.border;
      block.style.color = color.fg;

      block.style.top = `${yTop}px`;
      block.style.height = `${blockHeight}px`;

      const xLeft = (cellRect.left - gridRect.left) + 0;
      block.style.left = `${xLeft + 2}px`;

      block.innerHTML = `
        <strong>${escapeHtml(c.courseCode || 'Course')}</strong>
        <div class="cb-title">${escapeHtml(c.title || c.courseName || '')}</div>
        <div class="cb-meta">
          ${escapeHtml(c.instructor || '')}<br/>
          ${escapeHtml(c.location || '')}
        </div>
      `;

      block.style.position = 'absolute';

      // Ensure grid is positioned relative
      grid.style.position = 'relative';
      grid.appendChild(block);
    });
  });
}

function renderUpcomingTests(student) {
  const list = $('#tests-countdown-list');
  const empty = $('#tests-countdown-empty');
  if (!list) return;

  const items = (student.registeredCourses || []).filter((c) => c.testDate);

  // sort by date
  items.sort((a, b) => new Date(a.testDate) - new Date(b.testDate));
  const now = Date.now();

  list.innerHTML = '';

  if (items.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const upcoming = items.slice(0, 4);

  for (const c of upcoming) {
    const d = new Date(c.testDate);
    const diffMs = d.getTime() - now;
    if (!Number.isFinite(diffMs)) continue;

    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);

    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-main">
        <div class="list-item-title">${escapeHtml(c.courseCode || c.courseName || 'Test')}</div>
        <div class="list-item-sub">${escapeHtml(c.title || c.courseName || '')}</div>
      </div>
      <span class="badge badge-mid">${days > 0 ? `in ${days}d` : hours > 0 ? `in ${hours}h` : 'Soon'}</span>
    `;
    list.appendChild(item);
  }

  if (list.children.length === 0 && empty) empty.hidden = false;
}

function renderPendingTasks(student) {
  const list = $('#pending-tasks-list');
  const empty = $('#pending-tasks-empty');
  if (!list) return;

  const tasks = student.pendingTasks || [];
  list.innerHTML = '';

  if (tasks.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  for (const t of tasks.slice(0, 6)) {
    const dueLabel = typeof t.dueInDays === 'number'
      ? t.dueInDays === 0 ? 'Due today' : `Due in ${t.dueInDays}d`
      : 'Pending';

    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-main">
        <div class="list-item-title">${escapeHtml(t.title || 'Task')}</div>
        <div class="list-item-sub">${escapeHtml(dueLabel)}</div>
      </div>
      <span class="badge badge-low">Pending</span>
    `;
    list.appendChild(item);
  }
}

function renderStudySuggestion(student) {
  const body = $('#study-suggestion-body');
  const btn = $('#find-room-btn');
  const roomResult = $('#room-result');
  if (!body) return;

  const courses = student.registeredCourses || [];
  const busy = [];
  for (const c of courses) {
    const parsed = parseScheduleString(c.schedule);
    for (const p of parsed) busy.push({ day: p.day, startMin: p.startMin, endMin: p.endMin, course: c });
  }

  // naive: pick tomorrow gap on the schedule (Mon-Fri)
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const dayIndex = ((tomorrow.getDay() + 6) % 7); // Monday=0
  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][dayIndex] || 'Mon';

  const gaps = [{ start: WEEK_START_MIN, end: WEEK_END_MIN }];
  // subtract busy intervals
  const todaysBusy = busy.filter((b) => b.day === dayName).sort((a, b) => a.startMin - b.startMin);
  for (const b of todaysBusy) {
    const newGaps = [];
    for (const g of gaps) {
      if (b.endMin <= g.start || b.startMin >= g.end) {
        newGaps.push(g);
        continue;
      }
      if (b.startMin > g.start) newGaps.push({ start: g.start, end: b.startMin });
      if (b.endMin < g.end) newGaps.push({ start: b.endMin, end: g.end });
    }
    gaps.splice(0, gaps.length, ...newGaps);
  }

  const bestGap = gaps.find((g) => (g.end - g.start) >= 60) || gaps.find((g) => (g.end - g.start) >= 45);

  if (!bestGap) {
    body.textContent = 'No large study gaps found in your week. Consider reviewing a short topic bundle anytime between classes.';
  } else {
    const startLabel = minutesToTimeLabel(bestGap.start);
    const endLabel = minutesToTimeLabel(bestGap.start + 60 <= bestGap.end ? bestGap.start + 60 : bestGap.end);
    body.textContent = `Suggested study session: ${dayName} ${startLabel}–${endLabel} (60 min). Focus on your upcoming test topics.`;
  }

  if (btn && !renderStudySuggestion._bound) {
    renderStudySuggestion._bound = true;
    btn.addEventListener('click', () => {
      const latestRoom = (student.registeredCourses && student.registeredCourses[0]?.location) ? student.registeredCourses[0].location : 'Library Study Rooms';
      const line = 'Possible rooms:\n- ' + latestRoom + '\n- Main Library (quiet rooms)\n- Computer Lab (open study hours)';
      if (roomResult) {
        roomResult.style.display = 'block';
        roomResult.textContent = line;
      }
    });
  }
}

function renderCalendar(student) {
  const calEl = $('#calendar');
  if (!calEl) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-11

  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // make Monday=0

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const testDates = new Set((student.registeredCourses || []).map((c) => c.testDate).filter(Boolean));

  const header = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  calEl.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'cal-grid';

  for (const h of header) {
    const cell = document.createElement('div');
    cell.className = 'cal-dow';
    cell.textContent = h;
    grid.appendChild(cell);
  }

  // leading blanks
  for (let i = 0; i < startDay; i++) {
    const b = document.createElement('div');
    b.className = 'cal-cell cal-empty';
    grid.appendChild(b);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isTest = testDates.has(dIso);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell';
    cell.textContent = day;
    if (isTest) cell.classList.add('cal-test');

    // Highlight today
    const isToday = day === today.getDate();
    if (isToday) cell.classList.add('cal-today');

    cell.setAttribute('aria-label', isTest ? `Test on ${dIso}` : `Date ${dIso}`);
    grid.appendChild(cell);
  }

  calEl.appendChild(grid);
}

function renderCoursesFor(studentId) {
  const list = $('#courses-list');

  const sub = $('#courses-subhead');
  if (!list) return;

  const users = getUsers();
  const userRaw = users.find((u) => u.studentId === studentId);
  const user = userRaw ? migrateUserModel(userRaw) : null;
  list.innerHTML = '';


  if (!user || !user.registrations || user.registrations.length === 0) {
    sub.textContent = 'No courses registered yet.';
    list.innerHTML = `
      <div class="course-card">
        <div class="course-title">No records found</div>
        <div class="course-meta">Complete registration to see your courses.</div>
      </div>
    `;
    return;
  }

  sub.textContent = `Courses registered by Student #${studentId}`;

  // Dashboard uses richer course objects; keep legacy list behavior using registrations
  for (const r of user.registrations) {

    const card = document.createElement('div');
    card.className = 'course-card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="course-title">${escapeHtml(r.courseName)}</div>
      <div class="course-meta">
        <span>KCSE Mean: <strong>${escapeHtml(r.kcseGrade)}</strong></span>
      </div>
    `;
    list.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function getCourseCatalogData() {
  return [
    {
      courseCode: 'CS 101',
      title: 'Intro to Programming',
      instructor: 'Dr. A. Mwangi',
      enrollmentStatus: 'Open',
      seatsFilled: 38,
      seatsTotal: 50,
      waitlistCount: 0,
      waitlistPositionInfo: '',
      department: 'Computer Science',
      semester: 'Semester 1',
    },
    {
      courseCode: 'CS 201',
      title: 'Data Structures',
      instructor: 'Prof. J. Otieno',
      enrollmentStatus: 'Waitlist',
      seatsFilled: 60,
      seatsTotal: 60,
      waitlistCount: 17,
      waitlistPositionInfo: 'Positions 1–17 available',
      department: 'Computer Science',
      semester: 'Semester 1',
    },
    {
      courseCode: 'IT 120',
      title: 'IT Fundamentals',
      instructor: 'Dr. N. Wanjiku',
      enrollmentStatus: 'Open',
      seatsFilled: 24,
      seatsTotal: 40,
      waitlistCount: 0,
      waitlistPositionInfo: '',
      department: 'IT',
      semester: 'Semester 1',
    },
    {
      courseCode: 'BIT 210',
      title: 'Business & Technology',
      instructor: 'Prof. K. Wambui',
      enrollmentStatus: 'Open',
      seatsFilled: 29,
      seatsTotal: 45,
      waitlistCount: 0,
      waitlistPositionInfo: '',
      department: 'Business IT',
      semester: 'Semester 2',
    },
    {
      courseCode: 'CS 305',
      title: 'Advanced React Patterns',
      instructor: 'Dr. S. Njoroge',
      enrollmentStatus: 'Waitlist',
      seatsFilled: 55,
      seatsTotal: 55,
      waitlistCount: 9,
      waitlistPositionInfo: 'Positions 1–9 available',
      department: 'Computer Science',
      semester: 'Semester 2',
    },
    {
      courseCode: 'ENG 110',
      title: 'Engineering Fundamentals',
      instructor: 'Dr. P. Kimani',
      enrollmentStatus: 'Open',
      seatsFilled: 18,
      seatsTotal: 30,
      waitlistCount: 0,
      waitlistPositionInfo: '',
      department: 'Engineering',
      semester: 'Semester 2',
    },
  ];
}

function renderCatalogPills() {
  const depts = ['All', 'Computer Science', 'IT', 'Business IT', 'Engineering'];
  const semesters = ['All', 'Semester 1', 'Semester 2'];


  // ensure we only bind these once per page load
  if (renderCatalogPills._pillsBound) {
    return;
  }


  const deptWrap = $('#department-pills');
  const semWrap = $('#semester-pills');
  if (!deptWrap || !semWrap) return;

  deptWrap.innerHTML = '';
  semWrap.innerHTML = '';

  for (const d of depts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-pill';
    if (d === 'All') b.classList.add('is-active');
    b.dataset.dept = d;
    b.textContent = d;
    deptWrap.appendChild(b);
  }

  for (const s of semesters) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-pill';
    if (s === 'All') b.classList.add('is-active');
    b.dataset.sem = s;
    b.textContent = s;
    semWrap.appendChild(b);
  }

  // set defaults for pill clicks (event delegation)
  deptWrap.addEventListener('click', (e) => {

    const t = e.target.closest('.cat-pill');
    if (!t) return;
    [...deptWrap.querySelectorAll('.cat-pill')].forEach((x) => x.classList.remove('is-active'));
    t.classList.add('is-active');
    const sess = getSession();
    const users = getUsers();
    const raw = sess?.studentId ? users.find((u) => u.studentId === sess.studentId) : null;
    const student = raw ? migrateUserModel(raw) : null;
    renderCatalog(student);
  });

  semWrap.addEventListener('click', (e) => {
    const t = e.target.closest('.cat-pill');
    if (!t) return;
    [...semWrap.querySelectorAll('.cat-pill')].forEach((x) => x.classList.remove('is-active'));
    t.classList.add('is-active');
    const sess = getSession();
    const users = getUsers();
    const raw = sess?.studentId ? users.find((u) => u.studentId === sess.studentId) : null;
    const student = raw ? migrateUserModel(raw) : null;
    renderCatalog(student);
  });
}

function renderCatalog(student) {
  if (typeof window !== 'undefined' && window.__renderCatalogServer) {
    window.__renderCatalogServer();
    return;
  }
  const cards = $('#catalog-cards');
  const empty = $('#catalog-empty');
  const updatedEl = $('#catalog-updated');
  const creditsEl = $('#catalog-credits');

  if (!cards || !empty) return;

  const catalogUpdated = new Date().toISOString();
  if (updatedEl) updatedEl.textContent = formatDateShort(catalogUpdated);

  const currentCredits = Number(student?.creditsEarned || 0);
  if (creditsEl) creditsEl.textContent = String(currentCredits);

  const catalog = getCourseCatalogData();

  const selectedDept = $('#department-pills')?.querySelector('.cat-pill.is-active')?.dataset?.dept || 'All';
  const selectedSem = $('#semester-pills')?.querySelector('.cat-pill.is-active')?.dataset?.sem || 'All';

  const filterAvailable = $('#filter-available')?.checked;
  const filterWaitlist = $('#filter-waitlist')?.checked;

  const filtered = catalog
    .filter((c) => (selectedDept === 'All' ? true : c.department === selectedDept))
    .filter((c) => (selectedSem === 'All' ? true : c.semester === selectedSem))
    .filter((c) => {
      if (filterAvailable && filterWaitlist) return true;
      if (filterAvailable) return c.enrollmentStatus === 'Open';
      if (filterWaitlist) return c.enrollmentStatus === 'Waitlist';
      return true;
    });

  cards.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  for (const c of filtered) {
    const statusBadge = c.enrollmentStatus === 'Open'
      ? `<span class="badge-mini badge-available">${escapeHtml(c.enrollmentStatus)}</span>`
      : `<span class="badge-mini badge-wait">${escapeHtml(c.enrollmentStatus)}</span>`;

    const waitInfo = c.enrollmentStatus === 'Waitlist'
      ? `Waitlist: ${escapeHtml(c.waitlistPositionInfo || 'Join to view position')}`
      : `Seats filled: ${escapeHtml(String(c.seatsFilled))}/${escapeHtml(String(c.seatsTotal))}`;

    const card = document.createElement('div');
    card.className = 'course-catalog-card';
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <div class="course-catalog-top">
        <div>
          <div class="course-catalog-code">${escapeHtml(c.courseCode)}</div>
          <div class="course-catalog-title">${escapeHtml(c.title)}</div>
        </div>
        <div class="cat-badges">${statusBadge}</div>
      </div>

      <div class="course-catalog-meta">
        <div><strong>Instructor:</strong> ${escapeHtml(c.instructor)}</div>
        <div><strong>Semester:</strong> ${escapeHtml(c.semester)} • <strong>Dept:</strong> ${escapeHtml(c.department)}</div>
        <div><strong>Status:</strong> ${escapeHtml(c.enrollmentStatus)} • <strong>${escapeHtml(waitInfo)}</strong></div>
      </div>

      <div class="cat-badges" style="margin-top:12px;">
        <span class="badge-mini">Seats: ${escapeHtml(String(c.seatsFilled))}/${escapeHtml(String(c.seatsTotal))}</span>
        ${c.enrollmentStatus === 'Waitlist' ? `<span class="badge-mini">Waitlist: ${escapeHtml(String(c.waitlistCount || 0))}</span>` : ''}
      </div>
    `;

    cards.appendChild(card);
  }
}

function bindCatalogControls() {
  const avail = $('#filter-available');
  const wait = $('#filter-waitlist');
  const sort = $('#catalog-sort');
  const reset = $('#catalog-reset-btn');
  const back = $('#catalog-back-btn');

  // avoid rebinding on repeated catalog entry
  if (bindCatalogControls._bound) return;
  bindCatalogControls._bound = true;

  const refresh = () => {
    const sess = getSession();
    const users = getUsers();
    const raw = sess?.studentId ? users.find((u) => u.studentId === sess.studentId) : null;
    const student = raw ? migrateUserModel(raw) : null;
    renderCatalog(student);
  };

  avail?.addEventListener('change', refresh);
  wait?.addEventListener('change', refresh);
  sort?.addEventListener('change', refresh);

  reset?.addEventListener('click', () => {
    $('#filter-available') && ($('#filter-available').checked = false);
    $('#filter-waitlist') && ($('#filter-waitlist').checked = false);
    $('#catalog-sort') && ($('#catalog-sort').value = 'code');

    const deptWrap = $('#department-pills');
    const semWrap = $('#semester-pills');
    deptWrap?.querySelectorAll('.cat-pill').forEach((x) => x.classList.remove('is-active'));
    semWrap?.querySelectorAll('.cat-pill').forEach((x) => x.classList.remove('is-active'));
    deptWrap?.querySelector('.cat-pill[data-dept="All"]')?.classList.add('is-active');
    semWrap?.querySelector('.cat-pill[data-sem="All"]')?.classList.add('is-active');

    refresh();
  });

  back?.addEventListener('click', () => {
    showView('dashboard');
  });
}


// Init
(function init() {
  const page = getPage();

  // Shared: Login/Registration page
  if (page === 'login') {
    const registerInline = $('#register-inline');

    $('#create-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerInline) registerInline.hidden = false;
    });

    $('#view-login-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (registerInline) registerInline.hidden = true;
    });

    const loginMessageEl = $('#login-message');
    const loginForm = $('#login-form');

    loginForm?.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        if (loginMessageEl) loginMessageEl.hidden = true;
      });
    });

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = normalize(e.target.studentId.value);
      const password = normalize(e.target.password.value);

      if (!studentId || !password) {
        if (loginMessageEl) {
          loginMessageEl.textContent = 'Please enter both student ID and password.';
          loginMessageEl.className = 'form-message error-msg';
          loginMessageEl.hidden = false;
        }
        return;
      }

      try {
        await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ studentId, password }),
        });
        if (loginMessageEl) {
          loginMessageEl.textContent = 'Login successful! Redirecting to dashboard...';
          loginMessageEl.className = 'form-message success-msg';
          loginMessageEl.hidden = false;
        }
        setTimeout(() => {
          window.location.assign('dashboard.html');
        }, 1500);
      } catch (err) {
        if (loginMessageEl) {
          loginMessageEl.textContent = String(err?.message || 'Invalid Student ID or Password.');
          loginMessageEl.className = 'form-message error-msg';
          loginMessageEl.hidden = false;
        }
      }
    });


    $('#forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Password reset is not implemented in this step.');
    });

    const registerMessageEl = $('#register-message');
    const registerForm = $('#register-form');

    registerForm?.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('input', () => {
        if (registerMessageEl) registerMessageEl.hidden = true;
      });
    });

    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const studentName = normalize(e.target.studentName.value);
      const email = normalize(e.target.email.value);
      const password = normalize(e.target.password.value);
      const courseName = normalize(e.target.courseName.value);
      const kcse = normalize(e.target.kcse.value);

      if (!studentName || !email || !password || !courseName || !kcse) {
        if (registerMessageEl) {
          registerMessageEl.textContent = 'Please fill out all registration fields.';
          registerMessageEl.className = 'form-message error-msg';
          registerMessageEl.hidden = false;
        }
        return;
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        if (registerMessageEl) {
          registerMessageEl.textContent = 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
          registerMessageEl.className = 'form-message error-msg';
          registerMessageEl.hidden = false;
        }
        return;
      }

      try {
        await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ studentName, email, password, courseName, kcse }),
        });
        if (registerMessageEl) {
          registerMessageEl.textContent = 'Registration successful! Redirecting to dashboard...';
          registerMessageEl.className = 'form-message success-msg';
          registerMessageEl.hidden = false;
        }
        setTimeout(() => {
          window.location.assign('dashboard.html');
        }, 1500);
      } catch (err) {
        if (registerMessageEl) {
          registerMessageEl.textContent = String(err?.message || 'Registration failed.');
          registerMessageEl.className = 'form-message error-msg';
          registerMessageEl.hidden = false;
        }
      }
    });


    return;
  }

  // Student Dashboard page
  if (page === 'dashboard') {
    (async () => {
      try {
        const student = await apiFetch('/api/students/me');
        // Keep compatibility with existing renderDashboard expectations.
        const migrated = migrateUserModel({
          ...student,
          // migrateUserModel expects registrations in a specific shape.
          registrations: (student.registeredCourses || []).map((c) => ({
            courseName: c.courseName,
            kcseGrade: c.kcseGrade,
          })),
          registeredCourses: student.registeredCourses,
          waitlist: student.waitlist,
          notifications: student.notifications,
          creditsEarned: student.creditsEarned,
          creditsRequired: student.creditsRequired,
          studentName: student.studentName,
          program: student.program,
        });

        renderDashboard(migrated);

        const logoutBtn = $('#logout-btn');
        const dropBtn = $('#drop-course-btn');
        const catalogBtn = $('#catalog-page-btn');

        catalogBtn?.addEventListener('click', () => {
          window.location.assign('catalog.html');
        });

        logoutBtn?.addEventListener('click', async () => {
          try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
          } catch {}
          window.location.assign('login.html');
        });

        dropBtn?.addEventListener('click', async () => {
          const confirmDrop = confirm('Are you sure you want to drop your most recently registered course?');
          if (!confirmDrop) return;

          try {
            await apiFetch('/api/registrations/drop', { method: 'POST' });
            alert('Successfully dropped the most recently registered course!');
            const updated = await apiFetch('/api/students/me');
            const migratedAfter = migrateUserModel({
              ...updated,
              registrations: (updated.registeredCourses || []).map((c) => ({
                courseName: c.courseName,
                kcseGrade: c.kcseGrade,
              })),
              registeredCourses: updated.registeredCourses,
              waitlist: updated.waitlist,
              notifications: updated.notifications,
              creditsEarned: updated.creditsEarned,
              creditsRequired: updated.creditsRequired,
              studentName: updated.studentName,
              program: updated.program,
            });
            renderDashboard(migratedAfter);
          } catch (err) {
            alert(String(err?.message || 'Drop course failed.'));
          }
        });

        return;
      } catch (err) {
        window.location.assign('login.html');
      }
    })();

    return;


    const logoutBtn = $('#logout-btn');
    const dropBtn = $('#drop-course-btn');
    const catalogBtn = $('#catalog-page-btn');

    catalogBtn?.addEventListener('click', () => {
      window.location.assign('catalog.html');
    });

    logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem(LS_SESS);
      window.location.assign('login.html');
    });

    dropBtn?.addEventListener('click', () => {
    // localStorage drop removed; backend handles dropping.

    });

    return;
  }

  // Catalog page
  if (page === 'catalog') {
    (async () => {
      try {
        await apiFetch('/api/students/me');
      } catch {
        window.location.assign('login.html');
        return;
      }

      // Fill initial state (pills are UI-only)
      renderCatalogPills();
      bindCatalogControls();

      // Replace catalog rendering with DB-backed course list.
      async function renderCatalogFromServer() {
        const selectedDept = $('#department-pills')?.querySelector('.cat-pill.is-active')?.dataset?.dept || 'All';
        const selectedSem = $('#semester-pills')?.querySelector('.cat-pill.is-active')?.dataset?.sem || 'All';

        const filterAvailable = $('#filter-available')?.checked;
        const filterWaitlist = $('#filter-waitlist')?.checked;
        const sortBy = $('#catalog-sort')?.value || 'code';

        const data = await apiFetch(
          `/api/catalog?dept=${encodeURIComponent(selectedDept)}&sem=${encodeURIComponent(selectedSem)}&available=${filterAvailable ? 'true' : 'false'}&waitlist=${filterWaitlist ? 'true' : 'false'}&sortBy=${encodeURIComponent(sortBy)}`
        );

        const cards = $('#catalog-cards');
        const empty = $('#catalog-empty');
        const updatedEl = $('#catalog-updated');
        const creditsEl = $('#catalog-credits');
        if (!cards || !empty) return;

        if (updatedEl) updatedEl.textContent = formatDateShort(new Date().toISOString());

        const student = await apiFetch('/api/students/me');
        if (creditsEl) creditsEl.textContent = String(student.creditsEarned || 0);

        const registeredCourseCodes = (student.registeredCourses || []).map((rc) => rc.courseCode);
        const waitlistedCourseNames = (student.waitlist || []).map((wc) => wc.courseName);

        const catalog = data.courses || [];
        cards.innerHTML = '';

        if (catalog.length === 0) {
          empty.classList.add('show');
          return;
        }
        empty.classList.remove('show');

        for (const c of catalog) {
          const statusBadge = c.enrollmentStatus === 'Open'
            ? `<span class="badge-mini badge-available">${escapeHtml(c.enrollmentStatus)}</span>`
            : `<span class="badge-mini badge-wait">${escapeHtml(c.enrollmentStatus)}</span>`;

          const waitInfo = c.enrollmentStatus === 'Waitlist'
            ? `Waitlist: ${escapeHtml(c.waitlistPositionInfo || 'Join to view position')}`
            : `Seats filled: ${escapeHtml(String(c.seatsFilled))}/${escapeHtml(String(c.seatsTotal))}`;

          let buttonHtml = '';
          if (registeredCourseCodes.includes(c.courseCode)) {
            buttonHtml = `<button class="btn" style="margin-top:14px; width:100%;" disabled>Already Registered</button>`;
          } else if (waitlistedCourseNames.includes(c.title)) {
            buttonHtml = `<button class="btn" style="margin-top:14px; width:100%;" disabled>Already Waitlisted</button>`;
          } else {
            const btnText = c.enrollmentStatus === 'Open' ? 'Register for Course' : 'Join Waitlist';
            buttonHtml = `<button class="btn btn-register" style="margin-top:14px; width:100%;">${btnText}</button>`;
          }

          const card = document.createElement('div');
          card.className = 'course-catalog-card';
          card.setAttribute('role', 'listitem');

          card.innerHTML = `
            <div class="course-catalog-top">
              <div>
                <div class="course-catalog-code">${escapeHtml(c.courseCode)}</div>
                <div class="course-catalog-title">${escapeHtml(c.title)}</div>
              </div>
              <div class="cat-badges">${statusBadge}</div>
            </div>

            <div class="course-catalog-meta">
              <div><strong>Instructor:</strong> ${escapeHtml(c.instructor)}</div>
              <div><strong>Semester:</strong> ${escapeHtml(c.semester)} • <strong>Dept:</strong> ${escapeHtml(c.department)}</div>
              <div><strong>Status:</strong> ${escapeHtml(c.enrollmentStatus)} • <strong>${escapeHtml(waitInfo)}</strong></div>
            </div>

            <div class="cat-badges" style="margin-top:12px;">
              <span class="badge-mini">Seats: ${escapeHtml(String(c.seatsFilled))}/${escapeHtml(String(c.seatsTotal))}</span>
              ${c.enrollmentStatus === 'Waitlist' ? `<span class="badge-mini">Waitlist: ${escapeHtml(String(c.waitlistCount || 0))}</span>` : ''}
            </div>

            <div style="margin-top:4px;">
              ${buttonHtml}
            </div>
          `;

          const regBtn = card.querySelector('.btn-register');
          if (regBtn) {
            regBtn.addEventListener('click', async () => {
              try {
                await apiFetch('/api/registrations/add', {
                  method: 'POST',
                  body: JSON.stringify({ courseCode: c.courseCode }),
                });
                alert(c.enrollmentStatus === 'Open'
                  ? `Successfully registered for ${c.title}!`
                  : `Successfully joined waitlist for ${c.title}!`);
                await renderCatalogFromServer();
              } catch (err) {
                alert(String(err?.message || 'Registration failed.'));
              }
            });
          }

          cards.appendChild(card);
        }
      }

      // Override the legacy localStorage-based renderCatalog with server-driven one.
      // BindCatalogControls calls renderCatalog(student); we’ll patch by setting window hook.
      window.__renderCatalogServer = renderCatalogFromServer;

      // Initial render
      await renderCatalogFromServer();

      $('#catalog-back-btn')?.addEventListener('click', () => {
        window.location.assign('dashboard.html');
      });

      return;
    })();
  }


  // Admin Analytics page
  if (page === 'admin_analytics') {
    (async () => {
      try {
        const data = await apiFetch('/api/admin/analytics');
        window.__adminAnalyticsData = data;
        renderAdminDashboard({ isAdmin: !!data.isAdmin });

        const logout = $('#admin-logout-btn');
        logout?.addEventListener('click', async () => {
          try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
          } catch {}
          window.location.assign('login.html');
        });

        const btn = $('#admin-generate-report');
        const btn2 = $('#admin-generate-report-2');
        const reportHandler = () => {
          const payload = collectAdminAnalyticsPayload();
          generateDownloadFile(payload, `course-reg-admin-report-${new Date().toISOString().slice(0, 10)}.json`);
        };
        btn?.addEventListener('click', reportHandler);
        btn2?.addEventListener('click', reportHandler);

        // Tabs
        const tabBtns = document.querySelectorAll('.tab[data-trends]');
        tabBtns.forEach((t) => {
          t.addEventListener('click', () => {
            tabBtns.forEach((x) => x.classList.remove('is-active'));
            t.classList.add('is-active');
            renderAdminTrendsChart(t.dataset.trends);
          });
        });

        // Initial render based on active tab
        const activeTab = document.querySelector('.tab[data-trends].is-active');
        renderAdminTrendsChart(activeTab?.dataset?.trends || 'weekly');
      } catch (err) {
        alert(String(err?.message || 'Failed to load admin analytics.'));
        window.location.assign('login.html');
      }
    })();
    return;
  }


})();


