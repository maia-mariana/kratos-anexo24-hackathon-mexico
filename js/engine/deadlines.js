/**
 * Legal Deadlines & Semáforo (Art. 108 LA).
 * Pure functions with injected refDate for testability.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Add months to a date (handles month overflow).
 * @param {Date|string} date
 * @param {number} months
 * @returns {Date}
 */
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Compute deadline metadata for lots.
 * @param {Array<{id:string, companyId:string, partidaId:string, saldo:number, fechaPago:string, plazoMeses:number}>} lots
 * @param {Date|string|number} refDate - reference date (default: now)
 * @returns {Array<LotWithMeta>}
 */
export function computeDeadlines(lots, refDate = new Date()) {
  const ref = new Date(refDate);
  return lots.map(lot => {
    const pago = new Date(lot.fechaPago);
    const vence = addMonths(pago, lot.plazoMeses || 18);
    const diffMs = vence.getTime() - ref.getTime();
    const diasRestantes = Math.ceil(diffMs / MS_PER_DAY);

    let bucket;
    if (diasRestantes <= 0) bucket = 'expired';
    else if (diasRestantes <= 30) bucket = 'critical';
    else if (diasRestantes <= 60) bucket = 'warning';
    else bucket = 'ok';

    return {
      ...lot,
      vence: vence.toISOString().split('T')[0],
      diasRestantes,
      bucket,
      estado: bucket
    };
  });
}

/**
 * Aggregate lots into semáforo buckets.
 * @param {Array<{id:string, companyId:string, saldo:number, bucket:string, diasRestantes:number}>} lotsWithMeta
 * @returns {{expired: number, critical: number, warning: number, ok: number, totals: {saldo: number, riskMXN: number}}}
 */
export function semaforoBuckets(lotsWithMeta) {
  const buckets = { expired: 0, critical: 0, warning: 0, ok: 0 };
  let totalSaldo = 0;

  for (const lot of lotsWithMeta) {
    if (lot.saldo > 0) {
      buckets[lot.bucket]++;
      totalSaldo += lot.saldo;
    }
  }

  return {
    ...buckets,
    totals: { saldo: totalSaldo, riskMXN: 0 } // riskMXN computed by exposure.js
  };
}

/**
 * Options and costs for a lot (what to do before deadline).
 * Mirrors KRATOS optionsAt logic.
 * @param {Object} lot - with {saldo, valorUnitarioMXN, igiRate, bucket}
 * @param {number} waitDays - days to wait before acting
 * @returns {Object} options with costs in MXN cents
 */
export function optionsAt(lot, waitDays = 0) {
  const { saldo, valorUnitarioMXN, igiRate = 0.05 } = lot;
  const V = saldo * valorUnitarioMXN; // base value MXN cents

  // Constants (MXN cents)
  const IVA_RATE = 0.16;
  const DTA_RATE = 0.008;
  const MULTA_MIN = 2_707_000; // cents
  const MULTA_MAX = 5_418_000;

  // Cost formulas (from KRATOS app.js:128-166)
  // Exportar: 6,500 + V*3% + IGI + IVA
  // Retornar: 4,800 + V*6% + IGI + DTA
  // Nacionalizar: IGI + DTA + 2,900
  // No hacer: IGI + DTA + IVA + MULTA_MIN

  const igi = Math.round(V * igiRate);
  const iva = Math.round((V + igi) * IVA_RATE);
  const dta = Math.round((V + igi) * DTA_RATE);
  const multaMin = MULTA_MIN;

  const exp = 650_000 + Math.round(V * 0.03) + igi + iva;
  const ret = 480_000 + Math.round(V * 0.06) + igi + dta;
  const def = igi + dta + 290_000;
  const nada = igi + dta + iva + multaMin;

  // Wait cost per day (lead times)
  const LEAD = { exp: 6, ret: 10, def: 2 };
  const waitCostPerDay = {
    exp: Math.round(exp / LEAD.exp),
    ret: Math.round(ret / LEAD.ret),
    def: Math.round(def / LEAD.def),
    nada: Math.round(nada / 30) // multa accrues daily approx
  };

  const options = {
    exportar: { label: 'Exportar', cost: exp, leadDays: LEAD.exp, waitCostPerDay: waitCostPerDay.exp },
    retornar: { label: 'Retornar', cost: ret, leadDays: LEAD.ret, waitCostPerDay: waitCostPerDay.ret },
    nacionalizar: { label: 'Nacionalizar', cost: def, leadDays: LEAD.def, waitCostPerDay: waitCostPerDay.def },
    nada: { label: 'No hacer', cost: nada, leadDays: 0, waitCostPerDay: waitCostPerDay.nada }
  };

  // Apply wait days
  if (waitDays > 0) {
    for (const k of Object.keys(options)) {
      options[k].cost += options[k].waitCostPerDay * waitDays;
    }
  }

  // Best = minimum cost
  const bestKey = Object.keys(options).reduce((a, b) =>
    options[a].cost < options[b].cost ? a : b
  );

  return { options, best: bestKey, waitDays };
}

/**
 * First actionable step text for a lot.
 * @param {Object} lot
 * @param {string} bestOption
 * @returns {string}
 */
export function firstStep(lot, bestOption) {
  const steps = {
    exportar: 'Solicitar pedimento de exportación',
    retornar: 'Preparar retorno al extranjero',
    nacionalizar: 'Iniciar importación definitiva (F4)',
    nada: 'Monitorear; riesgo de multa Art. 185'
  };
  return steps[bestOption] || 'Revisar con analista';
}

/**
 * Cause text for a lot's alert.
 * @param {Object} lot
 * @returns {string}
 */
export function causeText(lot) {
  if (lot.bucket === 'expired') return `Vencido hace ${Math.abs(lot.diasRestantes)} días (Art. 108)`;
  if (lot.bucket === 'critical') return `Vence en ${lot.diasRestantes} días (Art. 108)`;
  if (lot.bucket === 'warning') return `Vence en ${lot.diasRestantes} días — ventana de acción`;
  return 'En plazo';
}