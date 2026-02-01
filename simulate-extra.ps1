
$API_KEYS = @(
    "pt_live_2b13ffd6fcfe5cc9a53a94d29e611a87efe6fe49ceb4bd90b8da1a414a511f9d"
)

$URL = "http://localhost:3001/api/v1/telemetry"

# Base averages
$baseSolarKw = 3.5
$baseLoadKw = 1.6

Write-Host "Starting EXTRA Simulation for new school..." -ForegroundColor Magenta

while ($true) {

    for ($i = 0; $i -lt $API_KEYS.Count; $i++) {
        $API_KEY = $API_KEYS[$i]

        # ---- Independent solar per school
        $solar_kw = $baseSolarKw + (Get-Random -Minimum -0.8 -Maximum 0.8)
        $solar_kw = [math]::Max(0.5, [math]::Round($solar_kw, 2))

        # ---- Independent load per school
        $load_kw = $baseLoadKw + (Get-Random -Minimum -0.4 -Maximum 0.5)
        $load_kw = [math]::Round($load_kw, 2)

        # ---- Grid interaction
        $grid_export = [math]::Max(0, $solar_kw - $load_kw)
        $grid_import = [math]::Max(0, $load_kw - $solar_kw)

        # ---- Environment
        $irradiance = [math]::Round($solar_kw * 220, 1)
        $temp = [math]::Round(26 + ($solar_kw * 3), 1)

        # ---- Payload
        $body = @{
            power_w           = [math]::Round($solar_kw * 1000, 1)
            voltage           = 230
            current_a         = [math]::Round(($solar_kw * 1000) / 230, 2)
            daily_kwh         = [math]::Round($solar_kw * (10 / 3600), 4)
            total_kwh         = 1500 + (Get-Random -Minimum 0 -Maximum 250)
            load_kw           = $load_kw
            grid_import_kw    = [math]::Round($grid_import, 2)
            grid_export_kw    = [math]::Round($grid_export, 2)
            irradiance_wm2    = $irradiance
            temp_c            = $temp
            weather_condition = "sunny"
            ts                = [int][DateTimeOffset]::Now.ToUnixTimeSeconds()
        } | ConvertTo-Json -Compress

        $headers = @{ "Content-Type" = "application/json" }
        # Treat as X-API-KEY for this extra one
        $headers["X-API-KEY"] = $API_KEY
        $methodName = "HEADER X-API-KEY (EXTRA)"

        try {
            $response = Invoke-RestMethod `
                -Uri $URL `
                -Method POST `
                -Headers $headers `
                -Body $body `
                -ErrorAction Stop

            $shortKey = $API_KEY.Substring(8, 8) + "..."
            Write-Host "✅ [$methodName] Key: $shortKey | School: $($response.school_id) | Solar: $solar_kw kW" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Error for $($API_KEY.Substring(0,10)) using $methodName" -ForegroundColor Red
            Write-Host $_
        }
    }

    Start-Sleep -Seconds 10
}
