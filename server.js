var http = require("http");
var fs = require('fs');
var delta = require('./lib/delta');
var uuidV1 = require('uuid/v1');
var argv = require('minimist')(process.argv.slice(2));

var port = argv.p || 8888;
var load_path = argv.l || null;
var store_path = argv.s || null;

var model = {};
var rev_id = 0;
var model_uid = uuidV1();

// NOTE: revision cache needs to be flushed (memory leak)
var revision = {};
var waiting = [];

if (load_path !== null) {
  var data = JSON.parse(fs.readFileSync(load_path, 'utf8'));
  patch(data);
} else if (store_path !== null && fs.existsSync(store_path)) {
  var store = JSON.parse(fs.readFileSync(store_path, 'utf8'));
  model = store.data;
  rev_id = parseInt(store.revision);
  model_uid = store.uid;
  revision[rev_id] = model;
} else {
  patch({});
}

function dispatch() {
  waiting = waiting.filter(function(n) {
    return !sendResponse(n[1], n[0], true);
  });
}

function patch(patch) {
  rev_id += 1;
  model = delta.utils.patch({}, model, patch);
  revision[rev_id.toString()] = model;
  if (store_path !== null) {
    var store = {
      data: model,
      revision: rev_id.toString(),
      uid: model_uid
    };
    fs.writeFileSync(store_path, JSON.stringify(store));
  }
}

function sendResponse(response, base, wait) {
  var out = {'revision': rev_id.toString()};
  // out.uid = model_uid;
  if (base !== undefined && revision[base]) {
    out.patch = delta.utils.diff(revision[base], model);
    if (wait && delta.utils.empty(out.patch)) return false;
  } else {
    out.data = model;
  }
  // out.waiting = waiting.length;
  var headers = {
    'Content-Type': 'application/json',
    'connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
  };
  response.writeHead(200, headers);
  response.write(JSON.stringify(out));
  response.end("\n");
  return true;
}

var server = http.createServer(function(request, response) {
  if (request.method == 'POST') {
    var payload = '';
    request.on('data', function(chunk) {
      payload += chunk.toString();
    });
    request.on('end', function() {
      var data = JSON.parse(payload);
      console.log(data);
      if (data.patch !== undefined) {
        patch(data.patch);
      }
      if (data.wait) {
        waiting.push([data.base, response]);
        response.setTimeout(0);
      } else {
        sendResponse(response, data.base);
      }
      dispatch();
    });
  } else {
    sendResponse(response);
  }
});

// server.setTimeout(4000, function (socket) {
//   console.log('timeout');
//   // socket.destroy();
// });

server.listen(parseInt(port), function() {
  console.log("DeltaSync server at  http://localhost:" + port + "/\nCTRL + C to shutdown");
});
