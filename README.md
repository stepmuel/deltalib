# deltalib

A data store that syncs with a server.

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

The **model** (or *data model*) is a single object which contains data which is synced between server and client. A model can not contain the value `null` since `null` represent a deleted value in `diff` and `patch`. 

A **revision** is a particular state of a model with a unique **revision id**. If two revisions have the same id, their models are equal. 

A **key path** are arrays of member names, describing the position of a value within an object hierarchy. `[]` points to the object itself, `['a', 'b']` points to the member `b` of member `a` of the object. 

## delta.utils

`delta.utils` includes several helper functions used to implement the delta diff protocol.

    const du = require('deltalib').utils;

Import the utils object into the current scope. 

    b = du.clone(a)

Creates a copy `b` of value `a`. Any patches or other changes to objects or arrays inside `b` will no longer affect `a`. 

    du.isMergeable(a)

Returns whether value `a` is an object. Many functions like `merge`, `patch` and `diff` only work on objects. 

    du.empty(a)

Returns whether object `a` contains values other than objects. An empty patch will leave any object unchanged. 

    du.merge(a, b, del)

Deeply merges object `b` into object `a`. All members from object `b` will be inserted into object `a`, replacing existing non-object values. If both values are objects, they will be merged recursively. 

If `del === true`, all `null` values in `b` will delete the corresponding member in `a`. 

    du.patch(data[, patch... ])

Applies one or more patches to `data` using `du.merge(data, patch, true)`. Later patches will overwrite values from previous patches with the same key. Patches are cloned before being merged. Returns `data`. 

To clone `data` before applying a patch, use `c = du.patch({}, a, d)`. 

    d = du.diff(a, b)

Creates the (minimal) delta from `a` and `b`. (Minimal since it does not include empty objects.)

    v = du.pathGet(data, path)

Returns the value at the key path `path` from object `data`. If the key path doesn't exist, it will return `undefined`. 

    du.pathSet(data, path, value)

Will set the value at key path `path` to `value`. If the key path doesn't exist, new object members will be inserted. Returns `data`.

`pathSet` can be used to quickly create new patches: `patch = du.pathSet({}, ['a', 'b'], "c")`. 

## server

Simple DeltaSync server. Start with `node server`.

Arguments:

* `-p <port>` Port to listen to (default `8888`).
* `-l <path>` JSON file to use as initial model.
* `-s <path>` Save revisions to (and resume from) this file.

Unless `-s` is provided, the server will start with a new, empty store. `-l` replaces the current model at launch (even if `-s` is provided). The server listens on the given port for HTTP POST requests, and expects an object with the following (optional) members:

* **patch**: Patch to be applied to the current model.
* **base**: Instead of sending the whole model, send a patch from the base revision.
* **wait**: Unless *patch* is set, will not send empty patches, but delay the request until a non-empty patch becomes available. (data responses will still be sent immediately.)

The response will contain the following members:

* **revision**: Revision id of current revision.
* **patch** or **data**: Patch from base to current revision, or the whole model (as data) if no patch is available.  

### Known Limitations

* Keeps a clone of all past revisions in memory
* Does not handle RPC requests

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

## delta.Observer

TODO

## delta.Sync

Still in development. 
