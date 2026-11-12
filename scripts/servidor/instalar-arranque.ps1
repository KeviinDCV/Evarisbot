<#
  Evarisbot - Arranque automatico del worker de la cola y del tiempo real (Reverb), igual que Apache y MariaDB.

  Registra dos tareas programadas que se inician al encender el equipo (1 minuto despues, para que Apache y
  MariaDB ya esten arriba), con la cuenta del sistema, sin limite de tiempo y con reinicio si fallan:
    - "Evarisbot - Worker (cola)"     -> scripts\servidor\evarisbot-worker.cmd
    - "Evarisbot - Tiempo real"       -> scripts\servidor\evarisbot-tiempo-real.cmd
  Cada .cmd vuelve a lanzar su proceso si se cierra (por ejemplo tras "php artisan queue:restart" al publicar).

  Uso (como administrador, una sola vez):
    powershell -ExecutionPolicy Bypass -File scripts\servidor\instalar-arranque.ps1
    powershell -ExecutionPolicy Bypass -File scripts\servidor\instalar-arranque.ps1 -Quitar   (deshace todo)

  Al instalar tambien inicia las dos tareas ya mismo y le pide al worker que se abrio a mano que termine
  (php artisan queue:restart): asi queda un solo worker, el automatico.
#>
param([switch]$Quitar)

$ErrorActionPreference = 'Stop'
$proyecto = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$php = 'C:\xampp\php\php.exe'
$tareas = @(
    @{ Nombre = 'Evarisbot - Worker (cola)'; Cmd = Join-Path $PSScriptRoot 'evarisbot-worker.cmd'; Descripcion = 'Worker de la cola de Evarisbot (envios masivos, recordatorios). Se relanza solo si se cierra.' },
    @{ Nombre = 'Evarisbot - Tiempo real'; Cmd = Join-Path $PSScriptRoot 'evarisbot-tiempo-real.cmd'; Descripcion = 'Laravel Reverb (puerto 8080): avisos al instante para las pantallas. Se relanza solo si se cierra.' }
)

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    Write-Host 'Hay que ejecutarlo como administrador.' -ForegroundColor Red
    exit 1
}

if ($Quitar) {
    foreach ($t in $tareas) {
        if (Get-ScheduledTask -TaskName $t.Nombre -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $t.Nombre -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $t.Nombre -Confirm:$false
            Write-Host "Quitada: $($t.Nombre)"
        }
    }
    # Los .cmd quedan en un bucle: se cierran ellos y SOLO los php que lanzaron (en este equipo corren otros proyectos).
    $bucles = @(Get-CimInstance Win32_Process -Filter "name='cmd.exe'" | Where-Object {
        $_.CommandLine -match 'evarisbot-(worker|tiempo-real)\.cmd'
    })
    $idsBucles = @($bucles | ForEach-Object { $_.ProcessId })
    $bucles | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process -Filter "name='php.exe'" | Where-Object {
        $idsBucles -contains $_.ParentProcessId
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host 'Listo: el worker vuelve a ser manual y el tiempo real queda apagado (las pantallas consultan cada pocos segundos).'
    exit 0
}

if (-not (Test-Path $php)) { Write-Host "No se encontro PHP en $php" -ForegroundColor Red; exit 1 }
foreach ($t in $tareas) { if (-not (Test-Path $t.Cmd)) { Write-Host "Falta $($t.Cmd)" -ForegroundColor Red; exit 1 } }

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

foreach ($t in $tareas) {
    $accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$($t.Cmd)`"" -WorkingDirectory $proyecto
    $disparo = New-ScheduledTaskTrigger -AtStartup
    $disparo.Delay = 'PT1M'
    Register-ScheduledTask -TaskName $t.Nombre -Action $accion -Trigger $disparo -Principal $principal -Settings $ajustes `
        -Description $t.Descripcion -Force | Out-Null
    Write-Host "Registrada: $($t.Nombre) (al encender el equipo, cuenta del sistema)"
}

# Lo que se abrio a mano antes de instalar: el tiempo real manual se cierra (si no, chocaria en el puerto 8080; no
# guarda datos). Del worker solo se cierran las ventanas-bucle (cmd); el php termina con calma por queue:restart,
# asi nunca se corta un envio a medias.
Get-CimInstance Win32_Process -Filter "name='cmd.exe'" | Where-Object {
    $_.CommandLine -match 'evarisbot-(worker|tiempo-real)\.cmd'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
# Solo el Reverb de Evarisbot (puerto 8080); otros proyectos de este equipo no se tocan.
Get-CimInstance Win32_Process -Filter "name='php.exe'" | Where-Object {
    $_.CommandLine -match 'artisan reverb:start' -and $_.CommandLine -match '--port=8080'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Iniciar ya mismo, sin esperar a reiniciar el equipo.
foreach ($t in $tareas) {
    Start-ScheduledTask -TaskName $t.Nombre
    Write-Host "Iniciada: $($t.Nombre)"
}

# El worker abierto a mano (ventana "Evarisbot worker") termina tras el trabajo en curso; el automatico se relanza solo.
Start-Sleep -Seconds 5
Push-Location $proyecto
& $php artisan queue:restart | Out-Null
Pop-Location
Write-Host 'Se pidio al worker manual que termine: desde ahora queda solo el automatico.'

Start-Sleep -Seconds 10
foreach ($t in $tareas) {
    $info = Get-ScheduledTask -TaskName $t.Nombre | Get-ScheduledTaskInfo
    Write-Host ("{0}: estado={1}" -f $t.Nombre, (Get-ScheduledTask -TaskName $t.Nombre).State)
}
Write-Host 'Listo.' -ForegroundColor Green
