/**
 * PEPS/FIFO Engine — deterministic consumption planning and application.
 * Only consumes from eligible lots (ENTRY, TRANSFER_IN) ordered by fechaPago then partida.
 */

import { getMovements, getBalances } from './ledger.js';

/** @typedef {Object} LotWithMeta */
/** @property {string} id */
/** @property {string} companyId */
/** @property {string} partidaId */
/** @property {number} saldo */
/** @property {string} fechaPago - from pedimento */
/** @property {string} vence */
/** @property {string} estado */

/** @typedef {Object} PlanEntry */
/** @property {string} lotId */
/** @property {number} allocatedQty */
/** @property {number} remainingQty - after this allocation */

/**
 * Get eligible lots for FIFO consumption.
 * @param {string} materialId
 * @param {string} companyId
 * @returns {Promise<LotWithMeta[]>}
 */
async function getEligibleLots(materialId, companyId) {
  const movements = getMovements(companyId);
  const balances = getBalances(companyId);

  // Build lot metadata from ENTRY movements
  const lotMap = new Map();
  for (const m of movements) {
    if (m.companyId !== companyId) continue;
    if (m.kind !== 'ENTRY') continue; // Only ENTRY creates stock
    if (m.reversed) continue;
    if (!m.refs?.partidaId) continue;
    if (m.refs.materialId !== materialId) continue;
    if (m.qtyBase <= 0) continue;

    const lotId = `L-${m.refs.partidaId}`;
    if (!lotMap.has(lotId)) {
      lotMap.set(lotId, {
        id: lotId,
        companyId,
        partidaId: m.refs.partidaId,
        materialId,
        fechaPago: m.refs.fechaPago || '',
        vence: '',
        estado: 'ok',
        entries: []
      });
    }
    lotMap.get(lotId).entries.push({ movementId: m.id, qty: m.qtyBase });
  }

  // Merge with current balances
  const lots = [];
  for (const bal of balances) {
    if (bal.companyId !== companyId) continue;
    if (bal.materialId !== materialId) continue;
    const meta = lotMap.get(bal.id) || {};
    lots.push({
      ...bal,
      fechaPago: meta.fechaPago || '',
      entries: meta.entries || []
    });
  }

  // Sort: fechaPago ASC, then partidaId ASC
  lots.sort((a, b) => {
    const da = a.fechaPago ? new Date(a.fechaPago).getTime() : Infinity;
    const db = b.fechaPago ? new Date(b.fechaPago).getTime() : Infinity;
    if (da !== db) return da - db;
    return a.partidaId.localeCompare(b.partidaId);
  });

  return lots;
}

/**
 * Plan FIFO consumption for a material.
 * @param {string} materialId
 * @param {number} qtyBase - total quantity to consume (base units)
 * @param {number} pieces - finished pieces (for BOM traceability)
 * @param {string} bomVersion
 * @param {string} companyId
 * @returns {Promise<PlanEntry[]>}
 */
export async function planConsumption(materialId, qtyBase, pieces, bomVersion, companyId) {
  if (qtyBase <= 0) throw new Error('qtyBase must be positive');
  const lots = await getEligibleLots(materialId, companyId);
  const plan = [];
  let remaining = qtyBase;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.saldo, remaining);
    plan.push({ lotId: lot.id, allocatedQty: take, remainingQty: lot.saldo - take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock for material ${materialId}: need ${qtyBase}, available ${qtyBase - remaining}`);
  }

  return plan;
}

/**
 * Apply a consumption plan → create CONSUMPTION movements.
 * @param {PlanEntry[]} plan
 * @param {Object} base - {materialId, companyId, actor, reason, idempotencyKey, bomVersion, pieces}
 * @returns {Promise<Movement[]>}
 */
export async function applyPlan(plan, base) {
  const { materialId, companyId, actor, reason, idempotencyKey, bomVersion, pieces } = base;
  const movements = [];

  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    if (entry.allocatedQty <= 0) continue;
    movements.push({
      companyId,
      kind: 'CONSUMPTION',
      refs: { materialId, lotId: entry.lotId, bomVersion, pieces },
      qtyBase: -entry.allocatedQty, // negative = consumption
      unit: 'base', // base unit
      unitCostMXN: 0, // cost derived from lot's original ENTRY
      timestamp: new Date().toISOString(),
      actor,
      reason: `${reason} (PEPS ${i + 1}/${plan.length})`,
      idempotencyKey: `${idempotencyKey}-${i}`,
      schemaVersion: 1
    });
  }

  return movements;
}

/**
 * Get lot details for a material (for UI).
 * @param {string} materialId
 * @param {string} companyId
 * @returns {Promise<LotWithMeta[]>}
 */
export async function getMaterialLots(materialId, companyId) {
  return getEligibleLots(materialId, companyId);
}