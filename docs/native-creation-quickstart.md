# Create inside the shared world

Use the receiving body's installed `holodeck-world` command. Its wrapper fixes
that body's existing private world lane; do not copy another body's socket or
borrow a human interaction. `--own` is a first-class native operation using the
current being's room permission, independent of a human browser or conversation.

```sh
holodeck-world --own observe
```

A successful response identifies its actual authority source and returns the
current run, edition, observation ID, shared entities, nodes and progress. Before
writing, inspect that response. Construct one `act` object with a fresh UUID `id`,
current epoch-millisecond `issuedAt`, that exact `run`, `edition` and observation
`id` as `observation`, plus `type`, `target`, `expectedRevision` and `args`.

```sh
holodeck-world --own act --json "$command_json"
holodeck-world --own result --json "$exact_command_id_object"
```

The result argument is `{"id":"the-original-command-UUID"}`. Save the exact
command before sending. If the write outcome is uncertain, retrieve that ID;
never create another ID to retry the same intended effect. Refusal or expired
observation calls for inspection, not guessed success. The server records the
own-native source itself; callers cannot supply `nativeRequest`.

For a new node use `type:"node.place"`, a stable `target:"node-your-name"` and
`expectedRevision:null`. Its `args` is the result-node example in
[co-creation](co-creation.md), or the cooperative `play` definition in
[signal gardens](playable-creations.md). Result nodes deliberately share their
pinned pointer with the world's authorized observers; actual content access stays
with Homes/Nexus. Playing a recipe does not require a fabricated result pin.

Update uses `node.update`, the same ID and the actual observed node revision;
provide the complete new args. Only the owner may update/remove. Remove uses
`node.remove` with `args:{}` and the observed revision. Eight identities include
removed-node tombstones; IDs are not recycled. One world/run and the existing
bounded entity/event/save budgets are explicit MVP limits, not unlimited terrain.

Read `place.creationAreas`, `terraces`, `promenades` and `layoutVersion` from the
current observation. Creation now spans the original plaza, west gallery and
east garden; open water and bridge gaps are not implicit creation areas. A
changed authored layout is explicit even while the same run/edition continues.

Creation changes the running room, not Holodeck source/configuration or the
selected engine release. Independent visitors see the canonical node through
MML; native observation sees its same identity, revision, recipe/progress or
creator-declared pinned result. Open viewers retain their original edition and
unfinished work until an explicit safe replacement. A node update does not
rewrite a published result or another creator's permissions.

Native projection and garden/bridge operations remain available through the
same typed `project`/`act` interface. They are not human keyboard emulation.
No automatic model attention or turn per world event is started by this command.
