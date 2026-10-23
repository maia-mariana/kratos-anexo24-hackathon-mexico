/**
 * AI Integrity Inspector — document integrity verification.
 * Ingests files/JSON → canonical hashes → diff → local explain → manifest.
 */

import { canon, canonicalString } from './canonical.js';
import { diff, countBySeverity } from './diff.js';

const RULES_VERSION = 'kr24.v1';

/**
 * Try to parse JSON from bytes.
 * @param {ArrayBuffer|Uint8Array|string} input
 * @returns {any|null}
 */
function tryParseJSON(input) {
  try {
    let str;
    if (typeof input === 'string') str = input;
    else if (input instanceof ArrayBuffer) str = new TextDecoder().decode(input);
    else if (input instanceof Uint8Array) str = new TextDecoder().decode(input);
    else return null;
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * SHA-256 of raw bytes (for original file hash).
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {Promise<string>}
 */
async function sha256Bytes(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const arr = new Uint8Array(hashBuffer);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Local rule-based explanation (parity with Sentinel explainIntegrityLocal).
 * @param {Object} params
 * @returns {string}
 */
function localExplain({ match, differences, originalHash, currentHash }) {
  const lines = [];
  lines.push('MOTOR LOCAL · KR24.v1');
  lines.push('');
  if (match) {
    lines.push('✅ INTEGRIDAD VERIFICADA');
    lines.push(`Ambos documentos producen el mismo hash canónico: ${originalHash}`);
    lines.push('No se detectaron diferencias en campos normalizados.');
  } else {
    lines.push('⚠️ DISCREPANCIA DETECTADA');
    lines.push(`Hash original: ${originalHash}`);
    lines.push(`Hash comparado: ${currentHash}`);
    lines.push('');
    const counts = countBySeverity(differences);
    lines.push(`Diferencias: ${counts.critical} críticas, ${counts.warning} advertencias, ${counts.info} informativas.`);
    lines.push('');

    for (const d of differences) {
      const tag = d.severity === 'critical' ? '🔴' : d.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`${tag} ${d.path}: ${d.changeType}`);
      if (d.originalValue !== undefined) lines.push(`   Antes: ${d.originalValue}`);
      if (d.currentValue !== undefined) lines.push(`   Ahora: ${d.currentValue}`);
    }
  }
  lines.push('');
  lines.push('⚠️ NOTA LEGAL: La integridad criptográfica demuestra correspondencia con un contenido concreto.');
  lines.push('No acredita autenticidad del documento ni cumplimiento del Anexo 24.');
  lines.push('Las diferencias detectadas requieren análisis del especialista aduanal.');
  return lines.join('\n');
}

/**
 * Inspect two documents (files or JSON).
 * @param {Object} opts
 * @param {ArrayBuffer|Uint8Array|any} opts.original - original document
 * @param {ArrayBuffer|Uint8Array|any} opts.compared - compared document
 * @param {string} [opts.originalName]
 * @param {string} [opts.comparedName]
 * @returns {Promise<InspectionResult>}
 */
export async function inspect({ original, compared, originalName = 'original', comparedName = 'compared' }) {
  // Raw bytes hash (if binary input)
  let originalBytesHash = null;
  let comparedBytesHash = null;

  // Canonical hashes
  let originalCanonical, comparedCanonical;
  let originalObj, comparedObj;

  // Process original
  if (original instanceof ArrayBuffer || original instanceof Uint8Array) {
    originalBytesHash = await sha256Bytes(original);
    originalObj = tryParseJSON(original);
  } else {
    originalObj = original;
  }

  // Process compared
  if (compared instanceof ArrayBuffer || compared instanceof Uint8Array) {
    comparedBytesHash = await sha256Bytes(compared);
    comparedObj = tryParseJSON(compared);
  } else {
    comparedObj = compared;
  }

  // Canonicalize (fallback to stringified object if not JSON-parseable)
  if (originalObj !== null) {
    const res = await canon(RULES_VERSION, originalObj);
    originalCanonical = res.canonical;
  } else {
    originalCanonical = canonicalString(RULES_VERSION, { _raw: 'unparseable', name: originalName });
  }

  if (comparedObj !== null) {
    const res = await canon(RULES_VERSION, comparedObj);
    comparedCanonical = res.canonical;
  } else {
    comparedCanonical = canonicalString(RULES_VERSION, { _raw: 'unparseable', name: comparedName });
  }

  const originalHash = await canon(RULES_VERSION, originalCanonical).then(r => r.sha256);
  const currentHash = await canon(RULES_VERSION, comparedCanonical).then(r => r.sha256);
  const match = originalHash === currentHash;

  // Diff on parsed objects
  let differences = [];
  if (originalObj !== null && comparedObj !== null) {
    differences = await diff(originalObj, comparedObj);
  } else if (!match) {
    differences = [{ path: 'root', changeType: 'modified', severity: 'critical', note: 'Contenido no parseable como JSON; hashes divergen' }];
  }

  // Manifest
  const manifest = {
    version: RULES_VERSION,
    timestamp: new Date().toISOString(),
    original: {
      name: originalName,
      bytesSha256: originalBytesHash,
      canonicalSha256: originalHash,
      format: originalObj !== null ? 'json' : 'binary'
    },
    compared: {
      name: comparedName,
      bytesSha256: comparedBytesHash,
      canonicalSha256: currentHash,
      format: comparedObj !== null ? 'json' : 'binary'
    },
    match,
    differences: differences.map(d => ({
      path: d.path,
      changeType: d.changeType,
      severity: d.severity,
      originalValue: d.originalValue,
      currentValue: d.currentValue
    })),
    rulesVersion: RULES_VERSION
  };
  const manifestCanon = canonicalString(RULES_VERSION, manifest);
  const manifestSha256 = await canon(RULES_VERSION, manifest).then(r => r.sha256);

  return {
    original: {
      name: originalName,
      bytesSha256: originalBytesHash,
      canonicalSha256: originalHash,
      canonicalVersion: RULES_VERSION,
      format: originalObj !== null ? 'json' : 'binary'
    },
    compared: {
      name: comparedName,
      bytesSha256: comparedBytesHash,
      canonicalSha256: currentHash,
      canonicalVersion: RULES_VERSION,
      format: comparedObj !== null ? 'json' : 'binary'
    },
    match,
    differences,
    manifest: manifestCanon,
    manifestSha256,
    rulesVersion: RULES_VERSION,
    aiExplanation: localExplain({ match, differences, originalHash, currentHash }),
    aiSource: 'rules',
    aiConfidence: 1.0
  };
}