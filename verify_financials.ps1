$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:3001"
$email = "admin@powertrack.com"
$password = "admin123"

try {
    Write-Host "1. Logging in..." -ForegroundColor Cyan
    $loginBody = @{
        email    = $email
        password = $password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "Login successful. Token acquired." -ForegroundColor Green

    Write-Host "2. Fetching Dashboard Summary..." -ForegroundColor Cyan
    $headers = @{
        "Authorization" = "Bearer $token"
    }

    $summary = Invoke-RestMethod -Uri "$baseUrl/api/v1/dashboard/summary" -Method Get -Headers $headers
    
    Write-Host "`nFinancial Stats:" -ForegroundColor Yellow
    $stats = $summary.financial_stats
    
    Write-Host "Total Capex IDR: $([math]::Round($stats.total_capex_idr, 2))"
    Write-Host "Total Savings IDR: $([math]::Round($stats.total_savings_idr, 2))"
    Write-Host "Payback Years: $([math]::Round($stats.payback_years, 2))"
    Write-Host "IRR Percent: $([math]::Round($stats.irr_percent, 2))%"
    Write-Host "LCOE IDR/kWh: $([math]::Round($stats.lcoe_idr_per_kwh, 2))"
    
    # Validation Logic
    if ($stats.total_savings_idr -gt 0) {
        Write-Host "`n✅ SUCCESS: Total Savings > 0 (Lifetime calculation working)" -ForegroundColor Green
    }
    else {
        Write-Host "`n⚠️ WARNING: Total Savings is 0 (Might be expected if no data, or bug persists)" -ForegroundColor Magenta
    }

    if ($stats.payback_years -gt 0 -and $stats.payback_years -lt 100) {
        Write-Host "✅ SUCCESS: Payback Years seems reasonable ($($stats.payback_years))" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ WARNING: Payback Years is suspicious ($($stats.payback_years))" -ForegroundColor Magenta
    }

}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body: $($reader.ReadToEnd())" -ForegroundColor Red
    }
}
