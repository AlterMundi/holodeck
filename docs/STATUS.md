# Current MVP work

## November 26 gallery deck contacts

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `de23bdf98e78`
from `da0a322`. The three permanent gallery decks now seat the exact
edition model from its rendered geometry. A small soft contact mask
follows its supports at the deck. Revoking or expiring access removes
the exhibit and its shadow together. The mask uses one transparent
draw per visible exhibit in either graphics preset.

Compared three identical camera poses at 980 × 620 with physical RTX
2060 Normal and Pi 5 V3D Livianos. The archive ring's contact is visible
on both. RTX frames stayed at about 16.7 ms. A warm Pi repeat had the
same p95 at all three poses (33.4–50 ms), with the archive median moving
from 16.7 to 33.3 ms. An earlier Pi run had a transient overview stall
that did not recur in the warm repeat. The protected owner and limited
visitor were controlled Chromium identities. The owner saw three
editions, the limited visitor fetched only the published one, and a
revoked archive disappeared. Independently signed-in participants
remain unverified for the installed gallery.

Node 24 passed 426 checks with two optional skips. Only the client
bundle changed. Receiving matched 86 files and 13 protected HTTPS
reads, four expected denials, unchanged audience and configuration,
and world sequence 463 before and after. Immediate rollback remains
`9281853a628a`. See [working house #12](https://github.com/AlterMundi/holodeck/issues/12).

## November 26 object identification notice

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `9281853a628a`
from `f986646`. A short primary gesture must hit a visible eligible
world object before an unconfirmed projection can produce the four-second
retry notice. A blank or occluded hit stays quiet. The existing check
still prevents stale records from opening a visit or selecting an
object. The reduced-motion setting uses the same deadline with no fade.

Matching prior and current browser packages ran on physical Pi 5 V3D
Livianos at 390 × 780 with touch emulation and RTX 2060 Normal at
1200 × 740 with mouse and reduced motion. Both prior builds showed the
notice on a blank hit during a controlled projection mismatch. Both
current builds kept blank hits silent and cleared the eligible retry
after 4.01 s and 4.00 s, respectively. The mismatch and target were
introduced in the loopback test fixture. The physical Redmi and a
shared session with two signed-in visitors remain open.

Node 24 passed 423 checks with two optional skips. Only the browser
bundle changed. Receiving matched 86 files, 13 exact protected HTTPS
reads, four expected denials, the same App audience and configuration,
and the same world run at sequence 463. Immediate rollback is
`4d87ebe3a88d`. See [HUD #16](https://github.com/AlterMundi/holodeck/issues/16).

## November 26 ground gait and supported turns

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `4d87ebe3a88d`
from `13b1c78`. Humanoid jog and run phase follow rendered travel, with
a continuous handoff to the remaining animation blend. The
[physical motion checks](character-motion.md#humanoid-ground-gait-follows-rendered-travel)
cover straight jog and sprint, a wide turn and a downhill leg on RTX
Normal and Pi 5 Livianos. A second fixture identity also observed the
gait in the shared world. Independently signed-in visitors, uphill,
interior thresholds and precise tight-pivot contact remain open.

The same Home owner key was accepted after the signed proof caught up.
Receiving matched 86 files, 13 protected asset responses, four expected
denials, the same audience and configuration, and the same world run
at sequence 463. The rollback package is `bf4886aafe4e`.
See [motion #21](https://github.com/AlterMundi/holodeck/issues/21).

## November 26 landscape touch map

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `bf4886aafe4e`
from `49d8aed`. The short touch landscape map uses the existing spatial A2UI surface. The
plot and controls sit side by side, and the map temporarily takes focus
from the dock while it is open. The topography, circular and square
formats, and room destination actions use their existing data. Rotation
keeps the selected map format and the current destination page. The map
can be moved in landscape. Its resize affordance returns in portrait
and desktop, where the saved placement is separate.

At 568 × 280, the exterior map grew from 95 px to 475 px wide and
its button plates from 11.4 to 44.0 CSS px high. The desktop comparison
at 1200 × 740 measured the same window in both builds and exercised
keyboard move, resize, Escape and the focus return. Physical RTX 2060
Normal and Pi 5 V3D Livianos each passed touch format changes, both
orientations, dismissal, room pagination, destination selection and the
resulting guidance in an emulated touch viewport. Redmi and Telegram
WebView acceptance, and a joint session with independently signed-in
visitors, remain open.

The suite passed 418 checks with two optional skips. Only the browser
bundle changed. Protected receiving matched 86 files, four expected
denials, the existing audience and configuration, and the same world run
at sequence 461. Immediate rollback is `e2b318f4b262`.
See [HUD #16](https://github.com/AlterMundi/holodeck/issues/16).

## November 26 arrival trail verge

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `e2b318f4b262`
from `3d77414`. A broken verge of worn vegetation and exposed soil
softens the transition between the compacted trail and meadow. The apron
still uses the existing flagstone surface. On RTX Normal, all 14 Sand3D
instances were grounded against the analytic terrain in three existing
batches. Pi 5 Livianos rendered the verge without a Sand3D download.

Controlled walks used the same initial view. RTX Normal at 1200 × 740
measured 16.8 → 16.8 ms frame p95 at night and 33.3 → 33.4 ms on the
day replay. Pi 5 Livianos at 363 × 244 measured 33.3 → 33.4 ms frame p95
on the day replay and 16.50 → 16.74 ms GPU p95. Both held a 16.7 ms
frame median. Standing GPU timings varied more across these short runs,
so they do not establish equivalent GPU cost. Independently signed-in
visitor acceptance is open.

The suite passed 417 checks with two optional skips. Receiving matched
86 files, four expected denials, the existing audience and world run
through 458–459. Only the browser bundle changed. Rollback is
`6affd43be714`.

## November 26 offshore water and night reflection

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `6affd43be714`
from `1ddb98a`. Water uses filtered surface slopes in multiple directions
instead of painting the offshore wave height into its color. Normal uses
a three-dimensional field, and Livianos uses a cheaper projected field.
The new cool night reflection fades across the waterline. Existing
shore transmission and underwater rendering were qualified from the
same fixed cameras. Reflections represent sky illumination.

At 1200 × 740, the controlled RTX 2060 dusk flight sample held 16.7 ms
frame p95 before and after. GPU p95 was 10.22 → 10.34 ms. On Pi 5
Livianos the initial 363 × 244 night intervals were variable. The
consecutive baseline and final-candidate repeat measured 33.4 → 33.3 ms
frame p95 and 15.09 → 15.11 ms GPU p95. Both had 16.7 ms frame median.
The night shore's sampled water crop increased from 21 to 24 on an
8-bit grayscale scale. Draw and triangle counts stayed the same.

The suite passed 417 checks with two optional skips. Receiving matched
86 files, existing access, and the same world run through 456–458.
Only the compressed browser client changed. Rollback is `394ab30b12c6`.

## November 26 Shift, Alt and Space controls

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `394ab30b12c6`
from `6da6c2c`. Shift runs and boosts, Alt crouches, descends in flight
and dives, and Space jumps or rises. The same Alt descent applies at
the Matter worktable. Ctrl is no longer a locomotion modifier. The
existing fullscreen keyboard-lock route is still separate from movement.

Physical RTX 2060 Normal and Pi 5 Livianos browsers checked the mapping
on ground, actual dive and ascent in water, airborne height changes and
the gold/teal boost wakes at 25.07 and 25.01 m/s. The 417 passing checks
include tabletop input with two optional suite skips. These are controlled
single-visitor fixtures. Receiving matched 86 files, the existing audience
and world run through 452–454, and four protected denial checks. Immediate
rollback is `49acf79b2a04`.

## November 26 cave rock contacts

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `49acf79b2a04`
from `e7bf7e9`. The outer rock and spire bases borrow the local soil
palette. The buried spire ring widens away from the trail. The tunnel's
collision positions are byte-identical. The same mesh still draws and
blocks each spire. The pass adds no draw call or triangle.

The controlled browsers used the retained night entry coordinates.
RTX 2060 Normal and Pi 5 Livianos showed a softer tint near the contact.
The projecting corner still reads sharply at night. The Pi samples
used identical 363 × 244 render buffers and measured 16.7 → 16.8 ms
frame p95. RTX showed 16.7 → 16.7 ms, with adaptive resolution selecting
1020 × 629 and 1200 × 740 respectively. These are short single-visitor
fixtures. The suite passed 417 checks with two skips. Receiving matched
86 files, the same audience and continuing world run (450–451), and
four access denials. Immediate rollback is `a10436594c96`.

## November 25 aerial depth, transparent shores and boost wakes

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `a10436594c96`
from `9eef355`. R in exterior flight targets 25 m/s, compared with the
8 m/s ground run. A bounded particle draw emits separate human and
companion colors for continuous fast flight. Reduced-motion settings
suppress the effect. The motion solver samples intermediate capsule
positions against existing colliders before reporting the final contact.

Exterior haze accumulates with distance. The solar and particle glows
are local to their shaders. Distant water keeps screen-filtered surface
bands and sky reflection. Near shore the terrain's signed depth drives
transmission and a soft contact edge. Deep tiles retain their opaque
pass. Matched daylight views show the updated shore from above and the
existing submerged scene from below.

In controlled physical browsers, boosted speed was 25.12 m/s on RTX
2060 Normal and 25.22 m/s on Pi 5 Livianos, with both colors emitting
and frame p95 16.8 ms in both short samples. The full suite passed 417
checks with two skips. Receiving verified all 86 files and the same
world run and permissions through sequences 444–446. Only the browser
payload changed. Immediate rollback is `f647d674febf`.

A follow-up used the same package and camera at dusk on RTX 2060 Normal
and at night on Pi 5 Livianos. The dusk shore shows a gradual transition.
Night still loses much of the nearby shoreline shape and material detail,
and broad wave bands remain conspicuous across the dusk water at a
distance. Both fixtures rendered the submerged view and reproduced the
two local wake colors at 25.67 and 25.19 m/s, with short-run frame p95 of
16.7 and 16.8 ms respectively. The different clocks and graphics profiles
make these independent observations. The fixtures did not use separate
visitors. See the [background focus experiment](environment-art-revamp.md#background-depth-of-field)
for a separate candidate that keeps interface rendering sharp.

## November 25 Harmonic Lab and Listening Tower wall alignment

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `f647d674febf`
from `6414e66`. Three wall planes in Harmonic Lab and three in the
Listening Tower now use the measured room-facing lining. The existing
Lab landing and Tower clerestory clearance keep their prior dimensions.
The selected Matter shell and owned room kits already tracked the generic
perimeter closely at walking height.

RTX 2060 and Pi 5 controlled clients walked into all three adjusted Lab
walls and returned to the foyer. They also entered and left the Tower
through the original Gallery route in a separate fixture. The stationary
Lab sample measured 16.8 ms p95 on both. The installation verified all
86 payloads and the existing access and world run. Only the compiled
server changed. Immediate rollback is `ea2efd93199d`.

## November 25 visible room boundaries and object leaders

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `ea2efd93199d`
from `2d56daf`. The foyer and gallery perimeter use the measured
room-facing planes of the packed art. The MML cubes and cylinders reserved
for collision participate in physics without submitting visible
geometry. The nearby prompt now sits below normal standing eye height,
moves beside the avatar, and draws a fine gold leader to the object.
A separate wall between the camera and the object suppresses the prompt.

RTX 2060 and Pi 5 controlled browser trials hit all four foyer collider
planes, stopped the avatar short of the north wall, opened all four
Harmonic Lab consoles with E, and returned to the foyer from the Lab
and Materializer. Both devices also opened Character Studio from the
foyer and returned through its own link. The unit tests cover occlusion and exact leader
endpoints. The suite passed 415 checks with two skips. Receiving
verified all 86 files, the same access and continuing world run
through sequences 436–438. Immediate rollback is `0981468421fe`.

## November 25 woodland across the inner arc

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `0981468421fe`
from `b086c86`. Six seeded inner stands add 334 rooted conifers.
One opaque canopy batch uses the sky's daylight palette at range.
The same roots become detailed trees with trunk colliders up close.
The terrain worker uses the same footprint for the forest floor.

The west overlook and near-grove daylight views show the new canopy on
RTX 2060 Normal and Raspberry Pi 5 Livianos. The two fixed overlook
headings held p95 at 16.7–16.8 ms with one additional draw and 6,680
triangles. The final near-grove shot used adaptive resolution on RTX.
These were controlled browser views. The suite passed 415 checks.
The live client and terrain worker matched, access and world sequence
435 were preserved, and `251ab9f928e8` is the immediate rollback.

## November 25 evergreen woodland along the arrival meadow

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `251ab9f928e8`
from `ebc4140`. The arrival meadow and southern ridge now share a
woodland field for 883 deterministic evergreens, darker forest floor
and thinner grass. Both profiles use the same roots and nearby trunk
colliders. Three opaque canopy meshes change detail with distance.
The outer route and cave entrance keep their existing terrain.

Daylight captures at four fixed views and an 11 m walk at the forest
edge held p95 at 16.7–16.8 ms on RTX 2060 Normal and Pi 5 Livianos, in
the same range as the prior build. The walk added three draw calls
and about 56k–66k rendered triangles. A separate airborne hover showed
the canopy at 16.7 ms on RTX and 16.8 ms on Pi. The browser fixtures used
controlled identities. The suite passed 414 tests with two skips.
Receiving matched 86 files and preserved the existing access,
configuration and world sequence 433. Immediate rollback is
`49c78e382a09`.

## November 25 dry ridges and sheltered meadow

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `49c78e382a09`
from `e93d8a0`. One periodic moisture field gives the ground and grass
the same dry or sheltered character across the torus. Terrain elevation,
shore and trail rules, and the authored banks retain their existing paths.

Matched daylight cameras at arrival, a dry ridge and a sheltered fold
held stationary p95 at 16.7–16.8 ms before and after on RTX 2060 Normal
and Raspberry Pi 5 Livianos. The suite passed 412 tests with two
skips. Receiving matched 86 files and preserved permissions, configuration
and world sequence 433. Immediate rollback is `9bfd9248797b`.

## November 25 world labels and E at Harmonic Lab worktops

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `9bfd9248797b`
from `5e63550`. Each available Harmonic Lab worktop uses the shared
world-positioned label. E opens the existing panel for the current station.
Doors and the Materializer retain their existing shortcut priority. The
label hides during the panel and respects scene depth. The compact
desktop layout places the existing station controls above the label area.

The exact RTX 2060 and Pi 5 fixtures opened all four workstation panels
with E, typed E into a focused text field without opening one, returned
to the foyer and verified denial of the departed room art. The classic
interior path was also checked for keyboard opening and closing before
the compact native HUD adjustment. The suite passed 411 tests with two
skips. Only the browser payload changed. Receiving matched all 86 files,
the existing permissions and configuration, and world sequence 433.
Immediate rollback is `edb3654520af`.

## November 25 Shaper worktop and Weaver Instrumento route

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `edb3654520af`
from `284c3d0`. The Shaper console opens the existing body-service card
in [Harmonic Lab](https://compaii.dmn.homes/harmonic_lab/), revision
`02ed23e92610`. Its ready interface opens the existing Instrumento tab.
The paired Legion has the exact frontend bundle `f5a270c2a337` from
Harmonic Weaver `e94db5f`, with the previous dist retained. No instrument
start was submitted during placement of its static build. The body service
was idle, so its actual runtime status and human use remain unverified.

Controlled RTX 2060 Normal and Pi 5 Livianos browsers verified the stair,
Shaper collider, selected panel, explicit ready link and Instrumento view.
They made zero start, configuration or device requests and returned to the
same avatar position. Both exited to the foyer and received 404 for the
departed room art. Stationary samples on both devices had a 16.7 ms median.
The suite passed 411 tests with two skips.

Receiving matched 86 Holodeck files, the existing access and configuration,
and world sequence 433. The two service rollbacks are Holodeck
`0bbaf60eb737` and Harmonic Lab `aab865b842c8`. Continuous movement
among all worktops and real signed-in instrument acceptance remain open.

## November 25 Guitar worktop and focused Laboratory route

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `0bbaf60eb737`
from `16911a6`. The modeled Guitar worktop opens the focused Guitar card
inside the existing Laboratory window. [Harmonic Lab](https://compaii.dmn.homes/harmonic_lab/)
serves `aab865b842c8`, with the focused route from Harmonic Weaver
`4fb4462`. It retains the same selected receiver, access and separate
instrument-start control.

The controlled RTX 2060 Normal and Pi 5 Livianos browsers descended the stair,
checked the new collision, opened the Guitar card, read simulated stopped and
ready status, returned control at the same avatar position and exited to the
foyer. The fixture denied the guest request and submitted zero start requests.
Three matched Pi samples kept a 33.3 ms median and p95 around 50 ms on both
builds. The suite passed 411 tests with two skips.

Receiving matched all 86 Holodeck files, retained world sequence
433, and kept the existing access and configuration. The first
install attempt ended when Home Access hit its memory cap. The same
retained request completed after the service recovered. Immediate
rollbacks are `179364d0f9fc` for Holodeck and `87df9184488a` for the
Laboratory panel. The panel kept its three verified files, alias and
selected audience. Live instrument readiness and human acceptance
remain untested. Shaper remains an optional visual study.

## November 25 Harmonic Lab floor and return lighting

[Holodeck](https://compaii.dmn.homes/holodeck/) serves `179364d0f9fc`
from `d26bd46`. Six turquoise interference lines mark the floor near the
Beacon. Dark acoustic surfaces continue to the stairs, where the lighter
treads and lit doorway distinguish the return to the foyer. Both permission
variants use this finish and retain the existing stair and station geometry.

Controlled browsers completed the foyer–laboratory round trip on RTX 2060
Normal and Pi 5 V3D Livianos. The scoped art returned 404 after leaving.
Matched stationary frame samples retained a 16.7 ms median on both and p95
values of 16.7 and 33.4 ms respectively. Both GLBs add 768 triangles and the
full package is 102,400 bytes smaller. The Holodeck suite passed 411 tests
with two skips. Receiving matched 86 files, the existing access and
configuration, and world sequence 433. Immediate rollback is `d7b3b73478fa`.

The [next two station placements and their owning panel routes](shared-roadmap.md#harmonic-lab-as-a-playable-resonant-volume)
remain a candidate. Physical phone and participant use remain unverified.

## November 25 HIT-inspired Harmonic Lab vault

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `d7b3b73478fa` from `d4a6a52`. Dark acoustic surfaces and
suspended brass loops with turquoise traces frame the Beacon in both room
variants. The artwork follows the [HIT cover](https://hit.altermundi.net/tapa2.jpg);
the existing stair, benches and scoped prototype review retain their roles.

The exact fixture walked from the foyer into the chamber on RTX 2060 Normal
and Pi 5 V3D Livianos. In 90-frame stationary samples at the same pose,
the median was 16.7 ms on each, with p95 16.7 ms and 33.4 ms respectively
(versus 16.8 ms and 33.4 ms). Both exports kept four embedded images and
grew by 1,748 triangles each. The package is 143,360 bytes smaller.
The suite passed 411 tests with two skips. Protected readback matched all
86 installed files, the same access and receiving configuration, and
world sequence 433. Immediate rollback is `8772912dd7ed`.

The four-station composition remains an offline study. Guitar and Shaper
need their authenticated instrument targets in the owning panel before
their tables enter the room. Participant and phone validation remain open.

## November 25 world-anchored nearby action labels

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `8772912dd7ed` from `9a7bda4`. A reusable Three.js world label
shows the currently offered E action over the Materializer worktable
or the selected interior doorway. It uses the authorized nearby action as
its source and leaves the current keyboard and touch controls in place.
It adapts to the light and dark HUD palettes and uses scene depth.

The exact RTX 2060 fixture verified the label's placement, absence after
entering the table, and passage with an open Conversation draft. The
viewport regression covers off-screen anchors, depth scaling and texture
replacement. The release passed 411 tests with two skips. Protected
readback matched 86 files, protected access, receiving configuration and
world sequence 433. Immediate rollback is `4e3c2d60b33c`.

## November 25 legible Beacon plaques and the compact Matter workspace

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `4e3c2d60b33c` from `565ad77` and Proyección `1a1e29a`.
Harmonic Beacon, Spatializer and Weaver use solid ivory letters offset from
their dark plaques. Both authored chamber variants keep their original
triangle and material counts, and use their own matching light atlases.

The short touch-landscape Matter workspace divides controls into Model,
View and Table. Choice menus page over the existing panel. The workspace
leaves the lower touch zones clear, and Escape dismisses a choice before
exiting the workspace. The desktop layout retains the full tool set.

RTX 2060 rendered the three signs in the game and confirmed the solid
material. Pi 5 V3D tested emulated touch at 568 × 320 and 568 × 280,
including a part choice, rotation and a corte adjustment while holding
ascend. Both are controlled browser fixtures. Holodeck passed 409 tests
with two skips. Protected readback matched 86 files and the previous
access, configuration and world sequence 431. Immediate rollback is
`76bacef3cd52`. The HIT Laboratory composition is a separate draft.

## November 25 clear touch controls in landscape

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `76bacef3cd52` from `33da64d` and Proyección `dc90aab`.
The short landscape view uses floating bronze-rimmed movement controls
in the lower corners and a centered strip of six icons on a fullscreen
capable browser. Tools disappear while touch locomotion is engaged and
return on release. Compact touch suspends movement while Conversation is
open. The fullscreen icon invokes the existing browser action.

Pi 5 V3D tested 568 × 320 touch emulation, locomotion cancellation, actual
browser fullscreen enter and exit, and rotation back to 360 × 740.
RTX 2060 covered desktop E, the worktable and the mounted draft on crossing
a door. Holodeck passed 407 tests with two skips and Proyección passed all
20 spatial HUD tests. Protected readback matched 86 files, App and audience,
configuration and world sequence 431. Immediate rollback is `1c78c31a2b82`.
The Redmi and Telegram WebView remain unqualified. See [HUD #16](https://github.com/AlterMundi/holodeck/issues/16).

## November 25 Atelier interaction and portrait controls

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `1c78c31a2b82` from `2678e38`. The foyer is clear of its two
interior piers. Its reciprocal doors face visitors into each destination,
and E reaches the Matter worktable and the return doorway from desktop
world focus with Conversation open. The companion checks furniture,
keeps a grounded target during jumps, follows an indoor sprint and
uses a short light transfer when it falls behind or stalls.
The portrait touch HUD uses five named icons. The unrecognized-object
notice expires after four seconds.

The RTX 2060 fixture confirmed the Matter table and reciprocal door with
E, preserved the Conversation draft, closed Conversation from the same
launcher, showed a forced catch-up effect, and checked separation at
the Harmonic Lab stair arrival. The Pi 5 touch fixture confirmed the
portrait dock, minimap activation and transient notice before the final
landing-only adjustment. The final source passed 407 tests with two
skipped. Protected readback matched all 86 files, the earlier run, the existing
App and audience, unchanged configuration and the same sequence 431.
Immediate rollback is `b4031531fdfd`. Physical Redmi acceptance remains open.
Seat occupancy and poses remain in [seating #28](https://github.com/AlterMundi/holodeck/issues/28).

## November 25 Atelier return thresholds

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `b4031531fdfd` from `1c3e309`. Matter uses its baked Vestibule
plaque and a modeled inset leaf. Harmonic Lab sets the coordinated leaf,
placard and arrival at the actual stair landing. The floor-to-landing
walk and the Matter and Lab return loops passed in Normal RTX 2060 and
Livianos Pi 5 fixture browsers. Protected readback matched 86 files,
existing audience and configuration, and the same world run, with 30
entities and four nodes while the sequence advanced 424 to 426.
Immediate rollback is `b3cb2d08a6cc`.
[Interior evidence](environment-art-revamp.md#fitted-atelier-returns).

## November 25 terrain-first ground cover

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `b3cb2d08a6cc` from `064d4c0`. The coarse torus still allows
arrival and movement. Ground cover begins after the first atomic commit
of detailed terrain and stays mounted across subsequent tile requests.
Without a first detailed commit, the coarse scene remains usable with its
optional cover suppressed. The independent overlook landmark and its
collision stay available. Exact RTX 2060 Normal and Pi 5 Livianos
fixtures verified the delayed load. Protected readback matched all 85
payload files, the configuration, existing App and audience, and the
world run with unchanged entities and nodes as the cursor advanced from
419 to 421. Immediate rollback is `fdc871f47841` from `bcb1606`, the
first stage of the grass fix. `6a7916621c6c` retains the earlier behavior.
[Regression evidence](environment-art-revamp.md#terrain-first-ground-cover).

## November 25 softer night exposure and warm porch

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `6a7916621c6c` from `7aa2b35`. At night, the house and its
approach now use cooler, lower ambient light. A warm porch light marks
the existing door. RTX 2060 and Pi 5 completed the matched day/night
view and entry/return. The foyer retained its authored interior exposure.
The protected audience, world and doors matched. Rollback is `a4bfd4f17dee`.
[Measurements](environment-art-revamp.md#installed-night-lighting-at-the-atelier-threshold)

## November 25 meadow, optical HUD and animated passage

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `a4bfd4f17dee` from `c1deb83`. The exterior now draws
curved meadow blades, a graded earth path and shared air color across
land, water and sky. The optical HUD includes the redesigned action bar
and circular topographic minimap. Room travel shows the animated
portal and retains native reduced-motion and recovery controls.

Matched physical movement covers RTX 2060 Normal and Pi 5 Livianos;
RTX also renders the 23:10 ART fixture. Separate browser fixtures cover
touch minimap, the mounted Conversation draft and the transition after
WebGL loss. Installed inventory, protected HTTPS, audience, configuration
and native state matched, with `3fd63da1fd1d` as immediate rollback.
The larger visual objective and independent visitor feedback remain open.
[Measurements](environment-art-revamp.md#installed-landscape-hud-and-passage-pass)

## November 25 grounded companion and humanoid pose studies

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `3fd63da1fd1d` from `4aafe28` after exact installed-file and
authenticated HTTPS readback. Navegante has its reorganized Blender clip
library and planted runtime steps. The humanoid has revised launch,
banking, landing, water and idle poses. Its existing walk and run clips
remain selected. The Character Design Room shows flight and swim
studies from the same runtime pose adapter. Two isolated fixture
identities matched the same flight image from a revision-bound link.

On the RTX 2060 at Normal, two browser contexts completed walking,
hover, pilot projection and landing. In Pi 5 Livianos a single actor
completed walking, hover and landing. The receiving run, configuration,
App and audience were unchanged, with matching 30 entities and four
creation nodes. Rollback is `61d8ac934638`. Full swimming and slope
review by independent signed-in participants remains open. The visual
world and optical HUD candidates are separate. See
[motion qualification](character-motion.md#runtime-and-studio-qualification)
and [Character Design Room #24](https://github.com/AlterMundi/holodeck/issues/24).

## November 25 Atelier foyer and Character Design Room

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves package `61d8ac934638` from source `95b6d13`. The restored
foyer has separate reciprocal doors to the Materializador de Materia,
Harmonic Lab and the Character Design Room. The new review view opens
original rigs and their existing clips, supports frame stepping and fixed
views, and copies revision-bound pose links. Notes stay in that browser.

The exact package passed the three interior round trips and pose reopening
in desktop Chromium. An emulated touch viewport switched to the humanoid
jog and retained a frame note. The protected receiving read matched 84
installed files, the unchanged receiving configuration, the existing App
and audience, and the same native run, 30 entities and four creation nodes.
The live exterior now advertises the foyer. The immediate rollback is
`476adaf02828`. Separate signed-in visitor and physical touch behavior,
shared pose comments and selection of the revised animation remain open.
See [Character Design Room #24](https://github.com/AlterMundi/holodeck/issues/24).

## November 25 miniature flight controls

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
serves `476adaf02828` from `0c34a0b`. Tabletop flight eases acceleration
and heading. Touch can independently climb, descend and steer. The
controls move clear of the workpiece panel on a short display. Both
avatars retain their own proportions and the common hologram treatment.
[Exact browser checks](playtest-iteration.md#miniature-flight-controls)
covered desktop and emulated touch on RTX 2060 and Raspberry Pi 5.
Immediate rollback is `ec75cae97e47`. Independent authenticated visitor
and physical touchscreen testing remain open.

## November 25 inner ring overlook

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `ec75cae97e47` from `62855d7` for this update. The existing exterior trail
ends at a walkable limestone terrace with an oak shelter, bronze
directional inlay, bench and amber marker lights. The opening faces
the opposite arc. [Physical browser checks](playtest-iteration.md#inner-ring-overlook)
cover the walk, edge collision, exit, return and repeated views of
the same exterior at daylight and dusk. Immediate rollback is
`bd94dc35ba06`. Independent visitors remain to be verified.

## November 25 touch swimming

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `bd94dc35ba06` from `b183414` for this update. Touch shows **Subir** and
**Bajar** at the deep-water surface, underwater and in flight. Land
shows **Saltar**. The joystick retains its finger through the shore
transition. [Physical Chromium checks](playtest-iteration.md#touch-swimming-and-shore-release)
used touch emulation on RTX 2060 and Raspberry Pi 5. Immediate
rollback is `8a2e0d75c9b4`. Independent visitors remain to be verified.

## November 25 underwater controls and companion posture

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `8a2e0d75c9b4` from `0b070d9` for this update. The desktop vertical controls
follow the actual movement mode, and the companion pitches for water
using its existing rig. The exact package passed the water transition
on RTX 2060 and Pi 5. Immediate rollback is `2286ee700dc7`.
[Checks](playtest-iteration.md#underwater-controls-and-companion-posture)
cover keyboard, surfacing and the existing shared world. Touch descent
and independent authenticated views remain open.


## November 25 mapped swim crossing

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `2286ee700dc7` from `f52fef0` for this update. The exterior map shows the
existing spur as a solid trail and a dashed swim crossing, with shore
and overlook markers. [Exact physical evidence](playtest-iteration.md#overlook-spur-shore-and-swim-crossing)
covers RTX 2060 keyboard water entry, dive and resurfacing and Pi 5
Livianos map use. The shared world, receiving access and rollback
`a76e321eb728` were verified. A later [continuous physical crossing](playtest-iteration.md#continuous-crossing-from-shore-to-inner-overlook)
reached the dry Mirador on both devices with the same selected archive.
Independent shared acceptance remains open.


## November 25 cave wayfinding

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `a76e321eb728` from `63ed7c4` for this update. Four rust-coloured stone fins
identify the existing passage from the house and the exterior map marks
the original cave entrance. The full walk passed on RTX 2060.
The exact candidate also drew the landmark in Livianos on Pi 5.

[Physical and geometric evidence](playtest-iteration.md#rock-crown-and-cave-wayfinding)
covers the same silhouette and collision mesh, preserved tunnel and
receiving readback. Immediate rollback is `2a4ff7ba1da6`.


## November 25 meadow banks

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `2a4ff7ba1da6` from `7b1bcf1` for this update. Five rooted banks of feathered
tussocks and wildflowers bring depth to the landscape around the house.
Both graphics profiles retain the same bank locations. Normal uses finer
blades and visible movement with a reduced-motion option.

The exact bundle passed daylight, dusk and walking screens on the RTX
2060 and a Livianos screen on the Pi 5. The protected package, shared
access and live world matched. Immediate rollback is `0878bc6c67fc`.
See the [vegetation evidence](playtest-iteration.md#rooted-meadow-banks-around-the-shared-route).


## November 25 meadow material

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `0878bc6c67fc` from `9fc06a6` for this update. The shallow meadow beside the house
has filtered green and straw patches in both graphics profiles. The
world path and apron retain their surfaces and route. No assets were
added. [Matched physical comparisons](playtest-iteration.md#meadow-material-around-the-house)
cover RTX day and dusk and Pi 5 in Livianos. The installed files, shared
access and world run matched. Immediate rollback is `38a43c533c2e`.


## November 25 Sand3D verge

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `38a43c533c2e` from `46dc397` for this update. Low groups of grass, ferns and
pumice follow the sides of the existing flagstones. Normal loads the
models near the authorized house after world entry. Livianos keeps the
existing ground cover without those downloads.

[Packaged verge evidence](playtest-iteration.md#packaged-sand3d-verge-on-the-flagstone-approach)
covers the approach, Matter entry and return on Legion's RTX 2060 and
on a Raspberry Pi 5 in Livianos. The 84 installed payloads matched,
protected HTTPS served the exact new assets, and the App audience and
live world run were preserved. Immediate rollback is `7a466b1ca447`.
The real shared visit remains open.

## November 25 world controls alongside Conversation

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `7a466b1ca447` from `e9d23ce` for this update. The same mounted Conversation can
stay open while using world controls. A direct world click returns keyboard
focus to the scene. In flight, minimizing from the panel also returns it.
On touch with enough room, the existing movement controls and dock have
their own region below the panel in portrait or beside it in landscape.
The compact editor layout resumes when space runs out.
[Keyboard and touch evidence](shared-conversation.md#world-input-with-conversation-open)
covers the exact archive on Legion's RTX 2060.

The installed package and predecessor verified against their 80-payload
inventories. The client bundle, five avatar assets, terrain worker and
health matched over protected HTTPS. The App, audience and receiving
configuration matched and the temporary technical reader was revoked.
Native readback retained the same run, sequence 403, 30 entities and four
nodes. Twenty-two state files matched byte for byte and observation rotated
two room checkpoints. Immediate rollback is `41508709635f`; older
published recovery is `0425dd6d7c67`.

## November 25 explicit workpiece pointing

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected `41508709635f` from `9dc9e0f` for the shared pointing release. **Señalar esta pieza** sends a
five-second cue to authorized miniature visitors following the same exact
table edition and scene. The receiving view shows a small gold mark on
the part and the pointing avatar's head turn. The checked browser package
passed both directions on Legion's RTX 2060, one controlled actor in Normal
and the other in Livianos. The [test record](playtest-iteration.md#explicit-workpiece-pointing)
distinguishes fixture actors and authenticated live visitors.

The installed 80-payload package and predecessor matched their inventories.
Protected HTTPS matched the exact client, five avatar models, terrain worker
and health with the existing App audience and expected denials. The temporary
read credential was revoked. Native readback retained the same run, sequence
403, 30 entities and four nodes. Twenty-two state files matched byte for byte
and the observations rotated two room checkpoints. Immediate rollback is
`0425dd6d7c67`; older published recovery is `8260b7fcf577`. The three
published archives total 100,341,760 bytes.

## November 25 tabletop companion attention

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/)
selected release `0425dd6d7c67` from source `8f77817` before the shared cue update. The miniature companion
looks at a settled piece and moves gradually to a bounded position beside
it. [Normal, Livianos and reduced motion on Legion](playtest-iteration.md#looking-beside-the-selected-piece)
passed with the same mounted fixture. Independent authenticated tabletop
visits remain open.

All 80 current payloads and the installed predecessor were verified.
Protected HTTPS matched the exact client bundle, five avatar assets,
terrain worker and health. The App, audience and deployment configuration
were preserved. The temporary technical reader was revoked. The native
run retained 30 entities, four nodes and sequence 403. Twenty-two state
files matched byte for byte and observations rotated the room checkpoints.
Recovery retains `8260b7fcf577` and `326890e44863`. The three published
archives total 100,218,880 bytes. The superseded `873ae82b51f6` publication
was retired after its local archive was verified.

## November 25 humanoid mouth rigs and local microphone consumer

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) serves
`8260b7fcf577` from source `c3a5b84`. The four humanoid models load with a
neutral jaw and can consume a bound local microphone envelope. CompAII's
canonical Conversation now serves the [compatible producer](shared-conversation.md#local-avatar-microphone-motion)
from `b1d2fd0b` after a fenced web-only activation. Three HTTPS JavaScript
hashes matched. Native services, configuration and the World release were
preserved. The six other registered active Conversation receivers now
serve the [compatible legacy overlay](shared-conversation.md#local-avatar-microphone-motion).
Synthetic capture and a distinct fixture observer passed in the
[controlled test](playtest-iteration.md#local-microphone-animation).
Physical microphone and authenticated two-person acceptance remain open.

The deployment changed the four humanoid GLBs, their notice and the browser
bundle. All 80 installed payloads matched. Protected HTTPS returned the exact
browser bundle, four humanoid GLBs, companion GLB, terrain worker and health
response. The Home App, audience, configuration and expected denials matched.
The temporary technical reader was revoked. Native readback preserved the
same run, 30 entities, four nodes and sequence 403. Twenty-two state files
matched byte for byte. The world observations rotated the two room checkpoints.

The immediate code-only rollback is `326890e44863`. Its installed files
all match the manifest. The older compatible `873ae82b51f6` is installed
and published. The three published archives total 100,096,000 bytes. The
superseded `20726f08a3e0` publication was retired after its local archive
was verified.

## November 25 humanoid standing idle and airborne turns

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) serves
package `326890e44863` from source `64195e8`. Humanoids add breathing and
small glances at rest, keep the base foot and pelvis pose and fade the
gesture into movement. Airborne turns ease heading and bank in the local
radial frame. The exact archive passed 354 tests, with two optional skips.
The [RTX 2060 and separate fixture observer measurements](playtest-iteration.md#humanoid-standing-idle)
cover both graphics profiles and the reduced-motion control.

Only the browser bundle changed among the 80 payloads. Protected HTTPS returned
the exact bundle, terrain worker, avatar and health response. The existing App
resource, audience and receiving configuration matched. Native readback kept
the same world, 30 entities, four nodes and sequence 403. Twenty-two state files
were byte-identical. The two room checkpoints rotated during the observations.
Anonymous access and four protected-route denials were confirmed, and the
temporary technical reader was revoked.

`873ae82b51f6` is the immediate code-only rollback, with `20726f08a3e0`
as the compatible older recovery. Both installed trees were retained, and all
files in the immediate rollback matched its manifest. The three published
archives occupy 99,973,120 bytes. The superseded `b74aa8939953` publication
was retired after its local recovery archive was verified. The visit with two
independently authenticated people and their native Conversation return remain open.

## November 25 oriented arrival and compact HUD

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) serves
`873ae82b51f6` from `9dbe660`. A fresh toroidal arrival faces the permitted
house entrance. The path ends in a flagstone landing and the door prompt
moves beside the compact dock on short landscape displays. Touch layouts
can stack the prompt clear of the movement control. The earlier worktable
light and improved toroidal sky remain active.

The existing Home App and audience were verified after activation.
`20726f08a3e0` is the immediate rollback and `b74aa8939953` is the
compatible older recovery. Both are retained as exact installed trees and
published archives. The three archives total 99,973,120 bytes.
`ccb72f15ef10` was retired from the publisher after preserving its exact
local archive and confirming both retained rollback versions.

The controlled package passed 352 tests with two optional skips. The
short layout was exercised on a Raspberry Pi 5 with the same dock geometry
and in the final exact package in Chromium. Protected HTTPS verified the
exact client, terrain worker, avatar and health responses, four access
denials and refusal after revoking the temporary package reader. All
80 installed payloads matched. Native verification preserved the same
world, 30 entities, four content nodes and sequence 403. Twenty state
files were byte-identical. The two room checkpoint files rotated as the
verification saved its own observations, with no change to world content.

Production is available. The shared visit with two independently signed-in
people and native Conversation return through their actual interaction
remain to verify.

## November 25 toroidal sky and worktable lighting

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) served
`20726f08a3e0` from `151ef83`. It includes the filtered orbital worktable
light, cut-aware specimen shadows, and a stable integer cloud lattice.
Matched physical RTX 2060 captures at the toroidal spawn show the sky
without the former rectangular cloud boundary. Daytime lightweight and
dusk normal graphics were checked. The exact package passed 351 tests
with two optional gallery skips.

The existing Home App and audience were retained. The immediate rollback
is `b74aa8939953`, with `ccb72f15ef10` retained as compatible recovery.
The three Home archives total 99,973,120 bytes. The superseded
`52dccaadf135` publication was retired through the publisher after verifying
its exact locally retained archive and both compatible protected predecessors.

The initial activation request was interrupted by the Home access unit's
384 MiB memory limit. Its automatic restart restored the gateway and left
the prior Holodeck code selected. The original request was present in the
owner journal and absent in the runtime journal. Resubmitting that exact
request after checking memory headroom and an empty listener completed the
upgrade. All 80 installed files and the previous code digest matched.
The protected HTTPS readback verified health, exact client, avatar and
terrain worker bytes, four baseline denials and refusal after revoking the
temporary reader. All 22 sampled state files were byte-identical. The
native readback verified the run, edition, 30 entities and four nodes.
This release has technical and physical device evidence. The full route
with two distinct signed-in visitors is still open.

## November 25 viewer themes and shared avatar poses

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) serves
`b74aa8939953` from `6be9393`. Appearance now offers the browser-local
light and dark bases. The humanoid crouch keeps the feet planted, and peer
browsers render the supported crouch and exterior flight poses for the
current room. The same App resource, access and URL remain selected.

The existing Home writer completed selection after an unoccupied-world
sample. Immediate rollback is `ccb72f15ef10`; the compatible recovery
archive `52dccaadf135` is still retained. The three generated archives total
100,188,160 bytes. The older `883efcd70ed1` Home publication was retired after
readback of the current release, rollback and exact local original.

All 80 installed payloads match. The protected HTTPS reader verified exact
health, client, avatar and terrain-worker bytes and four boundary denials.
Native readback preserved the run, edition, 30 entities and four nodes.
The configuration and 20 of 22 inspected state files were byte-identical.
The current and previous world checkpoints were rewritten.

The exact build passed 351 tests with two optional installed-gallery checks
skipped. Two controlled browsers verified remote crouch after reload,
exterior flight and disconnect cleanup. A different actor and an additional
tab for the same actor could not submit a pose for the original tab. The
same package passed tabletop scale, translucency, flight and exact return.
These runs used fixture identities and software rendering. Signed-in
human participation and physical GPU validation remain open.

## November 25 archived light exercise and instrument HUD

The protected [Holodeck entrance](https://compaii.dmn.homes/holodeck/) serves
package `ccb72f15ef10` from `7ba7cfc`. It includes the native instrument HUD,
authored avatar flight and swim, the planted approach, and the Harmonic Lab
station. The light creation exercise is closed and its saved results remain
visible. A retained signal garden now reads as archived.

The existing Home writer completed both selections while the runtime had no
established visitor connections. The immediate rollback is the verified
Harmonic Lab package `52dccaadf135`; `883efcd70ed1` remains a retained
compatible recovery archive. The three published archives total 100,382,720
bytes. One superseded archive was removed from Home after an identical
retained local copy and both selected packages were verified.

Protected HTTPS returned the exact health, client, avatar and terrain worker.
All 80 installed payload files matched, with the top-level service manifest
as the archive's 81st file. Four protected denials matched. Native readback
preserved the run, edition, all 30 entities and all four nodes. Only the
garden's display status and instruction changed. The receiving configuration
and 18 of 22 inspected checkpoint hashes were byte-identical. Room and
avatar current/previous checkpoints were rewritten. The same App resource,
selected audience and route were used. Two controlled Chromium browsers
verified shared tabletop flight and reconnect. The retirement was also
verified in desktop and emulated touch against the exact package. Actual
signed-in human play and physical GPU acceptance for this build remain open.

## November 25 native creator release

The protected Holodeck release is `883efcd70ed1` from `2371cdc`. The selected
rollback is `8b3d41a7410a`. This package includes the Proyección fitted-text
revision, native recovery and exterior light creation, the tabletop avatar
scale and flight changes, Alt crouch, and the optional Taller worktable HUD.

The first request overlapped a Home access authority memory kill and a restart.
The receiver had no journal entry for that request, and Holodeck retained its
previous selection. The same request completed after access returned. All 80
installed files matched, the native run/edition and receiving configuration
were unchanged, and protected HTTPS returned the exact client, avatar, terrain
worker and health response. Four protected boundary denials also matched.
The exact package had passed the two-client tabletop and creator recovery
fixtures. Physical-device and human acceptance for this release remain open.

## November 25 volumetric Navegante

The protected release is `8b3d41a7410a`, from `a3f4c20`. The previous
cockpit HUD release `8c485a4c8cfe` remains the selected rollback. The new
companion was authored in Blender with solid ceramic housings, articulated
joints, a teal mantle and a separately driven jaw. Its 421,384-byte GLB
contains the nine pose clips and an in-place grounded gait. Fable 5.2 High
reviewed the design. After Opus 5.5 High's visual and movement review, the
eyes conform to the visor, the jaw pitches around the lateral axis and the
foot trajectories are solved from stance and swing targets.

The exact Node24 package passed a two-visitor controlled shared-world check.
Runtime Chromium loaded the avatar and exercised walking, airborne idle,
playback-driven jaw travel and reduced motion. Protected HTTPS returned the
exact GLB, browser bundle, terrain worker and health body, 80 installed files
matched, and the receiving configuration and world run were preserved. The
new recovery HUD and renderer dependency update remain separate receiving
work. See [appearance](native-appearance.md#blender-companion) and the
[habitation milestone](shared-roadmap.md#first-shared-habitation-iteration).

## November 25 cockpit HUD

The protected release is `8c485a4c8cfe`, built from `eddd42a` on
`release/cockpit-hud`. `1db0e674e988` remains the rollback. On a desktop with
a fine pointer, `?hud-look=cabina` projects the contextual toolbelt and room
header into two actual perspective planes, with chamfered material housings.
Touch and narrow layouts keep the flat arrangement. The app still supports
the earlier looks and the default selection is independent of the preview.
See [HUD art direction](playtest-iteration.md#hud-art-direction).

## November 25 native HUD looks

The protected release is `1db0e674e988` from `release/native-hud-looks`
(`e6e9416`). `8e6647b2b23c` remains the rollback. The existing game accepts
four opt-in HUD looks. Choose `hud-look=orbita`, `umbral`, `pulso`, or
`estratos` on the game URL. Compare the same gameplay toolbar, Matter
workbench and Conversation chrome. See the art-direction section of
[the playtest record](playtest-iteration.md#hud-art-direction).

## November 25 skeletal Navegante

The protected release is `8e6647b2b23c`, built from `b87e1ed` on the
previous selected source. `0f5b5c10a971` remains the rollback. The white
Navegante now uses an editable Blender armature and a skinned GLB with 47
joints. Its nine authored poses remain in the asset. The follower blends a
knee-and-elbow walking cycle while moving on the ground, retains its face pose
animation, and uses a separate playback-driven jaw bone.

Opus 5.5 High caught the local jaw axis, competing animation weights, missing
ground gating, and stale skin bounds. The corrected candidate passed 319 tests
with two skipped. A Chromium fixture measured 23.4 mm of downward jaw travel
at full level, opposite leg rotations while walking, and no walk swing in air.
It also exercised voice drop-off and reduced motion. These were controlled
playback levels, not a physical voice session. All 80 installed files and the
protected HTTPS GLB, browser bundle, terrain worker and health body matched.
Receiving configuration, native world run, edition and access checks remained
valid. The HUD art comparison remains a separate private review view.

## November 25 animated Navegante and exhibitions

The protected Holodeck release is `0f5b5c10a971`, built from `d3f0512`
with `b3aec1e9b89a` retained for rollback. The following companion loads
the Blender-authored Navegante blanco. Its GLB retains the nine authored
motion clips and uses the existing Conversation playback level for jaw motion.
The new exhibition picker and viewer controls use Three.js A2UI.

All 80 runtime files matched. Authenticated HTTPS returned the exact GLB,
browser bundle, terrain worker and health body. The native world run and
receiving configuration were preserved. The test suite passed 319 checks
with 2 skipped. Chromium checked visible angles, moving idle, jaw response
and reduced motion with injected levels. The exact package also passed
the catalog and retained viewer check. Full live voice timing and physical
device acceptance remain open. See [appearance](native-appearance.md#blender-companion)
and [exhibitions](playtest-iteration.md#native-exhibitions-and-visit-controls).

## November 25 native Activity

The selected Holodeck release is b3aec1e9b89a with fda64cf266b7
available for rollback. The exterior Activity launcher and its paged history
use the Three.js A2UI HUD. The authenticated hosted browser opened Activity,
read the existing API with HTTP 200 and closed the native panel with Escape.
Exact asset readback matched 79 runtime files and the native world run and
receiving configuration were preserved. Details and fallback qualification
are in the [playtest record](playtest-iteration.md#native-activity-panel).

## November 25 compact general Conversation

The protected Holodeck release is `fda64cf266b7` with `29399a048e35` retained
as rollback. The hosted panel omits the topic picker, and the ordinary title
strip measured 36 CSS pixels on desktop and emulated touch. The matched
desktop baseline measured 108 pixels, and the iframe gained 72 pixels.
The desktop fixture retained drag, resize, minimize and the current draft.
All 79 packaged runtime files, protected assets and the unchanged world run
and receiving configuration were verified. The iframe uses the canonical
general-Conversation layout from DaimonApp #1029.

## November 25 selected playtest update

Holodeck is serving 29399a048e35 after exact protected package readback.
The release adds tabletop hologram flight, movable HUD windows, the sky and
Buenos Aires solar cycle, and the animated Navegante companion. The compact
Conversation minimize glyph, corner resize grip, per-account Orbital look and
Collection rearchiving are delivered. The compatible previous package is
52ca23ac4a7e. Native world run and receiving configuration were preserved.

Two browser visitors exercised the tabletop state across entry, reload and
exit. The emulated touch check validated simultaneous movement and jump,
cancellation on map entry and ascent inside the tabletop bounds. Browser
playback-level transfer through the bound Conversation frame passed with
synthetic levels. The CompAII Conversation sender is selected at App #1026;
the complete live speech and physical device trial is still open.

The HUD theme studies and bounded Sand3D Nature comparison are available
through the [playtest plan](playtest-iteration.md#november-25-playtest-and-next-controls).
The software renderer measured the added geometry and draw calls only in the
test patch. It does not establish acceptable game-device performance.

Updated 2026-11-24. The native Holodeck goal now selects the giant continuous
toroidal terrain. The prior appearance verification is preserved below and its
remaining work is tracked in the shared roadmap. The earlier MVP objective and
accounting were preserved before editing the existing goal.

The combined orbital finish is retained in
editable Blender source and compared at the entry camera. A diagnostic GLB
export keeps the original image maps but drops procedural material variation
and the Cycles lighting and atmosphere. A separate light and albedo bake removes the obvious white artifacts in a
matched player-height comparison. The 1,262,068-byte
`matter-workshop-orbital-baked-v1` is a reversible candidate with unchanged
Collection anchors and colliders. The local fixture walked around the table,
advanced and rotated the archive, returned to the foyer and received 404 for
the scoped art afterward. Desktop and emulated touch both passed with the
lightweight profile. A two-browser trial of the exact baked package also
restored the full 197,642-triangle Support Study, shared it, kept independent
rotation, prepared an exact part reference and honored edition-specific
revocation for the affected actor. The current 34,000-triangle edition still
shared and cleared normally. The geometry bytes are retained Home originals;
browser identities, gateway decisions and the Conversation receiver were
fixtures. On the physical Raspberry Pi 5, the cleaned candidate rendered
with Broadcom V3D and passed movement, archive rotation and the doorway
round trip in lightweight mode. The 371 moving frame intervals measured
33.3 ms median and 50 ms p95. The orbital PBR predecessor recorded
33.4 ms median and 66.6 ms p95 in a matched run. The clean bake took 12.93 s
to enter cold through the test tunnel, versus 9.86 s for the predecessor.
The latest candidate starts loading the authorized room model during presence
reconnect. On Cuevanico, the model response started at 0.78 s instead of
3.67 s in the paired packaged runs. Full cold readiness still took 14.51 s
instead of 15.09 s, so room entry needs further work.
The renderer now skips hidden interior frames while connecting and loading,
then draws the destination before lifting the passage overlay. In the
instrumented Cuevanico run, the first ready draw took 9.03 s and the next
one took 11 ms. Both desktop Chromium and emulated touch passed the packed
doorway round trip with this change.
On the physical Pi the packed lightweight candidate then reduced the
first draw from 9.18 s to 5.33 s after simplifying the two optical materials.
The fully visible passage went from 10.85 s to 7.46 s in the paired runs.
Desktop automatic kept the original physical glass and emulated touch
used the new treatment in lightweight mode. Both passed the door round trip.
On a separate physical run with the packed lightweight candidate, the archive
turned, all 24 corner samples cleared the walls and 418 moving intervals
measured 33.3 ms median and 33.4 ms p95.
The separate `matter-workshop-orbital-focused-v1` selection adds responsive
roughness and metalness to the tabletop and archive rear panel, with the
fixed-light atlas on the rest of the room. On Cuevanico it measured 33.2 ms
median and 33.4 ms p95 while moving. Its 9.69 s cold door was slower than the
last diffuse-only movement run. The desktop and touch worktable fixture both
loaded the exact focused export, shared the retained edition, selected a
part and cleared the table. The focused selection is available in builds.
Its room-style control now switches the local visitor between orbital and
amber material/light atlases without reloading the shell or shared model.
Desktop and emulated touch selected different looks on the same edition.
On Cuevanico, applying the two amber images for the first time took 1.79 s
through the test tunnel. The browser restored orbital and returned through
the door. The GLB and both atlas URLs were refused after exit.
The separate floor-splat profile now replaces only the visible floor of the
original Matter GLB in the packaged room. On the physical Pi, the regular
70,224-point fit closed the large perimeter holes in the matched view and
ran at 50.0 ms median and 66.7 ms p95 while moving. The matched mesh run
recorded 33.3 ms / 50.0 ms. Both routes retained the rotating archive and
door passage. The floor-splat profile is a trial selection.
The separate appearance viewer also passed a moving hardware check on
Cuevanico. The lightweight pure, detailed orbital pure and lightweight
hybrid took 33.4 ms, 50.0 ms and 50.0 ms respectively at the median.
The hybrid's archive turned, and the orbital view showed detailed light
and visible breakup at thin edges. This check used the comparison viewer,
while the live doorway and worktable evidence above used the baked mesh.
[Qualification details](../art/collection/appearance-study/README.md#orbital-fixed-light-bake).
These isolated comparisons preceded the room-only rollout below.

The isolated focused-room package now reads Orbital and Amber from the
same versioned look manifest. It passed independent desktop and
emulated-touch selection on a shared worktable, a browser retry after
one deliberately failed map, and room-scoped asset refusal after exit.
With Amber active, the exact package ran on Cuevanico at 33.3 ms median
and 33.4 ms p95 while moving. The camera clearance, rotating archive and
door return passed. Blender also exported independent albedo and static
irradiance on the existing UV layout, with the archive platform excluded
from the light bake. The isolated package now exposes the optional
layered orbital look on the same mesh. Increasing the bake samples
reduced mottling in the floor and replaced only the irradiance texture.
The retained albedo and GLB kept their exact hashes. On the physical Pi
the refined layers applied in 2.27 s and the walking route measured
33.3 ms median and 33.4 ms p95 with the new look active. The rotating
archive, camera clearance, door return and art refusal after exit
passed. The layered look also projects live silhouettes onto the
worktable and archive pads. The worktable mask responded to rotation,
sectioning and clear in two browser views. On Cuevanico the archive
switched between two retained representatives, with a different mask
after the half-turn. That run recorded 33.3 ms median and 50.0 ms p95
over 374 moving intervals, and passed door return and camera clearance.
The matched Blender and browser capture identifies the missing floor
reflection, soft joints and softer glazing as remaining visual gaps.
The follow-up floor treatment restores the authored deck grain and
grout and recovers the pendant reflection in the layered look. Across
two matched camera positions, the reflection shifted 122 pixels in
both Chromium and Blender. The complete packaged Pi run kept
33.3 ms median and 50.0 ms p95 while walking, turned the archive, and
returned to the foyer. The next qualified fixture adds oriented
fixture reflections to the service windows and the archive glass.
The fitted window crops moved closer to Blender from both registered
cameras. Cuevanico showed the selected model behind the glass, kept
33.3 ms median and 50.0 ms p95 over 371 moving intervals, and returned
through the door. The remaining visual differences include softness of
glazing. The archive canopy and side fill now participate in the layered
floor reflection, narrowing the difference in the selected Blender
crops. The compacted candidate archive fits the 32 MiB receiving
limit. The installed validator, Node 24 protected admission/revocation,
paired worktable and physical Pi route passed on the exact candidate.
The orbital package is now selected for Manipulación de Materia on the
existing protected entrance. The exterior continues to use the deployed
Atelier layout. See the selected receiving release below for the exact
artifact and rollback.

Nicolás's earlier shared movement, light, house and door confirmations still
count. The repaired content-exit route has been delivered. Use independent
simulated participants and devices to qualify newer releases, and report direct
observations separately.

## Foreground model qualification

The separate selected-worker fixture ran the current packaged world and
installed Conversation client through the isolated Telecodex routing
owner. An explicit selector reached one worker, which received the exact
original and machine attachment. The bridge observed its live execution
before the CLI could take the two passages and apply the missing signal.
Both Chromium views saw the shared result. The retained Conversation frame
showed one covering worker final, and only the same original recovered
the action receipt after the live proof and source lease ended. The other
browser reconnected to the completed activity. A second run used a real
Codex model to follow the scoped action offers, choose the missing mint
signal and write its own reply. Both browsers verified completion, and the
reply from the isolated owner matched the model's exact text. Pair identity,
native provider events and browser HTTP were fixtures. The production-routed
original remains a separate observation.
[Selected-worker qualification](shared-conversation.md#return-to-the-same-conversation)

The combined 23 November trial used the packaged world, the installed
Conversation web client, two Chromium participants and an isolated instance
of the actual Telecodex owner, Provider and NativeBridge. The desktop moved
while the owner was receiving the machine attachment. The exact native
turn/start packet carried the original's immutable foyer and bench reference.
An independent Codex model used that attachment, crossed two authorized
passages and filled the missing signal using the native world port. Both
browsers saw completion. The real owner projected the model's exact answer
once under the same original after the simulated app-server sent its final
event. The scoped receipt survived release, and a separate real-owner turn
could not retrieve it. This combines canonical owner and model effects in
one isolated workflow. Pair identity, browser HTTP surface and provider
event transport were fixtures. Production-routed execution and physical
device evidence remain separate.
[Combined trial](shared-conversation.md#return-to-the-same-conversation)

An actual Codex model used the scoped world CLI against the isolated two-browser
trial. It used the original's captured foyer, took two authorized passages from
outside, and chose the missing mint signal from the live garden state. Its
action and result returned the same room, revision 1 and sequence 3. A fresh
observation showed two contributors. The two browsers saw completion. The
canonical client rendered the actual model's answer once under its fixture
original, and that original recovered the receipt after release. Canonical
admission and final-event transport were simulated. A single production turn
using the actual canonical writer and native final-event return remains open.
A second local probe used the actual Telecodex owner, dashboard Provider and
Holodeck NativeBridge with a synthetic foreground identity and native peer.
It admitted once with the exact opaque source, observed working, rejected a
foreign hash and published one same-original final. These checks establish
the direct-owner path with the native event simulated.
[Trial contract](shared-conversation.md#return-to-the-same-conversation)

## Author catalog receiving evidence

The existing private Home owner adapter now verifies exact retained
resource/version pairs against the authenticated owner's current Home.
The local Nexus reader used the deployed authority and current review
tables to list five distinct CompAII editions over three pages. The existing
Holodeck pin matched. The proof refused a different actor and returned no
invented version. Nexus's browser receiver and Holodeck's package remain
selected as before. The owner used this catalog for the finished gallery
placement update. [Creator workflow](shared-roadmap.md#mmorpg-experience-and-creator-loop)

## Manipulación de Materia candidate

The Collection reader now groups the two Guitar reviews under one shelf
position and pins the edition of each readable review. The ordinary creator
identity resolved both Guitar resources, Harmonic Flow and Visor X against
the real HTTPS Home catalog and exact source manifests. The browser trial
used a separate isolated room with fixture identities and a controlled source
response. Chromium entered from the foyer, walked in from the real arrival
point, collided with the table and archive cabinet, went around the table,
and returned through the same door. The selected shelf coordinates matched
the Blender anchor. The room art endpoint refused access immediately after
leaving. The final exported shell was checked in the lightweight renderer.

The next packaged trial mounted the Blender miniatures of Guitarra,
Harmonic Flow and Visor X on their shelf anchors. Desktop and touch Chromium
opened the exact Home edition into a separate tab and returned to the same
position. Revocation in the controlled source removed the geometry, plaque
and link, and further miniature reads returned 404. The real Home viewer
routes separately returned all four exact selected versions to the
authorized creator. An anonymous read of the protected Visor X version
was denied. The two Chromium interaction trials used fixture identities and a
controlled viewer destination.

The archive candidate mounted two miniatures derived from real retained
Guitar review versions. Desktop and touch Chromium advanced the indexed
platform, opened the selected exact historical viewer link, returned to
the same place, and stepped back. Revoking only historical permission
removed the cabinet's model, plaque and action and returned 404 for the
historical miniature. The current edition remained readable. The owner
reader separately verified both exact historical manifests and viewer pages
against the real Home gateway. The interactive tests used a controlled
viewer destination and fixture identities.

The worktable candidate mounted the full retained Support Study geometry
using its actual authorized Home scene-index and scene files. The two selected
editions have 197,642 and 34,000 triangles. In the isolated desktop and touch
Chromium runs the table retained the first model when the replacement bytes
failed the checksum, then advanced to the second edition once valid bytes
were available. Avatar position, rotation of the model and the cut setting
survived the swap. The chosen part cleared when its ID disappeared from the
new scene. Leaving the table controls left the model visible, and source
revocation removed it. The source files came from the authenticated Home
owner reader. Edition switching and revocation used a controlled gateway. A separate
authorized HTTPS read decoded the current Guitarra, Support Study, Harmonic
Flow and Visor X sources with the same reader.

The shared table selection is stored with the room checkpoint. A desktop actor
shared the Support Study in Chromium and a separate touch actor saw the same
model 11.3 seconds later on the catalog refresh. Both advanced to the next saved
edition and kept independent rotations. With the subsequent authorized room
stream, the peer began its own catalog read in 496 ms and rendered the initial
197,642-triangle model in 1,001 ms in the same local Chromium fixture. Exact
edition changes from Home still use the regular refresh. Revoking only the touch actor's source
permission removed that model for the touch actor while the desktop actor still
saw it. The desktop actor then cleared the table. This test used distinct
fixture identities and two retained editions from the Home reader.

The worktable can now refer a specific scene or part to Conversation. Desktop
and touch Chromium prepared an exact part reference after the model on the table advanced
to a different Home edition. It kept the selected earlier version and part ID,
and **Quitar referencia** removed them from the next preparation. This used
verified retained Home files and a fixture Conversation receiver. The API
regression rejects an unknown part or a historical edition that the speaker
can no longer access.

The Matter room is selected in the live Atelier. The archive supports returning
an exact edition to a separate free shelf. In desktop and touch Chromium the
browser fixture opened the restored edition and removed only that historical
model after source access was revoked. The real Home owner separately confirmed
four current resources and two exact historical editions. Touch Chromium also
verified the two distinct portals and Matter round trip in an isolated copy
of the authored Atelier graph. A further desktop-and-touch fixture restored
the historical Support Study, rendered its complete 197,642 triangles for both
actors, and prepared an exact selected part in the existing Conversation
protocol. Revoking historical permission removed the model only for the
affected actor, who could still receive the current 34,000-triangle edition
when it was shared. The Conversation receiver and Home access decisions in
this two-browser test were fixtures. On 23 November Nicolás reported
using the deployed Matter room and seeing a historical item move from the
archive to a shelf. This is direct human-reported use of that restoration.
Live human Conversation delivery from the workshop remains to be observed.
In a newer isolated selected-worker trial, the native return lane received
the exact part from the real owner fixture's original. The world accepted
a scoped action and the installed client showed the matching final once.
The short landscape panel was widened after the first check clipped two
lines. The rerun showed the whole reply at 1000×700, 390×844, 375×667 and
844×430. The close control stayed reachable. Two distinct browser actors
observed the action, a third actor was denied its receipt and the original
actor recovered the completed receipt after leaving and returning. The
existing Conversation owner and native transport ran with simulated actors
and a scripted native worker.
[Room and source contract](houses.md#the-collection)

## Selected receiving release

The protected playtest now selects package `601108cb255e` at source
`43c39e0`. It includes Proyección PR #7 (`a8e5afc`) for display-density
text, plus the qualified Matter and world HUD changes. Its immediate
rollback is `f46d93f436be`. All 78 installed files and the protected HTTPS
health, client and terrain worker matched. The receiving configuration,
native run and edition were preserved. The remaining iteration scope is
tracked in [the playtest plan](playtest-iteration.md).

The current protected release is `f46d93f436be` at source `f975275`.
The chamber collision shell includes the ceiling. A controlled Chromium
orbit kept the camera inside Matter at full requested zoom. A strong
upward movement stopped the avatar capsule at 3.98 m under the 4.01 m
ceiling. Separate browser flight stopped at the cave roof. The protected
readback matched the package and retained `2563afe48a8d` for rollback.

The preceding protected release was `2563afe48a8d` at source `cc04977`.
Conversation keeps its canonical web page inside a movable Three.js frame.
The controlled browser verified drag, resize, the minimizing animation,
draft retention and viewport clamping. A separate controlled run verified
mouse sensitivity, a turn beyond one full revolution, the minimap and
double-Space exterior flight. The exact package and protected readback
passed with `74f574592917` retained for rollback.

The previous [protected release](https://compaii.dmn.homes/holodeck/) served the
continuous toroidal world and the Matter worktable's Proyección A2UI HUD
in package `74f574592917`, source `98a2a61`. Package `68d4eadaa3da` is its
immediate compatible rollback. The selected world has CompAII's house and
Manipulador de Materia as its only active room. Near the worktable, the
visitor explicitly enters and exits app mode in the same 3D scene.
The exact packed worktable test paired a desktop writer with a Raspberry
Pi reader using touch input. It passed confirmed sharing, independent
inspection, access denial and revocation, movement restoration, keyboard
focus restoration and the Orbital-to-Amber HUD palette change. A separate
run with both software renderers on one host logged a startup connection
timeout. The cross-device package run finished without a page error.
The same packed client requalified the exterior on the Raspberry Pi at
6.09 s for cold entry over the test tunnel. The 141 moving intervals in
lightweight mode were 16.7 ms median and 23.9 ms p95. Automatic mode was
19.8 ms median and 26.1 ms p95 over another 141 intervals.

For the first toroidal package (`68d4eadaa3da`, source `943ca63`),
`2009ff26ca7b` remains a verified historical code rollback.
All 78 installed payloads matched. Protected HTTPS served the exact packed
client and terrain worker, and reported healthy. The technical reader was
denied access to the human world entry and three room-scoped endpoints.
The native read returned the pre-deployment run and edition. Controlled
browsers completed the eight-sector circuit with 43 rendered checkpoints,
including 21 in water. Separate paired browsers qualified reconnect, the
cave, room entry and return, and Collection access. The physical Pi and
positive browser admission were qualified on the controlled receiver.
A signed-in participant's use of the production edition remains unobserved.

The preceding shared package `2009ff26ca7b` added fine material detail, Collection distance tiers and the
opaque shell infill to the selected Matter appearance. The exterior,
receiving configuration and room run were preserved. All 75 installed
payloads matched. Protected HTTPS health and exact client bytes passed,
with four scope denials outside the relevant room or actor scope.

Cuevanico qualified the same package before activation. The browser entered
cold in 9.53 s and measured 33.3 ms median and 50.0 ms p95 during 357 walking
intervals. Archive rotation, camera clearance and foyer return passed.
The desktop and emulated-touch worktable tests used controlled identities.
An authenticated human visit to the newly serving version remains a
separate observation.

## Predecessor release and appearance qualification

The preceding selected release used source
`5ec63ee`, package `d65e90d37ca9`, with `2f68982b6294` as compatible
rollback. This release applies the optional room-bound Matter appearance
selection. The continuous valley and independent house drafts remain in
their owning worktree. The deployed Atelier exterior, existing room
layout, Collection placements and representative index, avatar choices
and native-turn checkpoint were preserved. The world run, edition,
entities and nodes matched the immediate predecessor checkpoint.

Readback matched all 73 installed payloads and the protected HTTPS
health and client responses. Four scope denials passed. The actual
predecessor package booted against the same optional configuration in
the protected Node 24 fixture and served its original Matter GLB.
The exact selected package concurrently passed desktop and emulated
touch worktable use and the physical Cuevanico route. Cuevanico had
33.3 ms median and 50.0 ms p95 across 382 walking intervals, confirmed
archive rotation, 24 camera checks and the foyer return. The browser
trials used controlled identities. An authenticated human visit to the
served release remains a separate observation.

A follow-up used the same package to track the pendant reflection during
a continuous sideways walk with the room and Collection models mounted.
Each sample pairs the rendered pixels with the camera position and
quaternion from that draw. The reference is the pendant center reflected
across the floor plane and projected into the actual 561 × 374 drawing
buffer. The measured position is the weighted centroid of the bright,
near-neutral pixels in that floor region.

On physical Cuevanico, all eight samples tracked the highlight across
1.86 m of lateral camera travel. It moved 78.8 px horizontally against
79.8 px predicted, with 3.2 px median absolute horizontal error and no
reversal in the sampled direction. The desktop Chromium software renderer
tracked four samples over 1.74 m, with 72.2 px observed against 73.6 px
predicted and 3.4 px median error. Both routes returned through the foyer
and verified that the scoped art became inaccessible outside the room.
Cuevanico's separate uninstrumented walk measured 33.3 ms median and
50.0 ms p95 across 388 intervals. Capture overhead was outside that
measurement.

In the emulated touch viewport, tapping the doors and using the actual
virtual stick also completed the round trip. The visible highlight moved
in the expected direction across six samples. At the end of the walk the
projected center crossed the left edge of the 214 × 464 buffer. The visible
crop still contained the right side of the highlight, so its centroid was
not a measurement of the full highlight at those poses. These tracks
qualify the pendant reflection at specific camera poses. Whole-room
temporal stability and physical mobile fidelity still need separate
evidence.

The three appearance alternatives were then compared at those same eight
camera poses and 561 × 374 pixels. The Cycles target uses the editable
combined Blender finish and the exact camera transforms. The browser
fixture verified the composed camera for the served UV/PBR appearance,
the older live floor-splat hybrid and its identical-shell mesh control.
The learned full-room splat used the same projection in its standalone
renderer. The hybrid and its control each turned the mounted archive,
returned through the foyer and lost access to their scoped art. The
hybrid drew 46,089–48,655 floor instances at these poses from its
70,224-point asset. Replacing the floor changed mean absolute display
luma by 37.9 levels in the foreground floor crop and by 0.02 in the
sampled back-wall strip of the same shell.

| Appearance | Floor luma error | Error in frame-to-frame luma change |
| --- | ---: | ---: |
| Served layered Orbital UV/PBR | 15.59 | 5.14 |
| Learned full-room splat | 22.42 | 8.89 |
| Older mesh control of the hybrid | 25.40 | 9.44 |
| Live floor-splat hybrid | 47.45 | 11.56 |

Both columns report mean absolute differences from the Cycles floor crop
on a 0–255 scale. The second compares successive image differences at
the recorded poses. It includes brightness and highlight placement and
does not measure high-frequency shimmer. The hybrid uses a different room
finish, which is why its same-shell control is retained. The new numbers
measure the foreground floor, rather than the entire scene. Within that
crop the served finish is too dark, particularly in the reference pixels
below luma 80, where it averages 19.3 levels below Cycles. Test the floor's
diffuse shadow response before increasing specular intensity.

Cuevanico independently replayed the path in the pure-splat viewer at
66.7 ms median and 83.4 ms p95 across 90 intervals at the same buffer
dimensions, with JPEG capture outside the timed replay. This measures
camera rendering and sorting only. The previous physical interaction
measurements used the normal room runtime and locomotion.

The next Orbital candidate adds a small, bounded shadow-fill term to the
floor diffuse light through the existing room-look manifest. It fades
toward illuminated stone and shares the baked floor's grout response.
The three reflection emitters and the geometry and maps are unchanged.
The term is optional and absent in older manifests.

On the eight walking poses the floor luminance error dropped from 15.59
to 7.21 levels and the dark-pixel bias moved from −19.33 to +0.53.
The error in frame-to-frame changes improved from 5.14 to 4.73. Four
additional cameras from the sides, doorway end and worktable end used
Cycles references and a Blender ray mask for visible floor pixels.
The mask excludes the volume boundary while the color reference keeps
the authored atmosphere. The candidate improved all four views and
reduced the combined floor error from 22.60 to 12.61 levels. A stronger
test fill over-brightened shadows by 12.36 levels. The selected fill
limits that bias to +1.18 while the brightest held-out pixels still
average 15.03 levels below the reference.

The isolated 32,061,440-byte package `b9e0387b42bf` passed the physical
Cuevanico door, rotating archive and 24 camera-clearance checks. It took
10.10 s to enter cold through the test tunnel and measured 33.3 ms median
and 49.9 ms p95 over 396 walking intervals. The pendant reflection still
moved in the expected direction over eight samples, with a 3.6 px
median horizontal error against the geometric projection. At that comparison, the deployed
package was `d65e90d37ca9`.

The next candidate adds the warm entry light and ceiling soft return to
the view-dependent floor reflection. Their positions, orientations and
sizes come from the editable Blender scene. Ray projection of the previous
three sources found that 2,608 severely underexposed reference highlights
lay outside their main footprints. The entry and ceiling sources covered
62% and 36% of those pixels respectively at the same lobe threshold.
The five-source look improved the masked four-camera floor error from
12.61 to 10.76 and the bright-pixel bias from −15.03 to −7.59. On the
eight walking-camera poses, the foreground error was 7.15 and the error
in successive luma changes was 4.72.

The rebuilt `1a8ab781ac35` package matches the tested stage byte for byte
and retains the 32,061,440-byte archive size. Cuevanico entered cold in
9.64 s and measured 33.3 ms median and 50.0 ms p95 over 380 walking
intervals. Seven samples tracked the pendant reflection with a 3.3 px
median horizontal error. The archive turn, all 24 corner checks and
the foyer return passed. A desktop writer and emulated-touch visitor
also kept independent appearance and rotation on the shared exact
worktable edition, including the part reference, clear and actor-specific
revocation. Open connections on the served room deferred activation
during the proposed Legion trial. The current and rollback packages both
remain available.

A reverse-facing reference camera exposed a bright void through an
opening in the authored shell. In the served runtime, the ray at the
white center intersects the transparent collision surface and then
`SkyShader`, with no visible surface between them. The authoring
reference renders a solid threshold there. In the tested room
projection, the actual passage back to the foyer is on the opposite
wall. This is a visual continuity gap in the shell.

Human review on Legion confirmed the current room appearance and called
out both the granular turntable as the material benchmark and object
disappearance on approach. The old shelf client discarded representatives
beyond 5.8 m or outside the nearest three. The archive used the same
distance cutoff. The candidate keeps a geometry tier on the mounted
Collection shelves and archive, and promotes detail based on projected
screen size, proximity and a hysteresis band. It processes one shelf fetch
at a time and releases both tiers at room exit or an edition change.
Existing edition authorization, anchors and interaction distances are
unchanged. The archive's contact shadow follows the visible mesh tier.

Fable 5.2 at high effort reviewed this approach and recommended generating
source-digest-pinned far meshes offline when project representatives are
published. The current fallback derives its one-draw reduced mesh once
from the authorized representative, so already-published projects can use
it. Offline generation and the budget for other display types remain
separate from this Collection change.

The layered Orbital look restores the source material's small-scale
variation on the merged case, shelving, wall and work surfaces using
authored role IDs, meter-scale tiles and a footprint fade. The authored
albedo and normal sources supply the detail; the original lighting and
turntable textures remain intact. The two room-scoped textures total
276,969 transferred bytes. Registered close captures show a material
difference on the blue case and gray shelves, with variation by surface.
The candidate archive is 32,348,160 bytes and remains below the 32 MiB limit.

Cuevanico verified the 4,189-triangle test representative at both mounts.
Each far mesh drew 117 triangles. Approaching restored the full geometry;
backing away restored the reduced mesh with zero repeat model requests.
The final package entered cold in 9.96 s and measured 33.3 ms median and
50.0 ms p95 over 321 moving intervals. At that check, the candidate was still awaiting scoped activation.

The authored rear opening and the two corner seams now have a separate
opaque infill in the focused appearance. Blender and the room projection
read the same part dimensions and palette. The projected parts are
noncolliding, and the passage remains on the opposite wall. At the
original reverse camera, the center of the white opening measured 234.9
display luma before the change, 50.8 with the panel and 46.5 in Blender.
Both seams also darkened. The browser rays through the aperture first
hit the new opaque dressing. The browser fixture returned through the
actual foyer door and verified that the five scoped appearance maps
were unavailable outside the room.

Cuevanico verified the exact combined package with the infill, detail
tiles and Collection reductions. Cold entry took 9.53 s. The 357 walking
intervals measured 33.3 ms median and 50.0 ms p95. The reduced models,
archive turn, camera clearance and return passed. The 32,348,160-byte
archive `2009ff26ca7b` was later activated in the existing protected service.
See the selected receiving release for the exact production readback and rollback.

The same package also passed the emulated touch round trip with
actual door taps and virtual-stick input. A desktop writer and an
emulated-touch reader shared the exact worktable edition, kept
independent rotation and appearance, and verified the part reference,
clear and actor-specific revocation using controlled identities.

The preceding source `a7d556b` served package `2f68982b6294`, with
`52e35e6d6b2a` as its rollback.
Manipulación de Materia now uses the Blender pass inspired by the appearance
study. Warm fixture bounce and contact shading are embedded in the limestone
floor texture. Bulbs, windows and oak define the cool-to-warm contrast.
The exact room art is 164,006 bytes over Brotli. The isolated Chromium route
verified keyboard clearance at the worktable and cabinet. Emulated touch
verified the Matter portal, cabinet rotation, exact archived edition, restore
to shelf, retained placement and return through the same authored foyer.
At the same desktop camera and lightweight software graphics setting, the
prior release measured 167 ms median per frame and the new package 150 ms.
This single comparison does not establish physical-device performance.
Receiver readback matched 64 payloads, 20 protected HTTPS responses and
eight scope denials. Configuration, layout, Collection state, avatar choices
and native turn files matched their pre-release hashes. Main room readback
showed only participant presence events and unchanged entities and nodes.
[Player-height capture](../art/collection/player-height.jpg).

Package `52e35e6d6b2a` used source `372644a`. It included exact worktable references on their native
return lane and the short landscape Conversation adjustment. Readback matched
64 installed payloads, 20 protected HTTPS responses and eight scope denials.

Package `717ab15e74b7` used source `4e0140b`. Manipulación de Materia uses the finished Blender revision with embedded stone,
oak and limewash textures, dressed windows, cabinetry and wayfinding. The
static export reduces the unbatched design from 122 to 20 render primitives
and serves as a 103,572-byte Brotli asset. The same browser route qualified
normal and lightweight graphics, passage return, table and cabinet clearance,
and access denial after exit. The isolated touch fixture used the authored
Atelier portals and rotated and restored an exact archive edition. In the
software-rendered lightweight fixture the prior median was 133 ms per frame;
the finished model measured 150 ms, down from 167 ms unbatched. Physical
device performance remains unmeasured for this revision.

Package `17703a02cdef` used source `68dc721`. Indoor garden authors can start from a two-circle solo design or a four-circle
cooperative design through the owned native lane or the paired editor. The
live native owner drafted both presets in Taller Sensorial. The browser
fixture previewed privately, published the four-circle layout, recovered the
accepted write after a lost response, and completed the round with desktop
and touch fixture players. Existing garden saves keep their original schema.

Package `940a0b053757` used source `5e44d7f`. A visitor can carry the selected shelf model to their own worktable view
and click or tap a visible part. Desktop and emulated touch Chromium carried
an actual restored edition from the shelf, selected its full geometry and
prepared an exact part reference with the fixture Conversation receiver.
The prior package `7bec67084ea3` used source `43b3d6e` for historical
inspection and sharing. Source `75f202b` added the placement refresh stream. Receiver readback matched 64 installed payloads, 20 protected HTTPS
responses and eight scope denials, including the new stream outside room
authority. The two-browser refresh timing was measured in the isolated fixture.

Package `7581493a9cfd` was built from `e60627d` and expanded the live graph.
Atelier layout revision 4 adds Manipulación de Materia as the third foyer
passage. The five prior rooms and their grants remain in the graph. The installed
selection has three current project groups, two historical archive editions,
and six exact representative entries. The real native owner entered from the
foyer, observed the worktable and archive, and returned to its starting place.
Readback matched 64 installed payloads, 20 protected HTTPS responses and
seven expected scope denials. A protected human browser visit is separate
from this native and technical receipt.

The preceding package `36f3a9e52819` was built from `80db308` and initially
had `6efba4f288ac` as rollback.
The installed reader accepts both independently scoped foyer portals and
includes the Matter shell, shelves, archive, table and exact part context.
The expanded plan exercised both portal addresses in the receiver fixture.
That initial deployment retained the prior room graph as preparation for the
expansion. Readback matched all 64 runtime
files and 20 protected HTTPS responses. The layout and tracked creation
checkpoints matched pre-deployment hashes. Root checkpoint changes reflected
ongoing presence events.

The preceding source was `aa7fa49`, package `6efba4f288ac`; its rollback
was `15a8b042040a`.
The prior bundle reproduced “Room connection changed” when desktop and touch
Chromium used separate sessions of the same authorized identity in the foyer.
That bundle rendered both in the room with the same persistent actor
identity and separate sockets. The room counts one semantic participant. An
induced real cross-identity handshake rejection showed the localized retry
and recovered the same room after the simulated fault cleared. The qualified
bundle matched all 62 receiving files and protected HTTPS checks. The physical
phone has not been retested. Nicolás reported that lightweight graphics improve
his Raspberry Pi experience, without a measured frame rate.

The preceding release was source `3db4981`, package `15a8b042040a`;
its rollback was `ad5230b3c7b1`.
The entry screen and canonical URL can select lightweight graphics before the
first rendered world frame. Touch Chromium measured a 214 × 464 backing buffer
on a 390 × 844 CSS viewport, with multisampling and dynamic shadows disabled.
It walked with the ordinary joystick and kept the same authenticated actor.
The automatic desktop fixture kept antialiasing and keyboard movement. The
lightweight renderer and URL selection survived the Sensorial portal round
trip, a deliberately delayed room model and a separate failed entry retry.
Physical device performance is still separate. All 62 runtime files and
protected HTTPS matched, with unchanged tracked receiving checkpoints.
[Graphics qualification](visual-play.md#lightweight-graphics-at-entry).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`1c74364`, package `ad5230b3c7b1`; rollback was `b8270bcb062f`.
The assigned avatar now renders when the optional texture worker fails,
is unavailable, or times out. Touch Chromium rendered the assigned
skinned model with all four injected faults and in the healthy case.
A separate desktop and touch pair saw the same assigned appearances in
the plaza and inside a room, with the touch client's worker failing.
Physical phone behavior remains a separate observation.

The first activation reached the 128-receipt boundary. The scoped Homes
limit is now 256 for Holodeck, preserving both receipt histories, the
existing grants and the 4,096 aggregate limit. The original request
completed as Holodeck's 129th receipt. Protected HTTPS and all 62 packaged
files matched. Room-position checkpoints advanced during the rollout.
[Rendering checks](visual-play.md#avatar-loading-with-limited-worker-support) ·
[Scoped receipt repair](https://github.com/nicoechaniz/daimon-cluster/pull/552).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`4392b8e`, package `b8270bcb062f`; rollback was `dd19ca2d3d67`.
Only the shell and browser bundle changed. The explicit **Cerrar contenido**
action preserves a dirty Nexus fixture and closes a clean visit from the
world. In the packaged Chromium trial the visitor then left the lab through
the ordinary door in the same renderer. Holding the protected room mesh kept
the passage visible and the canvas hidden until the scene could be rendered.
The historic workshop-to-foyer landing also matched. The marked-exit arrow
tracked the camera and cleared when crossing.

At 1600 × 900 CSS pixels, a matched SwiftShader trial reached an 880 × 495
backing buffer and 72 draws at the lowest tier, compared with a 1600 × 900
buffer and 146 draws in the previous package. The median of 12 frame
intervals was 554 ms versus 686 ms. The shell recovered from a blocked
authorized location request in 390 × 844 touch Chromium and reached the
world after an explicit tap. It also loaded without two optional browser
APIs. The Raspberry Pi and actual phone observations remain separate.
All 62 installed files and 19 protected HTTPS checks matched. Tracked
receiving checkpoints were unchanged.
[Player-height and failure checks](visual-play.md#entering-a-room-on-a-slow-device).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`a0b714b`, package `dd19ca2d3d67`; rollback was `ad811d21a9cd`.
The only runtime file changed is the browser bundle. The published
client uses compact spatial nameplates for nearby peers. Two simulated
Chromium participants saw each other's name and distinct outfit outside,
inside and after reconnect. A fixture renderer call verified the separate
local chat bubble. The protected HTTPS response matched the exact client
bytes. World semantic data and tracked grants matched. The presence event
and saved visit positions advanced during deployment.
[Matched player-height review](visual-play.md#spatial-player-nameplates).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`5ed04de`, package `ad811d21a9cd`; the compatible rollback was
`f0e7e98fa781` from `43ed460`. The actual Casa owner selected the new
Blender-authored Materials Workshop for Taller Sensorial and read back
its exact receipt at design revision 2. The previous design checkpoint
matches revision 1. The layout, room access, garden state and other
tracked checkpoints were preserved. Two simulated Chromium participants
verified the protected art hash and 15 rendered materials. A paired
editor recovered its single garden write after response loss, a separate
visitor completed the game and revocation removed editor access. The
prototype furniture has no attached Sensorial telemetry or device controls.
[Workshop at player height](../art/owned-rooms/sensorial-player-height.jpg).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`a2065ca`, package `aded7e3a47ab`; rollback was `6f8b29367e82`.
The Spatializer and Weaver benches can each request one current service
status from the existing Harmonic Lab panel. The response is a short,
expiring summary selected for the current bench. Reading it sends no
start request. Packaged Chromium verified the two tool summaries, an
access refusal, and normal panel open/return on desktop and simulated
touch. The controlled selected Weaver panel separately sent one start
after explicit activation to a simulated launcher. In production the
owning status service reported one workstation without a response, so
physical device readiness and output remain unconfirmed. Protected HTTPS,
runtime files and tracked world checkpoints matched.

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`7ab2e36`, package `6f8b29367e82`; rollback is `7961787f8543`.
Casa's actual owner granted the currently selected paired human garden
editing in Taller Sensorial. The grant alone was written in production.
Current room admission, the explicit grant and canonical pairing are
rechecked before a browser publication. In the packaged Chromium trial
a simulated pair edited locally, lost the response after the one write
and recovered the human-authored receipt. A separate visitor saw only
the published game and completed it. Revocation removed the editor.
The live installation and protected HTTPS matched the package.
[Editor at player height](../art/compaii-house/redesign/review/paired-garden-editor.jpg).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`8cfd18a`, package `7961787f8543`; rollback is `190fce2fde22`.
The indoor map tracks the player and camera heading and highlights only
current authorized doors. In packaged Chromium a desktop visitor marked
the Sensorial portal, walked up to it, crossed with E and returned to the
same anchor. A separate simulated touch visitor could mark the exterior
threshold and saw no restricted portal. The running desktop map purged
that destination after access was revoked. A receiver test also checked
longer-route access loss exposes the existing emergency return without
changing the immediate exit list. HTTPS and retained checkpoints matched.
[Desktop](../art/compaii-house/redesign/review/room-map-desktop.jpg) ·
[Emulated touch](../art/compaii-house/redesign/review/room-map-touch.jpg).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`edc50a1`, package `190fce2fde22`; rollback is `5238eae47181`.
A situated original can keep the acknowledged indoor visit's exact placement
revision alongside its room and object reference. Holodeck checks the
speaker's actual Nexus edition access and retains an opaque room reference
without transferring the source pin or content to the native recipient.
The focused receiving trial matched a versioned fixture after movement
and omitted its reference on source denial. The packaged desktop and touch
trial also passed the shared garden and canonical Conversation return with
simulated participants and a fixture reply. Protected HTTPS and retained
world checkpoints matched. The private Sensorial bench has no selected
browser-readable edition on this route.
[Conversation contract](shared-conversation.md) ·
[Sensorial source boundary](sensory-integration.md#taller-sensorial-receiving-boundary).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`182e0f4`, package `5238eae47181`; rollback is the expansion-compatible
reader `abcd47bebe5c` from `54e16f3`. The actual owner opened the furnished
Taller Sensorial via the foyer's second slot. The live layout and design
read back as revisions 3 and 1; production changes were limited to the
Atelier plan and its design. The opening uses the previous foyer/gallery
audience intersection. The original room addresses, links and access remain
in force. In the packaged Chromium trial one simulated visitor walked up
to the authored fitting, crossed with E and returned to the same foyer
anchor in the same renderer. A separate visitor received neither the fitting
nor passage access. A restart using the compatible reader restored an added
room with its saved furnishings, game and visit position. No Sensorial data
or devices are attached to this room yet.
[Portal at player height](../art/compaii-house/redesign/review/foyer-sensorial-portal.jpg).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`e4e10c4`, package `2368984d62cf`; rollback is `923fc4da0bb4`.
The actual CompAII native owner adopted the four existing authored rooms at
revision 1. Reading the live plan and exact receipt confirmed the original
room records, including their links and guest lists. Only the separate
Atelier layout checkpoint changed. In receiving tests, the visitor's
active foyer scene and exits stayed identical, the lab stayed denied,
a foreign owner could neither draft nor publish, and a restart recovered
the receipt while the current receiving grant still determined guest access.
The prior package reads the unchanged receiving plan if selected for rollback.
The new foyer portal still needs an authored fitting and a compatible rollback
reader for saved room designs and games.
[Owner workflow](houses.md#publish-an-owned-plan).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`569deeb`, package `923fc4da0bb4`; rollback is `b3bf0f8950d2`.
An eligible owner can draft a starter home or extend one room through the
existing native world port, then publish the returned command explicitly.
A receiving fixture used a separate simulated visitor to traverse the added
portal, reconnect there after a service restart and return through the same
opening. It also verified foreign-owner refusal, access revocation and recovery
of the original publication receipt. The deployed service passed protected
HTTPS and installed-file verification, with retained world and authoring
checkpoints matching through deployment. This release keeps the current
Casa de CompAII on its deployment-selected layout.
[Creator workflow](houses.md#publish-an-owned-plan).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `61a531c`, package `b3bf0f8950d2`. A scoped visit keeps its
loading cover while the inert renderer starts. The world pauses its
drawing submission during that opening and resumes on return.
A packaged loopback trial with the real Nexus and Homes renderer and
the exact published source verified camera control, no change of world
position, resumed drawing and denial for another simulated identity.
Protected HTTPS, all 60 installed files and retained world digests
matched. Rollback is `ed35282aa7c8`. Production participant use
remains separate. [Visit qualification](visual-play.md#opening-a-protected-3d-exhibit).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `64fecdc`, package `ed35282aa7c8`. The north approach and raised
bridge use the Blender-authored limestone, basalt, oak and copper
finishes. The browser fixture verified both model responses and the
physical crossing in both directions. Lowering removed the raised finish
and left the gap open. Protected HTTPS, all 60 installed files and
retained world digests matched. Rollback is `bcac0a232755`.
[Player-height comparisons](../art/compaii-house/redesign/mirador.md#finished-movable-crossing).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `d9e2f14`, package `bcac0a232755`. The facade and two garden
models load after the initial exterior is playable. The staged stream
retains the same scope and topology. Packaged browsers verified first
movement on touch and desktop, entry and return at the house, and the
previous client against this server. In network-limited software Chromium,
first movement measured 9.50–9.87 s versus 11.48 s before. Protected HTTPS,
59 installed files and the retained world digests matched. Rollback is
`b7539eba9652`. [Arrival measurements](visual-play.md#progressive-exterior-arrival).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `0ef7d80`, package `b7539eba9652`. The exterior avatar spawns
at the terrace surface. Packaged Chromium verified the grounded
first frame, movement with WASD and emulated touch, and the house
door round trip. The software render delay remains measurable.
All 59 installed files, protected HTTPS checks and the retained
world digests matched. Rollback is `c8b9be33abd57`.
[Startup measurements](visual-play.md#spawn-on-the-arrival-terrace).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `542b509`, package `c8b9be33abd57`. The optimized Blender
facade transfers 1.09 MB with Brotli, 40.3% below the prior variant.
Geometry, material bindings and the door anchor match, and the
packaged Chromium fixture walked through the foyer and back.
All 59 installed files, protected HTTPS representations and retained
world digests matched. Rollback is `090f9dfbbc07`.
[Facade and arrival measurements](visual-play.md#optimized-exterior-facade).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served
source `28494e0`, package `090f9dfbbc07`. The five bundled locomotion
clips transfer 690,901 fewer bytes and keep identical decoded assets
and range support. All 59 installed files and the protected HTTPS
identity and Brotli representations matched. The checked world files
kept their digests and scoped room art still denied the technical
reader. Rollback is `81df51cdebe9`. [Cold arrival measurements](visual-play.md#cold-arrival-and-locomotion-assets).

The [protected entrance](https://compaii.dmn.homes/holodeck/) previously served source
`ed51aee`, package `81df51cdebe9`. The touch renderer now adjusts frame
buffer density after sustained slow frames. In a matched software Chromium
comparison, the stabilized touch buffer held 75% fewer pixels and room
draw calls matched. The first foyer crossing fell from 4.66 to 1.69 seconds.
The same renderer, authorized warm scene, touch joystick and desktop WASD
passed the packaged fixtures. Protected HTTPS matched all 59 installed
files and the preserved world checkpoint. Rollback is `39e30c3c02ad`.
[Frame and passage evidence](visual-play.md#adaptive-touch-rendering)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves
`d45cede`, package `39e30c3c02ad`. The outdoor garden editor can retire the
current author's recipe after a named confirmation. Its draft follows
the retained command when a response is lost. Two independent fixture
profiles in sequential Chromium views exercised private preview,
creation, revision, foreign retirement refusal and owner retirement.
The touch-emulated author recovered two commands after their replies were
dropped, with one POST each. Reconnecting the visitor retained the
retirement and their planted light. Protected HTTPS and all 59 installed
files matched, and the retained world checkpoint kept its digests.
Rollback is `30ac6bf788e9`.
[Garden authoring](playable-creations.md#author-an-exterior-garden)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`48d1abf`, package `30ac6bf788e9`. The gallery portal now sits in front of
the east plaster wall, and both directions use a Blender-authored arch and
an access-filtered plaque and light. Independent Chromium desktop and
touch-emulated profiles crossed both ways in their original documents and
landed at the exact existing coordinates. The initially denied visitor
kept the same gallery art and received neither the active cue nor a tower
asset. Revoking gallery access from the tower removed the return cue and
kept the exterior escape. Restoring access restored the return.
The deployed 59-file inventory and protected HTTPS matched, and the
retained world checkpoint kept its digests. Rollback is `c5bbc4efbe77`.
[Portals at player height](../art/compaii-house/redesign/README.md#blender-to-webgl)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`1f4a383`, package `c5bbc4efbe77`. The gallery now has an oak drafting
bench, a stone and bronze central pedestal, and a flat-file archive. Both
room variants retain the same display anchors, colliders and material batch
counts. In the packaged Chromium trial, the permitted visitor walked the
open room. A separate limited visitor walked the sealed floor and could
not retrieve the open asset. A browser fixture then loaded the candidate
geometry with three authorized edition models, opened an exact edition from
its title plaque, returned to the same position and removed the archived
item after revocation. The served assets and 59-file inventory matched.
The retained world checkpoint kept its digests. The package is 29,992,960
bytes. Rollback is `e0d22d459d58`.
[Matched player-height comparison](../art/compaii-house/redesign/README.md#gallery-exhibition-bays)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`ecb2082`, package `e0d22d459d58`. In the gallery each authorized display
shows its stage and the title from the exact Nexus descriptor. Either line of
the plaque opens the corresponding edition. Long names fit the physical plaque,
and the exhibition list retains their full titles. In the packaged Chromium trial
the owner saw three editions, while the limited visitor saw only the finished
one and opened it by clicking its title. The viewer returned to the same position.
Revoking the archive grant removed its title, model and reopening action at
catalog renewal. The browser trial used simulated identities and sources.
Protected HTTPS and the installed 59-file inventory matched, and the retained
world checkpoint kept its digests. Rollback is `d92d749ca0bd`.

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`72b060f`, package `d92d749ca0bd`. The foyer has a Blender-authored gallery
plaque that reads from the approach past the pier. Chromium crossed with WASD
and E and returned to the same foyer landing in one document. A visitor
without gallery access kept the unsigned foyer and was refused the passage
and gallery-sign asset. Installed artwork, client and world digests matched.
The selected rollback is `dd6628e86392`.
[Foyer departure at player height](../art/compaii-house/redesign/README.md#foyer-entrance-to-the-gallery)

Source `98dddef`, package `dd6628e86392`, cleared the controlled avatar's
own nameplate from the view. Independent desktop and touch-emulated browsers
retained each other's labels and appearances outdoors, indoors and after
one visitor reconnected. The local chat bubble rendered above the avatar.
The protected client and installed inventory matched and the world checkpoint
kept its digests.
[Player-height comparison](visual-play.md#the-controlled-avatars-sightline)

Source `faedbdf`, package `7baeee4a660c`, gave the Beacon stair an authored
door and sign to the gallery. Chromium climbed the stair with WASD, crossed
with E and returned to the exact gallery landing in the same document. If the
visitor loses gallery access while still in Beacon, the server selects the
base laboratory and emergency exit and refuses the authored return asset.
Protected readback matched both Beacon variants, all 58 installed files
and the retained world state.
[Beacon return at player height](../art/compaii-house/redesign/README.md#laboratory-return-to-the-gallery)

Source `d14de6d`, package `07475f3bb3dc`, finished the oak
threshold to the foyer and an in-world floor sign. In paired Chromium
qualification, both fixture visitors crossed to the foyer and back by keyboard
in the same document. The visitor without laboratory access kept the sealed
gallery and could not retrieve the open gallery or Beacon asset. Protected
readback matched both asset revisions, the installed inventory and retained
world state.
[Gallery foyer doorway](../art/compaii-house/redesign/README.md#gallery-return-to-the-foyer)

Source `6045be8`, package `439002172ad6`, gave the gallery's authorized laboratory
stair an authored door and a legible floor sign. Chromium walked down,
entered with E and returned to the exact gallery landing in the same document.
A restricted visitor received the continuous floor and was denied the lab and
its assets. Protected readback matched both models, all 57 installed files and
the retained world state.
[Laboratory door at player height](../art/compaii-house/redesign/README.md#laboratory-door-and-sign)

Source `b68562d`, package `b9d7be97b791`, joined the gallery's end walls to the
pitched roof in both access variants. The side clerestory still admits the
same light. Matched Chromium views confirmed that the unintended end-wall
openings were closed. The installed asset inventory and world state digests
matched.
[Gallery roof review](../art/compaii-house/redesign/README.md#gallery-roof-joins)

Source `6b07de8`, package `dbcc946605ad`, kept the tower action hidden from the
gallery stair approach and becomes available at the tower's entry marker.
Scene preloading keeps its wider reach. Independent desktop keyboard and
touch-emulated Chromium clients crossed to the tower and back in the same
document. The installed inventory and protected client bytes matched, and the
world checkpoint kept its digests.

Source `9c42428`, package `996fdd11d758`, finished the laboratory descent with a closed
stair well and a legible tread edge. A simulated Chromium visitor walked from
the gallery entrance and used E to enter the laboratory and return to the
gallery landing in the same document. A separate restricted visitor received
the continuous floor and was denied the stair, open gallery model and lab art.
The receiving manifest matched all 57 files, retained world digests matched,
and protected HTTPS denied direct access to the room art.
[Descent comparison](../art/compaii-house/redesign/README.md#gallery-descent)

Source `6baba0e`, package `ee6605739077`, finished the opening of Casa de
CompAII with limestone, oak, brass and two lanterns. Its
parcel and entrance coordinates match the preceding release. A packaged
Chromium participant walked from the plaza, entered with E and returned to
the exact exterior anchor with the same document. Protected HTTPS served the
exact GLB in identity and Brotli, and the checked world files kept their
digests.
[Façade comparison](../art/compaii-house/redesign/README.md#parcel-entrance-review)

Source `fe60974`, package `f20f5adb9697`, gave the situated Conversation panel
more room to the reply while keeping the current room topic and close
button in view. The packaged Chromium trial read every line of the test
reply on desktop, two portrait phone sizes and a short landscape screen.
Closing and reopening preserved the same iframe and unsent draft. The
protected readback matched all 57 installed files and the prior world checkpoint.
[Panel qualification](visual-play.md#situated-conversation-panel)

Source `f168f96`, package `9a6e34467ee7`, established action discovery. The scoped room observation now offers
typed arguments for the next permitted passage and playable garden signal.
The combined packaged trial used the actual isolated owner and an actual
Codex model. The model followed the live observations without consulting
source or documentation, filled the missing signal once and retrieved the
same receipt. Both simulated browsers and canonical reply publication
agreed. The protected HTTPS check matched all 57 installed files and the
prior world checkpoint. Package `faae992dce4e` is the selected rollback.

The world consumer also rechecks a selected routed execution immediately
before mutation. Socket and bridge tests cover the old owner, missing or
invalid proof, a changed turn and terminal receipt recovery. The producer
passed the isolated Telecodex HTTP fixture with explicit destinations,
held admission, rebind, termination and fan-out. The routed proof remains
a source candidate until the owning native and bridge receivers adopt it.
Current receiving preflight found the local owner bridge and seven remote
bridges. Delta-only candidates passed the focused bridge tests. The local
candidate also constructed its existing Provider, Home and Nexus readers
under the actual service interpreter. The exact routed owner delta also built
against the installed root source and passed its isolated HTTP routing suite.
Per-receiver remote qualification and native owner selection remain outstanding.
[DaimonApp PR #1005](https://github.com/AlterMundi/DaimonApp/pull/1005) merged
as `d76fbd817` after all six applicable CI jobs passed. The selected master
tree matched the tested head. The routed bridges and compatible native owner
were selected for CompAII, Eko, Oliva and Emma. Four bridges still require
selection.

The root listener's compatibility build `e71c5e12bceb` contains the exact
merged production edits. The listener changed under the existing voice
admission fence while its independent Codex process and the dashboard kept
running. The owner readback verified the same physical turn with a fresh
collector receipt, and a preceding turn with its terminal outcome. All 49
session bindings and the paused or blocked goals survived the handoff. The
root bridge now serves module `9cc872d84a6a`. Its receiving socket resolved
the same canonical Conversation and refused a foreign actor. Current
configuration, Core and listener selections survived the bridge replacement.
Qualification submitted no human input, model turn or device command. Positive
production use of the newly selected routed turn path remains open.

The seven peer bridges each constructed the candidate in their real
service interpreter with their current Provider and Home authorization
configuration during preflight.
The native receivers use two current builds. Backporting the routed change
also required the live steering handle's physical-turn correlation from the
root source. Both compositions passed the isolated direct-routing HTTP,
owner and result tests. Eko and Oliva then selected listener `7d187ccd12c1`
and bridge `fa3447e8a311`. Both verified their canonical Conversation binding
and foreign-actor denial. Eko's listener was active at the expected revision
after the operator reported a companion PID change. Service-manager evidence
showed an independently scheduled Matrix restart, and separate readback
verified its exact listener, Core PID, goals and heartbeat controls. The
initial operator result is retained. Oliva's scoped handoff completed normally.
No new native input or model call was made.

Emma selected listener `3d4c85b09be3` and bridge `fa3447e8a311` in her
existing ITACA VM. Readback verified the same Core, goal accounting, heartbeat
controls, canonical Conversation binding and foreign-actor denial. The native
operator then used the existing CompAII and Emma read lanes to observe the
same world run under distinct, registered being identities. This was a
read-only foreground check. The four remaining receivers are on the host
covered by the existing shutdown and service-stop hold.

Source `23de47f`, package `faae992dce4e`, established the HUD input correction. The exterior reference card passes
pointer input through its inactive margins while its action buttons
remain interactive. In Chromium the margin no longer consumed the
pointer aimed at the next world object after a confirmed indication.
The protected HTTPS check matched all 57 installed files and the prior
world checkpoint. Package `685aa8875b4b` is the selected rollback.

Source `a356c63`, package `685aa8875b4b`, added the coastal view. The tower's authored east clerestory now
opens visually onto the same coastal sky as the commons. The packaged
player-height trial saw the panorama through the seven window bays, returned
to the opaque gallery through the existing E-key portal in the same
renderer, and verified the opaque lab backdrop. The protected HTTPS check
matched all 57 installed files and the prior world checkpoint. Package
`9c74540f56f0` is the selected rollback.
[Visual qualification](visual-play.md#tower-east-clerestory)

Source `a347c29`, package `9c74540f56f0`, established the tower walk-up. The tower's authored resonator sill
now stops the avatar before it intersects the wood. In the packaged
Chromium trial the avatar walked to the sill and stopped at room Z 4.995,
then returned to the gallery by the existing portal and keyboard action.
The GLB, portal arrival and audience remain on their prior selections.
The protected HTTPS check matched all 57 installed files and the prior
world checkpoint. Package `13e918610edb` is the selected rollback.
[Visual qualification](visual-play.md#tower-resonator-walk-up)

Source `a4dd8f7`, package `13e918610edb`, established receipt recovery. An indoor garden receipt remains
readable under the original native turn after canonical completion and
source release. The packaged two-browser trial recovered the same exact
receipt after the canonical reply. The socket integration checks also
verified ledger reopen, current binding and access, sibling isolation,
read-only completion and bounded eviction. The predecessor can read an
active preparation in the additive ledger; it leaves the index unused
and its next ledger write can drop the index. The protected receiving
check matched all 57 files and detected no change to the prior world
checkpoint. Package `a89de8821e78` remains the selected rollback.
[A closed turn's receipt](shared-conversation.md#indoor-source-contract)

Source `73bda34`, package `a89de8821e78`, established the situated approach. A working indoor Conversation can now
return the next permitted passage to its captured room. The daimon can
take it explicitly through the same native interaction. The package trial
used the installed Conversation client and native world CLI with two
independent simulated participants. The original remained bound to its
first topic while the human walked. The native CLI used two authorized
passages, placed the matching signal, and recovered its exact receipt.
Both browsers saw the completed garden and the canonical client showed
the associated fixture reply once. The later foreground model qualification
is recorded above. Tests refused off-route, stale, terminal
and foreign-original movement. The protected runtime matched all 57
installed files and prior world checkpoint bytes. Package
`466151c5c732` remains available for recovery.
[Native use](native-integration.md) · [Source and trial contract](shared-conversation.md#indoor-source-contract)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`f9c9885`, package `466151c5c732`. On interruption of indoor presence,
Holodeck suspends visit discovery and cancels stale room prefetches. With
the grant still valid, the same room and Nexus draft can resume. If the
world still admits the player after a room grant is withdrawn, the server
releases the denied saved room position and returns the player outside.
The draft stays hidden within the same page until the player deliberately
re-enters the original room and the exact source is authorized again.
The packaged Chromium trial observed both paths, a refusal at the former
lab-art URL for the removed visitor, unchanged lab access for a second actor,
and the original draft after re-entry. Nexus authorization used a
controlled receiver. One software-rendered run exceeded its exterior
readiness deadline. The exact package passed the repeat with background
rendering throttled and a longer deadline. Physical device timing
remains open. All 57 installed files and protected HTTPS matched
the selected candidate, and protected state matched its prior bytes.
Package `2cf1afb29358` is retained. [Visit recovery](content-visits.md#acknowledged-visit-boundary)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`b3ea542`, package `2cf1afb29358`. A scoped visit can keep its unsaved
work while the world cannot confirm access to the source. In the packaged
Chromium trial, an authorized dirty visit prevented a normal exit. After
the exact edition disappeared from the authorized catalog, six in-world
door crossings reached the plaza and brought the visitor back to the
original lab. The frame stayed hidden, the renderer stayed mounted and
no additional close request was sent. The restored authorization reopened
the same frame with the original draft and no viewer reload. Tests also
refused an independent reader and excluded a delayed stale visit reference
from Conversation. This used controlled identities and a controlled Nexus
viewer. The deployed HTTPS client and 57 installed files matched, and the
protected world checkpoints matched their exact prior bytes. Package
`88a4fc3935ff` is retained for recovery.
An independent exterior report test verified eight immediate returns,
desktop movement, emulated touch movement and draft preservation.
[Visit recovery](content-visits.md#acknowledged-visit-boundary)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`8145102`, package `88a4fc3935ff`. A Blender-authored limestone plaque
marks the actual prototype on the Beacon pedestal. The same station identity
now resolves revision 2 at the plaque in geometry, scoped visits and situated
Conversation. HTTP and native-capture tests checked the prior revision,
unchanged source pin and protected catalog. Two independent Chromium actors
verified walking into reach, opening the exact edition through a controlled
Nexus receiver and returning to the same position. The second actor could
see the physical station but had no edition access. Revocation removed the
first actor's visit action while room access remained. The live technical
Home reader received 401 from the real Nexus descriptor, so this run records
no new live viewer acceptance. HTTPS and all 57 installed files matched
the package, including the decoded room mesh. Semantic checkpoints matched
their pre-release bytes. The selected predecessor is `690d2406031c`.
[Player-height plaque](../art/compaii-house/redesign/review/beacon-prototype-plaque.jpg)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`81a26e5`, package `690d2406031c`. The Beacon lab has separate
Blender-authored instruments for Spatializer and Weaver, with legible
nearby actions. Two matched Chromium packages preserved the stair both
ways, the original bench positions and renderer, and the two exact panel
routes. The final touch fixture walked to both benches, opened the
existing panel frontend against controlled readiness data, and returned
to the same positions. The existing device authorization still applies.
HTTPS, 57 installed files and the installed decoded Beacon mesh matched
the package. Semantic state remained byte-for-byte equal. The exact
predecessor `0f4587163293` is retained and passed the matched route in
isolation. [Player-height comparisons](../art/compaii-house/redesign/README.md#beacon-joinery-and-workstations)

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`9a7880a`, package `0f4587163293`. Each human can save or reset their own
avatar appearance from the plaza or inside a house. Chromium with two
independent identities verified distinct automatic appearances, a live
peer update and the selected mesh response in the same renderer, touch
selection in the foyer, and recovery in a fresh browser session after
restart. Protected HTTP tests refused the wrong origin, substituted
identity and foreign write input. The technical reader matched the
deployed HTTPS client and 57 installed files. The protected semantic
checkpoints matched their exact pre-deployment bytes. The immediate rollback
package `4c8be4dc262a` admitted a fixture actor without writing over the
new choice checkpoint. [Retention and recovery](deployment.md#resource-bounds-and-lifecycle)

The central bridge now checks each verified world actor against the
current registered Holodeck App and exact retained Home source. Requests
from the actual application UID proved CompAII's and Oliva's selected
editions and refused both cross-owner substitutions. The same web package,
Nexus editions, world and visitor permissions remain selected. Oliva's
proof establishes ownership only. Her own parcel and authored room are
still required for a real placement. [Source authority contract](deployment.md)

In the packaged browser trial, two simulated owners authored separate houses
and placed their own exact editions with a controlled Nexus receiver. Each
placement left the exterior node count intact. Independent keyboard-and-mouse
and touch profiles opened their authorized editions and returned to the same
position. Revocation, foreign write and receipt denial, renderer reuse and
receipt recovery after restart all passed.

The [protected entrance](https://compaii.dmn.homes/holodeck/) serves source
`6288561`, package `4c8be4dc262a`. CompAII updated the finished gallery
display from revision 1 to 2 directly from the same owned Nexus pin and
recovered the receipt. The owner command refused an unretained edition.
Outdoor nodes and canonical world matched. Packaged Chromium exercised the
direct placement and a limited touch visit with a controlled Nexus protocol.
Authenticated receiving matched 57 installed files. The prior package
`97a2bb3fe1b7` read the live v1 checkpoint and receipt in an isolated test.
[Placement contract](houses.md#place-a-room-exhibit)

The previous exhibition index release served source `a709490`, package
`97a2bb3fe1b7`. Visitors can search room exhibits by
the authorized Nexus title or stage and open an exact edition from their
current position. Near a plinth, the existing world action stays available.
Two packaged Chromium profiles exercised the list and physical displays.
The limited touch visitor saw and fetched only the finished fixture. The
index route returned to the same avatar position, and a separate browser
test verified title search without accents and cleanup on revocation.
The Nexus auth and editions in these browser trials were controlled.
Authenticated HTTPS matched the exact client and 57 installed files.
World and protected checkpoints matched. Package `e67257c79677` is the
compatible rollback. [Gallery visit contract](content-visits.md#walkable-gallery)

The previous threshold and facade release served source `2580dcf`, package
`e67257c79677`. Physical entrance now lands inside the
foyer and looks into the room. Return still lands at the exact outside
door. This corrects an observed Chromium route where the avatar kept the
old exterior coordinate after entering. The outdoor sunlight no longer
leaves the measured triangular artifact on the oak and limewash of Casa
de CompAII. Matched Chromium views retain contact, roof and cast shadows
at the same draw-call counts and shadow-map size. Authenticated HTTPS
matched the exact client and 57 installed files. World, room and other
protected checkpoints matched. Package `fead7d47e704` is the compatible
rollback. [Visual checks](visual-play.md#exterior-facade-shadow-finish)

Two separate simulated creators used their own native lanes to claim public
parcels, preview and publish plans, choose different Blender room kits and
place signal gardens and exact exhibits. Two independent Chromium profiles
used the physical doors, one with keyboard and mouse and one with emulated
touch. They played, opened the exact fixture editions, returned to the same
place, and used an interior door or an upper-floor portal. After a service
restart their locations, signals and the two author receipts recovered.
Foreign authoring and receipt reads were refused. Revoking exhibit access
removed the visit option while room access remained. Authorship and Nexus
access in this trial were controlled fixtures.
[Shared creator workflow](shared-roadmap.md#mmorpg-experience-and-creator-loop)

The previous exhibit-authoring release served source `149e8b0`, package
`fead7d47e704`. A room owner can read or preview a
pinned exhibit from the existing native route, then publish it separately.
All room catalogs now require the visitor's own exact Nexus edition grant.
Production-mode HTTP with controlled Nexus authorization exercised owner
preview, independent visitor denial and revocation, foreign write refusal,
publication and reconnect. Chromium exercised the scoped visit, exact viewer
acknowledgment, return and revocation with a controlled Nexus protocol.
Authenticated receiving matched the exact client and 57 installed files.
The canonical world and protected checkpoints matched. Package
`f4c140145f21` is the compatible rollback.
[Owner workflow](houses.md#place-a-room-exhibit)

The previous framebuffer release served source `a2cefb8`, package
`f4c140145f21`. The 3D buffer is bounded at 2×
density and 2.5 million pixels. At 390 × 844 CSS pixels and device ratio 3
it uses 55.6% fewer pixels, with identical scene draw calls and HUD dimensions.
In the matched software-rendered Chromium pair, first foyer entry took
4.05 s versus 8.04 s, and cached re-entry took 2.42 s versus 4.54 s. The
route stayed in the same renderer. Authenticated receiving matched the
client and 57 installed files, with the same world and Room checkpoint.
Package `1d7b90767013` is the compatible rollback.
[Frame and passage measurements](visual-play.md)

The previous room-topic release served source `6c8e54c`, package
`1d7b90767013`. The continuing Conversation inside a
room can now carry the explicitly selected fixture or workstation. The server
matches the current authorized object and freezes its revision at intake.
A Chromium trial using the installed Conversation client selected the listening
table, submitted, changed the next topic and walked while the attachment was
held. The first source still named the original table. The native port carried
out a garden signal under the admitted fixture turn. A separate HTTP trial
revised the furnishings mid-prepare and rejected a stale object selection
without adding it to the next source. The paired room permission remains
required. Gallery choices describe physical displays. The edition pin remains
behind source access. Authenticated receiving matched the exact served client,
57 installed files and the Room checkpoint. The previous package
`13604226f697` is the compatible rollback.
[Situated Conversation contract](shared-conversation.md#indoor-source-contract)

The previous gallery-interaction release served source `c1cc8c0`, package
`13604226f697`. Authorized gallery pieces and their
plaques open the exact Nexus edition with a click or tap from nearby. The
gallery rechecks access and revision before opening. The existing HUD visit
action still works. Chromium clicked three fixture models and a restricted
touch visitor tapped the finished piece and its plaque. Each visit returned
to the same location. The restricted visitor requested only the finished
edition, and archive revocation removed the display and resume option.
Authenticated receiving matched the exact client and all 57 installed files
with the world and room checkpoint preserved. The verified direct gesture ran
with fixture editions and identities. Package `d6f496475d18` is the
compatible rollback. [Visit contract](content-visits.md#walkable-gallery)

The previous terrain release served source `a70cd6e`, package
`d6f496475d18`. The three near islands and offshore
skerries now have Blender-authored cliffs and terrain with the existing
Commons basalt and meadow texture family. Chromium verified the three
player-height views, the raised bridge round trip and the open gap when
lowered. Authenticated HTTPS matched all 57 installed files and the exact
498,396-byte Brotli scenery. The Room checkpoint, western result nodes and
Signal Garden recipe matched. Package `90e9cfa41190` is the compatible rollback.
[Terrain source and running views](../art/compaii-house/redesign/island-cliffs.md)

The previous west court release served source `69ea465`, package
`90e9cfa41190`. The western landing now opens to a
Blender-authored limestone court with basalt seams and a seaward oak bench.
A short threshold joins the court to the pavilion apron. The runtime retires
four legacy paving batches and retains the existing coastal geometry, tree
meshes and water maps. Authenticated receiving matched all 57 installed files,
both exact revisioned GLBs and the protected world checkpoints. Native readback
preserved all west result node coordinates and revisions, including the original
presentation anchor. Package `d4953c7489df` is the compatible predecessor.
[West court source and walkthrough evidence](../art/compaii-house/redesign/gallery-island.md)

The previous workstation release served source `25258be`, package
`c968b95c4d77`. Both Harmonic Beacon workstations now
open the existing authenticated Harmonic Lab panel in the world, focused on
the selected tool. Closing it restores control at the same position in the
same renderer. The panel mounts only on request and detaches when dismissed
or when the workstation leaves scope. Its own access checks, service status
and explicit start are retained. The device interfaces still open on the
selected workstation through the panel's existing links.

Chromium walked to both benches and opened and closed them in desktop and
touch-emulated layouts using the exact panel frontend. One explicit Weaver
start received its matching simulated job and enabled the device link only
after readiness. Opening or closing a panel submitted no start. Receiving
matched all 57 installed files, the authenticated HTTPS client and the exact
world and room checkpoints. The panel's live access remains restricted to
its existing recipient. Package `62b735015133` is the compatible rollback.

The instrument repositories independently passed 16 Weaver replay/runtime
checks and 8 Spatializer preset checks. Synthetic motion produced nonzero
control targets, a master edit reached the simulated output at the new
revision, and pause cleared the targets. The Spatializer tests retained
the mix when restoring a legacy preset and rejected invalid filter values
before OSC.

A separate Chromium trial opened the Weaver panel from its Holodeck station,
used the panel's readiness link and changed Intensidad general in the built
instrument UI. The real configuration API committed revisions 2 and 3.
With the same synthetic motion source, all six control targets had zero gain
at revision 2. Restoring the original 0.45 brought nonzero targets back at
revision 3. The browser then closed the instrument and returned to the
original Holodeck view at the same coordinates. The launcher and the output
were simulated. The trial used the exact selected Holodeck package and built
Harmonic Weaver source `dc825ae` on loopback. Qualification on the physical
workstation remains distinct from this result.

The corresponding Spatializer station trial opened the built-in application
from its ready instrument link. Chromium changed the master from 0.90 to
0.89 through one real HTTP request. Both loopback OSC destinations received
the same float32 update. The separate simulated state readback showed one
changed value among 68. Invalid filter input returned HTTP 400 before any
OSC write. Closing the instrument and panel retained the avatar's coordinates
and the same renderer. Spatializer source was `94d41fe`. This trace covers
the browser and transport through simulated receivers.

The previous release served source `9e9734a`, package `62b735015133`. The foyer has an inset orientation table,
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

On 23 November, the exact predecessor `dd6628e86392` passed two isolated
creator journeys. Two Chromium visitors used keyboard/mouse and touch to
complete, edit and restore a native-authored signal garden in eight matching
browser and native checkpoints. A separate journey placed and revised
result nodes through the native CLI, kept the first edition and draft open,
denied a private visit and matched the exact result receipt after the edit.
The tests used explicit fixture identities, grants and an emulated touch
device. [Game evidence](playable-creations.md#packaged-two-player-game-check) ·
[Result visit evidence](co-creation.md#packaged-result-node-visit-and-revision-check)

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
writer, admission and final. The separate foreground model trial above used
a real Codex action and reply in this isolated scenario. The production
round trip still requires a genuine routed original and observed final.

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

### Continuous exterior and Weaver integration

The Atelier continuous-valley candidate replaces the island exterior with
authored terrain, a pond basin, ridgelines and a walkable cave. It retains Casa
de CompAII and its existing interior identifiers. Old outdoor fixtures and
trial houses leave the selected projection. Historical saves remain recoverable.
The editable terrain and two exports live in `art/world-layout` and the
existing exterior asset contract. The local lightweight Chromium trial walked
down the cave ramp and under the roof, returned to the surface, then walked
the trail into the original house and exited to the same exterior threshold.
The actual render showed the avatar inside the cave after the exterior camera
clearance was extended there. The scene and package passed local qualification.
The live service still uses its previously selected release. Touch and physical
device tests remain separate.

For Proyección's actual Weaver acceptance, the Holodeck station still launches
the existing Harmonic Lab control panel. The standalone A2UI/WebSocket loopback
qualification and the Legion accepting session are separate. The next bridge
mounts the pinned renderer at the Weaver station using the selected Lab
session's A2UI live and action routes. Acceptance must compare the applied
revision and state to an independent Lab control read, restore the reversible
change at the current revision, and preserve the player's location and inputs.
[Proyección Weaver host contract](https://github.com/AlterMundi/proyeccion/blob/1496887ee9e7fe118e839307210f0a3a3304c9a5/docs/conformance.md#weaver-host-contract).

The room look also selects the HUD palette in the host document. Apply
the palette only after the room's material selection succeeds, update
mounted controls in place and clear it when leaving the room. The
existing Matter worktable uses that palette. A Proyección surface
mounted in the same document can inherit the catalog's existing
`--a2ui-color-primary` property. The A2UI application mount and its live
action round trip remain separate from this presentation change.
The isolated `65537195d52c` package verified three distinct Matter HUD
palettes, local selection on two browser contexts, unchanged shared
worktable state, and palette reset on tactile exit. This package stays
local while the previously qualified appearance package remains staged.
