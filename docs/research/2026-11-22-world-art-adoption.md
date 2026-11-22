# Applying Scenario's art methods to the current Holodeck

The November 6 assessment selected Blender as a possible production tool; it did not establish a Scenario expert workflow in our renderer. The retained inventory says 97 documents were acquired and a subset inspected. Its Blender row explicitly says the runtime was not installed or qualified. Today's scenery is original procedural Three.js geometry, not a Blender/Scenario-produced environment. Reading that catalog was not sufficient adoption of its art direction.

This pass selects concrete expert methods for the current MML/Three.js implementation. It changes this document only: no scenery, application, Blender scene, build or deployment was produced here. Visual improvements and acceptance must be demonstrated by the implementation's actual browser captures.

## Sources and what was actually done

Current upstream was checked on22 November and pinned to [31fe04f80995f7191d1bddbf2bb7acd75c29a921](https://github.com/scenario-labs/skills/commit/31fe04f80995f7191d1bddbf2bb7acd75c29a921), committed21 November 23:59 UTC. The repository's [README](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/README.md) distinguishes paid Scenario-MCP generation from expert methods for locally installed DCCs. The latter do not require buying a Scenario generation job. They do require their actual target application to execute their helpers.

Selected primary documents:

| Skill/source | Method selected for this world |
| --- | --- |
| [Blender expert lead](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-expert/SKILL.md) | Establish scale/budgets, work from masses to detail, inspect several views and fix the current stage before adding detail. |
| [Environment](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/game-engines/roblox/scenario-roblox-environment/SKILL.md) | Compose the graybox from spawn, face the first landmark, time traversal and test real openings/collision. Roblox stud/light values are not MML settings. |
| [World building](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/game-engines/unreal/scenario-unreal-world-building/SKILL.md) | Place important landmarks manually, constrain secondary dressing and keep paths/curated areas free of scatter. Its Unreal runtime procedures are explicitly unverified upstream. |
| [Lighting](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-lighting-rendering/SKILL.md) and [critique](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-lighting-rendering/references/critique.md) | Establish a focal point, separate its grayscale value from the background, motivate the key and reduce competing brightness before adding lights. Inspect the shipped renderer. |
| [Previs](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-previs-storyboard/SKILL.md) and [critique](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-previs-storyboard/references/critique.md) | Give each view one readable fact, use player-height views, check occlusion and compare a small contact sheet before polishing. |
| [Blockout](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-blockout/SKILL.md) | Keep true metric scale, grounded reference figures and legible primitive identities. Its main purpose is guiding generated video; its saturated proxy palette is not a finished-world palette. |
| [Export](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/skills/dcc/blender/scenario-blender-export/SKILL.md) | Select GLB deliberately; verify scale, axes, pivot, normals, material/resource graph and actual loader round trip rather than treating exporter success as delivery. |

The selected Blender family README, lead/specialist files, two critique rubrics, environment lead material and license were retained with per-file SHA256. Total selected public acquisition including metadata is357,985 bytes, below the 2 MiB bound; no full clone, installer, hook or upstream script was run. The older 97-document manifest was located first; the bounded search did not locate its original expert files in the inspected retained-source locations. Those old hashes remain historical evidence, not today's source pin.

All selected material is under the upstream [MIT license, copyright 2026 Scenario Inc.](https://github.com/scenario-labs/skills/blob/31fe04f80995f7191d1bddbf2bb7acd75c29a921/LICENSE). Attribution/license must accompany any later substantial copied helper code. This document paraphrases methods; it does not install the catalog or treat upstream instructions as permissions. Upstream test/benchmark claims remain their reports, not tests performed on this host.

## What is available here

| Capability | Observed status and implication |
| --- | --- |
| Blender | No `blender` on the receiving PATH; no installed Debian `blender` package reported; no executable found in the selected standard `/opt`/local-share probes. Default Python has no `bpy`. No verified Blender execution route was found in the receiving capability map. We cannot truthfully claim to have run `bx_audit`, `bx_light`, `bx_previs` or `bx_export`. |
| Existing web pipeline | Local Node 20.19.2, Three.js 0.182.0 and MML client 0.28.0 are present. `tools/create-island-scenery.mjs`, `src/workshop-projection.mjs` and `src/world.mjs` already produce the asset/projection needed for the immediate composition pass. No new engine is needed. |
| Existing asset, read-only sample | During concurrent layout work the scenery GLB read 506,524 bytes, 6,932 triangles, 12 materials/primitives, no images and no required extensions. Its generator is Holodeck's procedural scenery tool. This is an inspected working artifact, not a claim about the deployed edition or its appearance. |
| Execution in this research pass | Source acquisition, local availability checks, code reading and GLB metadata inspection only. No DCC, render, asset generation, Scenario/MCP/model call, paid job, installation, GPU allocation or Mona workload. |

Scenario's current Blender family targets 5.2/5.2.1. A future Blender job must qualify the actual version and dependencies first; its measurements and engine-specific helper APIs cannot be transplanted into our browser. The lack of Blender does not block implementing the methods below with the existing procedural pipeline.

## Composition rules to apply now

These metric starting points are **Holodeck design proposals**, not universal Scenario constants or verified final dimensions. Keep the existing avatar/locomotion and validate with its real third-person camera.

1. **Give arrival, review and cooperative play distinct places.** Keep a quiet arrival plaza; put the review entrance and signal garden on separate connected terraces. As an initial roomy layout, use roughly 8–11 m terrace radii and 18–24 m between destination centers. Do not simply enlarge the floor while retaining all attractions around the spawn.
2. **Reserve space before dressing it.** Keep a clear 3 m traversal strip, widening near turns/entrances, and an approximately 5 m diameter stopping/turning area at each destination. Add the actual camera/avatar swept clearance. Keep at least one clear avatar-height sightline from each approach to its destination. These are design targets to test, not an accessibility certification.
3. **Compose the first view.** From the real spawn camera, show one unmistakable destination/landmark and a readable route. Separate the other destinations laterally or reveal them during the walk. Use approximate 1.6–1.8 m player-eye/reference height for planning, then check the shipped camera; do not review only from orbit or overhead.
4. **Budget empty space deliberately.** Start with at least half of each arrival/approach area free of decoration, posts, title boards and interactive props. This is a layout heuristic, not a pixel metric. Put optional rocks/trees outside paths; remove repetitions that add silhouette noise without navigation meaning.
5. **One high-contrast anchor per approach.** Make the destination silhouette/value stronger than its backing. Use muted large surfaces, a small shared material palette and one purposeful accent per activity. Keep the play targets' necessary distinct colors; do not extend those saturated colors over the entire environment.
6. **Separate labels from architecture.** One destination title is enough at a plaza. Show detailed controls/content information on selection or arrival through existing interfaces. Avoid a forest of always-visible labels, pedestals, rings and duplicate cues competing with the thing being reviewed.
7. **Keep hero placement authored.** Place the entrance, bridge and playable activity intentionally. Only then add sparse secondary dressing. Do not procedural-scatter near routes, spawn, review sightlines or the play area. Repeated meshes should share geometry/materials where the existing pipeline supports it.
8. **Keep the world spatially truthful.** Scene-camera cheats from cinematic previs do not transfer to a shared walkable space. No view-dependent floating/scaling of gameplay objects. Visual floors and MML collision surfaces must agree, and moving an interactive object must preserve its semantic position/allowed region, picking, projection and exported result. Use the current owning semantic update route, rather than moving only its rendering.

Implementation seams are the existing scenery builder, MML world/collision projection and Room's placement rules. Check hard-coded creation/export bounds when spreading activities; otherwise a visually roomy world can still force all native creations into the old central patch. This is one coordinated content/layout correction, not a new scene language or a separate service per creator.

## Lighting and environment pass

Choose one mood statement: **a quiet floating workshop, with warm destinations against muted cool surroundings**. Establish composition in simple values before fine materials.

The inspected client disables the upstream default sun and adds one bounded shadow-casting directional key; server environment configuration also supplies ambient/fog values. Do not infer two active suns from those two source locations. Aim the effective key so destination-facing surfaces read from the main walk, then reduce fill/ambient until forms have visible light/shadow gradients without losing route readability. Compare the same player-height views before/after; numerical lamp ratios alone cannot prove the result.

Use three broad value layers: near route/interaction, middle destination, distant scenery. A desaturated thumbnail must still identify the route and focal object. Darken a competing backdrop before raising an already bright marker. Keep large background areas quieter than the accent. Add distance fog only after near geometry reads; fog must not hide the destination or camera clearance. Keep specular sparkle and emissive cues selective. Do not introduce bloom to compensate for weak composition.

Blender's AgX/EXR analysis, EEVEE probes, Cycles samples, light linking and Roblox atmosphere values are not MML/Three parameters. Reuse their evaluation order, not their literal engine settings. This pass has not rendered or judged the new lighting.

## Asset/export procedure that fits the current code

1. Work in meters, place static prop pivots at the base and keep transforms/normals explicit. A future Blender asset must become Y-up glTF correctly; do not rotate the whole world to conceal an axis error.
2. For today's scenery, keep the existing simple uncompressed GLB with one embedded buffer, no images and no required decoder extensions. The current snapshot exporter rejects scenery above 600,000 bytes or with images/multiple buffers; the complete snapshot must fit 2 MiB. These are actual current implementation constraints, separate from publication-history limits.
3. Do not select Scenario's `web` export preset wholesale: it can introduce meshopt/WebP, while this path has not qualified those decoders/resources. A textured or compressed asset needs an explicit compatible importer/exporter change and browser check first. A successful Blender round trip would still not prove our loader can consume it.
4. Reuse the existing merged scenery GLB for static dressing and MML primitives for simple collision/interactive state. The GLB is currently non-colliding; decorative mesh detail must not silently become walkable semantics.
5. On an authorized asset implementation, inspect the GLB resource graph, size/triangle/material counts and bounds; reload it in the actual MML client and existing 3D review viewer, check scale/contact/normals from several angles, then compare the exported creation snapshot with the intended source. Do not run the scenery generator during this research pass: it writes the working asset.
6. If Blender is later selected, qualify one bounded headless asset with the lead and export helpers together, a supported local Blender version and an actual GLB round trip. Retain the editable source and exact exporter settings. Do not install the other DCC families, run hosted generation or acquire a paid account to fix today's layout.

## Smallest useful visual review

The implementation owner should inspect a fixed contact sheet in the actual browser: spawn, central arrival, approach to review, review threshold, approach to play, and return to arrival. Include one phone-width view and the normal desktop view. Check grayscale readability plus the actual colored view; walk the route to check collision and third-person camera clearance. Ask of each view: what is seen first, where can I walk, what is this destination, and what can I do here?

The result is ready for presentation only when those views read clearly, no destination is hidden by its own dressing, the movement/camera fits and the export still loads. Existing semantic/Node tests remain necessary but do not establish that it looks good. A screenshot sheet has not been produced or judged by this research pass. Nicolas's visual acceptance remains separate.


## Applied in the22November receiving increment

The coordinated implementation selected source2198e4d/package d607b195: three
separate destinations, broad walkable promenades, an open arrival, manually
arranged border lights and short local labels. The one-buffer scenery is506,528B
with6,932triangles/12material batches. Actual same-camera views exposed coplanar
grass/stone/path faces; the final asset separates those layers, and invisible
collision proxies no longer cast shadows. Normal walking stays at0.1m, at most
3cm above the grass layer. Native creation, collision, source geometry, bounds
and export consume the coordinated layout; actual WASD traversal and loader/
review export checks passed. Root then curated the existing world through its
native API, retaining Oliva's original creation actors and all identities/colours.
This is demonstrated method adoption in MML/Three, not execution of Blender or
paid Scenario generation. The human's visual judgment remains distinct.
