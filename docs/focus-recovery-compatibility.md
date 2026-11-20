# Focus-preserving predecessor

This recovery build extends source63de97c only to retain the optional `focuses`
field of a successor room checkpoint. It clones the bounded sixteen-slot array
on restore and snapshot without exposing, interpreting or authoring indications.
Ordinary observation, bridge/light mutation and projection persistence therefore
preserve successor statements. A deliberate run reset clears them with the old
entities. Saves without the optional field keep their previous shape.

The regression performs a real predecessor bridge command and persistence write
while retaining the exact actor/target/revision/sequence/time statement. Loading
that output with the actual successor Room keeps the original bridge revision0
statement and reports it revised against the new entity revision1. This is
software recovery only: never replace live state or replay an original input.
No UI, native identity/authority, service key or schema change is included.
