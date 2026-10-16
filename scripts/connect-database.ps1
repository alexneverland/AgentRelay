$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskEnvPath = Join-Path $taskRoot '.env.local'
if (-not (Test-Path -LiteralPath $taskEnvPath)) { throw 'The project .env.local must exist first.' }
$taskCurrentEnv = [IO.File]::ReadAllText($taskEnvPath)
if ($taskCurrentEnv -match '(?m)^DATABASE_URL=.+') { throw 'DATABASE_URL already exists; no changes made.' }
$taskUriSecure = Read-Host 'Your own Supabase transaction pooler URI (URL-encoded password, hidden)' -AsSecureString
$taskUriPlain = [System.Net.NetworkCredential]::new('', $taskUriSecure).Password
if ($taskUriPlain -notmatch '^postgres(?:ql)?://[^\r\n]+supabase\.(?:com|co):6543/postgres(?:\?.*)?$') { throw 'Expected a hosted Supabase transaction pooler URI on port 6543; no changes made.' }
$taskLine = "`nDATABASE_URL=$taskUriPlain`n"
[IO.File]::AppendAllText($taskEnvPath, $taskLine, [Text.UTF8Encoding]::new($false))
$taskUriPlain = $null
$taskLine = $null
Write-Host 'Database connection saved in ignored .env.local. No password printed.'
