const LS_KEY = 'atomicity_users_v1';
const LS_SESS = 'atomicity_session_v1';

const $ = (sel) => document.querySelector(sel);

const views = {
  login: $('#login-view'),
  register: $('#register-view'),
  courses: $('#courses-view'),
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

function renderCoursesFor(studentId) {
  const list = $('#courses-list');
  const sub = $('#courses-subhead');
  if (!list) return;

  const users = getUsers();
  const user = users.find((u) => u.studentId === studentId);
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
    renderCoursesFor(sess.studentId);
    showView('login');
  }

  // Login
  $('#login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const studentId = normalize(e.target.studentId.value);
    const password = normalize(e.target.password.value);

    if (!studentId || !password) return;

    const users = getUsers();
    const user = users.find((u) => u.studentId === studentId && u.password === password);

    if (!user) {
      alert('Invalid Student ID or Password.');
      return;
    }

    setSession(studentId);
    renderCoursesFor(studentId);
    showView('courses');
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
    renderCoursesFor(studentId);
    showView('courses');
    e.target.reset();
  });

  $('#back-to-auth')?.addEventListener('click', () => {
    showView('login');
  });
})();

