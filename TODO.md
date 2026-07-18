# TODO - Auth performance & navigation logout fixes

## Step 1: Add auth/session health endpoints (server)
- Add `GET /api/auth/status` to return `{ authenticated: boolean }` based on session.
- Improve `/api/students/me` error responses to distinguish 401 (unauth) vs 500 (server).

## Step 2: Fix session cookie for deployment
- Make `express-session` cookie `secure` conditional on `NODE_ENV`/`https`.
- Add `proxy` trust settings for deployed environments.
- Add `resave`/`saveUninitialized` stability if needed.

## Step 3: Fix frontend login UX & prevent duplicate submissions
- Disable submit button while login request is in-flight.
- Add a short client-side debounce to avoid multiple rapid submits.

## Step 4: Prevent “logged out” feel during navigation
- Add `apiFetch` handling for 401: show message without forcing immediate redirect on transient load errors.
- Add retry (once) for `/api/students/me` on transient failures after navigation.

## Step 5: Fix HTML escaping bug
- Correct `escapeHtml()` implementation to actually escape `<`, `>`, `"`.

## Step 6: Testing checklist
- Test local login once (no repeated attempts).
- Navigate dashboard -> schedule -> grades -> settings; verify session persists.
- Deploy behind HTTPS and verify cookies are sent.

## Progress
- [x] Added `/api/auth/status`
- [x] Made session cookie `secure` configurable for production deploy
- [x] Fixed `escapeHtml()`
- [x] Disabled login submit button while request runs


