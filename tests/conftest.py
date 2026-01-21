"""
Configuración compartida para todos los tests.
Proporciona fixtures comunes y configuración de pytest.
"""
import pytest
import pandas as pd
import numpy as np
import os
import tempfile
import json
from pathlib import Path
import sys

# Agregar el directorio raíz al path para importar módulos
sys.path.insert(0, str(Path(__file__).parent.parent))

from analysis_core.data_processing import DataProcessor
from analysis_core.outlier_detection import OutlierDetector
from analysis_core.analysis_and_viz import AnalysisAndVisualization


@pytest.fixture
def temp_data_dir():
    """Crear directorio temporal para datos de prueba"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_csv_file(temp_data_dir):
    """Crear archivo CSV de prueba"""
    csv_path = os.path.join(temp_data_dir, "test_data.csv")
    df = pd.DataFrame({
        'id': range(1, 21),
        'variable1': np.random.normal(100, 15, 20),
        'variable2': np.random.normal(50, 10, 20),
        'category': ['A', 'B'] * 10
    })
    df.to_csv(csv_path, index=False)
    return csv_path


@pytest.fixture
def sample_dataframe():
    """Crear DataFrame de prueba con outliers conocidos"""
    np.random.seed(42)
    data = {
        'id': range(1, 21),
        'normal_var': np.random.normal(100, 15, 20),
        'outlier_var': [100] * 18 + [500, 600],  # 2 outliers claros
        'category': ['A', 'B'] * 10
    }
    return pd.DataFrame(data)


@pytest.fixture
def data_processor_with_temp_dir(temp_data_dir):
    """Crear DataProcessor con directorio temporal"""
    processor = DataProcessor()
    # Cambiar el archivo de datasets a uno temporal
    processor.datasets_file = os.path.join(temp_data_dir, "datasets.json")
    processor.datasets = {}
    return processor


@pytest.fixture
def outlier_detector(data_processor_with_temp_dir):
    """Crear OutlierDetector con DataProcessor de prueba"""
    return OutlierDetector(data_processor=data_processor_with_temp_dir)


@pytest.fixture
def analysis_viz(data_processor_with_temp_dir):
    """Crear AnalysisAndVisualization con DataProcessor de prueba"""
    return AnalysisAndVisualization(data_processor=data_processor_with_temp_dir)


@pytest.fixture
def sample_dataset_info(sample_csv_file):
    """Crear información de dataset de prueba"""
    return {
        "filename": "test_data.csv",
        "file_path": sample_csv_file,
        "rows": 20,
        "columns": 4,
        "column_names": ["id", "variable1", "variable2", "category"],
        "variable_types": {
            "id": "cuantitativa_discreta",
            "variable1": "cuantitativa_continua",
            "variable2": "cuantitativa_continua",
            "category": "cualitativa_nominal"
        }
    }

