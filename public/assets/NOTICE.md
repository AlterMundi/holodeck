# MML example assets

Source: https://github.com/mml-io/3d-web-experience/tree/b3fed99f3bae267a23c66e195794ac22e2b81107/example/assets/models

Distributed under the upstream MIT license (MML-LICENSE.txt). Binary bytes were
retrieved through GitHub media and verified against the pinned Git LFS SHA-256
and declared byte size; raw repository pointers are not playable assets.

```json
{
  "anim_air.glb": "370b7b800de11d66cb365ec8a147135a789c476922daee80ed664cbce9941c8f",
  "anim_double_jump.glb": "a40ea3c384d4428e7a3c584f726f6a1c73adb4ea3fa3fa943447d1dcf2c05cd7",
  "anim_idle.glb": "616abbfb6997bb1ebf149ce7fa272c740dbbabd75c53651214b0f52eb24e0841",
  "anim_jog.glb": "553512641d0ffcbed244f1129d5bfa1c31d4c6e3ee2b154663cc14f9aea18cce",
  "anim_run.glb": "9edf0340d0b17a4dbb84a33f773e076f60d136b6d99eb0094578408da3a332b3",
  "avatar-1-bodyA-skin01.glb": "2bb4ff4ca71ebbaa96be9a3073b6c82b62188836c0aea2a50bec298c354d2457",
  "avatar-2-bodyB-skin03.glb": "922525b25be5162cc4ff831026c3e8bdf600d1a72bd054c84660809c67a4b792",
  "avatar-3-bodyA-skin05.glb": "edb437e2168e18fda4e824316338286d63eef94efb545c1c08763fced1578853",
  "avatar-4-bodyB-skin07.glb": "c7dc68c4936e497bca827a5324e63f82a7de9a61f2c9a621e94fbd9c083a5640"
}
```

`human-outfits/` holds four alternate albedo maps derived from these rigs
under the same MIT terms. Their clothing palettes were authored with Blender
5.2.2 in `tools/geometry/build-human-outfits.py`. Each alternate uses the
original geometry, rig, normal and lighting maps. The server assembles
standard GLBs at startup so the release keeps only one copy of each rig.
