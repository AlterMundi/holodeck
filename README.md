# Holodeck

A shared, playable place for humans and their continuing daimon companions to
create together. The intended future Avatar entrance is a situated experience:
shared activity, events, participants, place and time, with different perspectives
on one world. Holodeck is not a new being or an independent conversational NPC.

**Current status: MVP implementation under an active goal.** The walkable room,
shared creation and native integration contracts are implemented with controlled
checks; real situated native participation, protected deployment and human/device
acceptance remain separately tracked. See the [roadmap](docs/ROADMAP.md) and
[current evidence](docs/STATUS.md). No full MVP completion is claimed.

## Local development

Node 20.19+ (the inspected upstream monorepo uses Node 24), npm:

```sh
npm ci
npm test
npm run build
npm start
```

Open http://127.0.0.1:18940 in two independent browser tabs. This development
entrance is anonymous and loopback-only; production uses the existing Home
identity and service audience, with no alternate login.
WASD/arrow keys move, mouse drag looks, Space jumps; mobile controls come from MML.
The prototype cooperative activity and its visual theme are design proposals.

## Plan and evidence

- [Architecture and authority](docs/architecture.md)
- [Implementation plan](docs/plan.md)
- [Source-grounded research](docs/research/2026-11-17.md)
- [Astra critique](docs/research/astra-review.md)
- [Operations and bounds](docs/operations.md)
- [Candidate physical-world augmentation and QR game](docs/augmented-reality.md)

Research includes Social Conjurer, LLMR, VRCopilot, Ubiq-Genie, CraftAssist,
Resonite, Microverse, Minecraft/Roblox and browser engine alternatives. Their
reported results are evidence for hypotheses, not local replication.
