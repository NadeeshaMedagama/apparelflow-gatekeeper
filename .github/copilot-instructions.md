# ApparelFlow ERP — review instructions for GitHub Copilot

ApparelFlow implements the cutting → QC → sewing hand-off of a garment ERP. Its core promise is that **no unverified,
mismatched or short batch can ever reach the Sewing Queue**, enforced on the server. When reviewing a pull request,
prioritise the invariants below over style.

## Security invariants (flag any violation as high severity)

1. **Status is never written from client input.** Order status changes only through the named actions in
   `src/domain/state-machine.ts`, applied by `applyTransition()` in `src/server/services/shared.ts` (row lock +
   compare-and-set + status event). Flag any new endpoint, service or query that sets `status` directly.
2. **The approval hard stop stays server-side.** `approveBatch()` in `src/server/services/verification.ts` must
   evaluate `evaluateVerificationGate()` from persisted counts against the recipe (target × pieces per garment)
   inside the approval transaction. RED, missing or uncounted components must return 422 and write nothing.
3. **Identity comes from the session.** Verifier IDs, actors and timestamps come from `authenticateRequest()` /
   `getCurrentUser()` and the database — never from request bodies, query strings or headers.
4. **Authorize before validating.** Route handlers call `requirePermission()` (401/403) before parsing the body
   (422). Services also call `assertPermission()`. Permissions come only from `src/domain/roles.ts`.
5. **Strict input schemas.** Request schemas in `src/domain/validation.ts` use `z.strictObject` and never
   `z.coerce`; piece counts and quantities are whole numbers.
6. **Sewing isolation.** Sewing queries filter `status = 'VERIFIED'` in the database query; unverified orders return
   404 (not 403) to the sewing role, which only ever sees the APPROVED verification record.
7. **Audit data is append-only.** Never add UPDATE/DELETE paths for `verification_logs`, `verification_log_items` or
   `order_status_events`. Database triggers in `prisma/migrations/*_integrity_guards` enforce this — schema changes
   must keep those guards (and the state-machine trigger) consistent with the TypeScript rules.

## Correctness & data

- Money-like and audit values (fabric yards, wastage %) use the exact helpers in `src/domain/decimal.ts` and
  `src/domain/wastage.ts`; flag floating-point arithmetic on them.
- Business rules belong in `src/domain` (pure, shared by server and UI); flag duplicated rules in React components.
- Multi-step writes must run in one `inTransaction()`; flag writes outside a transaction that touch an order.
- Migrations are additive and must be backward compatible with the currently deployed code.

## UI & accessibility

- Form controls keep explicit ink-on-white colours, visible borders and focus rings; disabled states stay readable
  (no opacity fades). Flag contrast below WCAG 2.2 AA and colour-only status signals.
- Client components call the REST API through `apiRequest()` and refresh server components after mutations.

## Tests

- New rules need unit tests (`tests/unit`) and, for anything touching the API or database, integration tests
  (`tests/integration`) that run against real PostgreSQL. The five required gate tests in
  `tests/integration/verification-gate.test.ts` must keep passing.

## Workflows

- Third-party actions are pinned to full commit SHAs with a version comment; keep permissions least-privilege and
  never interpolate untrusted event data directly into `run:` scripts — pass it through `env:`.
