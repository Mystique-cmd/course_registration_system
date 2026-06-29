const LS_KEY = 'atomicity_users_v1';
const LS_SESS = 'atomicity_session_v1';

const $ = (sel) => document.querySelector(sel);

const views = {
  login: $('#login-view'),
  register: $('#register-view'),
  courses: $('#courses-view'),
  dashboard: $('#dashboard-view'),
};

const dashNav = {
  dashboard: $('#dash-secondary-title'),
};


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

function showView(name) {
  Object.entries(views).forEach(([k, el]) => {

    if (!el) return;
    el.hidden = k !== name;
  });
}

function normalize(s) {
  return String(s || '').trim();
}

function migrateUserModel(user) {
  const migrated = { ...user };

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
    const courseCatalog = {
      'Computer Science': { instructor: 'Dr. A. Mwangi', schedule: 'Mon/Wed 10:00-11:30', location: 'Room C-201', testDate: nextTestDateISO(4) },
      'Data Structures': { instructor: 'Prof. J. Otieno', schedule: 'Tue/Thu 09:00-10:30', location: 'Room B-104', testDate: nextTestDateISO(10) },
      'Advanced React Patterns': { instructor: 'Dr. S. Njoroge', schedule: 'Wed 13:00-15:00', location: 'Lab 3', testDate: nextTestDateISO(18) },
      'Business Administration': { instructor: 'Prof. K. Wambui', schedule: 'Mon 15:00-17:00', location: 'Room D-110', testDate: nextTestDateISO(25) },
      'Engineering Fundamentals': { instructor: 'Dr. P. Kimani', schedule: 'Fri 09:00-12:00', location: 'Room E-205', testDate: nextTestDateISO(8) },
    };

    migrated.registeredCourses = regs.map((r, idx) => {
      const c = courseCatalog[r.courseName] || {
        instructor: 'TBA',
        schedule: 'TBA',
        location: 'TBA',
        testDate: nextTestDateISO(14 + idx * 7),
      };
      return {
        courseName: r.courseName,
        instructor: c.instructor,
        schedule: c.schedule,
        location: c.location,
        testDate: c.testDate,
        kcseGrade: r.kcseGrade,
      };
    });
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

// Init
(function init() {
  // Default route
  const sess = getSession();
  if (sess?.studentId) {
    const users = getUsers();
    const raw = users.find((u) => u.studentId === sess.studentId);
    const student = raw ? migrateUserModel(raw) : null;

    if (student) {
      renderDashboard(student);
      showView('dashboard');
    } else {
      renderCoursesFor(sess.studentId);
      showView('login');
    }
  }


  // Dashboard (static wiring for now)
  const logoutBtn = $('#logout-btn');
  const dropBtn = $('#drop-course-btn');

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem(LS_SESS);
    showView('login');
    // keep courses rendered when logging back in
  });

  dropBtn?.addEventListener('click', () => {
    const sess = getSession();
    if (!sess?.studentId) return;
    // Drop the last registered course for now
    const usersForDrop = getUsers();
    const user = usersForDrop.find((u) => u.studentId === sess.studentId);

    if (!user || !user.registrations || user.registrations.length === 0) return;

    user.registrations.pop();
    setUsers(usersForDrop);

    const rawAfter = usersForDrop.find((u) => u.studentId === sess.studentId);

    const studentAfter = rawAfter ? migrateUserModel(rawAfter) : null;

    if (studentAfter) {
      renderDashboard(studentAfter);
    }

    renderCoursesFor(sess.studentId);

  });




  // Login
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

    const users = getUsers();
    const raw = users.find((u) => u.studentId === studentId);
    const student = raw ? migrateUserModel(raw) : null;

    if (student) {
      renderDashboard(student);
      showView('dashboard');
    } else {
      renderCoursesFor(studentId);
      showView('courses');
    }

    e.target.reset();
  });


  // Forgot password (placeholder per step 1)
  $('#forgot-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Password reset is not implemented in this step.');
  });

  // Switch: login -> register
  $('#create-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showView('register');
  });

  // Switch: register -> login
  $('#view-courses-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
  });

  // Registration
  $('#register-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const studentName = normalize(e.target.studentName.value);
    const email = normalize(e.target.email.value);
    const courseName = normalize(e.target.courseName.value);
    const kcse = normalize(e.target.kcse.value);

    if (!studentName || !email || !courseName || !kcse) return;

    // For step 1, use email as Student ID surrogate only if student id isn't separately collected.
    // But design says login uses Student ID, so we create studentId from email prefix.
    // If you later want a dedicated Student ID field in registration, we will adjust.
    const studentId = email.split('@')[0];
    const password = 'default';

    const users = getUsers();
    const existing = users.find((u) => u.studentId === studentId);

    if (existing) {
      // Append registration
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

    // For UX: show courses after registration
    setSession(studentId);

    const usersAfter = getUsers();
    const rawAfter = usersAfter.find((u) => u.studentId === studentId);
    const studentAfter = rawAfter ? migrateUserModel(rawAfter) : null;

    if (studentAfter) {
      renderDashboard(studentAfter);
      showView('dashboard');
    } else {
      renderCoursesFor(studentId);
      showView('courses');
    }


    e.target.reset();
  });

  $('#back-to-auth')?.addEventListener('click', () => {
    showView('login');
  });
})();

