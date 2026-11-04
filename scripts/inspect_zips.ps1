Add-Type -AssemblyName System.IO.Compression.FileSystem

function Inspect-Zip($zipPath) {
    Write-Host "=== INSPECTING: $zipPath ==="
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $list = @()
    foreach ($entry in $archive.Entries) {
        $list += [PSCustomObject]@{
            FullName = $entry.FullName
            Length = $entry.Length
            CompressedLength = $entry.CompressedLength
        }
        Write-Host "  ENTRY: $($entry.FullName) ($($entry.Length) bytes)"
    }
    $archive.Dispose()
    return $list
}

$e2 = Inspect-Zip "CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/CT_Operations_Monitor_East2.zip"
$e3 = Inspect-Zip "CT_OPERATIONS_DUAL_DIALER_RELEASE/RELEASE_PACKAGES/CT_Operations_Monitor_East3.zip"

