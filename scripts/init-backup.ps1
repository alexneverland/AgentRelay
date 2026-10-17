$ErrorActionPreference = 'Stop'
# Owner-only storage outside Git. Re-running never replaces an existing key.
$taskRoot = Join-Path $env:LOCALAPPDATA 'AgentRelay'
$taskOwnerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$taskSystemSid = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
$taskAllowed = @($taskOwnerSid, $taskSystemSid) | Sort-Object Value -Unique
function Protect-BackupItem([string]$LiteralPath) {
    $taskItem = Get-Item -LiteralPath $LiteralPath -Force
    if ($taskItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Backup storage cannot contain reparse points.' }
    if ($taskItem.PSIsContainer) {
        $taskAcl = New-Object System.Security.AccessControl.DirectorySecurity
        $taskInheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    } else {
        $taskAcl = New-Object System.Security.AccessControl.FileSecurity
        $taskInheritance = [System.Security.AccessControl.InheritanceFlags]::None
    }
    # Build a fresh DACL: preserve neither inherited nor unrelated explicit ACEs.
    $taskAcl.SetAccessRuleProtection($true, $false)
    foreach ($taskSid in $taskAllowed) {
        $taskRule = New-Object System.Security.AccessControl.FileSystemAccessRule($taskSid, 'FullControl', $taskInheritance, 'None', 'Allow')
        $taskAcl.AddAccessRule($taskRule)
    }
    # Replace Access/Owner only; changing audit (SACL) sections would require elevation.
    $taskLiveAcl = Get-Acl -LiteralPath $LiteralPath
    $taskAccessSection = [System.Security.AccessControl.AccessControlSections]::Access
    $taskLiveAcl.SetSecurityDescriptorSddlForm($taskAcl.GetSecurityDescriptorSddlForm($taskAccessSection), $taskAccessSection)
    $taskLiveAcl.SetOwner($taskOwnerSid)
    if ($taskItem.PSObject.Methods.Name -contains 'SetAccessControl') {
        $taskItem.SetAccessControl($taskLiveAcl)
    } else {
        [System.IO.FileSystemAclExtensions]::SetAccessControl($taskItem, $taskLiveAcl)
    }
    $taskReadback = Get-Acl -LiteralPath $LiteralPath
    $taskRules = @($taskReadback.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    if (-not $taskReadback.AreAccessRulesProtected -or $taskRules.Count -ne $taskAllowed.Count -or $taskReadback.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $taskOwnerSid.Value) { throw 'Private backup ACL verification failed.' }
    foreach ($taskRule in $taskRules) {
        if ($taskRule.IdentityReference.Value -notin $taskAllowed.Value -or $taskRule.AccessControlType -ne 'Allow' -or $taskRule.FileSystemRights -ne 'FullControl' -or $taskRule.InheritanceFlags -ne $taskInheritance -or $taskRule.IsInherited) {
            throw 'Unexpected backup access rule after protection.'
        }
    }
}
function Protect-BackupTree([string]$LiteralPath) {
    Protect-BackupItem $LiteralPath
    if ((Get-Item -LiteralPath $LiteralPath -Force).PSIsContainer) {
        foreach ($taskChild in Get-ChildItem -LiteralPath $LiteralPath -Force) { Protect-BackupTree $taskChild.FullName }
    }
}
foreach ($taskFolder in @($taskRoot, (Join-Path $taskRoot 'Backups'), (Join-Path $taskRoot 'Recovery'), (Join-Path $taskRoot 'BackupWork'))) {
    New-Item -ItemType Directory -Path $taskFolder -Force | Out-Null
    Protect-BackupItem $taskFolder
}
Protect-BackupTree $taskRoot
$taskKey = Join-Path $taskRoot 'Recovery\backup-key.bin'
if (-not (Test-Path -LiteralPath $taskKey)) {
    $taskBytes = New-Object byte[] 32
    $taskRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRandom.GetBytes($taskBytes) } finally { $taskRandom.Dispose() }
    [System.IO.File]::WriteAllBytes($taskKey, $taskBytes)
}
if ((Get-Item -LiteralPath $taskKey).Length -ne 32) { throw 'Invalid existing backup key; preserve it and investigate.' }
Protect-BackupItem $taskKey
Write-Output "Private backup storage ready: $taskRoot"
Write-Output 'Keep a separate offline copy of Recovery\backup-key.bin. Never upload it with a backup.'
