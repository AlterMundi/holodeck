"""Bake original clothing palettes into the licensed example avatar atlases.

Run Blender in background with this script from the Holodeck project root.
The GLB rig, skin, face, eyes, hair, shoes, and non-colour maps stay intact.
"""

import json
from pathlib import Path
import struct
import tempfile

import bpy
import numpy as np


ASSETS = Path(__file__).resolve().parents[2] / "public" / "assets"
OUTFITS = {
    "avatar-1-bodyA-skin01": ((0.13, 0.46, 0.49), (0.18, 0.26, 0.34)),
    "avatar-2-bodyB-skin03": ((0.59, 0.26, 0.38), (0.38, 0.27, 0.35)),
    "avatar-3-bodyA-skin05": ((0.36, 0.47, 0.24), (0.35, 0.40, 0.26)),
    "avatar-4-bodyB-skin07": ((0.70, 0.45, 0.18), (0.36, 0.29, 0.23)),
}


def extract_base_color(model):
    data = model.read_bytes()
    json_size, extension = struct.unpack_from("<I4s", data, 12)
    assert extension == b"JSON"
    document = json.loads(data[20:20 + json_size])
    image = next(image for image in document["images"] if image["name"] == "atlas-base")
    view = document["bufferViews"][image["bufferView"]]
    offset = 28 + json_size + view["byteOffset"]
    return data[offset:offset + view["byteLength"]]


def recolor(image, colors):
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape((height, width, 4))
    # Blender rows start at the bottom. The upstream atlas reserves the
    # middle-right tile for upper garments and lower-left for trousers.
    for tile, color in zip(
        (rgba[341:683, 683:, :3], rgba[:341, :341, :3]), colors,
    ):
        luminance = tile @ np.array([0.2126, 0.7152, 0.0722])
        # Preserve folds and fabric detail while keeping dark source cloth legible.
        contrast = (0.48 + 1.35 * np.sqrt(luminance)).clip(0, 1.27)
        tile[:] = (contrast[..., None] * np.array(color)).clip(0, 1)
    image.pixels.foreach_set(pixels)
    image.update()


def main():
    folder = ASSETS / "human-outfits"
    folder.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        source = Path(temporary) / "source.jpg"
        for name, colors in OUTFITS.items():
            source.write_bytes(extract_base_color(ASSETS / f"{name}.glb"))
            image = bpy.data.images.load(str(source), check_existing=False)
            recolor(image, colors)
            image.filepath_raw = str(folder / f"{name}.jpg")
            image.file_format = "JPEG"
            image.save()
            bpy.data.images.remove(image)


if __name__ == "__main__":
    main()
