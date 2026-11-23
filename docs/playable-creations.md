# Native-authored signal gardens

The selected `signal-garden/v1` is a small cooperative activity inside the same
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
circle inside one current `place.creationAreas` region. The original x±7/z±6
plaza remains valid; the gallery and garden provide separate bounded areas. Colours reuse the existing palette/strict RGB hex. The
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

## Author an exterior garden

An editor in the shared exterior can choose **Crear jardín** to start a private
preview. Walk to each intended circle, place it there and set its color.
**Guardar jardín** publishes the same draft under the current actor. The
garden's author can reopen **Editar jardín** from **Cómo jugar** and publish a
new revision. The same view offers **Retirar jardín** with an explicit
confirmation naming the garden. Removing the definition keeps the lights that
participants planted, and its identity stays in the activity history.

If a save or retirement loses its reply, the draft stays read-only while the
existing confirmation panel checks the retained command. A late confirmation
closes the corresponding draft. Closing the editor keeps the command available
in the same browser tab. Other visitors can play and see progress. They need
the author identity and current revision to revise or retire the definition.

## Play in an owned interior

An owner of an authored house plan can publish a signal garden in any of
its rooms. The native room lane accepts `garden.preview` and `garden.put`
with `id`, `room`, `expectedRevision`, `title` and `play`. Use `null` for the
first publication. Use the observed revision to edit the recipe and start a
fresh round. `garden.result` with `id` reads the retained exact receipt.
Preview changes no public state. The shared outdoor gardens keep their own
existing rules and authority.

Inside, place one to four nonoverlapping circles with their full footprints
in the unobstructed aisle (X from −1.25 to 1.25, Z from −1.4 to 3.25 in
meters). Choose mint, amber, rose or violet. Use one or more contributors,
up to the number of circles. The interior recipe has no exterior bridge
requirement. Plans, art, exhibits and destinations are unchanged by a round.

An admitted visitor in the room can walk up to a circle, select a light and
place it. The native `garden.signal` action accepts `id`, `room`, the recipe's
`expectedRevision`, a zero-based target `index` and `color`. The same receiving
room checks scope and current edit rights for browser and native signals.
Positions are client movement cues. The persisted event records the accepted
signal and its canonical contributor, without asserting physical proximity.
Public progress omits contributor identities and can be read in the active
room, including from a native observation. The current signal set is shared;
the browser shows its lights without reconnecting or pausing movement.

An admitted situated Conversation turn can use the same `garden.signal` action
in its captured room once the daimon is in that room. The native `result`
operation uses the original command ID on the same interaction to recover its
receipt. The player's existing own-native lane still supports `garden.result`
for commands issued on that lane.

The separate checkpoint caps room games at 24 and exact receipts at 64.
Each current, prior or staging file is limited to 64 KiB. The predecessor
continues to serve the same rooms and ignores this checkpoint. Returning
to a game-capable runtime restores the recipe and last shared signals.

## Start with a room template

On an owned non-legacy room, use the existing own-native lane to discover
`garden.templates` with `room`. **Par de luces** places two circles for
one participant. **Constelación en equipo** sets four circles within the
walkable aisle and requires at least two participants.

```sh
holodeck-world --own act --json '{"type":"garden.draft","room":"YOUR_ROOM","template":"shared-constellation","id":"team-garden-01"}'
```

The response contains the exact `garden.put` command with that room's
current expected revision. Review or adapt its title, targets and participant
requirement. Publish only the final command and keep that exact command for
receipt recovery. The current round and its signals stay in play until
publication creates a new revision.

The paired human with an active room edit grant can choose **Diseño inicial**
and **Usar diseño** from the same templates. Only the editor sees that
draft and can adjust the design before **Guardar jardín**. The saved recipe
uses the same format as a garden placed by hand.

## Design an interior garden with the paired human

On the existing own-native world port, the house owner may give a current
room guest permission to design its garden. The browser verifies the live
pairing before each editor read and publication. The person must still be
admitted to that room and have the ordinary world edit right. The grant
applies to one room and does not confer house plan, furnishing or exhibit
authority. Use `garden.editor.current` with `room` to read its grant and
`garden.editor.set` with `room`, the exact `human` actor and the current
`expectedRevision` (initially `null`). Set `human` to `null` at the
current revision to revoke it.

In that room choose **Diseñar jardín**, walk to the central aisle to place a
signal preview, and save. The preview is local until publication. The
published recipe and its playable state are shared, and the receipt records
the authenticated human performer. A lost response can be checked by its
exact receipt without repeating the write. The actor may recover an existing
receipt while still admitted to the room even after the editing grant ends.

## Packaged two-player game check

Release `dd6628e86392` passed the fixture with two independent Chromium
visitors. One used WASD and a mouse and one used the touch joystick and
touch controls. The own-native lane published the garden's two-signal
recipe. The visitors completed the activity together and independently
invalidated and restored completion through a light edit and the bridge
control. Both browsers and the own-native observer matched the same
progress across eight checkpoints. The fixture used isolated state,
synthetic access grants and an emulated touch device.
