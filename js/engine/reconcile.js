/**
 * CSV Reconciliation: SAT Data Stage vs Agente Aduanal.
 * Pure parsing, alias-tolerant, deterministic diff.
 */

const DELIMITERS = ['|', ';', ','];

/**
 * Normalize header: lowercase, remove accents, strip [ _\-.]
 * @param {string} h
 * @returns {string}
 */
function normHeader(h) {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-\.]/g, '');
}

/**
 * Detect delimiter by counting in first line.
 * @param {string} line
 * @returns {string}
 */
function detectDelimiter(line) {
  let best = ',';
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = (line.match(new RegExp(`\\${d}`, 'g')) || []).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/**
 * Alias map for header matching.
 * @type {Record<string, string>}
 */
const ALIASES = {
  // pedimento
  numeropedimento: 'pedimento',
  numpedimento: 'pedimento',
  pedimento: 'pedimento',
  ped: 'pedimento',
  // aduana
  aduana: 'aduana',
  seccionaduanera: 'aduana',
  claveaduana: 'aduana',
  // patente
  patente: 'patente',
  // year
  anio: 'anio',
  ano: 'anio',
  ejercicio: 'anio',
  year: 'anio',
  // fraccion
  fraccionarancelaria: 'fraccion',
  fraccion: 'fraccion',
  fracc: 'fraccion',
  // cantidad
  cantidadumc: 'cantidad',
  cantidadumt: 'cantidad',
  cantidadcomercial: 'cantidad',
  cantidad: 'cantidad',
  cant: 'cantidad',
  // valor
  valoraduana: 'valor',
  valordolares: 'valor',
  valorcomercial: 'valor',
  valor: 'valor',
  value: 'valor'
};

/**
 * Parse number with heuristic (handles 1.234,56 and 1,234.56).
 * @param {string} s
 * @returns {number}
 */
function parseNumber(s) {
  if (!s || !s.trim()) return 0;
  const clean = s.trim().replace(/\s+/g, '');
  // If both . and , present, assume European (1.234,56)
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  // If only , and 3 digits after, could be decimal
  if (clean.includes(',') && !clean.includes('.')) {
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      return parseFloat(parts[0] + '.' + parts[1]);
    }
    return parseFloat(clean.replace(/,/g, ''));
  }
  return parseFloat(clean.replace(/,/g, ''));
}

/**
 * Parse CSV text into normalized rows.
 * @param {string} text
 * @returns {{rows: Map<string, Row>, errors: string[]}}
 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: new Map(), errors: ['CSV vacío o solo encabezado'] };

  const delim = detectDelimiter(lines[0]);
  const rawHeaders = lines[0].split(delim);
  const headers = rawHeaders.map(normHeader);
  const mapped = headers.map(h => ALIASES[h] || h);

  const rows = new Map();
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length < mapped.length) continue;

    const row = {};
    for (let j = 0; j < mapped.length; j++) {
      row[mapped[j]] = cols[j]?.trim() || '';
    }

    if (!row.pedimento) continue;

    // Build pedimento from parts if needed
    let pedimento = row.pedimento.replace(/\s+/g, '');
    if (/^\d{7}$/.test(pedimento) && row.aduana && row.patente) {
      const year = row.anio || `2${pedimento[0]}`;
      pedimento = `${year} ${row.aduana} ${row.patente} ${pedimento}`;
    }

    const key = `${pedimento}|${row.fraccion || ''}`;
    const existing = rows.get(key);

    const parsed = {
      pedimento,
      fraccion: row.fraccion || '',
      cantidad: parseNumber(row.cantidad),
      valor: parseNumber(row.valor)
    };

    if (existing) {
      existing.cantidad += parsed.cantidad;
      // valor: keep first (or could average)
    } else {
      rows.set(key, parsed);
    }
  }

  return { rows, errors };
}

/**
 * Reconcile SAT vs Agent.
 * @param {string} satText
 * @param {string} agentText
 * @returns {{matches: number, diffs: DiffRow[], stats: {satRows: number, agentRows: number, matched: number, diffQty: number, diffVal: number}}}
 */
export function reconcile(satText, agentText) {
  const { rows: satRows } = parseCSV(satText);
  const { rows: agentRows } = parseCSV(agentText);

  const allKeys = new Set([...satRows.keys(), ...agentRows.keys()]);
  let matches = 0;
  const diffs = [];

  for (const key of allKeys) {
    const sat = satRows.get(key);
    const agt = agentRows.get(key);

    if (sat && agt) {
      const qtyDiff = Math.abs(sat.cantidad - agt.cantidad);
      const valDiff = Math.abs(sat.valor - agt.valor);
      const tolQty = 0.005 * Math.max(sat.cantidad, agt.cantidad);
      const tolVal = 0.01 * Math.max(sat.valor, agt.valor);

      const qtyMismatch = qtyDiff > tolQty;
      const valMismatch = valDiff > tolVal;

      if (!qtyMismatch && !valMismatch) {
        matches++;
      } else {
        if (qtyMismatch) {
          diffs.push({
            pedimento: key.split('|')[0],
            fraccion: key.split('|')[1],
            satQty: sat.cantidad,
            agentQty: agt.cantidad,
            satVal: sat.valor,
            agentVal: agt.valor,
            type: 'qty',
            detail: `SAT ${sat.cantidad.toLocaleString()} · Agente ${agt.cantidad.toLocaleString()}`,
            why: `Diferencia ${qtyDiff.toLocaleString()} > tolerancia ${tolQty.toLocaleString()} (0.5%)`
          });
        }
        if (valMismatch) {
          diffs.push({
            pedimento: key.split('|')[0],
            fraccion: key.split('|')[1],
            satQty: sat.cantidad,
            agentQty: agt.cantidad,
            satVal: sat.valor,
            agentVal: agt.valor,
            type: 'val',
            detail: `SAT ${sat.valor.toLocaleString()} · Agente ${agt.valor.toLocaleString()}`,
            why: `Diferencia ${valDiff.toLocaleString()} > tolerancia ${tolVal.toLocaleString()} (1%)`
          });
        }
      }
    } else if (sat) {
      diffs.push({
        pedimento: key.split('|')[0],
        fraccion: key.split('|')[1],
        satQty: sat.cantidad,
        agentQty: 0,
        satVal: sat.valor,
        agentVal: 0,
        type: 'missing',
        detail: 'Solo en SAT',
        why: 'No aparece en archivo del agente'
      });
    } else {
      diffs.push({
        pedimento: key.split('|')[0],
        fraccion: key.split('|')[1],
        satQty: 0,
        agentQty: agt.cantidad,
        satVal: 0,
        agentVal: agt.valor,
        type: 'missing',
        detail: 'Solo en Agente',
        why: 'No aparece en SAT Data Stage'
      });
    }
  }

  return {
    matches,
    diffs,
    stats: {
      satRows: satRows.size,
      agentRows: agentRows.size,
      matched: matches,
      diffQty: diffs.filter(d => d.type === 'qty').length,
      diffVal: diffs.filter(d => d.type === 'val').length
    }
  };
}