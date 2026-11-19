# Awaiting the actual world document

`WorldDocument` wraps the installed `EditableNetworkedDOM` and its supported
`LocalObservableDOMFactory`. Use `await projection.load(markup)` before reporting
projection readiness or accepting an immediately following update. Socket
add/has/remove methods and `dispose()` retain the existing consumer seam.

The upstream `load()` returns while its initial document is still being built.
A second immediate load can dispose that unfinished instance and then attempt
`getSnapshot()` without a root. Its current `isLoaded()` does not distinguish the
loading state. This wrapper neither reads those private fields nor forks the
engine. It forwards each real factory message to the upstream consumer first,
then acknowledges `message.snapshot` after that consumer returns and the outer
load stack unwinds. Mutation/log messages continue through the same consumer.

Loads serialize with at most eight admitted pending states and 128 KiB per
markup string. The default eight-second deadline includes queue wait, with a
maximum configurable ten seconds; tests can select a shorter finite deadline.
Queue/size refusal does not admit that new work. A snapshot deadline, factory or
consumer failure fences further loading, rejects pending acknowledgments and
disposes the owned DOM/runners/connections. Cleanup runs after the current stack
so synchronous factory callbacks cannot leave a partly constructed document
alive. Disposal also rejects pending work. No state reset, original replay or
automatic retry is performed; the owning Room's saved semantics remain separate.

The acknowledgment proves upstream snapshot acceptance, not a remote client's
pixels, eyesight or human acceptance. The room semantic cursor and client
geometry acknowledgment retain their separate meanings.

Focused qualification uses the real installed DOM factory and a loopback v0.2
WebSocket. An immediate initial load and two queued updates delivered one initial
snapshot and ordered attribute diffs with cursors 0, 1, 2 and the final violet
geometry. Controlled fixtures verify deadline cleanup, queue refusal, consumer
failure, late callbacks, disposal and a synchronous factory callback without
arbitrary sleeps or probing upstream private state.
