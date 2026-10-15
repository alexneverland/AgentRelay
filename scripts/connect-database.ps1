$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskEnvPath = Join-Path $taskRoot '.env.local'
if (-not (Test-Path -LiteralPath $taskEnvPath)) { throw 'The project .env.local must exist first.' }
$taskCurrentEnv = [IO.File]::ReadAllText($taskEnvPath)
if ($taskCurrentEnv -match '(?m)^DATABASE_URL=.+') { throw 'DATABASE_URL already exists; no changes made.' }
$taskPasswordSecure = Read-Host 'Enter the database password you just chose in Supabase (hidden)' -AsSecureString
$taskPasswordPlain = [System.Net.NetworkCredential]::new('', $taskPasswordSecure).Password
if ([string]::IsNullOrWhiteSpace($taskPasswordPlain)) { throw 'Empty password; no changes made.' }
$taskEncoded = [Uri]::EscapeDataString($taskPasswordPlain)
$taskLine = "`nDATABASE_URL=postgresql://postgres.jrxgbdaezkckpumxvfvm:$taskEncoded@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`n"
[IO.File]::AppendAllText($taskEnvPath, $taskLine, [Text.UTF8Encoding]::new($false))
$taskPasswordPlain = $null
$taskEncoded = $null
$taskLine = $null
Write-Host 'Database connection saved in ignored .env.local. No password printed.'
