# Course Registration System (Atomicity)

A lightweight **course registration web app** implemented with plain HTML/CSS/JS.

It provides:
- **Student login + registration**
- **Student dashboard** (registered courses, calendar with test dates, waitlist, notifications, weekly schedule)
- **Course catalog** with department/semester and availability filters
- **Admin analytics** dashboard (charts + export report)

> **Note:** This repo can run in two modes:
> - **Frontend-only local demo** (historical approach using `localStorage`)
> - **Backend-first mode** (current): Node/Express + MySQL is the source of truth for login, catalog, registrations, and admin analytics.
>
> A MySQL schema is included under `db/schema.sql` (used by the backend).


---

## Demo / Project Pages

All pages are static and can be opened directly in a browser:
- `index.html` → redirects to `login.html`
- `login.html` → login + inline account/course registration
- `dashboard.html` → student dashboard
- `catalog.html` → course catalog
- `admin_dashboard.html` → admin analytics dashboard

---

## How data works

### Backend-first mode (recommended / current)
- Authentication, student profiles, catalog, registrations, waitlist, and notifications are stored in **MySQL**.
- The backend uses cookie-based sessions (`express-session`).

### Frontend-only local demo (historical)
Older iterations used browser `localStorage` keys:
- `atomicity_users_v1`
- `atomicity_session_v1`

If your current UI is using the backend endpoints, you should follow **Option 1** in the Setup section instead.


---

## Setup

This project supports:
- **Frontend-only local demo** (historical, `localStorage`-based)
- **Backend-first mode (recommended / current)**: Node/Express + MySQL

---

## Option 1 (Backend-first mode - recommended): Node/Express + MySQL

### 1) Prerequisites
- Node.js (v16+ recommended)
- MySQL server

### 2) Start MySQL and create the database
Create a database (name must match what you set in `.env` / env vars). The backend defaults are:
- `DB_NAME=courseregistration`

### 3) Import the schema
From the project root:
```bash
# adjust credentials as needed
mysql -u root -p courseregistration < "./db/schema.sql"
```

### 4) Configure backend environment variables
Create env vars (or export them) for the backend. The backend reads:
- `DB_HOST` (default `localhost`)
- `DB_USER` (default `root`)
- `DB_PASSWORD`
- `DB_NAME` (default `courseregistration`)
- `DB_PORT` (default `3306`)
- `SESSION_SECRET` (recommended)
- `PORT` (default `3000`)

If you don’t want to use a `.env` file, you can export in your shell, for example:
```bash
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=YOUR_PASSWORD
export DB_NAME=courseregistration
export DB_PORT=3306
export SESSION_SECRET="change-me"
export PORT=3000
```

### 5) Install backend dependencies and run the server
```bash
cd "./server"
npm install
npm start
```

The API base URL will be:
- http://localhost:3000/api

### 6) Run the frontend
Because the frontend pages are static, run a simple local server from the project root (recommended):
```bash
cd "./"
python3 -m http.server 8000
```
Open:
- http://localhost:8000/login.html

### 7) Login and register
- Student login/registration goes through the backend endpoints.
- After registration, go to:
  - `dashboard.html`
  - `catalog.html`
  - `admin_dashboard.html`

**Admin gate (demo):** login as `studentId = admin` to access admin-mode analytics behavior.

---

## Option 2 (Frontend-only local demo): open static files

> If you open the HTML files without running the backend, you will need to be on an older frontend build that uses `localStorage` (historical mode). If your current UI is API-driven, use Option 1 instead.



> Note: The README historically described `localStorage` keys (`atomicity_users_v1`, `atomicity_session_v1`).
> If the UI you’re using is currently backend-first (API calls), you should use Option 1.

### Option A: Open directly
1. Navigate to:
   - `/home/mystique/Desktop/course registration system`
2. Open:
   - `login.html`

### Option B: Use a local web server (recommended)
Some browsers restrict features for `file://`.

From the project folder:
```bash
python3 -m http.server 8000
```
Then open:
- http://localhost:8000/login.html

---

## MySQL schema (used by the backend)

The backend uses `db/schema.sql`.

### What it contains
- `students`
- `courses` (seeded with the sample catalog)
- `registrations` (student ↔ course)
- `waitlist_entries`
- `notifications`


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
- `db/schema.sql` – MySQL schema for a future backend

---

## Notes / Limitations

- In **backend-first mode**, data is stored in **MySQL** and auth uses **cookie sessions**.
- “Admin auth” is still a demo gate (backend treats `studentId === 'admin'` as admin-mode for analytics).
- Some UI/data (e.g., schedule rendering and certain catalog defaults) may still be seeded on the frontend for compatibility.


---

## License

All Rights Reserved. (See copyright text in the UI footer.)

