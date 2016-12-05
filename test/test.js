var assert = require('assert');
var fs = require('fs');
var delta = require('../lib/delta');
var du = delta.utils;

var test = JSON.parse(fs.readFileSync('data/test.json', 'utf8'));

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
    var tests = [];
    var d = {
      a: {a: 'a'},
      b: {b: 'b'},
      nb: {b: null},
      ab: {a: 'a', b: 'b'},
      anb: {a: 'a', b: null}
    }
    tests.push(['insert', true, d.a, d.b, d.ab]);
    tests.push(['remove', true, d.ab, d.nb, d.a]);
    tests.push(['replace', true, d.anb, d.b, d.ab]);
    tests.push(['null', false, d.a, d.nb, d.anb]);
    tests.push(['deepmerge', true, {d: d.a}, {d: d.b}, {d: d.ab}]);
    tests.forEach(function(t) {
      it('should support ' + t[0], function() {
        var d = du.clone(t[2]);
        du.merge(d, t[3], t[1]);
        assert(du.equal(d, t[4]));
      });
    });
  });
});

