# =============================================================
#  EVARISBOT - Panel de Control Remoto
#  Accesible desde cualquier PC en la red: http://<IP>:9999
# =============================================================

param(
    [int]$Port = 9999
)

$ErrorActionPreference = "Continue"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatePath = Join-Path $ProjectDir "evarisbot_panel.html"

# Verificar que existe el template
if (-not (Test-Path $TemplatePath)) {
    Write-Host "  ERROR: No se encontro evarisbot_panel.html" -ForegroundColor Red
    Read-Host "  Presiona Enter para salir"
    exit 1
}

# Leer template una sola vez
$HtmlTemplate = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)

# --- Funciones auxiliares ---

function Get-ServiceStatus {
    $laravel = $false
    $ngrok   = $false
    $queue   = $false

    # Verificar Laravel (puerto 8000)
    $listening = netstat -ano | Select-String ":8000.*LISTENING"
    if ($listening) { $laravel = $true }

    # Verificar Ngrok
    $ngrokProc = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue
    if ($ngrokProc) { $ngrok = $true }

    # Verificar Queue Worker
    $phpProcs = Get-Process -Name "php" -ErrorAction SilentlyContinue
    if ($phpProcs) {
        foreach ($proc in $phpProcs) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
                if ($cmdLine -match "queue:work") {
                    $queue = $true
                    break
                }
            } catch {}
        }
    }

    return @{
        laravel = $laravel
        ngrok   = $ngrok
        queue   = $queue
        all     = ($laravel -and $ngrok -and $queue)
    }
}

function Start-EvarisbotServices {
    $batPath = Join-Path $ProjectDir "evarisbot_start.bat"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$batPath`"" -WorkingDirectory $ProjectDir
    Start-Sleep -Seconds 10
    return Get-ServiceStatus
}

function Stop-EvarisbotServices {
    $batPath = Join-Path $ProjectDir "evarisbot_stop.bat"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$batPath`"" -WorkingDirectory $ProjectDir -WindowStyle Hidden
    Start-Sleep -Seconds 4
    return Get-ServiceStatus
}

function Get-NgrokUrl {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
        $tunnel = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if ($tunnel) { return $tunnel.public_url }
        $tunnel = $response.tunnels | Select-Object -First 1
        if ($tunnel) { return $tunnel.public_url }
    } catch {}
    return $null
}

function Get-HtmlPage {
    param($Status, $Message, $MessageType)

    $ngrokUrl = Get-NgrokUrl

    # Determinar valores
    $laravelClass = if ($Status.laravel) { "status-on" } else { "status-off" }
    $laravelText  = if ($Status.laravel) { "Activo" } else { "Detenido" }
    $ngrokClass   = if ($Status.ngrok) { "status-on" } else { "status-off" }
    $ngrokText    = if ($Status.ngrok) { "Activo" } else { "Detenido" }
    $queueClass   = if ($Status.queue) { "status-on" } else { "status-off" }
    $queueText    = if ($Status.queue) { "Activo" } else { "Detenido" }
    $overallClass = if ($Status.all) { "overall-on" } else { "overall-off" }
    $overallText  = if ($Status.all) { "Todos los servicios activos" } else { "Algunos servicios detenidos" }
    $overallEmoji = if ($Status.all) { "&#9989;" } else { "&#10060;" }

    $messageHtml = ""
    if ($Message) {
        $alertClass = if ($MessageType -eq "success") { "alert-success" } else { "alert-error" }
        $messageHtml = "<div class='alert $alertClass'>$Message</div>"
    }

    if ($ngrokUrl) {
        $ngrokUrlHtml = "<a href='$ngrokUrl' target='_blank'>$ngrokUrl</a>"
    } else {
        $ngrokUrlHtml = "<span style='color:#94a3b8'>No disponible - Ngrok no esta activo</span>"
    }

    $currentTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $hostname = $env:COMPUTERNAME
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress

    # Reemplazar placeholders en el template
    $html = $HtmlTemplate
    $html = $html.Replace("{{OVERALL_EMOJI}}", $overallEmoji)
    $html = $html.Replace("{{HOSTNAME}}", $hostname)
    $html = $html.Replace("{{IP}}", $ip)
    $html = $html.Replace("{{MESSAGE_HTML}}", $messageHtml)
    $html = $html.Replace("{{OVERALL_CLASS}}", $overallClass)
    $html = $html.Replace("{{OVERALL_TEXT}}", $overallText)
    $html = $html.Replace("{{LARAVEL_CLASS}}", $laravelClass)
    $html = $html.Replace("{{LARAVEL_TEXT}}", $laravelText)
    $html = $html.Replace("{{NGROK_CLASS}}", $ngrokClass)
    $html = $html.Replace("{{NGROK_TEXT}}", $ngrokText)
    $html = $html.Replace("{{QUEUE_CLASS}}", $queueClass)
    $html = $html.Replace("{{QUEUE_TEXT}}", $queueText)
    $html = $html.Replace("{{NGROK_URL_HTML}}", $ngrokUrlHtml)
    $html = $html.Replace("{{CURRENT_TIME}}", $currentTime)

    return $html
}

# --- Servidor HTTP ---

$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   EVARISBOT - Panel de Control Remoto" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Local:   http://localhost:$Port" -ForegroundColor Green
Write-Host "  Red:     http://${localIP}:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "  Accede desde cualquier PC en la red!" -ForegroundColor Yellow
Write-Host "  Presiona Ctrl+C para cerrar el panel." -ForegroundColor DarkGray
Write-Host ""

# Crear listener HTTP
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")

try {
    $listener.Start()
    Write-Host "  Listener HTTP iniciado correctamente." -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: No se pudo iniciar en puerto $Port" -ForegroundColor Red
    Write-Host "  Detalle: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Soluciones:" -ForegroundColor Yellow
    Write-Host "  1. Ejecuta evarisbot_manager.bat (no el .ps1 directo)" -ForegroundColor Yellow
    Write-Host "  2. O ejecuta PowerShell como Administrador" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Presiona Enter para salir"
    exit 1
}

Write-Host "  Servidor escuchando..." -ForegroundColor Green
Write-Host ""

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $action = $null
        $message = $null
        $messageType = $null

        # Parsear query string
        if ($request.Url.Query -match "action=(\w+)") {
            $action = $Matches[1]
        }

        # Favicon
        if ($request.Url.AbsolutePath -eq "/favicon.ico") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        # Ejecutar accion
        switch ($action) {
            "start" {
                Write-Host "  [$(Get-Date -Format 'HH:mm:ss')] Iniciando servicios..." -ForegroundColor Green
                $status = Start-EvarisbotServices
                $message = "Servicios iniciados correctamente"
                $messageType = "success"
            }
            "stop" {
                Write-Host "  [$(Get-Date -Format 'HH:mm:ss')] Deteniendo servicios..." -ForegroundColor Red
                $status = Stop-EvarisbotServices
                $message = "Servicios detenidos correctamente"
                $messageType = "success"
            }
            "restart" {
                Write-Host "  [$(Get-Date -Format 'HH:mm:ss')] Reiniciando servicios..." -ForegroundColor Yellow
                Stop-EvarisbotServices | Out-Null
                Start-Sleep -Seconds 2
                $status = Start-EvarisbotServices
                $message = "Servicios reiniciados correctamente"
                $messageType = "success"
            }
            default {
                $status = Get-ServiceStatus
            }
        }

        # Generar HTML
        $html = Get-HtmlPage -Status $status -Message $message -MessageType $messageType
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)

        $response.ContentType = "text/html; charset=utf-8"
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.Close()

        $statusIcon = if ($status.all) { "[OK]" } else { "[!!]" }
        Write-Host "  [$(Get-Date -Format 'HH:mm:ss')] $statusIcon Peticion desde $($request.RemoteEndPoint) $(if($action) { "-> $action" })" -ForegroundColor DarkGray

    } catch [System.Net.HttpListenerException] {
        break
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$listener.Stop()
Write-Host ""
Write-Host "  Panel de control detenido." -ForegroundColor Yellow
