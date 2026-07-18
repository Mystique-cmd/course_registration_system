# Supabase migration notes

This backend expects the tables/columns defined by `backend/db/schema.sql` (PostgreSQL).

## 1) Create tables
Run the SQL from `backend/db/schema.sql` in the Supabase SQL editor (or as migrations).

## 2) Constraints required for upserts
The backend uses an upsert on `registrations` by:
- `(student_id_fk, course_id_fk)`

Ensure you have:
- `CREATE UNIQUE INDEX uq_registration_student_course ON registrations (student_id_fk, course_id_fk);`

## 3) RLS policies
For dev simplicity, the backend uses the **Supabase service role key**. With that, it can bypass RLS.

If you want production-grade RLS:
- Enable RLS on tables
- Create policies so authenticated users can CRUD their own rows
- Optionally restrict admin analytics to admin-only.

## 4) Column naming alignment
The frontend expects course objects with:
- `courseCode`, `courseName`, `kcseGrade`, and basic descriptors.

If you want richer dashboard rendering, you may extend `courses` with schedule/location/test_date.

This backend currently derives/returns:
- course_code, title, instructor, description
- kcse_grade from registrations

## 5) Session cookie behavior
The backend uses Express cookie sessions. Configure frontend fetch to send credentials:
- already done in `frontend/app.js` via `credentials: 'include'`

## 6) Required environment variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `PORT` (default 3000)

