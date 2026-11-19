# Workshop light colours

`garden.place` and `garden.update` preserve the selected semantic colour value.
The shared `workshopColour` resolver accepts the existing `mint`, `amber`, `rose`
keys, `violet` (`#a77bea`), or exactly `#RRGGBB` (case insensitive). Everything
else is refused, including CSS names/functions, variables, shorthand and alpha.
Geometry and exports resolve those values to a literal lowercase RGB hex colour;
review labels use “violeta” or a generic custom-colour label. IDs, revision
preconditions and typed operations are unchanged. The preview includes violet.

Recovery is forward-compatible only after new-colour state is saved: an older
binary supporting only the original three keys cannot project/export that state.
Keep a compatible runtime for restart/recovery. Do not promise old-binary rollback
or silently substitute another colour, erase state or rewrite its history.
