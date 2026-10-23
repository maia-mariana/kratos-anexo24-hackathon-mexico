/**
 * Append-only Movement Ledger (source of truth).
 * All balances derived from movements. Idempotent, reversible, audited.
 */

import { canon } from './canonical.js';

/** @typedef {Object} Movement */
/** @property {string} id - UUIDv4 */
/** @property {string} companyId */
/** @property {'ENTRY'|'CONSUMPTION'|'SCRAP'|'RECYCLE'|'EXPORT'|'RETURN'|'TRANSFER_IN'|'TRANSFER_OUT'|'ADJUSTMENT'|'REVERSAL'} kind */
/** @property {Object} refs - {pedimentoId?, partidaId?, materialId?, lotId?} */
/** @property {number} qtyBase - integer base units (positive for in, negative for out) */
/** @property {string} unit - base unit code */
/** @property {number} unitCostMXN - integer cents per unit */
/** @property {string} timestamp - ISO */
/** @property {string} actor */
/** @property {string} reason */
/** @property {string} [reversesMovementId] */
/** @property {string} idempotencyKey - UUIDv4 */
/** @property {number} schemaVersion - 1 */

/** @typedef {Object} AuditEvent */
/** @property {string} id */
/** @property {string} companyId */
/** @property {string} prevHash */
/** @property {string} payload - canonical JSON of movement */
/** @property {string} hash */
/** @property {string} timestamp */

/** @typedef {Object} Lot */
/** @property {string} id - `L-${partidaId}` */
/** @property {string} companyId */
/** @property {string} partidaId */
/** @property {number} saldo - derived sum */
/** @property {string} vence - ISO date */
/** @property {string} estado */

const MOVEMENT_KINDS = new Set([
  'ENTRY', 'CONSUMPTION', 'SCRAP', 'RECYCLE', 'EXPORT',
  'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'REVERSAL'
]);

const UUIDv4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let movements = [];
let auditChains = new Map(); // companyId -> AuditEvent[]
let idempotencyIndex = new Map(); // idempotencyKey -> movementId

/**
 * Generate UUIDv4.
 * @returns {string}
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate movement input.
 * @param {Partial<Movement>} m
 * @throws {Error}
 */
function validateMovement(m) {
  if (!m.companyId) throw new Error('companyId required');
  if (!MOVEMENT_KINDS.has(m.kind)) throw new Error(`Invalid kind: ${m.kind}`);
  if (!Number.isInteger(m.qtyBase)) throw new Error('qtyBase must be integer');
  if (!Number.isInteger(m.unitCostMXN)) throw new Error('unitCostMXN must be integer cents');
  if (!m.timestamp) throw new Error('timestamp required');
  if (!m.actor) throw new Error('actor required');
  if (!m.reason) throw new Error('reason required');
  if (!m.idempotencyKey) throw new Error('idempotencyKey required');
  if (!UUIDv4_RE.test(m.idempotencyKey)) throw new Error('idempotencyKey must be UUIDv4');
  if (m.kind === 'REVERSAL' && !m.reversesMovementId) throw new Error('REVERSAL requires reversesMovementId');
}

/**
 * Compute audit event for a movement.
 * @param {Movement} movement
 * @param {string} prevHash
 * @returns {Promise<AuditEvent>}
 */
async function createAuditEvent(movement, prevHash) {
  const { canonical, sha256 } = await canon('kr24.v1', movement);
  return {
    id: uuidv4(),
    companyId: movement.companyId,
    prevHash,
    payload: canonical,
    hash: sha256,
    timestamp: new Date().toISOString()
  };
}

/**
 * Derive lot balances from movements for a company.
 * @param {string} [companyId]
 * @returns {Lot[]}
 */
function deriveBalances(companyId) {
  const byLot = new Map();
  for (const m of movements) {
    if (companyId && m.companyId !== companyId) continue;
    if (!m.refs?.lotId) continue;
    const key = m.refs.lotId;
    const entry = byLot.get(key) || { 
      id: key, 
      companyId: m.companyId, 
      partidaId: m.refs.partidaId, 
      materialId: m.refs.materialId,
      saldo: 0, 
      vence: '', 
      estado: 'ok' 
    };
    entry.saldo += m.qtyBase;
    byLot.set(key, entry);
  }
  return [...byLot.values()].filter(l => l.saldo !== 0);
}

/**
 * Append a movement to the ledger.
 * @param {Omit<Movement, 'id'>} movement
 * @returns {Promise<{movement: Movement, newBalances: Lot[], auditEvent: AuditEvent}>}
 */
export async function appendMovement(movement) {
  validateMovement(movement);

  // Idempotency check
  const existingId = idempotencyIndex.get(movement.idempotencyKey);
  if (existingId) {
    const existing = movements.find(m => m.id === existingId);
    const balances = deriveBalances(movement.companyId);
    return { movement: existing, newBalances: balances, auditEvent: null };
  }

  // Get company's audit chain
  const chain = auditChains.get(movement.companyId) || [];
  const prevHash = chain.length ? chain[chain.length - 1].hash : '0'.repeat(64);

  // Handle reversal
  if (movement.kind === 'REVERSAL') {
    const target = movements.find(m => m.id === movement.reversesMovementId);
    if (!target) throw new Error(`Movement to reverse not found: ${movement.reversesMovementId}`);
    if (target.kind === 'REVERSAL') throw new Error('Cannot reverse a reversal');

    // Create compensating movement
    const reversal = {
      ...movement,
      id: uuidv4(),
      qtyBase: -target.qtyBase,
      unitCostMXN: target.unitCostMXN,
      refs: { ...target.refs }
    };
    // Mark original as reversed
    target.reversed = true;
    target.reversedBy = reversal.id;

    movements.push(reversal);
    idempotencyIndex.set(reversal.idempotencyKey, reversal.id);

    const auditEvent = await createAuditEvent(reversal, prevHash);
    chain.push(auditEvent);
    auditChains.set(movement.companyId, chain);

    const balances = deriveBalances(movement.companyId);
    return { movement: reversal, newBalances: balances, auditEvent };
  }

  // Normal movement
  const newMov = { ...movement, id: uuidv4() };
  movements.push(newMov);
  idempotencyIndex.set(newMov.idempotencyKey, newMov.id);

  const auditEvent = await createAuditEvent(newMov, prevHash);
  chain.push(auditEvent);
  auditChains.set(movement.companyId, chain);

  const balances = deriveBalances(movement.companyId);
  return { movement: newMov, newBalances: balances, auditEvent };
}

/**
 * Get all movements (optionally filtered by company).
 * @param {string} [companyId]
 * @returns {Movement[]}
 */
export function getMovements(companyId) {
  return companyId ? movements.filter(m => m.companyId === companyId) : [...movements];
}

/**
 * Get derived lot balances.
 * @param {string} [companyId]
 * @returns {Lot[]}
 */
export function getBalances(companyId) {
  return deriveBalances(companyId);
}

/**
 * Get audit chain.
 * @param {string} [companyId]
 * @returns {AuditEvent[]}
 */
export function getAuditChain(companyId) {
  if (companyId) {
    return [...(auditChains.get(companyId) || [])];
  }
  // Return all chains concatenated
  const all = [];
  for (const chain of auditChains.values()) {
    all.push(...chain);
  }
  return all;
}

/**
 * Verify audit chain integrity.
 * @param {string} [companyId]
 * @returns {Promise<{valid: boolean, brokenAt?: number}>}
 */
export async function verifyAuditChain(companyId) {
  const chain = getAuditChain(companyId);
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (!e.payload) return { valid: false, brokenAt: i, reason: 'missing payload' };
    if (e.prevHash !== prevHash) return { valid: false, brokenAt: i, reason: 'prevHash mismatch' };
    const { sha256 } = await canon('kr24.v1', JSON.parse(e.payload));
    if (e.hash !== sha256) return { valid: false, brokenAt: i, reason: 'hash mismatch' };
    prevHash = e.hash;
  }
  return { valid: true };
}

/**
 * Reset ledger (for tests only).
 */
export function __reset() {
  movements = [];
  auditChains.clear();
  idempotencyIndex.clear();
}

/**
 * Load initial movements (seed).
 * @param {Movement[]} initial
 */
export async function __loadSeed(initial) {
  __reset();
  for (const m of initial) {
    // seed movements are pre-validated, skip idempotency
    movements.push(m);
    if (m.idempotencyKey) idempotencyIndex.set(m.idempotencyKey, m.id);
  }
  // rebuild audit chains per company
  const byCompany = new Map();
  for (const m of initial) {
    if (!byCompany.has(m.companyId)) byCompany.set(m.companyId, []);
    byCompany.get(m.companyId).push(m);
  }
  for (const [companyId, movs] of byCompany) {
    const chain = [];
    let prevHash = '0'.repeat(64);
    for (const m of movs) {
      const { canonical, sha256 } = await canon('kr24.v1', m);
      const event = {
        id: uuidv4(),
        companyId: m.companyId,
        prevHash,
        payload: canonical,
        hash: sha256,
        timestamp: m.timestamp
      };
      chain.push(event);
      prevHash = sha256;
    }
    auditChains.set(companyId, chain);
  }
}

export { MOVEMENT_KINDS, uuidv4 };