# Script para cerrar procesos que usan un puerto específico
# Uso: .\scripts\kill_port.ps1 -Port 8000

param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Buscando procesos usando el puerto $Port..." -ForegroundColor Yellow

# Obtener procesos usando el puerto
$processes = netstat -ano | Select-String ":$Port" | ForEach-Object {
    $line = $_.Line
    if ($line -match '\s+(\d+)\s*$') {
        $matches[1]
    }
} | Select-Object -Unique

if ($processes) {
    Write-Host "Procesos encontrados: $($processes -join ', ')" -ForegroundColor Cyan
    
    foreach ($processId in $processes) {
        try {
            $process = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Cerrando proceso: $($process.ProcessName) (PID: $processId)..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force
            Write-Host "Proceso $processId cerrado exitosamente." -ForegroundColor Green
        }
        catch {
            Write-Host "Error al cerrar proceso $processId : $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`nPuerto $Port liberado. Puedes reiniciar el servidor ahora." -ForegroundColor Green
}
else {
    Write-Host "No se encontraron procesos usando el puerto $Port." -ForegroundColor Green
}

