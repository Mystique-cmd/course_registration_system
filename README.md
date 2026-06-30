# Course Registration System (Atomicity)

A lightweight **course registration web app** implemented with plain HTML/CSS/JS.

It provides:
- **Student login + registration**
- **Student dashboard** (registered courses, calendar with test dates, waitlist, notifications, weekly schedule)
- **Course catalog** with department/semester and availability filters
- **Admin analytics** dashboard (charts + export report)

> **Note:** In this version, all “database” data is stored in the browser’s `localStorage` (no backend required).
> A MySQL schema is included under `db/schema.sql` for a future/parallel backend implementation.

---

## Demo / Project Pages

All pages are static and can be opened directly in a browser:
- `index.html` → redirects to `login.html`
- `login.html` → login + inline account/course registration
- `dashboard.html` → student dashboard
- `catalog.html` → course catalog
- `admin_dashboard.html` → admin analytics dashboard

---

## How data works (local demo)

`app.js` uses:
- `localStorage` key `atomicity_users_v1` to store users and their registrations
- `localStorage` key `atomicity_session_v1` to store the logged-in student id

### Default behaviors
- Logging in requires a **matching** `studentId` + `password`.
- Registration sets the password to **`default`**.
- Admin mode is a demo gate: when the active session’s `studentId` equals **`admin`**, the analytics page behaves like admin.

You can clear browser storage to reset the app:
- DevTools → Application → Local Storage → clear `atomicity_users_v1` and `atomicity_session_v1`

---

## Setup (no server required)

### Option A: Open directly
1. Navigate to the project folder:
   - `/home/mystique/Desktop/course registration system`
2. Open any of these files in a browser:
   - `login.html` (recommended)

Because the app is static, no build step is needed.

### Option B: Use a simple local web server (recommended)
Some browsers restrict certain features for `file://`.

From the project folder, run one of:

**Python 3**
```bash
cd "/home/mystique/Desktop/course registration system"
python3 -m http.server 8000
```
Then open:
- http://localhost:8000/login.html

---

## MySQL Schema (optional)

If you plan to move from the demo `localStorage` approach to a real backend, use:
- `db/schema.sql`

### What it contains
- `students`
- `courses` (seeded with the same sample catalog items)
- `registrations` (student ↔ course)
- `waitlist_entries`
- `notifications`

### Run it
Example (MySQL):
```sql
SOURCE /path/to/course registration system/db/schema.sql;
```

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

- This is a **frontend-only** demo.
- “Admin auth” is a simple demo gate (`studentId === 'admin'`).
- Reports and analytics are computed deterministically in the frontend.

---

## License

All Rights Reserved. (See copyright text in the UI footer.)

