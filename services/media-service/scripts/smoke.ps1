$ErrorActionPreference = 'Stop'

if (-not (Get-Command javac -ErrorAction SilentlyContinue)) {
    throw 'javac is required for the media-service pure Java smoke'
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'java is required for the media-service pure Java smoke'
}

$serviceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$smokeRoot = Join-Path $serviceRoot ('.smoke-check-' + [guid]::NewGuid().ToString('N'))
$classes = Join-Path $smokeRoot 'classes'
New-Item -ItemType Directory -Path $classes -Force | Out-Null

try {
    $sourceFiles = @()
    $sourceFiles += Get-ChildItem (Join-Path $serviceRoot 'src/main/java/com/englishflow/media/domain') -Filter '*.java'
    $sourceFiles += Get-ChildItem (Join-Path $serviceRoot 'src/main/java/com/englishflow/media/port') -Filter '*.java'
    $sourceFiles += Get-ChildItem (Join-Path $serviceRoot 'src/main/java/com/englishflow/media/adapter/memory') -Filter '*.java'
    $sourceFiles += Get-ChildItem (Join-Path $serviceRoot 'src/main/java/com/englishflow/media/application') -Filter '*.java'
    $sourceFiles += Join-Path $serviceRoot 'src/test/java/com/englishflow/media/MediaDomainSmoke.java'
    $sourcePaths = $sourceFiles | ForEach-Object { if ($_ -is [System.IO.FileInfo]) { $_.FullName } else { $_ } }

    & javac --release 24 -encoding UTF-8 -d $classes $sourcePaths
    if ($LASTEXITCODE -ne 0) {
        throw "javac failed with exit code $LASTEXITCODE"
    }

    & java -cp $classes com.englishflow.media.MediaDomainSmoke
    if ($LASTEXITCODE -ne 0) {
        throw "media-service smoke failed with exit code $LASTEXITCODE"
    }
}
finally {
    if (Test-Path -LiteralPath $smokeRoot) {
        Remove-Item -LiteralPath $smokeRoot -Recurse -Force
    }
}
