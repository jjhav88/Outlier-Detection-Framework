"""
Tests unitarios para el módulo outlier_detection.py
"""
import pytest
import pandas as pd
import numpy as np
from analysis_core.outlier_detection import OutlierDetector


class TestOutlierDetectorUnivariate:
    """Tests para métodos univariados de detección de outliers"""
    
    def test_detect_outliers_iqr(self, outlier_detector, sample_dataframe):
        """Test de detección de outliers usando IQR"""
        detector = outlier_detector
        
        # Crear datos con outliers conocidos
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100])  # 100 es outlier
        
        outliers = detector.detect_outliers_iqr(data)
        
        assert isinstance(outliers, list)
        assert len(outliers) > 0
        # El índice del valor 100 debería estar en outliers
        assert 10 in outliers
    
    def test_detect_outliers_zscore(self, outlier_detector):
        """Test de detección de outliers usando Z-Score"""
        detector = outlier_detector
        
        # Crear datos con outliers conocidos
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100])
        
        outliers = detector.detect_outliers_zscore(data, threshold=2.0)
        
        assert isinstance(outliers, list)
        # El valor 100 debería ser detectado como outlier
        assert len(outliers) > 0
    
    def test_detect_outliers_mad(self, outlier_detector):
        """Test de detección de outliers usando MAD"""
        detector = outlier_detector
        
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100])
        
        outliers = detector.detect_outliers_mad(data, threshold=2.0)
        
        assert isinstance(outliers, list)
    
    def test_detect_outliers_iqr_empty_data(self, outlier_detector):
        """Test de IQR con datos vacíos"""
        detector = outlier_detector
        
        data = pd.Series([])
        outliers = detector.detect_outliers_iqr(data)
        
        assert outliers == []
    
    def test_detect_outliers_iqr_insufficient_data(self, outlier_detector):
        """Test de IQR con datos insuficientes"""
        detector = outlier_detector
        
        data = pd.Series([1, 2])  # Menos de 4 valores
        outliers = detector.detect_outliers_iqr(data)
        
        assert outliers == []


class TestOutlierDetectorMultivariate:
    """Tests para métodos multivariados de detección de outliers"""
    
    def test_detect_outliers_mahalanobis(self, outlier_detector):
        """Test de detección usando distancia de Mahalanobis"""
        detector = outlier_detector
        
        # Crear DataFrame con múltiples variables
        df = pd.DataFrame({
            'var1': np.random.normal(100, 15, 20),
            'var2': np.random.normal(50, 10, 20)
        })
        # Agregar un outlier claro
        df.loc[19] = [500, 500]
        
        outliers = detector.detect_outliers_mahalanobis(df)
        
        assert isinstance(outliers, list)
        # El índice 19 debería estar en outliers
        assert 19 in outliers
    
    def test_detect_outliers_lof(self, outlier_detector):
        """Test de detección usando Local Outlier Factor"""
        detector = outlier_detector
        
        df = pd.DataFrame({
            'var1': np.random.normal(100, 15, 20),
            'var2': np.random.normal(50, 10, 20)
        })
        df.loc[19] = [500, 500]
        
        outliers = detector.detect_outliers_lof(df)
        
        assert isinstance(outliers, list)
    
    def test_detect_outliers_isolation_forest(self, outlier_detector):
        """Test de detección usando Isolation Forest"""
        detector = outlier_detector
        
        df = pd.DataFrame({
            'var1': np.random.normal(100, 15, 20),
            'var2': np.random.normal(50, 10, 20)
        })
        df.loc[19] = [500, 500]
        
        outliers = detector.detect_outliers_isolation_forest(df)
        
        assert isinstance(outliers, list)


class TestOutlierDetectorHypothesisTests:
    """Tests para pruebas de hipótesis estadísticas"""
    
    def test_detect_outliers_grubbs(self, outlier_detector):
        """Test de detección usando test de Grubbs"""
        detector = outlier_detector
        
        # Crear datos con un outlier claro
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100])
        
        outliers = detector.detect_outliers_grubbs(data, alpha=0.05)
        
        assert isinstance(outliers, list)
        # Con alpha=0.05, debería detectar el outlier
        assert len(outliers) > 0
    
    def test_detect_outliers_grubbs_insufficient_data(self, outlier_detector):
        """Test de Grubbs con datos insuficientes"""
        detector = outlier_detector
        
        data = pd.Series([1, 2, 3])  # Menos de 3 valores
        outliers = detector.detect_outliers_grubbs(data)
        
        assert outliers == []
    
    def test_detect_outliers_dixon(self, outlier_detector):
        """Test de detección usando test de Dixon"""
        detector = outlier_detector
        
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100])
        
        outliers = detector.detect_outliers_dixon(data, alpha=0.05)
        
        assert isinstance(outliers, list)
    
    def test_detect_outliers_rosner(self, outlier_detector):
        """Test de detección usando test de Rosner"""
        detector = outlier_detector
        
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 200])
        
        outliers = detector.detect_outliers_rosner(data, k=2, alpha=0.05)
        
        assert isinstance(outliers, list)


class TestOutlierDetectorIntegration:
    """Tests de integración para OutlierDetector"""
    
    def test_detect_outliers_complete_voting(self, outlier_detector, data_processor_with_temp_dir, sample_csv_file):
        """Test de detección completa con estrategia voting"""
        detector = outlier_detector
        
        # Procesar dataset
        processor = data_processor_with_temp_dir
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        
        # Configuración para detección
        config = {
            'combineStrategy': 'voting',
            'subjectId': 'id',
            'minUnivariate': 2,
            'minMultivariate': 1
        }
        
        # Agregar columna numérica con outliers
        df = processor.get_dataframe(filename)
        df['outlier_var'] = [100] * 18 + [500, 600]
        df.to_csv(sample_csv_file, index=False)
        
        result = detector.detect_outliers_complete(filename, config)
        
        assert result is not None
        assert 'final_outliers' in result
        assert 'outliers_detected' in result
        assert 'outlier_percentage' in result
        assert result['combination_strategy'] == 'voting'
    
    def test_detect_outliers_complete_union(self, outlier_detector, data_processor_with_temp_dir, sample_csv_file):
        """Test de detección completa con estrategia union"""
        detector = outlier_detector
        
        processor = data_processor_with_temp_dir
        filename = "test_data.csv"
        processor.process_dataset(sample_csv_file, filename)
        
        config = {
            'combineStrategy': 'union',
            'subjectId': 'id'
        }
        
        result = detector.detect_outliers_complete(filename, config)
        
        assert result is not None
        assert result['combination_strategy'] == 'union'

