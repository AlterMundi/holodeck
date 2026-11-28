# Holodeck

A shared, playable place for humans and their continuing daimon companions to
create together. The intended future Avatar entrance is a situated experience:
shared activity, events, participants, place and time, with different perspectives
on one world. Holodeck is not a new being or an independent conversational NPC.

**Current status: MVP implementation under an active goal.** The walkable room,
shared creation and native integration have controlled checks plus actual situated
native actions and a two-human shared trial. The conversational return, complete
device/revisit acceptance and content publication cycle remain open. See the [roadmap](docs/ROADMAP.md) and
[current evidence](docs/STATUS.md). No full MVP completion is claimed.

[Open the protected Holodeck trial](https://compaii.dmn.homes/holodeck/) using
the existing shared sign-in. The protected release selects seven existing paired
native routes with separate identity-pinned return ports. Read-only receiving
checks and own-native observation passed on all seven bodies. Actual native
result/game nodes, a revision link and a signal have been created and read back
without an engine restart. Real human-triggered participation has begun; conversation completion
and full MVP acceptance remain open. See the current evidence below.

## Local development

Node 20.19+ (the inspected upstream monorepo uses Node 24), npm:

```sh
npm ci
npm test
npm run build
npm start
```

Before publishing to the default branch, run the pinned Skills audience check
with your owner-managed terms list. The public CI uses masked output and
supplies its terms through the repository secret. Fork pull requests check
structured identifiers without access to that secret.

```sh
tools/audience-check.sh --tree HEAD --mask --require-terms
git config --local core.hooksPath .githooks
```

Open http://127.0.0.1:18940 in two independent browser tabs. This development
entrance is anonymous and loopback-only; production uses the existing Home
identity and service audience, with no alternate login.
WASD/arrow keys move, mouse drag looks, Space jumps; mobile controls come from MML.
Press **Q** or choose **Teletransporte** in the A2UI toolbar to travel to an
accessible location. Favorites are saved for your identity in this browser.
In spatial worktables, including the in-world teleporter, Shift + wheel
changes camera height. See the [A2UI worktable projection](docs/spatial-widget-packs.md).
The selected shared runtime includes native-authored result nodes and cooperative
signal gardens. See the [native creator quickstart](docs/native-creation-quickstart.md)
and [recipe contract](docs/playable-creations.md): creators change the running
world without changing or redeploying Holodeck.

## Plan and evidence

- [Architecture and authority](docs/architecture.md)
- [Implementation plan](docs/plan.md)
- [Source-grounded research](docs/research/2026-11-17.md)
- [Controlled implementation findings](docs/research/2026-11-17-implementation.md)
- [Astra critique](docs/research/astra-review.md)
- [Operations and bounds](docs/operations.md)
- [Candidate physical-world augmentation and QR game](docs/augmented-reality.md)
- [Content snapshots for existing viewers/review](docs/content-snapshots.md)
- [Spatial entrances to existing content](docs/content-landmarks.md)
- [Shared world activity and situated history](docs/world-history.md)
- [Research objects and replaceable content editions](docs/research-objects.md)

Research includes Social Conjurer, LLMR, VRCopilot, Ubiq-Genie, CraftAssist,
Resonite, Microverse, Minecraft/Roblox and browser engine alternatives. Their
reported results are evidence for hypotheses, not local replication.

Field/Nexus reuse and the owned-house direction: [integration contract](docs/field-integration.md).
