<#
.SYNOPSIS
  Converts a DWG file to a .glb, best-effort, via ODA File Converter -> DXF -> FreeCAD -> glTF.

.DESCRIPTION
  DWG is a closed Autodesk format with no free direct-to-mesh path. This script hops
  through DXF using the free ODA File Converter, then hands the DXF to the same
  FreeCAD tessellation step used for IGES/STEP.

  IMPORTANT: this only produces something useful if the source DWG actually contains
  3D solids. A lot of vendor "equipment" DWGs (like a pump-skid general-arrangement
  drawing) are 2D line drawings with dimensions -- there is no 3D shape to extract from
  those, DXF or not. The script will tell you plainly if that's what it finds; if so,
  don't fight it further -- pull an equivalent part from docs/3D_MODEL_SOURCING.md instead.

.PARAMETER InputFile
  Path to the .dwg file.

.PARAMETER OutputFile
  Where to write the .glb. Defaults to the input's folder with a .glb extension.

.PARAMETER OdaConverter
  Path to ODAFileConverter.exe. Auto-detected under Program Files if omitted.
  Download: https://www.opendesign.com/guestfiles/oda_file_converter (free, no login
  needed for the "Formats" -> DWG/DXF converter).

.PARAMETER FreeCADCmd
  Path to FreeCADCmd.exe / freecadcmd.exe. Auto-detected under Program Files if omitted.

.EXAMPLE
  .\dwg-to-glb.ps1 -InputFile "C:\downloads\diesel_pump_skid.dwg"
#>
param(
  [Parameter(Mandatory=$true)][string]$InputFile,
  [string]$OutputFile,
  [string]$OdaConverter,
  [string]$FreeCADCmd
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $InputFile)) { throw "Input file not found: $InputFile" }
$InputFile = (Resolve-Path $InputFile).Path

if (-not $OutputFile) {
  $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, ".glb")
}

if (-not $OdaConverter) {
  $candidates = @(Get-ChildItem "C:\Program Files","C:\Program Files (x86)" -Recurse -ErrorAction SilentlyContinue -Filter "ODAFileConverter.exe")
  if ($candidates.Count -eq 0) {
    throw "ODAFileConverter.exe not found. Download the free 'ODA File Converter' from https://www.opendesign.com/guestfiles/oda_file_converter and install it, or pass -OdaConverter '<path>'."
  }
  $OdaConverter = $candidates[0].FullName
  Write-Host "Using ODA File Converter: $OdaConverter"
}

if (-not $FreeCADCmd) {
  $candidates = @(Get-ChildItem "C:\Program Files","C:\Program Files (x86)" -Recurse -ErrorAction SilentlyContinue -Include "FreeCADCmd.exe","freecadcmd.exe")
  if ($candidates.Count -eq 0) {
    throw "FreeCADCmd not found under Program Files. Install FreeCAD (https://www.freecad.org/downloads.php), or pass -FreeCADCmd '<path>'."
  }
  $FreeCADCmd = $candidates[0].FullName
  Write-Host "Using FreeCADCmd: $FreeCADCmd"
}

$work = Join-Path $env:TEMP ("cadconv_" + [System.Guid]::NewGuid().ToString("N"))
$inDir = Join-Path $work "in"
$outDir = Join-Path $work "out"
New-Item -ItemType Directory -Path $inDir -Force | Out-Null
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Copy-Item $InputFile (Join-Path $inDir (Split-Path -Leaf $InputFile))

try {
  Write-Host "Step 1/3: DWG -> DXF via ODA File Converter..."
  # Args: inputFolder outputFolder outputVersion outputType recurse audit [filter]
  & $OdaConverter $inDir $outDir "ACAD2018" "DXF" "0" "1" | Out-Null

  $dxf = Get-ChildItem $outDir -Filter "*.dxf" | Select-Object -First 1
  if (-not $dxf) { throw "ODA File Converter did not produce a .dxf -- check that the input is a valid DWG." }

  $tempObj = Join-Path $work "mesh.obj"
  Write-Host "Step 2/3: tessellating with FreeCAD (reports if there's no 3D geometry to find)..."
  & $FreeCADCmd (Join-Path $scriptDir "freecad_convert.py") $dxf.FullName $tempObj
  if ($LASTEXITCODE -ne 0) { throw "FreeCAD step failed (see message above) -- most likely this DWG has no 3D solids." }

  Write-Host "Step 3/3: packing to glTF Binary..."
  npx --yes obj2gltf -i $tempObj -o $OutputFile
  if ($LASTEXITCODE -ne 0) { throw "obj2gltf step failed." }

  Write-Host ""
  Write-Host "Done: $OutputFile" -ForegroundColor Green
  Write-Host "Drop that file onto the Scene Editor's drop zone (3D Digital Twin -> Editor) to place it."
} finally {
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
