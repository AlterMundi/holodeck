# Local trial operations

`npm start` binds only 127.0.0.1:18940. Stop with Ctrl-C; no daemon, timer, model
poller or automatic publication is installed. Process exit discards transient
room state. This is not a persistent shared service.

Initial bounds: one room/run, 8 development sessions, 256 semantic events,
256 retained command outcomes, 128 observations, 32 editable elements,
8 KiB request bodies, 4 actions/second/session. Retry horizon is five minutes;
expired IDs are rejected, not silently executed again. Presence uses MML's own
transport and is not stored in the semantic journal. No private dialogue stored.
Build/dependencies budget 350 MiB; build is replaceable, keep package lock and
source. No generated media or external model calls. No room logs grow on disk.

Before shared trial: independent protected Home service slot; verify shared auth,
room rights and WebSockets through its actual HTTPS gateway. Existing Home web
slot belongs to Harmonic Lab and must be preserved. No alternative account/login
scheme or weakening of audience is authorized by this local prototype.
