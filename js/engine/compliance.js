/**
 * Compliance Score & Gates.
 * Pure function over derived state.
 */

/**
 * Compute compliance score and gate.
 * @param {Object} state
 * @param {Array} state.lots - lots with bucket, saldo, risk
 * @param {Set} state.tasks - lotIds with open tasks
 * @param {Set} state.reconDone - diffIds resolved
 * @param {Object} state.cierre - {stage, signedAt?}
 * @param {Array} state.exceptions - [{open: boolean, resolved: boolean}]
 * @returns {{score: number, gate: 'ok'|'warning'|'critical', actions: string[]}}
 */
export function score(state) {
  const { lots = [], tasks = new Set(), reconDone = new Set(), cierre = {}, exceptions = [] } = state;

  let s = 100;
  const actions = [];

  // Critical lots
  const criticalLots = lots.filter(l => l.bucket === 'critical' || l.bucket === 'expired');
  const warningLots = lots.filter(l => l.bucket === 'warning');
  const watchLots = lots.filter(l => l.bucket === 'ok' && l.saldo > 0);

  s -= criticalLots.length * 16;
  s -= warningLots.length * 8;
  s -= watchLots.length * 4;

  if (criticalLots.length) {
    actions.push(`${criticalLots.length} lote(s) crítico(s): acción inmediata requerida`);
  }
  if (warningLots.length) {
    actions.push(`${warningLots.length} lote(s) en alerta: planear descarga`);
  }

  // Tasks reduce score by 30% of remaining
  if (tasks.size > 0) {
    const penalty = Math.round(s * 0.3);
    s -= penalty;
    actions.push(`${tasks.size} tarea(s) abierta(s): ${penalty} pts`);
  }

  // Open reconciliation diffs
  const openDiffs = exceptions.filter(e => e.open && !e.resolved).length;
  s -= openDiffs * 3;
  if (openDiffs) actions.push(`${openDiffs} discrepancia(s) sin resolver`);

  // Cierre not signed
  if (cierre.stage && cierre.stage < 5 && !cierre.signedAt) {
    s -= 6;
    actions.push('Cierre mensual sin firmar');
  }

  // Gate
  let gate = 'ok';
  if (s < 60) gate = 'critical';
  else if (s < 80) gate = 'warning';

  // Critical gate override
  if (criticalLots.length > 0 && gate === 'ok') gate = 'critical';

  return { score: Math.max(0, s), gate, actions };
}

/**
 * Generate recommended actions from score breakdown.
 * @param {Object} state
 * @returns {string[]}
 */
export function recommendedActions(state) {
  const { score, actions } = score(state);
  return actions;
}