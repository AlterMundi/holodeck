# Workshop sound

**Sonido** is off on every new visit. An explicit user gesture enables a soft,
abstract island wind/water bed and short tones for newly observed bridge/light
changes. There is no speech, companion voice, model-activity sound or captured
sensor audio. Sound has its own choice; reduced-motion preference does not silently
change that choice.

The control becomes **Silenciar** while actual owned WebAudio state is running.
Hidden pages mute/suspend it and stop pending cues. Returning shows **Reanudar**;
only another explicit gesture attempts resume under the browser's actual policy.
A synthetic DOM click cannot enable it. `pagehide` disposes the owned graph and
closes its context. It never controls another application's audio or device use.

## Authored content and bounds

The small built-in WebAudio graph uses one deterministic 2-second mono noise
buffer at 22.05 kHz (176400 bytes), soft wind/water-like filter bands and slow
amplitude drift. It reuses that buffer; no files, downloads, paid generation,
media permissions or microphone are involved. There are eight persistent owned
nodes, at most four cue oscillators plus their gains, and one owned AudioContext.
Off/hidden state mutes immediately and requests context suspension; the actual
context reports whether it suspended. Disable retains this bounded graph for
reuse, while disposal stops/disconnects every owned source/node and requests
context closure, retaining its actual observed result.

Actual observed bridge changes receive a short rising/falling two-note cue;
newly observed light placement/removal/edit receives one short tone. These are
functional nonverbal feedback, not a simulated companion response. The sound is
not a recording of the physical place.

## State and continuity

The audio layer reads the same accepted `api/state` snapshots as the client. It
keeps only one bounded run/edition/semantic-cursor/entity-revision baseline. The
first snapshot, a changed run/edition, reconnect, hidden/returned state, reenable,
or a delivery gap over five seconds establishes a silent baseline. Older cursors
are ignored without moving that baseline backwards; equal-cursor healthy polls
retain continuity without repeating a cue. Reads begun before a continuity break
cannot seed its new baseline. Rapid changes coalesce within
350 ms; multiple changes in one observation produce at most one useful cue.

A cue denotes a newly observed current state change, not its exact historical
occurrence time, a complete replay of all intervening events, displayed pixels
or proof that a human heard it. An entity merely missing from a snapshot does not
invent a removal event; a newly encountered old tombstone is silent. The layer
never submits a world command or native/model turn. Native activity HUD remains
based on its actual existing source.

## Verification

Focused tests cover default-off allocation, bounded graph/buffer, real-state
revision/cursor deduplication (including out-of-order delivery and long idle
polling), reconnect/history baselines, visibility pause with
explicit resume, bounded cue coalescing, failed browser resume and cleanup.

A finite isolated Chromium trial exercised actual WebAudio and trusted CDP input:
no owned context before opt-in; a synthetic click left it off; a trusted gesture
created a running context and eight-node bed. An actual bridge command caused
one cue, repeated snapshots did not repeat it, and ended cue nodes were removed.
Real tab visibility changes suspended the context; returning remained muted and
hidden state changes were not replayed after explicit resume. The `pagehide`
cleanup handler closed the actual context with zero owned nodes. The Sonido/
Silenciar control fit the 390px touch viewport; its screenshot was inspected.

A response-stage browser interception held an old state read while a real bridge
command and newer read completed. Releasing the late response did not regress
the client controls or replay its cue. The client applies only the latest issued
state read and rejects a backwards cursor in the same actor/run/edition. Delayed
command/native responses also check their frozen intent ID before changing the
current conversation or recovery controls.

An actor-authenticated fixture placed and then moved/recolored the same light.
Actual MML/Three checks retained its three primitive IDs and acknowledged its
new revision/manifest, with one edit cue and no repeated snapshot cue. This was
controlled test transport, without a native provider submission.

No JavaScript errors or native inputs occurred in that trial. It establishes
browser audio state/gesture/lifecycle behavior, not physical output-device,
headphone, human listening/comfort or children's play acceptance.
