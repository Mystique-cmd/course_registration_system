# TODO - Supabase backend migration

## Step 1: Repo understanding (done)
- Confirm backend server code is missing; only `backend/db/schema.sql` exists.

## Step 2: Plan Supabase-based backend
- Create an edit plan for a new Supabase-specific Node/Express API.

## Step 3: Implement backend
- Add `server/` directory with Express app.
- Integrate Supabase JavaScript client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Replace DB access with Supabase table operations.

## Step 4: Auth + sessions
- Implement login/register via Supabase.
- Use cookie-based sessions compatible with existing frontend `credentials: 'include'`.
- Gate admin mode for `studentId === 'admin'`.

## Step 5: Implement API endpoints expected by frontend
- Implement endpoints for: login, registration, dashboard (courses/waitlist/notifications), catalog actions (register/drop/waitlist), admin analytics export.

## Step 6: Supabase schema compatibility
- Ensure Supabase table/column names match existing schema expectations.
- Create SQL migration instructions for Supabase (RLS, constraints, indexes).

## Step 7: Testing
- Run backend locally.
- Smoke test with browser flows.

