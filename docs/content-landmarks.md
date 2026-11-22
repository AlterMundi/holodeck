# Spatial entrances to existing content

The receiving owner can select up to eight authored public content entrances,
including the unchanged reading room. Each additional `research-*` object opens
an existing authorized pinned visit through the same retained Nexus frame.
Conversation continues to own text, audio, files and native submission.

`receiving.contentNodes` is an optional array containing the original entry and
selected additional entrances. Each has `id`, a public `title`, and a position
`{x,y,z}` in world metres/Y-up. Additional IDs match `research-[a-z0-9-]{1,40}`.
Coordinates are bounded to30m; the complete public entrance metadata has a2KiB
bound within the existing situated-context budget. An optional `model` names an already selected
same-application `.glb` asset by basename, without paths or query strings.
Without a model, a simple noncolliding marker identifies the entrance. That
marker is a placeholder, not a claim that subject-specific art is complete.

Keep the original entry exactly:

```json
{"id":"reading-room","title":"Sala de presentaciones","position":{"x":-3,"y":0.1,"z":3}}
```

The existing `contentVisits[].node` selects one of these IDs. Report and artifact
pin schemas, eight-visit bound and same-origin descriptor authorization remain
unchanged. This addition does not supply a research-history adapter, corpus
access, automatic source discovery or a newly published subject investigation.
The owner must select real authorized visits; controlled test sources are not
production content. Omitting `contentNodes` retains the previous world.

The world document and situated `place.contents` share the same validated public
entrances. Their labels and models are visible to the whole world audience;
choose only identifying metadata/assets suitable for every room reader. Private
titles, source URLs and revision pins remain in the actor-filtered visit catalog
and independently authorized descriptor. Discovery is not a source-access grant.

Visitors can click a visible entrance or use the contextual nearby button.
Choosing a different object first asks the existing viewer to close safely;
dirty, recording, playing or processing work keeps its original frame and pin.
Ordinary return to the same object preserves the mounted frame. A captured
conversation view freezes the original object ID with its exact visit/pin,
including when a later asynchronous reply belongs to an unavailable old visit.
The current geometry acknowledgment still describes only its declared workshop
scope; it does not add a new applied-model or human-view proof for these objects.

Placements here are authored receiving configuration, not new garden elements
or mutable placement commands. The existing Room checkpoint/schema, garden
limits, original IDs and previous creation exports remain unchanged. Visit-only
objects are excluded from creation snapshots, as the reading room already was.
Durable editable research placements and a canonical research-revision adapter
remain later implementation work, with their own source and migration contracts.
