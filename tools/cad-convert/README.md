# CAD -> GLB conversion

The Scene Editor (see `docs/3D_EDITOR.md`) only imports `.glb`/`.gltf` — that's the only
format a browser's WebGL renderer can load without a huge dependency. These scripts convert
real CAD deliverables (IGES, STEP, DWG) into `.glb` so they can be dropped straight in.

Renders/images (`.zip` of JPGs, PNGs, PDFs) aren't handled here — there's no geometry in a
picture. Use them as reference while you position things, or as inspiration for which
catalog model to grab off `docs/3D_MODEL_SOURCING.md` instead.

## One-time setup

1. **[FreeCAD](https://www.freecad.org/downloads.php)** (free) — does the actual CAD-to-mesh
   tessellation. Any recent 0.20+ or 1.0 build works. Just install it; the scripts find
   `FreeCADCmd.exe` under Program Files automatically.
2. **Node.js** — already on this machine (`node -v` / `npm -v` both work). Used to run
   `obj2gltf` via `npx` (no separate install step needed, `npx` fetches it on first run).
3. **DWG files only** — also install the free
   **[ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)**. This
   is what actually reads DWG; FreeCAD itself has no DWG import.

## Usage

IGES / STEP / BREP:
```powershell
.\convert-to-glb.ps1 -InputFile "C:\downloads\3d compressor.iges"
```
Writes `3d compressor.glb` next to the source file (or pass `-OutputFile` to choose).

DWG:
```powershell
.\dwg-to-glb.ps1 -InputFile "C:\downloads\diesel_pump_skid.dwg"
```

Then: open **3D Digital Twin -> Editor** in the app and drop the resulting `.glb` onto the
drop zone (or Browse to it). It positions itself near the camera target with a gizmo
attached — see `docs/3D_EDITOR.md` for positioning/paths/playback.

## What to expect

- **IGES/STEP**: reliable — these formats store real B-rep solids/surfaces, FreeCAD reads
  them natively. Output is geometry only, no color/material (grey by default); use the
  editor's transform tools as normal, or recolor before export in FreeCAD if you want a
  specific look baked in.
- **DWG**: best-effort. A DWG that models actual 3D equipment (extruded solids, etc.) usually
  survives the DWG->DXF->mesh hop fine. A DWG that's a **2D general-arrangement drawing**
  (lines, dimensions, hatching — very common for vendor "skid" drawings) has no 3D shape in
  it at all, DXF or not, and `freecad_convert.py` will say so explicitly rather than handing
  you an empty or garbage `.glb`. If that happens, that equipment just isn't available as a
  usable 3D file from this source — go to `docs/3D_MODEL_SOURCING.md` for a stand-in instead
  of fighting the conversion further.
- Mesh density is controlled by `LINEAR_DEFLECTION`/`ANGULAR_DEFLECTION` at the top of
  `freecad_convert.py` — lower values = more triangles/detail = bigger file. Defaults are
  tuned for a small mechanical part (pump, compressor); loosen them for anything larger.

## Troubleshooting

- *"FreeCADCmd not found"* / *"ODAFileConverter.exe not found"* — pass the path explicitly
  with `-FreeCADCmd` / `-OdaConverter`, or confirm the install actually landed under
  `C:\Program Files`.
- *"tessellation produced zero triangles"* — the CAD file likely contains only wireframe/
  construction geometry, not a closed solid or surface. Open it in FreeCAD's GUI to check
  what's actually in there before troubleshooting the script further.
