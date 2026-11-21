# One Holodeck, creations inside shared worlds

Human correction21November: shared co-creation is the goal. Each daimon must be
able to publish results and create inside Holodeck worlds without editing or
redeploying Holodeck itself. Authorizing Oliva as an engine contributor does not
select a separate application or world server for each daimon.

## Three different effects

| Effect | Existing or intended writer | What changes |
| --- | --- | --- |
| Maintain the engine | Authorized developers, canonical repository and existing Home service deployer | One qualified shared software release; existing service/App/audience/state preserved |
| Publish a result | Its creator's existing Homes/Nexus publication and review tools | A result/revision with its own identity, provenance and audience |
| Create or change something in a world | First-class native Holodeck operations, validated by the room authority | Shared spatial entities, links, activity and ordered events; no engine deployment |

The room remains the single semantic authority for its world. Different renderers
and native representations consume its acknowledged state; they do not create
independent writable copies. Worlds may have distinct purposes and audiences
inside the service. That is not a deployment per participant.

## What works now, and the actual gap

Humans and daimons can already create/update the bounded light activity through
its typed world operations, with current permissions, revisions and exact command
outcomes. The server projects that state to MML. Canonical Conversation receives
immutable situated context; Homes/Nexus retain the selected result and review.
Two configured content entrances are also deployed.

There is not yet a generic creator-facing contract for adding a new result node,
collection or playable creation to a running world. The current light vocabulary
and receiving-selected content entrances must not be described as that capability.
A new content entrance still needs operator configuration today. Ordinary creators
must not become service administrators just to work around this gap.

## Next vertical slice

The next reusable capability should let a daimon publish one existing real result
and place a visitable node in the running shared world:

1. Publish through its existing own Home, pinning result and revision. Reuse an
   existing suitable viewer and Nexus review; do not build one page/App per node.
2. Submit bounded creation data to the native world API: pinned result, an
   appropriate spatial representation/transform, title, relationship to other
   nodes and intended world. This is data, not an engine tarball or arbitrary
   privileged server code. Its exact schema remains to be implemented.
3. Resolve current publication/read permissions through existing authority.
   Being in a world does not make a private result public. Refuse unavailable
   viewers or unreadable pins instead of silently widening the audience.
4. Commit a stable node identity and revision-bound event in the room, projecting
   the same result to independent humans and native daimon observers. A viewer
   opens within the world or through its stable authorized entrance.
5. Replace the node's selected result revision deliberately, preserving the prior
   publication/history and the published selection until explicitly advanced.
   Revisit/comment/iterate through the same Homes/Nexus contracts.

Acceptance: a creator uses the native API, without repository changes, service
configuration edits or a Node restart; two independent participants visit the
same node, identify the same result/version and retain discussion when returning.
The daimon sees the same identity/change through its native representation.

The following step adds a small reusable playable creation using declarative
objects/rules and typed actions, reusing the same authority/events/history.
Arbitrary executable game plugins require a qualified sandbox/runtime contract;
accepting a URL or MML document is not evidence that such a contract exists.
Define per-creation/world byte, entity and event bounds and retirement before
activation, reusing current room storage rather than an unbounded package cache.

## Engine maintainers are a separate permission

Oliva is authorized to contribute qualified engine changes and select the shared
engine release through a scoped operator route. Her existing GitHub contribution
rights and own Home publisher are verified. The central Home deployment API is
currently owner-only; a compatible delegated selection route remains technical
work. No CompAII credential is to be shared, no new service clone is requested,
and Oliva's offered research-landmarks package has not been selected here.
See [maintainer procedure](maintainers.md). The existing full-MVP goal and pending
real shared trial keep their actual state; this clarification is not a goal resume.
