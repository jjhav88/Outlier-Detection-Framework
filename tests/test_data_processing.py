"""
Tests unitarios para el módulo data_processing.py
"""
import pytest
import pandas as pd
import numpy as np
import os
import json
from pathlib import Path
from analysis_core.data_processing import DataProcessor


class TestDataProcessor:
    """Tests para la clase DataProcessor"""
    
    def test_init(self, data_processor_with_temp_dir):
        """Test de inicialización"""
        processor = data_processor_with_temp_dir
        assert processor is not None
        assert isinstance(processor.datasets, dict)
    
    def test_safe_float(self, data_processor_with_temp_dir):
        """Test de conversión segura a float"""
        processor = data_processor_with_temp_dir
        
        # Valores válidos
        assert processor.safe_float("123.45") == 123.45
        assert processor.safe_float(100) == 100.0
        
        # Valores inválidos
        assert processor.safe_float(None) is None
        assert processor.safe_float("abc") is None
        assert processor.safe_float(np.nan) is None
    
    def test_classify_variable_type(self, data_processor_with_temp_dir):
        """Test de clasificación de tipos de variables"""
        processor = data_processor_with_temp_dir
        
        # Variable continua
        continuous = pd.Series(np.random.normal(100, 15, 100))
        assert processor.classify_variable_type(continuous) == "cuantitativa_continua"
        
        # Variable discreta (pocos valores únicos)
        discrete = pd.Series([1, 2, 3, 1, 2, 3] * 10)
        assert processor.classify_variable_type(discrete) == "cuantitativa_discreta"
        
        # Variable categórica binaria
        binary = pd.Series(['A', 'B'] * 10)
        assert processor.classify_variable_type(binary) == "cualitativa_nominal_binaria"
        
        # Variable categórica nominal
        nominal = pd.Series(['A', 'B', 'C', 'D'] * 5)
        assert processor.classify_variable_type(nominal) == "cualitativa_nominal"
    
    def test_process_dataset(self, data_processor_with_temp_dir, sample_csv_file):
        """Test de procesamiento de dataset"""
        processor = data_processor_with_temp_dir
        
        filename = "test_data.csv"
        result = processor.process_dataset(sample_csv_file, filename)
        
        assert result is not None
        assert result["filename"] == filename
        assert result["rows"] == 20
        assert result["columns"] == 4
        assert "variable_types" in result
        assert filename in processor.datasets
    
    def test_get_dataframe(self, data_processor_with_temp_dir, sample_csv_file):
        """Test de obtención de DataFrame"""
        processor = data_processor_with_temp_dir
        
        # Primero procesar el dataset
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        
        # Luego obtener el DataFrame
        df = processor.get_dataframe(filename)
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 20
        assert len(df.columns) == 4
    
    def test_get_dataframe_nonexistent(self, data_processor_with_temp_dir):
        """Test de error cuando el dataset no existe"""
        processor = data_processor_with_temp_dir
        
        with pytest.raises(ValueError, match="Dataset.*no encontrado"):
            processor.get_dataframe("nonexistent.csv")
    
    def test_get_summary_statistics(self, data_processor_with_temp_dir):
        """Test de cálculo de estadísticas descriptivas"""
        processor = data_processor_with_temp_dir
        
        df = pd.DataFrame({
            'numeric': [1, 2, 3, 4, 5],
            'categorical': ['A', 'B', 'A', 'B', 'A']
        })
        
        variable_types = {
            'numeric': 'cuantitativa_continua',
            'categorical': 'cualitativa_nominal'
        }
        
        stats = processor.get_summary_statistics(df, variable_types)
        
        assert 'numeric' in stats
        assert 'categorical' in stats
        assert 'mean' in stats['numeric']
        assert 'mode' in stats['categorical']
    
    def test_save_and_load_datasets(self, data_processor_with_temp_dir, sample_csv_file):
        """Test de guardado y carga de datasets"""
        processor = data_processor_with_temp_dir
        
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        processor.save_datasets()
        
        # Verificar que el archivo existe
        assert os.path.exists(processor.datasets_file)
        
        # Crear nuevo processor y cargar
        processor2 = DataProcessor()
        processor2.datasets_file = processor.datasets_file
        processor2.load_datasets()
        
        assert filename in processor2.datasets
        assert processor2.datasets[filename]["filename"] == filename
    
    def test_get_dataset_preview(self, data_processor_with_temp_dir, sample_csv_file):
        """Test de vista previa de dataset"""
        processor = data_processor_with_temp_dir
        
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        
        preview = processor.get_dataset_preview(filename, rows=5)
        
        assert isinstance(preview, list)
        assert len(preview) <= 5

