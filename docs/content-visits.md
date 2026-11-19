# Visiting existing content from the shared world

Holodeck supplies a spatial entrance and one retained visit frame. Nexus continues
to own the presentation, media playback, contribution anchors, discussion capture,
transcription, native reflection and edition history. This is not another player
or a second contribution store.

The authored `reading-room` entrance has a shared position in `WORKSHOP.contents`.
Its geometry and generic label reveal no selected report or participant history.
Selected source references live in the receiving private `contentVisits` array,
not public source. One selected entry supplies `id`, `node`, a same-origin Nexus
`entry`, its authenticated `descriptor`, `pin: {tableId,reportId,revision}` and
`discoverActors`. The last list narrows discovery only; it cannot grant source
access. Existing current Holodeck identity checks guard the catalog. Nexus's
descriptor and iframe independently check the actual visitor's current room and
source permission. A world visit never creates or widens those grants.

The entry must include its selected `table` and `report_revision`; a changed or
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
