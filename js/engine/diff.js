/**
 * Field-level diff with severity classification.
 * Depends on canonical.js flatten + stableStringify.
 */

import { flatten, diffFlattened } from './canonical.js';

/**
 * Severity enum.
 * @readonly
 * @enum {string}
 */
export const Severity = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Fields considered critical for IMMEX compliance.
 * All lowercase to match normalizeField output.
 * @type {Set<string>}
 */
const CRITICAL_FIELDS = new Set([
  'cantidad', 'cantidadbase', 'qtybase', 'quantity',
  'pedimento', 'pedimentonumero', 'pedimentoid',
  'material', 'materialid', 'fraccion', 'fraccionarancelaria',
  'fechapago', 'fecha', 'vence', 'deadline', 'fechavencimiento',
  'valor', 'valornitario', 'valornitariomxn', 'unitcostmxn',
  'igirate', 'igi', 'iva', 'dta', 'multa',
  'saldo', 'balance'
]);

/**
 * Normalize field name for severity check.
 * @param {string} path
 * @returns {string}
 */
function normalizeField(path) {
  return path.split('.').pop()?.toLowerCase() || '';
}

/**
 * Assign severity based on field name and change type.
 * @param {string} path
 * @param {'added'|'removed'|'modified'} changeType
 * @returns {'critical'|'warning'|'info'}
 */
function assignSeverity(path, changeType) {
  if (changeType === 'added' || changeType === 'removed') return Severity.INFO;
  const field = normalizeField(path);
  // Check if any segment matches critical
  const segments = path.toLowerCase().split('.');
  for (const seg of segments) {
    if (CRITICAL_FIELDS.has(seg)) return Severity.CRITICAL;
  }
  return Severity.WARNING;
}

/**
 * Field difference record.
 * @typedef {Object} FieldDiff
 * @property {string} path - dot-path
 * @property {'added'|'removed'|'modified'} changeType
 * @property {'critical'|'warning'|'info'} severity
 * @property {string} [originalValue]
 * @property {string} [currentValue]
 * @property {string} [note]
 */

/**
 * Deep diff two values with severity.
 * @param {any} original
 * @param {any} current
 * @returns {Promise<FieldDiff[]>}
 */
export async function diff(original, current) {
  const origFlat = flatten(original);
  const currFlat = flatten(current);
  const rawDiffs = diffFlattened(origFlat, currFlat);

  return rawDiffs.map(d => ({
    path: d.path,
    changeType: d.changeType,
    severity: assignSeverity(d.path, d.changeType),
    originalValue: d.originalValue,
    currentValue: d.currentValue,
    note: ''
  }));
}

/**
 * Count diffs by severity.
 * @param {FieldDiff[]} diffs
 * @returns {{critical: number, warning: number, info: number}}
 */
export function countBySeverity(diffs) {
  return diffs.reduce((acc, d) => {
    acc[d.severity]++;
    return acc;
  }, { critical: 0, warning: 0, info: 0 });
}