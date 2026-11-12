@echo off
rem ============================================================================================
rem  Evarisbot - Worker de la cola (envios masivos, recordatorios de citas, etc.)
rem  Lo arranca la tarea programada "Evarisbot - Worker (cola)" al encender el equipo, con la
rem  cuenta del sistema, igual que Apache y MariaDB (scripts\servidor\instalar-arranque.ps1).
rem  Si el worker termina (php artisan queue:restart al publicar cambios, una hora cumplida o un
rem  fallo), se vuelve a lanzar solo a los 5 segundos. Registro: storage\logs\servicio-worker.log
rem ============================================================================================
setlocal
cd /d "%~dp0..\.."
set "PHP=C:\xampp\php\php.exe"
set "LOG=storage\logs\servicio-worker.log"

rem Al encender el equipo: si falta la cache de configuracion se genera (sin ella hubo errores 500).
if not exist "bootstrap\cache\config.php" (
    echo [%date% %time%] Falta bootstrap\cache\config.php: se genera >> "%LOG%"
    "%PHP%" artisan config:cache >> "%LOG%" 2>&1
)

:bucle
echo [%date% %time%] Iniciando worker >> "%LOG%"
"%PHP%" artisan queue:work --queue=default --timeout=120 --max-time=3600 --memory=512 --quiet >> "%LOG%" 2>&1
echo [%date% %time%] El worker termino (codigo %errorlevel%). Se relanza en 5 s >> "%LOG%"
rem Espera de 5 s: "timeout" no funciona sin consola y "ping" aqui tarda mucho mas.
powershell -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 5" > nul 2>&1
goto bucle
