# Local development

Run ApparelFlow on your machine with `npm run dev` — **Docker is not required**. You need Node.js and a PostgreSQL
server, either installed locally or a free cloud database.

- [Prerequisites](#prerequisites)
- [1. Get a PostgreSQL server](#1-get-a-postgresql-server)
- [2. Configure the environment](#2-configure-the-environment)
- [3. Install, set up the database and run](#3-install-set-up-the-database-and-run)
- [Everyday commands](#everyday-commands)
- [Running the tests locally](#running-the-tests-locally)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 20.19 or newer (24 LTS recommended — see `.nvmrc`) | `node --version` |
| npm | 10 or newer (ships with Node.js) | `npm --version` |
| PostgreSQL | 14 or newer | running on `localhost:5432`, or a cloud connection string |

## 1. Get a PostgreSQL server

Pick **one** option. You don't need to create the `apparelflow` database yourself: `npm run db:setup` creates it
(through `prisma migrate deploy`) if it doesn't exist, as long as the database user is allowed to create databases.
The default users below all are.

### Option A — macOS with Homebrew

```bash
brew install postgresql@18
brew services start postgresql@18      # runs on localhost:5432 and restarts at login
```

Homebrew creates a superuser named after your macOS account, with no password:

```text
postgresql://<your-macos-username>@localhost:5432/apparelflow?schema=public
```

`postgresql@18` is *keg-only*, so its command-line tools (`psql`, `createdb`, `pg_isready`) are not on your `PATH`.
The app doesn't need them. If you want them:

```bash
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"   # this terminal only — add it to ~/.zshrc to keep it
```

### Option B — Postgres.app (macOS)

Install [Postgres.app](https://postgresapp.com) and click *Initialize*. As with Homebrew, the superuser is your macOS
username with no password:

```text
postgresql://<your-macos-username>@localhost:5432/apparelflow?schema=public
```

### Option C — Windows

Install PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and remember
the password you choose for the `postgres` superuser:

```text
postgresql://postgres:<password>@localhost:5432/apparelflow?schema=public
```

If you choose the password `postgres`, the defaults in `.env.example` work unchanged.

### Option D — Linux (Debian/Ubuntu)

Debian and Ubuntu require a password for TCP connections to `localhost`, so give the `postgres` superuser one:

```bash
sudo apt install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

The defaults in `.env.example` (`postgresql://postgres:postgres@localhost:5432/apparelflow?schema=public`) then work
unchanged.

### Option E — free cloud database (nothing to install)

Create a free project on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy its **direct**
(non-pooled) connection string. Use it as-is for both `DATABASE_URL` and `DIRECT_URL`; the database it names already
exists.

> Prefer containers? `npm run docker:db` starts the PostgreSQL service defined in `docker/compose.yaml`, which matches
> the defaults in `.env.example` (`postgres` / `postgres` on `localhost:5432`).

## 2. Configure the environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The connection string from step 1 |
| `DIRECT_URL` | The same string (migrations use it) |
| `AUTH_SECRET` | A random string of at least 32 characters — generate one with `openssl rand -base64 48` |
| `TEST_DATABASE_URL` | Only for the test suites: the same server with database name `apparelflow_test` (see [below](#running-the-tests-locally)) |
| `NEXT_PUBLIC_PLANT_TIMEZONE` | Optional display time zone (default `Asia/Colombo`) |

## 3. Install, set up the database and run

```bash
npm install          # installs dependencies and generates the Prisma client
npm run db:setup     # creates the database if needed, applies the migrations, seeds the demo data
npm run dev          # starts the app on http://localhost:3000
```

Open <http://localhost:3000> and sign in with one of the demo personas on the sign-in page (password
`ApparelFlow@2026`). You can re-run `npm run db:setup` safely: it skips migrations that are already applied, updates
the demo users and recipes in place, and only adds demo batches to an empty database.

To try the optimized production build instead of the dev server:

```bash
npm run build
npm run start        # http://localhost:3000
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`), creating the database if needed |
| `npm run db:seed` | Seed the demo users and recipes, plus demo batches on an empty database |
| `npm run db:setup` | `db:migrate` + `db:seed` |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client (`npm install` already does this) |
| `npm run db:reset` | **Destructive:** drops and re-creates the database in `DATABASE_URL`. Development only |
| `npm run audit:api -- http://localhost:3000` | Run the security audit against your local server (`--mode=full` creates a demo batch) |
| `npm run docker:db` / `npm run docker:build` | Optional: start PostgreSQL in Docker / build the production image |

## Running the tests locally

The integration and end-to-end suites need a PostgreSQL **server** where they can create and drop throw-away
databases. They never touch existing ones. Point `TEST_DATABASE_URL` at that server, for example
`postgresql://<user>@localhost:5432/apparelflow_test?schema=public`. The database itself doesn't need to exist, but
the user needs permission to create databases.

```bash
npm test                         # unit + integration (Vitest)
npm run test:unit                # unit only — no database needed
npm run test:integration         # integration only

npx playwright install chromium  # once, downloads the browser
npm run test:e2e                 # Playwright end-to-end (builds and starts the app itself)
```

The test configuration lives with the tests. `vitest.config.ts` at the root is the entry point that editors look
for, and it loads `tests/vitest.workspace.ts`; Playwright uses `tests/e2e/playwright.config.ts`. Reports are written
to `playwright-report/` and `test-results/`, which are git-ignored.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `P1001: Can't reach database server` | PostgreSQL isn't running. Start it with `brew services start postgresql@18` (macOS) or start the service. |
| `P1000: Authentication failed` | Wrong user or password in the connection string. Homebrew and Postgres.app use your OS username with no password; Linux and Windows use `postgres` with the password you set. |
| `role "postgres" does not exist` | Homebrew and Postgres.app use your OS username. Change the user in the connection string. |
| `P1003: Database … does not exist` | The database user isn't allowed to create databases. Create it yourself (`createdb apparelflow`) or use a user that can. |
| `command not found: createdb` / `psql` | Homebrew's `postgresql@18` is keg-only. See [Option A](#option-a--macos-with-homebrew). |
| `AUTH_SECRET must be set …` | Set `AUTH_SECRET` in `.env` to at least 32 random characters. |
| Sign-in fails for the demo accounts | The database isn't seeded. Run `npm run db:seed`. |
| `Port 3000 is in use` | Stop the other process or run `npm run dev -- -p 3001`. |
| `TEST_DATABASE_URL is not set` | Add it to `.env` (see [Running the tests locally](#running-the-tests-locally)). |
| Stale Prisma client after pulling changes | Run `npm run db:generate` (or `npm install`). |
