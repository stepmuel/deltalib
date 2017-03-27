const utils = require("../lib/utils");
const EventEmitter = require('events');
const uuidV1 = require('uuid/v1');

class Store extends EventEmitter {
  constructor() {
    super();
    this.reset();
    this.nRevisions = 10;
    this.reset();
  }
  reset(data) {
    this.uid = uuidV1();
    this.rev = 0;
    this.revision = {};
    this.nextData = data || {};
    this.commit();
  }
  commit() {
    if (this.nextData === null) return false;
    this.rev += 1;
    this.data = this.nextData
    this.nextData = null;
    this.revision[this.rev.toString()] = this.data;
    // only keep N old revisions
    delete this.revision[(this.rev - this.nRevisions).toString()];
    this.deltaCache = {};
    this.emit('update');
    return true;
  }
  getData() {
    return this.data;
  }
  getUid() {
    return this.uid;
  }
  getRevision() {
    return this.rev.toString();
  }
  getDelta(rev) {
    if (!this.revision.hasOwnProperty(rev)) return null;
    if (!this.deltaCache.hasOwnProperty(rev)) {
      this.deltaCache[rev] = utils.diff(this.revision[rev], this.data);
    }
    return this.deltaCache[rev];
  }
  add(patch) {
    if (this.nextData === null) {
      this.nextData = utils.clone(this.data);
    }
    utils.patch(this.nextData, patch);
  }
}

module.exports = Store;
