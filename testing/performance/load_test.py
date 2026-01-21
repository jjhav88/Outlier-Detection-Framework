# -*- coding: utf-8 -*-
"""
Script de pruebas de carga usando Locust
Simula múltiples usuarios concurrentes accediendo a la API
"""

from locust import HttpUser, task, between
import random
import json


class APIUser(HttpUser):
    """Usuario simulado que interactúa con la API"""
    
    wait_time = between(1, 3)  # Esperar entre 1 y 3 segundos entre requests
    
    def on_start(self):
        """Se ejecuta cuando un usuario inicia una sesión"""
        # Health check inicial
        self.client.get("/api/test")
    
    @task(3)
    def get_datasets(self):
        """Obtener lista de datasets (tarea frecuente)"""
        self.client.get("/api/datasets")
    
    @task(2)
    def get_dataset_paginated(self):
        """Obtener dataset paginado"""
        # Intentar con un dataset común o aleatorio
        datasets = ["BD_CARY.xlsx", "test_data.csv"]
        dataset = random.choice(datasets)
        self.client.get(f"/api/datasets/{dataset}/paginated?page=1&page_size=10")
    
    @task(1)
    def detect_outliers(self):
        """Detectar outliers (tarea pesada)"""
        # Solo ejecutar si hay datasets disponibles
        try:
            response = self.client.get("/api/datasets")
            if response.status_code == 200:
                datasets = response.json()
                if datasets:
                    dataset_name = random.choice(list(datasets.keys())[:3])  # Primeros 3
                    config = {
                        "methods": ["iqr", "zscore"],
                        "subjectId": "ID" if "ID" in str(datasets[dataset_name]) else "Código"
                    }
                    self.client.post(
                        f"/api/outliers/{dataset_name}/detect",
                        json=config,
                        name="/api/outliers/[dataset]/detect"
                    )
        except:
            pass  # Si falla, continuar con otras tareas
    
    @task(1)
    def primary_analysis(self):
        """Análisis primario (tarea pesada)"""
        try:
            response = self.client.get("/api/datasets")
            if response.status_code == 200:
                datasets = response.json()
                if datasets:
                    dataset_name = random.choice(list(datasets.keys())[:2])
                    config = {
                        "variable": "TBET" if "TBET" in str(datasets[dataset_name]) else None
                    }
                    if config["variable"]:
                        self.client.post(
                            f"/api/analyze-viz/{dataset_name}/primary-analysis",
                            json=config,
                            name="/api/analyze-viz/[dataset]/primary-analysis"
                        )
        except:
            pass


# Configuración para ejecutar desde línea de comandos
if __name__ == "__main__":
    import sys
    print("=" * 60)
    print("PRUEBAS DE CARGA - SISTAOUT")
    print("=" * 60)
    print("\nPara ejecutar las pruebas de carga:")
    print("  locust -f testing/performance/load_test.py --host=http://localhost:8000")
    print("\nO con parámetros específicos:")
    print("  locust -f testing/performance/load_test.py --host=http://localhost:8000 --users 10 --spawn-rate 2 --run-time 60s")
    print("\nLuego abre http://localhost:8089 en tu navegador")
    print("=" * 60)

