"use strict";

var assert = _interopRequireWildcard(require("assert"));
var _binarySearchTree = _interopRequireDefault(require("../../lib/binarySearchTree.js"));
var _FDBKeyRange = _interopRequireDefault(require("../../FDBKeyRange.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const assertRecordsEqual = (actual, expected) => {
  assert.deepStrictEqual([...actual], expected);
};
describe("binarySearchTree", () => {
  it("works for basic insertion and retrieval", () => {
    const tree = new _binarySearchTree.default();
    assert.equal(tree.size(), 0);
    tree.put({
      key: "b",
      value: "b"
    });
    assert.equal(tree.size(), 1);
    tree.put({
      key: "a",
      value: "a"
    });
    assert.equal(tree.size(), 2);
    tree.put({
      key: "c",
      value: "c"
    });
    assert.equal(tree.size(), 3);
    assertRecordsEqual(tree.getAllRecords(), [{
      key: "a",
      value: "a"
    }, {
      key: "b",
      value: "b"
    }, {
      key: "c",
      value: "c"
    }]);
  });
  it("overwrites duplicate key/value pairs", () => {
    const tree = new _binarySearchTree.default();
    tree.put({
      key: "a",
      value: "a"
    });
    tree.put({
      key: "a",
      value: "a"
    });
    tree.put({
      key: "b",
      value: "x"
    });
    tree.put({
      key: "b",
      value: "y"
    });
    tree.put({
      key: "c",
      value: "c"
    });
    tree.put({
      key: "a",
      value: "a"
    });
    assert.equal(tree.size(), 4);
    assertRecordsEqual(tree.getAllRecords(), [{
      key: "a",
      value: "a"
    }, {
      key: "b",
      value: "x"
    }, {
      key: "b",
      value: "y"
    }, {
      key: "c",
      value: "c"
    }]);
  });
  it("works for deletions", () => {
    const tree = new _binarySearchTree.default();
    tree.put({
      key: "a",
      value: "a"
    });
    tree.put({
      key: "b",
      value: "b"
    });
    tree.put({
      key: "c",
      value: "c"
    });
    tree.delete({
      key: "b",
      value: "b"
    });
    assert.equal(tree.size(), 2);
    assertRecordsEqual(tree.getAllRecords(), [{
      key: "a",
      value: "a"
    }, {
      key: "c",
      value: "c"
    }]);
  });
  it("works for deletions on nonexistent records", () => {
    const tree = new _binarySearchTree.default();
    tree.put({
      key: "a",
      value: "a"
    });
    tree.put({
      key: "b",
      value: "b"
    });
    tree.put({
      key: "c",
      value: "c"
    });
    tree.delete({
      key: "x",
      value: "x"
    });
    assert.equal(tree.size(), 3);
    assertRecordsEqual(tree.getAllRecords(), [{
      key: "a",
      value: "a"
    }, {
      key: "b",
      value: "b"
    }, {
      key: "c",
      value: "c"
    }]);
  });
  it("can delete a lot", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const tree = new _binarySearchTree.default();
    for (const letter of [...letters]) {
      tree.put({
        key: letter,
        value: letter
      });
    }
    const expected = [...letters].map(letter => ({
      key: letter,
      value: letter
    }));
    assert.equal(tree.size(), expected.length);
    assertRecordsEqual(tree.getAllRecords(), expected);
    for (let i = 0; i < letters.length; i++) {
      const letter = letters.charAt(i);
      tree.delete({
        key: letter,
        value: letter
      });
      assert.equal(tree.size(), expected.length - i - 1);
      assertRecordsEqual(tree.getAllRecords(), expected.slice(i + 1));
    }
  });
  it("works for get and getByKey", () => {
    const tree = new _binarySearchTree.default();
    tree.put({
      key: "a",
      value: "a"
    });
    tree.put({
      key: "b",
      value: "b"
    });
    tree.put({
      key: "c",
      value: "c"
    });
    tree.delete({
      key: "a",
      value: "a"
    });
    assert.deepStrictEqual(tree.get({
      key: "b",
      value: "b"
    }), {
      key: "b",
      value: "b"
    });
    assertRecordsEqual(tree.getRecords(_FDBKeyRange.default.only("b")), [{
      key: "b",
      value: "b"
    }]);
    assert.equal(tree.get({
      key: "x",
      value: "x"
    }), undefined);
    assertRecordsEqual(tree.getRecords(_FDBKeyRange.default.only("x")), []);
  });
  it("throws an error on overwrite if noOverwrite=true", () => {
    const tree = new _binarySearchTree.default();
    tree.put({
      key: "a",
      value: "a"
    }, true);
    tree.put({
      key: "b",
      value: "b"
    }, true);
    assert.throws(() => tree.put({
      key: "a",
      value: "a"
    }, true));
  });
  it("works for keysAreUnique=true", () => {
    const tree = new _binarySearchTree.default(true);
    tree.put({
      key: "a",
      value: 0
    });
    tree.put({
      key: "a",
      value: 1
    });
    tree.put({
      key: "a",
      value: 2
    });
    assertRecordsEqual(tree.getAllRecords(), [{
      key: "a",
      value: 2
    }]);
    assert.throws(() => tree.put({
      key: "a",
      value: 3
    }, true));
  });
  it("returns existing records for overwrites", () => {
    const tree = new _binarySearchTree.default();
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: "a"
    }), undefined);
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: "a"
    }), {
      key: "a",
      value: "a"
    });
    assert.deepStrictEqual(tree.put({
      key: "b",
      value: "b"
    }), undefined);
    tree.delete({
      key: "a",
      value: "a"
    });
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: "a"
    }), undefined);
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: "a"
    }), {
      key: "a",
      value: "a"
    });
  });
  it("returns existing records for overwrites, keysAreUnique=true", () => {
    const tree = new _binarySearchTree.default(true);
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: 0
    }), undefined);
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: 1
    }), {
      key: "a",
      value: 0
    });
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: 2
    }), {
      key: "a",
      value: 1
    });
    assert.deepStrictEqual(tree.put({
      key: "b",
      value: 0
    }), undefined);
    tree.delete({
      key: "a",
      value: undefined
    });
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: 3
    }), undefined);
    assert.deepStrictEqual(tree.put({
      key: "a",
      value: 4
    }), {
      key: "a",
      value: 3
    });
  });
  describe("can do range searches", () => {
    [false, true].forEach(descending => {
      const assertRecordsEqualGivenOrdering = (actual, expected) => {
        assertRecordsEqual(actual, descending ? expected.reverse() : expected);
      };
      it(`descending=${descending}`, () => {
        const tree = new _binarySearchTree.default();
        tree.put({
          key: "c",
          value: "c"
        });
        tree.put({
          key: "e",
          value: "e"
        });
        tree.put({
          key: "a",
          value: "a"
        });
        tree.put({
          key: "b",
          value: "b"
        });
        tree.put({
          key: "d",
          value: "d"
        });

        // get all
        assert.equal(tree.size(), 5);
        assertRecordsEqualGivenOrdering(tree.getAllRecords(descending), [{
          key: "a",
          value: "a"
        }, {
          key: "b",
          value: "b"
        }, {
          key: "c",
          value: "c"
        }, {
          key: "d",
          value: "d"
        }, {
          key: "e",
          value: "e"
        }]);

        // in bounds
        assertRecordsEqualGivenOrdering(tree.getRecords(new _FDBKeyRange.default("b", "d", false, false), descending), [{
          key: "b",
          value: "b"
        }, {
          key: "c",
          value: "c"
        }, {
          key: "d",
          value: "d"
        }]);

        // out of bounds
        assertRecordsEqualGivenOrdering(tree.getRecords(new _FDBKeyRange.default("0", "z", false, false), descending), [{
          key: "a",
          value: "a"
        }, {
          key: "b",
          value: "b"
        }, {
          key: "c",
          value: "c"
        }, {
          key: "d",
          value: "d"
        }, {
          key: "e",
          value: "e"
        }]);

        // lower/upper open
        assertRecordsEqualGivenOrdering(tree.getRecords(new _FDBKeyRange.default("b", "d", true, true), descending), [{
          key: "c",
          value: "c"
        }]);

        // lower open only
        assertRecordsEqualGivenOrdering(tree.getRecords(new _FDBKeyRange.default("b", "d", true, false), descending), [{
          key: "c",
          value: "c"
        }, {
          key: "d",
          value: "d"
        }]);

        // upper open only
        assertRecordsEqualGivenOrdering(tree.getRecords(new _FDBKeyRange.default("b", "d", false, true), descending), [{
          key: "b",
          value: "b"
        }, {
          key: "c",
          value: "c"
        }]);
      });
    });
  });
});