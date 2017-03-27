const argv = require('minimist')(process.argv.slice(2));
const http = require("http");
const fs = require('fs');
const BackendStore = require('./backend/store');
const HttpHandler = require('./backend/httphandler');

const port = argv.p || 8888;
const load_path = argv.l || null;
const save_path = argv.s || null;

const store = new BackendStore();

if (save_path !== null) {
  if (fs.existsSync(save_path)) {
    const data = JSON.parse(fs.readFileSync(save_path, 'utf8'));
    store.reset(data);
  }
  store.on('update', () => {
    fs.writeFileSync(save_path, JSON.stringify(store.getData()));
  });
}

if (load_path !== null) {
  const data = JSON.parse(fs.readFileSync(load_path, 'utf8'));
  store.reset(data);
}

const httpHandler = new HttpHandler(store);

httpHandler.verbose = true;

const server = http.createServer(function(request, response) {
  // console.log(request.method);
  httpHandler.handle(request, response);
});

server.listen(parseInt(port), function() {
  console.log("DeltaSync server at  http://localhost:" + port + "/sync\nCTRL + C to shutdown");
});
