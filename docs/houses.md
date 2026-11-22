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

The room directory is read-only at runtime in this increment. Current guest
admission uses the protected receiving selection, with exclusion taking effect
on reselect, and current Home permission. Owned authoring, per-guest live
revocation by the owner, authorized control bindings and outward pointers
are tracked in [#10](https://github.com/AlterMundi/holodeck/issues/10)
and [#15](https://github.com/AlterMundi/holodeck/issues/15).

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

## Seamless circulation follow-up

Nicolás confirmed the live door and portal round trip using E and reported
long waits on room transitions. The current browser commits the location,
then reloads the whole document. Two controlled Chromium foyer-to-gallery
crossings had 204 and 338 ms from input to HTTP response, and 4,787 and 5,476
ms to the destination geometry and avatar. Each downloaded the same
4,786,942-byte client. These loopback samples localize the delay and are
not a measurement of the visitor's device or network.

Keep the document, renderer, avatar and input loop mounted. Switch the
authorized room and subscription within the client and present a new room
only once its matching collision geometry is ready. Load the nearest allowed
destination as the avatar approaches its doorway. Hold a bounded in-memory
cache of recently visited static geometry, collision and common assets.
Identify entries by room, geometry revision and audience scope, evict distant
or changed entries, and check access again on entry. Read presence and active
state from the new room. Do not share or persist protected Nexus credentials
or live frames in the geometry cache. Start with interior crossings and
extend the same transport across the exterior door. Measure cold and warm
time from input to the destination's first playable frame.

## Place a room exhibit

Use the existing own-native world lane. Observe the current revision of an
existing result node that you authored, then move into the selected room of
your house. There is one exhibit position per room. Supply the current source
revision and the expected exhibit revision. Creation expects `null`.

```sh
holodeck-world --own act --json '{"type":"exhibit.put","id":"unique-command-id","room":"ROOM_ID","source":"node-EXAMPLE","sourceRevision":1,"expectedRevision":null}'
holodeck-world --own result --json '{"id":"unique-command-id"}'
```

An update uses a fresh command ID and the expected current exhibit revision
read from the room. A retry uses the original ID and arguments. If the result
is uncertain, inspect that ID before retrying. The server derives the owner
from the parcel and copies the exact existing pin. Updating the outdoor node
does not advance the exhibit. No publication, guest grant or Nexus access is
created. Each geometry stream sends only the generic plinth and its revision.
The catalog is scoped to the current room. The initial and reopened visit
both check the exact Nexus descriptor with the visitor's own session.

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
