param([Parameter(Mandatory = $true)][string]$Fixture)
$ErrorActionPreference = 'Stop'
$env:LOCALAPPDATA = $Fixture
$taskRoot = Join-Path $Fixture 'AgentRelay'
$taskRecovery = Join-Path $taskRoot 'Recovery'
New-Item -ItemType Directory -Path $taskRecovery -Force | Out-Null
$taskKey = Join-Path $taskRecovery 'backup-key.bin'
[System.IO.File]::WriteAllBytes($taskKey, (New-Object byte[] 32))
$taskHash = (Get-FileHash -LiteralPath $taskKey).Hash
# Deliberately unsafe synthetic fixture: explicit foreign grants survive grant:r.
foreach ($taskPath in @($taskRoot, $taskRecovery, $taskKey)) {
    & icacls.exe $taskPath /grant '*S-1-1-0:F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not seed stale fixture grant.' }
}
& (Join-Path $PSScriptRoot '..\scripts\init-backup.ps1') | Out-Null
$taskOwner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach ($taskPath in @($taskRoot, $taskRecovery, $taskKey, (Join-Path $taskRoot 'Backups'), (Join-Path $taskRoot 'BackupWork'))) {
    $taskAcl = Get-Acl -LiteralPath $taskPath
    $taskRules = @($taskAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    if (-not $taskAcl.AreAccessRulesProtected -or $taskRules.Count -ne 2) { throw 'DACL is not exclusively protected.' }
    foreach ($taskRule in $taskRules) {
        if ($taskRule.IdentityReference.Value -notin @($taskOwner, 'S-1-5-18') -or $taskRule.AccessControlType -ne 'Allow' -or $taskRule.FileSystemRights -ne 'FullControl') {
            throw 'Unexpected principal or rights survived initialization.'
        }
    }
}
& (Join-Path $PSScriptRoot '..\scripts\init-backup.ps1') | Out-Null
if ((Get-FileHash -LiteralPath $taskKey).Hash -ne $taskHash) { throw 'Existing recovery key was replaced.' }
Write-Output 'Stale directory/file grants removed; exact owner/SYSTEM DACLs verified; key preserved on rerun.'
