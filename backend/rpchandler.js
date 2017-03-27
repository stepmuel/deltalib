exports.echo = function(rpc, store, match) {
  return {result: rpc.params};
};

exports.revision = function(rpc, store, match) {
  return {result: store.getRevision()};
};

exports.patch = function(rpc, store, match) {
  if (match) {
    store.add(rpc.params);
    return {result: null};
  } else {
    return {error: {code: -32602, message: 'store mismatch'}};
  }
};
