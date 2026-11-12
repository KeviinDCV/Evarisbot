@echo off
rem ============================================================================================
rem  Evarisbot - Tiempo real (Laravel Reverb): avisa al instante a las pantallas de los asesores.
rem  Lo arranca la tarea programada "Evarisbot - Tiempo real" al encender el equipo, con la cuenta
rem  del sistema (scripts\servidor\instalar-arranque.ps1). Escucha en el puerto 8080 de la red local.
rem  Si se cierra (php artisan reverb:restart o un fallo), se vuelve a lanzar solo a los 5 segundos.
rem  Si estuviera caido, nada se rompe: las pantallas vuelven a consultar cada pocos segundos.
rem  Registro: storage\logs\servicio-tiempo-real.log
rem ============================================================================================
setlocal
cd /d "%~dp0..\.."
set "PHP=C:\xampp\php\php.exe"
set "LOG=storage\logs\servicio-tiempo-real.log"

:bucle
echo [%date% %time%] Iniciando Reverb en 0.0.0.0:8080 >> "%LOG%"
"%PHP%" artisan reverb:start --host=0.0.0.0 --port=8080 >> "%LOG%" 2>&1
echo [%date% %time%] Reverb termino (codigo %errorlevel%). Se relanza en 5 s >> "%LOG%"
rem Espera de 5 s: "timeout" no funciona sin consola y "ping" aqui tarda mucho mas.
powershell -NoProfile -NonInteractive -Command "Start-Sleep -Seconds 5" > nul 2>&1
goto bucle
