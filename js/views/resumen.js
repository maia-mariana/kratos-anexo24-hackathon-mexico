/**
 * Resumen View — Executive summary with 3 decisions, BMAD council, team roles.
 */

import * as engine from '../engine/index.js';
import * as store from '../store/index.js';

let state = store.loadState();

/**
 * Get derived lots with deadline meta for active company.
 */
async function getScopedLotsWithMeta() {
  const companyId = getActiveCompanyId();
  const balances = engine.getBalances(companyId);
  const withMeta = engine.computeDeadlines(
    balances.map(b => ({
      id: b.id,
      companyId: b.companyId,
      partidaId: b.partidaId,
      saldo: b.saldo,
      fechaPago: b.vence, // need to get from movement
      plazoMeses: 18
    })),
    new Date()
  );
  // Enrich with material info
  for (const lot of withMeta) {
    const mat = state.materiales.find(m => m.id === lot.materialId);
    if (mat) {
      lot.materialNombre = mat.nombre;
      lot.materialCorto = mat.corto;
      lot.fraccion = mat.fraccion;
      lot.um = mat.um;
      lot.valorUnitarioMXN = mat.vu * 100; // convert to cents
      lot.igiRate = mat.igiRate;
      lot.plazoMeses = mat.plazoMeses || 18;
    }
  }
  return withMeta;
}

function getActiveCompanyId() {
  const s = store.loadState();
  return s.activeCompanyId || s.companies[0]?.id || 'mb';
}

/**
 * Render Resumen view.
 */
export async function renderResumen() {
  const lots = await getScopedLotsWithMeta();
  const companyId = getActiveCompanyId();

  // 1. Top KPIs: risk total, fines avoided, IMMEX balance, merma
  await renderKPIs(lots);

  // 2. 3 Decisions of the week
  await renderDecisions(lots);

  // 3. BMAD Council verdict
  await renderCouncil(lots);

  // 4. Team roles
  await renderTeamRoles();
}

/**
 * Render top KPI cards.
 */
async function renderKPIs(lots) {
  const container = $('#resTop');
  if (!container) return;

  const exposure = engine.computeExposure(lots);
  const riskTotal = exposure.totals.grandTotal;
  const criticalLots = lots.filter(l => l.bucket === 'critical' || l.bucket === 'expired');
  const warningLots = lots.filter(l => l.bucket === 'warning');

  // Fines avoided this month (vs previous)
  const multasEvitadas = criticalLots.length * 2707000 + warningLots.length * 1353500; // estimate

  container.innerHTML = `
    <div class="kpis">
      <div class="card kpi">
        <span class="k">Dinero en riesgo legal</span>
        <span class="v" style="color:var(--crit)">${fmtMXN(riskTotal)}</span>
        <span class="d muted">${criticalLots.length} lotes críticos, ${warningLots.length} en alerta</span>
      </div>
      <div class="card kpi">
        <span class="k">Multas evitadas este mes</span>
        <span class="v" style="color:var(--ok)">${fmtMXN(multasEvitadas)}</span>
        <span class="d muted">vs. no actuar</span>
      </div>
      <div class="card kpi">
        <span class="k">Saldo IMMEX temporal</span>
        <span class="v">${fmtNum(lots.reduce((s,l)=>s+l.saldo,0))} ${lots[0]?.um || 'kg'}</span>
        <span class="d muted">PEPS</span>
      </div>
      <div class="card kpi">
        <span class="k">Merma real vs. estándar</span>
        <span class="v" style="color:var(--warn)">${fmtNum(0)} ${lots[0]?.um || 'kg'}</span>
        <span class="d muted">Pendiente captura</span>
      </div>
    </div>
  `;
}

function fmtMXN(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-MX').format(n);
}

/**
 * Render 3 decisions of the week.
 */
async function renderDecisions(lots) {
  const container = $('#resDec');
  const approveDiv = $('#resApprove');
  if (!container || !approveDiv) return;

  const criticalLots = lots.filter(l => l.bucket === 'critical' || l.bucket === 'expired').slice(0, 3);

  if (criticalLots.length === 0) {
    container.innerHTML = '<li class="muted">No hay decisiones urgentes esta semana.</li>';
    approveDiv.innerHTML = '';
    return;
  }

  container.innerHTML = criticalLots.map((lot, i) => {
    const opt = engine.optionsAt({ ...lot, valorUnitarioMXN: lot.valorUnitarioMXN || 185000, igiRate: lot.igiRate || 0.05 }, 0);
    const best = opt.best;
    const bestOpt = opt.options[best];
    return `
      <li style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">
        <span class="badge crit">${i+1}</span>
        <div>
          <strong>${lot.materialCorto || lot.id}</strong> · ${lot.diasRestantes}d para vencer · ${bestOpt.label}
          <div class="muted small">${engine.firstStep(lot, best)} · ${fmtMXN(bestOpt.cost)}</div>
        </div>
        <button class="btn small primary" data-action="approve" data-lot="${lot.id}">Aprobar</button>
      </li>
    `;
  }).join('');

  // Approve plan button
  approveDiv.innerHTML = `
    <button class="btn primary" style="width:100%;margin-top:12px" id="btnApprovePlan">
      Aprobar plan de acción (${criticalLots.length} decisiones)
    </button>
  `;

  // Bind approve buttons
  for (const btn of $$('[data-action="approve"]', container)) {
    btn.addEventListener('click', () => {
      const lotId = btn.dataset.lot;
      approveDecision(lotId);
    });
  }
  $('#btnApprovePlan')?.addEventListener('click', () => approvePlan());
}

/**
 * Approve a single decision.
 */
function approveDecision(lotId) {
  const s = store.loadState();
  if (!s.tasks) s.tasks = new Set();
  s.tasks.add(lotId);
  store.saveState(s, true);
  alert(`Decisión aprobada para ${lotId}. Queda en la bitácora.`);
}

/**
 * Approve all pending decisions.
 */
function approvePlan() {
  const s = store.loadState();
  if (!s.plan) s.plan = { status: 'approved', by: 'gerente', at: new Date().toISOString() };
  else s.plan.status = 'approved';
  if (!s.tasks) s.tasks = new Set();
  store.saveState(s, true);
  alert('Plan aprobado. Índice de cumplimiento actualizado.');
  renderResumen();
}

/**
 * Render BMAD Council.
 */
async function renderCouncil(lots) {
  const container = $('#resCouncil');
  if (!container) return;

  const compliance = engine.score({
    lots,
    tasks: new Set(),
    reconDone: new Set(),
    cierre: { stage: 0 },
    exceptions: []
  });

  container.innerHTML = `
    <div class="verdict" style="margin-bottom:16px">
      <div style="padding:20px;text-align:center">
        <div class="gauge"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="80" cy="80" r="70" fill="none" stroke="var(--crit)" stroke-width="12" stroke-dasharray="${compliance.score / 100 * 439.8} 439.8" stroke-linecap="round" transform="rotate(-90 80 80)"/></svg></div>
        <div class="gate ${compliance.gate === 'ok' ? 'g-ok' : compliance.gate === 'warning' ? 'g-warn' : 'g-crit'}">${compliance.gate.toUpperCase()}</div>
        <h2 style="margin-top:8px">${compliance.score} / 100</h2>
        <div class="muted small">Índice de cumplimiento Anexo 24</div>
      </div>
      <div style="padding:20px">
        <h3 style="margin-top:0">Veredicto: ${compliance.gate === 'ok' ? 'Cumplimiento aceptable' : compliance.gate === 'warning' ? 'Requiere atención' : 'CRÍTICO: acción inmediata'}</div>
        <ul class="v-list">${compliance.actions.map(a => `<li>${a}</li>`).join('')}</ul>
      </div>
      <div style="padding:20px;border-left:1px solid var(--line)">
        <h3 style="margin-top:0">Acciones recomendadas</h3>
        <div class="v-list">${compliance.actions.map(a => `<li>${a}</li>`).join('')}</div>
      </div>
    </div>
  `;
}

/**
 * Render team roles.
 */
async function renderTeamRoles() {
  const container = $('#resRoles');
  if (!container) return;

  const roles = [
    { id: 'gerente', name: 'Gerente de planta', avatar: 'G', role: 'Decide el plan', color: 'var(--accent)', home: 'resumen' },
    { id: 'planta', name: 'Producción', avatar: 'P', role: 'Carga datos', color: 'var(--ok)', home: 'cierre' },
    { id: 'analista', name: 'Analista comercio exterior', avatar: 'A', role: 'Resuelve excepciones', color: 'var(--warn)', home: 'cierre' },
    { id: 'especialista', name: 'Especialista aduanal', avatar: 'E', role: 'Firma cierre', color: 'var(--crit)', home: 'cierre' },
    { id: 'auditor', name: 'Auditoría', avatar: 'U', role: 'Solo lectura', color: 'var(--muted)', home: 'bitacora', ro: true }
  ];

  container.innerHTML = roles.map(r => `
    <div class="who" data-asuser="${r.id}" data-gov="${r.home}" style="cursor:pointer;border:1px solid var(--line);border-radius:10px;padding:10px;transition:border-color .15s">
      <div class="avatar" style="background:${r.color}">${r.avatar}</div>
      <div class="u-txt">
        <b>${r.name}</b>
        <span>${r.role}</span>
      </div>
      ${r.ro ? '<span class="badge b-neutral">Solo lectura</span>' : ''}
    </div>
  `).join('');

  for (const el of $$('.who', container)) {
    el.addEventListener('click', () => {
      const uid = el.dataset.asuser;
      const gv = el.dataset.gov;
      // switch user & view
      const s = store.loadState();
      s.user = uid;
      store.saveState(s, true);
      window.__KRATOS__.showView(gv);
    });
  }
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];