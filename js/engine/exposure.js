/**
 * Fiscal Exposure Calculation (IGI + IVA + DTA + Multa).
 * Pure integer cents arithmetic, half-up rounding at each step.
 */

const IVA_RATE = 0.16;
const DTA_RATE = 0.008;
const MULTA_MIN = 2_707_000; // cents
const MULTA_MAX = 5_418_000;
const MULTA_RATE = 0.15; // recargos over omitted taxes

/**
 * Round half-up to integer cents.
 * @param {number} n
 * @returns {number}
 */
function round(n) {
  return Math.round(n);
}

/**
 * Compute exposure for a single lot.
 * @param {Object} lot - {saldo, valorUnitarioMXN, igiRate, bucket}
 * @returns {ExposureLot}
 */
export function computeLotExposure(lot) {
  const { saldo, valorUnitarioMXN, igiRate = 0.05, bucket = 'ok' } = lot;
  if (saldo <= 0) return zeroExposure(lot);

  const base = round(saldo * valorUnitarioMXN);
  const igi = round(base * igiRate);
  const iva = round((base + igi) * IVA_RATE);
  const dta = round((base + igi) * DTA_RATE);
  const omitted = igi + iva + dta;
  const multaEst = round(omitted * MULTA_RATE);
  const multaMin = MULTA_MIN;
  const total = base + igi + iva + dta + multaEst;

  return {
    lotId: lot.id,
    saldo,
    valorUnitarioMXN,
    igiRate,
    ivaRate: IVA_RATE,
    dtaRate: DTA_RATE,
    multaMin,
    multaMax: MULTA_MAX,
    baseMXN: base,
    igiMXN: igi,
    ivaMXN: iva,
    dtaMXN: dta,
    multaEstMXN: multaEst,
    totalMXN: total,
    bucket
  };
}

/**
 * Zero exposure for exhausted lots.
 */
function zeroExposure(lot) {
  return {
    lotId: lot.id,
    saldo: lot.saldo || 0,
    valorUnitarioMXN: lot.valorUnitarioMXN || 0,
    igiRate: lot.igiRate || 0,
    ivaRate: IVA_RATE,
    dtaRate: DTA_RATE,
    multaMin: MULTA_MIN,
    multaMax: MULTA_MAX,
    baseMXN: 0,
    igiMXN: 0,
    ivaMXN: 0,
    dtaMXN: 0,
    multaEstMXN: 0,
    totalMXN: 0,
    bucket: lot.bucket || 'ok'
  };
}

/**
 * Aggregate exposure by bucket and grand total.
 * @param {ExposureLot[]} perLot
 * @returns {{perLot: ExposureLot[], totals: {byBucket: Record<string, number>, grandTotal: number}}}
 */
export function computeExposure(lots) {
  const perLot = lots.map(computeLotExposure);
  const byBucket = { expired: 0, critical: 0, warning: 0, ok: 0 };
  let grandTotal = 0;

  for (const e of perLot) {
    byBucket[e.bucket] += e.totalMXN;
    grandTotal += e.totalMXN;
  }

  return { perLot, totals: { byBucket, grandTotal } };
}

/**
 * Exposure for a company's lots at a reference date.
 * @param {Array} lots - raw lots (needs deadline meta)
 * @param {Date|string|number} refDate
 * @returns {Promise<{perLot: ExposureLot[], totals: {byBucket, grandTotal}}>}
 */
export async function exposureForCompany(lots, refDate) {
  const { computeDeadlines } = await import('./deadlines.js');
  const withMeta = computeDeadlines(lots, refDate);
  return computeExposure(withMeta);
}