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

The current network serves a single shared MML document and presence stream to
all room participants admitted at App level. Before revealing private house
content, bind the actor to an authorized active space on HTTP and both sockets.
Route geometry, presence and native observations through that binding before
projection. Door and portal transitions need paired canonical anchors and
safe reconnect/return. Keep owner-authoring, guest entry, content-read and
control permissions distinct. Reusing an exact Nexus source pin preserves its
own audience. A private spatial view must never be implemented by merely hiding
geometry that has already been sent.

The exterior foundation is deployed. The first multi-room traversal, scoped
presence and source/control/Conversation qualification are tracked in #9, #10,
#12 and #15.
