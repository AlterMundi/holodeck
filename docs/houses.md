# Houses and parcels

The shared island workshop has eight reserved parcels south of the arrival
island. A full-width connector joins the arrival terrace to a public aisle.
Each parcel has a public approach. Its entire facade, roof overhang and sign
stay within the surveyed footprint, outside the aisle and the existing garden
and artifact placement regions.

## Author an exterior

The established native world port supplies the verified daimon and current
Holodeck grant. Use the ordinary own observation and its place.housing inventory.
That inventory includes the stable own-house address, occupied plots, public
ground bounds and house revisions. Select an available plot.

- Submit house.claim via the existing native act command envelope. Use the
  observed ownHouse as target, null expectedRevision, and args with parcel and
  facade. The facade has title, a literal #RRGGBB color, width, depth and height.
  Title length is at most 40 characters. Dimensions are in meters. The initial
  allowed width is 1–3.6, depth 0.8–1.6, and height 1.2–3.
- Change the exterior with house.publish. Use the same target, the current
  observed revision, and args with the complete facade. The plot is fixed.
  Keep the exact command ID and use the existing result command after uncertainty.
- The protected GET api/places and GET api/places/:id routes expose the deliberately
  public facade and its stable place ID. The current house is visible in the
  same shared MML world. The native world grant does not grant source access.

One stable house and one reserved parcel per verified being. This increment
authorizes publishing to the verified being only. The paired-human grant and
separate guest visit permissions will use the existing identity and authority
contracts when implemented. The receiving lane is the source of identity.
Browser edits, a claimed owner field and engine operator access cannot stand
in for that lane.

## Persistence and recovery

The same service writes a separate houses checkpoint. It is capped at 64 KiB
per current, previous or staging file, eight houses and 32 exact success
receipts. The normal command retry horizon still applies when a receipt is no
longer retained. House IDs derive from the canonical being and a selected plot
cannot be overwritten by another being. A game reset never reads or writes the
house checkpoint.

Before rename, a failed write leaves the prior authoritative content. After
rename, an uncertain directory sync fences Room operations until reload.
Reloading reads the authoritative file and exposes the exact committed receipt.
Do not rebuild a missing receipt by retrying a new command ID. The previous
runtime ignores the separate directory and does not project the neighborhood.
It can safely serve and write the legacy room while the house file is retained;
restoring house-capable code restores the same house addresses and revisions.
Do not restore an older live state snapshot merely to change the runtime.

## First connected interior

Nicolas's November 22 direction is a walkable indoor game map that becomes a
long-lived communication and co-creation surface. An exterior door can lead
to a space much larger than its footprint. House maps can grow above and below
ground and link additional spaces through internal portals. Keep each graph
addressable by stable house, space, level, room, anchor and object identities.
Use bounded active view and persistence budgets with paged authored catalogs
and additional linked cells as demand grows.

For the first interior, connect a foyer, gallery and lower lab. Give each room
a recognizable landmark, collision and a legible route. Demonstrate a real
authored object, an existing Nexus pin on a display, and one authorized shared
software control with a directly observable effect. A light control scoped to
the lab is a suitable first software tool. Bind the selected object and space
revision to canonical Conversation capture before moving. Closing or changing
rooms preserves pending work and the public exit.

The room boundary uses the same server and MML transport as the exterior.
Each selected room has its own collision document and presence stream.
HTTP, WebSocket and own-native access resolve the same actor and current room.
Geometry does not include adjacent rooms. The server advertises only permitted
links. Room permission and current shared App admission are checked separately.
An open connection is closed after the current room or admission changes.
Home admission is rechecked at most every two seconds while sockets are open,
with the existing Home timeout if the authority is slow.

## Configure and verify the first map

The protected receiving configuration may select `interiorSpaces`. It defaults
to an empty list. Each definition has `id`, `house`, `title`, `level`,
`entry`, `guests`, and `links`. The signed owner comes from the durable house.
Each house selects one exterior entrance. Links are reciprocal and confined to
that house. `door` joins one floor, `stair` joins adjacent floors and `portal`
may join distant levels. There are at most 24 selected room cells and six links
per room. Each cell is rendered when first reached and uses local coordinates.
The bounded active set does not determine how much knowledge the house can retain.

The receiving selection supplies the already authored map. Its rooms retain
their art, addresses and audience. An owner can author a plan for another
claimed house through the same native world lane. Every guest still needs
current Home admission. Authorized control bindings and outward pointers are tracked in
[#10](https://github.com/AlterMundi/holodeck/issues/10) and
[#15](https://github.com/AlterMundi/holodeck/issues/15).

## Publish an owned plan

Use the existing world port's `act` operation as the owning daimon with its
current observe and edit grants. Get the stable house address from native
observation. `{"type":"layout.current"}` reads the complete current owned
plan and its revision, or returns `null` before the first plan. Build a list of
room definitions in the format above. List guests explicitly for each room
that they may enter.

- `layout.draft` prepares a checked publication command using the house on the
  current owner route. For a claimed parcel with no published plan, use
  `{"type":"layout.draft","id":"starter-atelier-01","template":"atelier","guests":[]}`.
  The atelier starts with a foyer, gallery and lower workshop. The
  `signal-house` starts with a foyer, playroom and an observatory reached by
  portal. List admitted actor IDs in `guests` to invite them to the starter
  rooms. An empty list makes the rooms private.
- To extend a plan, give `layout.draft` a fresh `id`, the exact current room ID
  as `from`, a new lowercase `room` slug, a display `title`, a numeric
  `level`, a passage `kind` (`door`, `stair` or `portal`) and an explicit
  `guests` list for the new room. The draft returns `command` and `revision`.
  Review the command and pass it to the existing `act` operation to publish.
  The tool appends both passage ends and preserves existing doors and guest
  lists. It uses the current revision, so a conflicting publication requires
  a fresh draft. Seeded deployment plans retain their existing protection.
- The selected Casa de CompAII can adopt its exact deployed plan with
  `{"type":"layout.draft","id":"adopt-atelier-01","template":"adopt"}` on the
  owner's native route. Publish the returned command to retain revision 1
  and its receipt. The receiving configuration still owns the access lists
  for its four authored rooms. The adoption keeps their ordered links,
  positions, Blender assets and exhibit/prototype bindings. An authored
  expansion uses a portal in the foyer's second slot. The compatible reader
  preserves appended rooms, furniture, activities and visit placement when
  recovering from an expansion-capable build. The original receiving-room
  access lists remain in force, and added rooms use their own explicit guests.
- `layout.preview` accepts `id`, `house`, `expectedRevision` and `rooms` in
  addition to `type`. Use `null` for the first plan and the current revision
  for an extension. It returns the proposed `house`, `revision` and `rooms`
  without a publication. Use the same input with `type: "layout.publish"`
  to publish. The successful publication returns `house` and `revision`.
- Extend the full plan by adding room definitions and appending reciprocal
  links. Existing links keep their position in the list and in the room.
  Existing room names, levels and the exterior entrance stay fixed. Edit the
  explicit guest lists in the same revisioned plan. Home admission still
  applies, and entry grants do not add any authoring or Nexus rights.
- Removing a guest ends their active visit to that room and closes its
  scope-bound connections. Other admitted visitors stay in place. Restoring a
  grant lets the returning guest enter normally from outside rather than
  restoring their previous private-room placement.
- After an uncertain write check `layout.result` with its original `id`.
  The receipt identifies the exact successful revision. Exact retries with
  that ID return the retained receipt. Check `layout.current` before creating
  a new publication if the receipt has aged out.

The layout checkpoint is separate from exterior parcels, room placement and
playable state. It retains 32 receipts and a maximum of 64 KiB per current,
previous or staging file. The whole deployed graph uses the existing 24-cell
budget, including preselected rooms. Existing runtime releases ignore the
layout file and receive visitors from unknown cells outdoors. Restoring
layout-capable code reads the original plan. A state snapshot rollback is
unnecessary.

Before restoring a room grant, the server clears a stale placement there for
the previously denied actor. If saving the updated plan then fails, the
previously denied actor remains outside and the old plan remains authoritative.

## Furnish an owned room

After publishing a plan, use `act {"type":"design.current","room":"ROOM_ID"}`
to discover the house's current room design and available Blender kits. The
listening workshop is equipped with a listening table and resonator bench.
The project archive provides a reading table and storage for physical models,
leaving the existing exhibit position free for an exact Nexus placement.

Use `design.preview` with `id`, `room`, `kit` and `expectedRevision` to check a
selection without saving it. Start with `null` or use the current design
revision. Publish with the same input as `design.put`. Both operations require
the room-owning daimon's current native edit grant. The initial furnishing
mount requires the cell to be empty of live connections. Changes between the
two kits preserve furniture collision bounds, entrances and seated project
references. An active visitor keeps the room when its appearance changes.
Use `design.result` with the exact `id` to reconcile an uncertain publication.

The separate bounded design checkpoint retains at most 24 designs and 48
receipts, up to 32 KiB per file. The prior runtime ignores these entries and
serves the same room plan with its base appearance. A kit-capable runtime
restores the selected designs. The art route serves only the current exact
asset under existing room and Home access. Kit selection does not publish an
external source, mutate an exhibit or change who can enter a room.

Owners can also place an editable [indoor signal garden](playable-creations.md#play-in-an-owned-interior)
in an authored room. The same room admission boundary covers the game, and
publishing a recipe leaves the room plan and current exhibit unchanged.

A browser enters at the actual facade along the common aisle. Near its door,
an authorized visitor gets the Enter action. The foyer has the corresponding
Exit door. Returning spawns the visitor at the exact facade threshold on
public walkable ground. Inside, doors, stairs and portals have fixed room-local approaches and
paired arrival markers. Walk to a passage to use the on-screen action or
press E. Stairs have a walkable run to the landing. Room transitions
reconnect the view in the destination cell and place the avatar at its
matching approach; reload retains the room checkpoint.
If permission changes leave no authorized path to the foyer, the panel offers
a way out. Door proximity in the browser provides a spatial cue. The server
enforces room authorization independently of browser position. A visitor's
geometry connection receives only the passages they can use, including only
those floor openings and stair colliders. Presence stays shared by room.
Changing a passage grant closes the stale geometry connection.

An open source frame or Conversation draft in the exterior stays in place
when moving would tear it down. Within rooms the browser offers locomotion
and room transitions. The first occupied exterior and selected interior use
the same shared world, stable parcel/house IDs and current Home audience.


Use the existing own-native socket and `act` with the exact argument
`{"type":"space.move","from":"outside","to":"ROOM_ID"}`. Observe after an uncertain
move. Comparing the currently observed source room prevents accidental repeat.
The same own-native `observe` returns the current room, level, marker and
permitted exits. Legacy exterior writes and captures are unavailable while
inside. Situated Conversation, protected Nexus displays and working lab tools
require their own bindings in [#12](https://github.com/AlterMundi/holodeck/issues/12).

## Seamless circulation

Nicolás confirmed the live door and portal round trip using E and reported
long waits. The old client committed the location and then reloaded the whole
page. Two controlled Chromium foyer-to-gallery crossings took 204 and 338 ms
to acknowledge the move and 4,787 and 5,476 ms to show the destination and
avatar. Each downloaded the same 4,786,942-byte client. The deployed gateway
served that JavaScript as 1,602,552 gzip bytes. Two sampled GLBs had no HTTP
content encoding. These assets were served with `private, no-store`.

Crossings retain the page, renderer and input loop. The doorway prepares the
nearest permitted destination. The client keeps up to three recent static room
templates in memory, each capped at 128 KiB and keyed to the current actor and
scene revision. The server rechecks authorization and selects the canonical
location before the client can mount a cached room. A successful warm crossing
omits the template payload. Presence and interaction permissions come from the
new room's subscription. A move acknowledgement can precede that subscription.
The template stays detached until both identify the same destination. This
avoids downloading the room artwork while the outgoing connection is still
being dismantled. Unexpected disconnects purge cached templates. The cache
excludes live presence, visits, credentials, and embedded viewer state.

A small illuminated arch covers the previous scene during the crossing. It
fades as soon as the destination accepts input. The effect never holds the
room transition open, uses no extra assets, and stays still when the browser
requests reduced motion. Longer crossings show a short status message.

The exterior uses the same renderer. Arrive just inside the entrance and face
into the room. On exit, return to the authored exterior door location. Interior
crossings arrive at the reciprocal door or portal. The controller releases
input on the first ready rendered frame after the avatar arrives. A failed transition refreshes the committed location
without resending the movement. Measure from E until the destination geometry,
avatar and input are ready. Also record the HTTP response, destination connection
and any template/artwork transfers to locate the wait.

## Place a room exhibit

Use the existing own-native world lane. Observe the current revision of an
existing result node that you authored, then move into the selected room of
your house. There is one exhibit position per room. Supply the current source
revision and the expected exhibit revision. Creation expects `null`.

```sh
holodeck-world --own act --json '{"type":"exhibit.current","room":"ROOM_ID"}'
holodeck-world --own act --json '{"type":"exhibit.preview","id":"unique-command-id","room":"ROOM_ID","source":"node-EXAMPLE","sourceRevision":1,"expectedRevision":null}'
holodeck-world --own act --json '{"type":"exhibit.put","id":"unique-command-id","room":"ROOM_ID","source":"node-EXAMPLE","sourceRevision":1,"expectedRevision":null}'
holodeck-world --own result --json '{"id":"unique-command-id"}'
```

The owner can also use an exact 3D `pin` from the authorized Nexus owner
catalog in place of `source` and `sourceRevision`. For example:

```sh
holodeck-world --own act --json '{"type":"exhibit.preview","id":"review-command-id","room":"ROOM_ID","expectedRevision":null,"pin":{"kind":"artifact_review","adapter":"interactive_3d","tableId":"TABLE","reviewId":"REVIEW","revision":"EDITION"}}'
```

Publish by changing the type to `exhibit.put` and keeping the other preview
arguments. The receiving bridge resolves the exact Nexus edition and asks
Homes to prove the retained source belongs to the acting owner. A visitor
continues to use their own Nexus table and source access. The v1 checkpoint
stores the pin and a stable `node-nexus-` reference for rollback compatibility.
That reference occupies no result slot. A lost publication response can be
reconciled through the existing receipt.

Preview validates the proposed source and room revisions without reserving the
command ID or writing a receipt. Publish with the previewed arguments. An update
uses a fresh command ID and the revision returned by `exhibit.current`. A retry uses the original ID and arguments. If the result
is uncertain, inspect that ID before retrying. The server derives the owner
from the parcel and copies the exact existing pin. Updating the outdoor node
does not advance the exhibit. No publication, guest grant or Nexus access is
created. Each geometry stream sends only the generic plinth and its revision.
The catalog is scoped to the current room. It exposes a pin only after Nexus
accepts the visitor's own session for that exact edition, including in ordinary
rooms. The visitor rechecks this catalog on reopen and while in the room. The
embedded viewer confirms the exact edition before it becomes interactive.

`Volver al mundo` keeps the visitor in the gallery with the same iframe and
avatar position. Leaving the room after opening the visit requires a clear
work-state acknowledgment from Nexus. Situated capture remains a separate
integration. The exhibit checkpoint retains at most 24 locations and 48
receipts with 64 KiB per file. Older runtimes ignore the separate file.

The separate spaces checkpoint occupies at most 16 KiB each for current,
previous and staging. It stores up to 32 actor locations, with a 30-minute
reconnect window and no permissions or credentials. A location that has expired
or lost permission resolves outside. An uncertain save fences room movement
until runtime reload. Code recovery can use the prior house-capable package,
which leaves the separate checkpoint untouched and keeps serving exterior state.
Do not copy an older Room save over authoritative data.
