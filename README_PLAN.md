# README update plan (Postgres / postregress setup)

## Information gathered
- Root `README.md` currently documents **MySQL**-based setup and `db/schema.sql` usage via `mysql < ./db/schema.sql`.
- `server/db.js` was updated to create a **PostgreSQL** `pg.Pool` using either `DATABASE_URL` or discrete env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` (default `5432`).
- `server/index.js` was partially updated to use **PostgreSQL** SQL placeholders (`$1`, `$2`, …) and Postgres upserts (`ON CONFLICT ... DO UPDATE`).
- `server/index.js` loads a local `.env` file manually (no `dotenv` dependency) and validates required DB env vars on startup.
- Root `db/schema.sql` is **MySQL** syntax (e.g., `CREATE DATABASE`, `ENGINE=InnoDB`, `AUTO_INCREMENT`, `ENUM`, `DATE_SUB`, etc.), so README must not instruct importing it into Postgres.
- `server/README_POSTGRES_MIGRATION.md` is currently empty/placeholder.
- `TODO.md` includes checkboxes indicating the Postgres README is still pending.

## Plan
1. Replace the MySQL-specific sections in root `README.md` with Postgres-specific instructions.
2. Update environment variables section to document Postgres vars (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, optional `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`/`USE_HTTPS`).
3. Change schema/import instructions to clearly state that `db/schema.sql` is MySQL and provide a correct placeholder section explaining that Postgres schema migration is required (and link to `server/README_POSTGRES_MIGRATION.md`).
4. Update any references to `mysql ... < ./db/schema.sql` and MySQL-specific troubleshooting.
5. Keep frontend run instructions (static pages on port 8000) but add a note about cookie sessions + CORS `credentials: true` requirement.
6. Add a quick “Minimal run” block showing `server` install and start, plus example `.env` content.
7. Sanity-check for accuracy against `server/index.js` routes/ports: API runs at `http://localhost:${PORT}`; UI calls `/api/*` with cookies.

## Dependent files to edit
- `README.md`
- (Optional later) `server/README_POSTGRES_MIGRATION.md` if we decide to add concrete SQL/migration steps there.

## Followup steps
- Run `npm start` in `server/` after installing deps to confirm README environment variables match actual startup requirements.
- Run a couple of endpoints from the browser (login/register/categorize) to ensure no cookie/port mismatch.

<ask_followup_question>
Proceed to rewrite the root README from MySQL setup to PostgreSQL setup, including removing the `mysql -p ... < db/schema.sql` instructions and replacing them with Postgres env var instructions plus a clear note that `db/schema.sql` is MySQL and Postgres schema migration must be created under `server/README_POSTGRES_MIGRATION.md`?
</ask_followup_question>

