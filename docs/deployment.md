# Deployment

This guide puts ApparelFlow online with **Vercel** (runs the app) and **Neon** (serverless PostgreSQL), step by step.
The first deployment takes about 20 minutes; after that, every merge to `main` deploys by itself.
A production **Docker image** is also published for self-hosting — see [Docker image](#docker-image).

- [How it works](#how-it-works)
- [Before you start](#before-you-start)
- [Step 1 — Create the Neon database](#step-1--create-the-neon-database)
- [Step 2 — Create the tables and demo data](#step-2--create-the-tables-and-demo-data)
- [Step 3 — Create a database branch for previews](#step-3--create-a-database-branch-for-previews)
- [Step 4 — Create the Vercel project](#step-4--create-the-vercel-project)
- [Step 5 — Add the environment variables](#step-5--add-the-environment-variables)
- [Step 6 — Connect GitHub Actions to Vercel](#step-6--connect-github-actions-to-vercel)
- [Step 7 — Deploy](#step-7--deploy)
- [Step 8 — Check that it works](#step-8--check-that-it-works)
- [After the first deployment](#after-the-first-deployment)
- [Troubleshooting](#troubleshooting)
- [Docker image](#docker-image)
- [Production checklist](#production-checklist)

## How it works

```mermaid
flowchart LR
  MAIN["Push / merge to main"] --> CI["CI/CD Pipeline<br/>lint · tests · E2E"]
  CI -- "green" --> DEP["Deploy Production<br/>(GitHub Actions)"]
  DEP -- "1 · migrate<br/>direct connection" --> NEON[("Neon PostgreSQL<br/>US East")]
  DEP -- "2 · build + deploy" --> APP["Vercel<br/>iad1 · US East"]
  APP -- "queries<br/>pooled connection" --> NEON
  DEP -- "3 · smoke test" --> APP
```

- **Production deploys only come from GitHub Actions.** `vercel.json` stops Vercel from deploying `main` on its own,
  so database migrations always run from a commit that passed CI, *before* the new code goes live.
- **Every other branch and pull request** still gets a Vercel preview deployment. Previews use their own Neon
  branch, so they can never change production data.
- **The app and the database run in the same region** — Vercel `iad1` (Washington, D.C.) and Neon `aws-us-east-1`
  (N. Virginia). Each page runs several queries, so a database in another region would make every page slow.
- **Two connection strings.** The app uses Neon's *pooled* connection (built for many short-lived serverless
  functions). Migrations use the *direct* connection.

What the repository already configures — nothing to change in the Vercel settings:

| File | What it does |
| --- | --- |
| `vercel.json` | Build command `npm run vercel-build`, function region `iad1`, no automatic production deploys from `main` |
| `package.json` | `vercel-build` = `prisma generate && next build` (it never migrates); `engines` makes Vercel use Node.js 24 |
| `prisma/schema.prisma` | `DATABASE_URL` for the app, `DIRECT_URL` for migrations, and the Prisma engine for Vercel's Linux runtime |
| `.github/workflows/deploy-production.yml` | Migrate → build → deploy → smoke test |

## Before you start

You need:

- A free [Neon](https://neon.com) account and a free [Vercel](https://vercel.com/signup) account (the Hobby plan is
  enough). Sign up to Vercel with GitHub — connecting the repository is easier.
- Admin access to the GitHub repository (to add secrets).
- On your computer, inside a clone of the repository: Node.js 24 (`node --version`), `npm install` already run, and
  the [GitHub CLI](https://cli.github.com) signed in (`gh auth status`). The GitHub CLI is optional — every `gh`
  command below also has a web alternative.

## Step 1 — Create the Neon database

1. Open the [Neon console](https://console.neon.tech) and create a new project:
   - **Project name:** `apparelflow`
   - **Postgres version:** keep the default
   - **Cloud provider:** AWS
   - **Region:** **AWS US East (N. Virginia)**. This must match `regions` in `vercel.json`, and Neon can't move a
     project to another region later. To use another region, see [Using another region](#using-another-region).
2. Neon creates a default branch (named `production` or `main`) with a database `neondb` and an owner role
   `neondb_owner`.
3. Click **Connect** on the project dashboard, keep the default branch selected, and copy two connection strings:
   - **Pooled** — with **Connection pooling** turned **on**. Its host contains `-pooler`.
   - **Direct** — with **Connection pooling** turned **off**. Its host has no `-pooler`.
4. Add these parameters to the end of each string (after the `?sslmode=require&channel_binding=require` that Neon
   already includes):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` (the app) | pooled string **+** `&pgbouncer=true&connection_limit=1&connect_timeout=15` |
   | `DIRECT_URL` (migrations) | direct string **+** `&connect_timeout=15` |

   For example (made-up values):

   ```text
   DATABASE_URL  postgresql://neondb_owner:npg_XXXX@ep-cool-sun-a1b2c3d4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&pgbouncer=true&connection_limit=1&connect_timeout=15
   DIRECT_URL    postgresql://neondb_owner:npg_XXXX@ep-cool-sun-a1b2c3d4.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require&connect_timeout=15
   ```

   What the parameters do:
   - `pgbouncer=true` tells Prisma it is talking to a connection pooler.
   - `connection_limit=1` keeps one connection per serverless function instance; Neon's pooler shares them.
   - `connect_timeout=15` gives the database time to wake up. On the Free plan Neon pauses an idle database after a
     few minutes, and the first request afterwards would otherwise fail after Prisma's default 5 seconds.

Keep both strings private: they contain the database password. If one leaks, reset the role's password in the Neon
console and update it everywhere you used it (steps 2, 5 and 6).

> **Created the database from Vercel instead** (Vercel → **Storage** → Neon)? That's the same Neon, managed through
> Vercel. The differences:
>
> - Its region is the one you picked there. `regions` in `vercel.json` must be the matching Vercel region.
> - Vercel shows its connection strings on the database's page: `DATABASE_URL` is the pooled one and
>   `DATABASE_URL_UNPOOLED` the direct one. Add the parameters above when you use them in steps 2 and 6.
> - Vercel adds `DATABASE_URL` to the project itself, so in step 5 you only add `AUTH_SECRET`. Leave Vercel's
>   `DATABASE_URL` as it is — it works without the extra parameters.
> - In the database's settings in Vercel, connect it to **Production** and **Preview** only (local development keeps
>   your own database), and turn on preview branching — each preview deployment then gets its own Neon branch, which
>   replaces step 3.
> - Don't paste Vercel's `.env.local` snippet into `.env`: its `DATABASE_URL` would replace your local one.

## Step 2 — Create the tables and demo data

Run this once, from the repository folder. Use the **direct** string for both variables and keep the single
quotes — the `&` characters in the URL would otherwise break the command.

```bash
DATABASE_URL='<direct string from step 1>' DIRECT_URL='<direct string from step 1>' npm run db:setup
```

Windows PowerShell:

```powershell
$env:DATABASE_URL='<direct string>'; $env:DIRECT_URL='<direct string>'; npm run db:setup
```

This applies the migrations in `prisma/migrations` (tables, constraints and the gatekeeper triggers), then seeds:

- the three demo accounts — password `ApparelFlow@2026` — used to sign in and by the post-deploy smoke test,
- the two recipes, and five demo batches covering every status.

The output ends with `Seed complete.` Running it again is safe. To skip the demo batches, put `SEED_DEMO_ORDERS=false`
in front of `npm run db:setup`.

## Step 3 — Create a database branch for previews

Preview deployments must not use the production database. A Neon branch gives them an instant copy of it:

1. In the Neon console open **Branches** and create a new branch named `preview`, with your default branch as the
   parent. Because step 2 is done, it starts with the same tables and demo data.
2. Click **Connect**, select the `preview` branch, and copy its pooled and direct strings. Add the same parameters as
   in step 1.

When a pull request adds a new migration, apply it to the `preview` branch so its preview keeps working:

```bash
DATABASE_URL='<preview direct string>' DIRECT_URL='<preview direct string>' npm run db:migrate
```

To start over with fresh production data, use **Reset from parent** on the `preview` branch in Neon.

## Step 4 — Create the Vercel project

Run these from the repository folder. They create the project without deploying anything yet:

```bash
npx vercel@62 login                                  # opens the browser to sign in
npx vercel@62 link --yes --project apparelflow-erp   # creates the project and links this folder to it
npx vercel@62 git connect --yes                      # connects the GitHub repository (for previews)
```

- `link` writes `.vercel/project.json` (git-ignored). It holds the two IDs that step 6 needs.
- Vercel detects Next.js and takes the build command and region from `vercel.json`. Leave the project's build settings
  as they are.
- If `git connect` reports that Vercel can't access the repository, install the Vercel GitHub app for it (the error
  links to the page), then run the command again.

> **Prefer the dashboard?** You can import the repository at [vercel.com/new](https://vercel.com/new) instead. Don't
> add environment variables on the import screen — they would apply to every environment; add them in step 5. If
> Vercel starts a first deployment, ignore it: it has no database settings yet, and step 7 replaces it. You'll find
> the IDs for step 6 under **Project Settings → General → Project ID** and **Team Settings → General → Team ID**.

## Step 5 — Add the environment variables

In the Vercel dashboard open the project → **Settings → Environment Variables**. Add each row below as its own
variable. Tick **only** the environment named in the row and choose the type **Secret**. (Database created from
Vercel's Storage tab? Then `DATABASE_URL` comes from the Neon integration — add only the `AUTH_SECRET` rows.)

| Key | Environment | Value |
| --- | --- | --- |
| `DATABASE_URL` | Production | The production **pooled** string from step 1, with its parameters |
| `AUTH_SECRET` | Production | A new random secret (see below) |
| `DATABASE_URL` | Preview | The `preview` branch **pooled** string from step 3, with its parameters |
| `AUTH_SECRET` | Preview | A **different** random secret |

Create each secret with either command:

```bash
openssl rand -base64 48
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Good to know:

- `DIRECT_URL` is **not** needed in Vercel. The running app only uses `DATABASE_URL`; migrations run in GitHub
  Actions with the `PRODUCTION_DIRECT_URL` secret (step 6).
- Leave **Development** unticked. Local development keeps using your own `.env`.
- `NEXT_PUBLIC_PLANT_TIMEZONE` is optional. Add it (type **Config**, Production and Preview) only if the plant is not
  in `Asia/Colombo`.
- Changes reach **new** deployments only. If you edit a variable later, deploy again (step 7).

## Step 6 — Connect GitHub Actions to Vercel

The **Deploy Production** workflow needs four secrets.

1. Create a Vercel token at [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens): name it
   `github-actions`, choose the team that owns the project as its scope, pick an expiry, and copy it.
2. From the repository folder, run the commands below. `gh secret set` without `--body` asks you to paste the value,
   so it never lands in your shell history.

   ```bash
   gh secret set VERCEL_TOKEN              # paste the token from 1
   gh secret set PRODUCTION_DIRECT_URL     # paste the production direct string from step 1
   gh secret set VERCEL_ORG_ID     --body "$(node -p "require('./.vercel/project.json').orgId")"
   gh secret set VERCEL_PROJECT_ID --body "$(node -p "require('./.vercel/project.json').projectId")"
   ```

   On the web instead: repository **Settings → Secrets and variables → Actions → New repository secret**, once per
   name. `orgId` and `projectId` are in `.vercel/project.json`.

Optional: under repository **Settings → Environments → production**, add required reviewers so that each production
deployment waits for your approval. The environment appears after the first deployment.

## Step 7 — Deploy

Start the workflow from the `main` branch:

```bash
gh workflow run deploy-production.yml --ref main   # or: GitHub → Actions → Deploy Production → Run workflow
gh run watch                                       # pick the run to follow it live
```

In a few minutes it:

1. applies any pending migrations to Neon through `PRODUCTION_DIRECT_URL`,
2. pulls the Production settings from Vercel and builds the app (`vercel build --prod`),
3. deploys the build to production (`vercel deploy --prebuilt --prod`),
4. smoke-tests the live site with the read-only gatekeeper audit — once `PRODUCTION_URL` is set (step 8).

From now on, every push to `main` that passes CI/CD deploys the same way. If a secret is missing, the job is skipped
with the warning *Production deployment skipped* instead of failing.

## Step 8 — Check that it works

1. Find the production domain under the project's **Settings → Domains** in Vercel — for example
   `https://apparelflow-erp.vercel.app`. Use this domain, not a deployment URL such as
   `apparelflow-erp-abc123.vercel.app`: Vercel's deployment protection puts those behind a Vercel sign-in.
2. Check the database connection:

   ```bash
   curl https://<your-domain>/api/health
   # {"success":true,"data":{"status":"ok","database":"up","time":"…"}}
   ```

3. Open the domain in a browser and sign in with a demo account, for example `supervisor@apparelflow.demo` /
   `ApparelFlow@2026`.
4. Run the security audit. It is read-only, so it's safe on production. Every check should pass.

   ```bash
   npm run audit:api -- https://<your-domain>
   ```

5. Save the domain as a repository variable, so that every future deployment is smoke-tested automatically:

   ```bash
   gh variable set PRODUCTION_URL --body "https://<your-domain>"
   ```

   On the web: **Settings → Secrets and variables → Actions → Variables → New repository variable**.

6. Optional: put the URL in the **Live demo** row at the top of the README.

## After the first deployment

| Task | How |
| --- | --- |
| Ship a change | Merge to `main`. CI/CD runs, then Deploy Production migrates and deploys. |
| Change the database schema | Add a migration under `prisma/migrations`. The deploy applies it before the new code goes live, so keep it compatible with the version still running. |
| Preview a branch | Push it. Vercel posts the preview URL on the pull request (open to members of your Vercel team). New migrations go to the `preview` Neon branch — see step 3. |
| Roll back | Vercel → **Deployments** → the previous production deployment → **Instant Rollback**. Database migrations are **not** rolled back. |
| Change a secret | Update it in Vercel (and the GitHub secret, for `PRODUCTION_DIRECT_URL`), then deploy again. A new `AUTH_SECRET` signs everyone out. |
| Add your own domain | Vercel → **Settings → Domains** → add it, then update `PRODUCTION_URL`. |

### Using another region

Pick a Neon region and the Vercel region next to it, and set the Vercel code in `vercel.json` →
`"regions": ["<code>"]`. Both must be decided before you create the Neon project.

| Neon region | Vercel region |
| --- | --- |
| AWS US East (N. Virginia) — `aws-us-east-1` | `iad1` (this repository's setting) |
| AWS US East (Ohio) — `aws-us-east-2` | `cle1` |
| AWS US West (Oregon) — `aws-us-west-2` | `pdx1` |
| AWS Europe (Frankfurt) — `aws-eu-central-1` | `fra1` |
| AWS Europe (London) — `aws-eu-west-2` | `lhr1` |
| AWS Asia Pacific (Singapore) — `aws-ap-southeast-1` | `sin1` |
| AWS Asia Pacific (Sydney) — `aws-ap-southeast-2` | `syd1` |
| AWS South America (São Paulo) — `aws-sa-east-1` | `gru1` |

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Deploy Production says *Production deployment skipped* | A secret is missing. Check the four names in step 6. |
| `/api/health` returns 503 *Database is unreachable* | `DATABASE_URL` is missing or wrong for that environment, or it was added after the deployment. Fix it in Vercel and deploy again. The function logs (Vercel → **Logs**) show the exact error. |
| `P1001: Can't reach database server` during step 2 | The URL is wrong or not quoted. Keep it in single quotes and check that you copied the whole string. |
| Migrations fail or time out | `DIRECT_URL` / `PRODUCTION_DIRECT_URL` uses the `-pooler` host. Use the direct string. |
| The first request after a quiet period is slow | Neon's Free plan pauses idle databases, and waking takes a moment. `connect_timeout=15` lets that request wait instead of failing. |
| `P2024: Timed out fetching a new connection from the connection pool` | Many requests arrive at once with `connection_limit=1`. Raise it to `3` or `5` in `DATABASE_URL`. |
| Every page is slow, even right after another request | Vercel and Neon are in different regions. See [Using another region](#using-another-region). |
| Sign-in fails for the demo accounts | The database isn't seeded. Run step 2. |
| Logs show `AUTH_SECRET must be set …` | `AUTH_SECRET` is missing or shorter than 32 characters for that environment. Add it and deploy again. |
| The smoke test fails with HTTP 401 | `PRODUCTION_URL` is a deployment URL behind Vercel's protection. Use the production domain. |
| A preview shows errors | The Preview variables are missing, or the `preview` Neon branch lacks a new migration. See step 3. |

## Docker image

Published by GitHub Actions to Docker Hub (`<user>/apparelflow-erp`) and GitHub Packages
(`ghcr.io/<owner>/apparelflow-erp`). Each release publishes `X.Y.Z`, `X.Y`, `X` and `latest` for `linux/amd64` and
`linux/arm64`; every push to `main` also publishes an `edge` image for `linux/amd64`.

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" -e AUTH_SECRET="$(openssl rand -base64 48)" \
  <dockerhub-user>/apparelflow-erp:latest          # or ghcr.io/<owner>/apparelflow-erp:latest
```

The image runs the Next.js standalone server as the unprivileged `node` user on port 3000, with a health check on
`/api/health`. It does not migrate the database — run `npm run db:migrate` against the target database, or use the
`migrator` build target:

```bash
docker build -f docker/Dockerfile --target migrator -t apparelflow-erp-migrator .
docker run --rm -e DATABASE_URL="…" -e DIRECT_URL="…" apparelflow-erp-migrator
```

Build the application image locally from the repository root with `npm run docker:build`
(`docker build -f docker/Dockerfile -t apparelflow-erp .`). The build context is filtered by
`docker/Dockerfile.dockerignore`.

## Production checklist

- [ ] The Neon project and `regions` in `vercel.json` are in the same place (US East: `aws-us-east-1` / `iad1`).
- [ ] Vercel's `DATABASE_URL` is the **pooled** string with `pgbouncer=true&connection_limit=1&connect_timeout=15`;
      the GitHub secret `PRODUCTION_DIRECT_URL` is the **direct** string.
- [ ] Preview deployments use the `preview` Neon branch, never production.
- [ ] `AUTH_SECRET` is a fresh random value (≥ 32 characters), different for Production, Preview and local development.
- [ ] Migrations are applied and the demo data is seeded (step 2).
- [ ] `/api/health` reports `"database":"up"`, and `npm run audit:api -- <production-url>` passes.
- [ ] The `PRODUCTION_URL` variable is set, so every deployment is smoke-tested.
- [ ] Optional: the `production` environment has required reviewers, if deployments should wait for approval.
- [ ] The demo accounts share a public password. That's fine for a demo, but don't keep real factory data behind them.
