"""freecad_convert.py — headless CAD-to-mesh step of the DWG/IGES -> GLB pipeline.

Run with FreeCAD's own Python (FreeCADCmd), never the system Python — only FreeCAD's
interpreter has the `FreeCAD`/`Part`/`Mesh`/`MeshPart` modules on its path.

Usage:
    FreeCADCmd freecad_convert.py <input.iges|.igs|.step|.stp|.brep|.dxf> <output.obj>

Supports:
  - IGES / STEP / BREP  : read directly as a B-rep shape and tessellate to a mesh.
  - DXF                 : imported via FreeCAD's DXF importer. Real 3D DWG solids
                           usually survive a DWG->DXF hop; a DWG that's actually a 2D
                           general-arrangement drawing will not — this script detects
                           that case and exits with a clear message instead of writing
                           an empty/junk .obj.

Geometry only — no colours/materials come out the other end. Recolour or apply a
material after importing the .glb into the Scene Editor (or reuse assets.js's
recolor() helper if you fold this into the codebase's asset pipeline instead).
"""
import sys
import os

def fail(msg):
    print(f"[freecad_convert] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 3:
    fail("usage: FreeCADCmd freecad_convert.py <input> <output.obj>")

in_path = os.path.abspath(sys.argv[1])
out_path = os.path.abspath(sys.argv[2])
ext = os.path.splitext(in_path)[1].lower()

if not os.path.isfile(in_path):
    fail(f"input file not found: {in_path}")

try:
    import FreeCAD
    import Part
    import Mesh
    import MeshPart
except ImportError as e:
    fail(f"this must be run with FreeCADCmd, not system python ({e})")

LINEAR_DEFLECTION = 0.05   # metres; smaller = denser/more accurate mesh, bigger file
ANGULAR_DEFLECTION = 0.3   # radians

shapes = []

if ext in (".iges", ".igs", ".step", ".stp", ".brep"):
    shape = Part.Shape()
    try:
        shape.read(in_path)
    except Exception as e:
        fail(f"could not read {ext} file: {e}")
    if shape.isNull() or shape.Volume == 0 and not shape.Faces:
        fail("file read OK but contained no usable geometry (empty shape)")
    shapes = [shape]

elif ext == ".dxf":
    doc = FreeCAD.newDocument("conv")
    try:
        import importDXF
        importDXF.insert(in_path, doc.Name)
    except Exception as e:
        fail(f"DXF import failed: {e}")
    for obj in doc.Objects:
        shp = getattr(obj, "Shape", None)
        if shp is not None and not shp.isNull() and (shp.Faces or shp.Solids):
            shapes.append(shp)
    if not shapes:
        fail(
            "DXF contains no 3D solids/surfaces (only 2D lines/points came through). "
            "This is almost certainly a 2D general-arrangement drawing, not a 3D model "
            "-- converting it further won't produce useful geometry. Use the model "
            "sourcing list (docs/3D_MODEL_SOURCING.md) for an equivalent part instead."
        )
else:
    fail(f"unsupported extension '{ext}' (expected .iges/.igs/.step/.stp/.brep/.dxf)")

combined = Part.makeCompound(shapes) if len(shapes) > 1 else shapes[0]

mesh = MeshPart.meshFromShape(
    Shape=combined,
    LinearDeflection=LINEAR_DEFLECTION,
    AngularDeflection=ANGULAR_DEFLECTION,
    Relative=False,
)

if mesh.CountFacets == 0:
    fail("tessellation produced zero triangles -- shape may be degenerate")

os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
mesh.write(out_path)
print(f"[freecad_convert] wrote {mesh.CountFacets} triangles -> {out_path}")
