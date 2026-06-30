const LS_KEY = 'atomicity_users_v1';
const LS_SESS = 'atomicity_session_v1';

const $ = (sel) => document.querySelector(sel);

function getPage() {
  const main = $('main.app');
  return main?.dataset?.page || 'index';
}

function getUsers() {

  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function setUsers(users) {
  localStorage.setItem(LS_KEY, JSON.stringify(users));
}

function setSession(studentId) {
  localStorage.setItem(LS_SESS, JSON.stringify({ studentId }));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_SESS) || 'null');
  } catch {
    return null;
  }
}




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
          <div role="cell" class="td td-strong">${escapeHtml(c.courseName)}</div>
          <div role="cell" class="td">${escapeHtml(c.instructor || 'TBA')}</div>
          <div role="cell" class="td">${escapeHtml(c.schedule || 'TBA')}</div>
          <div role="cell" class="td">${escapeHtml(c.location || 'TBA')}</div>
        `;
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

  reset?.addEventListener('click', () => {
    $('#filter-available') && ($('#filter-available').checked = false);
    $('#filter-waitlist') && ($('#filter-waitlist').checked = false);

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

    $('#login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const studentId = normalize(e.target.studentId.value);
      const password = normalize(e.target.password.value);

      if (!studentId || !password) return;

      const usersLogin = getUsers();
      const user = usersLogin.find((u) => u.studentId === studentId && u.password === password);

      if (!user) {
        alert('Invalid Student ID or Password.');
        return;
      }

      setSession(studentId);
      window.location.assign('dashboard.html');
    });

    $('#forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Password reset is not implemented in this step.');
    });

    $('#register-form')?.addEventListener('submit', (e) => {
      e.preventDefault();

      const studentName = normalize(e.target.studentName.value);
      const email = normalize(e.target.email.value);
      const courseName = normalize(e.target.courseName.value);
      const kcse = normalize(e.target.kcse.value);

      if (!studentName || !email || !courseName || !kcse) return;

      const studentId = email.split('@')[0];
      const password = 'default';

      const users = getUsers();
      const existing = users.find((u) => u.studentId === studentId);

      if (existing) {
        existing.registrations = existing.registrations || [];
        existing.registrations.push({ courseName, kcseGrade: kcse });
      } else {
        users.push({
          studentId,
          password,
          studentName,
          email,
          registrations: [{ courseName, kcseGrade: kcse }],
        });
      }

      setUsers(users);
      setSession(studentId);
      window.location.assign('dashboard.html');
    });

    return;
  }

  // Student Dashboard page
  if (page === 'dashboard') {
    const sess = getSession();
    if (!sess?.studentId) {
      window.location.assign('login.html');
      return;
    }

    const users = getUsers();
    const raw = users.find((u) => u.studentId === sess.studentId);
    if (!raw) {
      localStorage.removeItem(LS_SESS);
      window.location.assign('login.html');
      return;
    }

    const student = migrateUserModel(raw);
    renderDashboard(student);

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
      const sessNow = getSession();
      if (!sessNow?.studentId) return;

      const usersForDrop = getUsers();
      const user = usersForDrop.find((u) => u.studentId === sessNow.studentId);
      if (!user || !user.registrations || user.registrations.length === 0) return;

      user.registrations.pop();
      setUsers(usersForDrop);

      const rawAfter = usersForDrop.find((u) => u.studentId === sessNow.studentId);
      const studentAfter = rawAfter ? migrateUserModel(rawAfter) : null;
      if (studentAfter) renderDashboard(studentAfter);
    });

    return;
  }

  // Catalog page
  if (page === 'catalog') {
    const sess = getSession();
    if (!sess?.studentId) {
      window.location.assign('login.html');
      return;
    }

    const users = getUsers();
    const raw = users.find((u) => u.studentId === sess.studentId);
    const student = raw ? migrateUserModel(raw) : null;

    // Fill initial state
    renderCatalogPills();
    bindCatalogControls();
    renderCatalog(student);

    $('#catalog-back-btn')?.addEventListener('click', () => {
      window.location.assign('dashboard.html');
    });

    return;
  }
})();


