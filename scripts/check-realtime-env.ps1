$ErrorActionPreference = "Stop"

function Test-Set($name) {
  $value = [Environment]::GetEnvironmentVariable($name)
  return -not [string]::IsNullOrWhiteSpace($value)
}

$required = @(
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_AGENT_SHARED_SECRET",
  "OPENAI_API_KEY"
)

Write-Host "Realtime interview provider configuration" -ForegroundColor Cyan
$missing = @()
foreach ($name in $required) {
  if (Test-Set $name) { Write-Host "[SET]     $name" -ForegroundColor Green }
  else { Write-Host "[MISSING] $name" -ForegroundColor Yellow; $missing += $name }
}

$provider = [Environment]::GetEnvironmentVariable("INTERVIEW_AVATAR_PROVIDER")
if ([string]::IsNullOrWhiteSpace($provider)) { $provider = "none" }
Write-Host "Avatar provider: $provider"

if ($provider.ToLowerInvariant() -eq "anam") {
  foreach ($name in @("ANAM_API_KEY", "ANAM_AVATAR_ID_1")) {
    if (Test-Set $name) { Write-Host "[SET]     $name" -ForegroundColor Green }
    else { Write-Host "[MISSING] $name" -ForegroundColor Yellow; $missing += $name }
  }
}

if ($missing.Count -gt 0) {
  Write-Host "`nMissing configuration prevents a live provider session." -ForegroundColor Yellow
  Write-Host "Add the values to the local .env file, then restart the web/agent processes."
  exit 1
}

Write-Host "`nProvider configuration is present. Run the app and perform a live interview smoke test." -ForegroundColor Green
