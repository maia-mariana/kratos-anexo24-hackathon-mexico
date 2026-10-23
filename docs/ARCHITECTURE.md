# KRATOS-Anexo24 — Architecture Map & Integration Strategy

**Branch**: `feat/consolidacion-kontrol24-integrity`  
**Date**: 2026-10-23  
**Author**: Integration orchestration session  
**Status**: Phase 1 baseline — before any code modification

---

## 1. Current-State Map (Three Sources)

| Source | Repo / Location | Type | Key Findings |
|---|---|---|---|
| **KRATOS (base)** | `maia-mariana/kratos-anexo24-hackathon-mexico` (cloned local) | Static HTML/CSS/JS (4 files) | 2384-line `app.js` with browser-only engine, localStorage persistence, 9 views, 5 roles, PEPS/FIFO/Art.108/IGI-IVA-DTA rules, CSV reconciliation display-only, no tests, no auth, no movement ledger, all balances mutable scalars, FNV-1a 32-bit log hash (no verification). |
| **KONTROL 24 (UI)** | `https://hidden-project-horizons.lovable.app/` (published, assets in `/tmp/kontrol24`) | React + Tailwind v4 (SSR via TanStack Start), 5 routes, Supabase configured but unused at runtime | Polished visual system (Inter/JetBrains Mono/Plus Jakarta Sans, Material Symbols), KPI cards, tables, SVG charts, decision matrix, AI drawer, audit timeline. **All data hardcoded mock**; every CTA inert (text-based delegation, dead inline scripts); fabricated legal/crypto/SAT claims ("42ms SAT node", "SHA-256 verified", "100% legal"). No file upload, no real state. |
| **Sentinel (Inspector)** | `/Users/fmf/Documents/immex-sentinel` (local) | Next.js 15 + WebCrypto + Solana web3.js | Pure canonicalization (key-sort + JSON.stringify + SHA-256), deterministic diff (field-level, severity), local rule engine + OpenAI optional, Solana Devnet memo anchor (server with secret key OR Phantom wallet). **No raw-byte hashing, no file ingestion, no canonical version tag, no manifest, no persistence, no verified on-chain transaction**. 9 smoke tests pass (happy path only). |

---

## 2. Target Architecture (Static-App + Real Engine)

### Constraint from Brief
- Base = KRATOS static repo (user decision).
- No framework migration unless justified.
- Must satisfy Fase 3 (ledger source of truth, PEPS reproducible, reversals, idempotency, exposure audit trail, multi-company isolation when persistence exists).
- Fase 5: evaluate persistence; if only browser, don't claim multiuser.
- Fase 4: integrity inspector with real SHA-256, canonical diff, explain, optional Solana anchor (real or honest dry-run).

### Chosen Stack
- **Runtime**: Browser (ES modules), Node for tests (`node:test` + Playwright).
- **Build**: None (static). Optionally `vite build` later if module size grows — document first.
- **Persistence**:
  - **Ledger + settings** → `localStorage` (single-key, schema-versioned, migration function).
  - **Documents (files)** → `IndexedDB` (binary blobs, per-document SHA-256).
- **Crypto**: WebCrypto `crypto.subtle.digest('SHA-256')` (browser-native, same as Sentinel).
- **Tests**: `node:test` (pure engine) + Playwright (E2E flows).
- **Server**: Not in this increment. Documented interface for future `express`/`vercel` adapter.

### Data Model (Ledger-First)

```
Company
  id, rfc, name, plant, perfil, createdAt

Material (catalog, per company or shared)
  id, companyId?, name, corto, fraccion, um, igiRate, plazoMeses, baseUnit, createdAt

Pedimento
  id, companyId, numero, clave, aduana, patente, fechaPago, rfc, createdAt, idempotencyKey

Partida (pedimento line)
  id, pedimentoId, materialId, cantidadInicial, valorUnitarioMXN, igiRate, plazoMeses

Movement (append-only, source of truth)
  id, companyId, kind: ENTRY|CONSUMPTION|SCRAP|RECYCLE|EXPORT|RETURN|TRANSFER|ADJUSTMENT|REVERSAL
  refs: {pedimentoId?, partidaId?, materialId?, lotId?}
  qtyBase (integer, base unit), unit, unitCostMXN (integer cents)
  timestamp, actor, reason, reversesMovementId?, idempotencyKey, schemaVersion

Lot (derived view: saldo per pedimento+partida)
  id = `L-${partidaId}`, companyId, partidaId, saldo (derived = sum(movements)), vence, estado

Document (IndexedDB)
  id, companyId, name, mime, size, sha256Bytes, canonicalSha256, canonicalVersion, extractedJSON, createdAt

Inspection
  id, companyId, originalDocId, comparedDocId, findings[], rulesVersion, manifestSha256, aiExplanation, anchor{network, status, signature, slot, error}, createdAt

AuditEvent (append-only chain, async)
  id, companyId, prevHash, payload (canonical JSON of movement/inspection/doc), hash, timestamp
```

**Derived = never stored independently**. Balances, exposure, compliance, semáforo = pure reads over `Movement`.

### Engine Modules (Pure ES, No DOM)

| Module | Responsibility | Key Contracts |
|---|---|---|
| `ledger.js` | CRUD movements, idempotency, reversal, balance derivation, audit chain append | `appendMovement(m) -> {movement, newBalances, auditEvent}` |
| `peps.js` | Deterministic FIFO assignment of consumption to eligible lots | `planConsumption(materialId, qty, pieces, bomVersion) -> Plan[]`; `applyPlan(plan) -> movements[]` |
| `deadlines.js` | Art. 108 calendar, semáforo buckets (expired, critical ≤30, warning 31-60, ok) | `computeDeadlines(lots, refDate) -> LotsWithMeta` |
| `exposure.js` | IGI + IVA + DTA + multa over `saldo * unitCost` | `exposure(lots, refDate) -> {perLot, totals, buckets}` |
| `reconcile.js` | CSV parse (| ; ,), alias header map, compare SAT vs agent, diff table | `reconcile(satText, agentText) -> {matches, diffs, stats}` |
| `compliance.js` | Index, gates, Pareto, tasks, exceptions | `score(state) -> {score, gate, actions[]}` |
| `canonical.js` | Key-sort + JSON.stringify + SHA-256 (WebCrypto), versioned | `canon(v, value) -> {canonical, sha256}` |
| `diff.js` | Flatten + key union + string compare + severity rules | `diff(orig, curr) -> FieldDiff[]` |
| `inspector.js` | Ingest file/JSON → canon → diff → explain (local) → manifest → anchor | `inspect(original, compared, opts) -> InspectionResult` |
| `anchor.js` | Phantom wallet memo (Devnet) OR serverless proxy; dry-run honest | `anchor(hash, eventId, opts) -> {dryRun|signature|error}` |

### UI Integration Strategy

| KRATOS View | KONTROL24 Equivalent | Integration Action |
|---|---|---|
| Resumen | Home (`/`) | Merge: KPI cards + risk curve + critical lots table + AI drawer |
| Panel | Semaforo (`/semaforo`) | Merge: semáforo KPIs + burn chart + decision matrix + pedimentos table |
| Registro | (none direct) | Keep KRATOS form + table; add KONTROL24 card styling |
| Cierre | Cierre (`/cierre`) | Merge: stepper + timer + exception cards + ledger block + FIEL panel |
| Datos | Copiloto (`/copiloto`) | Replace static reconcile with live reconcile table + forensic compare |
| Asistente | Asistente (`/asistente`) | Rewire drawer to real engine data; remove inert chips |
| Informe | (partial Copiloto) | Keep KRATOS generator; add KONTROL24 audit-ledger block |
| Viabilidad | (none) | Keep KRATOS; label as business doc |
| Bitácora | Copiloto ledger | Unify: single movement audit trail with hash chain |

**New views**: `/integridad` (Inspector), `/ajustes` (settings/keys).

**Navigation**: KONTROL24 sidebar pattern (256px, off-canvas <lg). Single source of truth for company filter (persisted in state).

---

## 3. Integration Strategy & Increments

### Increment 1 — Engine Core + Tests (No UI)
- **Deliverable**: `js/engine/*.js` + `js/data/seed.js` + `tests/engine.test.mjs`
- **Scope**: ledger, peps, deadlines, exposure, reconcile, compliance, canonical, diff, inspector (local only), anchor (dry-run).
- **Tests**: 100% coverage on pure functions; golden fixtures for PEPS, deadlines, exposure, reconcile, canonical/diff.
- **Acceptance**: `node --test` passes; 1000→900 + date change detected; reversal restores balances; idempotencyKey dedupes.

### Increment 2 — Persistence + Store
- **Deliverable**: `js/store.js` (localStorage + IndexedDB), schema migration v1→v2, debounced save, load with version check.
- **Tests**: round-trip, migration, concurrent tab simulation (last-write-wins documented), IndexedDB CRUD.
- **Acceptance**: reload preserves ledger; document stored in IndexedDB with both hashes.

### Increment 3 — Inspector Module + UI
- **Deliverable**: `js/integrity/*.js` + `js/app-integrity.js` + `/integridad` screen.
- **Scope**: file drag-drop (FileReader → ArrayBuffer → SHA-256 bytes + canonical JSON), diff table, local explain, manifest JSON download, Phantom anchor button (dry-run default, wallet if available).
- **Tests**: alteration detection, explain labels, manifest hash stability, dry-run memo format.

### Increment 4 — KONTROL24 Visual System + Screen Wiring
- **Deliverable**: `style.css` (rebuilt from KONTROL24 tokens), `js/app.js` (view router + bindings), 9 screens.
- **Scope**: port CSS variables, components (KPI card, table, decision matrix, stepper, chart SVG, AI drawer), responsive breakpoints. Wire every button to engine calls. Remove all inert/dead UI.
- **Accessibility**: labels, dialog semantics, focus trap, reduced-motion, contrast.

### Increment 5 — E2E + Build + Docs
- **Deliverable**: `e2e/*.spec.ts`, `package.json` (devDeps only), `README.md` update, `docs/ACCEPTANCE_TESTS.md`.
- **Tests**: 10 flows (import pedimento → create lote → consumo → PEPS descarga → vencimientos → conciliar → alterar doc → detectar → repetir → no duplica → bitácora → permisos → reload).
- **Commands**: `npm test`, `npm run e2e`, `npm run build` (if added), `npm run serve`.

---

## 4. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | PEPS apply bug in KRATOS blocks Increment 1 | High | High | Isolate `applyPeps` in tests; fix before UI wiring. |
| R2 | Duplicate pedimento dedupe logic missing | High | Medium | Implement idempotencyKey in ledger; reject on submit. |
| R3 | Canonical digest drift between Sentinel (Node) and KRATOS (browser) | Medium | High | Use identical WebCrypto algorithm; publish test vectors in `tests/vectors/`. |
| R4 | Solana Phantom bundling fails in static app (`Buffer` polyfill) | Medium | Medium | Provide `anchor` as async function; if Phantom unavailable, honest dry-run. No bundle @solana/web3.js unless user opts in. |
| R5 | Disk space for Playwright/node_modules (1.1 GB free) | Medium | Medium | Use shared `node_modules` from `immex-guard-copilot` via symlink; clean `.next`/`test-results` after runs. |
| R6 | No push rights to maia-mariana repo | Certain | Medium | Deliver via fork + PR; document in `CONTRIBUTING.md`. |
| R7 | Fabricated KONTROL24 claims leak into UI | Medium | High | Explicit "FABRICATED — DO NOT SHIP" list in `docs/FABRICATED_CLAIMS.md`; CI grep check. |
| R8 | CSV parsing edge cases (decimal comma, encoding, XLSX) | Medium | Medium | Use `papaparse` (tiny) or robust custom; reject XLSX with clear error. |

---

## 5. Non-Goals (This Integration)

- Server-side auth, multi-tenant Postgres, real-time sync.
- ERP connectors, SAT API, automatic daily ingest.
- Email/Teams notifications.
- Production deployment hardening (HTTPS, CSP, secrets rotation).
- AI provider proxy (keys stay in browser per KRATOS pattern; document risk).
- Full migration of Sentinel's OpenAI path (local engine only; generative = future flag).

---

## 6. Verification Evidence (Baseline)

| Check | Command | Result |
|---|---|---|
| KRATOS static serve | `python -m http.server 8811` | 200 OK |
| New pedimento creates row | Playwright (see `baseline7.mjs`) | ✓ 12→13 |
| Duplicate pedimento | same | ✗ creates 2nd row (4 occurrences after 2 submits) |
| PEPS preview correct FIFO | same | ✓ shows L-0412 discharge 2,144 |
| PEPS apply persists | same | ✗ saldo unchanged |
| CSV reconcile runs | same | ✓ 11 matches, 3 diffs |
| Reload preserves data | same | ✓ `6004120` present |
| Sentinel smoke | `npx tsx scripts/smoke.ts` | 9/9 pass |
| KONTROL24 routes render | Playwright screenshots | 5 routes, 3 breakpoints, 0 JS errors |

---

## 7. Next Action

Proceed to **Increment 1** (Engine Core + Tests). Deliver `js/engine/` + `tests/` + updated `package.json` with `node:test` script. No UI changes yet.

**Approval required?** No — user authorized full integration; this doc is the mandated architecture deliverable per brief ("Antes de modificar código, documenta el mapa de arquitectura y la estrategia de integración").
