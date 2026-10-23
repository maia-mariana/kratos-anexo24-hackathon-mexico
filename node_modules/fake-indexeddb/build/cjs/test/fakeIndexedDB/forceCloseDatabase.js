"use strict";

var assert = _interopRequireWildcard(require("assert"));
var _fakeIndexedDB = _interopRequireDefault(require("../../fakeIndexedDB.js"));
var _forceCloseDatabase = _interopRequireDefault(require("../../forceCloseDatabase.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
let db;
describe("forceCloseDatabase", () => {
  beforeEach(async () => {
    db = await new Promise((resolve, reject) => {
      const request = _fakeIndexedDB.default.open("test" + Math.random());
      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        db.createObjectStore("store", {
          keyPath: "key"
        });
      };
    });
  });
  it("should fire a close event when forcibly closed", async () => {
    await new Promise(resolve => {
      db.addEventListener("close", () => {
        resolve();
      });
      (0, _forceCloseDatabase.default)(db);
    });
  });
  it("should not fire a close event when closed manually", async () => {
    await new Promise((resolve, reject) => {
      db.addEventListener("close", () => {
        reject(new Error("close event fired unexpectedly"));
      });
      db.close();
      setTimeout(() => resolve());
    });
  });
  it("should fire a close event only after transactions are complete", async () => {
    let fired = false;
    const firedPromise = new Promise(resolve => {
      db.addEventListener("close", () => {
        fired = true;
        resolve();
      });
    });
    await new Promise((resolve, reject) => {
      const txn = db.transaction("store", "readwrite");
      (0, _forceCloseDatabase.default)(db);
      const store = txn.objectStore("store");
      store.add({
        key: "1"
      }).onsuccess = () => {
        assert.equal(fired, false);
        store.add({
          key: "2"
        }).onsuccess = () => {
          assert.equal(fired, false);
          store.add({
            key: "3"
          }).onsuccess = () => {
            assert.equal(fired, false);
          };
        };
      };
      txn.oncomplete = () => resolve();
      txn.onerror = e => reject(e.target.error);
    });
    await firedPromise;
    assert.equal(fired, true);
  });

  // The spec seems to imply that the "forced" flag only applies to the connection being force closed:
  // https://www.w3.org/TR/IndexedDB/#closing-connection
  // In practice, all connections with the same name will be closed because it only seems to happen for cases like
  // clearing data in DevTools, which doesn't allow you to target one IDBDatabase or another. But in our case we're
  // just simulating the API, and the FDBDatabase object is explicitly passed in to forceCloseDatabase, so it feels
  // more natural to just close the one database.
  it("should not fire a close event on another database with the same name", async () => {
    const db2 = await new Promise((resolve, reject) => {
      const request = _fakeIndexedDB.default.open(db.name);
      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
    });
    assert.notEqual(db, db2);
    assert.equal(db.name, db2.name);
    const promises = [new Promise(resolve => {
      db.addEventListener("close", () => resolve());
    }), new Promise((resolve, reject) => {
      db2.addEventListener("close", () => reject(new Error("close event fired unexpectedly")));
      setTimeout(() => resolve());
    })];
    (0, _forceCloseDatabase.default)(db);
    await Promise.all(promises);
    assert.equal(db._closed, true);
    assert.equal(db2._closed, false);
  });
});