# Script para ver logs en tiempo real
Write-Host "=== ESPERANDO WEBHOOKS ===" -ForegroundColor Green
Write-Host ""
Write-Host "Envía un mensaje desde tu celular a: +57 310 2432780" -ForegroundColor Yellow
Write-Host "Presiona Ctrl+C para salir" -ForegroundColor Gray
Write-Host ""

$lastSize = (Get-Item "storage\logs\laravel.log").Length

while ($true) {
    Start-Sleep -Seconds 2
    
    $currentSize = (Get-Item "storage\logs\laravel.log").Length
    
    if ($currentSize -gt $lastSize) {
        $newLines = Get-Content "storage\logs\laravel.log" -Tail 10 | Select-String "Webhook received|Incoming message processed"
        
        if ($newLines) {
            Write-Host "🎉 WEBHOOK RECIBIDO:" -ForegroundColor Green
            $newLines | ForEach-Object { Write-Host $_ -ForegroundColor Cyan }
            Write-Host ""
        }
        
        $lastSize = $currentSize
    }
}
