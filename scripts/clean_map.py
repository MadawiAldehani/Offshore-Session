#!/usr/bin/env python3
"""
Strip the field marker off the KOC concession map so it can be used as a quiz
question instead of a reading test.

The source map draws Al-Nokhatha as a green polygon with a white Arabic label
beside it. Both give the answer away, so we paint them out and keep the
annotated original for the reveal.

What it must NOT erase: the concession boundary, the dashed median line, the
KOC logo, the scale bar, the north arrow. An earlier version masked every
white pixel in a loose box and wiped out the boundary and the logo, so the
detection here is deliberately narrow:

  * the field is found as the LARGEST CONNECTED green blob — the logo is also
    green, and including its stray pixels ballooned the bounding box,
  * the label is found as white pixels inside a tight rectangle derived from
    that blob, sized to the text and nothing else.

Usage:  python3 scripts/clean_map.py public/maps/kuwait.jpg
"""

import sys
import pathlib
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def largest_green_blob(rgb: np.ndarray) -> np.ndarray:
    """
    Mask of the green field polygon only.

    Colour test discriminates against everything else on this map:
      desert    R >= G  -> excluded by G > R + margin
      teal sea  G ~= B  -> excluded by G > B + margin
    That still catches a few pixels of the KOC logo, so we keep only the
    largest 8-connected component.
    """
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    candidate = (g > r + 18) & (g > b + 45) & (g > 80)

    height, width = candidate.shape
    visited = np.zeros_like(candidate)
    best: list[tuple[int, int]] = []

    for seed_y, seed_x in zip(*np.nonzero(candidate)):
        if visited[seed_y, seed_x]:
            continue
        queue = deque([(seed_y, seed_x)])
        visited[seed_y, seed_x] = True
        component = []
        while queue:
            y, x = queue.popleft()
            component.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if (
                        0 <= ny < height
                        and 0 <= nx < width
                        and candidate[ny, nx]
                        and not visited[ny, nx]
                    ):
                        visited[ny, nx] = True
                        queue.append((ny, nx))
        if len(component) > len(best):
            best = component

    mask = np.zeros_like(candidate)
    for y, x in best:
        mask[y, x] = True
    return mask


def label_mask(rgb: np.ndarray, field: np.ndarray) -> np.ndarray:
    """
    White label text sitting just below the field.

    Restricted to a tight rectangle and to genuinely white pixels. The dashed
    median line runs diagonally below this band and the concession boundary
    passes to its right; both stay outside the rectangle, which is why the box
    is derived from the field's own bounding box rather than guessed.
    """
    ys, xs = np.nonzero(field)
    top = ys.max() + 6
    bottom = ys.max() + 48
    left = xs.min() - 90
    # Right edge reaches past the last glyph but stops short of the dashed
    # median line (~x+115 from the field) and the boundary (~x+140).
    right = xs.max() + 52

    height, width = field.shape
    top, bottom = max(0, top), min(height, bottom)
    left, right = max(0, left), min(width, right)

    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    whiteish = (r > 168) & (g > 168) & (b > 168)

    box = np.zeros(whiteish.shape, dtype=bool)
    box[top:bottom, left:right] = True
    print(f"  label search box: x {left}..{right}  y {top}..{bottom}")
    return whiteish & box


def grow(mask: np.ndarray, size: int) -> np.ndarray:
    """Dilate so anti-aliased edges of the polygon and glyphs go too."""
    return np.array(
        Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(size))
    ) > 0


def inpaint(image: Image.Image, mask: np.ndarray, rounds: int = 60) -> Image.Image:
    """
    Cheap diffusion inpainting: repeatedly blur the image and copy the blurred
    result into the masked pixels only, so colour bleeds inward from the
    surrounding water until the hole closes.

    Fine here because both targets sit in open sea, which is smooth and
    low-detail. It would smear badly over coastline or text.
    """
    arr = np.array(image).astype(np.float32)

    # Seed the hole with the mean colour of a ring around it, so diffusion
    # starts from roughly the right tone instead of from the green.
    ring = grow(mask, 17) & ~mask
    if ring.any():
        arr[mask] = arr[ring].mean(axis=0)

    for _ in range(rounds):
        blurred = np.array(
            Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
        ).astype(np.float32)
        arr[mask] = blurred[mask]

    return Image.fromarray(arr.astype(np.uint8))


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    source = pathlib.Path(sys.argv[1])
    if not source.exists():
        print(f"No such file: {source}")
        return 1

    image = Image.open(source).convert("RGB")
    width, height = image.size
    rgb = np.array(image)
    print(f"Loaded {source.name}: {width}x{height}  aspect {width / height:.4f}")

    field = largest_green_blob(rgb)
    if field.sum() < 200:
        print("!! Could not find the green field — adjust the colour thresholds.")
        return 1

    ys, xs = np.nonzero(field)
    cx, cy = xs.mean(), ys.mean()
    print(f"  field blob: {int(field.sum())} px, bbox x {xs.min()}..{xs.max()} y {ys.min()}..{ys.max()}")

    label = label_mask(rgb, field)
    print(f"  label pixels: {int(label.sum())}")

    mask = grow(field, 11) | grow(label, 9)
    print(f"  total masked: {int(mask.sum())} px "
          f"({100 * mask.sum() / (width * height):.2f}% of the image)")

    cleaned = inpaint(image, mask)
    out = source.with_name(source.stem + "-clean" + source.suffix)
    cleaned.save(out, quality=92)
    print(f"\nWrote {out}")

    compare = Image.new("RGB", (width, height * 2))
    compare.paste(cleaned, (0, 0))
    compare.paste(image, (0, height))
    compare.thumbnail((1100, 1600))
    compare.save(source.with_name("_compare.png"))

    print("\n--- paste into lib/questions.ts ---")
    print(f"    aspect: {width / height:.4f},")
    print(f"    answer: {{ x: {cx / width:.4f}, y: {cy / height:.4f} }},")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
