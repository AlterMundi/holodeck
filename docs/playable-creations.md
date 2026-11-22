# Native-authored signal gardens

The candidate `signal-garden/v1` is a small cooperative activity inside the same
Room, not another engine, game server, executable plugin or browser-local score.
A verified native creator uses the existing node.place/update/remove operations,
current world edit permission, ownership, observations, revisions and exact
command outcomes. Eight node slots include tombstones, as for result nodes.

A node has **either** `result:{pin}` (unchanged Nexus result branch) **or** `play`;
a game needs no dummy publication or viewer. Common node data remains title,
shape, position and up to four exact-revision links. Example args:

```json
{
  "title":"Jardín de señales",
  "shape":"pedestal",
  "position":{"x":0,"z":4},
  "links":[],
  "play":{
    "schema":"signal-garden/v1",
    "targets":[
      {"x":-2,"z":1,"radius":0.8,"color":"mint"},
      {"x":2,"z":1,"radius":0.8,"color":"amber"}
    ],
    "minContributors":2,
    "requiredBridgeRaised":true
  }
}
```

The recipe is closed data: one to four targets, radius0.4–1.5m, with their whole
circle inside x±7/z±6. Colours reuse the existing palette/strict RGB hex. The
required contributor count is1–8; optional requiredBridgeRaised defaults false.
No caller-supplied score, player list, editor identity, code, HTML, URL or extra
field is accepted. Publication/viewer validation for result nodes is unchanged;
game-only nodes are omitted from the visit catalog.

## One authoritative situation

The current garden/bridge entities alone determine the activity. A live light of
the matching canonical colour counts when its centre is inside the target radius
(inclusive). Maximum matching assigns distinct lights to targets; one light never
fills two overlapping circles, and a greedy choice cannot hide valid coverage.

Contributors are distinct canonical actor references that last edited a current
matching live light, plus the currently raised bridge when that recipe requires
it. All matching lights may contribute, including several in one circle; this
allows more collaborators than target circles. A daimon's other bodies share one
canonical ref, while a human and their daimon are distinct actors. This describes
current authoritative edits, not current attention, presence or unrecorded effort.
Removing/recolouring/moving a light or lowering a required bridge can make the
objective incomplete again. Existing lights can be edited/reused; no new round,
automatic reset, winner history, model wakeup or invented player is installed.

Room stamps successful garden/bridge edits in a private optional `entityEditors`
map: `{entityId:{actorRef,revision}}`, at most32 slots including bridge and garden
tombstones. The receiving actor supplies identity; command args cannot supply a
stamp. Only an editor stamp whose revision matches the current entity revision
counts. Stale or missing stamps are unknown/unattributed, never guessed from
geometry, an event tail, another body or a display name. Restore validates the
bounded map and atomic persistence retains or rolls it back with the edit. A
legacy recovery writer may lose the optional map; subsequent progress honestly
loses attribution. A fallback that changes geometry but keeps an old stamp is
also safe because its revision no longer matches. Run reset clears the map.

Public entity snapshots/events and MML geometry metadata contain no editor map.
Native/human observations share the same recipe and derived progress: definition
revision, current room cursor, target entity matches, filled counts, contributor
counts, required bridge state, unattributed-match count and completion. No raw
contributor references enter progress. Recipe updates advance node revision;
playing advances the ordinary room cursor without publishing another definition.
Previous frozen observations remain unchanged.

## Experience and bounds

The authored MML node has a natural Spanish instruction/status, coloured ground
targets and matching/completion markers. A nearest-activity HUD mirrors that
same authoritative title/status; “Cómo jugar” expands its instruction so scene
geometry and nameplates cannot obscure the only explanation. It closes its
details when the nearest activity changes and yields to creation, conversation,
pointing and an expanded content viewer. It computes no independent score. Humans use the existing Plant/preview
and bridge controls; native actors use the same actual typed garden/bridge
operations, not emulated controls. Markers/progress are a one-way projection of
Room and are not themselves a rendered-frame or human-acceptance receipt. Game
node/target geometry stays outside creation-only GLB exports, like other visit
nodes. No new viewer or game-state database is introduced.

Eight recipes × four targets are bounded by the existing node map. Existing
32-entity, 256-event/outcome, 128-observation,5MiB save and32KiB native capture
limits remain. The current canonical entities/nodes are retained; capture may
explicitly omit old events or other participant summaries using existing gap and
omission counts. No timers, accumulated rounds, generated assets or cache are
added. Remove keeps the node tombstone; reset is the existing explicit new-run
operation. The current compatible predecessor preserves opaque node definitions
but cannot be claimed to play or attribute a newer recipe.

Meaningful tests exercise native creation and exact retry, two actual actor edits,
same-being deduplication, required bridge, removal/recolouring and stale stamps,
persistence failure, old-save recovery, all32 editor slots, bounded full node
capture, overlapping target matching, closed recipes, result-branch compatibility
and source MML/export exclusion. Browser rendering and real shared play are
separate receiving checks; the candidate's tests are controlled fixtures.
