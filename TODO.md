# TODO

- [ ] Update `server/db.js` to support Supabase connection env vars (use `DATABASE_URL` / Supabase connection string) and avoid crashing when discrete DB vars are missing on Vercel.
- [x] Re-deploy / retest login flow.
- [ ] If login still fails, adjust `express-session` cookie `secure`/sameSite settings in `server/index.js` for Vercel domain + HTTPS.


