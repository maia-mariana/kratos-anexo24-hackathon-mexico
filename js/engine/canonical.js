/**
 * Canonicalization & SHA-256 hashing (WebCrypto)
 * Version: kr24.v1
 * Deterministic: recursive key sort, arrays preserved, no whitespace.
 */

const CANONICAL_VERSION = 'kr24.v1';

/**
 * Recursively sort object keys. Arrays keep element order.
 * @param {any} value
 * @returns {any} sorted value
 */
function sortValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortValue);
  // Object: sort keys, recurse
  return Object.keys(value)
    .sort()
    .reduce((acc, k) => {
      acc[k] = sortValue(value[k]);
      return acc;
    }, {});
}

/**
 * Stable JSON stringify (no spaces, sorted keys).
 * @param {any} value
 * @returns {string}
 */
function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

/**
 * SHA-256 hex via WebCrypto (async).
 * @param {string} str - UTF-8 string to hash
 * @returns {Promise<string>} lowercase hex (64 chars)
 */
async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonicalize and hash a value.
 * @param {string} version - must be 'kr24.v1'
 * @param {any} value - JSON-serializable value
 * @returns {Promise<{canonical: string, sha256: string}>}
 */
export async function canon(version, value) {
  if (version !== CANONICAL_VERSION) {
    throw new Error(`Unsupported canonical version: ${version}. Expected ${CANONICAL_VERSION}`);
  }
  const canonical = stableStringify(value);
  const prefixed = `${version}|${canonical}`;
  const sha256 = await sha256Hex(prefixed);
  return { canonical, sha256 };
}

/**
 * Canonicalize only (no hash). Useful for diffing.
 * @param {string} version
 * @param {any} value
 * @returns {string}
 */
export function canonicalString(version, value) {
  if (version !== CANONICAL_VERSION) {
    throw new Error(`Unsupported canonical version: ${version}. Expected ${CANONICAL_VERSION}`);
  }
  return stableStringify(value);
}

/**
 * Flatten object to dot-path map. Arrays become single JSON string per path.
 * @param {any} obj
 * @param {string} [prefix='']
 * @returns {Record<string, string>}
 */
export function flatten(obj, prefix = '') {
  const out = {};
  if (obj === null || typeof obj !== 'object') {
    out[prefix] = String(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    // Arrays: single opaque field
    out[prefix] = stableStringify(obj);
    return out;
  }
  for (const [k, v] of Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) {
    const path = prefix ? `${prefix}.${k}` : k;
    Object.assign(out, flatten(v, path));
  }
  return out;
}

/**
 * Compare two flattened objects. Missing keys marked '(absent)'.
 * @param {Record<string, string>} orig
 * @param {Record<string, string>} curr
 * @returns {Array<{path: string, changeType: 'added'|'removed'|'modified', originalValue?: string, currentValue?: string}>}
 */
export function diffFlattened(orig, curr) {
  const allKeys = new Set([...Object.keys(orig), ...Object.keys(curr)]);
  const diffs = [];
  for (const key of [...allKeys].sort()) {
    const o = orig[key];
    const c = curr[key];
    if (o === undefined) {
      diffs.push({ path: key, changeType: 'added', currentValue: c });
    } else if (c === undefined) {
      diffs.push({ path: key, changeType: 'removed', originalValue: o });
    } else if (o !== c) {
      diffs.push({ path: key, changeType: 'modified', originalValue: o, currentValue: c });
    }
  }
  return diffs;
}