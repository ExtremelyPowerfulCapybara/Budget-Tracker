import base64, re, os, sys

REPO = r"D:\Librerías\Documentos\GitHub\Budget-Tracker"

# ── 1. Copy icon files ──────────────────────────────────────────────────────
script_dir = os.path.dirname(os.path.abspath(__file__))
src_512 = os.path.join(script_dir, "icon-512.png")
src_192 = os.path.join(script_dir, "icon-192.png")

for src, name in [(src_512, "icon-512.png"), (src_192, "icon-192.png")]:
    dst = os.path.join(REPO, name)
    if not os.path.exists(src):
        print(f"ERROR: {src} not found. Put both icon files next to this script.")
        sys.exit(1)
    # Read source as binary and write directly (avoids file-lock issues)
    with open(src, "rb") as f:
        data = f.read()
    with open(dst, "wb") as f:
        f.write(data)
    print(f"Wrote {name} ({len(data):,} bytes) → {dst}")

# ── 2. Patch the embedded apple-touch-icon in index.html ───────────────────
index_path = os.path.join(REPO, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    html = f.read()

with open(src_192, "rb") as f:
    new_b64 = base64.b64encode(f.read()).decode("ascii")

new_html, count = re.subn(
    r'href="data:image/png;base64,[A-Za-z0-9+/=]+"',
    f'href="data:image/png;base64,{new_b64}"',
    html, count=1
)

if count == 0:
    print("WARNING: No existing base64 icon found in index.html — skipping patch.")
else:
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"Patched embedded icon in index.html ({len(new_b64):,} chars)")

print("\nDone! Open GitHub Desktop to commit and push.")
