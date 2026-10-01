<#
.SYNOPSIS
  Converts an IGES/STEP/BREP CAD file to a .glb the Scene Editor can import.

.DESCRIPTION
  Pipeline: FreeCADCmd tessellates the CAD shape to an .obj mesh, then obj2gltf
  (via npx) packs that into a .glb. Requires FreeCAD to be installed; obj2gltf is
  fetched on demand by npx (needs Node/npm, already present on this machine).

.PARAMETER InputFile
  Path to the .iges/.igs/.step/.stp/.brep file.

.PARAMETER OutputFile
  Where to write the .glb. Defaults to the input's folder with a .glb extension.

.PARAMETER FreeCADCmd
  Path to FreeCADCmd.exe / freecadcmd.exe. Auto-detected under Program Files if omitted.

.EXAMPLE
  .\convert-to-glb.ps1 -InputFile "C:\downloads\3d compressor.iges"
  # -> C:\downloads\3d compressor.glb -- drop that into the Scene Editor.
#>
param(
  [Parameter(Mandatory=$true)][string]$InputFile,
  [string]$OutputFile,
  [string]$FreeCADCmd
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $InputFile)) { throw "Input file not found: $InputFile" }
$InputFile = (Resolve-Path $InputFile).Path

if (-not $OutputFile) {
  $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, ".glb")
}

if (-not $FreeCADCmd) {
  $candidates = @(Get-ChildItem "C:\Program Files","C:\Program Files (x86)" -Recurse -ErrorAction SilentlyContinue -Include "FreeCADCmd.exe","freecadcmd.exe")
  if ($candidates.Count -eq 0) {
    throw "FreeCADCmd not found under Program Files. Install FreeCAD (https://www.freecad.org/downloads.php), or pass -FreeCADCmd '<path to FreeCADCmd.exe>' explicitly."
  }
  $FreeCADCmd = $candidates[0].FullName
  Write-Host "Using FreeCADCmd: $FreeCADCmd"
}

$tempObj = [System.IO.Path]::Combine($env:TEMP, "cadconv_" + [System.Guid]::NewGuid().ToString("N") + ".obj")

Write-Host "Step 1/2: tessellating with FreeCAD..."
& $FreeCADCmd (Join-Path $scriptDir "freecad_convert.py") $InputFile $tempObj
if ($LASTEXITCODE -ne 0) { throw "FreeCAD conversion step failed (see message above)." }

Write-Host "Step 2/2: packing to glTF Binary..."
npx --yes obj2gltf -i $tempObj -o $OutputFile
if ($LASTEXITCODE -ne 0) { throw "obj2gltf step failed." }

Remove-Item $tempObj -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done: $OutputFile" -ForegroundColor Green
Write-Host "Drop that file onto the Scene Editor's drop zone (3D Digital Twin -> Editor) to place it."
