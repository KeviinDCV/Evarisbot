@echo off
REM Script para iniciar servidor PHP con límites optimizados

echo ========================================
echo  Servidor PHP Optimizado
echo ========================================
echo.

:loop
echo [%date% %time%] Iniciando servidor...

REM Iniciar servidor con límites altos
php -d memory_limit=512M -d max_execution_time=300 -d max_input_time=300 artisan serve

echo.
echo [%date% %time%] Servidor detenido. Reiniciando en 5 segundos...
timeout /t 5 /nobreak > nul

goto loop
