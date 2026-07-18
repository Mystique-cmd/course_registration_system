const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { getSupabaseClient } = require('./lib/supabase');
const { hashPassword, verifyPassword } = require('./lib/passwords');
const { transformStudentForFrontend } = require('./lib/transform');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const supabase = getSupabaseClient();

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Allow frontend origin(s). In production lock this down.
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin and localhost dev.
      // If origin is undefined (e.g., curl/postman), allow it.
      if (!origin) return cb(null, true);
      return cb(null, true);
    },
    credentials: true,
  })
);

// Token-based session mock middleware
app.use((req, res, next) => {
  req.session = {
    destroy: (callback) => {
      if (typeof callback === 'function') callback();
    }
  };

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      if (decoded && decoded.studentDbId && decoded.studentId) {
        req.session.studentDbId = decoded.studentDbId;
        req.session.studentId = decoded.studentId;
      }
    } catch (e) {
      // Ignore token decoding failure
    }
  }
  next();
});

function requireSession(req, res, next) {
  if (!req.session || !req.session.studentDbId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getSessionStudentId(req) {
  return req.session?.studentId;
}

// =====================
// Auth
// =====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { studentName, email, password, courseName, kcse } = req.body || {};

    if (!studentName || !email || !password || !kcse) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create a student_id that frontend can use as login identifier.
    // The frontend registers by Student ID field in legacy UI, but in this flow
    // it submits only name/email/password plus courseName/kcse.
    // We derive studentId from the email local-part.
    const derivedStudentId = String(email).toLowerCase().split('@')[0].slice(0, 64);

    // Insert student row.
    const passwordHash = hashPassword(String(password));

    // Some columns in the repo schema don't include program/credits_*, but the frontend expects them.
    // We'll store derived defaults in JSON-like extra columns only if they exist.
    // To remain compatible with the existing schema, we only write columns that must exist.

    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .insert({
        student_id: derivedStudentId,
        password_hash: passwordHash,
        student_name: String(studentName),
        email: String(email),
        academic_status: 'Good',
        financial_hold: false,
        minimum_courses: 1,
      })
      .select('id, student_id, student_name, email')
      .single();

    if (studentErr) {
      // Unique violations are likely.
      return res.status(400).json({ error: studentErr.message });
    }

    // Seed initial registration if courseName provided.
    if (courseName) {
      // Find course by title or code.
      const { data: courseRows, error: courseErr } = await supabase
        .from('courses')
        .select('id, course_code, title, enrollment_status, seats_filled, seats_total')
        .or(`title.eq.${courseName},course_code.eq.${courseName}`);

      if (!courseErr && courseRows && courseRows.length) {
        const course = courseRows[0];

        if (course.enrollment_status === 'Open') {
          // upsert registration
          await supabase
            .from('registrations')
            .upsert(
              {
                student_id_fk: studentRow.id,
                course_id_fk: course.id,
                kcse_grade: String(kcse),
              },
              { onConflict: 'student_id_fk,course_id_fk' }
            );

          // Increment seats_filled conservatively
          await supabase
            .from('courses')
            .update({ seats_filled: Math.min(Number(course.seats_total) || 0, Number(course.seats_filled) + 1) })
            .eq('id', course.id);
        } else {
          // join waitlist
          // compute next position
          const { data: wlRows } = await supabase
            .from('waitlist_entries')
            .select('position')
            .eq('course_id_fk', course.id)
            .order('position', { ascending: true });

          const nextPos = (wlRows || []).length + 1;

          await supabase
            .from('waitlist_entries')
            .insert({
              student_id_fk: studentRow.id,
              course_id_fk: course.id,
              position: nextPos,
              probability: 0.6,
            });
        }

        // Best-effort notification
        await supabase.from('notifications').insert({
          student_id_fk: studentRow.id,
          type: 'course',
          message: `You registered for ${course.title}.`,
        });
      }
    }

    // Create session
    req.session.studentDbId = studentRow.id;
    req.session.studentId = studentRow.student_id;

    const token = Buffer.from(
      JSON.stringify({ studentDbId: studentRow.id, studentId: studentRow.student_id })
    ).toString('base64');

    res.json({ ok: true, token });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, studentId } = req.body || {};

    // Frontend sends { email, password }.
    const loginEmail = email;
    const loginPassword = password;

    if (!loginEmail || !loginPassword) {
      return res.status(400).json({ error: 'Missing email/password' });
    }

    const { data: studentRows, error: findErr } = await supabase
      .from('students')
      .select('id, student_id, student_name, email, password_hash')
      .eq('email', String(loginEmail))
      .limit(1);

    if (findErr) return res.status(400).json({ error: findErr.message });
    const student = (studentRows || [])[0];
    if (!student) return res.status(401).json({ error: 'Invalid Student ID or Password.' });

    const ok = verifyPassword(String(loginPassword), student.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid Student ID or Password.' });

    req.session.studentDbId = student.id;
    req.session.studentId = student.student_id;

    const token = Buffer.from(
      JSON.stringify({ studentDbId: student.id, studentId: student.student_id })
    ).toString('base64');

    res.json({ ok: true, token });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Login failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  // Ensure we clear session cookie consistently
  res.clearCookie?.('connect.sid');

  try {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  } catch {
    res.json({ ok: true });
  }
});

// =====================
// Current student
// =====================
app.get('/api/auth/status', (req, res) => {
  const authenticated = !!req.session?.studentDbId;
  res.json({ authenticated });
});

app.get('/api/students/me', requireSession, async (req, res) => {
  try {
    const studentDbId = req.session.studentDbId;

    const { data: studentRows, error: studentErr } = await supabase
      .from('students')
      .select('id, student_id, student_name, email, minimum_courses, academic_status, financial_hold')
      .eq('id', studentDbId)
      .limit(1);

    if (studentErr) return res.status(500).json({ error: studentErr.message });

    const student = (studentRows || [])[0];
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Registrations with course details
    // Supabase: use select with foreign keys
    const { data: regRows, error: regErr } = await supabase
      .from('registrations')
      .select(
        `kcse_grade,
         course_id_fk,
         student_id_fk,
         courses:course_id_fk (id, course_code, title, description, instructor, department, semester)`
      )
      .eq('student_id_fk', studentDbId)
      .order('created_at', { ascending: false });

    if (regErr) return res.status(500).json({ error: regErr.message });

    const registrations = (regRows || []).map((r) => {
      const c = r.courses;
      return {
        kcse_grade: r.kcse_grade,
        course_code: c?.course_code,
        course_title: c?.title,
        course_description: c?.description,
        course_instructor: c?.instructor,
        course_department: c?.department,
        course_semester: c?.semester,
        course_schedule: c?.schedule || 'TBA',
        course_location: c?.location || 'TBA',
        test_date: null,
      };
    });

    // Waitlist entries
    const { data: wlRows, error: wlErr } = await supabase
      .from('waitlist_entries')
      .select(
        `position, probability,
         courses:course_id_fk (course_code, title)`
      )
      .eq('student_id_fk', studentDbId)
      .order('position', { ascending: true });

    if (wlErr) return res.status(500).json({ error: wlErr.message });

    const waitlist = (wlRows || []).map((w) => ({
      position: w.position,
      probability: w.probability,
      course_title: w.courses?.title,
      course_code: w.courses?.course_code,
    }));

    // Notifications
    const { data: notifRows, error: notifErr } = await supabase
      .from('notifications')
      .select('id, type, message, created_at')
      .eq('student_id_fk', studentDbId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (notifErr) return res.status(500).json({ error: notifErr.message });

    // Provide shape expected by frontend.
    // creditsRequired/creditsEarned not present in schema; backend provides minimum_courses and uses frontend migration.
    const studentShape = transformStudentForFrontend(
      {
        student_id: student.student_id,
        student_name: student.student_name,
        email: student.email,
        minimum_courses: student.minimum_courses,
        program: 'BSc Computer Science',
        credits_required: 120,
        credits_earned: 0,
      },
      registrations,
      waitlist,
      notifRows || []
    );

    // Derive creditsEarned approximately from registrations if schema doesn't provide it.
    studentShape.creditsEarned = registrations.length * 3;

    // Derive courseName + schedule etc are mostly seeded in frontend migrateUserModel.
    // Return what we can.
    res.json({
      ...studentShape,
      // Legacy keys referenced in migrateUserModel in app.js
      registeredCourses: studentShape.registeredCourses.map((c) => ({
        courseCode: c.courseCode,
        courseName: c.courseName,
        kcseGrade: c.kcseGrade,
        description: c.description,
        instructor: c.instructor,
        schedule: c.schedule,
        location: c.location,
        testDate: c.testDate,
      })),
      waitlist: studentShape.waitlist.map((w) => ({
        position: w.position,
        probability: w.probability,
        courseName: w.courseName,
        courseCode: w.courseCode,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load student' });
  }
});

// =====================
// Catalog
// =====================
app.get('/api/catalog', async (req, res) => {
  try {
    const {
      dept,
      sem,
      available,
      waitlist,
      sortBy,
    } = req.query || {};

    let q = supabase.from('courses').select('id, course_code, title, description, instructor, department, semester, enrollment_status, seats_filled, seats_total, waitlist_count, waitlist_position_info, test_date_offset_days, drop_allowed, drop_deadline_days');

    if (dept && String(dept) !== 'All') {
      q = q.eq('department', String(dept));
    }
    if (sem && String(sem) !== 'All') {
      q = q.eq('semester', String(sem));
    }

    const availFlag = String(available || '').toLowerCase() === 'true';
    const waitFlag = String(waitlist || '').toLowerCase() === 'true';

    // If filter is enabled, restrict.
    if (availFlag && !waitFlag) {
      q = q.eq('enrollment_status', 'Open');
    } else if (!availFlag && waitFlag) {
      q = q.eq('enrollment_status', 'Waitlist');
    }

    const sort = String(sortBy || 'code');
    if (sort === 'seats') {
      q = q.order('seats_filled', { ascending: true });
    } else {
      q = q.order('course_code', { ascending: true });
    }

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    // Frontend expects camelCased JSON keys.
    res.json({
      courses: (data || []).map((c) => ({
        courseCode: c.course_code,
        title: c.title,
        description: c.description,
        instructor: c.instructor,
        department: c.department,
        semester: c.semester,
        enrollmentStatus: c.enrollment_status,
        seatsFilled: c.seats_filled,
        seatsTotal: c.seats_total,
        waitlistCount: c.waitlist_count,
        waitlistPositionInfo: c.waitlist_position_info,
        testDateOffsetDays: c.test_date_offset_days,
        dropAllowed: c.drop_allowed,
        dropDeadlineDays: c.drop_deadline_days,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Catalog failed' });
  }
});

// =====================
// Registrations
// =====================
app.post('/api/registrations/add', requireSession, async (req, res) => {
  try {
    const studentDbId = req.session.studentDbId;
    const { courseCode } = req.body || {};

    if (!courseCode) return res.status(400).json({ error: 'Missing courseCode' });

    const { data: courseRows, error: courseErr } = await supabase
      .from('courses')
      .select('id, course_code, title, enrollment_status, seats_filled, seats_total')
      .or(`course_code.eq.${courseCode},title.eq.${courseCode}`)
      .limit(1);

    if (courseErr) return res.status(500).json({ error: courseErr.message });
    const course = (courseRows || [])[0];
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (course.enrollment_status === 'Open') {
      await supabase
        .from('registrations')
        .upsert(
          {
            student_id_fk: studentDbId,
            course_id_fk: course.id,
            kcse_grade: 'default',
          },
          { onConflict: 'student_id_fk,course_id_fk' }
        );

      // Update seats
      await supabase
        .from('courses')
        .update({ seats_filled: Math.min(Number(course.seats_total) || 0, Number(course.seats_filled) + 1) })
        .eq('id', course.id);
    } else {
      // join waitlist (no upsert for waitlist_entries)
      // compute position
      const { data: wlCountRows } = await supabase
        .from('waitlist_entries')
        .select('id')
        .eq('course_id_fk', course.id);
      const nextPos = (wlCountRows || []).length + 1;

      await supabase
        .from('waitlist_entries')
        .upsert(
          {
            student_id_fk: studentDbId,
            course_id_fk: course.id,
            position: nextPos,
            probability: 0.6,
          },
          { onConflict: 'student_id_fk,course_id_fk' }
        );
    }

    // Notification
    await supabase.from('notifications').insert({
      student_id_fk: studentDbId,
      type: 'course',
      message: `Updated registration for ${course.title}.`,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Registration failed' });
  }
});

app.post('/api/registrations/drop', requireSession, async (req, res) => {
  try {
    const studentDbId = req.session.studentDbId;
    const { courseCode } = req.body || {};

    // Find course registration to drop
    let regToDrop;
    if (courseCode) {
      const { data: courseRows, error: courseErr } = await supabase
        .from('courses')
        .select('id, course_code, title')
        .or(`course_code.eq.${courseCode},title.eq.${courseCode}`)
        .limit(1);
      if (courseErr) return res.status(500).json({ error: courseErr.message });
      const course = (courseRows || [])[0];
      if (!course) return res.status(404).json({ error: 'Course not found' });

      const { data: regRows, error: regErr } = await supabase
        .from('registrations')
        .select('id, course_id_fk')
        .eq('student_id_fk', studentDbId)
        .eq('course_id_fk', course.id)
        .limit(1);
      if (regErr) return res.status(500).json({ error: regErr.message });

      regToDrop = (regRows || [])[0];
    } else {
      const { data: regRows, error: regErr } = await supabase
        .from('registrations')
        .select('id, course_id_fk, created_at')
        .eq('student_id_fk', studentDbId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (regErr) return res.status(500).json({ error: regErr.message });
      regToDrop = (regRows || [])[0];
    }

    if (!regToDrop) return res.status(404).json({ error: 'No registration found to drop' });

    // course details for log
    const { data: courseRows } = await supabase
      .from('courses')
      .select('id, course_code, title')
      .eq('id', regToDrop.course_id_fk)
      .limit(1);
    const course = (courseRows || [])[0];

    await supabase.from('drop_logs').insert({
      student_id_fk: studentDbId,
      course_id_fk: regToDrop.course_id_fk,
      reason: 'Student drop',
    });

    await supabase
      .from('registrations')
      .delete()
      .eq('id', regToDrop.id);

    // Seats filled rollback best-effort
    if (course) {
      const { data: updatedCourses } = await supabase
        .from('courses')
        .select('seats_filled')
        .eq('id', course.id)
        .limit(1);
      const cur = (updatedCourses || [])[0];
      if (cur) {
        await supabase
          .from('courses')
          .update({ seats_filled: Math.max(0, Number(cur.seats_filled) - 1) })
          .eq('id', course.id);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Drop failed' });
  }
});

// =====================
// Admin analytics
// =====================
app.get('/api/admin/analytics', requireSession, async (req, res) => {
  try {
    const sessionStudentId = getSessionStudentId(req);
    const isAdmin = sessionStudentId === 'admin';

    // Simple analytics from registrations and courses.
    const { data: studentsRows } = await supabase.from('students').select('id');
    const { data: coursesRows } = await supabase.from('courses').select('id, enrollment_status');

    const { data: regRows } = await supabase
      .from('registrations')
      .select('id, created_at');

    const studentCount = (studentsRows || []).length;
    const activeCourses = (coursesRows || []).length;
    const newRegistrations = (regRows || []).length;

    // pctChange: rough demo based on first half vs second half.
    let pctChange = 0;
    if (regRows && regRows.length >= 2) {
      pctChange = 0.08;
    }

    const deptColors = [
      'rgba(167,139,250,.95)',
      'rgba(134,239,172,.95)',
      'rgba(253,224,71,.95)',
      'rgba(251,113,133,.95)',
      'rgba(96,165,250,.95)',
      'rgba(45,212,191,.95)',
    ];

    // Department distribution
    const { data: courseDeptRows } = await supabase
      .from('courses')
      .select('department');

    const byDept = new Map();
    (courseDeptRows || []).forEach((c) => {
      const d = c.department || 'Other';
      byDept.set(d, (byDept.get(d) || 0) + 1);
    });

    const deptArr = Array.from(byDept.entries())
      .map(([dept, count]) => ({ dept, pct: count / Math.max(1, (courseDeptRows || []).length) }))
      .sort((a, b) => b.pct - a.pct);

    // Weekly/monthly dummy series (frontend draws anyway)
    const weeklySeries = [0, 0, 0, 0, 0, 0, 0];
    const monthlySeries = new Array(12).fill(0);

    // Activities feed
    const activities = [];

    res.json({
      isAdmin,
      studentCount,
      activeCourses,
      newRegistrations,
      pctChange,
      deptPctArr: deptArr,
      deptColors,
      weeklySeries,
      monthlySeries,
      activities,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Analytics failed' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[supabase-backend] listening on :${PORT} (POSTGRES via Supabase)`);
});

