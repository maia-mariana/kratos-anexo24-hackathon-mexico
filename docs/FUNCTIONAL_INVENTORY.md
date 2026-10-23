# Functional Inventory — KRATOS + KONTROL24 + Sentinel Consolidation

**Status codes**:  
`✅ implemented & verified` — works, tests pass (or baseline exercised)  
`⚠️ implemented, unverified` — code exists, no test/evidence  
`🟡 partial` — some sub-functions work, others missing/broken  
`🟠 simulated` — UI/controls exist but no real backend/logic  
`❌ pending` — not built, required by brief

---

## 1. KRATOS Static App (Current Baseline)

| Feature | Sub-feature | Status | Evidence / Notes |
|---|---|---|---|
| **Pedimento registry** | Create IN pedimento with partida | ✅ | Baseline: lotRows 12→13; localStorage grew |
| | Duplicate detection / dedupe | ❌ | Duplicate → 2nd row; 4 occurrences after 2 submits |
| | Edit/remove pedimento | ❌ | No UI, no engine |
| | RT / F4 / R1 keys (salidas) | ⚠️ | Only IN implemented; RT/F4/R1 would create FIFO stock (bug per NEXO24 audit) |
| **Lote / saldo management** | Lote list with filters | ✅ | 12 rows rendered, search works |
| | Saldo derived from movements | ❌ | Saldos are mutable scalars in `lotes[]`; no movement ledger |
| | PEPS consumption simulation | ✅ | `pepsPreview` shows correct FIFO plan (oldest lot first) |
| | PEPS apply (persist) | 🟠 | Preview works; **apply does not mutate localStorage** (bug) |
| | PEPS undo | 🟠 | Button exists, `pepsUndo` disabled after apply (because apply didn't run) |
| **Materiales** | Inline edit consumo/plan/igi/vu | ✅ | Mutates `MATERIALES` array; logged |
| | BOM CRUD | ❌ | Hardcoded 5 rows; no add/edit/delete |
| **Producción** | Run production with BOM | 🟡 | `runCalc` generates text + exceptions; **does not change lot balances** |
| | Merma / reciclado capture | 🟠 | Table shows merma; `monto_mxn` always 0; no manual capture |
| **Plazos legales (Art. 108)** | 18/24/60 month config | ✅ | `PLAZO_MESES=18` constant; per-material `plazoMeses` in seed |
| | Semáforo buckets (expired/crit/warn/ok) | ✅ | `alertsOf` filters; `delaySteps`/`waitCost` compute options |
| | Alertas 90/60/30 days | ✅ | `riskSums` aggregates by horizon |
| **Exposición fiscal** | IGI (per material) | ✅ | 5–7% per material in seed |
| | IVA 16%, DTA 0.8%, multa 27,070–54,180 | ✅ | Constants in code; `optionsAt` computes costs |
| | Valor en riesgo por lote / horizonte | ✅ | `risk = leftValue * (igi + IVA + DTA)` |
| **Conciliación SAT / Agente** | CSV parse (| ; ,) + header aliases | ✅ | `parseCSV` handles delimiter + aliases |
| | Row matching by pedimento+fracción | ✅ | Sums same key; different fracción overwrites (bug) |
| | Diff table with explanations | ✅ | `runCSV` renders HTML table with `¿POR QUÉ?` |
| | Persist diffs to RECON / reconDone | ❌ | Display only; `RECON` hardcoded; `reconDone` not updated |
| **Cierre mensual** | 5-step wizard (prod → calc → exc → sign → reports) | 🟡 | Steps render; file upload stores **names only**; contents not parsed |
| | Timer + meta <2h | 🟠 | Timer runs; "Septiembre 4 días" hardcoded |
| | Excepciones: detect → resolve → log | 🟡 | `buildExceptions` injects M1/V1; `resolveExc` marks done |
| | Especialista firma (FIEL) | 🟠 | Checkboxes + button; no crypto, no cert |
| | Snapshot inmutable por periodo | ❌ | `cierre` object mutable; no period validation (accepts month 13) |
| **Reportes** | Anexo 24 CSV (pedimento + fracción) | 🟡 | Generates 2 tables concatenated; not valid single CSV |
| | Anexo 30 CSV | 🟡 | Same function; unverified |
| | Inventario CSV | 🟡 | Unverified |
| | Paquete auditoría JSON | ❌ | Not implemented |
| **Bitácora / Auditoría** | Log entries with FNV-1a 32-bit hash | 🟠 | `addLog` chains hash; **no verification routine**; 32-bit not tamper-evident |
| | Append-only guarantee | ❌ | `resetDemo` deletes all; `localStorage` user-editable |
| **Perfiles / Permisos** | 5 roles, `can[]` gates | 🟠 | `need(perm)` offers one-click impersonation; **bypassable** |
| | Empresa / RFC isolation | ❌ | Single `lotes[]`, `MATERIALES[]`, `plan`, `tasks`, `log` shared; only view filter |
| **IA (Métron)** | Provider selection + key storage | ✅ | Gemini / OpenAI / Anthropic / compat; key in localStorage if "Recordar" |
| | Server endpoint `api/ai` | ❌ | No `api/` dir in repo; Vercel deploy has 404 |
| | Fallback local rules | 🟡 | Only used as hidden base / error fallback; chat **requires AI** |
| | Data sent to provider | ✅ | Context includes saldos, risk, recon, compliance (no RFC) |
| **Persistencia** | localStorage single key `kratos-demo-v1` | ✅ | Debounced save, load v1 only, no migration |
| | Multi-tab / concurrency | ❌ | No `storage` event handling; last write wins |
| **Tests** | Automated unit / integration | ❌ | None; `qaTests()` is 5 runtime booleans only |
| | Playwright / E2E | ❌ | None |

---

## 2. KONTROL 24 (Lovable Published App) — UI Only

| Screen / Component | Visual / UX | Real Logic | Fabricated Claims (MUST NOT SHIP) |
|---|---|---|---|
| **Home (`/`)** | KPI cards, SVG risk curve, gauge, critical lots table, AI drawer | ❌ All static strings | "4,850,200 MXN risk", "1,420,500 MXN <30d", "324,960 fines avoided", "4,820 Ton PEPS", "6 pedimentos 100% en plazo", "SAT Data Stage: Sincronizado hoy 08:32", "Exportar Reporte SE", "Iniciar Descarga Masiva PEPS", SHA-256 badge, "Auditoría folio AUD-2026-Q1-094" |
| **Semáforo** | 4 KPIs, weekly burn SVG, decision matrix, pedimentos table | ❌ | "$4,850,200 riesgo", "$162,540 multas", "SAT Conciliado" on every row, "Data Stage Hoy 06:00 AM", XLSX/PDF export buttons |
| **Asistente** | Incident hero, diagnosis card, exposure breakdown, 4 decision cards (A–D), execution panel, audit timeline | ❌ | "Modelo Predictivo SAT ML-4.9", "ABS LG-HI121", specific lot/pedimento/aduana/patente, "34% Nissan T1", "$2,145,000 MXN IGI/IVA/multa", SHA-256/SAT-980421 footer |
| **Cierre** | Fast-close banner, 5-step stepper, exception cards with AI advice, ledger summary, legal certification block (SHA-256, TAMP, FIEL), live audit trail | ❌ | "Ciclo Feb 2026", "Ahorro 94%", "Merma drift 3.10% vs 2.50%", "$18,655 IGI", "RT sin timestamp $124,500 USD", "SHA-256 e7f891...", "TAMP 2026-02-28T14:32:09Z", "FIEL / Sello Digital SAT", "100% excepciones conciliadas" |
| **Copiloto** | Forensic compare (SAT vs agent), immutable ledger (3 entries), chat panel with AI answer + chart | ❌ | "1,482 pedimentos", "1,480 validados 99.86%", "FX 19.8452 vs 19.8450", "$0.84 diff", "Encriptación E2E Activa", "100% Hash SHA-256", "Conciliar" buttons |
| **Design System** | Inter / JetBrains Mono / Plus Jakarta Sans, Material Symbols, card/KPI/table patterns, status pills, dark AI panels | ✅ Reusable | Hardcoded warning colors (`#b45309` etc.) not tokenized; grid `#cbd5e1` |
| **Interaction** | Text-based delegation (all buttons route by innerText) | ❌ Inert | No active handlers; route scripts via `dangerouslySetInnerHTML` (dead in SPA) |
| **Accessibility** | — | ❌ | Icon-only buttons no labels, drawer no dialog semantics, tables no captions, charts no alt, pre-checked legal checkbox |

**Verdict**: High-fidelity mock. Visual language and component patterns are reusable. **Zero business logic**. Every number, hash, legal citation, SAT status, timeline, and crypto claim is fabricated.

---

## 3. IMMEX Sentinel — Integrity Inspector Engine

| Capability | Status | Notes |
|---|---|---|
| Canonicalization (key-sort + JSON.stringify) | ✅ | Pure, deterministic, WebCrypto SHA-256 |
| Canonical version tag | ❌ | Absent; no cross-impl compatibility guarantee |
| Raw-byte file hashing | ❌ | Only canonical JSON string hashed |
| Document ingestion (file → JSON) | ❌ | Only pasted JSON in textarea |
| Field-level diff (add/remove/modify) | ✅ | `diffFields` unions keys, string compare, severity |
| Date / number / unicode normalization | ❌ | None; `"2026-08-14"` ≠ `"2026-08-14T00:00:00.000Z"` |
| Array element diff | 🟡 | Arrays compared as opaque string |
| Local rule explain | ✅ | `explainIntegrityLocal` — labeled, integrity ≠ authenticity |
| Generative AI explain (OpenAI) | ⚠️ | Requires `OPENAI_API_KEY`; sends full docs; no validation |
| Manifest (doc set + hash) | ❌ | No manifest structure |
| Solana Devnet anchor (server secret) | 🟠 | Code exists; **no verified transaction in repo** |
| Solana Devnet anchor (Phantom wallet) | 🟠 | Code exists; memo timestamp client-generated; no read-back verification |
| Dry-run anchor | ✅ | Returns memo + length; honest label |
| API `/compare` | ✅ | POST JSON → `{originalHash, currentHash, match, differences, canonical*}` |
| API `/explain` | ✅ | Same + `explanation` |
| API `/anchor` | ✅ | POST `{eventId, hash, timestamp}` → dry-run or real |
| UI (IntegrityInspector) | 🟡 | Paste-only, no file upload, no loading skeletons, no history |
| Smoke tests | ✅ | 9/9 pass (happy path only) |
| 1000→900 + date change test | ❌ | Not covered |
| Portability to browser-only | 🟡 | `canonical.ts`, `diff.ts`, `reconcile.ts`, `fifo.ts`, `exposure.ts` are pure; `ai.ts`/`solana.ts` need server |

---

## 4. Consolidated Target — Must-Have Matrix (Brief Acceptance)

| # | Acceptance Test (Brief Fase 6) | Current State | Gap to Close |
|---|---|---|---|
| 1 | Importar pedimento + crear lote | 🟡 (create works, no dedupe, no lote entity) | Ledger `ENTRY` movement → derived lote |
| 2 | Registrar consumo + verificar saldo | 🟠 (production text only, no balance change) | `CONSUMPTION` movement + balance derivation |
| 3 | Aplicar descarga PEPS + trazabilidad | 🟠 (preview only) | `applyPlan` → `EXPORT` movements + audit |
| 4 | Calcular vencimientos + alertas (fechas controladas) | ✅ | Refactor to pure `deadlines.js` with injected `refDate` |
| 5 | Conciliar 2 archivos con discrepancia conocida | ✅ | Wire CSV engine to update RECON + `reconDone` |
| 6 | Alterar documento + detectar (SHA-256 + diff) | ❌ | Inspector module + UI |
| 7 | Repetir operación + no duplicar indebidamente | ❌ | IdempotencyKey on every mutation |
| 8 | Bitácora + permisos + aislamiento empresas | 🟠 (log exists, 32-bit, no auth, no isolation) | SHA-256 audit chain; companyId on every entity; server auth later |
| 9 | Persistencia tras recargar | ✅ (localStorage) | Keep; add schema migration |
| 10 | Build + tests + demo deployed | ❌ | Add `package.json`, `node:test`, Playwright, deploy script |

---

## 5. Decision Log (This Session)

| Decision | Rationale |
|---|---|
| Base = KRATOS static repo | User explicit; avoids framework rewrite |
| No server in Increment 1–4 | Brief: "evalúa antes de seleccionar"; browser-only satisfies Fase 3 if honest |
| Ledger = append-only movements (not mutable balances) | "El ledger de movimientos debe ser la fuente de verdad" |
| WebCrypto SHA-256 (not Node crypto) | Browser-native, matches Sentinel |
| Canonical JSON = sorted keys + stringify | Matches Sentinel; deterministic |
| Canonical version = `kr24.v1` (to be declared) | Enables future migration; test vectors published |
| IdempotencyKey = UUIDv4 client-generated | Simple, no coordination; dedupe on submit |
| Reversal = compensating movement (kind=REVERSAL) | No deletion; audit chain intact |
| Company isolation = `companyId` on all entities; view filter | Works in browser; ready for server auth later |
| IndexedDB for documents | Large blobs don't fit localStorage |
| Phantom wallet anchor = optional; dry-run default | Honest; no fake txids |
| Local AI explain only | Keys in browser; generative = future flag |
| Tests: `node:test` (pure) + Playwright (E2E) | No framework lock-in; CI-friendly |

---

## 6. Files to Create (Increment 1)

```
/js/engine/
  ledger.js        // appendMovement, getBalances, auditChain
  peps.js          // planConsumption, applyPlan
  deadlines.js     // computeDeadlines, semaforoBuckets
  exposure.js      // computeExposure, buckets
  reconcile.js     // parseCSV, reconcile, diffTable
  compliance.js    // score, gates, actions
  canonical.js     // canon(v, value) -> {canonical, sha256}
  diff.js          // diff(orig, curr) -> FieldDiff[]
  inspector.js     // inspect(original, compared, opts)
  anchor.js        // anchor(hash, eventId, opts) -> {dryRun|signature|error}
  index.js         // re-export all
/js/data/
  seed.js          // fictional companies, materiales, lotes, pedimentos, BOM
/tests/
  engine.test.mjs  // 100% pure fn coverage
  vectors/         // canonical test vectors (JSON fixtures)
package.json       // { "scripts": { "test": "node --test tests/**/*.test.mjs" } }
```

---

*Generated from Phase 1 inspection. All statuses evidence-backed. No simulated claims carried forward.*
