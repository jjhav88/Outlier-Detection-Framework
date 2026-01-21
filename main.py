# -*- coding: utf-8 -*-
# API principal de FastAPI
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
import uvicorn
import os
import json
from pathlib import Path
import pandas as pd
import numpy as np
from typing import List, Dict, Any
import shutil
import uuid
import time
import re
import mimetypes
from werkzeug.utils import secure_filename

# Importar módulos de análisis
from analysis_core.data_processing import DataProcessor
from analysis_core.analysis_and_viz import AnalysisAndVisualization

# Importar monitor de rendimiento
try:
    from testing.performance.performance_monitor import performance_monitor
    PERFORMANCE_MONITORING_ENABLED = True
except ImportError:
    PERFORMANCE_MONITORING_ENABLED = False
    print("⚠️  Monitoreo de rendimiento no disponible (psutil no instalado)")

app = FastAPI(title="SISTAOUT - Sistema de Análisis de Outliers", version="1.0.0")

# Configurar CORS
# NOTA DE SEGURIDAD: En producción, reemplazar ["*"] con orígenes específicos
# Ejemplo: allow_origins=["http://localhost:8000", "https://tudominio.com"]
# Para desarrollo local, se permite "*" pero con allow_credentials=False por seguridad
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
ALLOW_CREDENTIALS = os.getenv("ALLOW_CREDENTIALS", "false").lower() == "true"

# Si se permite "*", no se pueden usar credenciales por seguridad
if "*" in CORS_ORIGINS and ALLOW_CREDENTIALS:
    print("⚠️  ADVERTENCIA DE SEGURIDAD: CORS con allow_origins=['*'] y allow_credentials=True es inseguro.")
    print("   Deshabilitando allow_credentials automáticamente.")
    ALLOW_CREDENTIALS = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
)


# Middleware de monitoreo de rendimiento
class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware para medir tiempos de respuesta de todos los endpoints"""
    
    async def dispatch(self, request: StarletteRequest, call_next):
        if not PERFORMANCE_MONITORING_ENABLED:
            return await call_next(request)
        
        start_time = time.time()
        endpoint = str(request.url.path)
        method = request.method
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            performance_monitor.record_request(
                endpoint,
                method,
                duration,
                response.status_code
            )
            # Agregar header con tiempo de respuesta
            response.headers["X-Response-Time"] = f"{duration:.4f}s"
            return response
        except Exception as e:
            duration = time.time() - start_time
            performance_monitor.record_request(
                endpoint,
                method,
                duration,
                500
            )
            raise


if PERFORMANCE_MONITORING_ENABLED:
    app.add_middleware(PerformanceMonitoringMiddleware)

# Crear directorios necesarios
UPLOADS_DIR = os.path.abspath("uploads")
DATA_DIR = os.path.abspath("data")
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Tipos MIME permitidos para validación de archivos
ALLOWED_MIME_TYPES = {
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/octet-stream': ['.csv', '.xls', '.xlsx']  # Algunos navegadores envían esto
}

ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls'}

def sanitize_filename(filename: str) -> str:
    """
    Sanitiza el nombre de archivo para prevenir path traversal y otros ataques.
    
    Args:
        filename: Nombre de archivo original
        
    Returns:
        Nombre de archivo sanitizado y seguro
    """
    if not filename:
        raise ValueError("El nombre de archivo no puede estar vacío")
    
    # Usar secure_filename de werkzeug para sanitizar
    safe_name = secure_filename(filename)
    
    # Validar que el nombre sanitizado no esté vacío
    if not safe_name:
        raise ValueError("Nombre de archivo inválido después de sanitización")
    
    # Validar que no contenga path traversal después de sanitización
    if '..' in safe_name or '/' in safe_name or '\\' in safe_name:
        raise ValueError("Nombre de archivo contiene caracteres peligrosos")
    
    # Validar extensión
    _, ext = os.path.splitext(safe_name)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extensión de archivo no permitida: {ext}")
    
    return safe_name

def get_safe_filename(filename: str = Depends(lambda x: x)) -> str:
    """
    Dependencia de FastAPI para sanitizar automáticamente nombres de archivo.
    Se puede usar como parámetro en endpoints para sanitizar automáticamente.
    """
    try:
        return sanitize_filename(filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

def validate_file_type(file: UploadFile, content: bytes = None) -> bool:
    """
    Valida el tipo MIME real del archivo además de la extensión.
    
    Args:
        file: Archivo subido
        content: Contenido del archivo (opcional, para validación más precisa)
        
    Returns:
        True si el tipo es válido
        
    Raises:
        HTTPException si el tipo no es válido
    """
    # Validar extensión
    filename = file.filename or ""
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower()
    
    if ext_lower not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Extensión de archivo no permitida: {ext}. Solo se permiten: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Validar tipo MIME si está disponible
    if file.content_type:
        # Si el tipo MIME es text/plain, solo permitirlo si la extensión es .csv
        # (algunos navegadores envían CSV como text/plain)
        if file.content_type == 'text/plain':
            if ext_lower != '.csv':
                raise HTTPException(
                    status_code=400,
                    detail=f"Tipo de archivo no permitido: {file.content_type}. Solo se permiten archivos CSV y Excel."
                )
        # Verificar si el tipo MIME está en la lista permitida
        elif file.content_type not in ALLOWED_MIME_TYPES:
            # Algunos navegadores envían tipos genéricos, verificar extensión
            if file.content_type != 'application/octet-stream':
                raise HTTPException(
                    status_code=400,
                    detail=f"Tipo de archivo no permitido: {file.content_type}. Solo se permiten archivos CSV y Excel."
                )
        
        # Verificar que la extensión coincida con el tipo MIME esperado
        if file.content_type != 'text/plain':  # Ya validamos text/plain arriba
            expected_extensions = ALLOWED_MIME_TYPES.get(file.content_type, [])
            if expected_extensions and ext_lower not in expected_extensions:
                # Permitir si es application/octet-stream (algunos navegadores)
                if file.content_type != 'application/octet-stream':
                    raise HTTPException(
                        status_code=400,
                        detail=f"El tipo MIME {file.content_type} no coincide con la extensión {ext}"
                    )
    
    # Validación adicional: leer primeros bytes para detectar tipo real
    if content:
        # Detectar tipo por magic bytes
        if ext_lower == '.csv':
            # CSV debe comenzar con texto legible
            try:
                content_str = content[:1024].decode('utf-8', errors='ignore')
                if not any(c.isprintable() or c in '\n\r\t' for c in content_str[:100]):
                    raise HTTPException(
                        status_code=400,
                        detail="El archivo no parece ser un CSV válido"
                    )
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="El archivo CSV no tiene codificación válida"
                )
        elif ext_lower in ['.xlsx', '.xls']:
            # Excel debe comenzar con signature específica
            # XLSX: PK (ZIP signature)
            # XLS: D0 CF 11 E0 (OLE2 signature)
            if ext_lower == '.xlsx':
                if not content.startswith(b'PK'):
                    raise HTTPException(
                        status_code=400,
                        detail="El archivo no parece ser un Excel válido (XLSX)"
                    )
            elif ext_lower == '.xls':
                if not content.startswith(b'\xd0\xcf\x11\xe0'):
                    raise HTTPException(
                        status_code=400,
                        detail="El archivo no parece ser un Excel válido (XLS)"
                    )
    
    return True

# Función personalizada para servir archivos estáticos sin caché
def serve_static_file(file_path):
    return FileResponse(file_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})

# Montar archivos estáticos
app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/images", StaticFiles(directory="images"), name="images")

# Inicializar procesador de datos
data_processor = DataProcessor()
analysis_viz = AnalysisAndVisualization(data_processor=data_processor)

# Variable global para almacenar resultados de outliers
outlier_results = {}

# Generar ID de sesión del servidor al iniciar
server_session_id = str(uuid.uuid4())
server_start_time = time.time()

# Funciones helper para acceder a datos
def get_dataset_info(filename: str) -> Dict[str, Any]:
    """Obtener información del dataset por filename"""
    if filename in data_processor.datasets:
        return data_processor.datasets[filename]
    return None

def get_outlier_results(filename: str) -> Dict[str, Any]:
    """Obtener resultados de outliers por filename"""
    global outlier_results
    if outlier_results and outlier_results.get('filename') == filename:
        return outlier_results
    # Si no hay resultados de outliers, devolver un diccionario vacío
    # para evitar errores en los endpoints de resultados
    return {
        'filename': filename,
        'outliers_detected': 0,
        'total_records': 0,
        'normal_data': 0,
        'outlier_percentage': 0.0
    }

def load_data_with_outliers(dataset_info: Dict[str, Any], outlier_results: Dict[str, Any]) -> pd.DataFrame:
    """Cargar datos con outliers usando la función del módulo analysis_viz"""
    return analysis_viz.load_data_with_outliers(dataset_info, outlier_results)

# Cargar datasets existentes al iniciar el servidor
def load_existing_datasets():
    """Cargar datasets existentes en el directorio uploads"""
    uploads_dir = "uploads"
    if os.path.exists(uploads_dir):
        for filename in os.listdir(uploads_dir):
            if filename.endswith(('.csv', '.xlsx', '.xls')):
                file_path = os.path.join(uploads_dir, filename)
                try:
                    dataset_info = data_processor.process_dataset(file_path, filename)
                    data_processor.datasets[filename] = dataset_info
                except Exception:
                    pass
# Cargar datasets al iniciar
load_existing_datasets()


@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Página principal"""
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/testing-html")
async def get_testing_html():
    """Endpoint para servir el HTML del módulo de Testing"""
    try:
        testing_html_path = os.path.join("frontend", "modules", "testing", "testing.html")
        if os.path.exists(testing_html_path):
            with open(testing_html_path, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        else:
            raise HTTPException(status_code=404, detail="Archivo HTML de testing no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cargando HTML de testing: {str(e)}")

@app.get("/detect-outliers-html")
async def get_detect_outliers_html():
    """Servir el archivo HTML del módulo de detección de outliers sin caché"""
    import time
    return FileResponse(
        "frontend/modules/detect_outliers/detect_outliers.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Last-Modified": str(int(time.time()))
        }
    )

@app.post("/api/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    """Subir un dataset con validaciones de seguridad"""
    try:
        # Validar tamaño máximo de archivo (500 MB por defecto)
        MAX_FILE_SIZE_MB = 500
        MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
        
        print(f"Recibiendo archivo: {file.filename}, tamaño: {file.size}")
        
        # Verificar tamaño del archivo
        if file.size and file.size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400, 
                detail=f"El archivo es demasiado grande. Tamaño máximo permitido: {MAX_FILE_SIZE_MB} MB"
            )
        
        # Sanitizar nombre de archivo para prevenir path traversal
        try:
            safe_filename = sanitize_filename(file.filename)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Leer contenido para validación de tipo MIME
        content = await file.read()
        file.file.seek(0)  # Resetear posición del archivo
        
        # Validar tipo de archivo (extensión + MIME)
        validate_file_type(file, content)
        
        # Construir ruta segura usando os.path.join y abspath
        file_path = os.path.join(UPLOADS_DIR, safe_filename)
        
        # Verificar que la ruta final esté dentro del directorio de uploads (prevenir path traversal)
        file_path_abs = os.path.abspath(file_path)
        if not file_path_abs.startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(
                status_code=400,
                detail="Ruta de archivo inválida detectada"
            )
        
        print(f"Guardando archivo en: {file_path}")
        
        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Archivo guardado exitosamente")
        
        # Validar tamaño del archivo guardado también (por seguridad)
        actual_file_size = os.path.getsize(file_path)
        if actual_file_size > MAX_FILE_SIZE_BYTES:
            # Eliminar archivo si excede el límite
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"El archivo guardado excede el tamaño máximo permitido ({MAX_FILE_SIZE_MB} MB)"
            )
        
        # Procesar dataset usando el módulo de análisis
        print("Procesando dataset...")
        try:
            dataset_info = data_processor.process_dataset(file_path, safe_filename)
        except ValueError as ve:
            # Error de validación o archivo corrupto
            os.remove(file_path)  # Limpiar archivo inválido
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            # Otros errores
            os.remove(file_path)  # Limpiar archivo con error
            raise HTTPException(status_code=500, detail=f"Error procesando dataset: {str(e)}")
        print(f"Dataset procesado: {dataset_info['rows']} filas, {dataset_info['columns']} columnas")
        
        # Guardar dataset
        data_processor.datasets[file.filename] = dataset_info
        data_processor.save_datasets()
        print("Dataset guardado en la base de datos")
        
        return {"success": True, "dataset": dataset_info}
    
    except HTTPException:
        # Re-lanzar HTTPException sin modificar (ya tiene el código y mensaje correctos)
        raise
    except Exception as e:
        # Solo capturar excepciones no esperadas
        error_msg = str(e)
        print(f"Error en upload_dataset: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {error_msg}")

@app.get("/api/datasets")
async def get_datasets():
    """Obtener todos los datasets"""
    return data_processor.datasets

@app.get("/api/datasets/debug")
async def get_datasets_debug():
    """Obtener información de debug de los datasets"""
    try:
        debug_info = {
            "datasets_file_path": data_processor.datasets_file,
            "file_exists": os.path.exists(data_processor.datasets_file),
            "file_size": os.path.getsize(data_processor.datasets_file) if os.path.exists(data_processor.datasets_file) else 0,
            "datasets_count": len(data_processor.datasets),
            "datasets_info": {}
        }
        
        for filename, dataset_info in data_processor.datasets.items():
            debug_info["datasets_info"][filename] = {
                "has_variable_types": "variable_types" in dataset_info,
                "variable_types_count": len(dataset_info.get("variable_types", {})),
                "variable_types": dataset_info.get("variable_types", {})
            }
        
        return debug_info
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/datasets/{filename}/details")
async def get_dataset_details(filename: str):
    """Obtener detalles detallados de un dataset específico"""
    try:
        # Sanitizar nombre de archivo para prevenir path traversal
        try:
            safe_filename = sanitize_filename(filename)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Construir ruta segura
        file_path = os.path.join(UPLOADS_DIR, safe_filename)
        file_path_abs = os.path.abspath(file_path)
        
        # Verificar que la ruta esté dentro del directorio de uploads
        if not file_path_abs.startswith(os.path.abspath(UPLOADS_DIR)):
            raise HTTPException(status_code=400, detail="Ruta de archivo inválida")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Cargar el dataset usando método centralizado
        if safe_filename in data_processor.datasets:
            df = data_processor.get_dataframe(safe_filename)
            variable_types = data_processor.datasets[safe_filename].get('variable_types', {})
        else:
            raise HTTPException(status_code=404, detail="Dataset no encontrado en data_processor")
        
        # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
        if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
            variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Obtener información detallada
        variables = []
        for column in df.columns:
            # Obtener el tipo de variable clasificado
            classified_type = variable_types.get(column, 'No clasificado')
            
            var_info = {
                'name': column,
                'type': classified_type,
                'unique_values': int(df[column].nunique())
            }
            variables.append(var_info)
        
        details = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'variables': variables
        }
        
        return {
            'success': True,
            'data': details
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.get("/api/datasets/{filename}/paginated")
async def get_dataset_paginated(filename: str, page: int = 1, page_size: int = 1000):
    """Obtener una página de un dataset grande"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        result = data_processor.get_dataframe_paginated(filename, page=page, page_size=page_size)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dataset/{filename}")
async def get_dataset(filename: str):
    """Obtener información detallada de un dataset"""
    # Sanitizar nombre de archivo
    try:
        safe_filename = sanitize_filename(filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if safe_filename not in data_processor.datasets:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    
    dataset = data_processor.datasets[safe_filename]
    
    # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
    try:
        # Cargar dataset usando método centralizado
        df = data_processor.get_dataframe(safe_filename)
        variable_types = dataset.get('variable_types', {})
        if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
            variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            dataset['variable_types'] = variable_types
    except Exception as e:
        print(f"Error verificando columna es_outlier: {e}")
    
    return dataset

@app.get("/api/datasets/{filename}/load")
async def load_dataset(filename: str):
    """Cargar dataset completo con toda la información"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        dataset = data_processor.datasets[filename]
        
        # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
        try:
            file_path = dataset["file_path"]
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            
            variable_types = dataset.get('variable_types', {})
            if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
                variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
                dataset['variable_types'] = variable_types
        except Exception as e:
            print(f"Error verificando columna es_outlier: {e}")
        
        return dataset
        
    except Exception as e:
        print(f"Error cargando dataset {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/dataset/{filename}/variable-types")
async def update_variable_types(filename: str, variable_types: Dict[str, str]):
    # Sanitizar nombre de archivo
    try:
        safe_filename = sanitize_filename(filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    """Actualizar tipos de variables de un dataset"""
    try:
        updated_dataset = data_processor.update_variable_types(filename, variable_types)
        return {"success": True, "dataset": updated_dataset}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/dataset/{filename}")
async def delete_dataset(filename: str):
    """Eliminar un dataset"""
    if filename not in data_processor.datasets:
        raise HTTPException(status_code=404, detail="Dataset no encontrado")
    
    # Eliminar archivo físico
    file_path = data_processor.datasets[filename]["file_path"]
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Eliminar de la base de datos
    del data_processor.datasets[filename]
    data_processor.save_datasets()
    
    return {"success": True, "message": "Dataset eliminado correctamente"}

# Preprocessing endpoints
@app.post("/api/preprocess/{filename}/missing-values")
async def preprocess_missing_values(filename: str, request: dict):
    """Procesar valores faltantes en un dataset"""
    try:
        strategy = request.get("strategy", "drop")
        constant_value = request.get("constant_value")
        
        result = data_processor.preprocess_missing_values(filename, strategy, constant_value)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/preprocess/{filename}/duplicates")
async def preprocess_duplicates(filename: str, request: dict):
    """Procesar duplicados en un dataset"""
    try:
        strategy = request.get("strategy", "drop")
        
        result = data_processor.preprocess_duplicates(filename, strategy)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/preprocess/{filename}/outliers")
async def preprocess_outliers(filename: str, request: dict):
    """Procesar outliers en un dataset"""
    try:
        method = request.get("method", "iqr")
        strategy = request.get("strategy", "remove")
        
        result = data_processor.preprocess_outliers(filename, method, strategy)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/preprocess/{filename}/data-types")
async def preprocess_data_types(filename: str, request: dict):
    """Procesar tipos de datos en un dataset"""
    try:
        action = request.get("action", "auto")
        conversion_params = request.get("conversion_params")
        
        result = data_processor.preprocess_data_types(filename, action, conversion_params)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/preprocess/{filename}/apply-all")
async def apply_all_preprocessing_endpoint(filename: str, request: dict):
    """Aplicar todos los cambios de preprocesamiento"""
    try:
        steps = request.get("steps", [])
        
        result = data_processor.apply_all_preprocessing(filename, steps)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/preprocess/save-dataset")
async def save_processed_dataset(request: dict):
    """Guardar dataset procesado"""
    try:
        original_filename = request.get("original_filename")
        new_name = request.get("new_name")
        processed_data = request.get("processed_data")
        
        result = data_processor.save_processed_dataset(original_filename, new_name, processed_data)
        return {"success": True, "dataset": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoints para detección de outliers
@app.post("/api/outliers/{filename}/visual-data")
async def get_visual_data(filename: str, request: dict):
    """Obtener datos para visualización de outliers"""
    try:
        variable = request.get("variable")
        categorical_variable = request.get("categorical_variable")
        

        
        if not variable:
            raise HTTPException(status_code=400, detail="Variable requerida")
        
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        visual_data = detector.get_visual_data(filename, variable, categorical_variable)
        
        return {"success": True, "visual_data": visual_data}
    
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/categorical-data")
async def get_categorical_data(filename: str, request: dict):
    """Obtener datos para visualización de variables categóricas"""
    try:
        variable = request.get("variable")
        
        if not variable:
            raise HTTPException(status_code=400, detail="Variable requerida")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        categorical_data = detector.get_categorical_data(filename, variable)
        
        return {"success": True, "categorical_data": categorical_data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/quantitative-by-category")
async def get_quantitative_by_category(filename: str, request: dict):
    """Obtener datos cuantitativos agrupados por categoría"""
    try:
        numeric_variable = request.get('numeric_variable')
        categorical_variable = request.get('categorical_variable')
        
        if not numeric_variable or not categorical_variable:
            raise HTTPException(status_code=400, detail="Variables no especificadas")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        data = detector.get_quantitative_by_category(filename, numeric_variable, categorical_variable)
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/categorical-by-category")
async def get_categorical_by_category(filename: str, request: dict):
    """Obtener datos categóricos cruzados por categoría"""
    try:
        categorical_variable1 = request.get('categorical_variable1')
        categorical_variable2 = request.get('categorical_variable2')
        
        if not categorical_variable1 or not categorical_variable2:
            raise HTTPException(status_code=400, detail="Variables no especificadas")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        data = detector.get_categorical_by_category(filename, categorical_variable1, categorical_variable2)
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/relationship")
async def get_relationship_analysis(filename: str, request: dict):
    """Obtener análisis de correlación entre dos variables cuantitativas"""
    try:
        variable1 = request.get('variable1')
        variable2 = request.get('variable2')
        
        if not variable1 or not variable2:
            raise HTTPException(status_code=400, detail="Variables no especificadas")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        data = detector.get_relationship_analysis(filename, variable1, variable2)
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/correlation-matrix")
async def get_correlation_matrix(filename: str, request: dict):
    """Obtener matriz de correlación para múltiples variables cuantitativas"""
    try:
        variables = request.get('variables')
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos 2 variables")
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        data = detector.get_correlation_matrix(filename, variables)
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/pairplot")
async def get_pairplot(filename: str, request: dict):
    """Generar pairplot con seaborn"""
    try:
        
        variables = request.get('variables')
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos 2 variables")
        
        # Obtener todos los parámetros del request
        kwargs = {}
        for key, value in request.items():
            if key != 'variables' and value is not None:
                kwargs[key] = value
        
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        data = detector.get_pairplot(filename, variables, **kwargs)
        
        return {"success": True, "data": data}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/table-data")
async def get_table_data(filename: str, request: dict):
    """Obtener datos de tabla para múltiples variables"""
    try:
        variables = request.get("variables")
        max_rows = request.get("max_rows", 10)
        
        if not variables or len(variables) == 0:
            raise HTTPException(status_code=400, detail="Variables requeridas")
        
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener el dataset
        dataset_info = data_processor.datasets[filename]
        if not dataset_info or 'data' not in dataset_info:
            raise HTTPException(status_code=404, detail="Datos del dataset no disponibles")
        
        # Cargar los datos
        df = dataset_info['data']
        
        # Verificar que las variables existan
        missing_vars = [var for var in variables if var not in df.columns]
        if missing_vars:
            raise HTTPException(status_code=400, detail=f"Variables no encontradas: {missing_vars}")
        
        # Seleccionar solo las variables solicitadas
        selected_data = df[variables].head(max_rows)
        
        # Convertir a formato de tabla
        headers = variables
        rows = selected_data.values.tolist()
        
        # Formatear valores numéricos
        formatted_rows = []
        for row in rows:
            formatted_row = []
            for i, value in enumerate(row):
                if pd.isna(value):
                    formatted_row.append("N/A")
                elif isinstance(value, (int, float)):
                    if isinstance(value, float):
                        formatted_row.append(f"{value:.2f}")
                    else:
                        formatted_row.append(str(value))
                else:
                    formatted_row.append(str(value))
            formatted_rows.append(formatted_row)
        
        table_data = {
            "headers": headers,
            "rows": formatted_rows,
            "totalRows": len(df),
            "displayedRows": len(formatted_rows)
        }
        
        return {"success": True, "table_data": table_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/variable-data")
async def get_variable_data(filename: str, request: dict):
    """Obtener datos de una variable específica con filtros opcionales"""
    try:
        variable = request.get("variable")
        filter_column = request.get("filter_column")
        filter_value = request.get("filter_value")
        
        if not variable:
            raise HTTPException(status_code=400, detail="Variable requerida")
        
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener el dataset
        dataset_info = data_processor.datasets[filename]
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Cargar datos usando método centralizado de DataProcessor
        df = data_processor.get_dataframe(filename)
        
        # Verificar que la variable existe
        if variable not in df.columns:
            raise HTTPException(status_code=400, detail=f"Variable {variable} no encontrada")
        
        # Aplicar filtros si se especifican
        if filter_column and filter_value is not None:
            if filter_column not in df.columns:
                raise HTTPException(status_code=400, detail=f"Columna de filtro {filter_column} no encontrada")
            
            # Filtrar datos
            filtered_df = df[df[filter_column] == filter_value]
            values = filtered_df[variable].dropna().tolist()
        else:
            # Sin filtros
            values = df[variable].dropna().tolist()
        
        # Determinar el tipo de variable
        variable_type = dataset_info.get('variable_types', {}).get(variable, 'desconocido')
        
        # Determinar si es numérica o categórica
        if variable_type in ['cuantitativa_continua', 'cuantitativa_discreta'] or variable_type.startswith('cuantitativa'):
            data_type = 'numeric'
        elif variable_type in ['cualitativa_nominal', 'cualitativa_ordinal'] or variable_type.startswith('cualitativa'):
            data_type = 'categorical'
            # Para variables categóricas, también devolver las categorías únicas
            categories = list(set(values))
        else:
            # Intentar inferir el tipo
            try:
                pd.to_numeric(values)
                data_type = 'numeric'
            except:
                data_type = 'categorical'
                categories = list(set(values))
        
        # Preparar respuesta
        response_data = {
            "values": values,
            "type": data_type,
            "count": len(values)
        }
        
        # Agregar categorías si es categórica
        if data_type == 'categorical':
            response_data["categories"] = categories
        
        return {"success": True, "variable_data": response_data}
        
    except Exception as e:
        print(f"Error obteniendo datos de variable: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/test")
async def test_endpoint():
    """Endpoint de prueba"""
    return {"success": True, "message": "API funcionando correctamente"}


@app.get("/api/performance/metrics")
async def get_performance_metrics():
    """Obtener métricas de rendimiento del sistema"""
    if not PERFORMANCE_MONITORING_ENABLED:
        raise HTTPException(status_code=503, detail="Monitoreo de rendimiento no disponible")
    
    return {
        "system_metrics": performance_monitor.get_system_metrics(),
        "performance_summary": performance_monitor.get_performance_summary(),
        "slow_requests": performance_monitor.get_slow_requests(threshold=1.0)
    }


@app.post("/api/performance/metrics/reset")
async def reset_performance_metrics():
    """Resetear métricas de rendimiento (útil antes de iniciar una prueba de carga)"""
    if not PERFORMANCE_MONITORING_ENABLED:
        raise HTTPException(status_code=503, detail="Monitoreo de rendimiento no disponible")
    
    performance_monitor.reset_performance_metrics()
    return {
        "success": True,
        "message": "Métricas de rendimiento reseteadas. Las métricas del sistema (CPU, memoria, uptime) se mantienen."
    }


@app.get("/api/performance/export")
async def export_performance_report():
    """Exportar reporte completo de rendimiento"""
    if not PERFORMANCE_MONITORING_ENABLED:
        raise HTTPException(status_code=503, detail="Monitoreo de rendimiento no disponible")
    
    report = performance_monitor.export_report("performance_report.json")
    return {
        "success": True,
        "message": "Reporte exportado a performance_report.json",
        "report": report
    }


# ==================== ENDPOINTS DE TESTING ====================

# Almacenamiento de ejecuciones de pruebas en memoria (en producción usar Redis o BD)
test_runs = {}
test_run_counter = 0

# Almacenamiento de ejecuciones de pruebas de carga
load_test_runs = {}
load_test_counter = 0

@app.post("/api/testing/run")
async def run_tests(request: dict):
    """Ejecutar pruebas de forma asíncrona"""
    import uuid
    import asyncio
    from testing.run_all_tests import run_tests as run_tests_func
    
    test_type = request.get('test_type', None)
    verbose = request.get('verbose', False)
    coverage = request.get('coverage', False)
    
    # Generar ID único para esta ejecución
    test_run_id = str(uuid.uuid4())
    
    # Inicializar estado
    test_runs[test_run_id] = {
        'status': 'running',
        'progress': 0,
        'message': 'Iniciando pruebas...',
        'output': '',
        'results': None,
        'error': None
    }
    
    # Ejecutar pruebas en background
    async def execute_tests():
        try:
            # Ejecutar pruebas (esto es síncrono, pero lo ejecutamos en un thread)
            import concurrent.futures
            loop = asyncio.get_event_loop()
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    run_tests_func,
                    test_type=test_type,
                    verbose=verbose,
                    coverage=coverage,
                    generate_reports=True
                )
                
                # Simular progreso (en una implementación real, usarías callbacks)
                test_runs[test_run_id]['progress'] = 10
                test_runs[test_run_id]['message'] = 'Ejecutando pruebas...'
                
                success, results = future.result()
                
                # Construir summary si no existe en results
                if results and isinstance(results, dict):
                    if 'summary' not in results:
                        total_passed = sum(r.get('passed', 0) for r in results.values() if isinstance(r, dict))
                        total_failed = sum(r.get('failed', 0) for r in results.values() if isinstance(r, dict))
                        total_skipped = sum(r.get('skipped', 0) for r in results.values() if isinstance(r, dict))
                        total_tests = total_passed + total_failed + total_skipped
                        results['summary'] = {
                            'total_passed': total_passed,
                            'total_failed': total_failed,
                            'total_skipped': total_skipped,
                            'total_tests': total_tests,
                            'overall_success': success
                        }
                
                test_runs[test_run_id]['status'] = 'completed' if success else 'failed'
                test_runs[test_run_id]['progress'] = 100
                test_runs[test_run_id]['message'] = 'Pruebas completadas'
                test_runs[test_run_id]['results'] = results
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            test_runs[test_run_id]['status'] = 'failed'
            test_runs[test_run_id]['error'] = str(e)
            test_runs[test_run_id]['message'] = f'Error: {str(e)}'
            test_runs[test_run_id]['output'] = error_trace
    
    # Iniciar ejecución en background
    asyncio.create_task(execute_tests())
    
    return {
        "success": True,
        "test_run_id": test_run_id,
        "message": "Pruebas iniciadas"
    }


@app.get("/api/testing/status/{test_run_id}")
async def get_test_status(test_run_id: str):
    """Obtener estado de una ejecución de pruebas"""
    if test_run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Ejecución de pruebas no encontrada")
    
    return test_runs[test_run_id]


@app.post("/api/testing/stop/{test_run_id}")
async def stop_test(test_run_id: str):
    """Detener una ejecución de pruebas"""
    if test_run_id not in test_runs:
        raise HTTPException(status_code=404, detail="Ejecución de pruebas no encontrada")
    
    test_runs[test_run_id]['status'] = 'stopped'
    test_runs[test_run_id]['message'] = 'Pruebas detenidas por el usuario'
    
    return {"success": True, "message": "Pruebas detenidas"}


@app.get("/api/testing/reports")
async def get_test_reports():
    """Obtener lista de reportes disponibles"""
    import os
    import json
    from pathlib import Path
    
    reports_dir = Path("testing/reports")
    reports = []
    
    if not reports_dir.exists():
        return {"reports": []}
    
    # Buscar archivos HTML y JSON de reportes
    for file in reports_dir.glob("report_*.html"):
        try:
            # Buscar JSON correspondiente
            json_file = file.with_suffix('.json')
            json_data = None
            
            if json_file.exists():
                with open(json_file, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
            
            # Extraer información del nombre del archivo
            parts = file.stem.split('_')
            test_type = parts[1] if len(parts) > 1 else 'unknown'
            timestamp = '_'.join(parts[-2:]) if len(parts) >= 3 else ''
            
            # Obtener summary de json_data
            summary = {}
            if json_data:
                # Primero intentar obtener summary directamente
                summary = json_data.get('summary', {})
                
                # Si no hay summary pero hay results (reporte consolidado), crear summary desde results
                if not summary and json_data.get('results'):
                    results = json_data.get('results', {})
                    total_passed = sum(r.get('passed', 0) for r in results.values() if isinstance(r, dict))
                    total_failed = sum(r.get('failed', 0) for r in results.values() if isinstance(r, dict))
                    total_skipped = sum(r.get('skipped', 0) for r in results.values() if isinstance(r, dict))
                    total_tests = total_passed + total_failed + total_skipped
                    summary = {
                        'total_passed': total_passed,
                        'total_failed': total_failed,
                        'total_skipped': total_skipped,
                        'total_tests': total_tests,
                        'overall_success': total_failed == 0 and total_tests > 0
                    }
                # Si no hay summary ni results, pero el JSON tiene las estadísticas directamente (reporte individual)
                elif not summary and ('passed' in json_data or 'failed' in json_data):
                    # Es un reporte individual con stats directas
                    total_passed = json_data.get('passed', 0)
                    total_failed = json_data.get('failed', 0)
                    total_skipped = json_data.get('skipped', 0)
                    total_tests = json_data.get('total', 0)
                    if total_tests == 0:
                        total_tests = total_passed + total_failed + total_skipped
                    success = json_data.get('success', False)
                    # Si success no está definido, calcularlo
                    if success is None or (total_tests > 0 and success is False and total_failed == 0):
                        success = total_failed == 0 and total_tests > 0
                    summary = {
                        'total_passed': total_passed,
                        'total_failed': total_failed,
                        'total_skipped': total_skipped,
                        'total_tests': total_tests,
                        'overall_success': success
                    }
            
            reports.append({
                'filename': file.name,
                'json_file': json_file.name if json_file.exists() else None,
                'test_type': test_type,
                'timestamp': timestamp,
                'date': json_data.get('date', '') if json_data else '',
                'summary': summary,
                'path': str(file)
            })
        except Exception as e:
            print(f"Error procesando reporte {file}: {e}")
            continue
    
    # Ordenar por fecha (más reciente primero)
    reports.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    return {"reports": reports}


@app.post("/api/testing/performance/run")
async def run_load_test(request: dict):
    """Ejecutar pruebas de carga de forma asíncrona"""
    import uuid
    import asyncio
    import subprocess
    import os
    from pathlib import Path
    
    users = request.get('users', 10)
    spawn_rate = request.get('spawn_rate', 2)
    run_time = request.get('run_time', '60s')
    host = request.get('host', 'http://localhost:8000')
    
    # Generar ID único para esta ejecución
    load_test_id = str(uuid.uuid4())
    
    # Inicializar estado
    load_test_runs[load_test_id] = {
        'status': 'running',
        'progress': 0,
        'message': 'Iniciando pruebas de carga...',
        'config': {
            'users': users,
            'spawn_rate': spawn_rate,
            'run_time': run_time,
            'host': host
        },
        'results': None,
        'error': None,
        'start_time': time.time()
    }
    
    # Ejecutar pruebas de carga en background
    async def execute_load_test():
        try:
            load_test_runs[load_test_id]['status'] = 'running'
            load_test_runs[load_test_id]['message'] = 'Ejecutando pruebas de carga...'
            load_test_runs[load_test_id]['progress'] = 10
            
            # Crear directorio de reportes si no existe
            reports_dir = Path("testing/reports/performance")
            reports_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            html_report = reports_dir / f"load_test_{timestamp}.html"
            csv_report = reports_dir / f"load_test_{timestamp}.csv"
            
            load_test_runs[load_test_id]['progress'] = 30
            
            # Ejecutar Locust en modo headless
            # Obtener el directorio base del proyecto (donde está main.py)
            script_dir = os.path.dirname(os.path.abspath(__file__))
            base_dir = script_dir  # main.py está en la raíz del proyecto
            load_test_script = os.path.join(base_dir, "testing", "performance", "load_test.py")
            
            # Convertir a ruta absoluta y normalizar
            load_test_script = os.path.abspath(load_test_script)
            
            # Verificar que el archivo existe
            if not os.path.exists(load_test_script):
                error_msg = (
                    f"No se encontró el script de Locust.\n"
                    f"Buscado en: {load_test_script}\n"
                    f"Directorio base: {base_dir}\n"
                    f"Directorio actual de trabajo: {os.getcwd()}\n"
                    f"Verifica que el archivo testing/performance/load_test.py existe."
                )
                print(f"[ERROR] {error_msg}")
                raise FileNotFoundError(error_msg)
            
            # Usar siempre py -m locust o python -m locust para mayor compatibilidad
            import sys
            python_executable = sys.executable
            
            cmd = [
                python_executable, "-m", "locust",
                "-f", load_test_script,
                "--host", host,
                "--users", str(users),
                "--spawn-rate", str(spawn_rate),
                "--run-time", run_time,
                "--headless",
                "--html", str(html_report),
                "--csv", str(csv_report),
                "--loglevel", "INFO"  # Asegurar que se capturen los datos
            ]
            
            # Guardar comando para debugging
            load_test_runs[load_test_id]['command'] = ' '.join(cmd)
            
            load_test_runs[load_test_id]['progress'] = 50
            load_test_runs[load_test_id]['message'] = f'Ejecutando con {users} usuarios...'
            
            # Calcular timeout (tiempo de ejecución + margen más amplio para asegurar que Locust termine correctamente)
            # Locust necesita tiempo adicional después de --run-time para generar el reporte HTML
            timeout_seconds = int(run_time.rstrip('s')) + 60  # Aumentar margen a 60 segundos
            
            # Usar Popen en lugar de run para poder cancelar el proceso si es necesario
            import sys
            creation_flags = 0
            if sys.platform == "win32":
                creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP
            
            # Usar archivos temporales para stdout y stderr para evitar bloqueos con PIPE
            import tempfile
            stdout_file = tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt')
            stderr_file = tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt')
            stdout_path = stdout_file.name
            stderr_path = stderr_file.name
            stdout_file.close()
            stderr_file.close()
            
            stdout_fd = None
            stderr_fd = None
            try:
                stdout_fd = open(stdout_path, 'w', encoding='utf-8')
                stderr_fd = open(stderr_path, 'w', encoding='utf-8')
                
                process = subprocess.Popen(
                    cmd,
                    cwd=base_dir,
                    stdout=stdout_fd,
                    stderr=stderr_fd,
                    text=True,
                    creationflags=creation_flags
                )
                
                # Guardar referencia al proceso para poder cancelarlo si es necesario
                load_test_runs[load_test_id]['process'] = process
                
                try:
                    # Esperar a que termine el proceso
                    process.wait(timeout=timeout_seconds)
                    
                    # Cerrar archivos antes de leerlos
                    if stdout_fd:
                        stdout_fd.close()
                        stdout_fd = None
                    if stderr_fd:
                        stderr_fd.close()
                        stderr_fd = None
                    
                    # Esperar un momento adicional para asegurar que Locust termine de escribir el reporte HTML
                    time.sleep(3)  # Aumentar a 3 segundos
                    
                    # Leer stdout y stderr de los archivos
                    with open(stdout_path, 'r', encoding='utf-8') as f:
                        stdout = f.read()
                    with open(stderr_path, 'r', encoding='utf-8') as f:
                        stderr = f.read()
                    
                    result = type('Result', (), {
                        'returncode': process.returncode,
                        'stdout': stdout,
                        'stderr': stderr
                    })()
                    
                    # Log para debugging
                    print(f"[DEBUG] Locust terminó con código: {process.returncode}")
                    print(f"[DEBUG] Stdout length: {len(stdout)} caracteres")
                    print(f"[DEBUG] Stderr length: {len(stderr)} caracteres")
                    if stderr:
                        print(f"[DEBUG] Stderr (primeras 500 chars): {stderr[:500]}")
                    
                except subprocess.TimeoutExpired:
                    # Si hay timeout, terminar el proceso
                    try:
                        process.kill()
                        process.wait(timeout=5)
                    except:
                        pass
                    raise
                except KeyboardInterrupt:
                    # Si se recibe Ctrl+C, terminar el proceso
                    try:
                        process.kill()
                        process.wait(timeout=5)
                    except:
                        pass
                    raise
                finally:
                    # Cerrar archivos stdout/stderr si están abiertos
                    try:
                        if stdout_fd:
                            stdout_fd.close()
                        if stderr_fd:
                            stderr_fd.close()
                    except:
                        pass
                    # Limpiar referencia al proceso
                    load_test_runs[load_test_id].pop('process', None)
            finally:
                # Limpiar archivos temporales
                try:
                    if os.path.exists(stdout_path):
                        os.unlink(stdout_path)
                    if os.path.exists(stderr_path):
                        os.unlink(stderr_path)
                except:
                    pass
            
            load_test_runs[load_test_id]['progress'] = 80
            
            # Parsear resultados si están disponibles
            error_message = None
            if result.returncode != 0:
                # Construir mensaje de error más descriptivo
                if result.stderr:
                    error_message = result.stderr
                elif result.stdout:
                    # A veces Locust escribe errores en stdout
                    error_message = result.stdout
                else:
                    error_message = f"Locust falló con código de salida {result.returncode}"
            
            # Normalizar rutas de reportes para que sean relativas al directorio de reportes
            reports_dir_str = str(reports_dir)
            html_report_str = str(html_report)
            csv_report_str = str(csv_report)
            
            # Si la ruta es absoluta, convertir a relativa desde el directorio de reportes
            if html_report_str.startswith(reports_dir_str):
                html_report_rel = html_report_str.replace(reports_dir_str + os.sep, '').replace(reports_dir_str + '/', '')
            else:
                html_report_rel = os.path.basename(html_report_str)
            
            results = {
                'exit_code': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'error_message': error_message,
                'html_report': html_report_rel,  # Usar ruta relativa
                'html_report_full': html_report_str,  # Guardar también la ruta completa
                'csv_report': csv_report_str,
                'success': result.returncode == 0
            }
            
            # Intentar leer estadísticas del CSV si existe
            stats_csv = csv_report.parent / f"{csv_report.stem}_stats.csv"
            if stats_csv.exists():
                try:
                    import pandas as pd
                    stats_df = pd.read_csv(stats_csv)
                    if not stats_df.empty:
                        results['stats'] = stats_df.to_dict('records')
                except Exception as e:
                    print(f"Error leyendo estadísticas CSV: {e}")
            
            load_test_runs[load_test_id]['results'] = results
            load_test_runs[load_test_id]['status'] = 'completed' if result.returncode == 0 else 'failed'
            load_test_runs[load_test_id]['progress'] = 100
            if result.returncode == 0:
                load_test_runs[load_test_id]['message'] = 'Pruebas de carga completadas'
            else:
                # Mensaje más descriptivo con el error
                if error_message:
                    # Extraer solo las primeras líneas del error para el mensaje
                    error_lines = error_message.split('\n')[:3]
                    short_error = ' | '.join([line.strip() for line in error_lines if line.strip()])
                    load_test_runs[load_test_id]['message'] = f'Pruebas de carga fallaron: {short_error}'
                    load_test_runs[load_test_id]['error'] = error_message
                else:
                    load_test_runs[load_test_id]['message'] = 'Pruebas de carga fallaron'
            
        except subprocess.TimeoutExpired:
            load_test_runs[load_test_id]['status'] = 'timeout'
            load_test_runs[load_test_id]['error'] = 'Las pruebas de carga excedieron el tiempo límite'
            load_test_runs[load_test_id]['message'] = 'Timeout en pruebas de carga'
        except KeyboardInterrupt:
            load_test_runs[load_test_id]['status'] = 'cancelled'
            load_test_runs[load_test_id]['error'] = 'Pruebas de carga canceladas por el usuario'
            load_test_runs[load_test_id]['message'] = 'Pruebas de carga canceladas'
            # Re-lanzar KeyboardInterrupt para que el servidor pueda cerrarse
            raise
        except Exception as e:
            import traceback
            load_test_runs[load_test_id]['status'] = 'error'
            load_test_runs[load_test_id]['error'] = str(e)
            load_test_runs[load_test_id]['message'] = f'Error: {str(e)}'
            load_test_runs[load_test_id]['traceback'] = traceback.format_exc()
    
    # Ejecutar en background
    asyncio.create_task(execute_load_test())
    
    return {
        "success": True,
        "load_test_id": load_test_id,
        "message": "Pruebas de carga iniciadas"
    }

@app.get("/api/testing/performance/status/{load_test_id}")
async def get_load_test_status(load_test_id: str):
    """Obtener estado de una ejecución de pruebas de carga"""
    if load_test_id not in load_test_runs:
        raise HTTPException(status_code=404, detail="Ejecución de pruebas de carga no encontrada")
    
    run_info = load_test_runs[load_test_id].copy()
    if run_info.get('start_time'):
        run_info['elapsed_time'] = time.time() - run_info['start_time']
    
    return run_info

@app.get("/api/testing/report/{filename}")
async def get_test_report(filename: str, download: bool = False):
    """Obtener un reporte específico"""
    import os
    from pathlib import Path
    from fastapi.responses import FileResponse, HTMLResponse
    
    # Validar nombre de archivo para prevenir path traversal
    if '..' in filename or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    
    # Buscar el reporte en diferentes ubicaciones posibles
    possible_paths = [
        Path("testing/reports") / filename,
        Path("testing/reports/performance") / filename,
        Path("testing/reports") / "performance" / filename
    ]
    
    report_path = None
    for path in possible_paths:
        if path.exists():
            report_path = path
            break
    
    if not report_path:
        raise HTTPException(
            status_code=404, 
            detail=f"Reporte no encontrado: {filename}. Buscado en: {[str(p) for p in possible_paths]}"
        )
    
    # Si es HTML y no se solicita descarga, servir como HTML para iframe
    if filename.endswith('.html') and not download:
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Agregar headers para permitir visualización en iframe
            # Remover X-Frame-Options si existe en el HTML
            html_content = html_content.replace('X-Frame-Options', 'X-Frame-Options-Original')
            
            # Ajustar CSP para permitir ejecución de scripts inline (necesario para reportes de Locust)
            # El reporte HTML de Locust tiene JavaScript embebido que necesita ejecutarse
            return HTMLResponse(
                content=html_content,
                headers={
                    "X-Frame-Options": "SAMEORIGIN",  # Permitir en iframe del mismo origen
                    "Content-Security-Policy": "frame-ancestors 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",  # Permitir scripts inline y eval para Locust
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error leyendo reporte: {str(e)}")
    
    # Para JSON o cuando se solicita descarga, usar FileResponse
    if filename.endswith('.json'):
        media_type = 'application/json'
    elif filename.endswith('.html'):
        media_type = 'text/html'
    else:
        media_type = 'application/octet-stream'
    
    return FileResponse(
        path=str(report_path),
        media_type=media_type,
        filename=filename if download else None,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'} if download else {}
    )

@app.get("/api/server-session")
async def get_server_session():
    """Obtener información de la sesión del servidor"""
    global server_session_id, server_start_time
    return {
        "session_id": server_session_id,
        "start_time": server_start_time,
        "has_outlier_results": bool(outlier_results)
    }

@app.get("/api/debug/files")
async def debug_files():
    """Debug para verificar archivos"""
    import os
    import time
    
    files_info = {}
    files_to_check = [
        "frontend/modules/detect_outliers/detect_outliers.html",
        "frontend/modules/detect_outliers/detect_outliers.css",
        "frontend/modules/detect_outliers/detect_outliers.js"
    ]
    
    for file_path in files_to_check:
        if os.path.exists(file_path):
            stat = os.stat(file_path)
            files_info[file_path] = {
                "exists": True,
                "size": stat.st_size,
                "modified": time.ctime(stat.st_mtime),
                "timestamp": stat.st_mtime
            }
        else:
            files_info[file_path] = {"exists": False}
    
    return files_info

@app.post("/api/outliers/{filename}/detect")
async def detect_outliers_complete(filename: str, request: dict):
    """Ejecutar detección completa de outliers"""
    try:
        
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Validar configuración requerida (aceptar ambos formatos: camelCase y snake_case)
        subject_id = request.get('subjectId') or request.get('subject_id')
        if not subject_id:
            raise HTTPException(status_code=400, detail="Identificador del sujeto requerido")
        
        # Normalizar a snake_case para consistencia interna
        request['subject_id'] = subject_id
        
        # Importar el módulo de detección de outliers
        from analysis_core.outlier_detection import OutlierDetector
        
        detector = OutlierDetector(data_processor)
        results = detector.detect_outliers_complete(filename, request)
        
        # Convertir todos los valores numpy a tipos nativos de Python para serialización JSON
        def convert_numpy_types(obj):
            """Convierte tipos numpy a tipos nativos de Python"""
            import numpy as np
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {key: convert_numpy_types(value) for key, value in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            else:
                return obj
        
        # Aplicar conversión a todos los resultados
        results = convert_numpy_types(results)
        
        # Almacenar resultados en la variable global
        global outlier_results, server_session_id
        outlier_results = results
        outlier_results['filename'] = filename  # Add filename to results for easy lookup
        outlier_results['server_session_id'] = server_session_id  # Add server session ID
        
        
        return {"success": True, "results": results}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/outliers/{filename}/grubbs-test")
async def get_grubbs_test_results(filename: str, request: dict):
    """Obtener resultados detallados del test de Grubbs para todas las variables numéricas"""
    try:
        import traceback
        from analysis_core.outlier_detection import OutlierDetector
        
        subject_id = request.get('subject_id')
        
        # Validar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset '{filename}' no encontrado")
        
        # Crear detector de outliers
        outlier_detector = OutlierDetector(data_processor)
        
        # Obtener resultados detallados para todas las variables
        try:
            results = outlier_detector.get_grubbs_detailed_results(filename, subject_id)
        except Exception as inner_e:
            error_trace = traceback.format_exc()
            print(f"Error interno en get_grubbs_detailed_results para {filename}:\n{error_trace}")
            raise HTTPException(status_code=500, detail=f"Error procesando resultados: {str(inner_e)}")
        
        # Si hay un error en los resultados, devolverlo como error HTTP 400
        if not results.get('success', False):
            error_msg = results.get('error', 'Error desconocido en el test de Grubbs')
            print(f"Error en test de Grubbs para {filename}: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Convertir tipos numpy a tipos Python nativos para JSON
        def convert_numpy_types(obj):
            if isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_numpy_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_numpy_types(elem) for elem in obj]
            return obj
        
        results = convert_numpy_types(results)
        return results
        
    except HTTPException:
        # Re-lanzar HTTPExceptions sin modificar
        raise
    except Exception as e:
        # Capturar cualquier otra excepción y mostrar detalles
        error_trace = traceback.format_exc()
        error_msg = f"Error interno en test de Grubbs: {str(e)}"
        print(f"Error en endpoint de test de Grubbs para {filename}: {error_msg}\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

@app.post("/api/outliers/{filename}/dixon-test")
async def get_dixon_test_results(filename: str, request: dict):
    """Obtener resultados detallados del test de Dixon para todas las variables numéricas"""
    try:
        from analysis_core.outlier_detection import OutlierDetector
        
        subject_id = request.get('subject_id')
        
        # Crear detector de outliers
        outlier_detector = OutlierDetector(data_processor)
        
        # Obtener resultados detallados para todas las variables
        results = outlier_detector.get_dixon_detailed_results(filename, subject_id)
        
        if not results.get('success', False):
            raise HTTPException(status_code=400, detail=results.get('error', 'Error desconocido'))
        
        return results
        
    except Exception as e:
        print(f"Error en endpoint de test de Dixon: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

@app.post("/api/outliers/{filename}/rosner-test")
async def get_rosner_test_results(filename: str, request: dict):
    """Obtener resultados detallados del test de Rosner para todas las variables numéricas"""
    try:
        from analysis_core.outlier_detection import OutlierDetector
        
        subject_id = request.get('subject_id')
        k = request.get('k')  # Número máximo de outliers a detectar
        
        # Crear detector de outliers
        outlier_detector = OutlierDetector(data_processor)
        
        # Obtener resultados detallados para todas las variables
        results = outlier_detector.get_rosner_detailed_results(filename, subject_id, k)
        
        if not results.get('success', False):
            raise HTTPException(status_code=400, detail=results.get('error', 'Error desconocido'))
        
        return results
        
    except Exception as e:
        print(f"Error en endpoint de test de Rosner: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

# Endpoints para Análisis y Visualización
@app.get("/analyze-viz-html")
async def get_analyze_viz_html():
    """Servir el archivo HTML del módulo de análisis y visualización sin caché"""
    import time
    return FileResponse(
        "frontend/modules/analyze_viz/analyze_viz.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Last-Modified": str(int(time.time()))
        }
    )

@app.post("/api/analyze-viz/{filename}/primary-analysis")
async def perform_primary_analysis(filename: str, request: Request):
    """Realizar análisis primario de outliers"""
    try:
        
        # Obtener el body del request como JSON
        request_data = await request.json()
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener resultados de outliers del request
        outlier_results = request_data.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        # Realizar análisis primario
        results = analysis_viz.perform_primary_analysis(dataset_info, outlier_results)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/advanced-analysis")
async def perform_advanced_analysis(filename: str, request: dict):
    """Realizar análisis avanzado de outliers"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener resultados de outliers del request
        outlier_results = request.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        # Realizar análisis avanzado
        results = analysis_viz.perform_advanced_analysis(dataset_info, outlier_results)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/robust-regression")
async def perform_robust_regression(filename: str, request: dict):
    """Realizar análisis de regresión robusta específico"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        target_var = request.get('target_var')
        predictor_vars = request.get('predictor_vars', [])
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not target_var or not predictor_vars or len(predictor_vars) < 2:
            raise HTTPException(status_code=400, detail="Se requieren una variable objetivo y al menos dos predictoras")
        
        # Cargar datos con outliers
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Realizar análisis de regresión robusta
        results = analysis_viz.robust_regression_analysis(df, variable_types, target_var, predictor_vars)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/pca-analysis")
async def perform_pca_analysis(filename: str, request: dict):
    """Realizar análisis de componentes principales específico"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        variables = request.get('variables', [])
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos dos variables para PCA")
        
        # Cargar datos con outliers
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Realizar análisis PCA
        results = analysis_viz.pca_analysis(df, variable_types, variables)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/logistic-regression")
async def perform_logistic_regression(filename: str, request: dict):
    """Realizar análisis de regresión logística específico"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        predictors = request.get('predictors', [])
        test_size = request.get('test_size', 0.2)
        auto_select_features = request.get('auto_select_features', True)  # Activar por defecto
        max_features = request.get('max_features', 10)  # Máximo 10 variables por defecto
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not predictors or len(predictors) < 1:
            raise HTTPException(status_code=400, detail="Se requiere al menos una variable predictora")
        
        # Cargar datos con outliers
        try:
            df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            raise HTTPException(status_code=500, detail=f"Error cargando datos con outliers: {str(e)}")
        
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Verificar que el DataFrame tenga la columna es_outlier
        if 'es_outlier' not in df.columns:
            raise HTTPException(status_code=400, detail="El DataFrame no tiene la columna 'es_outlier'. Asegúrate de haber ejecutado la detección de outliers primero.")
        
        # Verificar que haya al menos algunas observaciones de cada clase
        if 'es_outlier' in df.columns:
            outlier_counts = df['es_outlier'].value_counts()
            if len(outlier_counts) < 2:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Solo hay una clase en los datos ({outlier_counts.index[0] if len(outlier_counts) > 0 else 'desconocida'}). Se requieren al menos dos clases para regresión logística."
                )
        
        # Realizar análisis de regresión logística con selección automática si hay muchas variables
        try:
            results = analysis_viz.logistic_regression_analysis(
                df, variable_types, predictors, test_size, 
                auto_select_features=auto_select_features, 
                max_features=max_features
            )
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            raise HTTPException(status_code=500, detail=f"Error en regresión logística: {str(e)}")
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        # Verificar si hay datos insuficientes (no es un error, es información)
        if 'status' in results and results['status'] == 'insufficient_data':
            return results
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/calculate-optimal-k")
async def calculate_optimal_k(filename: str, request: dict):
    """Calcular el número óptimo de clústeres (k) usando múltiples métodos"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        variables = request.get('variables', [])
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos dos variables para clustering")
        
        # Cargar datos con outliers
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Realizar análisis de clustering para determinar k óptimo
        results = analysis_viz.clustering_analysis(df, variable_types, variables, outlier_results)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        # Verificar si hay datos insuficientes (no es un error, es información)
        if 'status' in results and results['status'] == 'warning_insufficient_data':
            return results
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/apply-kmeans")
async def apply_kmeans(filename: str, request: dict):
    """Aplicar algoritmo K-means y generar visualización con PCA"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        variables = request.get('variables', [])
        optimal_k = request.get('optimal_k', 2)
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos dos variables para clustering")
        
        if optimal_k < 2:
            raise HTTPException(status_code=400, detail="El número de clústeres debe ser al menos 2")
        
        # Cargar datos con outliers
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Aplicar K-means y generar visualización
        results = analysis_viz.apply_kmeans_visualization(df, variable_types, variables, optimal_k, outlier_results)
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        # Verificar si hay datos insuficientes (no es un error, es información)
        if 'status' in results and results['status'] == 'warning_insufficient_data':
            return results
        
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/apply-hierarchical")
async def apply_hierarchical_clustering(filename: str, request: dict):
    """Aplicar clustering jerárquico con PCA y generar dendrogramas"""
    try:
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        
        # Extraer parámetros de la solicitud
        variables = request.get('variables', [])
        optimal_k = request.get('optimal_k', 3)
        id_column = request.get('id_column', None)
        linkage_method = request.get('linkage_method', 'ward')
        
        if not variables:
            raise HTTPException(status_code=400, detail="Se requieren variables para el análisis")
        
        # Obtener tipos de variables
        variable_types = dataset_info.get("variable_types", {})
        
        # Ejecutar clustering jerárquico
        results = analysis_viz.run_hierarchical_pca_plot(df, variable_types, variables, optimal_k, id_column, linkage_method, outlier_results)
        
        # Verificar si hay datos insuficientes (no es un error, es información)
        if 'status' in results and results['status'] == 'warning_insufficient_data':
            return results
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en clustering jerárquico: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

@app.post("/api/analyze-viz/{filename}/validate-clustering")
async def validate_clustering(filename: str, request: dict):
    """Validar tendencia de clustering comparando datos reales con simulados"""
    try:
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        
        # Extraer parámetros de la solicitud
        variables = request.get('variables', [])
        
        if not variables:
            raise HTTPException(status_code=400, detail="Se requieren variables para el análisis")
        
        # Obtener tipos de variables
        variable_types = dataset_info.get("variable_types", {})
        
        # Ejecutar validación de clustering (usar outliers)
        request_outlier_results = request.get('outlier_results', {}) if isinstance(request, dict) else {}
        results = analysis_viz.run_clustering_validation(
            df,
            variable_types,
            variables,
            request_outlier_results or outlier_results
        )
        
        # Verificar si hay datos insuficientes (no es un error, es información)
        if 'status' in results and results['status'] == 'warning_insufficient_data':
            return results
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en validación de clustering: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

# Endpoints para el módulo de Resultados
@app.get("/results-html")
async def get_results_html():
    """Servir el archivo HTML del módulo de resultados sin caché"""
    import time
    return FileResponse(
        "frontend/modules/results/results.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Last-Modified": str(int(time.time()))
        }
    )

@app.get("/api/results/{filename}/outlier-metrics")
async def get_outlier_metrics(filename: str):
    """Obtener métricas de outliers para el dashboard"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener resultados de outliers globales
        global outlier_results
        if not outlier_results or outlier_results.get('filename') != filename:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Calcular métricas
        total_records = dataset_info.get('rows', 0)
        outliers_detected = outlier_results.get('outliers_detected', 0)
        normal_data = total_records - outliers_detected
        outlier_percentage = (outliers_detected / total_records * 100) if total_records > 0 else 0
        
        metrics = {
            "total_records": total_records,
            "outliers_detected": outliers_detected,
            "normal_data": normal_data,
            "outlier_percentage": round(outlier_percentage, 1)
        }
        
        return {"success": True, "metrics": metrics}
        
    except Exception as e:
        print(f"Error obteniendo métricas de outliers: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/results/{filename}/analysis-results")
async def get_analysis_results(filename: str):
    """Obtener todos los resultados de análisis para el dashboard"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener resultados de outliers globales
        global outlier_results
        if not outlier_results or outlier_results.get('filename') != filename:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos con outliers
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Obtener variables numéricas para análisis
        numeric_vars = [var for var, var_type in variable_types.items() 
                       if var_type.startswith('cuantitativa') and var != 'es_outlier']
        
        results = {
            "outlier_metrics": {
                "total_records": dataset_info.get('rows', 0),
                "outliers_detected": outlier_results.get('outliers_detected', 0),
                "normal_data": dataset_info.get('rows', 0) - outlier_results.get('outliers_detected', 0),
                "outlier_percentage": round((outlier_results.get('outliers_detected', 0) / dataset_info.get('rows', 1) * 100), 1)
            },
            "available_variables": {
                "numeric": numeric_vars,
                "categorical": [var for var, var_type in variable_types.items() 
                               if var_type.startswith('cualitativa') and var != 'es_outlier']
            },
            "dataset_info": {
                "filename": filename,
                "rows": dataset_info.get('rows', 0),
                "columns": dataset_info.get('columns', 0),
                "variable_types": variable_types
            }
        }
        
        return {"success": True, "results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de análisis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/results/{filename}/pca-results")
async def get_pca_results(filename: str, request: dict):
    """Obtener resultados de PCA para widgets específicos"""
    try:
        variables = request.get('variables', [])
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos dos variables para PCA")
        
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Realizar análisis PCA
        results = analysis_viz.pca_analysis(df, variable_types, variables)
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return {"success": True, "pca_results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de PCA: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/comparative-correlations")
async def perform_comparative_correlation_analysis(filename: str, request: dict):
    """Realizar análisis comparativo de correlaciones entre outliers y normales"""
    try:
        
        # Verificar que el dataset existe
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        # Obtener información del dataset
        dataset_info = data_processor.datasets[filename]
        
        # Obtener parámetros del request
        outlier_results = request.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        # Cargar datos con outliers
        try:
            df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            raise HTTPException(status_code=500, detail=f"Error cargando datos con outliers: {str(e)}")
        
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Verificar que el DataFrame tenga la columna es_outlier
        if 'es_outlier' not in df.columns:
            raise HTTPException(status_code=400, detail="El DataFrame no tiene la columna 'es_outlier'. Asegúrate de haber ejecutado la detección de outliers primero.")
        
        # Realizar análisis de correlaciones comparativo
        try:
            # Pasar outlier_results para que el análisis pueda contar correctamente
            results = analysis_viz.comparative_correlation_analysis(df, variable_types, outlier_results)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            raise HTTPException(status_code=500, detail=f"Error en análisis de correlaciones comparativo: {str(e)}")
        
        # Verificar si hay error en los resultados
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error', 'Error en análisis'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINTS PARA MARCO ANALÍTICO COMPLETO
# ============================================================================

@app.post("/api/analyze-viz/{filename}/demographic-profile")
async def perform_demographic_profile_analysis(filename: str, request: dict):
    """Análisis de Perfil Demográfico/Clínico (Fase 1.1)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        categorical_variables = request.get('categorical_variables', None)
        results = analysis_viz.demographic_clinical_profile_analysis(df, variable_types, categorical_variables)
        
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/cooccurrence-patterns")
async def perform_cooccurrence_analysis(filename: str, request: dict):
    """Análisis de Patrones de Co-Ocurrencia (Fase 1.2)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        results = analysis_viz.cooccurrence_patterns_analysis(df, variable_types, outlier_results)
        
        if 'error' in results:
            # Si hay información adicional (outliers_detected, minimum_required), devolver el objeto completo
            if 'outliers_detected' in results or 'minimum_required' in results:
                raise HTTPException(status_code=400, detail=results)
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/outlier-clustering")
async def perform_outlier_clustering(filename: str, request: dict):
    """Clustering de Outliers (Fase 2.2)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        method = request.get('method', 'kmeans')
        
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        
        # Pasar outlier_results para obtener conteos correctos
        results = analysis_viz.outlier_clustering_analysis(df, variable_types, method, outlier_results)
        
        
        if 'error' in results:
            # Si hay información adicional (outliers_detected, minimum_required), devolver el objeto completo
            if 'outliers_detected' in results or 'minimum_required' in results:
                raise HTTPException(status_code=400, detail=results)
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        # Convertir tipos numpy a tipos nativos de Python para JSON
        def convert_numpy_types(obj):
            """Convierte tipos numpy a tipos nativos de Python"""
            import numpy as np
            if isinstance(obj, (np.integer, np.int32, np.int64)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float32, np.float64)):
                return float(obj)
            elif isinstance(obj, np.bool_):
                return bool(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                # Convertir tanto las claves como los valores
                converted_dict = {}
                for key, value in obj.items():
                    # Convertir la clave si es numpy
                    if isinstance(key, (np.integer, np.int32, np.int64)):
                        converted_key = int(key)
                    elif isinstance(key, (np.floating, np.float32, np.float64)):
                        converted_key = float(key)
                    elif isinstance(key, np.bool_):
                        converted_key = bool(key)
                    else:
                        converted_key = key
                    # Convertir el valor
                    converted_dict[converted_key] = convert_numpy_types(value)
                return converted_dict
            elif isinstance(obj, (list, tuple)):
                return [convert_numpy_types(item) for item in obj]
            else:
                return obj
        
        results = convert_numpy_types(results)
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/predictive-model")
async def perform_predictive_model_analysis(filename: str, request: dict):
    """Modelo Predictivo Random Forest (Fase 3.2)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        predictors = request.get('predictors', None)
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Pasar outlier_results para excluir subject_id_column de predictores
        results = analysis_viz.predictive_model_analysis(df, variable_types, predictors, outlier_results)
        
        if 'error' in results:
            # Si hay información adicional (available_data_points, minimum_required, etc.), devolver el objeto completo
            if any(key in results for key in ['available_data_points', 'minimum_required', 'minority_class_count', 'class_distribution', 'training_set_size', 'test_set_size', 'classes_in_training', 'classes_in_test']):
                raise HTTPException(status_code=400, detail=results)
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/supervised-pca")
async def perform_supervised_pca(filename: str, request: dict):
    """PCA Supervisado (Fase 2.1)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        variables = request.get('variables', None)
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Pasar outlier_results para obtener conteos correctos
        results = analysis_viz.supervised_pca_analysis(df, variable_types, variables, outlier_results)
        
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/network-analysis")
async def perform_network_analysis(filename: str, request: dict):
    """Análisis de Redes de Co-expresión (Fase 2.3)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        results = analysis_viz.network_analysis(df, variable_types, outlier_results)
        
        if 'error' in results:
            # Si hay información adicional (outliers_detected, normal_records, minimum_required), devolver el objeto completo
            if 'outliers_detected' in results or 'normal_records' in results or 'minimum_required' in results:
                raise HTTPException(status_code=400, detail=results)
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-viz/{filename}/survival-analysis")
async def perform_survival_analysis(filename: str, request: dict):
    """Análisis de Supervivencia (Fase 3.1)"""
    try:
        if filename not in data_processor.datasets:
            raise HTTPException(status_code=404, detail=f"Dataset {filename} no encontrado")
        
        dataset_info = data_processor.datasets[filename]
        outlier_results = request.get('outlier_results', {})
        time_variable = request.get('time_variable')
        event_variable = request.get('event_variable')
        
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        if not time_variable:
            raise HTTPException(status_code=400, detail="Variable de tiempo requerida")
        
        if not event_variable:
            raise HTTPException(status_code=400, detail="Variable de evento requerida")
        
        df = analysis_viz.load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        results = analysis_viz.survival_analysis(df, variable_types, time_variable, event_variable)
        
        if 'error' in results:
            raise HTTPException(status_code=400, detail=results.get('error'))
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/results/{filename}/logistic-results")
async def get_logistic_results(filename: str, request: dict):
    """Obtener resultados de regresión logística para widgets específicos"""
    try:
        predictors = request.get('predictors', [])
        test_size = request.get('test_size', 0.2)
        auto_select_features = request.get('auto_select_features', True)  # Activar por defecto
        max_features = request.get('max_features', 10)  # Máximo 10 variables por defecto
        
        if not predictors or len(predictors) < 1:
            raise HTTPException(status_code=400, detail="Se requiere al menos una variable predictora")
        
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=400, detail="Resultados de outliers requeridos")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        
        # Verificar que las variables predictoras existan
        for pred in predictors:
            if pred not in df.columns:
                raise HTTPException(status_code=400, detail=f"Variable predictora '{pred}' no encontrada en el dataset")
        
        # Realizar análisis de regresión logística con selección automática si hay muchas variables
        results = analysis_viz.logistic_regression_analysis(
            df, variable_types, predictors, test_size,
            auto_select_features=auto_select_features,
            max_features=max_features
        )
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return {"success": True, "logistic_results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de regresión logística: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/results/{filename}/clustering-results")
async def get_clustering_results(filename: str, request: dict):
    """Obtener resultados de clustering para widgets específicos"""
    try:
        variables = request.get('variables', [])
        optimal_k = request.get('optimal_k', 2)
        
        if not variables or len(variables) < 2:
            raise HTTPException(status_code=400, detail="Se requieren al menos dos variables para clustering")
        
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
        
        # Realizar análisis de clustering
        clustering_results = analysis_viz.clustering_analysis(df, variable_types, variables, outlier_results)
        kmeans_results = analysis_viz.apply_kmeans_visualization(df, variable_types, variables, optimal_k, outlier_results)
        
        results = {
            "clustering_analysis": clustering_results,
            "kmeans_visualization": kmeans_results
        }
        
        if "error" in clustering_results:
            raise HTTPException(status_code=400, detail=clustering_results["error"])
        
        return {"success": True, "clustering_results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de clustering: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/results/{filename}/hierarchical-results")
async def get_hierarchical_results(filename: str, request: dict):
    """Obtener resultados de clustering jerárquico para widgets específicos"""
    try:
        variables = request.get('variables', [])
        optimal_k = request.get('optimal_k', 3)
        id_column = request.get('id_column', None)
        linkage_method = request.get('linkage_method', 'ward')
        
        if not variables:
            raise HTTPException(status_code=400, detail="Se requieren variables para el análisis")
        
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        
        # Ejecutar clustering jerárquico
        results = analysis_viz.run_hierarchical_pca_plot(df, variable_types, variables, optimal_k, id_column, linkage_method, outlier_results)
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return {"success": True, "hierarchical_results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de clustering jerárquico: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/results/{filename}/validation-results")
async def get_validation_results(filename: str, request: dict):
    """Obtener resultados de validación de clustering para widgets específicos"""
    try:
        variables = request.get('variables', [])
        
        if not variables:
            raise HTTPException(status_code=400, detail="Se requieren variables para el análisis")
        
        # Obtener información del dataset
        dataset_info = get_dataset_info(filename)
        if not dataset_info:
            raise HTTPException(status_code=404, detail="Dataset no encontrado")
        
        # Obtener resultados de outliers
        outlier_results = get_outlier_results(filename)
        if not outlier_results:
            raise HTTPException(status_code=404, detail="Resultados de outliers no encontrados")
        
        # Cargar datos
        df = load_data_with_outliers(dataset_info, outlier_results)
        variable_types = dataset_info.get("variable_types", {})
        
        # Ejecutar validación de clustering
        results = analysis_viz.run_clustering_validation(df, variable_types, variables)
        
        if "error" in results:
            raise HTTPException(status_code=400, detail=results["error"])
        
        return {"success": True, "validation_results": results}
        
    except Exception as e:
        print(f"Error obteniendo resultados de validación: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import signal
    import sys
    
    # Manejar señales de interrupción (Ctrl+C)
    def signal_handler(sig, frame):
        print("\n\n⚠️  Señal de interrupción recibida. Cerrando servidor...")
        # Intentar terminar procesos de pruebas de carga activos
        for load_test_id, run_info in list(load_test_runs.items()):
            if run_info.get('status') == 'running':
                print(f"   Deteniendo prueba de carga {load_test_id[:8]}...")
                run_info['status'] = 'stopping'
        
        # Intentar terminar pruebas funcionales activas
        for test_run_id, run_info in list(test_runs.items()):
            if run_info.get('status') == 'running':
                print(f"   Deteniendo prueba funcional {test_run_id[:8]}...")
                run_info['status'] = 'stopping'
        
        print("✅ Servidor cerrado correctamente")
        sys.exit(0)
    
    # Registrar manejadores de señales
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # En Windows, también manejar CTRL_BREAK_EVENT
    if sys.platform == "win32":
        try:
            import win32api
            win32api.SetConsoleCtrlHandler(signal_handler, True)
        except ImportError:
            pass
    
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        signal_handler(None, None) 

