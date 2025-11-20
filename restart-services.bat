@echo off
REM Script para reiniciar servicios que consumen mucha memoria

echo ========================================
echo  Reiniciando Servicios - Evarisbot
echo ========================================
echo.

REM 1. Detener Node.js (Reverb)
echo [1/3] Deteniendo Node.js (Reverb)...
taskkill /IM node.exe /F 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ✅ Node.js detenido
) else (
    echo    ℹ️  Node.js no estaba corriendo
)
timeout /t 2 /nobreak > nul

REM 2. Detener Queue Worker
echo.
echo [2/3] Deteniendo Queue Workers...
taskkill /FI "WINDOWTITLE eq php artisan queue:work*" /F 2>nul
timeout /t 2 /nobreak > nul
echo    ✅ Workers detenidos
timeout /t 2 /nobreak > nul

REM 3. Reiniciar servicios
echo.
echo [3/3] Reiniciando servicios...
echo.

REM Iniciar Reverb
echo Iniciando Reverb...
start "Laravel Reverb" /MIN cmd /c "php artisan reverb:start"
timeout /t 3 /nobreak > nul
echo    ✅ Reverb iniciado

REM Iniciar Queue Worker optimizado
echo.
echo Iniciando Queue Worker optimizado...
start "Queue Worker" /MIN cmd /c "start-queue-worker.bat"
timeout /t 2 /nobreak > nul
echo    ✅ Queue Worker iniciado

echo.
echo ========================================
echo  ✅ Servicios reiniciados exitosamente
echo ========================================
echo.
echo Ver procesos activos:
echo   tasklist ^| findstr "node php"
echo.
pause
