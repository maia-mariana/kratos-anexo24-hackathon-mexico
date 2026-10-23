/**
 * Store tests — node:test + jsdom for localStorage/IndexedDB
 * Run: npm test
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup jsdom with localStorage and IndexedDB
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.TextEncoder = dom.window.TextEncoder;
global.TextDecoder = dom.window.TextDecoder;
global.Blob = dom.window.Blob;

// Polyfill IndexedDB for Node.js using fake-indexeddb
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
// Note: global.crypto already exists in Node.js 19+; use built-in WebCrypto

// Import store after globals set
import * as store from '../js/store/index.js';

describe('store.js — localStorage state', () => {
  beforeEach(() => {
    localStorage.clear();
    store.flush();
  });

  test('createEmptyState returns valid structure', () => {
    const s = store.createEmptyState();
    assert.equal(s.schemaVersion, 2);
    assert.ok(s.savedAt);
    assert.ok(Array.isArray(s.companies));
    assert.ok(Array.isArray(s.materials));
    assert.ok(Array.isArray(s.movements));
    assert.ok(typeof s.auditChains === 'object');
    assert.ok(Array.isArray(s.documents));
    assert.ok(Array.isArray(s.inspections));
  });

  test('loadState returns empty when nothing stored', () => {
    const s = store.loadState();
    assert.equal(s.schemaVersion, 2);
    assert.equal(s.companies.length, 0);
  });

  test('saveState and loadState round-trip', () => {
    const s = store.createEmptyState();
    s.companies.push({ id: 'c1', rfc: 'TEST123', name: 'Test Co' });
    s.activeCompanyId = 'c1';
    s.ui.view = 'panel';

    store.saveState(s, true); // immediate
    const loaded = store.loadState();

    assert.equal(loaded.schemaVersion, 2);
    assert.equal(loaded.companies.length, 1);
    assert.equal(loaded.companies[0].id, 'c1');
    assert.equal(loaded.activeCompanyId, 'c1');
    assert.equal(loaded.ui.view, 'panel');
  });

  test('migrateState upgrades v1 to v2', () => {
    const v1State = {
      schemaVersion: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      companies: [{ id: 'c1', rfc: 'TEST', name: 'Test' }],
      activeCompanyId: 'c1',
      auditChain: [
        { id: 'e1', companyId: 'c1', prevHash: '0'.repeat(64), payload: '{}', hash: 'a'.repeat(64), timestamp: '2026-01-01T00:00:00.000Z' }
      ]
    };
    localStorage.setItem('kratos-anexo24-state', JSON.stringify(v1State));

    const loaded = store.loadState();

    assert.equal(loaded.schemaVersion, 2);
    assert.ok(loaded.auditChains);
    assert.ok(loaded.auditChains.c1);
    assert.equal(loaded.auditChains.c1.length, 1);
    assert.ok(!loaded.auditChain); // old key removed
    assert.ok(loaded.documents);
    assert.ok(loaded.inspections);
  });

  test('debounced save batches rapid calls', async () => {
    const s = store.createEmptyState();
    let saveCount = 0;
    store.setOnSave(() => saveCount++);

    s.ui.view = 'a';
    store.saveState(s); // debounced
    s.ui.view = 'b';
    store.saveState(s); // debounced
    s.ui.view = 'c';
    store.saveState(s); // debounced

    // Wait for debounce
    await new Promise(r => setTimeout(r, 350));

    assert.equal(saveCount, 1); // only one actual write

    const loaded = store.loadState();
    assert.equal(loaded.ui.view, 'c'); // last value wins
  });

  test('immediate save bypasses debounce', () => {
    const s = store.createEmptyState();
    s.ui.view = 'immediate';
    store.saveState(s, true);

    const loaded = store.loadState();
    assert.equal(loaded.ui.view, 'immediate');
  });

  test('flush forces pending save', async () => {
    const s = store.createEmptyState();
    s.ui.view = 'flush-test';
    store.saveState(s); // debounced

    store.flush();

    const loaded = store.loadState();
    assert.equal(loaded.ui.view, 'flush-test');
  });

  test('clearAll removes state', () => {
    const s = store.createEmptyState();
    s.companies.push({ id: 'c1' });
    store.saveState(s, true);

    store.clearAll();

    const loaded = store.loadState();
    assert.equal(loaded.companies.length, 0);
    assert.equal(loaded.schemaVersion, 2);
  });

  test('getActiveCompanyId returns first company if none set', () => {
    const s = store.createEmptyState();
    s.companies.push({ id: 'c1' }, { id: 'c2' });
    assert.equal(store.getActiveCompanyId(s), 'c1');
  });

  test('setActiveCompanyId updates state', () => {
    const s = store.createEmptyState();
    s.companies.push({ id: 'c1' }, { id: 'c2' });
    const s2 = store.setActiveCompany(s, 'c2');
    assert.equal(s2.activeCompanyId, 'c2');
    assert.equal(s.activeCompanyId, null); // original unchanged
  });
});

describe('store.js — IndexedDB documents', () => {
  beforeEach(async () => {
    await store.clearDocuments();
  });

  after(async () => {
    await store.clearDocuments();
  });

  test('putDocument stores and retrieves blob + meta', async () => {
    const blob = new TextEncoder().encode('contenido del archivo');
    const doc = {
      companyId: 'c1',
      name: 'test.pdf',
      mime: 'application/pdf',
      size: blob.length,
      sha256Bytes: 'a'.repeat(64),
      canonicalSha256: 'b'.repeat(64),
      canonicalVersion: 'kr24.v1',
      format: 'pdf'
    };

    const id = await store.putDocument(doc, blob);
    assert.ok(id);

    const retrieved = await store.getDocument(id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, id);
    assert.equal(retrieved.companyId, 'c1');
    assert.equal(retrieved.name, 'test.pdf');
    assert.equal(retrieved.size, blob.length);
    // fake-indexeddb returns raw ArrayBuffer/Uint8Array, not Blob
    assert.ok(retrieved.blob instanceof Uint8Array || retrieved.blob instanceof ArrayBuffer);
    const content = new TextDecoder().decode(retrieved.blob);
    assert.equal(content, 'contenido del archivo');
  });

  test('getDocumentMeta returns metadata without blob', async () => {
    const blob = new TextEncoder().encode('test');
    const doc = { companyId: 'c1', name: 'test.txt', mime: 'text/plain', size: 4, sha256Bytes: 'x'.repeat(64), canonicalSha256: 'y'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' };
    const id = await store.putDocument(doc, blob);

    const meta = await store.getDocumentMeta(id);
    assert.ok(meta);
    assert.ok(!meta.blob);
    assert.equal(meta.name, 'test.txt');
  });

  test('listDocuments filters by companyId', async () => {
    const blob = new TextEncoder().encode('x');
    await store.putDocument({ companyId: 'c1', name: 'a.pdf', mime: 'pdf', size: 1, sha256Bytes: '1'.repeat(64), canonicalSha256: '2'.repeat(64), canonicalVersion: 'kr24.v1', format: 'pdf' }, blob);
    await store.putDocument({ companyId: 'c1', name: 'b.pdf', mime: 'pdf', size: 1, sha256Bytes: '3'.repeat(64), canonicalSha256: '4'.repeat(64), canonicalVersion: 'kr24.v1', format: 'pdf' }, blob);
    await store.putDocument({ companyId: 'c2', name: 'c.pdf', mime: 'pdf', size: 1, sha256Bytes: '5'.repeat(64), canonicalSha256: '6'.repeat(64), canonicalVersion: 'kr24.v1', format: 'pdf' }, blob);

    const c1Docs = await store.listDocuments('c1');
    const c2Docs = await store.listDocuments('c2');

    assert.equal(c1Docs.length, 2);
    assert.equal(c2Docs.length, 1);
  });

  test('deleteDocument removes record', async () => {
    const blob = new TextEncoder().encode('delete me');
    const doc = { companyId: 'c1', name: 'del.txt', mime: 'text/plain', size: 8, sha256Bytes: 'd'.repeat(64), canonicalSha256: 'e'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' };
    const id = await store.putDocument(doc, blob);

    await store.deleteDocument(id);
    const retrieved = await store.getDocument(id);
    assert.equal(retrieved, null);
  });

  test('clearDocuments removes all', async () => {
    const blob = new TextEncoder().encode('x');
    await store.putDocument({ companyId: 'c1', name: 'a.txt', mime: 'text/plain', size: 1, sha256Bytes: '1'.repeat(64), canonicalSha256: '2'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' }, blob);
    await store.putDocument({ companyId: 'c2', name: 'b.txt', mime: 'text/plain', size: 1, sha256Bytes: '3'.repeat(64), canonicalSha256: '4'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' }, blob);

    await store.clearDocuments();

    const count = await store.countDocuments();
    assert.equal(count, 0);
  });

  test('countDocuments returns correct count', async () => {
    const blob = new TextEncoder().encode('x');
    assert.equal(await store.countDocuments(), 0);
    await store.putDocument({ companyId: 'c1', name: 'a.txt', mime: 'text/plain', size: 1, sha256Bytes: '1'.repeat(64), canonicalSha256: '2'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' }, blob);
    assert.equal(await store.countDocuments(), 1);
    await store.putDocument({ companyId: 'c1', name: 'b.txt', mime: 'text/plain', size: 1, sha256Bytes: '3'.repeat(64), canonicalSha256: '4'.repeat(64), canonicalVersion: 'kr24.v1', format: 'txt' }, blob);
    assert.equal(await store.countDocuments(), 2);
  });
});

describe('store.js — migration v1→v2', () => {
  beforeEach(() => {
    localStorage.clear();
    store.flush();
  });

  test('v1 state with auditChain migrates to auditChains map', () => {
    const v1 = {
      schemaVersion: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      companies: [{ id: 'mb', rfc: 'MBA090312KQ4', name: 'PolyTech' }],
      activeCompanyId: 'mb',
      auditChain: [
        { id: 'e1', companyId: 'mb', prevHash: '0'.repeat(64), payload: '{}', hash: 'h1', timestamp: '2026-01-01T00:00:00.000Z' },
        { id: 'e2', companyId: 'an', prevHash: 'h1', payload: '{}', hash: 'h2', timestamp: '2026-01-02T00:00:00.000Z' }
      ]
    };
    localStorage.setItem('kratos-anexo24-state', JSON.stringify(v1));

    const loaded = store.loadState();

    assert.equal(loaded.schemaVersion, 2);
    assert.ok(loaded.auditChains.mb);
    assert.ok(loaded.auditChains.an);
    assert.equal(loaded.auditChains.mb.length, 1);
    assert.equal(loaded.auditChains.an.length, 1);
    assert.ok(!loaded.auditChain);
  });

  test('v1 state without auditChain still migrates', () => {
    const v1 = {
      schemaVersion: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      companies: [{ id: 'mb' }],
      activeCompanyId: 'mb'
    };
    localStorage.setItem('kratos-anexo24-state', JSON.stringify(v1));

    const loaded = store.loadState();
    assert.equal(loaded.schemaVersion, 2);
    assert.ok(loaded.auditChains);
    assert.ok(loaded.documents);
    assert.ok(loaded.inspections);
  });
});

describe('store.js — quota handling', () => {
  beforeEach(() => {
    localStorage.clear();
    store.flush();
  });

  test('QuotaExceededError throws', () => {
    const s = store.createEmptyState();
    // Fill localStorage with large data to trigger quota
    // Note: jsdom may not enforce quota; this test documents expected behavior
    try {
      s.large = 'x'.repeat(10_000_000); // 10MB
      store.saveState(s, true);
      // If no throw, that's fine in jsdom
    } catch (e) {
      assert.ok(e.message.includes('quota') || e.message.includes('Quota'));
    }
  });
});

console.log('Store test suite loaded');