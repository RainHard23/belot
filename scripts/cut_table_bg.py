"""Remove baked-in solid background from table PNG → real alpha."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\msi\.cursor\projects\d-my-p-belot\assets"
    r"\c__Users_msi_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"363ff219b93cdeda54a765ae42dbff97_images_Gemini_Generated_Image_"
    r"5qduk65qduk65qdu__2_-56531ae8-a8cf-4472-9c2e-dc091dd52e85.png"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "images" / "table-tavern.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    luma = (r.astype(np.int32) + g + b) / 3
    chroma = np.maximum(np.maximum(np.abs(r - g), np.abs(g - b)), np.abs(r - b))

    # Solid black plate + a little fringe / compression noise
    bg = (luma <= 28) & (chroma <= 18)

    h, w = bg.shape
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def try_push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not visited[y, x] and bg[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        try_push(0, x)
        try_push(h - 1, x)
    for y in range(h):
        try_push(y, 0)
        try_push(y, w - 1)

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            try_push(y + dy, x + dx)

    alpha = arr[:, :, 3].copy()
    alpha[visited] = 0

    # Soften fringe next to removed black
    near_t = np.zeros_like(visited)
    near_t[1:-1, 1:-1] = (
        (alpha[:-2, 1:-1] == 0)
        | (alpha[2:, 1:-1] == 0)
        | (alpha[1:-1, :-2] == 0)
        | (alpha[1:-1, 2:] == 0)
    )
    soft = near_t & (luma <= 45) & (chroma <= 22)
    alpha[soft] = 0

    # Partial alpha on darker fringe so edges aren't jagged
    soft2 = near_t & (luma <= 70) & (chroma <= 30) & (alpha > 0)
    alpha[soft2] = np.minimum(alpha[soft2], ((luma[soft2] - 28) * 6).clip(0, 255).astype(np.uint8))

    arr[:, :, 3] = alpha
    out_im = Image.fromarray(arr, "RGBA")

    ys, xs = np.where(alpha > 0)
    if len(xs):
        pad = 4
        x0 = max(0, int(xs.min()) - pad)
        x1 = min(w, int(xs.max()) + pad + 1)
        y0 = max(0, int(ys.min()) - pad)
        y1 = min(h, int(ys.max()) + pad + 1)
        out_im = out_im.crop((x0, y0, x1, y1))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(OUT, "PNG", optimize=True)
    print("saved", OUT, "size", out_im.size)
    print(f"transparent {(alpha == 0).mean() * 100:.1f}%  opaque {(alpha > 200).mean() * 100:.1f}%")


if __name__ == "__main__":
    main()
