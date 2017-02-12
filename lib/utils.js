'use strict';

var clone = require('clone');
module.exports.clone = clone;

function equal(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    var len = a.length;
    if (b.length != len) return false;
    for (var i = 0; i < len; i++) {
      if (!equal(a[i], b[i])) return false;
    }
    return true;
  }
  if (isMergeable(a) && isMergeable(b)) {
    return _forBoth(a, b, function(key, a, b) {
      return equal(a, b);
    });
  }
  return a === b;
}
module.exports.equal = equal;

function isMergeable(obj) {
  if (typeof obj != 'object') return false;
  if (obj === null) return false;
  if (Array.isArray(obj)) return false;
  return true;
};
module.exports.isMergeable = isMergeable;

function merge(data) {
  for (var i = 1; i < arguments.length; i++) {
    _merge(data, arguments[i]);
  }
  return data;
};
module.exports.merge = merge;

function patch(data) {
  for (var i = 1; i < arguments.length; i++) {
    _patch(data, arguments[i]);
  }
  return data;
};
module.exports.patch = patch;

function diff(a, b) {
  var out = {};
  _forBoth(a, b, function(key, a, b) {
    if (typeof a == 'undefined') {
      out[key] = b;
    } else if (typeof b == 'undefined') {
      out[key] = null;
    } else {
      if (isMergeable(a) && isMergeable(b)) {
        var d = diff(a, b);
        if (!empty(d)) {
          out[key] = d;
        }
      } else {
        if (!equal(a, b)) {
          out[key] = b;
        }
      }
    }
  });
  return out;
};
module.exports.diff = diff;

function empty(obj) {
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    return false;
  }
  return true;
}
module.exports.empty = empty;

function pathGet(data, path, def) {
  var o = data;
  for (var i=0; i < path.length; i++) {
    if (o === null) return def;
    o = o[path[i]];
    if (typeof o == 'undefined') return def;
  }
  return o;
};
module.exports.pathGet = pathGet;

function pathSet(data, path, value) {
  var keyIndex = path.length - 1;
  if (keyIndex == -1) return value;
  var o = data;
  for (var i=0; i < keyIndex; i++) {
    var key = path[i];
    if (typeof o[key] == 'undefined') {
      o[key] = {};
    }
    o = o[key];
  }
  o[path[keyIndex]] = value;
  return data;
};
module.exports.pathSet = pathSet;

// helpers

function _cloneWithoutNull(obj) {
  if (!isMergeable(obj)) return clone(obj);
  var out = {};
  for(var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    var v = obj[k];
    if (v === null) continue;
    out[k] = _cloneWithoutNull(v);
  }
  return out;
}

function _merge(d, p) {
  for (var k in p) {
    var v = p[k];
    if (isMergeable(v)) {
      if (isMergeable(d[k])) {
        _merge(d[k], v);
      } else {
        d[k] = clone(v);
      }
    } else if (Array.isArray(v)) {
      d[k] = clone(v);
    } else {
      d[k] = v;
    }
  }
};

function _patch(d, p) {
  for (var k in p) {
    var v = p[k];
    if (v === null) {
      delete d[k];
    } else if (isMergeable(v)) {
      if (isMergeable(d[k])) {
        _patch(d[k], v);
      } else {
        d[k] = _cloneWithoutNull(v);
      }
    } else if (Array.isArray(v)) {
      d[k] = clone(v);
    } else {
      d[k] = v;
    }
  }
};

function _forBoth(a, b, callback, thisArg) {
  var r = undefined;
  for (var k in a) {
    if (!a.hasOwnProperty(k)) continue;
    if (b.hasOwnProperty(k)) {
      r = callback.call(thisArg, k, a[k], b[k]);
    } else {
      r = callback.call(thisArg, k, a[k], undefined);
    }
    if (r === false) return false;
  }
  for (var k in b) {
    if (!b.hasOwnProperty(k)) continue;
    if (a.hasOwnProperty(k)) continue;
    r = callback.call(thisArg, k, undefined, b[k]);
    if (r === false) return false;
  }
  return true;
}
