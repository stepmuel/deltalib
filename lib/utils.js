'use strict';

var clone = require('clone');
module.exports.clone = clone;

var isMergeable = function (obj) {
  if (typeof obj != 'object') return false;
  if (obj === null) return false;
  if (Array.isArray(obj)) return false;
  return true;
};
module.exports.isMergeable = isMergeable;

var patch = function (data) {
  for (var i = 1; i < arguments.length; i++) {
    var delta = clone(arguments[i]);
    merge(data, delta, true);
  }
  return data;
};
module.exports.patch = patch;

var merge = function (d, p, del) {
  for (var k in p) {
    var v = p[k];
    if (del && v === null) {
      delete d[k];
    } else if (Array.isArray(v)) {
      d[k] = clone(v);
    } else if (isMergeable(v) && isMergeable(d[k])) {
      merge(d[k], v, del);
    } else {
      d[k] = v;
    }
  }
};
module.exports.merge = merge;

var pathGet = function(data, path, def) {
  var o = data;
  for (var i=0; i < path.length; i++) {
    o = o[path[i]];
    if (typeof o == 'undefined') return def;
  }
  return o;
};
module.exports.pathGet = pathGet;

var pathSet = function(data, path, value) {
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

function forBoth(a, b, callback, thisArg) {
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
module.exports.forBoth = forBoth;

function deltaDiff(a, b) {
  var out = {};
  forBoth(a, b, function(key, a, b) {
    if (typeof a == 'undefined') {
      out[key] = b;
    } else if (typeof b == 'undefined') {
      out[key] = null;
    } else {
      if (isMergeable(a) && isMergeable(b)) {
        var diff = deltaDiff(a, b);
        if (!deltaEmpty(diff)) {
          out[key] = diff;
        }
      } else {
        if (!deltaEqual(a, b)) {
          out[key] = b;
        }
      }
    }
  });
  return out;
};
module.exports.diff = deltaDiff;

function deltaEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    var len = a.length;
    if (b.length != len) return false;
    for (var i = 0; i < len; i++) {
      if (!deltaEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isMergeable(a) && isMergeable(b)) {
    return forBoth(a, b, function(key, a, b) {
      if (typeof a == 'undefined') return false;
      if (typeof b == 'undefined') return false;
      return deltaEqual(a, b);
    });
  }
  return a === b;
}
module.exports.equal = deltaEqual;

function deltaEmpty(obj) {
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    var o = obj[key];
    if (!isMergeable(o)) return false;
    if (!deltaEmpty(o)) return false;
  }
  return true;
}
module.exports.empty = deltaEmpty;
