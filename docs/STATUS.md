# Current MVP work

Updated 2026-11-23. The complete existing MVP goal is active. Nicolás's earlier
shared movement, light, house and door confirmations still count. The repaired
content-exit route has been delivered. Nicolás has selected simulated
qualification for continued Holodeck delivery. The previous human observations
remain valid. Qualify newer releases with independent simulated participants
and devices, and keep direct use separately attributed when observed.

## Selected receiving release

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`9e9734a`, package `62b735015133`. The foyer has an inset orientation table,
west wall bench and joinery under the existing Cycles lighting rig. A simulated
Chromium visitor walked beside the bench, crossed the gallery door both ways
and returned to the original public threshold in the same renderer. The
packaged foyer model returned HTTP 404 after leaving the room. Receiving
matched the exact decoded foyer and both gallery exports, all 57 installed
files and the protected checkpoints. Package `00954ba2496a` is the compatible
rollback. [Foyer source and walking-height captures](../art/compaii-house/redesign/foyer-joinery.md)

The previous release served source `aca9e1b`, package `00954ba2496a`. The east island now has an authored
meadow, sandstone arrival path, coastal planting and an oak arbor. A simulated
Chromium visitor crossed the existing promenade, read the Signal Garden HUD,
passed the target field and reached the arbor. Authenticated receiving
matched all 57 files and the exact 300,419-byte Brotli garden model, 75.6%
smaller than its predecessor. The world and protected checkpoints matched.
Native readback confirmed the same published Signal Garden position, revision
and rules. Package `8af3e721d5e3` is the compatible rollback.
[East Garden source and running-game views](../art/compaii-house/redesign/east-garden.md)

The previous release served source `f536823`, package `8af3e721d5e3`. The North Mirador now has a limestone walk,
basalt and oak seats and a seaward copper arch authored in Blender. A simulated
Chromium participant raised the bridge from the HUD, walked both directions
with WASD, lowered the bridge and reached the interrupted crossing. The exact
authored assets and all 57 installed files matched live serving. Native
observation confirmed the original Mirador, bridge and control anchors.
Package `93f5094b9b9b` is the compatible rollback.
[Mirador source and walkthrough captures](../art/compaii-house/redesign/mirador.md)

The previous release served source `4a5bb9d`, package `93f5094b9b9b`. The outdoor gallery now has a limestone
bridge landing and a timber and copper presentation pavilion. A simulated
Chromium visitor walked from the plaza, opened the pinned fixture report and
returned at the same position. Authenticated receiving checks matched all 56
installed files and the exact pavilion asset, including the 79,243-byte
Brotli representation and identity ranges. Native observation still places the
presentation entrance at its original coordinates. The world and protected
checkpoint state matched, with only the operator's retained observations added
to the room journal. Package `7fd22a571234` is the compatible rollback.
[Before and after](../art/compaii-house/redesign/gallery-island.md)

The previous release served source `cebc44f`, package `7fd22a571234`. The west verge beside Casa de CompAII
has a limestone walk, two cross paths, an oak seat, and coastal planting
authored in Blender. A simulated Chromium visitor took the door in both
directions and then walked the garden at the existing ground height.
Authenticated HTTPS matched the exact garden model, its 151,767-byte
Brotli representation and identity ranges. All 55 installed files and
the protected checkpoints matched. Package `b6043ceebadf` is the
compatible rollback.
[West verge artist source and running-game captures](../art/compaii-house/redesign/parcel-garden.md)

The previous release served source `cc5022b`, package `b6043ceebadf`. The gallery has a framed clerestory,
a suspended exhibition light rail, matte stone backs for the three plinths
and a high-contrast Colección sign. Both Blender variants share the fittings
and the 512 px Cycles light map technique. Packaged Chromium walked the
viewing path with the stair open and crossed the continuous floor when the lab
was restricted. Both exact room exports and all 54 installed files matched
receiving. The protected checkpoints matched. Package `d2dff872e6aa` remains
the compatible rollback.
[Before and after](../art/compaii-house/redesign/README.md#gallery-exhibition-bays)

A second Chromium trial used the same installed gallery profile with three
different pinned fixture editions. The admitted owner saw and opened all
three and returned to the walkable scene. The limited visitor received only
the finished edition. Revoking the archive removed its display, plaque and
resume option. The three live source bindings remain selected. Live Nexus
descriptors return `shared_sign_in_required` for the CompAII Home owner
reader, which also receives HTTP 401 from `/access/identity`. An actual
authorized Nexus participant remains a separate receiving case.

The previous release served source `98be5ab`, package `d2dff872e6aa`. The Beacon lab now has a dressed limestone
landing with bronze edges, continuous stone and oak skirting, acoustic wall bays
and instrument drawers at the Spatializer and Weaver benches. The scoped GLB
uses nine material batches and ships in 1,602,320 bytes of Brotli. Packaged
Chromium took the same stair with E in both directions, rendered the new model
and found the two original tool handoff links. A separate scoped HTTP trial
verified denied and revoked lab art. Receiving matched all 54 live files, the
exact decoded GLB and the world checkpoints. Package `b7107ba7645e` remains
the compatible rollback.
[Before and after at walking height](../art/compaii-house/redesign/README.md#beacon-joinery-and-workstations)

Activation required a [scoped Home journal capacity repair](https://github.com/nicoechaniz/daimon-cluster/pull/552).
ITACA retained its original 128 entries and completed the same deployment
request as entry 129. Package audiences and receiver state were preserved.

The previous release served source `239819d`, package `b7107ba7645e`. A session can keep parsed static art from
up to three visited rooms. An acknowledged move and matching current presence
scope remain necessary to show a room. In packaged Chromium with 80 ms added
latency and 800 kB/s download, the Beacon revisit reached visible geometry in
0.92 s, compared with 2.98 s for the previous Brotli release. The lab and foyer
were each fetched once during the revised route. First lab entry reached visible
geometry in 4.44 s on the uncompressed release, 2.85 s with Brotli alone and
2.92 s on the selected release, under the same room-transfer throttle. In a separate scenario on the same candidate,
revoking lab access refused entry and art fetch and kept lab geometry out of
the gallery. The ordinary round trip landed at the original exterior door
without a reload. Authenticated HTTPS and exact installed-file and world checks
passed. Package `c100bf1f9a77` remains the compatible rollback.

The previous release served source `d31150c`, package `c100bf1f9a77`. The package stores 13 pinned atelier GLBs
once as Brotli and falls back to the exact original decoded bytes. The archive
fell from 33,536,000 to 26,900,480 bytes. Packaged Chromium recorded 43.6% fewer
transferred model bytes for the eight selected exterior GLBs and 35.2% fewer
for the foyer, gallery and Beacon lab. It rendered the three rooms and returned
to the original exterior entrance on the same page. Two simulated authorized
actors received their own gallery variants. Foreign and revoked lab reads
were refused, including conditional requests. Authenticated HTTPS verified
both full encodings, exterior byte ranges and no reachable package sidecars.
All 54 installed files and the protected world state were checked. Package
`b3bd76b892a1` is the compatible rollback. The byte savings are measured.
Representative travel latency and frame pacing still need separate evidence.

The preceding release served source `a663055`, package `b3bd76b892a1`. A Blender-authored coastal meadow and
basalt strata carry the existing house terrace down to the sea. Small stone
markers replace the flat parcel plates while the eight parcel positions,
their dimensions and the original walking surfaces are preserved. The new
57,768-byte asset uses one material and one 128 px map. Packaged Chromium
walked the public approach into the foyer, returned on the same page at
the exact exterior anchor, and reached the west verge at the unchanged
ground height. Authenticated HTTPS served the exact GLB. All 54 runtime
files and observed protected checkpoints matched. Package `0b49c7c4393b`
remains available for rollback.
[Editable scene and WebGL views](../art/compaii-house/redesign/parcel-terrace.md)

The preceding release served source `3203c0a`, package `0b49c7c4393b`. Blender-authored limestone with brick
and basalt edging connects the plaza approach to the existing parcels.
The first west branch reaches the Casa de CompAII doorway. Packaged
Chromium walked from ordinary spawn across the new paving, entered and
exited with E, and landed at the exact existing X/Z anchor without a page
reload. Authenticated HTTPS served the exact 258,952-byte GLB and all 53
selected runtime files matched. The world and protected checkpoints survived
activation. Package `abf87584ed54` remains the compatible rollback.
[Editable artwork and player-height comparison](../art/compaii-house/redesign/house-walk.md)

The previous release served source `7143e82`, package `abf87584ed54`. A double-sided Blender directory is visible
from the ordinary spawn. Matching markers identify Jardín, Galería exterior,
Casas and Mirador and mark the return to the plaza. The asset adds five
material batches and 278,456 bytes, with no extra textures, colliders or
shadow passes. Packaged Chromium walked from the spawn to the east garden
using WASD and a separate 390 px touch-joystick trial. Authenticated HTTPS
served the exact GLB and preserved the selected world and its protected
checkpoints. Package `a86bab2467ae` remains available for recovery.
[Editable scene and arrival views](../art/compaii-house/redesign/commons-wayfinding.md)

The preceding release served source
`303bd86`, package `a86bab2467ae`. Four original Blender headlands give the
arrival view a distant shoreline. The exterior blends into horizon-coloured
fog between 24 and 124 m. The 59,152-byte terrain asset adds four batches
with no shadow passes or walkable geometry. Packaged Chromium captured the
previous and revised coast, entered the foyer on the same page with fog
disabled and returned with the exterior fog restored and the sky fetched
only once. The world and core checkpoints matched. One expired avatar
session released its cosmetic slot during startup. Authenticated HTTPS
served the exact new GLB and all 51 installed files matched. The compatible
predecessor is `f8b4039586fe`.
[Runtime comparison and editable source](../art/compaii-house/redesign/coastal-sky.md#distant-headlands-and-fog)

The preceding release served source
`69c5351`, package `f8b4039586fe`. The eight existing concurrent world sessions
can each have a distinct human appearance. Four rigs and four alternate
wardrobes share the existing animation path. The server returns the same
appearance in the plaza and inside rooms while the actor's session binding
is retained. All 50 installed files and seven added GLB routes matched through
authenticated HTTPS. Protected world checkpoints, the original world and
own-native readback matched. Two controlled Chromium contexts loaded and
rendered their distinct selected rigs outdoors and in the same room, including
an alternate wardrobe. After the touch context closed its page and reconnected
with the retained session, both browsers again rendered the same actor-to-rig
mapping in the room. The camera correction is retained, with its
package `4821e45f09a3` available for compatible recovery.

The preceding release served
source `cf83fb4`, package `4821e45f09a3`. The interior renderer now checks the
current orbit against the loaded room colliders before drawing and retracts
the boom immediately when obstructed. It extends gradually as the view opens.
In the same packaged Chromium sweep, the previous camera crossed the fixture
wall with a near-plane corner in 16 of 72 samples on desktop and 16 of 72
in touch emulation. The corrected camera crossed in 0 of 72 each. The touch
pinch changed the requested zoom and the desktop fixture exited through the
normal door on the same page. Authenticated HTTPS and the selected protected
world checkpoints matched. Compatible predecessor: `46c6625dfb90`.

The preceding release served
source `30a00d5`, package `46c6625dfb90`. A canonical indoor turn can place a
garden signal when its own authorized daimon is present. The installed native
CLI recovered the command's exact result on the same interaction. In the
packaged simulation, one touch participant placed the first light, the
keyboard participant sent a single original and kept walking, and the native
fixture identity placed the second light using that interaction. Both browsers
saw the completed round and the touch browser recovered it after reload.
The original retained the incomplete state at sequence 2 and the action
receipt returned sequence 3. This is an installed CLI and browser simulation
with controlled admission, without a live model or device. All 43 installed
files, protected checkpoints, the original world and authenticated HTTPS
matched. The compatible predecessor is `777ce31c9fb4`.

The preceding release served
source `0c8a44e`, package `777ce31c9fb4`. A situated native observer can read
the current signal-garden revision and progress of the room referred to by the
original, subject to current room access. The archived Conversation attachment
keeps its earlier revision. Remote reading grants no play action and does not
move the observer. The native-port regression exercises that distinction and
revocation. The selected release matched all 43 installed files, authenticated
HTTPS, the original world and protected checkpoints. The compatible predecessor
is `bb14267c7e56`.

Two independent Chromium contexts exercised the packaged world and installed
canonical Conversation shell with simulated receiving I/O. The touch player
placed the first signal. The keyboard player submitted one original from the
same room, walked with WASD while context delivery waited, and completed the
second signal. Both saw the completed garden. The single original retained its
one-signal attachment at revision 1, sequence 2, and identified both participants
in the room. The visitor reloaded into the same room and recovered the completed
garden at revision 1, sequence 3. Hiding Conversation retained its frame. This
trial used emulated touch and did not invoke a native model.

Nicolás confirmed entering the basement. His next direction was a clean-sheet
architectural redesign with unified materials, light and composition. The
[new Blender source](../art/compaii-house/redesign/) restarts the visible
environment from the garden route, adjoining house and miniature, workshop
and separate gallery. The design and rendered views are available for review.

The preceding co-play release selected `compaii-atelier-v1` from source
`a94628c`, runtime package `17fbd16989d5`.
Plaza de llegada, the outdoor signal-garden editor and the Atelier remain
available. All 42 installed files and the HTTPS health and client matched.
The same canonical run and entity count were read back. The receiving,
house, placement, exhibit, creator and native journal state matched; the
Room event tail recorded joins and leaves during activation. The directly
usable predecessor `581dbb6a09cb` retains room plans and furnishings.

The preceding shared Home release served source
`983a146`, package `bb14267c7e56`. The Harmonic Beacon lab uses the same
Cycles pipeline as the foyer. Its 58,679-byte atlas lights the stair, central
instrument and two benches, with a softer dynamic light for avatars.
Exact geometry, UV data and lamp emission matched the previous lab asset.
The packaged Chromium fixture used E to descend from the gallery in the same
page, mounted the atlas in the actual WebGL material and saw all three
workstations. An unauthorized visitor continued to receive the sealed gallery
and denial for the lab asset. Live HTTPS, world and protected checkpoints
matched. Package `7191104b0306` is the compatible predecessor.
[Before and after from the same staircase view](../art/compaii-house/redesign/README.md#blender-to-webgl)

The [Harmonic Lab panel](https://compaii.dmn.homes/harmonic_lab/) now serves
the request confirmation fix from Harmonic Weaver `dc825ae`, package
`87df9184488a`. The panel confirms only the exact start it submitted and
waits for service status before offering a ready interface. Chromium exercised
the exact panel script through its real Node and Python routes with a
simulated launcher. One explicit Weaver click created one matching job and
the interface opened after readiness. A response containing an older
Spatializer job showed that the receiver was busy and created no new job.
The combined trial opened the exact panel from the Weaver bench in the
compatible preceding Holodeck package. Both cases closed the panel and
returned to the same room, document and position. The deployed panel served
matching static files and health. Live device and human use remain open.

Source `edf991b`, package `7191104b0306`, retains the Cycles-lit foyer from
source `5040075` and compacts generated server whitespace. The package drops
from 33,464,320 to 30,269,440 bytes. All 33 non-server inventory entries
matched the preceding candidate byte for byte. Live HTTPS, own-native read,
the exact world and protected checkpoints matched; `3f889689814a` is the
compatible predecessor.

The foyer runtime reads one 512px, 35,511-byte static diffuse atlas attached
to its existing geometry and UVs. The texture covers direct and indirect
light from Cycles while the lower real-time key and ambient fill keep avatars
lit. The lamps retain their original emission. Chromium handled the same
authorized asset, showed the atlas in the actual WebGL material, and verified
movement and the touch-emulated doorway circuit on the lighting candidate.
The compact candidate also passed its real HTTP authentication fixture.
The software-rendered frame trace yielded 9–11 samples per run, so
representative frame pacing remains open.
[Player-height capture](../art/compaii-house/redesign/review/foyer-baked-light.jpg)

Source `586f9ac`, package `143361af802d`, established the foyer's flush limestone route
around the table, an oak gallery door with the existing room label, a framed
clerestory and a soft side light. The
[matched game-camera views](../art/compaii-house/redesign/README.md#blender-to-webgl)
show how the light and materials lead toward the gallery. The existing
coordinates, collision and location rights are preserved. Chromium completed
the route with keyboard movement and E, walking all five foyer waypoints.
The touch-emulated trial exercised the same doors with taps. Both returned
to the plaza in the same page. The selected installation matched all 43 files, authorized HTTPS
and the exact world and protected checkpoints. Package `5f19c2909409`
remains the compatible predecessor. The foyer GLB is 2,176,764 bytes and
the package is 33,433,600 bytes.

In source `69c712c`, package `5f19c2909409`, the gallery gained Blender-authored
clerestory trim, baked contact shadows and one soft cross-light that matches
the clerestory. Both floor variants were walked in the packaged browser
simulation. The [matched player-height comparison](../art/compaii-house/redesign/README.md#blender-to-webgl)
records the change under the normal WebGL renderer. The new geometry and maps
add 333 KiB to the combined gallery variants. All 43 installed files, protected
HTTPS health, identity and Brotli client bytes, and the retained world and
protected checkpoints were checked. Package `cc796555b993` is the compatible
recovery.

That recovery package also delivers source `0f351c1`, which lets owners revise
guest lists for their own authored rooms. Chromium verified that a revoked
guest is returned to the exterior door in the same page and keeps movement.
Restoring access requires re-entry. The native, HTTP and WebSocket trial
retained the exact receipts, denied foreign edits and preserved an admitted
visitor's room and activity across restart. These were isolated tests with
simulated actors. No live house audience was changed for qualification.

The earlier `2bfc1ef` gallery stage release selected package `75b08bb68ebc`.

The preceding release, source `3c474c6`, package `0af62b029659`, shipped the
[Blender coastal foliage](../art/compaii-house/redesign/coastal-trees.md)
and scoped doorway timing correction. Both versioned foliage assets and the
Brotli and identity client matched the installed 43-file inventory through
the protected HTTPS route. The Room and protected checkpoints matched the
pre-activation baseline. Prior package `4232c649d9f1` remains the immediate
recovery selection.

Same-camera MML comparison showed the new branches, needles and leaf masses
on the same world placement with keyboard movement. The foliage adds 570,216
bytes and 7,480 triangles across the Commons and surroundings and removes two
draw batches. Doorway profiling found two foyer model requests in the old
path and one per crossing with the new path. The exact selected package
reused an authorized room template on re-entry without remounting the page.
The software-browser revisit took 1.1 seconds. The exact touch-emulated
fixture crossed in 1.9 seconds and returned in 1.8 seconds. Cold desktop
timings remained variable, so the timing work continues.

The preceding source `8c56091`, package `4232c649d9f1`, selected the [Blender coastal sky](../art/compaii-house/redesign/coastal-sky.md)
and [water materials](../art/compaii-house/redesign/coastal-water.md).
The exact HTTPS client, sky, water and Commons assets matched the installed
43-file inventory. The canonical run and protected state were retained.
The previous material package `4581272b06f6` is directly available for recovery.
Desktop and touch-emulated Chromium passed a same-document foyer-entry and
return from fixture doorway positions. The panorama rendered outdoors, was
removed inside and loaded once per client. The water model adds 101,312 bytes
with the prior 3,260 triangles and 12 batches. The software-rendered passage
measurements ranged from 1.7 to 5.7 seconds. These timings describe the fixture.

The preceding source `e30ece2`, package `4581272b06f6`, selected the
[Blender Commons maps](../art/compaii-house/redesign/commons-pbr.md).
The receiver matched the 42 installed files, HTTPS health, client and exact
revisioned Commons asset. The prior game package `17fbd16989d5` is retained
for compatible recovery. Controlled WebGL compared the two assets from the
same grounded camera, rendered all five mapped materials, and walked the
route. The new asset adds 381,732 bytes with the same 14,880 triangles and
10 batches. World placement and collision remain unchanged. The software
renderer sample is insufficient to characterize device frame pacing.

The preceding atelier deployment matched all 40 installed
inventory entries. The decoded client, Brotli representation, health and
four visible scenery assets matched through the protected HTTPS route.
Room, houses, exhibits and the native turn journal were byte-identical
across deployment. Own-native observation retained the same run, edition
and all 30 entities. The live own-native route visited the lab and observed
the three workstations, followed the existing portal to the listening
tower, then returned outdoors.

The verified 30,289,920-byte archive fits the existing 32 MiB package limit and
includes the previous scenery as a compatible option. No Room migration
is required. The packaged production entry admitted a fixture identity
over the existing Home HTTP contract and returned the authored foyer.
Chromium walked the packaged garden, facade, foyer, gallery and lab using
the real room IDs, then returned to the exact exterior entrance. It
preserved the renderer, world run, entities, creation nodes and protected
prototype pointer. An independent fixture received only the sealed gallery
art and no lab bytes.

The same profile now includes the Blender commons and listening tower.
Chromium loaded the exact commons at the existing spawn. It entered and
left the tower using the existing portal actions and unchanged anchors,
keeping the same page. The closed gallery and lab continue to use their
room-scoped asset routes. The packaged browser client is about 1.34 MB
on disk with Brotli. A fixture exercised the production startup and
compared Brotli and identity HTTP delivery to the same original bundle.
The profile includes contextual Spatializer and Weaver links beside their
authored workbenches. Each opens the existing Harmonic Lab panel in a new
tab and keeps the world in place. Chromium walked to both benches, opened
the exact tool cards in the owning panel build, and returned to the same
spot. The controlled receiver reports let the panel distinguish ready from
stopped. The browser made only read requests during either handoff. Room
fixtures also verified the workstation reference in a situated observation.
The deployed [Harmonic Lab panel](https://compaii.dmn.homes/harmonic_lab/)
uses the instrument selector from the
[owning panel source](https://github.com/AlterMundi/harmonic-weaver/commit/420efaa).
Only its browser script was replaced in the existing panel package.
Served health, script and HTML matched at the receiver. Anonymous requests
remain subject to sign-in and current audience checks. Actual instrument
readiness or actuation, and shared device and human acceptance remain open.

The owning writer retired fourteen superseded generated Holodeck runtime
archives across these updates. Its three retained packages total 90,869,760 bytes within the
96 MiB history budget, including the deployed current and rollback.

The Blender art package includes the self-contained room GLBs. The
candidate Beacon chamber was mounted through the existing room-scoped renderer
in isolated Chromium. The actual browser drew nine textured material batches,
one shadow-casting light and three fills. The owner fixture crossed the
existing stair in both directions. A separate admitted visitor reached the
gallery and could neither enter the lab nor fetch its asset. The authorized
session retained the existing exact prototype descriptor. This qualifies the
local chamber integration. Physical phone performance, real station effects
and human acceptance remain open.

The connected art candidate now replaces the selected parcel facade and the
visible interior shells of the foyer and gallery, alongside the authored east
garden and Beacon chamber. The exterior door, parcel occupancy, original
walkable ground, exhibit anchor and stair coordinates remain authoritative.
The gallery selects open-stair or continuous-floor art with the existing
per-visitor passage rules. Requests for the other variant's hash return 404
even while the visitor is in the gallery. The authored gallery keeps the
existing published exhibit discovery point. The receiving candidate now
selects the existing exact draft and archival Nexus reviews for the other two
pedestals. The published selection still comes from the retained owner
placement. Each pointer is returned only to a visitor currently in the room
with a successful exact Nexus descriptor check. The three selections were
read back from the durable exhibit, the existing draft area and a protected
historical manifest. HTTP fixtures exercised distinct visitor scopes,
revocation and room departure while a descriptor was in flight. Chromium
with a controlled Nexus server verified that returning to an available
edition reused its viewer and a revoked edition no longer appeared as a
resume action or current world reference. The renderer now mounts the exact
authorized original GLB over each authored pedestal. It verifies the Nexus
edition and Homes publication and checks the snapshot checksum. It fits the
geometry after excluding only the original horizon-water material, leaving
the published file intact. The actual WebGL client rendered the sealed
gallery with three displays for an admitted owner fixture and one for an
independent visitor fixture, which made no draft or archive model request.
All three test slots used the same verified published snapshot. After
deployment an authorized owner reader separately verified the three
immutable source editions by their own Homes version and snapshot checksum.
The subsequent gallery release adds readable two-sided plaques for Terminado,
En proceso and Archivo. The packaged Chromium trial used three distinct
GLBs and exact controlled Nexus pins. An independent restricted visitor saw
and opened only the published model. A wrong ready message left the viewer
hidden until the expected pin and describe response arrived. Return retained
the viewer and avatar position. Revoking the archive removed its model,
plaques and selector entry. These were controlled identities and editions.
The owning Home reader still receives 401 from the live Nexus descriptor
routes. The existing live Homes sources were separately verified, but that
reader is not a supported substitute for a Nexus participant. No changes to
source publication or audience were made for this qualification.

The browser editor lets an authenticated creator place and edit a
signal garden using the existing world command path. Walk to set up to four
signals, choose their colors and collaboration rule, and preview before
publishing. The edited revision is still owned by the original actor.
Controlled Chromium used two browser identities to verify the private
preview, visible published and edited revisions, foreign edit exclusion and
cancelled changes. A 390px Chromium touch fixture moved the avatar with
the joystick while editing, used the touch buttons, and repeated that
create/edit/cancel flow. Hit testing at 320, 390 and 740px confirmed that the
status badge does not cover the button. Human co-editing and a physical
phone trial on the deployed world are still open.

Isolated Chromium walked from the normal exterior spawn to the east garden,
past the miniature, through the original house entrance and into the foyer,
gallery and Beacon lab. It returned to the original exterior doorway with
the same browser page, world run, edition, entities and creation nodes. The
only world events were leaving and rejoining exterior presence. A distinct
admitted guest received the closed-floor gallery and could fetch neither the
open-floor asset nor the lab model. The actual prototype descriptor remained
selectable. The browser build handled expected in-flight model cancellations
on room change. These results qualify the isolated connected route. The
deployed room selection, live controls, physical-device and human acceptance
are separate.

Source `5e90de1`, package `a1ec8c4e05db`, connects the authored
Beacon workbench to the existing 54-part H.B. Guitar prototype in Nexus.
The lab is the discovery scope; no exterior source node, artifact copy or
additional access was created. The exact Nexus manifest, paired human's
current invitation and the immutable Home source permission were read back.
The own publisher verified the exact source renderer. Controlled Chromium
walked to the station, opened one fixture iframe for the exact pin, and
returned to the same room and position. The live native owner observed the
same workbench identity and revision, then returned outside. Actual human
use of the published viewer from the room and real instrument controls
remain open.

Source `3e15eb6`, package `538da75a94c9`, enables the continuing
Conversation in authorized rooms. The receiving package passed a scoped
preparation test that moves the speaker outside during an asynchronous
binding read and verifies that the retained source still names the original
room. Native observe resolves that captured room under fresh authority and
refuses exterior mutation from the indoor original. The live selected
runtime and authenticated health/assets matched. Human and model acceptance
remain separate.

Nicolás reported that the lab stair was missing. The selected Home pair
already had the foyer and gallery grant; the lab was still limited to its
owner. Receiving configuration now adds exactly that existing paired
human to the lab. The Holodeck web unit reloaded the selection and the
signed native observer responded. The author has not yet observed the
paired human's resulting browser entry.

The Blender-authored Beacon workshop is live in the existing CompAII
laboratory. Source `6f01e67`, package `a7cf9e539e70`, uses the existing room
ACL, stairs and return path. The seven-mesh GLB is 801,332 bytes and served
only in the current authorized room. The exact vendored release passed
scoped byte readback with two permitted identities plus denial and revocation
checks. Chromium decoded and rendered the actual model in the walkable room.
A signed live owner traversed foyer, gallery, lab and public return. The
receiving configuration and house, exhibit and native-turn checkpoints
matched the previous release. Actual project controls and human use of
this art release remain open.
[Art and reproduction](../art/compaii-house/README.md).

The Casa de CompAII on the first west parcel is live. Nicolás confirmed
entering the real house, seeing the foyer and leaving. The new interior build
serves the foyer-to-gallery door, gallery-to-lab stair and gallery-to-tower
portal without a room selector. Owner access includes the lab. A visitor's
geometry omits its staircase and floor opening. The signed native owner
traversed the live map. Separate controlled Chromium identities verified
walking, reconnecting in the gallery, both directions of the staircase,
return through the portal and exact exterior return. Nicolás also confirmed the new internal links and portal round trip using E.
He reported slow crossings. Source `b4f0dee`, deployed as `b8cdbed1536f`,
retains the same renderer and uses an authorized bounded in-memory room cache.
The vendored Chromium run measured 779 ms for a cold gallery entry and
232–954 ms for reused rooms, compared with the previous 4,787–5,476 ms.
See [houses and interiors](houses.md).

The gallery's first exhibit now points to the exact existing published
workshop in Nexus. Actual owner authorship and the protected source were
read back. Controlled browser traversal verified the same-position return
and denied or revoked viewer access. Human use of the exhibit, broader
authoring, lab controls and room-bound Conversation remain open.

The room boundary is deployed at source `d542e3e`, with `64b6a856` selected as
its predecessor. Controlled room qualification used two actual MML peers for
shared presence and peer exclusion, and Chromium for one complete route through
a foyer, gallery, underground lab and upper tower, with reload and return.
The native test checked separate projection, current being access and revocation.
The live release did not select an occupied house or any interior membership.
Spatial door anchors and owner-authoring, protected Nexus display and tool
bindings, and a room-bound canonical Conversation input remain open.
See [houses and interiors](houses.md).


PR6 is merged and its figure asset is served. A controlled browser clicked the
rendered model, opened the exact selected edition and retained the frame when
returning to the world. The final suite recorded 182 passes and two optional
skips. The protected Oliva edition has an exact immutable Nexus association.
The cross-Home protected renderer and the exact Nexus view have now been
verified in Chromium. Signed delivery of the placement procedure to Oliva was
observed. The live room had no represented Messi node at the latest observation.
The own-native placement receipt and the independent world-to-Nexus-to-world
visit remain to be observed. The selected compatible predecessor
is `7b24c1a1` from `b33b8c8`. The earlier Field-specific measurements below
are historical checkpoints.

The protected entrance remains https://compaii.dmn.homes/holodeck/.
Source `0cd1868`,17,807,360-byte package `00bf85a1`, is selected. All29runtime
files, exact health, served client and506,528-byte scenery match the qualified
bundle. Same App, fourteen readers, seven native routes, receiving configuration,
canonical Conversation and two configured pinned visits remain. Runtime-created
nodes add protected result entrances without changing that configuration. The goal
is BLOCKED pending actual human situated use/return, with its full objective and
accounting preserved. No developer job is claimed running in that wait.

The seven existing native receivers now select the qualified public CLI e3e06d5a
and bridge f08a4db0. Exactly one own `activity` read per body returned canonical
event130 with its actual expected observer/current-being grant; event fields match
and only CompAII isSelf=true. Actual native/Core bindings and private configuration
remain unchanged. Future situated descriptors advertise all five operations through
a pure formatter check; no synthetic original or model uptake is claimed.

The selected result offers **Visitar contenido** for its exact revision; a changed
node cannot silently redirect a pending visit to another edition. Returning keeps
the existing frame and its work. Shared lights support private preview/cancel,
move/colour edits and revision-safe undo. The recent-activity view now exposes the
same bounded canonical events to humans and native readers: recorded state versus
current state, explicit gaps, current-target indication and situated discussion of
one exact event. It adds no event polling or separate history database. Selecting
a discussion topic freezes its reference before any asynchronous viewer request;
evicted events remain explicitly unavailable. See [world history](world-history.md).

The current full suites report172Node cases:170pass, no failures, two optional
builder skips;42Python cases pass. Separate installed-builder/export qualification
remains valid. Controlled desktop/mobile browsers checked retained frames/drafts,
history paging and exact event capture, immediate topic removal and cancelled
pending actions after actor/run changes. Final served client bytes match that
browser-qualified build. These are technical checks, not new human acceptance.

The final source-recovery correction resumes the exact retained request hash,
frozen binding and situation after a missing preparation acknowledgment or ledger
reopen. HTTP tests cover separately resolved history and fully omitted optional
view; a newer Room event does not relabel the original. Context recovery never
submits a human original. Exact receiving readback retains the same Room,
configuration and private native/context journal bytes. No bridge/Core/native
reload was needed. The29runtime files, actual HTTPS health/client/scenery and
own-native socket isolation match after selection.

Selections now show their actual public titles. Confirmed navigation/success
notices clear after six seconds while errors/uncertainty stay. Escape cancels only
the editor's private preview. Real browser mouse/touch checked both editor exits,
retained Conversation draft, updated node title and persistent refusal; no real
human/provider input was created.

Default observations now fit32KiB. The read-cache is independently bounded by
2MiB,128entries and five minutes, including legacy load. Eviction does not remove
canonical state or completed command outcomes. Explicit omissions preserve all
canonical entity/node definitions and speaker/paired indications; optional
client view detail can be unavailable. No capacity increase or new wire schema
was introduced. The worst legal32-entity/8-game fixture is29,041B.

[Oliva's PR5](https://github.com/AlterMundi/holodeck/pull/5) is merged as c80a7d1,
retaining her commit and authorship. It adds authored research entrances, optional
local GLB representations, real spatial picking and retained authorized visits.
Integration preserves native runtime nodes, dynamic catalog updates, exact pins,
canonical Conversation and the immediate single “Volver al mundo” exit. This
operator-authored foundation is not a newly published research corpus or a claim
that all future creator-facing custom-model contracts already exist.

The human-supplied22November screenshot exposed congested composition. The new
layout keeps an open central arrival, west gallery centred(-22,0), east garden
centred(22,0), the existing far overlook and wide fixed promenades. Long game
billboards are removed; the nearest-activity HUD carries the full instruction.
Short local signs yield a readable route rather than a wall of titles. Three
visual floor layers eliminate confirmed coplanar grass/stone/path faces;
invisible walking proxies no longer cast shadows. Methods selected from
[Scenario expert guides](research/2026-11-22-world-art-adoption.md) were adapted
to this actual MML/Three pipeline; Blender helpers were not executed.

Actual canonical creation events and independent own-body identity evidence
identify25existing lights as Oliva's. All were retained and redistributed around
the gallery/garden borders through own-native typed updates. Original creation
events/actors, IDs, colours, deletion state and all three human-created lights
were preserved. Root's own signal moved with its game. The published result node
is(-25,-2), the game is(22,4), bothrevision2 with a current relationship; the
published edition pin remains unchanged.28exact commands and result retrievals
advanced the same run/edition fromseq98 to127 (one independent presence event).
The same service process, receiving config and native journal persisted through
those data changes. Game progress is honestly1/2signals,1/2contributors, bridge
unconnected. This is world curation, not an engine release per object or creator.

139Node checks pass, one optional gallery skip;34Python checks pass. Final asset
export/loader checks pass. Real MML WASD traversed both promenades and the earlier
blocked point with the final distribution. Multi-angle desktop/mobile-viewport
and aerial images were inspected. An actual pointer gesture on the reading-room
mesh reached ContentVisitor; its no-content fixture granted no real source.
Separate controlled v2 checks retained dirty/recording/processing work, exact
readiness/context and a usable mobile selector. Three final same-camera surface
captures verify the floor correction while ordinary shadows remain. These are
specific technical observations, not new physical-device or human acceptance.

Actual previous code is `f1ff94f6`/source `1edd51f`, selected and verified before
publishing context data. It can read the new context pins and preserves the same
world/native state; the older parser rejected them. Current and predecessor
archives total35,604,480B/96MiB. Superseded generated archives and task stages
were retired after exact protected-writer/readback proof. Source and live data remain.

The current Field portal (node-field-history, revision2) pins
capture-2026-11-22-field-v1:62selected Project cards,125nodes,124relations and125sources.
Its October predecessor remains. Four completed own-native node/focus commands
advanced the same world to event134; all30entities and3previous nodes survived.
No engine configuration or restart was needed for those content changes. The
existing verified Field membership for Nicolas was renewed through the owning
writer and Home mapping, preserving45prior mappings. A policy check is not an
observed authenticated human visit. The [shared roadmap](shared-roadmap.md) records
the reviewed next work; houses and private spaces remain unimplemented.

The draft e66a4961… has its own immutable Nexus table, seven exact human selections,
14model-reader decisions and an installed native review association. The new
runtime-created **Taller en revisión** portal sits in the west gallery at(-19.5,-2.5),
linked to the unchanged published node. CompAII used its own native projection to
stand beside it and explicitly indicated its revision1, canonical event130.
All30existing entities, the old published node and publication pin remain unchanged.
Creation needed no engine configuration change or restart. Actual human review,
contribution and matched native response are still unobserved. See
[content cycle](content-cycle.md) and [deployment](deployment.md).

## Actual human and native evidence

- Nicolás and Ani independently signed in and reported seeing each other's
  walking, the same human-created violet light and CompAII's beacon. Nicolás
  subsequently confirmed the same original light recolored by the native action.
- A genuine situated human input reached the continuing Conversation with its
  immutable application-authored situation. Actual native observe, projection,
  result and revision-bound edit have retained receipts; no canned companion or
  fabricated model input supplied that evidence.
- The existing Navegante layered animated design was selected through the native
  projection API, read back independently and moved beside the reading-room
  entrance. It is a2.5D spatial sprite, not a rigged GLB. The provided22November human screenshot visibly shows the selected Navegante
  beside Nicolas; a still image does not prove all animation states or VR. Native presence is independent of human browser login.
- Actual native focus indicated the original violet light at revision2/event82;
  independent native observation and durable room state retained that exact target.
- All seven native listeners and bridges adopted the human-return lifetime and
  acknowledgment repair while preserving Core, configuration, goals/accounting
  and originals. The old stuck original now appears in the actual app journal as
  problem/tracking:false/nativeRetained:true. Its missing reply was not borrowed
  from another source; a new human-visible conversational loop is still untested.

## Technical qualification and recovery

On 23 November, the current foyer-release package and the installed
Conversation web assets passed an additional [situated return qualification](shared-conversation.md#return-to-the-same-conversation).
One synthetic original submitted through the browser with its frozen room
attachment. The sender kept walking while preparation was pending. The native
CLI then applied the original's signal in the correct room, and two independent
Chromium identities saw the completed round.
The unrelated fixture final arrived first and did not release the original's
context or authorize its receipt. The original reply appeared once in the
same retained Conversation frame after reopening and refreshing the panel.
Reloading the other browser restored the game result and never exposed the
private text. This qualifies an isolated handoff using a synthetic canonical
writer, admission and final. A separate Telecodex test exercised the actual
final-event projection from a synthetic native peer. Actual model choice and
final generation in this same world action remain open.

The live client freezes copied world position, other participants, geometry and
capture time before waiting for an embedded viewer. A changed visit cannot relabel
a question with another frame/pin. World sample, viewer query/acknowledgment and
server retention times remain separate observations. The controlled moving-browser
regression changed from1.689m late-position error to0 while preserving exact text,
one submission, next draft/focus and the retained frame, with no JS errors.

The preceding bc713b77 release passed101Node checks with one unchanged optional
installed-gallery skip and differed from its restart-qualified predecessor only in
build/client.js. That earlier recovery evidence remains valid for the unchanged
session registry and transport; current shared-surface qualification is recorded
above and in shared-conversation.md.
That exact backend passed actual process replacement with two independent original
browser pages/tokens, real MML presence and Networked DOM, retained actor/run/shared
change, draft and command/native references, no POST replay, subsequent WASD and
no JS/server errors. Desktop/touch-emulated controls and390px media layout passed
controlled browser checks. These do not establish physical-device acceptance.

Protected session recovery retains only eight bounded tokenhash/actor/time bindings,
never Home cookies or rights; fresh shared Home identity/audience remains required.
The original30minute expiry is not extended. Pinned upstream callbacks forward the
actual socket to bind handshake ownership. Pre-upgrade unrecorded sessions need
one reload. See [operations](operations.md) and [content visits](content-visits.md).

The world has bounded durable saves, exact retry outcomes, explicit stale-target
refusal, creation preview/accept/cancel/undo, opt-in sound and native perception/
projection/actions. A renderer acknowledgment is not presented pixels or attention.

## Real content and publication cycle

The reading room selects the existing narrated presentation and an immutable3D
review of the actual shared workshop. Existing Nexus owns playback, pause,
contributions, recordings/transcripts, native review and retained discussion.
Its deployed lifecycle permits leaving a durably retained native wait while
protecting local draft, submission uncertainty, recording, upload and ASR.

The actual creation retains full source geometry. The independently published
106part review and newer109part archipelago draft preserve their exact immutable
Home editions. Pinned HTTPS bytes, own-being current/historical browser rendering
and part toggles, separate Nexus review tables and native associations were checked.
Seven existing humans have their exact review mappings and all fourteen readers
retain independent model access. No human session or contribution was fabricated.
The separately selected stable trial entrance pins its reviewed edition; future
drafts do not move it automatically. Generic independent Nexus draft/published
lifecycle remains a proposal. See [content cycle](content-cycle.md).

## Simulated delivery checks

1. Exercise situated Conversation with simulated input, concurrent movement,
   shared activity and correction through the maintained return path.
2. Run independent desktop and touch-emulated sessions through movement,
   collision, avatar visibility, reconnect and shared play.
3. Open the exact authorized presentation/model, submit a fixture contribution,
   exercise the matched response, and revisit the retained edition.
4. Review player-height frames, transitions, interaction and situated context.
   Fix concrete issues before promoting new art or behavior.

Use these checks to advance qualification and deployment. Record any later
direct use and its actual context separately.
QR domination, physical mapping/sensors, arbitrary games, deeper simulation, VR
and Avatar-default remain future direction, not replacements for this walkable MVP.

## Owned house foundation

The initial [house foundation](houses.md) added eight connected plots and an owner-only
durable facade publication path. A controlled browser visited a fixture facade
over the protected locator and walked the connector and aisle. Actual own-native
production probes saw all eight empty plots and refused foreign and oversized
claims. The same Room run, 30 entities, four nodes, 15 App audience entries
and eight native routes were retained. The occupied CompAII parcel and its
connected interior were delivered in subsequent releases recorded above.

Owner layout authoring is live from source `04037a5`, package `cb1abab03fb4`,
with `27501f434aab` retained for recovery. The receiver matched all 40 installed
files and served the expected HTTPS health and client in both identity and
Brotli encodings. The ordinary live own-native route read its plan state.
The canonical world and protected checkpoints survived activation. The native
baseline observation updated only the Room observation history.

The exact package passed an owner, guest and outsider receiving test for room
entry, private-room exclusion, an append-only portal, restart recovery and
return outdoors. These actors were test fixtures on the maintained transports.

The [original Blender room kits](../art/owned-rooms/) add the listening
workshop and project archive for owner-authored plans. In the exact packaged
browser fixture, an independent visitor received the second kit after the owner
changed it in place, kept their avatar position and could walk afterward.
Room-scoped assets use exact digests and shared collision bounds. The live
native route refused to modify the preselected Atelier. The kit fixtures are
scenery. Existing exhibits retain their exact source editions. Reusable
working tools remain open in [#15](https://github.com/AlterMundi/holodeck/issues/15).

The deployed [indoor signal garden](playable-creations.md#play-in-an-owned-interior)
lets owners preview and publish a room-local recipe. In two independent
Chromium instances, the touch-emulated participant placed the amber light,
the keyboard participant walked to the mint circle, and both saw the two
lights and the same completed round. The packaged receiving test also checked
layout isolation, native readback, stale recipe denial, restart recovery and
two rooms with distinct recipes. These were simulated participants and devices.
