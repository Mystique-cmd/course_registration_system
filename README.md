# Course Registration System (Atomicity)

A lightweight **course registration web app** implemented with plain HTML/CSS/JS.

It provides:
- **Student login + registration**
- **Student dashboard** (registered courses, calendar with test dates, waitlist, notifications, weekly schedule)
- **Course catalog** with department/semester and availability filters
- **Admin analytics** dashboard (charts + export report)

> **Note:** This repo is built as a **backend-first** app.
>
> - Frontend: static HTML/CSS/JS pages
> - Backend: Node/Express API with cookie-based sessions
> - **PostgreSQL**: source of truth for users, catalog, registrations, waitlist, and admin analytics
>
> `server/` contains the PostgreSQL-backed API implementation.



---

## Demo / Project Pages

UI pages are static and can be opened directly in a browser once the backend is running.

- `index.html` → redirects to `login.html`
- `login.html` → login form
- `registration.html` → registration form
- `dashboard.html` → student dashboard
- `catalog.html` → course catalog (register / join waitlist)
- `admin_dashboard.html` → admin analytics dashboard

---

## How data works

### Backend-first mode (recommended / current)
- Authentication, student profiles, catalog, registrations, waitlist, and notifications are stored in **PostgreSQL**.
- The backend uses cookie-based sessions (`express-session`).




---

## Setup (Backend-first)

This project uses:
- **Frontend:** static pages served by a simple web server
- **Backend:** Node/Express API + cookie-based sessions
- **Database:** PostgreSQL (required tables are implemented/expected by the backend)



---

## Step-by-step setup

### 1) Prerequisites
- Node.js (v16+ recommended)
- PostgreSQL server


### 2) Create the PostgreSQL database
Create a PostgreSQL database with the same name you’ll use for `DB_NAME`.

> Backend default: `DB_NAME=courseregistration`

### 3) Create the database schema (PostgreSQL)
This app’s backend expects a **PostgreSQL** schema.

#### Important: `db/schema.sql` is NOT PostgreSQL
- The repository’s `db/schema.sql` file is written in **MySQL** syntax.
- Because of that, you **cannot** import it directly into PostgreSQL.

#### What PostgreSQL tables you must create
Create (at minimum) tables that the backend queries by name in `server/index.js`:
- `students`
- `courses`
- `registrations`
- `waitlist_entries`
- `notifications`
- `drop_logs`
- `student_billing`

#### Where to put the Postgres SQL/migrations
The repo includes a placeholder for Postgres migration instructions:
- `server/README_POSTGRES_MIGRATION.md`

Update that file with your actual PostgreSQL migration steps / SQL, for example:
- `CREATE TABLE ...` statements
- constraints (foreign keys / unique keys)
- `ON CONFLICT` targets used by the backend (notably `registrations` upsert behavior)

#### How to confirm the schema step worked
After creating the schema and tables:
1. Connect to your Postgres database with `psql`.
2. Run table existence checks, e.g.:
   ```sql
   \dt
   ```
3. Verify each required table exists.
4. Then start the backend (next step) and confirm it no longer fails at startup due to missing relations.

#### Common mistakes to avoid
- Creating the tables in the wrong database/schema name (your `DB_NAME` must match).
- Using MySQL-only data types / syntax in PostgreSQL.
- Forgetting primary/unique keys needed for upserts (the backend uses `ON CONFLICT (student_id_fk, course_id_fk)` in `registrations`).



### 4) Configure backend environment variables (Postgres)
The backend reads these environment variables:

- `DATABASE_URL` (optional): a single Postgres connection string
- `DB_HOST` (default `localhost`)
- `DB_USER` (default `root`)
- `DB_PASSWORD`
- `DB_NAME` (default `courseregistration`)
- `DB_PORT` (default `5432`)
- `SESSION_SECRET` (recommended)
- `PORT` (default `3000`)

You can set them via a shell, for example:
```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=YOUR_PASSWORD
export DB_NAME=courseregistration
export DB_PORT=5432
export SESSION_SECRET="change-me"
export PORT=3000
```


> The backend also supports a local `.env` file (it is loaded by `server/index.js`).

### 5) Install backend dependencies and run the API
From the project root:
```bash
cd "./server"
npm install
npm start
```

The API runs at:
- http://localhost:3000/api

### 6) Run the frontend (static pages)
From the project root:
```bash
python3 -m http.server 8000
```

Open the UI at:
- http://localhost:8000/login.html

### 7) Login / register and use the app
1. Register (or use an existing student record)
2. Login via `login.html`
3. After login, navigate to:
   - `dashboard.html`
   - `catalog.html`
   - `admin_dashboard.html`

**Admin analytics (demo gate):** log in with `studentId = admin` to enable admin-mode analytics.

---

## Troubleshooting (common issues)

### Backend starts but UI login fails (401 / redirects)
- Confirm your backend is running on the port in the README (`http://localhost:3000/api`).
- Ensure your browser accepts cookies from `localhost:3000`.
- Since the frontend is served from a different port (e.g. `8000`), make sure the browser allows third-party cookie behavior for `localhost`.

### Database errors (Postgres)
- Verify `DB_NAME` matches the database you created.
- Verify `DB_PASSWORD` and `DB_PORT`.



### 8) Cookies / sessions note (important)
- The backend uses cookie-based sessions.
- The frontend calls the API with `credentials: 'include'`, so cookies must be accepted by your browser.
- Running frontend and backend on different ports (e.g., 8000 and 3000) is supported in typical dev setups.

---

### Project pages mapping
- `index.html` → redirects to `login.html`
- `login.html` → login form
- `registration.html` → registration form
- `dashboard.html` → student dashboard
- `catalog.html` → course catalog + register/join waitlist
- `admin_dashboard.html` → admin analytics



---



---

## Schema notes
- The backend expects a **PostgreSQL** schema.
- The repository’s `db/schema.sql` is **MySQL** and includes MySQL-specific syntax.

If you want a working Postgres setup, add/create a Postgres schema/migration (see `server/README_POSTGRES_MIGRATION.md`).




---

## Using the app

### 1) Student flow
1. Go to **`login.html`**
2. Register (if needed):
   - Password will be set to `default`
3. Login using:
   - Student ID: the value entered during registration (or `admin` for analytics)
   - Password: `default` (or your existing password)
4. After login:
   - Dashboard shows progress, waitlist, calendar, and the weekly schedule grid
   - Click **“Open Catalog”** to browse courses and apply filters
   - Click **“Drop Course”** to remove the most recently registered course

### 2) Admin analytics flow
1. Open `admin_dashboard.html`
2. Login as studentId **`admin`** to enable admin-mode UI behavior
3. Charts are generated from stored registrations and then:
   - “Generate Report” exports a JSON file via browser download.

---

## Project structure

- `app.js` – all page-aware logic (login, dashboard, catalog, admin analytics)
- `styles.css` – all styling including dashboard, catalog, schedule grid, and admin charts
- `index.html`, `login.html`, `dashboard.html`, `catalog.html`, `admin_dashboard.html` – static pages
- `db/schema.sql` – MySQL schema (not importable into PostgreSQL as-is)


---

## Notes / Limitations

- In **backend-first mode**, data is stored in **PostgreSQL** and auth uses **cookie sessions**.

- “Admin auth” is still a demo gate (backend treats `studentId === 'admin'` as admin-mode for analytics).
- Some UI/data (e.g., schedule rendering and certain catalog defaults) may still be seeded on the frontend for compatibility.


---

## License

All Rights Reserved. (See copyright text in the UI footer.)

