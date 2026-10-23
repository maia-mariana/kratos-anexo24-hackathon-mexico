/**
 * Persistence Layer — localStorage (ledger/state) + IndexedDB (documents).
 * Schema versioned, debounced save, migration support.
 */

const STORAGE_KEY = 'kratos-anexo24-state';
const CURRENT_SCHEMA_VERSION = 2;
const DEBOUNCE_MS = 300;

let saveTimer = null;
let pendingState = null;
let onSaveCallback = null;

/**
 * Set callback fired after successful save.
 * @param {Function} cb - called with (state)
 */
export function setOnSave(cb) {
  onSaveCallback = cb;
}

/**
 * Generate UUIDv4.
 */
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Current timestamp ISO.
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Default empty state structure.
 */
export function createEmptyState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: nowISO(),
    companies: [],
    activeCompanyId: null,
    materials: [],
    pedimentos: [],
    partidas: [],
    movements: [],
    auditChains: {},
    documents: [], // metadata only; blobs in IndexedDB
    inspections: [],
    tasks: {},
    reconDone: {},
    cierre: {},
    ui: { view: 'resumen', theme: 'light' }
  };
}

/**
 * Migrate state from older schema versions.
 * @param {Object} state
 * @returns {Object} migrated state
 */
export function migrateState(state) {
  let s = { ...state };
  const fromVersion = s.schemaVersion || 1;

  if (fromVersion === CURRENT_SCHEMA_VERSION) return s;

  console.info(`[store] Migrating state from v${fromVersion} to v${CURRENT_SCHEMA_VERSION}`);

  // v1 -> v2: split auditChain into per-company auditChains, add documents/inspections arrays
  if (fromVersion === 1) {
    // Old v1 had single auditChain array; convert to per-company map
    const oldChain = s.auditChain || [];
    const byCompany = {};
    for (const e of oldChain) {
      if (!byCompany[e.companyId]) byCompany[e.companyId] = [];
      byCompany[e.companyId].push(e);
    }
    s.auditChains = byCompany;
    delete s.auditChain;

    // New arrays
    s.documents = s.documents || [];
    s.inspections = s.inspections || [];
    s.tasks = s.tasks || {};
    s.reconDone = s.reconDone || {};
    s.cierre = s.cierre || {};
    s.ui = s.ui || { view: 'resumen', theme: 'light' };
  }

  s.schemaVersion = CURRENT_SCHEMA_VERSION;
  s.savedAt = nowISO();
  return s;
}

/**
 * Load state from localStorage.
 * @returns {Object} state (migrated to current version)
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();

    const parsed = JSON.parse(raw);
    // Handle legacy v1 without schemaVersion
    if (!parsed.schemaVersion) parsed.schemaVersion = 1;

    return migrateState(parsed);
  } catch (e) {
    console.error('[store] Failed to load state, starting fresh:', e);
    return createEmptyState();
  }
}

/**
 * Save state to localStorage (debounced).
 * @param {Object} state
 * @param {boolean} immediate - skip debounce
 */
export function saveState(state, immediate = false) {
  const payload = {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: nowISO()
  };

  if (immediate) {
    doSave(payload);
  } else {
    pendingState = payload;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      doSave(pendingState);
      pendingState = null;
    }, DEBOUNCE_MS);
  }
}

/**
 * Internal save.
 * @param {Object} payload
 */
function doSave(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (onSaveCallback) onSaveCallback(payload);
  } catch (e) {
    console.error('[store] Save failed:', e);
    if (e.name === 'QuotaExceededError') {
      // Could implement LRU eviction here
      throw new Error('Storage quota exceeded');
    }
  }
}

/**
 * Force flush pending save.
 */
export function flush() {
  if (pendingState) {
    doSave(pendingState);
    pendingState = null;
    if (saveTimer) clearTimeout(saveTimer);
  }
}

/**
 * Reset all storage (for tests / "Reiniciar demo").
 */
export function clearAll() {
  flush();
  localStorage.removeItem(STORAGE_KEY);
  // Note: IndexedDB cleared separately via clearDocuments()
}

/**
 * Get active company ID.
 * @param {Object} state
 * @returns {string|null}
 */
export function getActiveCompanyId(state) {
  return state.activeCompanyId || (state.companies[0]?.id || null);
}

/**
 * Set active company.
 * @param {Object} state
 * @param {string} companyId
 * @returns {Object} new state
 */
export function setActiveCompany(state, companyId) {
  return { ...state, activeCompanyId: companyId };
}

// ===================== IndexedDB: Documents =====================

const DB_NAME = 'kratos-anexo24-docs';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise = null;

/**
 * Open IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('companyId', 'companyId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/**
 * Store document blob + metadata.
 * @param {Object} doc - {id, companyId, name, mime, size, sha256Bytes, canonicalSha256, canonicalVersion, format, extractedJSON, createdAt}
 * @param {ArrayBuffer|Blob} blob - file bytes
 * @returns {Promise<string>} document id
 */
export async function putDocument(doc, blob) {
  const db = await openDB();
  const record = {
    ...doc,
    blob,
    id: doc.id || uuidv4(),
    createdAt: doc.createdAt || nowISO()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve(record.id);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get document metadata + blob.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get document metadata only (no blob).
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getDocumentMeta(id) {
  const doc = await getDocument(id);
  if (!doc) return null;
  const { blob, ...meta } = doc;
  return meta;
}

/**
 * List documents for a company.
 * @param {string} companyId
 * @returns {Promise<Object[]>}
 */
export async function listDocuments(companyId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('companyId');
    const req = index.getAll(companyId);
    req.onsuccess = () => {
      const docs = req.result.map(({ blob, ...meta }) => meta);
      resolve(docs);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete document.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteDocument(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all documents (for tests / reset).
 * @returns {Promise<void>}
 */
export async function clearDocuments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Count documents.
 * @returns {Promise<number>}
 */
export async function countDocuments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}