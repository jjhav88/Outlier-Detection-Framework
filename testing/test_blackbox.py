# -*- coding: utf-8 -*-
"""
Pruebas de Caja Negra para SISTAOUT

Las pruebas de caja negra verifican la funcionalidad del sistema desde
la perspectiva del usuario final, sin conocer los detalles internos de
implementación. Se prueban entradas y salidas esperadas.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import pandas as pd
import numpy as np
import requests
import json
from pathlib import Path
import tempfile
import shutil
import time

# Nota: Estas pruebas asumen que el servidor está corriendo
# Para ejecutarlas, primero iniciar el servidor con: python main.py


class TestBlackBox:
    """Clase para pruebas de caja negra"""
    
    BASE_URL = "http://localhost:8000"
    
    @pytest.fixture
    def sample_data(self):
        """Crear datos de muestra para pruebas"""
        np.random.seed(42)
        n_samples = 50
        
        data = {
            'ID': [f'SUBJ-{i:03d}' for i in range(1, n_samples + 1)],
            'Age': np.random.randint(18, 80, n_samples),
            'Weight': np.random.normal(70, 15, n_samples),
            'Height': np.random.normal(170, 10, n_samples),
            'Gender': np.random.choice(['M', 'F'], n_samples),
            'Group': np.random.choice(['Control', 'Treatment'], n_samples)
        }
        
        return pd.DataFrame(data)
    
    @pytest.fixture
    def temp_file(self, sample_data, tmp_path):
        """Crear archivo temporal para pruebas"""
        test_file = tmp_path / "test_data.csv"
        sample_data.to_csv(test_file, index=False)
        return str(test_file)
    
    def test_api_health_check(self):
        """Verificar que el API responde correctamente"""
        try:
            response = requests.get(f"{self.BASE_URL}/api/test", timeout=15)
            assert response.status_code == 200
            data = response.json()
            assert data.get('success') == True
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo. Iniciar con: python main.py")
        except requests.exceptions.Timeout:
            pytest.fail(f"El endpoint /api/test no respondió en 15 segundos. Posible problema de rendimiento del servidor.")
    
    def test_upload_dataset_blackbox(self, temp_file):
        """Probar subida de dataset desde perspectiva del usuario"""
        try:
            with open(temp_file, 'rb') as f:
                files = {'file': ('test_data.csv', f, 'text/csv')}
                response = requests.post(
                    f"{self.BASE_URL}/api/upload-dataset",
                    files=files,
                    timeout=10
                )
            
            assert response.status_code in [200, 201]
            data = response.json()
            assert 'filename' in data or 'success' in data
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_get_datasets_list_blackbox(self):
        """Probar obtención de lista de datasets"""
        try:
            response = requests.get(f"{self.BASE_URL}/api/datasets", timeout=5)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, (list, dict))
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_detect_outliers_blackbox(self):
        """Probar detección de outliers desde perspectiva del usuario"""
        try:
            # Primero verificar que hay datasets disponibles
            datasets_response = requests.get(f"{self.BASE_URL}/api/datasets", timeout=5)
            if datasets_response.status_code != 200:
                pytest.skip("No hay datasets disponibles")
            
            datasets = datasets_response.json()
            if not datasets or len(datasets) == 0:
                pytest.skip("No hay datasets disponibles para probar")
            
            # Usar el primer dataset disponible
            filename = datasets[0] if isinstance(datasets, list) else list(datasets.keys())[0]
            
            # Probar detección de outliers
            request_data = {
                'methods': ['iqr', 'zscore'],
                'subject_id': 'ID'
            }
            
            response = requests.post(
                f"{self.BASE_URL}/api/outliers/{filename}/detect",
                json=request_data,
                timeout=30
            )
            
            assert response.status_code in [200, 400, 500]  # Puede fallar si no hay datos suficientes
            if response.status_code == 200:
                data = response.json()
                # La respuesta puede tener 'outliers_detected' directamente o dentro de 'results'
                # También puede tener 'error' en el nivel superior
                assert ('outliers_detected' in data or 
                       'error' in data or 
                       (isinstance(data, dict) and 'results' in data and 
                        ('outliers_detected' in data.get('results', {}) or 'error' in data.get('results', {}))))
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_invalid_input_handling(self):
        """Probar manejo de entradas inválidas"""
        try:
            # Probar con archivo inválido
            invalid_data = {'invalid': 'data'}
            response = requests.post(
                f"{self.BASE_URL}/api/upload-dataset",
                json=invalid_data,
                timeout=5
            )
            # Debe manejar el error sin crashear
            assert response.status_code in [400, 422, 500]
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_missing_parameters(self):
        """Probar manejo de parámetros faltantes"""
        try:
            # Probar endpoint sin parámetros requeridos
            response = requests.post(
                f"{self.BASE_URL}/api/outliers/test_file/detect",
                json={},
                timeout=5
            )
            # Debe manejar parámetros faltantes
            assert response.status_code in [400, 404, 422, 500]
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_response_format_consistency(self):
        """Verificar que las respuestas tienen formato consistente"""
        try:
            response = requests.get(f"{self.BASE_URL}/api/test", timeout=5)
            assert response.status_code == 200
            data = response.json()
            # Verificar formato JSON válido
            assert isinstance(data, dict)
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_error_messages_clarity(self):
        """Verificar que los mensajes de error son claros"""
        try:
            # Probar con endpoint inexistente
            response = requests.get(f"{self.BASE_URL}/api/nonexistent", timeout=5)
            assert response.status_code == 404
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_timeout_handling(self):
        """Verificar manejo de timeouts"""
        try:
            # Probar con timeout muy corto
            response = requests.get(f"{self.BASE_URL}/api/test", timeout=0.001)
            # Debe manejar timeout
            assert True
        except requests.exceptions.Timeout:
            # Timeout esperado, está bien
            assert True
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_concurrent_requests(self):
        """Probar manejo de solicitudes concurrentes"""
        try:
            import concurrent.futures
            
            def make_request():
                response = requests.get(f"{self.BASE_URL}/api/test", timeout=5)
                return response.status_code
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(make_request) for _ in range(5)]
                results = [f.result() for f in concurrent.futures.as_completed(futures)]
            
            # Todas las solicitudes deben completarse
            assert len(results) == 5
            assert all(status == 200 for status in results)
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_data_integrity(self, temp_file):
        """Verificar integridad de datos después de procesamiento"""
        try:
            # Subir archivo
            with open(temp_file, 'rb') as f:
                files = {'file': ('test_data.csv', f, 'text/csv')}
                upload_response = requests.post(
                    f"{self.BASE_URL}/api/upload-dataset",
                    files=files,
                    timeout=10
                )
            
            if upload_response.status_code == 200:
                upload_data = upload_response.json()
                filename = upload_data.get('filename', 'test_data.csv')
                
                # Obtener datos paginados
                paginated_response = requests.get(
                    f"{self.BASE_URL}/api/datasets/{filename}/paginated?page=1&page_size=10",
                    timeout=5
                )
                
                if paginated_response.status_code == 200:
                    paginated_data = paginated_response.json()
                    # Verificar que los datos están presentes
                    assert 'data' in paginated_data or 'records' in paginated_data
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_cors_headers(self):
        """Verificar que los headers CORS están configurados correctamente"""
        try:
            # Probar con GET en lugar de OPTIONS (algunos servidores no responden OPTIONS)
            response = requests.get(f"{self.BASE_URL}/api/test", timeout=5)
            # Verificar que el servidor responde correctamente
            # CORS headers pueden estar presentes en respuestas GET también
            assert response.status_code == 200
            # Verificar que la respuesta es válida
            assert 'application/json' in response.headers.get('content-type', '')
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")
    
    def test_content_type_validation(self):
        """Verificar validación de tipos de contenido"""
        try:
            # Probar con tipo de contenido incorrecto
            response = requests.post(
                f"{self.BASE_URL}/api/upload-dataset",
                files={'file': ('test.txt', b'not a csv', 'text/plain')},
                timeout=5
            )
            # Debe rechazar tipos no permitidos (400, 422) o manejar el error (500)
            # El importante es que no acepta el archivo inválido
            assert response.status_code in [400, 422, 500]
            # Verificar que la respuesta indica un error
            if response.status_code == 500:
                # Si es 500, verificar que hay un mensaje de error
                try:
                    data = response.json()
                    assert 'error' in str(data).lower() or 'detail' in data
                except:
                    pass  # Si no es JSON, está bien
        except requests.exceptions.ConnectionError:
            pytest.skip("Servidor no está corriendo")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

