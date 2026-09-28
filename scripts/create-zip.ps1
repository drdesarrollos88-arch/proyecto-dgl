$ErrorActionPreference = "Stop"

$sourceDir = "c:\Users\Diego\Desktop\DR Desarrollos\Proyecto DGL"
$zipPath = "c:\Users\Diego\Desktop\Proyecto-DGL-IDIEM.zip"
$stagingDir = Join-Path $env:TEMP "DGL_STAGING_$([System.Guid]::NewGuid().ToString('N'))"

Write-Host "Preparando empaquetado del sistema..." -ForegroundColor Cyan

if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$itemsToInclude = @(
    "app",
    "components",
    "lib",
    "public",
    "presentacion",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "middleware.ts",
    ".env.local",
    ".gitignore",
    "README.md",
    "INSTRUCCIONES_DESPLIEGUE.md"
)

foreach ($item in $itemsToInclude) {
    $src = Join-Path $sourceDir $item
    $dest = Join-Path $stagingDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dest -Recurse -Force
    }
}

# Copy data folder safely with ReadWrite share for open SQLite databases
$dataSrc = Join-Path $sourceDir "data"
$dataDest = Join-Path $stagingDir "data"
New-Item -ItemType Directory -Path $dataDest -Force | Out-Null

Get-ChildItem -Path $dataSrc -File | ForEach-Object {
    $target = Join-Path $dataDest $_.Name
    try {
        $srcStream = [System.IO.File]::Open($_.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $destStream = [System.IO.File]::Create($target)
        $srcStream.CopyTo($destStream)
        $srcStream.Close()
        $destStream.Close()
    } catch {
        Write-Warning "No se pudo copiar $($_.Name) con stream, intentando Copy-Item..."
        Copy-Item $_.FullName $target -Force
    }
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Comprimiendo archivo ZIP..." -ForegroundColor Cyan
Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

# Cleanup staging
Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue

$zipInfo = Get-Item $zipPath
$sizeMB = [math]::Round($zipInfo.Length / 1MB, 2)

Write-Host "=================================================" -ForegroundColor Green
Write-Host "¡ZIP GENERADO CON ÉXITO!" -ForegroundColor Green
Write-Host "Archivo: $zipPath" -ForegroundColor White
Write-Host "Tamaño: $sizeMB MB (Listo para adjuntar por correo)" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Green

