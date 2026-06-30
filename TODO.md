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


