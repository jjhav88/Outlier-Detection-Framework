#!/bin/bash
# Script para ejecutar pruebas con el servidor corriendo
# Uso: bash testing/run_tests_with_server.sh

echo "=========================================="
echo "SISTAOUT - Ejecución de Pruebas"
echo "=========================================="
echo ""

# Verificar si el servidor está corriendo
echo "🔍 Verificando si el servidor está corriendo..."
if curl -s http://localhost:8000/api/test > /dev/null 2>&1; then
    echo "✅ Servidor detectado en http://localhost:8000"
    echo ""
    
    # Ejecutar todas las pruebas
    echo "🧪 Ejecutando todas las pruebas..."
    python testing/run_all_tests.py --verbose
    
    echo ""
    echo "=========================================="
    echo "✅ Pruebas completadas"
    echo "=========================================="
else
    echo "❌ Servidor no detectado en http://localhost:8000"
    echo ""
    echo "Por favor, inicia el servidor primero:"
    echo "  python main.py"
    echo ""
    echo "Luego ejecuta este script nuevamente."
    exit 1
fi

