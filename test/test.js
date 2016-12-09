var assert = require('assert');
var fs = require('fs');
var delta = require('../lib/delta');
var du = delta.utils;

var test = JSON.parse(fs.readFileSync('data/test.json', 'utf8'));

var d = {
  a: {a: 'a'},
  b: {b: 'b'},
  nb: {b: null},
  ab: {a: 'a', b: 'b'},
  anb: {a: 'a', b: null}
};

function testFunc(tests, func, thisArg) {
  tests.forEach(function(t) {
    it('should support ' + t[0], function() {
      var args = t[1].map(du.clone);
      var out = func.apply(thisArg, args);
      assert(du.equal(out, t[2]));
    });
  });
};

describe('Utils', function() {
  
  describe('#clone()', function() {
    var clone = du.clone(test);
    // clone.foo = "bar"; // makes test fail
    it('clone should be equal to original', function() {
      assert(du.equal(clone, test));
    });
    var paths = [];
    paths.push(['true']);
    paths.push(['string', 'empty']);
    paths.push(['object', 'deepempty']);
    // clone = test; // makes tests fail
    paths.forEach(function(p) {
      it('clone.' + p.join('.') + ' = "newValue" does not affect original', function() {
        var oldValue = du.pathGet(test, p);
        du.pathSet(clone, p, "newValue");
        var value = du.pathGet(test, p);
        assert(du.equal(value, oldValue));
      });
    });
  });
  
  describe('#isMergeable()', function() {
    var types = du.clone(test.object.types);
    types.null = null;
    for (var t in types) {
      var v = types[t];
      var mergeable = t === 'object';
      var str = mergeable ? ' should ' : ' should not ';
      it(t + str + 'be mergeable', function() {
        assert.equal(mergeable, du.isMergeable(v));
      });
    }
  });
  
  describe('#merge()', function() {
    var tests = [
      ['insert', [d.a, d.b], d.ab],
      ['replace', [d.anb, d.b], d.ab],
      ['null', [d.a, d.nb], d.anb],
      ['deepmerge', [{d: d.a}, {d: d.b}], {d: d.ab}],
      ['multiple arguments', [{}, d.nb, d.a, d.b], d.ab],
    ];
    testFunc(tests, du.merge);
    it('3rd argument should not affect 2nd argument', function() {
      var a = du.clone(d.a);
      var b = du.clone(d.b);
      du.merge({}, a, b);
      assert(du.equal(a, d.a));
    });
  });
  
  describe('#patch()', function() {
    var tests = [
      ['insert', [d.a, d.b], d.ab],
      ['remove', [d.ab, d.nb], d.a],
      ['replace', [d.anb, d.b], d.ab],
      ['deepmerge', [{d: d.a}, {d: d.b}], {d: d.ab}],
      ['multiple arguments', [{}, d.nb, d.a, d.b], d.ab],
    ];
    testFunc(tests, du.patch);
    it('3rd argument should not affect 2nd argument', function() {
      var a = du.clone(d.a);
      var b = du.clone(d.b);
      du.patch({}, a, b);
      assert(du.equal(a, d.a));
    });
  });
  
});

