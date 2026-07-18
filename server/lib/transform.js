function toNumberSafe(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function transformStudentForFrontend(studentRow, registrations, waitlist, notifications) {
  // Backend-first compatibility with frontend migrateUserModel.
  // Provide only the fields frontend consumes directly.
  const registeredCourses = (registrations || []).map((r) => {
    return {
      courseCode: r.course_code,
      courseName: r.course_title,
      description: r.course_description,
      instructor: r.course_instructor,
      schedule: r.course_schedule,
      location: r.course_location,
      kcseGrade: r.kcse_grade,
      kcseScore: r.kcse_grade,
      testDate: r.test_date,
    };
  });

  const waitlistList = (waitlist || []).map((w) => {
    return {
      position: toNumberSafe(w.position, 1),
      probability: Number(w.probability ?? 0),
      courseName: w.course_title,
      courseCode: w.course_code,
    };
  });

  return {
    studentId: String(studentRow.student_id),
    studentName: studentRow.student_name,
    email: studentRow.email,
    program: studentRow.program || 'BSc Computer Science',

    creditsEarned: toNumberSafe(studentRow.credits_earned, 0),
    creditsRequired: toNumberSafe(studentRow.credits_required, studentRow.minimum_courses || 120),

    registeredCourses,
    waitlist: waitlistList,
    notifications: (notifications || []).map((n) => ({
      id: String(n.id),
      type: n.type,
      message: n.message,
      date: n.created_at,
    })),

    // For dashboard sections that use migrateUserModel fallback.
    pendingTasks: studentRow.pending_tasks || undefined,
  };
}

module.exports = {
  transformStudentForFrontend,
};

