"""
Tests de integración para verificar el funcionamiento conjunto de módulos
"""
import pytest
import pandas as pd
import numpy as np
import os
from analysis_core.data_processing import DataProcessor
from analysis_core.outlier_detection import OutlierDetector
from analysis_core.analysis_and_viz import AnalysisAndVisualization


class TestIntegration:
    """Tests de integración entre módulos"""
    
    def test_full_pipeline(self, temp_data_dir, sample_csv_file):
        """Test del pipeline completo: carga -> detección -> análisis"""
        # 1. Inicializar componentes
        processor = DataProcessor()
        processor.datasets_file = os.path.join(temp_data_dir, "datasets.json")
        processor.datasets = {}
        
        detector = OutlierDetector(data_processor=processor)
        analyzer = AnalysisAndVisualization(data_processor=processor)
        
        # 2. Procesar dataset
        filename = "test_data.csv"
        dataset_info = processor.process_dataset(sample_csv_file, filename)
        
        assert filename in processor.datasets
        
        # 3. Detectar outliers
        config = {
            'combineStrategy': 'voting',
            'subjectId': 'id',
            'minUnivariate': 2,
            'minMultivariate': 1
        }
        
        # Modificar datos para tener outliers
        df = processor.get_dataframe(filename)
        df['outlier_var'] = [100] * 18 + [500, 600]
        df.to_csv(sample_csv_file, index=False)
        
        outlier_results = detector.detect_outliers_complete(filename, config)
        
        assert outlier_results is not None
        assert 'final_outliers' in outlier_results
        
        # 4. Realizar análisis
        analysis_results = analyzer.perform_primary_analysis(dataset_info, outlier_results)
        
        assert analysis_results is not None
        assert 'descriptive' in analysis_results
    
    def test_data_processor_and_outlier_detector(self, temp_data_dir, sample_csv_file):
        """Test de integración entre DataProcessor y OutlierDetector"""
        processor = DataProcessor()
        processor.datasets_file = os.path.join(temp_data_dir, "datasets.json")
        processor.datasets = {}
        
        detector = OutlierDetector(data_processor=processor)
        
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        
        # Verificar que detector puede acceder al dataset
        df = processor.get_dataframe(filename)
        assert df is not None
        
        # Detectar outliers en una columna específica
        if 'variable1' in df.columns:
            outliers = detector.detect_outliers_iqr(df['variable1'])
            assert isinstance(outliers, list)
    
    def test_error_handling_integration(self, temp_data_dir):
        """Test de manejo de errores en integración"""
        processor = DataProcessor()
        processor.datasets_file = os.path.join(temp_data_dir, "datasets.json")
        processor.datasets = {}
        
        detector = OutlierDetector(data_processor=processor)
        
        # Intentar detectar outliers en dataset inexistente
        config = {
            'combineStrategy': 'voting',
            'subjectId': 'id'
        }
        
        with pytest.raises(ValueError):
            detector.detect_outliers_complete("nonexistent.csv", config)

