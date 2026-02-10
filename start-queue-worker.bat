@echo off
REM Script optimizado para iniciar queue worker con límites de memoria

echo ========================================
echo  Queue Worker con Limites de Memoria
echo ========================================
echo.

:loop
echo [%date% %time%] Iniciando worker...
php artisan queue:work database --sleep=3 --max-jobs=100 --max-time=3600 --memory=512 --timeout=120

echo.
echo [%date% %time%] Worker detenido. Reiniciando en 5 segundos...
timeout /t 5 /nobreak > nul

goto loop
