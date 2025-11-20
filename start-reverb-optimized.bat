@echo off
REM Script optimizado para Reverb con reinicio automático

echo ========================================
echo  Reverb con Reinicio Automatico
echo ========================================
echo.

:loop
echo [%date% %time%] Iniciando Reverb...

REM Configurar límite de memoria para Node.js (en MB)
set NODE_OPTIONS=--max-old-space-size=512

php artisan reverb:start

echo.
echo [%date% %time%] Reverb detenido. Reiniciando en 10 segundos...
timeout /t 10 /nobreak > nul

REM Limpiar memoria cada reinicio
taskkill /IM node.exe /F 2>nul
timeout /t 2 /nobreak > nul

goto loop
