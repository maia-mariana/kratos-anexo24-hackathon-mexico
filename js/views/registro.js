/**
 * Registro View — Pedimento entry, PEPS apply/undo, lotes table, materiales.
 * All mutations go through store + engine. No inline business logic.
 */

import * as engine from '../engine/index.js';
import * as store from '../../store/index.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let currentLotes = [];

/**
 * Render Registro view.
 */
export async function renderRegistro() {
  const companyId = getActiveCompanyId();
  currentLotes = engine.getBalances(companyId);

  await Promise.all([
    renderMaterialesTable(),
    renderLotesTable(),
    renderExportacionesTable(),
    populateFormSelects(),
    bindFormHandlers()
  ]);
}

function getActiveCompanyId() {
  const s = store.loadState();
  return s.activeCompanyId || s.companies[0]?.id || 'mb';
}

/**
 * Populate form select options.
 */
function populateFormSelects() {
  const matSel = $('#fMat');
  const pepsProd = $('#pepsProd');
  if (!matSel || !pepsProd) return;

  const mats = store.loadState().materiales || [];

  matSel.innerHTML = mats.map(m => `<option value="${m.id}">${m.corto} — ${m.nombre} (${m.fraccion})</option>`).join('');
  pepsProd.innerHTML = mats.map(m => `<option value="${m.id}">${m.corto} — ${m.nombre}</option>`).join('');
}

/**
 * Bind form handlers.
 */
function bindFormHandlers() {
  // Toggle nuevo pedimento form
  $('#btnNuevoPed')?.addEventListener('click', () => {
    const card = $('#nuevoPed');
    if (card) card.hidden = !card.hidden;
  });

  // Pedimento form submit
  $('#formPed')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPedimento();
  });

  // PEPS form submit
  $('#pepsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await applyPeps();
  });

  // PEPS undo
  $('#pepsUndo')?.addEventListener('click', async () => {
    await undoPeps();
  });

  // Material inline edits
  bindMaterialEdits();

  // Lote search
  $('#qLotes')?.addEventListener('input', (e) => filterLotes(e.target.value));
}

/**
 * Submit new pedimento (IN).
 */
async function submitPedimento() {
  const ped = $('#fPed').value.trim();
  const matId = $('#fMat').value;
  const cant = parseFloat($('#fCant').value.replace(/[^\d.]/g, ''));

  if (!ped || !matId || !cant || cant <= 0) {
    alert('Complete todos los campos con valores válidos.');
    return;
  }

  const state = store.loadState();
  const mat = state.materiales.find(m => m.id === matId);
  if (!mat) return alert('Material no encontrado');

  const companyId = getActiveCompanyId();
  const today = new Date().toISOString().split('T')[0];

  // Create pedimento + partida + ENTRY movement
  const pedimentoId = `PED-${Date.now()}`;
  const partidaId = `PAR-${Date.now()}`;
  const lotId = `L-${partidaId}`;
  const movId = `MOV-${Date.now()}`;

  // Build new state
  const newState = store.loadState();

  // Add pedimento
  newState.pedimentos.push({
    id: pedimentoId,
    companyId,
    numero: ped,
    clave: 'IN',
    aduana: ped.split(' ')[1] || '47',
    patente: ped.split(' ')[2] || '3711',
    fechaPago: today,
    rfc: newState.companies.find(c => c.id === companyId)?.rfc || ''
  });

  // Add partida
  newState.partidas.push({
    id: partidaId,
    pedimentoId,
    materialId: matId,
    cantidadInicial: Math.round(cant),
    valorUnitarioMXN: Math.round((mat.vu || 0) * 100),
    igiRate: mat.igiRate || 0.05,
    plazoMeses: mat.plazoMeses || 18
  });

  // Add ENTRY movement (idempotency key)
  const idemKey = `manual-${pedimentoId}-${partidaId}`;
  const existing = newState.movements?.find(m => m.idempotencyKey === idemKey);
  if (existing) {
    alert('Este pedimento+partida ya fue registrado (idempotencia).');
    return;
  }

  newState.movements.push({
    id: movId,
    companyId,
    kind: 'ENTRY',
    refs: { pedimentoId, partidaId, materialId: matId, lotId, fechaPago: today },
    qtyBase: Math.round(cant),
    unit: mat.um,
    unitCostMXN: Math.round((mat.vu || 0) * 100),
    timestamp: new Date().toISOString(),
    actor: state.user || 'demo',
    reason: `Alta manual: ${ped}`,
    idempotencyKey: idemKey,
    schemaVersion: 1
  });

  // Update derived balances
  const balances = engine.getBalances(companyId);
  // No need to store balances — they're derived

  // Log
  if (!newState.log) newState.log = [];
  newState.log.push({
    ts: new Date().toISOString(),
    user: state.user || 'demo',
    action: 'Alta pedimento',
    why: `Pedimento ${ped}, ${cant} ${mat.um} de ${mat.nombre}`,
    hash: ''
  });

  store.saveState(newState, true);
  store.loadState(); // refresh

  // Reset form
  $('#fPed').value = '';
  $('#fCant').value = '';
  $('#nuevoPed').hidden = true;

  // Re-render
  await renderRegistro();
  alert(`Pedimento ${ped} registrado. Lote ${lotId} creado con ${cant} ${mat.um}.`);
}

/**
 * Apply PEPS consumption.
 */
async function applyPeps() {
  const prodId = $('#pepsProd').value;
  const pzas = parseFloat($('#pepsPzas').value.replace(/[^\d.]/g, ''));

  if (!prodId || !pzas || pzas <= 0) {
    alert('Seleccione producto y piezas válidas.');
    return;
  }

  const companyId = getActiveCompanyId();
  const state = store.loadState();

  // Get BOM for product
  const bom = state.boms?.find(b => b.productId === prodId && b.version === 'v1');
  if (!bom) return alert('No hay BOM v1 para este producto.');

  try {
    // Plan consumption
    const plan = await engine.planConsumption(prodId, pzas * 1000, pzas, 'v1', companyId); // qty in base units (approx)
    if (!plan.length) return alert('No hay stock suficiente.');

    // Show preview
    const preview = $('#pepsPreview');
    if (preview) {
      preview.innerHTML = plan.map(p => {
        const lot = currentLotes.find(l => l.id === p.lotId);
        return `<div class="peps-row"><span>${p.lotId}</span><span>${lot?.materialCorto || ''}</span><span>${fmtNum(p.allocatedQty)}</span><span>${fmtNum(p.remainingQty)}</span></div>`;
      }).join('');
    }

    // Apply plan → create CONSUMPTION movements
    const newState = store.loadState();
    const baseIdem = `peps-${Date.now()}`;

    for (let i = 0; i < plan.length; i++) {
      const entry = plan[i];
      if (entry.allocatedQty <= 0) continue;

      newState.movements.push({
        id: `MOV-${Date.now()}-${i}`,
        companyId: getActiveCompanyId(),
        kind: 'CONSUMPTION',
        refs: { materialId: entry.materialId, lotId: entry.lotId, bomVersion: 'v1', pieces: Math.round(pzas) },
        qtyBase: -entry.allocatedQty,
        unit: 'kg',
        unitCostMXN: 0, // derived from lot's original ENTRY
        timestamp: new Date().toISOString(),
        actor: state.user || 'demo',
        reason: `Descarga PEPS ${i+1}/${plan.length}`,
        idempotencyKey: `${baseIdem}-${i}`,
        schemaVersion: 1
      });
    }

    // Log
    newState.log.push({
      ts: new Date().toISOString(),
      user: state.user || 'demo',
      action: 'Aplicar PEPS',
      why: `Descarga de ${pzas} pzas de ${state.materiales.find(m => m.id === prodId)?.nombre || prodId}`,
      hash: ''
    });

    store.saveState(newState, true);

    // Enable undo
    $('#pepsUndo').disabled = false;

    await renderRegistro();
    alert(`PEPS aplicado: ${plan.length} lotes consumidos.`);
  } catch (err) {
    alert(`Error PEPS: ${err.message}`);
  }
}

/**
 * Undo last PEPS.
 */
async function undoPeps() {
  const state = store.loadState();
  const companyId = getActiveCompanyId();

  // Find last CONSUMPTION movements with peps- idempotency prefix
  const pepsMovs = state.movements
    .filter(m => m.companyId === companyId && m.kind === 'CONSUMPTION' && m.idempotencyKey?.startsWith('peps-'))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!pepsMovs.length) return alert('No hay PEPS para revertir.');

  // Get the last batch (same idempotency prefix)
  const lastBatchPrefix = pepsMovs[0].idempotencyKey.split('-').slice(0, 2).join('-');
  const toReverse = pepsMovs.filter(m => m.idempotencyKey.startsWith(lastBatchPrefix));

  const newState = store.loadState();
  for (const mov of toReverse) {
    // Create REVERSAL movement
    newState.movements.push({
      id: `MOV-${Date.now()}-rev`,
      companyId,
      kind: 'REVERSAL',
      refs: mov.refs,
      qtyBase: -mov.qtyBase, // positive to reverse consumption
      unit: mov.unit,
      unitCostMXN: mov.unitCostMXN,
      timestamp: new Date().toISOString(),
      actor: state.user || 'demo',
      reason: `Reversión PEPS: ${mov.reason}`,
      idempotencyKey: `${mov.idempotencyKey}-rev`,
      schemaVersion: 1,
      reversesMovementId: mov.id
    });
  }

  newState.log.push({
    ts: new Date().toISOString(),
    user: state.user || 'demo',
    action: 'Revertir PEPS',
    why: `Revertida descarga de ${toReverse.length} lotes`,
    hash: ''
  });

  store.saveState(newState, true);
  $('#pepsUndo').disabled = true;

  await renderRegistro();
  alert('PEPS revertido. Saldos restaurados.');
}

/**
 * Render materiales table with inline editing.
 */
async function renderMaterialesTable() {
  const container = $('#tMat');
  if (!container) return;

  const state = store.loadState();
  const companyId = getActiveCompanyId();
  const mats = (state.materiales || []).filter(m => m.companyId === companyId);

  container.innerHTML = `
    <thead>
      <tr>
        <th>ID</th><th>Material</th><th>Fracción</th><th>UM</th>
        <th class="r">Consumo/mes</th><th class="r">Plan</th>
        <th class="r">IGI %</th><th class="r">VU MXN</th><th>Acciones</th>
      </thead>
      <tbody>
        ${mats.map(m => `
          <tr data-mat="${m.id}">
            <td class="mono">${m.id}</td>
            <td>${m.nombre}</td>
            <td class="mono">${m.fraccion}</td>
            <td>${m.um}</td>
            <td class="r"><input type="number" class="edit-consumo" value="${m.consumoMes}" step="1" min="0" style="width:80px"></td>
            <td class="r"><input type="number" class="edit-plan" value="${m.plan}" step="1" min="0" style="width:80px"></td>
            <td class="r"><input type="number" class="edit-igi" value="${(m.igiRate*100).toFixed(1)}" step="0.1" min="0" max="100" style="width:60px"></td>
            <td class="r"><input type="number" class="edit-vu" value="${m.vu}" step="0.01" min="0" style="width:80px"></td>
            <td><button class="btn small" data-action="save-mat" data-id="${m.id}">Guardar</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Bind save buttons
  for (const btn of $$('[data-action="save-mat"]', container)) {
    btn.addEventListener('click', () => saveMaterial(btn.dataset.id));
  }
}

function saveMaterial(matId) {
  const row = $(`tr[data-mat="${matId}"]`);
  if (!row) return;

  const consumo = parseFloat(row.querySelector('.edit-consumo').value) || 0;
  const plan = parseFloat(row.querySelector('.edit-plan').value) || 0;
  const igi = (parseFloat(row.querySelector('.edit-igi').value) || 0) / 100;
  const vu = parseFloat(row.querySelector('.edit-vu').value) || 0;

  const newState = store.loadState();
  const mat = newState.materiales?.find(m => m.id === matId);
  if (!mat) return;

  const oldConsumo = mat.consumoMes;
  const oldPlan = mat.plan;
  const oldIgi = mat.igiRate;
  const oldVu = mat.vu;

  mat.consumoMes = consumo;
  mat.plan = plan;
  mat.igiRate = igi;
  mat.vu = vu;

  newState.log.push({
    ts: new Date().toISOString(),
    user: store.loadState().user || 'demo',
    action: 'Editar material',
    why: `${mat.nombre}: consumo ${oldConsumo}→${consumo}, plan ${oldPlan}→${plan}, IGI ${(oldIgi*100).toFixed(1)}%→${(igi*100).toFixed(1)}%, VU ${oldVu}→${vu}`,
    hash: ''
  });

  store.saveState(newState, true);
  renderMaterialesTable();
  alert('Material actualizado.');
}

/**
 * Render lotes table with search filter.
 */
async function renderLotesTable() {
  const container = $('#tLotes');
  if (!container) return;

  const companyId = getActiveCompanyId();
  const lots = engine.getBalances(companyId);

  // Enrich with material + pedimento info
  const state = store.loadState();
  const enriched = lots.map(lot => {
    const partida = state.partidas?.find(p => p.id === lot.partidaId);
    const mat = state.materiales?.find(m => m.id === partida?.materialId);
    const ped = state.pedimentos?.find(p => p.id === partida?.pedimentoId);
    return {
      ...lot,
      material: mat?.nombre || '—',
      materialCorto: mat?.corto || '—',
      fraccion: mat?.fraccion || '—',
      um: mat?.um || 'kg',
      pedimento: ped?.numero || '—',
      fechaPago: ped?.fechaPago || '—',
      vence: lot.vence || '—',
      diasRestantes: lot.diasRestantes ?? daysUntil(lot.vence),
      sev: lot.bucket || 'ok'
    };
  });

  container.innerHTML = `
    <thead>
      <tr>
        <th>Lote</th><th>Pedimento</th><th>Material</th><th>Fracción</th>
        <th>Entrada</th><th>Vence</th><th class="r">Saldo</th><th>UM</th>
        <th class="r">Días</th><th>Estado</th><th>Riesgo</th><th>Acciones</th>
      </thead>
      <tbody>
        ${enriched.map(l => `
          <tr data-lot="${l.id}" class="${l.sev}">
            <td class="mono">${l.id}</td>
            <td class="mono">${l.pedimento}</td>
            <td>${l.materialCorto}</td>
            <td class="mono">${l.fraccion}</td>
            <td>${fmtDate(l.fechaPago)}</td>
            <td>${fmtDate(l.vence)}</td>
            <td class="r mono">${fmtNum(l.saldo)}</td>
            <td>${l.um}</td>
            <td class="r">${l.diasRestantes >= 0 ? l.diasRestantes : 'vencido'}</td>
            <td><span class="badge ${l.sev === 'expired' || l.sev === 'critical' ? 'crit' : l.sev === 'warning' ? 'warn' : l.sev === 'watch' ? 'watch' : 'ok'}">${l.sev}</span></td>
            <td class="r mono">${fmtMXN(l.saldo * (l.valorUnitarioMXN || 0) * (1 + (l.igiRate || 0) + 0.16 + 0.008))}</td>
            <td><button class="btn small" data-action="what-lot" data-id="${l.id}">¿Qué hago?</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Bind ¿Qué hago? buttons
  for (const btn of $$('[data-action="what-lot"]', container)) {
    btn.addEventListener('click', () => openWhatHago(btn.dataset.id));
  }
}

/**
 * Render exportaciones table (read-only from state).
 */
async function renderExportacionesTable() {
  const container = $('#tExpo');
  if (!container) return;

  const state = store.loadState();
  const companyId = getActiveCompanyId();
  const exports = (state.exports || []).filter(e => e.emp === companyId);

  container.innerHTML = `
    <thead>
      <tr><th>Pedimento</th><th>Fecha</th><th>Producto</th><th>Cant.</th><th>Descarga</th><th>Lotes</th></tr>
    </thead>
    <tbody>
      ${exports.map(e => `
        <tr>
          <td class="mono">${e.ped}</td>
          <td>${fmtDate(e.dias ? `2025-${String(e.dias).padStart(4,'0')}` : '—')}</td>
          <td>${e.prod}</td>
          <td class="r mono">${fmtNum(e.cant)}</td>
          <td>${e.desc}</td>
          <td class="mono">${e.lotes}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `;
}

function filterLotes(query) {
  const q = query.toLowerCase();
  for (const row of $$('#tLotes tbody tr')) {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  }
}

function getActiveCompanyId() {
  const s = store.loadState();
  return s.activeCompanyId || s.companies[0]?.id || 'mb';
}

function fmtDate(iso) {
  if (!iso || iso === '—') return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-MX').format(n);
}

function fmtMXN(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
}

function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function openWhatHago(lotId) {
  // Open drawer with lot-specific advice
  const lot = currentLotes.find(l => l.id === lotId);
  if (!lot) return;

  const mat = store.loadState().materiales.find(m => m.id === lot.materialId);
  const opt = engine.optionsAt({
    ...lot,
    valorUnitarioMXN: mat?.vu * 100 || 185000,
    igiRate: mat?.igiRate || 0.05
  }, 0);

  const drawer = $('#drawer');
  const dTitle = $('#dTitle');
  const dBody = $('#dBody');
  const dEyebrow = $('#dEyebrow');

  if (drawer && dTitle && dBody) {
    dEyebrow.textContent = '¿Qué hago?';
    dTitle.textContent = `${lot.materialCorto} · ${lot.id}`;
    dBody.innerHTML = `
      <div class="cause">
        <b>Causa:</b> ${engine.causeText({ ...lot, bucket: lot.sev })}
      </div>
      <div class="facts">
        <div><b>Saldo</b><span>${fmtNum(lot.saldo)} ${mat?.um || 'kg'}</span></div>
        <div><b>Vence</b><span>${fmtDate(lot.vence)} (${lot.diasRestantes}d)</span></div>
        <div><b>Riesgo estimado</b><span>${fmtMXN(lot.saldo * (mat?.vu * 100 || 185000) * 1.218)}</span></div>
      </div>
      <div class="options">
        ${Object.entries(opt.options).map(([k, v]) => `
          <div class="opt ${k === opt.best ? 'best' : ''}">
            <div><div class="t">${v.label}</div><div class="d">${engine.firstStep({...lot, bucket: lot.sev}, k)}</div></div>
            <div class="c">${fmtMXN(v.cost)}</div>
            <div class="bar"><i style="width:${Math.min(100, v.cost/1000000*100)}%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="first-step">
        <p><b>Primer paso:</b> ${engine.firstStep({...lot, bucket: lot.sev}, opt.best)}</p>
      </div>
    `;
    drawer.classList.add('on');
    $('#scrim').classList.add('on');
  }
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function fmtDate(iso) {
  if (!iso || iso === '—') return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-MX').format(n);
}

function fmtMXN(cents) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
}

function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}