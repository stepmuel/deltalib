var http = require('http');
var argv = require('minimist')(process.argv.slice(2));
var delta = require('./lib/delta');

var host = argv.h || 'localhost';
var port = argv.p || '8888';
var path = argv.k ? argv.k.split('.') : [];
var follow = argv.f !== undefined;
var ignoreFirst = argv.q || false;

var data = {};
if (argv.j !== undefined) data.patch = delta.utils.pathSet({}, path, JSON.parse(argv.j));
if (argv.b !== undefined) data.base = argv.b;
if (argv.w !== undefined) data.wait = true;

poll(data);

function poll() {
  var post_data = JSON.stringify(data);
  
  var post_options = {
    host: host,
    port: port,
    path: '/api',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': post_data.length
    }
  };

  var post_req = http.request(post_options, function(res) {
    res.setEncoding('utf8');
    var payload = '';
    res.on('data', function(chunk) {
      payload += chunk.toString();
    });
    res.on('end', function() {
      var response = JSON.parse(payload);
      if (ignoreFirst) {
        ignoreFirst = false;
      } else {
        console.log(response);
      }
      if (follow) {
        delete data.patch;
        data.wait = true;
        data.base = response.revision;
        setTimeout(poll);
      }
    });
  });

  post_req.write(post_data);
  post_req.end();
}
