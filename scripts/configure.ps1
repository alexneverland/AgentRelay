$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot\..
$taskEnvPath = Join-Path (Get-Location).Path '.env.local'
if (Test-Path -LiteralPath $taskEnvPath) { throw '.env.local exists. Edit it directly; this script will not overwrite it.' }
$taskProjectUrl = Read-Host 'Supabase project URL (https://PROJECT.supabase.co)'
if ($taskProjectUrl -notmatch '^https://[a-z0-9]+\.supabase\.co$') { throw 'Expected a hosted Supabase project URL.' }
$taskPublishableKey = Read-Host 'Publishable key (sb_publishable_... or legacy anon key)'
$taskDbUrlSecure = Read-Host 'Full Transaction pooler connection URI (password URL-encoded)' -AsSecureString
$taskDbUrl = [System.Net.NetworkCredential]::new('', $taskDbUrlSecure).Password
if ($taskDbUrl -notmatch '^postgres(?:ql)?://[^\r\n]+supabase\.(?:com|co):(?:5432|6543)/postgres(?:\?.*)?$') { throw 'Expected a Supabase connection URI. Use Connect > Transaction pooler.' }
$taskContent = "NEXT_PUBLIC_SUPABASE_URL=$taskProjectUrl`nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$taskPublishableKey`nDATABASE_URL=$taskDbUrl`nAPP_ORIGIN=http://127.0.0.1:3000`n"
[IO.File]::WriteAllText($taskEnvPath, $taskContent, [Text.UTF8Encoding]::new($false))
$taskDbUrl = $null
$taskContent = $null
Write-Host 'Created ignored .env.local. No credentials printed. Restart npm run dev.'
