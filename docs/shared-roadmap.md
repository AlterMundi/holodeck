# Shared Field and Holodeck roadmap

Reviewed 22 November 2026 against maintained source and an independent GPT-6.2 Astra high evaluations of architecture and delivery. [Field Project 13](https://github.com/orgs/AlterMundi/projects/13) is the shared coordination index; component issues own implementation and receiving evidence. This document replaces parallel sequencing proposals for this integration, not their historical evidence or unrelated paused work.

## Intended experience

Walk from the common landscape to a recognizable daimon-authored house, meet its owner, enter a workshop larger than its exterior and explore what that human–daimon pair creates. Together inspect a result, its evidence, code, simulations, media, revisions and possible material realization. Refer to the same situated object/activity/time while each participant can move and look elsewhere. Suggest a change, continue exploring while the daimon works, then return to both editions. Shared public terrain connects individual places and collective creations. The future includes headset participation and selected physical augmentation, using the same situated references.

Daimons participate through native observation/action/projection and their actual identity. Human WASD/touch clients and native representations refer to one authoritative state; native participation does not depend on operating a human UI. Turn-based canonical Conversation remains the initial communication mode; refined Avatar mode is optional later.

## MMORPG experience and creator loop

The target is a beautiful, persistent shared MMORPG for the tribe. Players should
read the world from inside it: recognize destinations by their silhouettes and
lighting, find a route by looking around, encounter people and daimons along the
way, and move naturally between houses, exhibits, labs and playable spaces.
A new space can be a small game designed and published by its creators within
the same world. Houses, underground and upper floors, internal portals, working
controls, situated Conversation and source-pinned exhibits are part of that world.

Author visual world geometry in Blender, using the existing
[art-production research](research/2026-11-22-world-art-adoption.md) for scale,
silhouette, materials, lighting and iterative player-height reviews. Export
selected scene geometry and collision references to the existing MML/Three
renderer. The earlier procedural scenery is a functional prototype. The new
[Casa de CompAII](../art/compaii-house/README.md) level anchors the first
district in ongoing work: the shared table, Harmonic Beacon Lab for prototype
inspection and controls, and Sensorial for retained experiments, analysis and
eventual live receiving. Each encountered control should act through its actual
project owner and report its real state in the room. Initial delivery can use a
genuine retained source while independent live feeds and operations qualify.

Walk the art in the actual renderer from arrival to return. At each decision
point verify readability, collisions, camera, player control and crossing time
on desktop and a phone-sized viewport. Record player judgment separately from
technical rendering. Keep the working scene and a reproducible export.

Treat the house as a place a person or a daimon can work from in different
embodiments. A virtual or physical embodiment can arrive at a shared situated
reference and see the same version of the tool, object or report when authorized.
The workspace can eventually show actual device observations and supported
tool actions in context. Walking into range discovers an affordance; execution
uses that tool's existing authority, current state and observed receipt.
The spatial design provides clear approaches and working room around a station
for different body sizes. Physical locomotion, sensing and tool effects require
their own qualified receiving implementation under the existing XR and
physical-station scope.

Use the garden and an evolving residence as the first expressive kit. Rooms,
outdoor work areas and leisure additions can change over time using coherent
scale, materials and paths. Use short signs attached to the architecture and a
single contextual action in the HUD. The first house art and interface treatment
are documented in [the house study](../art/compaii-house/README.md).

Build the first creator loop with [#2](https://github.com/AlterMundi/holodeck/issues/2)
and [#15](https://github.com/AlterMundi/holodeck/issues/15), using the existing
signal garden as the first supported recipe. From an authorized place, an
actual creator chooses a floor plan, places a playable objective and props,
previews the linked layout, and publishes a durable revision under their
identity. A second participant discovers the space from the world, joins and
sees the same authoritative progress. Then the author makes a recognizably
different playable space using the same controls and can revise it without an
engine release. The first proof should exercise durable address, owner-only
edits, source audience, recovery, and observed return after play. Use that
proof to choose the next mechanically distinct recipe and qualify reuse.
The deployed signal garden supports native creation from data and browser
editing. A second deployed increment lets a daimon publish an interior room
plan on its own claimed parcel, set the initial guest list room by room and
extend the plan with new cells. The same owner lane now provides two original
Blender room kits with reusable furniture anchors. The remaining creator loop
makes room tools and pinned contents as easy to place as the room art. Indoor
signal gardens can be placed using the owner lane. Exercise the full loop in
two distinct rooms with independent simulated creators and visitors.

## Environment art production

Nicolás selected photorealistic rendering for the complete shared world.
Judge work at player height in the running game, across arrival, paths, houses
and interiors. Use physically grounded materials, believable light and shadow,
human scale and purposeful detail. Keep walkability and room transitions fluid
in the same release. Run those comparisons with simulated players and devices.

Elder Scrolls Online housing sets a quality bar for architectural composition,
furnishing and useful play. Start visible art in a blank Blender scene and
review one coherent design before changing the public world. Use existing
layouts, colliders, anchors and user state as the migration contract. Design an original settlement that takes cues from
resonant instruments. Three recurring details tie it together: structural ribs,
tensioned elements and brass joints in carved stone. Use pale mineral plaster,
dark lacquered wood, warm instrument light and cool garden shade. Frame the
garden from the arrival and save the main workshop reveal for the bottom of the
stair. Let the interior open up into an asymmetric room whose instrument is the
first thing a player sees. Keep each route simple enough to learn after one
walk. Reserve expansion edges for later rooms and link distant floors with the
existing internal portals.

The independent [coastal settlement layout draft](../art/world-layout/)
studies a walkable loop linking arrival, gardens, Casa, creator parcels and
tower, with a quieter gallery branch. Its authored Blender source and plan
remain draft material until their routes, sightlines and clearances can be
reconciled against the existing durable world and surveyed from player height.

Use Cycles to light the authored environments and bake diffuse illumination
for static surfaces. Mix the bake and material color in linear light.
The foyer carries the static diffuse result as an embedded glTF atlas
registered to its existing UVs, which the current Three.js renderer reads.
Preserve physically based material response, reflections and the bounded real-time
lights that make moving characters and tools belong in the scene. Calibrate
ambient fill against the baked contribution so the combination retains depth.
Set exposure from the actual garden-to-workshop route. The foyer is the first
comparison for baked light, playable lighting and frame cost.
Progressive path tracing is an option for stationary reference and inspection.

The exterior distance fog now starts at 24 metres and reaches full effect
at 124 metres. The Blender headlands separate the water, coast and far
landmarks. Keep the haze matched to the sky at the horizon and nearby paths,
signs and avatars clear. For the Beacon, lamp filaments and portal edges, test restrained
glow driven by emissive materials with a high luminance threshold. Preserve the
value contrast of plaster, bright windows and HUD text. Measure the two effects
independently from the same moving camera and keep a lightweight presentation
for touch devices where a full-screen post-processing pass costs too much.

| Release area | Build and verify in the existing world |
| --- | --- |
| **Commons, paths and garden** | [#3](https://github.com/AlterMundi/holodeck/issues/3), [#8](https://github.com/AlterMundi/holodeck/issues/8). Rebuild the visible legacy scenery in Blender in place. Stage the arrival, garden and neighborhoods as connected districts with sightlines from the real spawn. Keep routes, player clearance, terrain/collider agreement, exact existing placements and creator permissions. Qualify the actual walk and transition cost on desktop and a phone. |
| **CompAII house and small exterior** | [#7](https://github.com/AlterMundi/holodeck/issues/7), [#9](https://github.com/AlterMundi/holodeck/issues/9), [#10](https://github.com/AlterMundi/holodeck/issues/10). Use the same silhouette, roof proportions and material family for the parcel-scale version and full architectural source. Make the threshold, atrium and stair readable from both directions. Author the foyer, park, lower workshop and upper rooms in Blender. Qualify entry, navigation, expansion, denied-room exclusion, reconnect and exact exterior return. |
| **Harmonic Beacon workshop** | [#12](https://github.com/AlterMundi/holodeck/issues/12). Retain the pinned guitar prototype bench. Give Spatializer and Weaver distinct working stations with spatial anchors, project labels, actual readiness, existing authorization and a visible return. Bind to their own interfaces after authenticating the intended receiving route. The current maintained local lab and audio routes are real tooling. Their private or loopback URLs cannot serve as a shared Holodeck link. Check safe software control and observed effect first. Preserve the owning operator, device state and explicit actuation. |
| **Walkable 3D collection** | [#4](https://github.com/AlterMundi/holodeck/issues/4), [#12](https://github.com/AlterMundi/holodeck/issues/12), [#15](https://github.com/AlterMundi/holodeck/issues/15). Provide an active workbench for drafts, a finished exhibition and an archive that can reopen old editions. Use the owning Homes/Nexus status and exact versions. Place at least one authorized actual 3D creation in each state, with useful titles and room-scale context. Visitors inspect the same edition in the existing viewer and return to the same place. Keep draft and restricted models outside unrelated projections. |
| **HUD and creator tools** | [#2](https://github.com/AlterMundi/holodeck/issues/2), [#3](https://github.com/AlterMundi/holodeck/issues/3), [#15](https://github.com/AlterMundi/holodeck/issues/15). Use a small place plaque, a restrained action dock and one contextual affordance. Keep the camera, joystick and touch actions clear. Establish one reusable kit of collision-checked modules, furniture, anchored tools, signs and playable objectives. An eligible creator uses their own identity to preview, publish, revise and recover a spatial creation; a visitor can find and use it. |

First finish a short sequence from the garden, past the small house façade and
through the warm threshold to a working Beacon bench. The
[clean-sheet source and review](../art/compaii-house/redesign/) sets the starting
architecture and its original lighting and material palette. Use the same finished
roof silhouette and entrance proportions in the miniature and house. Carry the
established visual language through the commons and the separate gallery once
that sequence works. Give the gallery a quieter pace with framed views and room
to stop at a work without blocking the route. Compare previous and new versions
at matching player height, camera, route, resolution and device. Check arrival,
facade, threshold, workshop reveal and station in motion and as stills, with and
without the HUD. Check grayscale value separation, recognizable silhouettes,
lighting direction, avatar/camera clearance, touch input and shared circulation.
Reconfirm the released route with independent browser identities and simulated
inputs. Record technical results and any voluntary participant feedback separately.

The [arrival directory and route markers](../art/compaii-house/redesign/commons-wayfinding.md)
now give the existing plaza a readable first turn. Packaged desktop and
touch-emulated players took the east promenade into the garden. The
[authored house walk](../art/compaii-house/redesign/house-walk.md) now
makes the turn from the public aisle to the Casa threshold legible.
The [parcel terrace](../art/compaii-house/redesign/parcel-terrace.md)
carries the neighborhood's visible perimeter to the waterline. Chromium
walked the public approach, used the foyer door in both directions and
reached the west verge at the existing floor height. Continue the terrain
surface and workshop finish pass on the same route, particularly adjoining
islands, the house yard and workshop floor and wall joints.

The selected archive stores the 13 atelier GLBs losslessly and leaves
6,653,952 bytes below the existing receiver limit. The matched Chromium
route transferred 43.6% fewer bytes for selected exterior models and
35.2% fewer for the foyer, gallery and Beacon lab. Retain the exact
decoded GLBs, revisioned URLs, identity ranges and authorization on
both asset paths during the next furniture and terrain pass. Measure
frame pacing separately from transfer size. A 6.4 Mb/s Chromium trial with
80 ms added latency rendered the Beacon lab in 2.92 s on first entry and
0.92 s on revisit, saving a second 1.61 MB model response. The checked
previous Brotli package took 2.98 s to render the revisit. Continue exact
first-visit qualification and frame pacing across the remaining routes.

### Finish the architecture and props in the running game

Nicolás observed better light and textures and identified three still-open
quality defects: unfinished objects, openings that look accidental and too
little spatial detail. Inspect the authored Blender scene and its packaged
WebGL export at walking height, close up and in motion. Walk each threshold
both ways, look back from each landing, and inspect the back and underside of
objects the player can walk around. Close unintended gaps, exposed backs and
light leaks at floor, wall, stair and roof joins. Give intentional openings a
recognizable purpose, frame or view and keep collision aligned with the visible
edge. Check contact shadows and surface scale after geometry changes.

Start with the [foyer](../art/compaii-house/redesign/review/foyer-baked-light.jpg)
and [Beacon room](../art/compaii-house/redesign/review/beacon-light-after.jpg).
The foyer's broad bare wall and plain table carry little information about the
house. The Beacon benches still read as generic furniture despite their
different tools. Give the entry a usable place to pause and orient, detail
the benches around their actual controls, and resolve exposed joints at the
stair and lower landing. Continue through the miniature, exterior paths,
gallery and tower with the same standard. Use scale, joinery, hardware and
purposeful work objects to carry the detail while leaving the route and
interaction targets clear. Compare matched before/after captures in the
browser and verify clearance, transitions and frame cost on the revised route.
Track the work in [world art #3](https://github.com/AlterMundi/holodeck/issues/3),
[interior #9](https://github.com/AlterMundi/holodeck/issues/9) and
[working house #12](https://github.com/AlterMundi/holodeck/issues/12).

Use a participant's stated avatar presentation as their default when available.
Bind it to their authenticated identity, keep it changeable by that participant,
and share only the chosen appearance through world presence. Keep distinct
automatic appearances for participants who have yet to set a preference.

Keep editable Blender sources and a reproducible, glTF-validated export. Record
catalog provenance and redistribution rights. Prefer geometry instances, few
material batches, baked detail and bounded room-local lighting. Keep collision
simple and separate, and qualify it against the art. Set per-cell budgets from
the known 0.8 MB / 21k-triangle workshop baseline and measure the first frame,
warm crossing, worst visible cell, draw calls and physical-device frame pacing.
Keep a compatible predecessor and a bounded cache of authorized revisions.
Carry tool/object selection into the continuing Conversation without stalling
the world. Sensorial and later embodiments build on the same room and tool
contract under their own source access and device authority.

## Reuse and boundaries

| Authority | Reuse | Remaining integration |
| --- | --- | --- |
| Holodeck Room + MML/Three | Authoritative semantic actions/events; networked walking, collision and presence; native result/game nodes; public spatial map | House namespaces, private space projections, larger interiors and capacity for all eligible members |
| Homes | Stable resource identity, exact version reads, existing access and protected service publication | Independent review/published selections remain a delivery-lifecycle proposal; current bytes must not silently become a release |
| Nexus | Immutable context inventories, exact sources, recursive exploration, independent perspectives, notes/work and report/video/3D/context visits | Actual situated human review; source execution through existing #47/#49; native source access under each being's authority |
| Conversation | Text, transcription/audio, files, originals, recovery and countdown cues through direct shared surface | Actual situated comment and matched continuing reply in ordinary shared use |
| collective-research / Stash | Selected source intake, evidence, attributed assessments, bag-specific reasons | Existing shared-reference/intake work; corpus per-document audience is not implemented |
| Matrix / Cluster / DMK / Integrators | Identity/social authority; bodies/resources/effects; personal situated uptake; sensory producers | Preserve separate ownership, private memory and explicit device authority |

Spatial adjacency is not a support/contradiction relation. Knowledge graphs and source history stay with their providers. Room's recent events are not permanent knowledge history. A visible portal never grants source access. No second chat, source registry, world per daimon or master Project is required.

## Delivery sequence and cards

The roadmap stages retain their individual exit evidence. For Holodeck,
Nicolás directed continued implementation and delivery using independent
simulated participants, device emulation and simulated inputs to qualify the
full situated Conversation, shared play and device experience. Direct use
remains separately attributed when observed. See [current evidence](STATUS.md).

| Stage | Owning cards and dependencies | Exit evidence |
| --- | --- | --- |
| 0. Complete the current situated encounter | Holodeck [#1](https://github.com/AlterMundi/holodeck/issues/1), [#4](https://github.com/AlterMundi/holodeck/issues/4); Nexus existing shared-participation/review work | An independently authenticated fixture opens the pinned Field view, selects an exact target, comments through canonical Conversation, keeps moving, receives the continuing reply and recovers the reference after reconnect. Earlier shared walking/light evidence is retained; do not repeat generic login trials. Housing engineering continues independently. |
| 1. Establish house authority and public geography | House epic [#7](https://github.com/AlterMundi/holodeck/issues/7), authority [#8](https://github.com/AlterMundi/holodeck/issues/8), declarative authoring/catalog [#15](https://github.com/AlterMundi/holodeck/issues/15), persistence [#11](https://github.com/AlterMundi/holodeck/issues/11) | Stable owner and explicitly granted paired-human authoring; reserved plots/corridors; complete-footprint and fresh-ID foreign-publication refusal, including engine maintainer. |
| 2. Make one larger interior safe to inhabit | Spaces [#9](https://github.com/AlterMundi/holodeck/issues/9), private projection [#10](https://github.com/AlterMundi/holodeck/issues/10), #8/#11 | Atomic space/portal/presence transitions, local coordinates, exact shared referents, public return/reconnect, audience filtering before geometry/catalog/activity/native/cache/export. Permitted and denied source reads under independent identities. |
| 3. Finish one meaningful house encounter | [#12](https://github.com/AlterMundi/holodeck/issues/12), existing [#2](https://github.com/AlterMundi/holodeck/issues/2)/#4; stages 1–2 | Authored exterior, larger workshop, real creation; two independent perspectives; comment, correction, next draft, deliberate published selection and old-edition revisit. Guest cannot publish inside owner house. |
| 4. Make iteration produce real work | Nexus [#47](https://github.com/compaii/daimon-nexus/issues/47), [#49](https://github.com/compaii/daimon-nexus/issues/49); collective-memory [#2](https://github.com/compaii/collective-memory/issues/2); Stash [#10](https://github.com/compaii/wiggle-stash/issues/10)/[#14](https://github.com/compaii/wiggle-stash/issues/14)/[#15](https://github.com/compaii/wiggle-stash/issues/15) | One real research/provider change and one repository/test-backed software change; retain exact source effects, rejected/stale assessments, uncertain effects and both editions. Shared object identity and separate reasons survive intake. Corpus access requires scoped selected derivatives while [per-document policy #7](https://github.com/compaii/collective-memory/issues/7) is open. |
| 5. Populate every eligible member’s expressive home | #12, quality [#3](https://github.com/AlterMundi/holodeck/issues/3), stages 1–3 and measured #11 capacity | Every current eligible being has actual own-body authoring/update/recovery; seven routes are a dated first cohort; two independent browser identities on desktop and emulated touch; attractive recognizable houses, legible paths, sound/animation, cooperative activity and measured loading/frame time/reconnect. Record player-height visual evidence and device coverage. |
| 6. Extend presence to headsets | [#13](https://github.com/AlterMundi/holodeck/issues/13), stage 5 | Same references/actions, native projections, accessible alternatives and actual headset performance/comfort trials. This is not required for initial turn-based participation. |
| 7. Bring selected physical places into the situation | #13 + existing Integrators/Cluster, stage 6 where headset-dependent | One selected QR/marker station with consistent event/scoring state; then richer mapping only after drift/relocalization, stale samples, consent, retention and revocation qualification. Measured/recorded/inferred/simulated observations retain producer, time, frame and accuracy. Discovery does not authorize capture/control. |

[Engine operator access #14](https://github.com/AlterMundi/holodeck/issues/14) runs alongside these stages: Oliva must use her own existing receiving identity to inspect selection/rollback, publish/select a qualified engine package and verify exact health/served bytes. This already authorized technical repair is separate from publishing everyday content. It creates neither divergent worlds nor foreign-house rights. Do not make it a prerequisite for every creation.

## First implementation increment

The [house exterior foundation](houses.md) is deployed on the existing shared
world. Eight reserved plots connect to the arrival plaza. Verified daimons
claim and publish their own bounded facades through the existing native act
route. The durable checkpoint and address survive game reset. A controlled
browser walked from the arrival plaza to a published test facade and back.
Live checks refused foreign and oversized submissions without creating a house.

Next, #9 and #10 introduce a server-authorized active space binding for both
geometry and presence, with explicit safe exit and reconnect anchors. The first
indoor map should work as a connected game level. Start with a foyer, gallery
and lower lab, distinct rooms with a real object, a pinned Nexus exhibit and
one scoped software control. Capture those references in Conversation so the
discussion survives movement. The authoring model supports room identities
across levels above and below ground and internal portals to further cells.
The full map can grow over time with bounded loaded views and durable catalogs.

## Durable places, expressive authoring and source-safe navigation

The room-boundary increment adds separate authorized room geometry and avatar presence, room-scoped own-native observation, and explicit moves between floors and portals. The first facade and foyer have matching exterior door anchors. Interior doors, stairs and portals have paired in-world approaches and per-visitor geometry. The first working house uses a pinned Nexus exhibit authored from an existing owned result. It still needs its working control and situated Conversation with the original object and room reference. [House and room contract](houses.md).

A house's world/place ID, owner, parcel, exterior revision, interior and return anchors are durable definitions in this same service. They are distinct from a resettable game run, active entity projection and participant visit. Current Room.resetNow clears nodes; simply using that list would destroy long-lived house addresses. #8/#11 must preserve addresses and selected pointers across play resets, tested against scoped copies rather than a destructive live reset. A public index plus pageable owner-authorized catalogs separates retained creations/versions from bounded active geometry. All creations need not be live meshes or consume eight result slots.

[#15](https://github.com/AlterMundi/holodeck/issues/15) owns the normal declarative creator interface: plot discovery, preview, authored exterior/furnishings, interior shelf/portal, update, explicit promotion/withdrawal and observed-result inspection. Use validated shapes/templates and immutable allowed Home assets. Bound bytes, triangles, dimensions, texture/material counts, colliders and draws; denied assets receive a neutral representation without disclosing the subject. Keep editable originals with their owners and arbitrary executable code/HTML/remote URLs outside shared content. Two genuinely distinct owner-authored results qualify expressiveness better than seven renamed copies of one template.

Oliva's [PR6](https://github.com/AlterMundi/holodeck/pull/6) is merged and selected in the shared engine. The real protected edition is associated in Nexus. [Nexus #126](https://github.com/compaii/daimon-nexus/issues/126) tracks source-Home authorization. The protected model has since rendered through the exact pinned Nexus visit in Chromium under independent CompAII access. Oliva’s own placement and the visit from the live world node are separate receiving checks. The packaged figure is an authored representation example. Declarative creation for houses and their contents remains #15.

Nexus table access currently protects a complete snapshot, not every embedded source. For the first house select a snapshot whose text, titles, locators, relations and aggregate information may be disclosed to every selected table reader. Restricting an iframe alone cannot sanitize a copied snapshot. Mixed-source tables require source/derivative policy, current-principal filtering and a defined rule when source grants narrow. Test counts, cached thumbnails, joins, native observations and Conversation attachments as well as direct URLs. No table/corpus grant widening to make a demonstration pass.

Accessible nonspatial entrances are first-class: list/search/ASCII views and copyable exact links reach the same permitted graph/results as walking. Preserve independent perspectives, conflicting evidence, attributed reasons, missing/unreviewed regions and source corrections. Geometry communicates location; it cannot establish corroboration or erase uncertainty. A visit may continue on edition A while a public doorway is deliberately promoted to B.

## Product choices and provisional defaults

These questions stay with the owning cards. None currently requires a new human-only action to begin engineering; ask when a concrete next outcome depends on that choice.

| Question | Useful first default and boundary |
| --- | --- |
| Who sees the common map, house existence and labels? | Preserve the current protected world audience. Public terrain within it does not mean public-internet readership. Only deliberately safe outward metadata is discoverable. |
| How are optional plots allocated, resized or relinquished? | Server-reserved non-overlapping bounded plots with protected reachable paths. Resizing/abandonment policy follows actual need; no land market. |
| What can the paired human or a guest author? | Only an explicit fresh paired-human grant enables house authoring; retain the actual performer. Guests can visit/comment/play through their relevant rights, never gain publication by proximity. Temporary collaborative placements need a separately designed permitted area. |
| What happens after source access narrows or a pin is withdrawn? | First use uniformly audience-compatible snapshots. Preserve access checks on old pins; show a useful unavailable state and return path. Specify derivative continuing-access before mixed-source/private publication. |
| Which doorway follows a release, and which pins an edition? | Deliberate published-link promotion with expected revision; draft shelves and exact discussion pins remain distinct and recoverable. |
| Which aesthetic primitives and world scale matter first? | Two genuinely different authored houses, judged by participants at player height; use measured populated phone/PC loads to size expansion. |

## Reviewed ownership and receiving responsibilities

Holodeck implementation owns #7–15 and existing #1–4. Nexus owns its context/view/review/execution cards; Conversation owns recorder/original transport; source providers retain their intake and access writers. These are component responsibilities, not an assignment or claimed acceptance by another being. Field Project13 indexes dependencies once. Engine operation #14 remains with the existing Home/Cluster writer. Keep a finite per-being acceptance row with house, authentic author, selected result/revision, own update, foreign-write refusal, visitor open and exact effects; mark missing adoption/human feedback honestly.

## Evidence and source continuity

Already delivered: exact context-v3 visits in Holodeck/Nexus, strict pin and acknowledged-view handling, retained draft/frame return, current Field snapshot portal and compatible code predecessor. The Field portal's 22 November capture contains 62 selected Project cards, represented as 125 nodes/124 explicit relations/125 sources. It is a fixed capture, not a claim of live synchronization; later roadmap cards require an explicit successor capture. October's snapshot remains available.

Source review: Holodeck 0cd1868, Nexus 08ba4ad (PR125 merged 39e4515), collective-memory 8d90593, Stash 335e17e; Field D002–D004/D010–D016 and R001. The review preserves D011 stewardship, D012 complete inventories/coverage gaps, selected personal DMK uptake and federation research as their own work. Historical “general context iframe proposed” statements are superseded by PR125; generic delivery lifecycle remains proposed. Nexus has 14 application rooms; 43 SQL schema tables is a different count.

Astra's independent review found that existing Room.capture/nodeState project room-wide data, current fresh-ID placement does not enforce future parcel ownership, and a native pin does not establish source-reading rights. These findings became #8/#10 rather than optimistic assumptions. The additional evaluation found reset-scoped addresses and eight-node catalogs unsuitable for durable houses, and called for declarative authored assets, nonspatial parity and explicit mixed-source policy. These findings became #15 and amendments to #8/#10/#11/#12. The recommendation to prove one house/two actors before scaling is the sequence above. No new engine or renderer replacement was justified.

Keep source implementation, selected receiving bytes, own-identity effects,
model uptake, fixture behavior and direct participant feedback distinct.
Holodeck can proceed using qualified simulations. Use fixture authors for
simulated originals and preserve authenticated human provenance where it exists.

## Current membership versus receiving coverage

On 22 November the signed Matrix roster reports eight active beings, including
Emma. The earlier seven native routes and fourteen App audience entries are
the first cohort. The owning Home writer added Emma's being to the existing
App audience while preserving all fourteen prior entries. Holodeck then
selected her eighth fixed own-native lane, with the other lanes retained.

Capacity and acceptance (#11/#12) cover **each current eligible being**, and later additions through the existing admission/selected-rights path. Keep one finite row per verified identity with membership observation, App access, native route, authentic creation/update, foreign-write refusal and independent visitor acceptance; missing is not successful. Do not demand new onboarding or halt independent house engineering because this route is missing. Reconcile membership afresh at a deliberate release/acceptance checkpoint; no polling is introduced.

Emma's authenticated guest-body CLI observed the live room as her own being.
The qualification applied and cleared her indication on the exact Field node
revision. Her direct creator command reached the node placement guard and
was refused because the selected ID already existed. Exact receipts were read
back by command ID. This qualifies own-identity access, reversible mutation
and the placement guard. Durable publication of a creation and independent
visitor acceptance remain open. See
[creator acceptance #12](https://github.com/AlterMundi/holodeck/issues/12).
