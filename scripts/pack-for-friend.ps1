# Pack the project into a zip without node_modules / dist / .git
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = if ($args[0]) { $args[0] } else { Join-Path (Split-Path $root -Parent) "belote-for-friend.zip" }

Write-Host "Packing: $root"
Write-Host "Output:  $out"

if (Test-Path $out) {
  Remove-Item -Force $out
}

$stage = Join-Path $env:TEMP ("belote-pack-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage | Out-Null

try {
  Get-ChildItem -LiteralPath $root -Force | Where-Object {
    $_.Name -notin @("node_modules", "dist", ".git")
  } | ForEach-Object {
    if ($_.Name -eq "server") {
      $dst = Join-Path $stage "server"
      New-Item -ItemType Directory -Path $dst | Out-Null
      Get-ChildItem -LiteralPath $_.FullName -Force | Where-Object {
        $_.Name -notin @("node_modules", "dist")
      } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Recurse -Force
      }
    }
    else {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stage $_.Name) -Recurse -Force
    }
  }

  # Force launcher scripts to ASCII + CRLF so cmd.exe on any Windows locale
  # cannot mis-parse multi-byte Cyrillic as random commands like 'use' / '[!]'.
  Get-ChildItem -LiteralPath $stage -Filter *.bat -File | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName)
    $text = $text -replace "`r`n", "`n" -replace "`n", "`r`n"
    # Drop any non-ASCII so cmd.exe never mis-parses locale bytes as commands.
    $text = [regex]::Replace($text, '[^\x09\x0A\x0D\x20-\x7E]', '?')
    $ascii = New-Object System.Text.UTF8Encoding $false
    [IO.File]::WriteAllText($_.FullName, $text, $ascii)
  }

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $out -Force
  $len = (Get-Item $out).Length
  Write-Host ("[OK] {0:N1} MB -> {1}" -f ($len / 1MB), $out)
}
finally {
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}
