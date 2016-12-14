var assert = require('assert');
var fs = require('fs');
var du = require('../lib/delta').utils;

var http = require('http');
var url = require('url');

// run with `env SYNCURL='http://server/api' mocha test/server.js`
// `or mocha test/server.js`

var syncurl = process.env.SYNCURL || 'http://localhost:8765/api';

function sync(req, cbk) {
  var u = url.parse(syncurl);
  var body = JSON.stringify(req);
  var options = {
    hostname: u.hostname,
    port: u.port,
    path: u.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  var http_request = http.request(options, function(res) {
    var payload = '';
    res.on('data', function(chunk) {
      payload += chunk.toString();
    });
    res.on('end', function() {
      var data = JSON.parse(payload);
      if (cbk) cbk(null, res.statusCode, data);
    });
  });
  http_request.on('error', function(e) {
    if (cbk) cbk(e);
  });
  http_request.end(body);
  return http_request;
}

// all responses need to pass those tests
function checkResponse(data, done) {
  if (typeof data.revision === 'undefined') {
    done(new Error('response should provide revision'));
    return true;
  }
  if (typeof data.revision !== 'string') {
    done(new Error('revision id has to be a string'));
    return true;
  }
  var hasData = typeof data.data !== 'object';
  var hasPatch = typeof data.patch !== 'object';
  if (!hasData && !hasPatch) {
    done(new Error('response should include either data or patch member'));
    return true;
  }
  if (hasData && hasPatch) {
    done(new Error('response should not include both data and patch member'));
    return true;
  }
  return false;
}

var test = JSON.parse(fs.readFileSync('data/test.json', 'utf8'));

var d = {
  a: {a: 'a'},
  b: {b: 'b'},
  nb: {b: null},
  ab: {a: 'a', b: 'b'},
  anb: {a: 'a', b: null}
};

describe('Basic Sync', function() {
  
  var initial = null;
  
  it('handle empty request', function(done) {
    var req = {};
    sync(req, function(error, status, data) {
      if (error) return done(error);
      if(checkResponse(data, done)) return;
      if (typeof data.data !== 'object') {
        return done(new Error('initial request should provide data'));
      }
      if (typeof data.data.test !== 'undefined') {
        return done(new Error('store should not have a member called "test"'));
      }
      initial = data;
      done();
    });
  });
  
  it('handle base argument', function(done) {
    if (!initial) return done(new Error('requires initial request'));
    var req = {base: initial.revision};
    sync(req, function(error, status, data) {
      if (error) return done(error);
      if(checkResponse(data, done)) return;
      if (typeof data.patch !== 'object') {
        return done(new Error('response should provide patch'));
      }
      if (!du.empty(data.patch)) {
        return done('response patch should be empty');
      }
      done();
    });
  });
  
  var current_rev = null;
  
  it('handle patch argument', function(done) {
    if (!initial) return done(new Error('requires initial request'));
    current_rev = null;
    var patch = {test: {a: 'a', b:{}, c:123}};
    var req = {base: initial.revision, patch: patch};
    sync(req, function(error, status, data) {
      if (error) return done(error);
      if(checkResponse(data, done)) return;
      if (typeof data.patch !== 'object') {
        return done(new Error('response should provide patch'));
      }
      if (!du.equal(data.patch, patch)) {
        return done('response patch should equal sent patch');
      }
      if (typeof data.revision === initial.revision) {
        return done(new Error('patch should change revision'));
      }
      current_rev = data.revision;
      done();
    });
  });
  
  it('handle complex patch', function(done) {
    if (!current_rev) return done(new Error('requires current revision'));
    var patch = {test: {a: null, b:'b', d:{e: [1, 2, 3]}}};
    var req = {base: current_rev, patch: patch};
    current_rev = null;
    sync(req, function(error, status, data) {
      if (error) return done(error);
      if(checkResponse(data, done)) return;
      if (!du.equal(data.patch, patch)) {
        console.log(data.data);
        return done('response patch should equal sent patch');
      }
      current_rev = data.revision;
      done();
    });
  });
  
  it('handle wait and abort', function(done) {
    if (!current_rev) return done(new Error('requires current revision'));
    this.slow(600);
    var req = {base: current_rev, wait: true};
    var http_request = sync(req, function(error, status, data) {
      if (error) return;
      done(new Error('server should not send a response'));
    });
    http_request.on('abort', done);
    setTimeout(function() {
      http_request.abort();
    }, 500);
  });
  
  it('handle wait for patch', function(done) {
    if (!current_rev) return done(new Error('requires current revision'));
    this.slow(300);
    var patch = {test: {resume: true}};
    var req = {base: current_rev, wait: true};
    var http_request = sync(req, function(error, status, data) {
      if (error) return done(error);
      if(checkResponse(data, done)) return;
      current_rev = data.revision;
      done();
    });
    setTimeout(function() {
      current_rev = null;
      var req = {patch: patch};
      sync(req);
    }, 200);
  });
  
  it('cleanup', function(done) {
    var req = {patch: {test: null}};
    sync(req, function(error, status, data) {
      done(error);
    });
  });
  
});
