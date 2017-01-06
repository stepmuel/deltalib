var http = require("http");
var fs = require('fs');
var delta = require('./lib/delta');
var uuidV1 = require('uuid/v1');
var argv = require('minimist')(process.argv.slice(2));

var port = argv.p || 8888;
var load_path = argv.l || null;
var save_path = argv.s || null;

var store = {};
var rev_id = 0;
var store_uid = uuidV1();

// NOTE: revision cache needs to be flushed (memory leak)
var revision = {};
var waiting = [];

if (load_path !== null) {
  var data = JSON.parse(fs.readFileSync(load_path, 'utf8'));
  patch(data);
} else if (save_path !== null && fs.existsSync(save_path)) {
  var save = JSON.parse(fs.readFileSync(save_path, 'utf8'));
  store = save.data;
  rev_id = parseInt(save.revision);
  store_uid = save.uid;
  revision[rev_id.toString()] = store;
} else {
  patch({});
}

function handleRPC(rpc) {
  // http://www.jsonrpc.org/specification
  var ans = {jsonrpc: "2.0", id: rpc.id};
  if (rpc.method == 'echo') {
    ans.result = rpc.params;
  } else if (rpc.method == 'revision') {
    ans.result = rev_id.toString();
  } else {
    ans.error = {code: -32601, message: 'method not found: ' + rpc.method};
  }
  return ans;
}

function queue(base, response) {
  waiting.push([base, response]);
  response.setTimeout(0);
  response.on('close', function() {
    waiting = waiting.filter(function(n) {
      return n[1] != response;
    });
  });
}

function dispatch() {
  waiting = waiting.filter(function(n) {
    return !sendResponse(n[1], null, n[0], true);
  });
}

function patch(patch) {
  rev_id += 1;
  store = delta.utils.patch({}, store, patch);
  revision[rev_id.toString()] = store;
  if (save_path !== null) {
    var save = {
      data: store,
      revision: rev_id.toString(),
      uid: store_uid
    };
    fs.writeFileSync(save_path, JSON.stringify(save));
  }
}

var headers = {
  'Content-Type': 'application/json',
  'connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
};

function sendResponse(response, ans, base, wait) {
  var out = {'revision': rev_id.toString()};
  out.store = store_uid;
  if (base && revision[base]) {
    out.patch = delta.utils.diff(revision[base], store);
    if (wait && delta.utils.empty(out.patch)) return false;
  } else {
    out.data = store;
  }
  if (ans) {
    out.ans = ans;
  }
  // out.waiting = waiting.length;
  response.writeHead(200, headers);
  response.write(JSON.stringify(out));
  response.end("\n");
  console.log('out: ', out);
  return true;
}

var server = http.createServer(function(request, response) {
  // console.log(request.method);
  if (request.method == 'POST') {
    var payload = '';
    request.on('data', function(chunk) {
      payload += chunk.toString();
    });
    request.on('end', function() {
      var data = JSON.parse(payload);
      console.log('in: ', data);
      if (store_uid !== data.store) {
        data.base = null;
        data.patch = null;
        data.wait = false;
      }
      if (data.patch) {
        patch(data.patch);
      }
      var ans = null;
      if (data.rpc) {
        data.wait = false;
        if (Array.isArray(data.rpc)) {
          ans = data.rpc.map(handleRPC);
        } else {
          ans = handleRPC(data.rpc);
        }
      }
      if (data.wait) {
        queue(data.base, response);
      } else {
        sendResponse(response, ans, data.base);
      }
      dispatch();
    });
  } else if (request.method == 'GET') {
    sendResponse(response);
  } else {
    response.writeHead(200, headers);
    response.end();
  }
});

// server.setTimeout(4000, function (socket) {
//   console.log('timeout');
//   // socket.destroy();
// });

server.listen(parseInt(port), function() {
  console.log("DeltaSync server at  http://localhost:" + port + "/sync\nCTRL + C to shutdown");
});
