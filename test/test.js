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

var describez = function() {};

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
  
  describe('#equal()', function() {
    var types = du.clone(test.object.types);
    types.null = null;
    // compare types with all other types
    for (var t1 in types) {
      var fail = false;
      var a = du.clone(types[t1]);
      for (var t2 in types) {
        var b = types[t2];
        var should = t1 === t2;
        var is = du.equal(a, b);
        fail |= should != is;
      }
      it('should support ' + t1, function() {
        assert(!fail);
      });
    }
    it('should detect equal recursively', function() {
      var a = {a: 'a', b:{c: {}}};
      var b = {b:{c: {}}, a: 'a'};
      assert(du.equal(a, b));
    });
    it('should detect non-equal recursively', function() {
      var a = {a: 'a', b:{c: {}}};
      var b = {a: 'a', b:{c: {d: {}}}};
      assert(!du.equal(a, b));
    });
  });
  
  describe('#merge()', function() {
    var tests = [
      ['insert', [d.a, d.b], d.ab],
      ['replace', [d.anb, d.b], d.ab],
      ['null', [d.a, d.nb], d.anb],
      ['deep merge', [{d: d.a}, {d: d.b}], {d: d.ab}],
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
      ['deep patch', [{d: d.a}, {d: d.b}], {d: d.ab}],
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
  
  describe('#diff()', function() {
    var tests = [
      ['empty', [d.a, d.a], {}],
      ['insert', [d.a, d.ab], d.b],
      ['remove', [d.ab, d.a], d.nb],
      ['replace', [d.b, d.a], d.anb],
      ['deep empty', [{d: d.a}, {d: d.a}], {}],
      ['deep replace', [{d: d.b}, {d: d.a}], {d: d.anb}],
      ['insert empty', [{d: d.a}, {d: d.a, e:{}}], {e: {}}],
      ['unchanged complex objects', [test, du.clone(test)], {}],
    ];
    testFunc(tests, du.diff);
  });
  
});

describe('Observer', function() {
  
  var observer = null;
  
  var simple = {a: 'a', b: 'b'};
  var complex = {a: {b: {c: {l: 'l'}, l: 'l'}, l: 'l'}, l: 'l'};
  
  var obj = {};
  var that = {'isThat': true};
  var cbk = function(path, data, diff) {
    obj.this = this;
    obj.path = path;
    obj.data = data;
    obj.diff = diff;
  };
  
  describe('Observe []', function() {
    it('#on() should add a subscriber', function() {
      observer = new delta.Observer();
      observer.on([], cbk, that);
      assert(observer.subscribers.length === 1);
    });
  
    it('#on() should not trigger callback', function() {
      assert(du.empty(obj));
    });
  
    it('callback should not be called if data has not changed', function() {
      obj = {};
      observer.update(simple, du.clone(simple));
      assert(du.empty(obj));
    });
  
    it('callback should be called if data has changed', function() {
      obj = {};
      observer.update(simple, du.patch({}, simple, {b: 'c'}));
      assert(!du.empty(obj));
    });
  
    it('callback should be called with thisArg', function() {
      assert(obj.this === that);
      obj = {};
    });
    
    it('#off() with wrong path should not remove subscriber', function() {
      observer.off(['a'], cbk);
      assert(observer.subscribers.length === 1);
    });
    
    it('#off() with wrong callback should not remove subscriber', function() {
      observer.off([], cbk.bind(this));
      assert(observer.subscribers.length === 1);
    });
    
    it('#off() with correct arguments should remove subscriber', function() {
      observer.off([], cbk);
      assert(observer.subscribers.length === 0);
    });
    
    it('#off() should not trigger callback', function() {
      assert(du.empty(obj));
    });
  });
  
  describe('Observe Path', function() {
    it('callback should not be called if data has not changed', function() {
      observer = new delta.Observer();
      observer.on(['a', 'b'], cbk, that);
      obj = {};
      observer.update(complex, du.clone(complex));
      assert(du.empty(obj));
    });
  
    it('callback should not be called if path does not exist', function() {
      obj = {};
      observer.update(du.patch({}, simple, {b: 'c'}), simple);
      assert(du.empty(obj));
    });
  
    it('callback should be called if path gets added', function() {
      obj = {};
      observer.update(complex, {l: 'l'});
      assert(!du.empty(obj));
    });
    
    it('callback should be called if path gets removed', function() {
      obj = {};
      observer.update({l: 'l'}, complex);
      assert(!du.empty(obj));
    });
    
    it('callback should be called if non-object gets assigned to subpath', function() {
      obj = {};
      observer.update({a: []}, complex);
      assert(!du.empty(obj));
    });
    
    it('callback should not be called with unchanged non-object in subpath', function() {
      obj = {};
      observer.update({a: [], l: 'l'}, {a: []});
      assert(du.empty(obj));
    });
    
    it('callback should not be called if parent changes', function() {
      obj = {};
      observer.update(du.patch({}, complex, {l: 'leaf'}), complex);
      assert(du.empty(obj));
    });
    
    it('callback should not be called if sibling changes', function() {
      obj = {};
      observer.update(du.patch({}, complex, {a: {l: 'leaf'}}), complex);
      assert(du.empty(obj));
    });
    
    it('callback should be called if child changes', function() {
      obj = {};
      observer.update(du.patch({}, complex, {a: {b: {l: 'leaf'}}}), complex);
      assert(!du.empty(obj));
    });
    
    it('callback should be called if grandchild changes', function() {
      obj = {};
      observer.update(du.patch({}, complex, {a: {b: {c: {l: 'leaf'}}}}), complex);
      assert(!du.empty(obj));
    });
    
  });
  
});

