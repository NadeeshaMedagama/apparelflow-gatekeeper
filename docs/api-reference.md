# API reference

All endpoints live under `/api`, use JSON, and authenticate with the `af_session` HttpOnly cookie issued by
`POST /api/auth/login`.

## Response envelope

```jsonc
{ "success": true,  "data": { /* … */ } }
{ "success": false, "error": { "code": "VERIFICATION_GATE_BLOCKED", "message": "…", "details": { /* … */ } } }
```

## Status codes

| Code | Meaning |
| --- | --- |
| **400** | Malformed JSON |
| **401** | Not signed in, or the session is invalid / expired |
| **403** | Role not permitted, or a cross-origin state-changing request |
| **404** | Not found, or not visible to the caller's role |
| **409** | Illegal state transition or concurrent change |
| **422** | Validation failure or business-rule violation — including the verification hard stop |
| **500** | Unexpected error (details are logged server-side, never returned) |

Checks run in a fixed order — authenticate (401), authorize (403), then validate the body (422) — so a caller without
the right role always receives 403, never a validation hint.

## Endpoints

| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | public | Sign in; sets the session cookie |
| `POST` | `/api/auth/logout` | any | Clear the session |
| `GET` | `/api/auth/me` | any signed-in | Current user and effective permissions |
| `GET` | `/api/health` | public | Liveness + database connectivity |
| `GET` | `/api/recipes`, `/api/recipes/:id` | all roles | Recipes with components |
| `GET` | `/api/cutting-orders?status=` | supervisor | Order board (validated status filter) |
| `POST` | `/api/cutting-orders` | supervisor | `{ recipeId, targetQty, fabricRollId, actualFabricYds, submitForVerification? }` → 201 |
| `GET` | `/api/cutting-orders/:id` | supervisor | Detail: expected components, count sheet, QC records, timeline |
| `PATCH` | `/api/cutting-orders/:id` | supervisor | Edit `targetQty` / `fabricRollId` / `actualFabricYds` while in cutting (409 `ORDER_LOCKED` otherwise) |
| `POST` | `/api/cutting-orders/:id/submit` | supervisor | `CUTTING_IN_PROGRESS → PENDING_VERIFICATION` |
| `POST` | `/api/cutting-orders/:id/recut` | supervisor | `REJECTED → CUTTING_IN_PROGRESS` |
| `GET` | `/api/verifications/pending` | verifier | QC queue, oldest first |
| `GET` | `/api/verifications/history?limit=` | verifier | Immutable decision log |
| `GET` | `/api/verifications/:orderId` | verifier | Count sheet with the live gate verdict and wastage |
| `PUT` | `/api/verifications/:orderId/items` | verifier | `{ items: [{ componentId, actualQty }] }` — status is derived by the server |
| `POST` | `/api/verifications/:orderId/approve` | verifier | Hard-stop approval; optional `{ note }` |
| `POST` | `/api/verifications/:orderId/reject` | verifier | `{ reason, category? }` |
| `GET` | `/api/sewing/queue` | sewing | `VERIFIED` batches only |
| `GET` | `/api/sewing/assembly` | sewing | Batches already on the line |
| `GET` | `/api/sewing/queue/:orderId` | sewing | Verified batch with its approval record (404 for anything unverified) |
| `POST` | `/api/sewing/queue/:orderId/start` | sewing | `VERIFIED → SEWING_IN_PROGRESS` |

Request schemas are strict: unknown fields (for example a smuggled `status`, `verifierId` or `timestamp`) are rejected
with 422. Quantities and piece counts must be JSON integers; numeric strings, decimals, negatives and `null` are
rejected. Schemas live in `src/domain/validation.ts`.

## cURL examples

```bash
BASE=http://localhost:3000            # or your deployment URL
PW='ApparelFlow@2026'

# Sign in as each persona (cookie jars)
curl -s -c sup.jar -H 'Content-Type: application/json' -d "{\"email\":\"supervisor@apparelflow.demo\",\"password\":\"$PW\"}" $BASE/api/auth/login
curl -s -c ver.jar -H 'Content-Type: application/json' -d "{\"email\":\"verifier@apparelflow.demo\",\"password\":\"$PW\"}"   $BASE/api/auth/login
curl -s -c sew.jar -H 'Content-Type: application/json' -d "{\"email\":\"sewing@apparelflow.demo\",\"password\":\"$PW\"}"     $BASE/api/auth/login

ORDER=<id of a PENDING_VERIFICATION order>   # e.g. from: curl -s -b ver.jar $BASE/api/verifications/pending

curl -s -b sup.jar -X POST $BASE/api/verifications/$ORDER/approve      # 403 FORBIDDEN (separation of duties)
curl -s -b ver.jar -X POST $BASE/api/verifications/$ORDER/approve      # 422 VERIFICATION_GATE_BLOCKED (uncounted / short)
curl -s -b ver.jar -H 'Content-Type: application/json' \
     -d '{"verifierId":"someone-else"}' -X POST $BASE/api/verifications/$ORDER/approve   # 422 unrecognized key
curl -s -b ver.jar -H 'Content-Type: application/json' -d '{}' $BASE/api/verifications/$ORDER/reject   # 422 reason required
curl -s -b sew.jar "$BASE/api/sewing/queue?status=PENDING_VERIFICATION"   # still VERIFIED batches only
curl -s -b sew.jar $BASE/api/sewing/queue/$ORDER                          # 404 — not visible to sewing
```

## Automated audit

`scripts/audit-api.mjs` runs the whole checklist against any running deployment and prints PASS/FAIL per check:

```bash
npm run audit:api -- $BASE                 # read-only (23 checks) — never creates data, safe on production
npm run audit:api -- $BASE --mode=full     # + full lifecycle (33 checks): shortage → reject → re-cut → approve → sewing
```

The same script is published as the `ApparelFlow Gatekeeper Audit` GitHub Action (`action.yml`) — see
[CI/CD & GitHub automation](./ci-cd.md#using-the-gatekeeper-audit-action).
