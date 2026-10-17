$ErrorActionPreference = 'Stop'
# Owner-only storage outside Git. Re-running never replaces an existing key.
$taskRoot = Join-Path $env:LOCALAPPDATA 'AgentRelay'
$taskIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($taskFolder in @($taskRoot, (Join-Path $taskRoot 'Backups'), (Join-Path $taskRoot 'Recovery'), (Join-Path $taskRoot 'BackupWork'))) {
    New-Item -ItemType Directory -Path $taskFolder -Force | Out-Null
    & icacls.exe $taskFolder /inheritance:r /grant:r "${taskIdentity}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect private backup directory.' }
}
$taskKey = Join-Path $taskRoot 'Recovery\backup-key.bin'
if (-not (Test-Path -LiteralPath $taskKey)) {
    $taskBytes = New-Object byte[] 32
    $taskRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
    [System.IO.File]::WriteAllBytes($taskKey, $taskBytes)
}
if ((Get-Item -LiteralPath $taskKey).Length -ne 32) { throw 'Invalid existing backup key; preserve it and investigate.' }
Write-Output "Private backup storage ready: $taskRoot"
Write-Output 'Keep a separate offline copy of Recovery\backup-key.bin. Never upload it with a backup.'
