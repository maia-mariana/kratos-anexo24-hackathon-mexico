"use strict";

var assert = _interopRequireWildcard(require("assert"));
var fakeIndexedDB = _interopRequireWildcard(require("../../index.js"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// `indexedDB` is read-only, all others are read-write
const props = Object.keys(fakeIndexedDB).filter(prop => prop.startsWith("IDB") || prop === "indexedDB");
describe("auto", () => {
  it("correctly overrides globals in fake-indexeddb/auto", async () => {
    // simulate what the native property descriptors do
    Object.defineProperty(globalThis, "indexedDB", {
      set: undefined,
      get: () => undefined,
      enumerable: false,
      configurable: true
    });
    for (const prop of props) {
      Object.defineProperty(globalThis, prop, {
        value: undefined,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }

    // @ts-expect-error relative to the build/ directory
    await import("../../../../auto/index.mjs");

    // check our own globals
    for (const prop of props) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
      assert.equal(descriptor.value, fakeIndexedDB[prop]);
      assert.equal(descriptor.enumerable, false);
      assert.equal(descriptor.configurable, true);
      assert.equal(descriptor.writable, true);
    }

    // check that we can still overwrite them with `globalThis.<prop> = ...`
    for (const prop of props) {
      const fake = {};
      globalThis[prop] = fake;
      assert.equal(globalThis[prop], fake);
    }
  });
  it("exports as cjs directly, without `default` member - issue #130", async () => {
    // @ts-expect-error relative to the build/ directory
    await import("../../../../auto/index.js");

    // ensure we directly set the export as `module.exports` rather than `module.exports.default`
    for (const prop of props) {
      assert.ok(!globalThis[prop].default);
    }
  });
});