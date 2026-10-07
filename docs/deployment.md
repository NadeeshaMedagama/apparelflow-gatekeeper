# Deployment

ApparelFlow deploys to **Vercel** with a managed **PostgreSQL** (Neon or Supabase). Production deployments run from
GitHub Actions (`Deploy Production`) after the CI/CD pipeline is green on `main`:
**migrate → build → deploy → smoke-test**, so database migrations only ever run from a verified commit.
A production **Docker image** is also published for self-hosting.

- [Vercel + Neon / Supabase](#vercel--neon--supabase)
- [Docker image](#docker-image)
- [Production checklist](#production-checklist)

## Vercel + Neon / Supabase

1. **Database.** Create a Neon (or Supabase) PostgreSQL database.
   * `DATABASE_URL` — the **pooled** connection string with `&pgbouncer=true&connection_limit=1` appended
     (Supabase: the transaction pooler on port 6543).
   * `DIRECT_URL` — the **direct** (non-pooled) connection string.
2. **Vercel project.** Create the project (import the repository or run `vercel link`) and set `DATABASE_URL`,
   `DIRECT_URL` and `AUTH_SECRET` for Production (and Preview). `vercel.json` turns off Vercel's own automatic
   deployments of `main`, so production only changes through the gated workflow; pull-request previews still work.
3. **GitHub secrets.** Add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (from `.vercel/project.json` after
   `vercel link`) and `PRODUCTION_DIRECT_URL` (the direct database URL used for migrations), plus the
   `PRODUCTION_URL` variable (e.g. `https://apparelflow.vercel.app`) for the post-deploy smoke test.
   See [CI/CD & GitHub automation](./ci-cd.md#secrets--variables).
4. **Migrate and seed once** from your machine against the production database:
   ```bash
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" npm run db:setup
   ```
5. **Verify**: open `/api/health`, then run `npm run audit:api -- https://<your-app>.vercel.app`.

The `vercel-build` script only generates the Prisma client and builds (`prisma generate && next build`); it never
migrates, so a preview build can never change the production schema.

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

- [ ] `AUTH_SECRET` is a fresh random value (≥ 32 characters) and differs from development.
- [ ] `DATABASE_URL` uses the pooled connection; `DIRECT_URL` / `PRODUCTION_DIRECT_URL` the direct one.
- [ ] Migrations applied (`npm run db:migrate` or the Deploy Production workflow) and demo data seeded.
- [ ] `/api/health` reports `database: up`.
- [ ] `npm run audit:api -- <production-url>` passes.
- [ ] The `production` environment has required reviewers if deployments should need manual approval.
