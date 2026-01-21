"""
Tests unitarios para el módulo analysis_and_viz.py
"""
import pytest
import pandas as pd
import numpy as np
from analysis_core.analysis_and_viz import AnalysisAndVisualization


class TestAnalysisAndVisualization:
    """Tests para la clase AnalysisAndVisualization"""
    
    def test_init(self, analysis_viz):
        """Test de inicialización"""
        assert analysis_viz is not None
    
    def test_load_data_with_outliers(self, analysis_viz, sample_dataset_info):
        """Test de carga de datos con información de outliers"""
        outlier_results = {
            'final_outliers': ['1', '2'],
            'subject_id_column': 'id'
        }
        
        df = analysis_viz.load_data_with_outliers(sample_dataset_info, outlier_results)
        
        assert isinstance(df, pd.DataFrame)
        assert 'es_outlier' in df.columns
    
    def test_descriptive_analysis(self, analysis_viz, sample_dataframe):
        """Test de análisis descriptivo"""
        variable_types = {
            'id': 'cuantitativa_discreta',
            'normal_var': 'cuantitativa_continua',
            'outlier_var': 'cuantitativa_continua',
            'category': 'cualitativa_nominal'
        }
        
        # Agregar columna es_outlier
        sample_dataframe['es_outlier'] = ['No Outlier'] * 18 + ['Outlier', 'Outlier']
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        result = analysis_viz.descriptive_analysis(sample_dataframe, variable_types)
        
        assert result is not None
        assert 'quantitative' in result
        assert 'categorical' in result
    
    def test_mann_whitney_test(self, analysis_viz, sample_dataframe):
        """Test de prueba de Mann-Whitney U"""
        variable_types = {
            'normal_var': 'cuantitativa_continua',
            'outlier_var': 'cuantitativa_continua'
        }
        
        sample_dataframe['es_outlier'] = ['No Outlier'] * 18 + ['Outlier', 'Outlier']
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        result = analysis_viz.mann_whitney_test(sample_dataframe, variable_types)
        
        assert result is not None
        assert isinstance(result, dict)
    
    def test_chi_square_test(self, analysis_viz, sample_dataframe):
        """Test de prueba de Chi-Cuadrado"""
        variable_types = {
            'category': 'cualitativa_nominal'
        }
        
        sample_dataframe['es_outlier'] = ['No Outlier'] * 18 + ['Outlier', 'Outlier']
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        result = analysis_viz.chi_square_test(sample_dataframe, variable_types)
        
        assert result is not None
        assert isinstance(result, dict)

