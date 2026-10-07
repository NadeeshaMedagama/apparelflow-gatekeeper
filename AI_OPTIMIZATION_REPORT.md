# AI Optimization Report

This report documents, candidly, how AI was used to build ApparelFlow's Cutting Operations & Gatekeeper Verification
Terminal, where the AI-generated code was wrong or weak, how it was corrected, and how the system is structured so
that no client — and no future bug — can push an unverified batch onto the sewing floor.

---

## 1. Tools & prompting

| Tool | Used for |
| --- | --- |
| **Claude Code** (Anthropic's agentic coding CLI, Claude Opus model) | Reading the assessment PDF; architecture and schema design; Prisma schema and hand-written SQL migrations (integrity triggers, CHECK constraints, order-number sequence); domain logic; route handlers and services; the UI; unit, integration and end-to-end tests; documentation. It also ran the verification loop: TypeScript, ESLint, Vitest, Playwright, axe-core, cURL attack scripts and screenshot review. |
| _Candidate to complete_ | _List any other AI tools you used yourself (e.g. for preparing the implementation roadmap) and what for._ |

**Prompting approach.** The work was driven from two inputs supplied by the candidate: the assessment brief (PDF) and
a detailed implementation roadmap (stack, schema, endpoint list, test plan, the evaluator's 5-minute demo). The
instruction was to implement the complete project against the brief, ask when information was missing, use a
professional UI, and **not commit anything** so every file could be reviewed before submission.

Rather than accepting generated code on trust, every step was gated by an objective check — the same checks are part
of the repository and CI:

* `tsc --noEmit` in strict mode and ESLint (`next/core-web-vitals`, `typescript`);
* 131 Vitest tests, the integration half against a **real PostgreSQL** with the production migrations and triggers;
* Playwright journeys against a **production build** with **axe-core WCAG 2.1 AA** audits on eight screens;
* `prisma migrate diff` to prove the hand-written SQL causes no schema drift;
* direct SQL tampering attempts against the database guards and an API attack script (`scripts/audit-api.mjs`: 23 read-only / 33 full checks), which CI also runs against the Docker image;
* full-page screenshots of every screen, reviewed for layout and contrast.

## 2. Flawed / broken AI-generated code

Each item below is a real defect produced during this build, with how it was detected.

### 2.1 A test harness that could wipe a real database (dangerous default)

The first Playwright configuration started the app with
`npx prisma migrate reset --force && npm run build && next start`. `migrate reset --force` drops **every table** in
whatever database `DATABASE_URL` resolves to. If a developer's `.env` pointed at a shared or production database —
a common situation with Neon/Supabase — running the E2E suite would have silently destroyed it. The Prisma CLI's
own safety guard refused to run the destructive reset unattended, which exposed the problem.

*Why it matters:* test tooling runs often and with little scrutiny; destructive defaults are how real data is lost.

### 2.2 A business rule re-implemented in a React component with binary floating point

The live preview in the *New cutting order* dialog first computed expected fabric inline:

```tsx
formatYards(qty.value * (recipe?.stdFabricYards ?? 0))   // 3 × 1.1 = 3.3000000000000003
```

That duplicated a domain rule in the UI (exactly what the roadmap warned against) and used float arithmetic for a
value that is also written to the audit trail by the server, so the two could disagree.

### 2.3 Low-contrast colour choices — the brief's "zero-tolerance" defect class

* The sign-in pipeline diagram used white 11–12 px text on Tailwind `green-600` (≈ 3.3 : 1) and the sidebar's
  "Your station" indicator used white on `blue-500` (≈ 3.7 : 1) — both below WCAG AA's 4.5 : 1.
* The `create-next-app` scaffold that was used as a configuration reference ships a `globals.css` that, in an OS dark
  theme, sets body text to `#ededed` while form controls keep a white background: **white text on white inputs** —
  precisely the UAT defect described in the brief. Tailwind's default placeholder colour (50 % of `currentColor`,
  ≈ 3.4 : 1) is a second, subtler instance.

### 2.4 A status-transition helper whose types allowed the wrong payload

`applyTransition()` — the only code path allowed to change an order's status — first typed its extra update data as
`Prisma.CuttingOrderUpdateManyMutationInput`. That type rejects foreign-key columns such as `sewingStartedById`, so
`startSewingAssembly()` did not type-check, yet the seed script (run through `tsx`, which strips types) executed it
successfully and hid the error until `tsc` ran. The original type also allowed callers to pass `status`, competing
with the transition rule that is supposed to decide it.

### 2.5 A flaky accessibility test

The first axe-core audit of the verifier terminal reported a 1.16 : 1 contrast failure on *Approve batch*. The colours
it measured (`#969fad` on `#86b5a6`) belong to neither the disabled nor the enabled style: axe sampled the button
half-way through its 150 ms `transition-colors` animation, immediately after the last count made it enabled. The test,
not the UI, was wrong — but a flaky audit is worse than none because it teaches people to ignore it.

### 2.6 Layout defects only visible in rendered output

Screenshot review found that the count-sheet card stretched to the height of the side panel (a large empty area),
that the row status accent relied on `position: relative` on a `<tr>` (unreliable across browsers), and that order
numbers and fabric-roll IDs wrapped at their hyphens (`CUT-2026-` / `0007`) in the order table.

## 3. Refactoring & hardening

| Defect | Change | How it was verified |
| --- | --- | --- |
| 2.1 Destructive E2E reset | `tests/e2e/prepare-database.ts` now **creates** a brand-new database whose name must match `apparelflow_e2e_<run-id>` (it refuses any other name and fails if the database already exists), applies migrations with the non-destructive `migrate deploy`, and seeds it. `global-teardown.ts` drops only that run's database. The integration suite already worked this way: per-file databases cloned from a template. | E2E suite passes; database listing confirms nothing is left behind and no pre-existing database is touched. |
| 2.2 Float math in the UI | The preview calls the shared exact function `calculateExpectedFabricYards()` (scaled `BigInt` arithmetic in `src/domain/wastage.ts`). The rule exists once; the server and the UI import it. | Unit test *"rounds half away from zero without floating-point drift"* (asserts `3 × 1.1 = 3.3`). |
| 2.3 Contrast | Darker shades (`green-700`, `blue-600`); `color-scheme: light` on `:root`; explicit ink-on-white for every `input`, `select`, `textarea` and `option`; placeholder set to `slate-500` (4.7 : 1); slate-500 field borders (≥ 3 : 1 non-text contrast); a 3 px focus ring; readable disabled states (no opacity fades). The dark-mode block from the scaffold was never carried over. | axe-core WCAG 2.1 AA scans in Playwright on the sign-in page, order board, create dialog, terminal (shortage and ready states), reject dialog, sewing queue and audit record: **0 violations**. |
| 2.4 Transition typing | The payload is typed `Omit<Prisma.CuttingOrderUncheckedUpdateManyInput, "status">`, so foreign keys are allowed and **a caller cannot supply a status** — only the transition rule sets it. | `npm run typecheck` (in CI). |
| 2.5 Flaky audit | `expectAccessible()` waits until no CSS transition is running before calling axe, ignoring infinite animations such as spinners. | Repeated E2E runs are stable. |
| 2.6 Layout | `items-start` on the terminal grid, the row accent anchored to a `relative` table cell, `whitespace-nowrap` on identifiers, a wider dialog with compact column headers, short status labels on the dense order board. | Re-captured screenshots at 1440 px and 390 px widths. |

Further hardening decisions made while reviewing generated code, rather than in response to a failure:

* **No coercion of numbers.** Generated validation commonly reaches for `z.coerce.number()`, which turns `""`, `" "`
  and `null` into `0` and `"1e3"` into `1000`. All schemas use strict `z.number().int()`; forms parse text with a
  dedicated strict parser that produces a precise inline message for each failure mode (negative, decimal,
  non-numeric, empty).
* **Reject, don't ignore, unknown fields.** Strict object schemas turn a smuggled `status`, `verifierId` or
  `timestamp` into a 422 instead of silently dropping it, so tampering is visible.
* **Authorization before validation.** Route handlers authenticate (401), then authorize (403), and only then parse
  the body (422), so a supervisor probing the approve endpoint always gets 403 — never a validation hint.
* **Identity re-checked on every request.** The session JWT is only a pointer; the user and role are re-loaded from
  the database each time, so a deleted user or changed role cannot keep acting.

## 4. Defensive architecture

The design assumes that **every client-side control can be bypassed** and places the authoritative checks where the
client cannot reach them.

**State machine instead of status writes.** There is no endpoint that accepts a status. The five legal transitions
are named actions with exactly one permitted source status and one permitted role (`src/domain/state-machine.ts`,
`src/domain/roles.ts`). `applyTransition()` is the only code that changes `cutting_orders.status`; it runs inside a
transaction after `SELECT … FOR UPDATE` on the order row, performs a compare-and-set
`UPDATE … WHERE id = $1 AND status = <expected>` (zero rows updated → 409), and appends an immutable status event
attributed to the authenticated actor. A concurrency test fires three simultaneous approvals: exactly one returns 200,
the other two return 409, and exactly one audit record exists.

**The hard stop is evaluated by the server from persisted data.** `approveBatch()` loads the locked order with its
recipe and count sheet and calls the pure `evaluateVerificationGate()`. Requirements are derived from the **recipe**
(target × pieces per garment) rather than from anything the client sends — or even from the stored expectation alone —
so every component must be present, counted and not short. Any RED, missing or uncounted component returns
**422 `VERIFICATION_GATE_BLOCKED`** with per-component reasons, and nothing is written. Only when the gate passes does
the same transaction write the approval record (verifier from the session, database timestamp, server-computed
wastage, a frozen per-component snapshot) and move the order to `VERIFIED`.

**The database is the last line of defence.** Hand-written migrations add guards that hold even if the API is
bypassed:

* a trigger whitelists status transitions, refuses `VERIFIED` unless every recipe component has a counted, non-short
  count-sheet entry **and** an `APPROVED` verification record exists for the current QC round, and locks batch
  details once they leave the cutting table;
* `verification_logs`, `verification_log_items` and `order_status_events` are append-only (UPDATE/DELETE raise);
* a CHECK constraint makes it impossible to store a traffic light that contradicts its count, another requires a
  meaningful reason on every rejection, and the count sheet is locked outside its QC stage.

These were attacked directly with raw SQL — forcing a pending order to `VERIFIED`, skipping QC, sending a rejected
batch to sewing, rewriting wastage, deleting audit events, painting a short count GREEN, inserting an order as
`VERIFIED` — and every attempt was refused by PostgreSQL. The integration suite repeats these attacks through the ORM.

**Query isolation and non-disclosure.** The Sewing Queue query hard-codes `WHERE status = 'VERIFIED'` in the
database; query parameters are ignored. The sewing role loads only the `APPROVED` record of a batch, never rejection
history, and gets 404 — not 403 — for anything unverified, so the existence of pending or rejected work is not
revealed.

**Layered RBAC.** One permission matrix drives route handlers (403), Server Components (`forbidden()` → a real HTTP 403
page), every service method (re-checked, defence in depth) and the navigation. The `proxy.ts` redirect and the
disabled buttons are explicitly treated as UX only.

**Every rule is proven by a test.** The five tests required by the brief are labelled *Test 1*–*Test 5* in
`tests/integration/verification-gate.test.ts`; the remaining suites cover input guards, the re-cut loop, sewing
isolation, sessions and CSRF, the database guards, and the evaluator's browser journey with accessibility audits.

---

## Candidate review log

_To be completed by the candidate: what you verified yourself while reviewing the AI-generated code, any issues you
found or changed, and why. Evaluators assess your engineering judgment — record your own findings here in your own
words._
