const utils = require('../lib/utils');
const rpchandler = require('./rpchandler');

/**
 * simple DeltaSync server based on server.js from https://github.com/stepmuel/deltalib
 */

const defaultHeaders = {
  'Content-Type': 'application/json',
  'connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
};

class Handler {
  constructor(store) {
    this.store = store;
    this.headers = Object.assign({}, defaultHeaders);
    this.rpcHandler = rpchandler;
    this.waiting = [];
    this.store.on('update', () => this.dispatch());
    this.verbose = false;
    this.urlMatch = null;
  }
  handle(req, res) {
    if (this.urlMatch && !req.url.match(this.urlMatch)) return false;
    if (req.method == 'POST') {
      let payload = '';
      req.on('data', (chunk) => {
        payload += chunk.toString();
      });
      req.on('end', () => {
        let data = JSON.parse(payload);
        if (this.verbose) console.log('in: ', JSON.stringify(data));
        this.handlePost(data, res);
      });
    } else if (req.method == 'GET') {
      this.sendResponse(res);
    } else {
      // probably OPTIONS request
      res.writeHead(200, this.headers);
      res.end();
    }
    return true;
  }
  handlePost(data, res) {
    const storeMatch = this.store.getUid() === data.store;
    if (!storeMatch) {
      data.base = null;
      data.patch = null;
      data.wait = false;
    }
    const base = data.base ? {uid: data.store, rev: data.base} : null;
    if (data.patch) {
      this.store.add(data.patch);
    }
    var ans = null;
    if (data.rpc) {
      data.wait = false;
      ans = data.rpc.map(function(rpc) {
        return this.handleRpc(rpc, storeMatch);
      }, this);
    }
    if (data.wait) {
      this.queue(base, res);
      this.store.commit();
    } else {
      this.store.commit();
      this.sendResponse(res, ans, base);
    }
  }
  handleRpc(rpc, storeMatch) {
    const ans = {jsonrpc: "2.0", id: rpc.id};
    if (this.rpcHandler.hasOwnProperty(rpc.method)) {
      const func = this.rpcHandler[rpc.method];
      Object.assign(ans, func.call(this, rpc, this.store, storeMatch));
    } else {
      ans.error = {code: -32601, message: 'method not found: ' + rpc.method}
    }
    return ans;
  }
  queue(base, response) {
    this.waiting.push({base: base, response: response});
    response.setTimeout(0);
    response.on('close', () => {
      this.waiting = this.waiting.filter((n) => {
        return n.response != response;
      });
    });
  }
  dispatch() {
    this.waiting = this.waiting.filter((n) => {
      return !this.sendResponse(n.response, null, n.base, true);
    });
  }
  sendResponse(response, ans, base, wait) {
    const storeUid = this.store.getUid();
    if (base && base.uid !== storeUid) base = null;
    const delta = base ? this.store.getDelta(base.rev) : null;
    if (wait && delta && utils.empty(delta)) return false;
    const out = {
      revision: this.store.getRevision(),
      store: storeUid,
    };
    if (delta) {
      out.patch = delta;
    } else {
      out.data = this.store.getData();
    }
    if (ans) {
      out.ans = ans;
    }
    response.writeHead(200, this.headers);
    response.write(JSON.stringify(out));
    response.end("\n");
    if (this.verbose) console.log('out: ', JSON.stringify(out));
    return true;
  }
}

module.exports = Handler;
