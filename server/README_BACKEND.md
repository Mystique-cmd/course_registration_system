# Backend setup (MySQL + Node/Express)

## 1) Install dependencies

```bash
cd "./server" 
npm install
```

## 2) Configure environment variables

Create env vars or export them:

- `DB_HOST` (default localhost)
- `DB_USER` (default root)
- `DB_PASSWORD`
- `DB_NAME` (default courseregistration)
- `DB_PORT` (default 3306)
- `SESSION_SECRET` (recommended)
- `PORT` (default 3000)

## 3) Import schema

Use `../db/schema.sql`:

```bash
# example
mysql -u root -p < "../db/schema.sql"
```

## 4) Run backend

```bash
npm start
```

API base URL:
- http://localhost:3000/api

