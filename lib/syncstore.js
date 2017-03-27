const utils = require("./utils");

function SyncStore() {
  this.rpcid = 1;
  this.rpcs = [];
  this.rpcsReady = [];
  this.cache = null;
  this.reset();
}

SyncStore.prototype.reset = function(data) {
  this.rev = null;
  this.uid = null;
  this.data = data || {};
  this.rpcs.forEach(function(r) {
    if (r.callback === null) return;
    const error = {code: -32000, message: 'store reset'};
    r.callback.call(r.thisArg, undefined, error);
  });
  this.rpcs = [];
  this.dirty();
};

SyncStore.prototype.handleSyncResponse = function(d) {
  if (!d.hasOwnProperty('revision')) throw 'missing revision property';
  if (!d.hasOwnProperty('store')) throw 'missing store property';
  // if (this.uid !== null && this.uid !== d.store) throw 'invalid store property';
  if (d.hasOwnProperty('base') && this.rev !== d.base) throw 'invalid base property';
  
  if (d.hasOwnProperty('data')) this.data = d.data;
  if (d.hasOwnProperty('patch')) utils.patch(this.data, d.patch);
  this.rev = d.revision;
  this.uid = d.store;
  
  const ans = d.ans || [];
  const ansIDs = ans.map(function(a) {return a.id});
  this.rpcs = this.rpcs.filter(function(r) {
    const i = ansIDs.indexOf(r.id);
    if (i === -1) return true;
    const a = ans[i];
    if (r.callback) {
      r.result = a.result;
      r.error = a.error;
      this.rpcsReady.push(r);
    }
    return false;
  }.bind(this));
  this.dirty();
};

SyncStore.prototype.generateSyncRequest = function() {
  const d = {};
  if (this.rev !== null) d.base = this.rev;
  if (this.uid !== null) d.store = this.uid;
  if (this.rpcs.length > 0) {
    d.rpc = this.rpcs.map(function(r) {
      return {
        jsonrpc: "2.0",
        id: r.id,
        method: r.method,
        params: r.params,
      };
    });
  }
  return d;
};

SyncStore.prototype.syncRequired = function() {
  return this.rev === null || this.rpcs.length > 0;
};

SyncStore.prototype.dirty = function() {
  this.cache = null;
  if (this.onDirty) {
    this.onDirty();
  }
};

SyncStore.prototype.rebuildCache = function() {
  const cache = utils.clone(this.data);
  this.rpcs.forEach(function(r) {
    if (r.patch === null) return;
    utils.patch(cache, r.patch);
  });
  this.cache = cache;
};

SyncStore.prototype.handleCallbacks = function() {
  const ready = this.rpcsReady;
  this.rpcsReady = [];
  ready.forEach(function(r) {
    r.callback.call(r.thisArg, r.result, r.error);
  });
};

SyncStore.prototype.getData = function() {
  if (this.cache === null) {
    this.rebuildCache();
  }
  return this.cache;
};

SyncStore.prototype.patch = function(patch) {
  this.rpc('patch', patch, null, null, patch);
};

SyncStore.prototype.rpc = function(method, params, callback, thisArg, patch) {
  const id = this.rpcid++;
  const rpc = {
    id: id,
    method: method,
    params: params,
    callback: callback || null,
    thisArg: thisArg || null,
    patch: patch || null,
  };
  this.rpcs.push(rpc);
  if (patch) {
    this.dirty();
  }
  return id;
};

module.exports = SyncStore;
