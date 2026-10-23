"use strict";

var assert = _interopRequireWildcard(require("assert"));
var _fakeIndexedDB = _interopRequireDefault(require("../../fakeIndexedDB.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const req = r => new Promise((res, rej) => {
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const openDb = async name => {
  const open = _fakeIndexedDB.default.open(name, 1);
  open.onupgradeneeded = () => open.result.createObjectStore("s");
  return await req(open);
};
describe("memory leaks", () => {
  it("does not leak memory in database.transactions (issue #170)", async () => {
    const db = await openDb("test-mem-leaks");
    for (let i = 0; i < 100; i++) {
      const tx = db.transaction("s", "readwrite");
      tx.objectStore("s").put("foo", "k" + i % 10);
      await new Promise(r => {
        tx.oncomplete = r;
      });
    }

    // double macrotask to avoid race conditions in the test
    await new Promise(resolve => setTimeout(resolve));
    await new Promise(resolve => setTimeout(resolve));
    assert.equal(db?._rawDatabase.transactions.length, 0, "Transactions should not be held onto indefinitely");
  });
  it("does not leak memory an aborted transaction (issue #170)", async () => {
    const db = await openDb("test-mem-leaks-2");
    const tx = db.transaction("s", "readwrite");
    tx.abort();

    // double macrotask to avoid race conditions in the test
    await new Promise(resolve => setTimeout(resolve));
    await new Promise(resolve => setTimeout(resolve));
    assert.equal(db?._rawDatabase.transactions.length, 0, "Transactions should not be held onto indefinitely");
  });
});