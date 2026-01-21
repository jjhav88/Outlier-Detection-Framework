#!/bin/bash
# Script Bash para ejecutar pruebas de carga
# Uso: bash testing/performance/run_load_test.sh

USERS=10
SPAWN_RATE=2
RUN_TIME="60s"
HOST="http://localhost:8000"
HEADLESS=false

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --users)
            USERS="$2"
            shift 2
            ;;
        --spawn-rate)
            SPAWN_RATE="$2"
            shift 2
            ;;
        --run-time)
            RUN_TIME="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --headless)
            HEADLESS=true
            shift
            ;;
        *)
            echo "Opción desconocida: $1"
            exit 1
            ;;
    esac
done

echo "============================================================"
echo "PRUEBAS DE CARGA - SISTAOUT"
echo "============================================================"
echo ""

# Verificar que Locust esté instalado
if ! command -v locust &> /dev/null; then
    echo "[ERROR] Locust no está instalado. Instalando..."
    pip install locust --quiet
    if [ $? -ne 0 ]; then
        echo "[ERROR] No se pudo instalar Locust"
        exit 1
    fi
fi

# Verificar que el servidor esté corriendo
echo "[INFO] Verificando que el servidor esté corriendo en $HOST..."
if curl -s "$HOST/api/test" > /dev/null; then
    echo "[OK] Servidor está corriendo"
else
    echo "[ERROR] El servidor no está corriendo en $HOST"
    echo "[INFO] Por favor, inicia el servidor primero"
    exit 1
fi

echo ""
echo "Configuración de la prueba:"
echo "  Usuarios: $USERS"
echo "  Tasa de spawn: $SPAWN_RATE usuarios/segundo"
echo "  Duración: $RUN_TIME"
echo "  Host: $HOST"
echo "  Modo: $([ "$HEADLESS" = true ] && echo 'Headless (sin UI)' || echo 'Con interfaz web')"
echo ""

# Crear directorio de reportes si no existe
REPORTS_DIR="testing/reports/performance"
mkdir -p "$REPORTS_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
HTML_REPORT="$REPORTS_DIR/load_test_$TIMESTAMP.html"
CSV_REPORT="$REPORTS_DIR/load_test_$TIMESTAMP.csv"

if [ "$HEADLESS" = true ]; then
    echo "[INFO] Ejecutando pruebas en modo headless..."
    echo ""
    
    locust -f testing/performance/load_test.py \
        --host="$HOST" \
        --users "$USERS" \
        --spawn-rate "$SPAWN_RATE" \
        --run-time "$RUN_TIME" \
        --headless \
        --html="$HTML_REPORT" \
        --csv="$CSV_REPORT"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "[OK] Pruebas completadas exitosamente"
        echo "[INFO] Reporte HTML: $HTML_REPORT"
        echo "[INFO] Reporte CSV: $CSV_REPORT"
    else
        echo ""
        echo "[ERROR] Las pruebas fallaron"
        exit 1
    fi
else
    echo "[INFO] Iniciando Locust con interfaz web..."
    echo "[INFO] Abre http://localhost:8089 en tu navegador"
    echo ""
    
    locust -f testing/performance/load_test.py --host="$HOST"
fi

