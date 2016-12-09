'use strict';

var utils = require("./utils");

function Observer() {
  this.subscribers = [];
}

Observer.prototype.on = function(path, func, thisArg) {
  // func(newObj, path, diff)
  var subs = {
    path: path,
    func: func,
    thisArg: thisArg ? thisArg : null
  };
  this.subscribers.push(subs);
};

Observer.prototype.off = function(path, func) {
  var subscribers = [];
  this.subscribers.forEach(function(sub) {
    if (sub.path == path && sub.func == func) return;
    subscribers.push(sub);
  });
  this.subscribers = subscribers;
};

function pathUpdated(path, obj) {
  var o = obj;
  for (var i=0; i < path.length; i++) {
    var key = path[i];
    if (key === null) {
      var subPath = path.slice(i+1);
      for (var prop in o) {
        if (!o.hasOwnProperty(prop)) continue;
        var r = pathUpdated(subPath, o[prop]);
        if (r) return true;
      }
    } else {
      o = o[key];
      if (typeof o == 'undefined') return false;
      if (!utils.isMergeable(o)) return true;
    }
  }
  return true;
}

Observer.prototype.update = function(newObj, oldObj) {
  var len = this.subscribers.length;
  if (len == 0) return;
  var diff = utils.diff(oldObj, newObj);
  this.subscribers.forEach(function(sub) {
    if (pathUpdated(sub.path, diff)) {
      sub.func.call(sub.thisArg, sub.path, newObj, diff);
    }
  });
};

module.exports = Observer;
