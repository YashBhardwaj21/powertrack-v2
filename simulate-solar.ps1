$API_KEY = "pt_live_c9a30d18431c6a7bfc55ee1b5f2ca9ecca6fed5c8ab421ccccf493a8868a9c61"
$URL = "http://localhost:3001/api/v1/telemetry"

while ($true) {

    # Time of day (0–24)
    $hour = (Get-Date).Hour + (Get-Date).Minute / 60

    # Solar curve (bell shape)
    if ($hour -lt 6 -or $hour -gt 18) {
        $solar_kw = 0
    } else {
        $solar_kw = [math]::Sin((($hour - 6) / 12) * [math]::PI) * 5
    }

    # Load (school usage)
    $load_kw = 1.5 + (Get-Random -Minimum -0.2 -Maximum 0.4)

    # Grid interaction
    $grid_export = [math]::Max(0, $solar_kw - $load_kw)
    $grid_import = [math]::Max(0, $load_kw - $solar_kw)

    # Environmental
    $irradiance = $solar_kw * 200
    $temp = 25 + ($solar_kw * 4)

    $body = @{
        power_w         = [math]::Round($solar_kw * 1000, 1)
        voltage         = 230
        current_a       = [math]::Round(($solar_kw * 1000) / 230, 2)
        daily_kwh       = [math]::Round($solar_kw * 0.01, 3)
        total_kwh       = 1500 + (Get-Random -Minimum 0 -Maximum 50)
        load_kw         = [math]::Round($load_kw, 2)
        grid_import_kw  = [math]::Round($grid_import, 2)
        grid_export_kw  = [math]::Round($grid_export, 2)
        irradiance_wm2  = [math]::Round($irradiance, 1)
        temp_c          = [math]::Round($temp, 1)
        weather_condition = "sunny"
        ts              = [int][DateTimeOffset]::Now.ToUnixTimeSeconds()
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod `
            -Uri $URL `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
                "X-API-KEY" = $API_KEY
            } `
            -Body $body -ErrorAction Stop
            
        Write-Host "Sent solar:" $solar_kw "kW | Load:" $load_kw "kW"
    } catch {
        Write-Host "Error sending telemetry: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 10
}
