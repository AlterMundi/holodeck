# Visiting existing content from the shared world

Holodeck supplies a spatial entrance and one retained visit frame. Nexus continues
to own the presentation, media playback, contribution anchors, discussion capture,
transcription, native reflection and edition history. This is not another player
or a second contribution store.

The authored `reading-room` entrance has a shared position in `WORKSHOP.contents`.
Its geometry and generic label reveal no selected report or participant history.
Selected source references live in the receiving private `contentVisits` array,
not public source. At most eight selected entries supply `id`, `node`, a same-origin Nexus
`entry`, its authenticated `descriptor`, a discriminated edition `pin` and
`discoverActors`. The last list narrows discovery only; it cannot grant source
access. Existing current Holodeck identity checks guard the catalog. Nexus's
descriptor and iframe independently check the actual visitor's current room and
source permission. A world visit never creates or widens those grants.

A v1 report entry includes its selected `table` and `report_revision`; a changed or
missing pinned edition is refused rather than silently visiting today's current
report. The descriptor must return that same pin before the frame is mounted.
The existing player exposes its own chapter navigation and contributions.

## Acknowledged visit boundary

Nexus installs the bridge only for an explicit UUID `holodeck_visit` query.
`dm.holodeck-visit/ready-v1` identifies the mounted visit/pin. The parent then
uses bounded, correlated `request-v1` / `response-v1` messages with exact source
window, same origin, request ID, visit ID and edition pin. The methods are
`describe`, `getContext`, `pauseAndFreeze` and `prepareClose`. They reuse the
existing report adapter; they cannot start capture or create a native turn.
This boundary is separate from the isolated 3D renderer's review-adapter protocol.

An acknowledged context retains the report anchor, adapter review state and
explicit dirty/recording/processing/playing status. It is renderer/application
evidence, not physical viewing, shared playback or understanding. When the
world conversation is submitted, its bounded client-reported view can include
that current acknowledged visit. Missing acknowledgment stays explicit; it is
never replaced by an invented chapter or time. Nexus's own anchored reaction
writer remains the route for report discussion and actual source authorization.

**Continue exploring** retains the same mounted iframe while its work proceeds;
an active recording must first be ended in the visible player. **Pause and
return** asks the viewer to freeze and refuses to hide it while protected work
remains. Neither action destroys/recreates the frame, discards a take or draft,
resubmits a contribution, or cancels a native request. There is at most one
mounted visit, four bounded in-flight reads and no world-side audio copies.
Browser/page teardown retains Nexus's existing unload warning and recovery.

The minimized frame stays measurable offscreen, with inert controls and explicit
hidden accessibility state. `display:none` would invalidate the existing report
adapter's real stage dimensions. World capture separately records whether the
visit panel is shown; an offscreen renderer acknowledgment does not claim that
the human is looking at the presentation while walking.

Participant projections and visit entrances are not part of a creation snapshot.
The existing GLB exporter explicitly excludes visit-only geometry and retains
its creation-only source scope. This does not reconstruct historical playback.

## Acceptance

Controlled tests qualify identity-filtered discovery, pinned navigation,
message correlation, frame retention and failure handling. A fixture is not a
real shared presentation trial. Deployment, actual protected descriptor access,
participant visit, contribution save/transcription, native response and revisiting
the retained edition remain distinct observations in the owning trial record.

## Artifact visits and changing content

The same entrance accepts v2 artifact pins with `kind:artifact_review`, table,
review ID, revision and `interactive_3d`/`video` adapter. Exact field names and
receiver readiness/capture semantics belong to the
[Nexus visit contract](https://github.com/compaii/daimon-nexus/blob/main/docs/holodeck-visits.md).
Artifacts never invent a report ID. The authenticated descriptor must match the
entire selected pin; model/source access remains independently checked by Nexus.
Only deliberately selected real content enters receiving configuration. Test
video/renderer fixtures are not selectable production publications.

When several entries are selected, the header offers a content selector. Labels
start with the media type; a private title appears only after its protected
descriptor succeeds. Before switching, the current viewer must acknowledge
`prepareClose` with no dirty/recording/processing/playing state. Otherwise the
same frame and selection remain. The frame is replaced only by this deliberate,
safe content change. Walking and ordinary pause/return retain that frame.

The outer schema version follows the pin. Artifact loading signals do not imply
readiness: the parent waits up to40seconds for the exact child's actual ready
transition, then verifies capabilities. Report v1 retains its existing15second
bound. Individual operations remain bounded at8seconds, allowing the existing
inner5second acknowledgment; stale sources, editions or windows are refused.

An artifact `getContext` returns playback-only source/clock state, never an
acknowledged camera or video frame. The world labels this evidence explicitly;
only deliberate freeze/close uses actual renderer acknowledgment. Static clocks
remain null. The client-reported conversation view retains at most2200bytes of
visit context within the existing4KiB view budget. Oversized or missing context
is explicitly unavailable; camera, selection, source offsets and acknowledgment
fields are never silently truncated or replaced with a fabricated timestamp.
The Nexus iframe remains the owning full-context review/native route.

## Situated utterance and asynchronous viewer context

World position, other participants, applied geometry and client capture time are
copied at submission, before waiting for the embedded viewer. Movement and the
next draft can continue during that read without replacing the utterance's view.
Server-authoritative situation capture remains separately timed at original
retention; a client sample is not authoritative position or human attention.

Each viewer read binds the original frame, visit and immutable pin before waiting
for readiness or its reply. If that boundary changes, record context unavailable
for the original pin; do not query, label or store a replacement viewer's state.
`requestedAt` and `capturedAt` delimit the separate viewer query/acknowledgment
interval; they do not claim media was sampled at the instantaneous world capture.
The existing byte limits and explicit unavailable fallback remain unchanged.

The controlled delayed-viewer browser regression reproduced a late-position
capture before correction. The corrected client retained the exact initial
position/time while actual MML movement continued, preserving original text,
next draft/focus and one submission. Two unit regressions additionally reject
replacement pins during readiness and reply waits. These are synthetic technical
checks, not a real participant/media/native acceptance claim.

## Returning to the world is always available

Human22November report reproduced two actual navigation traps: an unready viewer
held both controls behind readiness, and recording blocked walk even after ready.
The former two exits are replaced by one `Volver al mundo` control. It immediately
moves the same iframe offscreen and restores parent focus, without waiting for
ready/context/freeze/close acknowledgment. Recording, dirty state, uploads, native
work and playback are retained by Nexus; no pause/disposal/completion is claimed.
The visitor can reopen that same frame with its current state. Playback controls
remain inside the viewer. Safe `prepareClose` still governs replacing a content
frame with another edition; it never governs ordinary return navigation.

## General Field contexts — additive v3

A context pin is `{kind:"context",tableId,contextId,revision}`. It fixes an
immutable Nexus snapshot and uses its authenticated context descriptor, explicit
`context_id`/`context_version` entrance and correlated v3 parent messages.
Native creators may declare it through the same result-node operations; no graph
is copied to Room and no report identity is fabricated. Actual table/source
permission remains with Nexus. The parent keeps only an acknowledged compact
visit reference and lifecycle flags; graph and draft payloads are excluded.
See [Field integration](field-integration.md) for authority, history, native
ingress and owned-place boundaries. Implementation/receiving/human acceptance
remain separate observations in STATUS.

## Walkable gallery

From elsewhere in the room, **Exposiciones** opens a searchable accessible
index. Titles come from the exact authorized Nexus descriptors. Search also
matches the in-world stages, including **En proceso**, **Terminado** and
**Archivo**. The index is another entrance to the same pinned visit and
position. It follows the current room catalog, drops entries when their access
changes and closes when the room changes. It does not list other rooms or
enumerate the source owner's artifact history.

When close to a display, visitors can open an authorized exact review by
clicking the model or its stage plaque, or tapping it on touch. The nearby
visit action remains available through the HUD. A camera drag, occluding wall
or hidden model cannot open the review. The room catalogue is refreshed
before opening, and the selected entry must still match both the node revision
and the complete Nexus edition pin. If the pin changed during authorization,
the visitor chooses again from the current display.

Returning from the viewer keeps the same scene and place. The normal Nexus
authorization and viewer readiness exchange still apply, including removal of
revoked editions from the room, the selector and resumable visits.
