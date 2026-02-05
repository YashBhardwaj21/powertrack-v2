# ============================
# API KEYS (Multiple Schools)
# ============================
$API_KEYS = @(
    "pt_live_fcb220881cafd66665ddf79f72a16755ec225115a90e844f3d0402a24f45afef",
    "pt_live_c12a86a75a476da6d211b70c5045642b872165093de8dab9ebe652fdb7bcd6b5",
    "pt_live_49f6684c0c1b21ab79770c38d330e66a3a81f46cff867c918a6b9daba7dd5876",
    "pt_live_2b13ffd6fcfe5cc9a53a94d29e611a87efe6fe49ceb4bd90b8da1a414a511f9d"
)

$URL = "http://localhost:3001/api/v1/telemetry"

# Base averages
$baseSolarKw = 3.5
$baseLoadKw = 1.6

Write-Host "Starting Simulation for defined schools..." -ForegroundColor Cyan

while ($true) {

    # Initialize accumulators if not exists
    if (-not $script:accumulatedEnergy) {
        $script:accumulatedEnergy = @{}
    }

    for ($i = 0; $i -lt $API_KEYS.Count; $i++) {
        $API_KEY = $API_KEYS[$i]
        
        # Initialize school accumulator
        if (-not $script:accumulatedEnergy.ContainsKey($API_KEY)) {
            $script:accumulatedEnergy[$API_KEY] = 0
        }

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
        
        # ---- Accumulate Energy (10 seconds)
        $period_energy = $solar_kw * (10 / 3600)
        $script:accumulatedEnergy[$API_KEY] += $period_energy
        $daily_kwh = [math]::Round($script:accumulatedEnergy[$API_KEY], 4)

        # ---- Payload
        $body = @{
            power_w           = [math]::Round($solar_kw * 1000, 1)
            voltage           = 230
            current_a         = [math]::Round(($solar_kw * 1000) / 230, 2)
            daily_kwh         = $daily_kwh
            total_kwh         = [math]::Round(1500 + $daily_kwh, 2)
            load_kw           = $load_kw
            grid_import_kw    = [math]::Round($grid_import, 2)
            grid_export_kw    = [math]::Round($grid_export, 2)
            irradiance_wm2    = $irradiance
            temp_c            = $temp
            weather_condition = "sunny"
            ts                = [int][DateTimeOffset]::Now.ToUnixTimeSeconds()
        } | ConvertTo-Json -Compress

        # ---- Dynamic Auth Method Selection
        $headers = @{ "Content-Type" = "application/json" }
        $methodName = "Unknown"

        if ($i -eq 0) {
            # Method 1: Standard Custom Header (Original)
            $headers["X-API-KEY"] = $API_KEY
            $methodName = "HEADER X-API-KEY"
        }
        elseif ($i -eq 1) {
            # Method 2: Bearer Token (Modern Market Loggers)
            $headers["Authorization"] = "Bearer $API_KEY"
            $methodName = "AUTH BEARER"
        }
        else {
            # Method 3: Basic Auth (Legacy Market Loggers)
            # Simulating "Username: api, Password: [API_KEY]"
            $plainAuth = "api:$API_KEY"
            $authBytes = [System.Text.Encoding]::UTF8.GetBytes($plainAuth)
            $base64Auth = [Convert]::ToBase64String($authBytes)
            $headers["Authorization"] = "Basic $base64Auth"
            $methodName = "AUTH BASIC"
        }

        try {
            $response = Invoke-RestMethod `
                -Uri $URL `
                -Method POST `
                -Headers $headers `
                -Body $body `
                -ErrorAction Stop

            # Print success with specific School ID to verify isolation
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
