# Shared world activity

**Actividad** opens a deliberate history surface without changing the world,
unmounting Conversation or disposing an open content viewer. The existing Room
journal is its sole source. A page contains at most20 events and32KiB; browser
memory retains one page, its selected detail and at most257 scalar page cursors.
There is no additional history database, browser persistence, timer or model call.
New changes use the existing accepted world-state cursor to offer an explicit
refresh, rather than fetching activity in the background.

## Reading a change

The dialog shows the actual recorded post-state under **En ese cambio**, and the
current comparison at the stated consultation time. Light colour/location, bridge
state, public creation/game definition, explicit references, public projection
and authenticated presence retain distinct meanings. A historical record is not
an entire reconstructed world or evidence of gaze, human attention or physical
presence. Unknown legacy details, names and dates remain unavailable; current
state is never substituted for missing historical data. Exact actor references
remain in the machine projection, while the ordinary UI uses verified self or
unknown-name labels instead of displaying internal identifiers.

The same journal retains at most256 events, including presence and references;
these are not256 creation edits. Earlier eviction, gaps and changed runs are
explicit. Pagination freezes its upper cursor; an explicit refresh gets newer
activity and a fresh current comparison. Older pages keep the same run/ceiling.
Room reset starts another run, not a silently merged history or permanent archive.
Content editions and discussion history remain with Homes/Nexus independently.

**Señalar cómo está ahora** uses the current target revision through the ordinary
fresh-observation/focus command. It cannot target a past revision or teleport the
human. Actor, run and edition are frozen before an asynchronous observation; a
changed response or changed current scope is refused before command creation.
Entity races still use the canonical target-revision guard. Existing exact command
IDs/outcomes and uncertain-write recovery are unchanged.

## Discussing the same event

**Conversar sobre este cambio** opens the existing continuing Conversation and
selects a topic for the next intervention. **Quitar tema** clears that future
selection; it never rewrites a recording or original already frozen by Conversation.
Text/audio/files and sending remain canonical Conversation features.

`captureInteractionContext` copies `view.historyReference` before awaiting a
viewer. Its closed `holodeck.history-reference/v1` contains run, edition, sequence,
panelVisible and explicit flags. It is an application selection, not human speech
or proof of attention. At input retention the server resolves that exact reference
against its canonical journal and emits `selectedActivity` separately from the
optional client view. It never accepts client-supplied event prose as canonical.

`holodeck.selected-activity/v1` is at most2KiB. It retains the exact reference,
source/availability and bounded public recorded state; optional recipe/links/detail
omissions are explicit. Missing, evicted, different-run or malformed references
do not borrow a later event or block the original. The32KiB situation reserves
this context alongside input association, preserving canonical world entities,
nodes and exact speaker/paired indications. Private result pins/hashes, native
request IDs, provider details and conversation originals are excluded.

## First-class native access

The existing own-being or genuine situated native world port also offers
`activity`, using the same public projection and fresh current room authority:

```sh
holodeck-world --own activity --json '{"limit":20}'
```

The response identifies its verified `observer`. Numeric `through`/`before` and
`run` revisit a retained range; `before` is exclusive. Use the returned run and
through for older pages, or the selected event sequence as through and sequence+1
as before to request that exact event. A stale run or evicted window is explicit.
This read creates no Room observation, event, outcome, original or model turn.
The situated form keeps its real retained interaction binding; own mode never
borrows a human input. Future bridge descriptors advertise the same activity
operation and the actually installed receiving CLI, with body-specific sockets.

The implementation lives in `activity.mjs`, the authenticated HTTP and native
adapters, `world-history.mjs` and the existing context producer. Source publication,
App selection, seven CLI/bridge selections and actual model/human use are separate
states; the current deployment evidence is in STATUS and the owning operations
record. No claim of physical-device or human shared acceptance follows from a
controlled browser or transport check.

## Planned temporal work projections

The bounded Room journal above records observed world changes and explicitly
reports eviction and run breaks. The planned day player also needs attributed
task and pinned artifact revisions plus a reconstructible spatial projection.
The [architecture](architecture.md#the-same-work-through-time) and
[research](research/2026-11-24-work-projection-replay.md) describe the extension.
The current activity dialog does not provide day replay.
