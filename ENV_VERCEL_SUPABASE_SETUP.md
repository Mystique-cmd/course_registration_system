# Vercel (Frontend) ↔ Supabase (Postgres/Backend) Setup

This repo uses **cookie-based sessions** in the Node/Express backend (`server/`). The Vercel-hosted static frontend must be configured to:
1) call the deployed backend URL (API base)
2) allow cross-site cookies
3) connect to Supabase Postgres using `DATABASE_URL`

---

## 1) Set required Vercel environment variables

### `DATABASE_URL` (required)
**Must be the Supabase Postgres connection string** (from Supabase dashboard → *Connection string*). Example:

`postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require`

### `SESSION_EXPIRED` (required/optional)
Used to set session cookie `maxAge`. Supported formats:
- number of **milliseconds** (if large)
- number of **seconds** (if small)
- duration strings like `"6h"`, `"30m"`, `"10s"`, `"5000ms"`

### Supabase public env vars
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are **not used** by this backend implementation.

---

## 2) Set cookie behavior for cross-site sessions
In `server/index.js`, cookie is configured as:
- `sameSite`: default `none`
- `secure`: default `true` in production

If you need explicit overrides on Vercel:
- `COOKIE_SAME_SITE` = `none`
- `COOKIE_SECURE` = `true`

---

## 3) Configure the frontend to point to the deployed backend
Each HTML page now sets:

```js
window.__API_BASE__ = (window.__API_BASE__ || '').trim() || 'https://YOUR_BACKEND_DOMAIN_HERE';
```

Replace `https://YOUR_BACKEND_DOMAIN_HERE` with your deployed backend origin (the host where `server/index.js` is running).

Notes:
- `app.js` calls endpoints like `${API_BASE}/api/auth/login`.
- Therefore `__API_BASE__` should be something like `https://your-backend.example.com` (NOT including `/api`).

---

## 4) Deploy & test
1. Deploy backend and note its public base URL.
2. Update `window.__API_BASE__` placeholders in all pages.
3. Set Vercel env vars (`DATABASE_URL`, `SESSION_EXPIRED`).
4. Verify login:
   - After `/api/auth/login`, browser should store the session cookie.
   - `/api/students/me` should return 200 when logged in.

---

## Common failure modes
- **401 Unauthorized after login**: cookie not being stored/sent.
  - Ensure backend cookie `sameSite=none` + `secure=true` in production.
  - Ensure `API_BASE` points to the correct deployed backend origin.
- **DB connection fails on Vercel**:
  - Ensure `DATABASE_URL` is the **Postgres** connection string (not HTTP `NEXT_PUBLIC_SUPABASE_URL`).


