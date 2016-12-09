# deltalib

A data store that syncs with a server.

Download using npm:

    npm install stepmuel/deltalib
    cd node_modules/deltasync
    node server

Since `npm` does not update modules from git repos automatically, `npm install stepmuel/deltalib` has to be called again to fetch new versions.

Clone with git:

    git clone https://github.com/stepmuel/deltalib.git
    cd deltalib
    npm install
    node server

## Terminology

The DeltaSync protocol relies heavily on JSON, hence the terms *object*, *array* and *value* will be used according to their definition in the [JSON specification](http://json.org/): 

* **object**: unordered map from *string* to *value*
* **array**: ordered collection of values
* **value**: *string*, *number*, *object*, *array*, `true`, `false` or `null`
* **string**: sequence of zero or more Unicode characters (DeltaSync uses UTF-8)
* **number**: `integer` or `float`. Special values like `INF` or `NAN` are not allowed.

The functions `diff` and `patch` work similarly to the UNIX programs with the same name, but instead of files, they work on *objects*. 

`d = diff(a, b)` generates the *delta* between the two objects `a` and `b`. (A *delta* might also be called a *diff* or *patch*.) 

`c = patch(a, d)` *applies* the delta to `a` (or *patches* `a`), resulting in object `c`.

`c` will be *equal* to `b`. Two values are equal, if they represent the same data. 

The **store** is a single object which contains data that is synced between server and client. A store can not contain the value `null` since `null` represents a deleted value in `diff` and `patch`. 

A **revision** is a particular state of a store with a unique **revision id**. If two revisions have the same id, their stores are *equal*. 

A **key path** is an arrays of member names, describing the position of a value within an object hierarchy. `[]` points to the object itself, `['a', 'b']` points to the member `b` of member `a` of the object. 

## delta.utils

`delta.utils` includes several helper functions used to implement the delta diff protocol.

    const du = require('deltalib').utils;

Imports the utils object into the current scope. 

    b = du.clone(a)

Creates a copy `b` of value `a`. Any patches or other changes to objects or arrays inside `b` will no longer affect `a`. 

    du.isMergeable(a)

Returns whether value `a` is an object. Many functions like `merge`, `patch` and `diff` only work on objects. 

    du.empty(a)

Returns whether object `a` contains values other than objects. An empty patch will leave any object unchanged. 

    du.merge(data[, obj... ])

Deeply merges `obj` into `data`. All members from `obj` will be inserted into `data`, replacing existing non-object values. If both values are objects, they will be merged recursively. Values of `obj` will be cloned if necessary, so changes to `data` will never affect `obj`.

If the function is called with more than two parameters, the additional objects will also be merged into `data`. Later objects will overwrite members set by earlier objects. 

Returns `data`. To clone `data` before applying a patch, use `dataClone = du.patch({}, data, obj)`. 

    du.patch(data[, obj... ])

Same as `du.merge`, but if a member of `obj` has a value of `null`, the corresponding member in `data` will be deleted.

    d = du.diff(a, b)

Creates the (minimal) delta from `a` and `b`. (Minimal since it does not include empty objects.)

    v = du.pathGet(data, path, def)

Returns the value at the key path `path` from object `data`. If the key path does not exist, it will return `def`, or `undefined` if the argument is omitted.

    du.pathSet(data, path, value)

Will set the value at key path `path` to `value`. If the key path does not exist, new object members will be inserted. Returns `data`.

`pathSet` can be used to quickly create new patches: `patch = du.pathSet({}, ['a', 'b'], "c")`. 

## delta.Observer

`delta.Observer` provides basic [key-value observing](https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/KeyValueObserving/KeyValueObserving.html). It can notify a subscriber when a value at a certain key path changes.

    var obs = new delta.Observer()

Creates a new observer.

    obs.update(newObj, oldObj)

Has to be called if the object to be observed might have changed. `newObj` is the object after and `oldObj` before the suspected change. This call will notify all observers when needed.

    obs.on(path, func, thisArg)

Adds an observer to `path`. Will call `func.call(thisArg, newObj, path, diff)` if the value at `path` changes. `newObj` will be the object after the observed change, and `diff = du.diff(oldObj, newObj)`. To get the observed value, use `value = du.pathGet(path, newObj)`.

    obs.off(path, func)

Removes all observers with the given `path` and `callback`.

## delta.Sync

TODO: finish this section

### Members / Optioins

    sync.url = options.url || null;
    sync.backoff = options.backoff || backoff;

### Events

    emit('retry', delay)
    emit('poll', data)
    emit('server_response', data)
    emit('request_error', status, err, xhr)
    emit('server_error', d)
    emit('data', data, oldData)
    

### Methods

    sync.start()
    sync.stop()
    sync.sync()
    sync.get(path, def)
    sync.set(path, value)
    sync.rpc(method, params, callback, thisArg, patch)
    sync.subscribe(path, func, thisArg)
    sync.unsubscribe(path, func)
    

## server

Simple DeltaSync server. Start with `node server`.

Arguments:

* `-p <port>` Port to listen to (default `8888`).
* `-l <path>` JSON file to use as initial store.
* `-s <path>` Save revisions to (and resume from) this file.

Unless `-s` is provided, the server will start with a new, empty store. `-l` replaces the current store at launch (even if `-s` is provided). The server listens on the given port for HTTP POST requests, and expects an object with the following (optional) members:

* **patch**: Patch to be applied to the current store.
* **base**: Instead of sending the whole store, send a patch from the base revision.
* **wait**: Unless *patch* is set, will not send empty patches, but delay the request until a non-empty patch becomes available. (data responses will still be sent immediately.)
* **rpc**: Remote procedure calls as specified by the [JSON-RPC 2.0 specification](http://www.jsonrpc.org/specification).

The response will contain the following members:

* **revision**: Revision id of current revision.
* **patch** or **data**: Patch from base to current revision, or the whole store (as data) if no patch is available.  
* **ans**: JSON-RPC response. (only available if `rpc` was set in request.)

### RPC Requests

`server` only supports a single RPC method called `echo`, which will just return its `params`. Other requests will be answered with the appropriate error object.

### Known Limitations

* Keeps a clone of all past revisions in memory

## client

DeltaSync client for development. Use with `node client`.

Arguments:

* `-h <host>` server host (default `localhost`)
* `-p <port>` server port (default `8888`)
* `-j <value>` patch value in JSON
* `-k <keypath>` key path for the patch, separated by '.'.
* `-b <rev_id>` base revision
* `-w` set `wait = true` for first request
* `-f` will keep requesting new patches (follow)
* `-q` will not show first response (quiet)

Examples:

    node client

Request current revision.

    node client -q -f

Show all non-empty patches, ignoring the current revision sent initially. This simulates actual client behavior. 

    node client -k a.b -j '"c"'

Will set the value at key path `['a', 'b']` to `"c"` and show the current revision including the new change.

    node client -j '{"d": "e"}'

Will send a raw patch.

    node client -q -k foo -j 1

Will send a patch without displaying the current revision.
