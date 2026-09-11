import os
from collections import deque
from pathlib import Path
from PIL import Image

ARTIFACTS_DIR = Path(r"C:\Users\THAMILKUMARAN V G\.gemini\antigravity-ide\brain\f40397c1-f62d-4940-8fc0-7db0f8c29e1a")
BASE_DIR = Path(r"d:\nambathaan\Thamil\prompt")

TARGET_DIRS = [
    BASE_DIR / "assets" / "mentors",
    BASE_DIR / "frontend" / "assets" / "mentors",
]

for d in TARGET_DIRS:
    d.mkdir(parents=True, exist_ok=True)

MENTOR_MAP = {
    "luffy": "mentor_luffy_1789108160016.jpg",
    "zoro": "mentor_zoro_1789108230531.jpg",
    "rayleigh": "mentor_rayleigh_1789108249250.jpg",
    "asta": "mentor_asta_1789108267899.jpg",
    "yami": "mentor_yami_1789108295611.jpg",
    "urahara": "mentor_urahara_1789108316485.jpg",
    "ichigo": "mentor_ichigo_1789108342644.jpg",
    "aizen": "mentor_aizen_1789108365027.jpg",
    "naruto": "mentor_naruto_1789108388489.jpg",
    "kakashi": "mentor_kakashi_1789108409632.jpg",
    "might-guy": "mentor_guy_1789108432543.jpg",
}


def make_transparent_background(img: Image.Image, threshold: int = 242) -> Image.Image:
    """Removes outer background connecting to edges while preserving internal white details."""
    img = img.convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # Determine background mask via BFS flood fill from border pixels
    visited = bytearray(width * height)
    queue = deque()

    def is_bg(r, g, b):
        return r >= threshold and g >= threshold and b >= threshold

    # Seed all border pixels
    for x in range(width):
        for y in (0, height - 1):
            r, g, b, _ = pixels[x, y]
            if is_bg(r, g, b):
                idx = y * width + x
                visited[idx] = 1
                queue.append((x, y))

    for y in range(height):
        for x in (0, width - 1):
            r, g, b, _ = pixels[x, y]
            if is_bg(r, g, b):
                idx = y * width + x
                if not visited[idx]:
                    visited[idx] = 1
                    queue.append((x, y))

    # BFS flood fill
    while queue:
        cx, cy = queue.popleft()
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < width and 0 <= ny < height:
                nidx = ny * width + nx
                if not visited[nidx]:
                    nr, ng, nb, _ = pixels[nx, ny]
                    if is_bg(nr, ng, nb):
                        visited[nidx] = 1
                        queue.append((nx, ny))

    # Apply transparency and soft edge blending
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx]:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Check if near background for subtle feathering/defringing
                r, g, b, a = pixels[x, y]
                if r > 230 and g > 230 and b > 230:
                    # check neighbor border count
                    bg_neighbors = 0
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            if visited[ny * width + nx]:
                                bg_neighbors += 1
                    if bg_neighbors > 0:
                        alpha = max(0, int(255 * (1.0 - (min(r, g, b) - 230) / 25.0 * (bg_neighbors / 4.0))))
                        pixels[x, y] = (r, g, b, min(255, alpha))

    return img


def process_all():
    for mentor_id, filename in MENTOR_MAP.items():
        src_path = ARTIFACTS_DIR / filename
        if not src_path.exists():
            print(f"Error: {src_path} not found!")
            continue

        print(f"Processing {mentor_id} from {filename}...")
        img = Image.open(src_path)

        # Remove outer background cleanly
        processed = make_transparent_background(img)

        # Target 512x512
        processed = processed.resize((512, 512), Image.Resampling.LANCZOS)

        for target_dir in TARGET_DIRS:
            webp_path = target_dir / f"{mentor_id}.webp"
            png_path = target_dir / f"{mentor_id}.png"
            processed.save(webp_path, "WEBP", quality=95)
            processed.save(png_path, "PNG")

            # Also save alias 'guy' if might-guy
            if mentor_id == "might-guy":
                guy_webp = target_dir / "guy.webp"
                guy_png = target_dir / "guy.png"
                processed.save(guy_webp, "WEBP", quality=95)
                processed.save(guy_png, "PNG")

        print(f"Saved {mentor_id} webp/png to target dirs")


if __name__ == "__main__":
    process_all()
