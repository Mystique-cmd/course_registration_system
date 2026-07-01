const express = require('express');
const session = require('express-session');

const cors = require('cors');
const cookieParser = require('cookie-parser');

const { pool } = require('./db');
const { hashPassword, verifyPassword } = require('./auth');

// Routes are inlined for simplicity; can be split later.

const app = express();

app.use(cookieParser());
app.use(express.json());

// If you serve frontend from another host/port, keep CORS enabled.
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Cookie-session for auth (recommended). Persisted via in-memory store as fallback.
// NOTE: express-mysql-session isn't installed by default in package.json yet.
// We will use the default MemoryStore for now unless user installs MySQL session.
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 6,
    },
  })
);

function requireLogin(req, res, next) {
  if (!req.session || !req.session.studentId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function normalize(s) {
  return String(s ?? '').trim();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function nextTestDateISO(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + Number(daysAhead || 0));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ===== Auth =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const studentName = normalize(req.body.studentName);
    const email = normalize(req.body.email);
    const password = normalize(req.body.password);
    const courseName = normalize(req.body.courseName);
    const kcse = normalize(req.body.kcse);

    if (!studentName || !email || !password || !courseName || !kcse) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    const studentId = email.split('@')[0];
    const passwordHash = await hashPassword(password);

    // Start transaction: create student if not exists, then insert registration.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ensure student exists
      const [students] = await conn.execute(
        'SELECT id FROM students WHERE student_id = ? LIMIT 1',
        [studentId]
      );

      let studentPkId;
      if (!students.length) {
        const [ins] = await conn.execute(
          'INSERT INTO students (student_id, password_hash, student_name, email) VALUES (?, ?, ?, ?)',
          [studentId, passwordHash, studentName, email]
        );
        studentPkId = ins.insertId;
      } else {
        // if student exists, update name/email and keep existing password hash if you want.
        // Here we update name/email but keep password_hash as-is (simpler, avoids locking user out).
        await conn.execute(
          'UPDATE students SET student_name = ?, email = ? WHERE student_id = ?',
          [studentName, email, studentId]
        );
        const [row] = await conn.execute(
          'SELECT id FROM students WHERE student_id = ? LIMIT 1',
          [studentId]
        );
        studentPkId = row[0].id;
      }

      // Map course name (title) to a course_code. Schema uses course.title as 'title'.
      // In frontend we pass courseName like "Computer Science" etc; we need to match by title.
      const [courses] = await conn.execute(
        'SELECT id, course_code, title, test_date_offset_days FROM courses WHERE title = ? LIMIT 1',
        [courseName]
      );

      if (!courses.length) {
        await conn.rollback();
        return res.status(400).json({ error: `Course not found in DB: ${courseName}` });
      }
      const course = courses[0];

      // insert registration
      await conn.execute(
        'INSERT INTO registrations (student_id_fk, course_id_fk, kcse_grade) VALUES (?, ?, ?) '
          + 'ON DUPLICATE KEY UPDATE kcse_grade = VALUES(kcse_grade)',
        [studentPkId, course.id, kcse]
      );

      await conn.commit();

      req.session.studentId = studentId;
      return res.json({ ok: true, studentId });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const studentId = normalize(req.body.studentId);
    const password = normalize(req.body.password);

    if (!studentId || !password) {
      return res.status(400).json({ error: 'Missing studentId/password' });
    }

    const [rows] = await pool.execute(
      'SELECT id, student_id, password_hash FROM students WHERE student_id = ? LIMIT 1',
      [studentId]
    );

    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const student = rows[0];
    const ok = await verifyPassword(password, student.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.studentId = student.student_id;
    return res.json({ ok: true, studentId: student.student_id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ===== Student =====
app.get('/api/students/me', requireLogin, async (req, res) => {
  try {
    const studentId = req.session.studentId;

    const [studentRows] = await pool.execute(
      'SELECT student_id, student_name, email FROM students WHERE student_id = ? LIMIT 1',
      [studentId]
    );
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });

    const s = studentRows[0];

    const [regRows] = await pool.execute(
      `SELECT
        c.title AS courseName,
        c.course_code AS courseCode,
        c.instructor AS instructor,
        c.department AS department,
        c.semester AS semester,
        c.enrollment_status AS enrollmentStatus,
        c.test_date_offset_days AS testDateOffsetDays,
        r.kcse_grade AS kcseGrade
      FROM registrations r
      INNER JOIN courses c ON c.id = r.course_id_fk
      INNER JOIN students st ON st.id = r.student_id_fk
      WHERE st.student_id = ?
      ORDER BY r.id DESC`,
      [studentId]
    );

    const registeredCourses = regRows.map((r, idx) => ({
      courseName: r.courseName,
      courseCode: r.courseCode,
      title: r.courseName,
      instructor: r.instructor,
      schedule: getScheduleFromTitle(r.courseName),
      location: 'TBD',
      testDate: nextTestDateISO(r.testDateOffsetDays),
      kcseGrade: r.kcseGrade,
      department: r.department,
      semester: r.semester,
      enrollmentStatus: r.enrollmentStatus,
      // keep UI compatibility
      id: idx,
    }));

    // waitlist entries
    const [wlRows] = await pool.execute(
      `SELECT we.position, we.probability, c.title AS courseName
       FROM waitlist_entries we
       INNER JOIN courses c ON c.id = we.course_id_fk
       INNER JOIN students st ON st.id = we.student_id_fk
       WHERE st.student_id = ?
       ORDER BY we.position ASC`,
      [studentId]
    );

    const waitlist = wlRows.map((w) => ({
      position: w.position,
      probability: Number(w.probability),
      courseName: w.courseName,
    }));

    const [notifRows] = await pool.execute(
      `SELECT type, message, created_at
       FROM notifications n
       INNER JOIN students st ON st.id = n.student_id_fk
       WHERE st.student_id = ?
       ORDER BY n.id DESC
       LIMIT 10`,
      [studentId]
    );

    const notifications = notifRows.map((n) => ({
      id: `${n.type}-${n.created_at}`,
      type: n.type,
      message: n.message,
      date: new Date(n.created_at).toISOString(),
    }));

    // credits approximation (matches old frontend behavior)
    const creditsEarned = registeredCourses.length * 3;
    const creditsRequired = 120;

    return res.json({
      studentId,
      studentName: s.student_name,
      email: s.email,
      program: 'BSc Computer Science',
      creditsEarned,
      creditsRequired,
      registeredCourses,
      waitlist,
      notifications,
      pendingTasks: [
        { id: 't1', title: 'Review lecture notes (1–2 hrs)', dueInDays: 2 },
        { id: 't2', title: 'Practice past questions (45 min)', dueInDays: 4 },
        { id: 't3', title: 'Summarize key concepts (30 min)', dueInDays: 6 },
      ],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

function getScheduleFromTitle(courseName) {
  // Temporary mapping to keep UI stable; ideally store in DB.
  const map = {
    'Intro to Programming': 'Mon/Wed 10:00-11:30',
    'Data Structures': 'Tue/Thu 09:00-10:30',
    'Advanced React Patterns': 'Wed 13:00-15:00',
    'Business & Technology': 'Mon 15:00-17:00',
    'Engineering Fundamentals': 'Fri 09:00-12:00',
    'Computer Science': 'TBA',
    'IT Fundamentals': 'TBA',
    'Business Administration': 'TBA',
    'Engineering Fundamentals ': 'TBA',
  };
  return map[courseName] || 'TBA';
}

// ===== Catalog =====
app.get('/api/catalog', async (req, res) => {
  try {
    const selectedDept = req.query.dept ? String(req.query.dept) : 'All';
    const selectedSem = req.query.sem ? String(req.query.sem) : 'All';
    const filterAvailable = req.query.available === 'true';
    const filterWaitlist = req.query.waitlist === 'true';
    const sortBy = req.query.sortBy ? String(req.query.sortBy) : 'code';

    let sql = 'SELECT * FROM courses';
    const where = [];
    const params = [];

    if (selectedDept !== 'All') {
      where.push('department = ?');
      params.push(selectedDept);
    }
    if (selectedSem !== 'All') {
      where.push('semester = ?');
      params.push(selectedSem);
    }

    if (filterAvailable && !filterWaitlist) {
      where.push('enrollment_status = "Open"');
    } else if (!filterAvailable && filterWaitlist) {
      where.push('enrollment_status = "Waitlist"');
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    // Apply sorting
    if (sortBy === 'title') {
      sql += ' ORDER BY title ASC';
    } else if (sortBy === 'seats') {
      sql += ' ORDER BY (seats_total - seats_filled) DESC';
    } else {
      sql += ' ORDER BY course_code ASC';
    }

    const [rows] = await pool.execute(sql, params);

    return res.json({
      courses: rows.map((c) => ({
        courseCode: c.course_code,
        title: c.title,
        instructor: c.instructor,
        enrollmentStatus: c.enrollment_status,
        seatsFilled: c.seats_filled,
        seatsTotal: c.seats_total,
        waitlistCount: c.waitlist_count,
        waitlistPositionInfo: c.waitlist_position_info,
        department: c.department,
        semester: c.semester,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ===== Registrations =====
app.post('/api/registrations/drop', requireLogin, async (req, res) => {
  try {
    const studentId = req.session.studentId;

    // Drop most recently registered course for this student
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [studentRows] = await conn.execute(
        'SELECT id FROM students WHERE student_id = ? LIMIT 1',
        [studentId]
      );
      if (!studentRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Student not found' });
      }
      const studentPk = studentRows[0].id;

      const [regRows] = await conn.execute(
        'SELECT id FROM registrations WHERE student_id_fk = ? ORDER BY id DESC LIMIT 1',
        [studentPk]
      );

      if (!regRows.length) {
        await conn.rollback();
        return res.json({ ok: true, dropped: null });
      }

      const regId = regRows[0].id;
      await conn.execute('DELETE FROM registrations WHERE id = ?', [regId]);

      await conn.commit();
      return res.json({ ok: true, dropped: regId });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ===== Admin analytics =====
app.get('/api/admin/analytics', requireLogin, async (req, res) => {
  try {
    // Demo admin gate: treat studentId === 'admin' as admin.
    const isAdmin = req.session.studentId === 'admin';

    // Fetch all registrations + students.
    const [all] = await pool.execute(
      `SELECT st.student_id AS studentId, c.title AS courseName, r.kcse_grade AS kcseGrade
       FROM registrations r
       INNER JOIN students st ON st.id = r.student_id_fk
       INNER JOIN courses c ON c.id = r.course_id_fk`
    );

    const allRegistrations = all.map((r) => ({ studentId: r.studentId, courseName: r.courseName, kcseGrade: r.kcseGrade }));
    const studentCount = new Set(allRegistrations.map((r) => r.studentId)).size;
    const uniqueCourses = new Set(allRegistrations.map((r) => r.courseName));
    const activeCourses = uniqueCourses.size;

    const totalRegs = allRegistrations.length;

    // Keep old deterministic demo analytics shape, but computed from real DB inputs.
    const seed = hashStringToSeed(JSON.stringify({ studentCount, activeCourses, totalRegs }));
    const rnd = mulberry32(seed);
    const weeklyNow = Math.max(0, Math.floor(totalRegs / 5 + rnd() * 3));
    const weeklyPrev = Math.max(0, Math.floor(weeklyNow * (0.75 + rnd() * 0.5)));
    const pctChange = weeklyPrev === 0 ? (weeklyNow > 0 ? 1 : 0) : (weeklyNow - weeklyPrev) / weeklyPrev;
    const newRegistrations = weeklyNow;

    // Department distribution
    const [courses] = await pool.execute('SELECT title, department FROM courses');
    const titleToDept = new Map(courses.map((c) => [c.title, c.department]));

    const deptCounts = new Map();
    for (const r of allRegistrations) {
      const dept = titleToDept.get(r.courseName) || 'Other';
      deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
    }

    const deptArr = Array.from(deptCounts.entries())
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count);

    const totalDept = deptArr.reduce((sum, d) => sum + d.count, 0) || 1;
    const deptPctArr = deptArr.map((d) => ({ dept: d.dept, pct: d.count / totalDept }));

    const colors = [
      'rgba(139,92,246,.95)',
      'rgba(167,139,250,.95)',
      'rgba(134,239,172,.95)',
      'rgba(45,212,191,.95)',
      'rgba(253,224,71,.95)',
      'rgba(251,113,133,.95)',
      'rgba(96,165,250,.95)',
    ];

    const makeSeries = (count) => {
      const base = Math.max(1, Math.round(newRegistrations + activeCourses * 0.8));
      const series = [];
      for (let i = 0; i < count; i++) {
        const wave = Math.sin((i / Math.max(1, count - 1)) * Math.PI * 1.8);
        const noise = (rnd() - 0.5) * 0.4;
        const v = Math.max(0, Math.round(base * (0.7 + (i / count) * 0.5 + wave * 0.18 + noise)));
        series.push(v);
      }
      return series;
    };

    const weeklySeries = makeSeries(7);
    const monthlySeries = makeSeries(12);

    // Recent activities (synthetic but seeded from DB inputs)
    const now = Date.now();
    const activityKinds = ['enrollment', 'update', 'payment'];
    const coursesSample = Array.from(uniqueCourses);
    const activitySeed = hashStringToSeed(`act-${seed}-${coursesSample.join('|')}`);
    const rndAct = mulberry32(activitySeed);

    const activities = [];
    for (let i = 0; i < 8; i++) {
      const kind = activityKinds[Math.floor(rndAct() * activityKinds.length)];
      const courseName = coursesSample.length ? coursesSample[Math.floor(rndAct() * coursesSample.length)] : 'Course';
      const agoDays = Math.floor(rndAct() * 10);
      const when = new Date(now - agoDays * 86400000 - Math.floor(rndAct() * 86400000 * 0.6));
      activities.push({
        kind,
        courseName,
        when: when.toISOString(),
        detail:
          kind === 'enrollment'
            ? `New enrollment recorded for ${courseName}.`
            : kind === 'update'
              ? `Course information updated for ${courseName}.`
              : `Payment received for ${courseName}.`,
      });
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      isAdmin,
      studentCount,
      activeCourses,
      newRegistrations,
      pctChange,
      deptPctArr,
      deptColors: colors,
      weeklySeries,
      monthlySeries,
      activities,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

function hashStringToSeed(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Course Registration API listening on http://localhost:${port}`);
});

