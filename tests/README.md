# Tests para ANOUT

Este directorio contiene los tests unitarios y de integración para el sistema ANOUT.

## Estructura

```
tests/
├── __init__.py
├── conftest.py              # Configuración y fixtures compartidas
├── test_data_processing.py  # Tests para DataProcessor
├── test_outlier_detection.py # Tests para OutlierDetector
├── test_analysis_and_viz.py  # Tests para AnalysisAndVisualization
├── test_integration.py       # Tests de integración
└── README.md                 # Este archivo
```

## Instalación

Las dependencias de testing están incluidas en `requirements.txt`. Instalar con:

```bash
pip install -r requirements.txt
```

## Ejecutar Tests

### Todos los tests
```bash
pytest
```

### Tests específicos
```bash
pytest tests/test_data_processing.py
pytest tests/test_outlier_detection.py
pytest tests/test_analysis_and_viz.py
pytest tests/test_integration.py
```

### Con cobertura
```bash
pytest --cov=analysis_core --cov-report=html
```

### Con verbose
```bash
pytest -v
```

### Solo tests que fallan
```bash
pytest -x
```

## Cobertura de Tests

Los tests cubren:

- ✅ **DataProcessor**: Carga, procesamiento, clasificación de variables
- ✅ **OutlierDetector**: Métodos univariados, multivariados y pruebas de hipótesis
- ✅ **AnalysisAndVisualization**: Análisis descriptivo y pruebas estadísticas
- ✅ **Integración**: Pipeline completo de carga -> detección -> análisis

## Fixtures Disponibles

- `temp_data_dir`: Directorio temporal para archivos de prueba
- `sample_csv_file`: Archivo CSV de prueba
- `sample_dataframe`: DataFrame con outliers conocidos
- `data_processor_with_temp_dir`: DataProcessor con directorio temporal
- `outlier_detector`: OutlierDetector configurado para pruebas
- `analysis_viz`: AnalysisAndVisualization configurado para pruebas
- `sample_dataset_info`: Información de dataset de prueba

## Escribir Nuevos Tests

1. Importar pytest y los módulos necesarios
2. Usar las fixtures disponibles cuando sea posible
3. Seguir el patrón de nombres `test_*` para funciones de test
4. Agrupar tests relacionados en clases `Test*`
5. Usar `assert` para verificaciones

Ejemplo:

```python
def test_nueva_funcionalidad(outlier_detector):
    """Test de nueva funcionalidad"""
    result = outlier_detector.nueva_funcion()
    assert result is not None
```

## Notas

- Los tests usan directorios temporales para evitar modificar datos reales
- Los tests son independientes y pueden ejecutarse en cualquier orden
- Se usa `pytest.fixture` para setup y teardown automático

