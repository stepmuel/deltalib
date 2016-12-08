var EventEmitter2 = require('eventemitter2').EventEmitter2;
var $ = require("jquery");
var utils = require("./utils");
var Observer = require("./observer");

function backoff(nTries) {
  var max = 40000;
  var factor = 1 - Math.exp(-0.1 * (nTries + 1));
  var random = 1 + Math.random() * 0.2;
  return factor * random * max;
};

function Sync(options) {
  options = options || {};
  
  this.url = options.url || null;
  
  this.running = false;
  
  this.backoff = options.backoff || backoff;
  this.retryTimeoutID = null;
  
  this.request = null;
  this.requestTime = 0;
  this.requestInterruptable = false;
  this.requestErrors = 0;
  this.requestTimeoutID = null;
  
  this.revision = null;
  this.data = {};
  this.dataPatched = {};
  this.patch = {};
  this.patchSent = {};
  
  this.rpcid = 1;
  this.rpcs = [];
  this.rpcsSent = [];
  this.rpcPatches = [];
  
  this.observer = null;
}

Sync.prototype.__proto__ = EventEmitter2.prototype;

Sync.prototype.start = function() {
  if (this.running) return;
  this.running = true;
  this.autoSync();
};

Sync.prototype.stop = function() {
  if (!this.running) return;
  this.running = false;
  this.abortOngoing(false);
};

Sync.prototype.autoSync = function() {
  if (!this.running) return;
  if (this.request && !this.requestInterruptable) return;
  if (this.requestTimeoutID !== null) return;
  var that = this;
  this.requestTimeoutID = window.setTimeout(function() {
    that.requestTimeoutID = null;
    that.sync();
  });
};

Sync.prototype.retry = function() {
  if (!this.running) return;
  if (this.retryTimeoutID !== null) return;
  var nTries = Math.max(this.requestErrors - 1, 0);
  var delay = this.backoff(nTries);
  this.emit('retry', delay);
  var that = this;
  this.retryTimeoutID = window.setTimeout(function() {
    that.retryTimeoutID = null;
    that.autoSync();
  }, delay);
};

Sync.prototype.abortOngoing = function(force) {
  if (!force && !this.requestInterruptable) return false;
  if (this.request) {
    // will trigger request.error with status == 'abort'
    this.request.abort();
    this.request = null;
  }
  if (this.requestTimeoutID !== null) {
    window.clearTimeout(this.requestTimeoutID);
    this.requestTimeoutID = null;
  }
  if (this.retryTimeoutID !== null) {
    window.clearTimeout(this.retryTimeoutID);
    this.retryTimeoutID = null;
  }
  return true;
};

Sync.prototype.sync = function() {
  var that = this;
  // cancel ongoing and scheduled requests
  this.abortOngoing(true);
  // collect data to send
  utils.merge(this.patchSent, this.patch, false);
  this.patch = {};
  this.rpcs.forEach(function(rpc) {
    that.rpcsSent.push(rpc);
  });
  this.rpcs = [];
  // create request
  var hasRevision = this.revision !== null;
  var hasPatch = !utils.empty(this.patchSent);
  var hasRPCs = this.rpcsSent.length !== 0;
  var shouldWait = hasRevision && !hasPatch && !hasRPCs;
  var data = {};
  if (hasRevision) data.base = this.revision;
  if (hasPatch) data.patch = this.patchSent;
  if (hasRPCs) data.rpc = this.rpcsSent;
  if (shouldWait) data.wait = true;
  this.emit('poll', data);
  this.requestTime = new Date().getTime();
  this.requestInterruptable = shouldWait;
  this.request = $.ajax({
    type: "POST",
    url: this.url,
    dataType: 'json',
    data: JSON.stringify(data),
    contentType: "application/json; charset=utf-8",
    cache: false,
    success: function(data) {
      that.requestErrors = 0;
      that.request = null;
      that.emit('server_response', data);
      that.handleServerResponse(data);
      that.autoSync();
    },
    error: function(xhr, status, err) {
      that.request = null;
      if (status == 'abort') return; // this is normal
      that.requestErrors += 1;
      that.emit('request_error', status, err, xhr);
      that.retry();
    }
  });
};

Sync.prototype.handleServerResponse = function(d) {
  if (d.hasOwnProperty('error')) {
    this.emit('server_error', d);
  }
  if (d.hasOwnProperty('revision')) {
    // if we get a revision, the server got the patch
    this.dataChangesSent = {};
    var data = d.hasOwnProperty('data') ? d.data : this.data;
    if (d.hasOwnProperty('patch')) utils.patch(data, d.patch);
    // data is now in sync with the server
    this.data = data;
    this.revision = d.revision;
  }
  // handle rpc replies
  var ans = [];
  var ansIDs = [];
  if (d.hasOwnProperty('ans')) {
    if (!Array.isArray(d['ans'])) ans = d['ans'];
    else ans = [d['ans']];
    ansIDs = ans.map(function(a) {return a.id});
  }
  this.rpcPatches = this.rpcPatches.filter(function(p) {
    return ansIDs.indexOf(p[0]) !== -1;
  });
  // rebuild this.dataPatched
  this.dataDidChange();
  // handle rpc callbacks
  this.rpcsSent = this.rpcsSent.filter(function(rpc) {
    // [id, method, params, callback, thisArg]
    var i = ansIDs.indexOf(rpc[0]);
    if (1 === -1) return true;
    // callback.call(thisArg, result, error)
    rpc[3].call(rpc[4], rpc.result, rpc.error);
    return false;
  });
};

Sync.prototype.dataDidChange = function() {
  // add local patches to current data from server
  var data = utils.patch({}, this.data, this.patchSent, this.patch);
  for (var i = 0; i < this.rpcPatches.length; i++) {
    utils.patch(data, this.rpcPatches[i][1]);
  }
  var oldData = this.dataPatched;
  this.dataPatched = data;
  this.emit('data', data, oldData);
  if (this.observer) {
    this.observer.update(data, oldData);
  }
};

Sync.prototype.subscribe = function(path, func, thisArg) {
  if (!this.observer) {
    this.observer = new Observer();
  }
  this.observer.on(path, func, thisArg);
};

Sync.prototype.unsubscribe = function(path, func) {
  this.observer.off(path, func);
};

Sync.prototype.rpc = function(method, params, callback, thisArg, patch) {
  var id = this.rpcid++;
  this.rpcs.push([id, method, params, callback, thisArg]);
  if (patch) {
    this.rpcPatches.push([id, patch]);
    this.dataDidChange();
  }
};

Sync.prototype.get = function(path, def) {
  path = path || [];
  return utils.pathGet(this.dataPatched, path, def);
};

Sync.prototype.set = function(path, value) {
  path = path || [];
  var data = utils.pathSet({}, path, value);
  utils.merge(this.patch, data, false);
  // console.log(JSON.stringify(this.patch));
  this.dataDidChange();
  this.autoSync();
};

module.exports = Sync;
