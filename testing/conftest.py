# -*- coding: utf-8 -*-
"""
Configuración compartida para todas las pruebas en el directorio testing

Este archivo contiene fixtures y configuraciones que pueden ser compartidas
entre diferentes archivos de prueba.
"""

import sys
import os
import pytest
import pandas as pd
import numpy as np
import tempfile
import shutil

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture(scope="session")
def test_data_dir():
    """Crear directorio temporal para datos de prueba (sesión completa)"""
    temp_path = tempfile.mkdtemp(prefix="sistaout_test_")
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture(scope="function")
def sample_dataframe():
    """Crear DataFrame de muestra para pruebas"""
    np.random.seed(42)
    n_samples = 50
    
    data = {
        'ID': [f'SUBJ-{i:03d}' for i in range(1, n_samples + 1)],
        'Var1': np.random.normal(50, 10, n_samples),
        'Var2': np.random.normal(30, 5, n_samples),
        'Var3': np.random.normal(100, 20, n_samples),
        'Category': np.random.choice(['A', 'B', 'C'], n_samples)
    }
    
    return pd.DataFrame(data)


@pytest.fixture(scope="function")
def sample_dataframe_with_outliers():
    """Crear DataFrame de muestra con outliers intencionales"""
    np.random.seed(42)
    n_samples = 50
    
    data = {
        'ID': [f'SUBJ-{i:03d}' for i in range(1, n_samples + 1)],
        'Var1': np.random.normal(50, 10, n_samples),
        'Var2': np.random.normal(30, 5, n_samples),
        'Var3': np.random.normal(100, 20, n_samples),
        'Category': np.random.choice(['A', 'B', 'C'], n_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Agregar outliers intencionales
    df.loc[0, 'Var1'] = 200  # Outlier claro
    df.loc[1, 'Var2'] = 100  # Outlier claro
    df.loc[2, 'Var3'] = 300  # Outlier claro
    
    return df


@pytest.fixture(scope="function")
def temp_directory():
    """Crear directorio temporal para pruebas individuales"""
    temp_path = tempfile.mkdtemp(prefix="test_")
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture(scope="function")
def csv_file(temp_directory, sample_dataframe):
    """Crear archivo CSV temporal para pruebas"""
    file_path = os.path.join(temp_directory, 'test_data.csv')
    sample_dataframe.to_csv(file_path, index=False)
    return file_path


@pytest.fixture(scope="function")
def excel_file(temp_directory, sample_dataframe):
    """Crear archivo Excel temporal para pruebas"""
    file_path = os.path.join(temp_directory, 'test_data.xlsx')
    sample_dataframe.to_excel(file_path, index=False)
    return file_path

