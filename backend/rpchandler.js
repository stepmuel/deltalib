const methods = {};

const reqDefaults = {
  method: null,
  params: null,
  store: null,
  match: false,
};

function call(req) {
  const p = Object.assign(reqDefaults, req);
  const func = methods[p.method];
  if (!func) {
    return {error: {code: -32601, message: 'method not found: ' + p.method}};
  }
  if (!func.static && !p.match) {
    return {error: {code: -32602, message: 'store mismatch'}};
  }
  try {
    const result = func(req);
    return {result: result};
  } catch (e) {
    if (e.name == 'rpcerror') {
      return {error: {code: e.code, message: e.message}};
    } else {
      throw e;
    }
  }
}

function RpcError(message, code) {
  this.name = 'rpcerror';
  this.message = message || 'unknown error';
  this.code = code || -32601;
}

methods.echo = function(req) {
  return req.params;
};
methods.echo.static = true;

methods.revision = function(req) {
  return req.store.getRevision();
};
methods.revision.static = true;

methods.patch = function(req) {
  req.store.add(rpc.params);
  return null;
};

methods.methods = function(req) {
  return Object.keys(methods);
};
methods.methods.static = true;

module.exports = {
  call: call,
  methods: methods,
  RpcError: RpcError,
  defaults: reqDefaults,
};
