# TODO

- [x] Split single-page app into multiple web pages (login/register, student dashboard, course catalog)
  - [x] Create `login.html`
  - [x] Create `dashboard.html`
  - [x] Create `catalog.html`
  - [x] Update navigation links/buttons to use real page redirects
  - [x] Refactor `app.js` to be page-aware (only bind/render relevant logic per page)
  - [x] Update (or simplify) `index.html` after split
  - [x] Sanity test: login -> dashboard, dashboard -> catalog -> dashboard, logout (basic: pages load)
  - [ ] Verify catalog filtering + back navigation (manual UI test)

- [ ] Add **Weekly Schedule** feature
  - [x] Update dashboard UI: Weekly Schedule grid (Mon–Fri, 8–4) + Upcoming Tests countdown panel + Pending Tasks panel + Study Session Suggestion panel with “Find a Room”
  - [x] Update app.js: seed needed data (course code/title, tasks), parse schedule strings, render weekly grid with color-coded blocks, compute countdown, bind Find a Room button
  - [x] Update styles.css: styling for weekly grid + panels + course blocks
  - [ ] Manual test: login -> dashboard -> verify weekly schedule blocks and countdown

- [ ] Implement **Admin Analytics Dashboard**
  - [x] Create `admin_dashboard.html` with admin sidebar + analytics UI skeleton

  - [ ] Update `styles.css` with chart/activity/feed styling + admin-specific layout tweaks
  - [ ] Update `app.js` to support `data-page="admin_analytics"` and implement `renderAdminDashboard()` + chart rendering + report generation
  - [ ] Manual test: open `admin_dashboard.html` after adding users/registrations, verify UI behavior + report download


