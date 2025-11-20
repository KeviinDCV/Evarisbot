@echo off
REM Script para iniciar todos los servicios necesarios

echo ========================================
echo  Iniciando Todos los Servicios
echo ========================================
echo.

REM 1. Iniciar Servidor PHP
echo [1/3] Iniciando Servidor PHP...
start "PHP Server" /MIN cmd /c "start-server.bat"
timeout /t 3 /nobreak > nul
echo    ✅ Servidor PHP iniciado

REM 2. Iniciar Reverb
echo.
echo [2/3] Iniciando Reverb (WebSockets)...
start "Laravel Reverb" /MIN cmd /c "start-reverb-optimized.bat"
timeout /t 3 /nobreak > nul
echo    ✅ Reverb iniciado

REM 3. Iniciar Queue Worker
echo.
echo [3/3] Iniciando Queue Worker...
start "Queue Worker" /MIN cmd /c "start-queue-worker.bat"
timeout /t 2 /nobreak > nul
echo    ✅ Queue Worker iniciado

echo.
echo ========================================
echo  ✅ Todos los Servicios Iniciados
echo ========================================
echo.
echo Servicios corriendo:
echo   - PHP Server (http://localhost:8000)
echo   - Reverb (WebSockets)
echo   - Queue Worker
echo.
echo Para detener: Cerrar las ventanas de comandos
echo.
pause
