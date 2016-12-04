'use strict';

var utils = require("./utils");

function Observer(options) {
  options = options || {};
  
  this.subscribers = [];
}

Observer.prototype.on = function(path, func, thisArg) {
  this.subscribers.push([path, func, thisArg]);
};

Observer.prototype.off = function(path, func) {
  var subscribers = [];
  this.subscribers.forEach(function(e) {
    if (e[0] == path && e[1] == func) return;
    subscribers.push(e);
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
      if (!utils.isDiffable(o)) return true;
    }
  }
  return true;
}

Observer.prototype.update = function(newObj, oldObj) {
  var len = this.subscribers.length;
  if (len == 0) return;
  var diff = utils.diff(oldObj, newObj);
  for (var i = 0; i < len; i++) {
    var sub = this.subscribers[i];
    if (pathUpdated(sub[0], diff)) {
      sub[1].call(sub[2], newObj, sub[0], diff);
    }
  }
};

module.exports = Observer;
