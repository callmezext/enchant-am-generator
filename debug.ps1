$ErrorActionPreference = "Stop"
try {
    $body = @{ service = "spotify"; apiKey = "fgsiapi-1623d434-6d" } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/generate" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 120
    Write-Host "STATUS: $($resp.StatusCode)"
    Write-Host "RESPONSE: $($resp.Content)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
