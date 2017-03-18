'use strict';

var utils = require("./utils");

function Observer() {
  this.subscribers = [];
}

Observer.prototype.on = function(path, func, thisArg) {
  // func(path, newObj, diff)
  var obj = thisArg ? thisArg : null;
  var subs = {
    path: path,
    func: func,
    thisArg: obj,
  };
  this.subscribers.push(subs);
};

Observer.prototype.off = function(path, func, thisArg) {
  var obj = thisArg ? thisArg : null;
  var subscribers = [];
  this.subscribers.forEach(function(sub) {
    if (utils.equal(sub.path, path) && sub.func == func && sub.thisArg == obj) return;
    subscribers.push(sub);
  });
  this.subscribers = subscribers;
};

function pathHasPatch(path, obj) {
  // based on utils.pathGet(obj, path)
  // might add support for null as wildcard
  if (path.length === 0) {
    // empty patch for root is special
    return !utils.empty(obj);
  }
  var o = obj;
  for (var i=0; i < path.length; i++) {
    if (!utils.isMergeable(o)) return true;
    var key = path[i];
    o = o[path[i]];
    if (typeof o == 'undefined') return false;
  }
  // if o is empty, an empty object has been inserted
  return true;
}

Observer.prototype.update = function(newObj, oldObj) {
  var len = this.subscribers.length;
  if (len == 0) return;
  var diff = utils.diff(oldObj, newObj);
  this.subscribers.forEach(function(sub) {
    if (pathHasPatch(sub.path, diff)) {
      sub.func.call(sub.thisArg, sub.path, newObj, diff);
    }
  });
};

module.exports = Observer;
