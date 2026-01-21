# Lógica de la Fase 1
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import json
import os
import math
import time
import chardet
import logging
import shutil
from datetime import datetime
from pathlib import Path

# Configurar logger para este módulo
logger = logging.getLogger(__name__)

# Versión del esquema de datos
DATA_SCHEMA_VERSION = "1.0"

# Esquema de validación para datasets
DATASET_SCHEMA = {
    "type": "object",
    "properties": {
        "filename": {"type": "string"},
        "file_path": {"type": "string"},
        "upload_date": {"type": "string"},
        "variable_types": {"type": "object"},
        "summary_statistics": {"type": "object"},
        "total_rows": {"type": "integer"},
        "total_columns": {"type": "integer"}
    },
    "required": ["filename", "file_path"]
}

class DataProcessor:
    """
    Clase para el procesamiento de datos con optimizaciones de rendimiento.
    
    Características de rendimiento:
    - Caché de DataFrames para evitar cargas repetidas
    - Paginación para datasets grandes
    - Validación de estadísticas para evitar recálculos innecesarios
    """
    
    def __init__(self, cache_dataframes: bool = True, max_cache_size_mb: int = 500, 
                 enable_backups: bool = True, max_backups: int = 10):
        """
        Inicializar procesador de datos.
        
        Args:
            cache_dataframes: Si True, mantiene DataFrames en memoria para acceso rápido.
            max_cache_size_mb: Tamaño máximo del caché en MB antes de limpiar.
            enable_backups: Si True, crea backups automáticos antes de guardar.
            max_backups: Número máximo de backups a mantener.
        """
        self.datasets = {}
        self.datasets_file = "data/datasets.json"
        self.backups_dir = "data/backups"
        self.enable_backups = enable_backups
        self.max_backups = max_backups
        
        # Crear directorio de backups si no existe
        if self.enable_backups:
            os.makedirs(self.backups_dir, exist_ok=True)
        
        self.load_datasets()
        
        # Sistema de caché para DataFrames
        self.cache_dataframes = cache_dataframes
        self.max_cache_size_mb = max_cache_size_mb
        self._dataframe_cache = {}  # {filename: DataFrame}
        self._cache_timestamps = {}  # {filename: timestamp} para invalidación
        self._statistics_cache = {}  # {filename: statistics} para evitar recálculos
    
    def validate_dataset_schema(self, dataset: Dict[str, Any]) -> bool:
        """
        Validar que un dataset cumple con el esquema esperado.
        
        Args:
            dataset: Diccionario con información del dataset
            
        Returns:
            True si el dataset es válido
            
        Raises:
            ValueError si el dataset no cumple con el esquema
        """
        # Validar campos requeridos
        if "filename" not in dataset:
            raise ValueError("Dataset debe tener campo 'filename'")
        if "file_path" not in dataset:
            raise ValueError("Dataset debe tener campo 'file_path'")
        
        # Validar tipos básicos
        if not isinstance(dataset["filename"], str):
            raise ValueError("Campo 'filename' debe ser string")
        if not isinstance(dataset["file_path"], str):
            raise ValueError("Campo 'file_path' debe ser string")
        
        # Validar que filename no esté vacío
        if not dataset["filename"].strip():
            raise ValueError("Campo 'filename' no puede estar vacío")
        
        return True
    
    def validate_all_datasets(self) -> Tuple[bool, List[str]]:
        """
        Validar todos los datasets cargados.
        
        Returns:
            Tupla con (todos_válidos, lista_errores)
        """
        errors = []
        for filename, dataset in self.datasets.items():
            try:
                self.validate_dataset_schema(dataset)
            except ValueError as e:
                errors.append(f"Dataset '{filename}': {str(e)}")
        
        return len(errors) == 0, errors
    
    def load_datasets(self):
        """Cargar datasets guardados con validación y recuperación de errores"""
        try:
            if os.path.exists(self.datasets_file):
                # Intentar cargar el archivo principal
                try:
                    with open(self.datasets_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # Validar versión del esquema si existe
                    schema_version = data.get("_schema_version", "0.0")
                    if schema_version != DATA_SCHEMA_VERSION:
                        logger.warning(
                            f"Versión de esquema diferente: {schema_version} vs {DATA_SCHEMA_VERSION}. "
                            "Intentando migración automática..."
                        )
                    
                    # Cargar datasets (excluir metadatos)
                    self.datasets = {k: v for k, v in data.items() if not k.startswith("_")}
                    
                    # Validar todos los datasets
                    all_valid, errors = self.validate_all_datasets()
                    if not all_valid:
                        logger.warning(f"Errores de validación encontrados: {errors}")
                        # Intentar recuperar desde backup si hay errores
                        if self.enable_backups:
                            logger.info("Intentando recuperar desde backup...")
                            if self.restore_from_backup():
                                logger.info("Recuperación desde backup exitosa")
                                return
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Error de sintaxis JSON en {self.datasets_file}: {e}")
                    # Intentar recuperar desde backup
                    if self.enable_backups:
                        logger.info("Archivo JSON corrupto. Intentando recuperar desde backup...")
                        if self.restore_from_backup():
                            logger.info("Recuperación desde backup exitosa")
                            return
                    # Si no hay backup, inicializar vacío
                    self.datasets = {}
                    raise
            else:
                self.datasets = {}
                
        except Exception as e:
            logger.error(f"Error cargando datasets: {str(e)}")
            self.datasets = {}
    
    def create_backup(self) -> Optional[str]:
        """
        Crear backup del archivo de datasets antes de modificar.
        
        Returns:
            Ruta del archivo de backup creado, o None si falla
        """
        if not self.enable_backups or not os.path.exists(self.datasets_file):
            return None
        
        try:
            # Crear nombre de backup con timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"datasets_backup_{timestamp}.json"
            backup_path = os.path.join(self.backups_dir, backup_filename)
            
            # Copiar archivo
            shutil.copy2(self.datasets_file, backup_path)
            
            
            # Limpiar backups antiguos
            self._cleanup_old_backups()
            
            return backup_path
        except Exception as e:
            logger.error(f"Error creando backup: {e}")
            return None
    
    def _cleanup_old_backups(self):
        """Eliminar backups antiguos manteniendo solo los más recientes"""
        try:
            backup_files = []
            for filename in os.listdir(self.backups_dir):
                if filename.startswith("datasets_backup_") and filename.endswith(".json"):
                    filepath = os.path.join(self.backups_dir, filename)
                    backup_files.append((filepath, os.path.getmtime(filepath)))
            
            # Ordenar por fecha de modificación (más reciente primero)
            backup_files.sort(key=lambda x: x[1], reverse=True)
            
            # Eliminar backups antiguos
            if len(backup_files) > self.max_backups:
                for filepath, _ in backup_files[self.max_backups:]:
                    try:
                        os.remove(filepath)
                    except Exception as e:
                        logger.warning(f"Error eliminando backup antiguo {filepath}: {e}")
        except Exception as e:
            logger.warning(f"Error limpiando backups antiguos: {e}")
    
    def restore_from_backup(self) -> bool:
        """
        Restaurar desde el backup más reciente.
        
        Returns:
            True si la restauración fue exitosa
        """
        try:
            backup_files = []
            for filename in os.listdir(self.backups_dir):
                if filename.startswith("datasets_backup_") and filename.endswith(".json"):
                    filepath = os.path.join(self.backups_dir, filename)
                    backup_files.append((filepath, os.path.getmtime(filepath)))
            
            if not backup_files:
                logger.warning("No se encontraron backups para restaurar")
                return False
            
            # Obtener el backup más reciente
            backup_files.sort(key=lambda x: x[1], reverse=True)
            latest_backup = backup_files[0][0]
            
            # Restaurar
            shutil.copy2(latest_backup, self.datasets_file)
            logger.info(f"Restaurado desde backup: {latest_backup}")
            
            # Recargar datasets
            self.load_datasets()
            return True
        except Exception as e:
            logger.error(f"Error restaurando desde backup: {e}")
            return False
    
    def save_datasets(self):
        """
        Guardar datasets con escritura atómica, validación y backup automático.
        
        Este método implementa:
        1. Validación de esquema antes de guardar
        2. Backup automático antes de escribir
        3. Escritura atómica (escribe a archivo temporal y luego renombra)
        4. Validación del archivo guardado
        """
        try:
            # Validar todos los datasets antes de guardar
            all_valid, errors = self.validate_all_datasets()
            if not all_valid:
                error_msg = "Errores de validación antes de guardar:\n" + "\n".join(errors)
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # Crear backup antes de modificar
            if self.enable_backups:
                self.create_backup()
            
            # Asegurar que el directorio existe
            os.makedirs(os.path.dirname(self.datasets_file), exist_ok=True)
            
            # Preparar datos con metadatos de versión
            data_to_save = {
                "_schema_version": DATA_SCHEMA_VERSION,
                "_last_modified": datetime.now().isoformat(),
                **self.datasets
            }
            
            # Escritura atómica: escribir a archivo temporal primero
            temp_file = self.datasets_file + ".tmp"
            
            try:
                # Escribir a archivo temporal
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(data_to_save, f, ensure_ascii=False, indent=2, default=str)
                
                # Validar que el archivo temporal es JSON válido
                with open(temp_file, 'r', encoding='utf-8') as f:
                    json.load(f)  # Si hay error, lanzará excepción
                
                # Si todo está bien, reemplazar el archivo original
                # En Windows, necesitamos eliminar el archivo original primero
                if os.path.exists(self.datasets_file):
                    os.remove(self.datasets_file)
                
                # Renombrar archivo temporal a archivo final
                os.rename(temp_file, self.datasets_file)
                
                
            except Exception as e:
                # Si hay error, eliminar archivo temporal y restaurar desde backup
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except:
                        pass
                
                logger.error(f"Error durante escritura atómica: {e}")
                
                # Intentar restaurar desde backup si existe
                if self.enable_backups:
                    logger.info("Intentando restaurar desde backup...")
                    if self.restore_from_backup():
                        logger.info("Restauración exitosa")
                    else:
                        raise
                else:
                    raise
                
        except Exception as e:
            logger.error(f"Error guardando datasets: {str(e)}")
            raise e
    
    def safe_float(self, value):
        """Convertir valor a float de forma segura, manejando NaN"""
        if pd.isna(value) or value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def safe_preview_data(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convertir DataFrame a lista de diccionarios de forma segura, manejando NaN"""
        preview_data = []
        for _, row in df.iterrows():
            safe_row = {}
            for column, value in row.items():
                if pd.isna(value) or value is None or (isinstance(value, float) and math.isnan(value)):
                    safe_row[column] = None
                else:
                    # Convertir a string para evitar problemas de serialización
                    safe_row[column] = str(value)
            preview_data.append(safe_row)
        return preview_data
    
    def clean_for_json(self, obj):
        """Limpiar objeto para serialización JSON segura"""
        if isinstance(obj, dict):
            return {key: self.clean_for_json(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.clean_for_json(item) for item in obj]
        elif pd.isna(obj) or obj is None or (isinstance(obj, float) and math.isnan(obj)):
            return None
        elif isinstance(obj, (int, float, str, bool)):
            return obj
        else:
            return str(obj)
    
    def clean_dataframe_for_json(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convertir DataFrame a lista de diccionarios limpiando valores NaN para JSON"""
        records = df.to_dict('records')
        return [self.clean_for_json(record) for record in records]
    
    def classify_variable_type(self, series: pd.Series) -> str:
        """Clasificar el tipo de variable según metodología estadística"""
        # Verificar si es numérico
        if pd.api.types.is_numeric_dtype(series):
            # Verificar si es discreto (valores únicos limitados)
            unique_ratio = len(series.unique()) / len(series)
            if unique_ratio < 0.1:  # Menos del 10% de valores únicos
                return "cuantitativa_discreta"
            else:
                return "cuantitativa_continua"
        else:
            # Verificar si es binario
            if len(series.unique()) == 2:
                return "cualitativa_nominal_binaria"
            else:
                return "cualitativa_nominal"
    
    def detect_file_encoding(self, file_path: str, sample_size: int = 10000) -> str:
        """
        Detecta el encoding de un archivo CSV.
        
        Args:
            file_path: Ruta al archivo CSV.
            sample_size: Número de bytes a leer para detectar encoding.
        
        Returns:
            Nombre del encoding detectado (ej: 'utf-8', 'latin-1', 'cp1252').
        
        Note:
            Si la detección falla, retorna 'utf-8' como fallback.
        """
        try:
            with open(file_path, 'rb') as f:
                sample = f.read(sample_size)
            
            result = chardet.detect(sample)
            encoding = result.get('encoding', 'utf-8')
            confidence = result.get('confidence', 0)
            
            # Si la confianza es muy baja, usar utf-8 como fallback
            if confidence < 0.5:
                logger.warning(
                    f"Confianza baja en detección de encoding ({confidence:.2%}). Usando utf-8 como fallback.",
                    extra={'file_path': file_path, 'detected_encoding': encoding, 'confidence': confidence}
                )
                return 'utf-8'
            
            return encoding
        except Exception as e:
            logger.warning(
                f"Error detectando encoding para '{file_path}': {str(e)}. Usando utf-8 como fallback.",
                extra={'file_path': file_path, 'error': str(e)}
            )
            return 'utf-8'
    
    def validate_file_integrity(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Valida la integridad de un archivo antes de procesarlo.
        
        Args:
            file_path: Ruta al archivo.
            filename: Nombre del archivo.
        
        Returns:
            Diccionario con resultado de la validación:
                - valid: bool indicando si el archivo es válido
                - errors: Lista de errores encontrados
                - warnings: Lista de advertencias
        """
        errors = []
        warnings = []
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            errors.append(f"El archivo no existe: {file_path}")
            return {"valid": False, "errors": errors, "warnings": warnings}
        
        # Verificar que el archivo no esté vacío
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            errors.append("El archivo está vacío")
            return {"valid": False, "errors": errors, "warnings": warnings}
        
        # Verificar tamaño mínimo (al menos algunos bytes)
        if file_size < 10:
            warnings.append("El archivo es muy pequeño, puede estar incompleto")
        
        # Verificar extensión
        if filename.endswith('.csv'):
            # Intentar leer las primeras líneas para validar formato CSV
            try:
                with open(file_path, 'rb') as f:
                    first_bytes = f.read(1000)
                    # Verificar que tenga contenido legible
                    if len(first_bytes) == 0:
                        errors.append("El archivo CSV está vacío o corrupto")
            except Exception as e:
                errors.append(f"Error leyendo archivo CSV: {str(e)}")
        
        elif filename.endswith(('.xlsx', '.xls')):
            # Para Excel, validar que sea un archivo ZIP válido (xlsx) o formato OLE (xls)
            try:
                if filename.endswith('.xlsx'):
                    import zipfile
                    with zipfile.ZipFile(file_path, 'r') as zip_file:
                        # Verificar que tenga la estructura básica de Excel
                        if 'xl/workbook.xml' not in zip_file.namelist():
                            errors.append("El archivo Excel no tiene la estructura esperada")
                # Para .xls, la validación se hace al intentar leerlo
            except zipfile.BadZipFile:
                errors.append("El archivo Excel está corrupto o no es un archivo ZIP válido")
            except Exception as e:
                errors.append(f"Error validando archivo Excel: {str(e)}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    def process_dataset(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Procesar un dataset y extraer información con validaciones robustas.
        
        Este método se usa solo durante la carga inicial del dataset.
        Para acceder a datasets ya cargados, usar get_dataframe().
        
        Args:
            file_path: Ruta al archivo del dataset.
            filename: Nombre del archivo.
        
        Returns:
            Diccionario con información del dataset procesado.
        
        Raises:
            ValueError: Si el archivo no es válido o está corrupto.
            Exception: Si ocurre un error durante el procesamiento.
        """
        try:
            # Validar integridad del archivo
            logger.info(f"Validando integridad del archivo '{filename}'", extra={'filename': filename, 'file_path': file_path})
            integrity_check = self.validate_file_integrity(file_path, filename)
            
            if not integrity_check["valid"]:
                error_msg = f"Archivo inválido o corrupto: {', '.join(integrity_check['errors'])}"
                logger.error(error_msg, extra={'filename': filename, 'errors': integrity_check['errors']})
                raise ValueError(error_msg)
            
            # Mostrar advertencias si las hay
            if integrity_check["warnings"]:
                for warning in integrity_check["warnings"]:
                    logger.warning(f"Advertencia para '{filename}': {warning}", extra={'filename': filename, 'warning': warning})
            
            # Leer dataset con detección de encoding para CSV
            logger.info(f"Cargando dataset '{filename}'", extra={'filename': filename})
            
            if filename.endswith('.csv'):
                # Detectar encoding automáticamente
                encoding = self.detect_file_encoding(file_path)
                logger.info(f"Usando encoding '{encoding}' para '{filename}'", extra={'filename': filename, 'encoding': encoding})
                
                # Intentar cargar con el encoding detectado
                try:
                    df = pd.read_csv(file_path, encoding=encoding, on_bad_lines='skip', engine='python')
                except UnicodeDecodeError:
                    # Si falla, intentar con otros encodings comunes
                    logger.warning(
                        f"Error con encoding '{encoding}', intentando con otros encodings comunes",
                        extra={'filename': filename, 'failed_encoding': encoding}
                    )
                    for fallback_encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                        try:
                            df = pd.read_csv(file_path, encoding=fallback_encoding, on_bad_lines='skip', engine='python')
                            logger.info(f"Cargado exitosamente con encoding '{fallback_encoding}'", extra={'filename': filename, 'encoding': fallback_encoding})
                            break
                        except (UnicodeDecodeError, Exception):
                            continue
                    else:
                        raise ValueError(f"No se pudo determinar el encoding del archivo CSV '{filename}'. Intenta guardar el archivo en UTF-8.")
            else:
                # Para archivos Excel
                try:
                    df = pd.read_excel(file_path, engine='openpyxl' if filename.endswith('.xlsx') else None)
                except Exception as e:
                    # Intentar con engine alternativo si falla
                    logger.warning(
                        f"Error cargando Excel con engine por defecto, intentando alternativo: {str(e)}",
                        extra={'filename': filename, 'error': str(e)}
                    )
                    try:
                        df = pd.read_excel(file_path, engine='xlrd' if filename.endswith('.xls') else 'openpyxl')
                    except Exception as excel_error:
                        error_msg = f"Error cargando archivo Excel '{filename}': {str(excel_error)}. El archivo puede estar corrupto."
                        logger.error(error_msg, extra={'filename': filename, 'error': str(excel_error)}, exc_info=True)
                        raise ValueError(error_msg) from excel_error
            
            # Validar que el DataFrame no esté vacío
            if df.empty:
                error_msg = f"El archivo '{filename}' está vacío o no contiene datos válidos"
                logger.error(error_msg, extra={'filename': filename})
                raise ValueError(error_msg)
            
            # Validar que tenga columnas
            if len(df.columns) == 0:
                error_msg = f"El archivo '{filename}' no tiene columnas válidas"
                logger.error(error_msg, extra={'filename': filename})
                raise ValueError(error_msg)
            
            logger.info(
                f"Dataset '{filename}' cargado exitosamente: {len(df)} filas, {len(df.columns)} columnas",
                extra={'filename': filename, 'rows': len(df), 'columns': len(df.columns)}
            )
            
            # Clasificar variables - preservar tipos existentes si ya están guardados
            existing_variable_types = self.datasets.get(filename, {}).get('variable_types', {})
            variable_types = {}
            
            for column in df.columns:
                # Si ya existe un tipo guardado para esta columna, usarlo
                if column in existing_variable_types:
                    variable_types[column] = existing_variable_types[column]
                else:
                    # Si no existe, clasificar automáticamente
                    variable_types[column] = self.classify_variable_type(df[column])
            
            # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
            if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
                variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            
            # Crear información del dataset
            dataset_info = {
                "filename": filename,
                "file_path": file_path,
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": list(df.columns),
                "variable_types": variable_types,
                "preview": self.safe_preview_data(df.head(10)),
                "uploaded_at": pd.Timestamp.now().isoformat(),
                "summary_stats": self.get_summary_statistics(df, variable_types, filename=filename)
            }
            
            # Guardar DataFrame en caché si está habilitado
            if self.cache_dataframes:
                self._update_cache(filename, df)
            
            # Limpiar para JSON antes de retornar
            return self.clean_for_json(dataset_info)
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error procesando dataset '{filename}': {str(e)}"
            logger.error(error_msg, extra={'filename': filename, 'file_path': file_path, 'error': str(e)}, exc_info=True)
            raise Exception(error_msg) from e
    
    def get_summary_statistics(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                              filename: str = None, force_recalculate: bool = False) -> Dict[str, Any]:
        """
        Obtener estadísticas descriptivas según el tipo de variable.
        
        Implementa caché para evitar recálculos innecesarios.
        
        Args:
            df: DataFrame con los datos.
            variable_types: Diccionario con tipos de variables.
            filename: Nombre del archivo (opcional, para usar caché).
            force_recalculate: Si True, fuerza el recálculo incluso si hay caché.
        
        Returns:
            Diccionario con estadísticas por variable.
        """
        # Verificar caché si hay filename y no se fuerza recálculo
        if filename and not force_recalculate and filename in self._statistics_cache:
            cached_stats = self._statistics_cache[filename]
            # Verificar que las variables coinciden
            if set(cached_stats.keys()) == set(variable_types.keys()):
                return cached_stats.copy()
        
        summary = {}
        
        print(f"Procesando estadísticas para {len(variable_types)} variables")
        print(f"Columnas disponibles en DataFrame: {list(df.columns)}")
        
        for column, var_type in variable_types.items():
            try:
                print(f"Procesando columna: {column}, tipo: {var_type}")
                
                # Verificar que la columna existe en el DataFrame
                if column not in df.columns:
                    print(f"Advertencia: Columna {column} no existe en el DataFrame")
                    summary[column] = {
                        "type": var_type,
                        "error": f"Columna {column} no encontrada en el dataset",
                        "missing_values": 0,
                        "unique_values": 0
                    }
                    continue
                
                if var_type in ["cuantitativa_continua", "cuantitativa_discreta"]:
                    # Obtener estadísticas de forma segura
                    mean_val = self.safe_float(df[column].mean())
                    median_val = self.safe_float(df[column].median())
                    std_val = self.safe_float(df[column].std())
                    min_val = self.safe_float(df[column].min())
                    max_val = self.safe_float(df[column].max())
                    
                    summary[column] = {
                        "type": var_type,
                        "mean": mean_val,
                        "median": median_val,
                        "std": std_val,
                        "min": min_val,
                        "max": max_val,
                        "missing_values": int(df[column].isna().sum()),
                        "unique_values": int(df[column].nunique())
                    }
                else:
                    # Para variables cualitativas
                    mode_result = df[column].mode()
                    most_common = mode_result.iloc[0] if not mode_result.empty else None
                    
                    # Convertir frequency_table a valores serializables
                    freq_table = df[column].value_counts().head(10)
                    freq_dict = {}
                    for key, value in freq_table.items():
                        # Asegurar que la clave sea string y el valor sea int
                        freq_dict[str(key)] = int(value)
                    
                    summary[column] = {
                        "type": var_type,
                        "unique_values": int(df[column].nunique()),
                        "missing_values": int(df[column].isna().sum()),
                        "most_common": str(most_common) if most_common is not None else None,
                        "frequency_table": freq_dict
                    }
                
                print(f"Estadísticas completadas para columna: {column}")
                
            except Exception as e:
                print(f"Error procesando columna {column}: {str(e)}")
                # Si hay error con una columna, crear estadísticas básicas
                summary[column] = {
                    "type": var_type,
                    "error": f"Error procesando columna: {str(e)}",
                    "missing_values": int(df[column].isna().sum()) if column in df.columns else 0,
                    "unique_values": int(df[column].nunique()) if column in df.columns else 0
                }
        
        print(f"Estadísticas completadas para {len(summary)} variables")
        
        # Guardar en caché si hay filename
        if filename:
            self._statistics_cache[filename] = summary.copy()
        
        return summary
    
    def update_variable_types(self, filename: str, variable_types: Dict[str, str]) -> Dict[str, Any]:
        """Actualizar tipos de variables de un dataset"""
        if filename not in self.datasets:
            raise Exception("Dataset no encontrado")
        
        try:
            # Cargar dataset usando método centralizado
            df = self.get_dataframe(filename)
            
            # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
            if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
                variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            
            # Verificar que todas las columnas en variable_types existen en el dataset
            missing_columns = [col for col in variable_types.keys() if col not in df.columns]
            if missing_columns:
                # Remover columnas que no existen en el dataset
                for col in missing_columns:
                    del variable_types[col]
            
            # Verificar que todas las columnas del dataset están en variable_types
            missing_types = [col for col in df.columns if col not in variable_types]
            if missing_types:
                for col in missing_types:
                    variable_types[col] = self.classify_variable_type(df[col])
            
            # Actualizar tipos de variables
            self.datasets[filename]["variable_types"] = variable_types
            
            # Recalcular estadísticas (forzar recálculo después de cambios)
            self.datasets[filename]["summary_stats"] = self.get_summary_statistics(df, variable_types, filename=filename, force_recalculate=True)
            
            # Guardar cambios
            self.save_datasets()
            

            
            result = self.datasets[filename]
            print(f"Actualización completada exitosamente")
            return result
            
        except Exception as e:
            print(f"Error en update_variable_types: {str(e)}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Error actualizando tipos de variables: {str(e)}")
    
    def get_dataframe(self, filename: str, use_cache: bool = True) -> pd.DataFrame:
        """
        Obtiene el DataFrame de un dataset cargado con sistema de caché.
        
        Este método centraliza la lógica de carga de datasets desde archivos.
        Todos los módulos deben usar este método en lugar de cargar archivos directamente.
        
        Args:
            filename: Nombre del archivo del dataset (debe estar registrado en self.datasets).
            use_cache: Si True, usa el caché si está disponible. Si False, fuerza recarga.
        
        Returns:
            DataFrame de pandas con los datos del dataset.
        
        Raises:
            ValueError: Si el dataset no se encuentra en self.datasets.
            Exception: Si ocurre un error al cargar el archivo.
        
        Note:
            Este método debe ser el único punto de entrada para cargar datasets desde archivos.
            Evita duplicación de código y centraliza el manejo de errores.
            Implementa caché para mejorar rendimiento en accesos repetidos.
        """
        if filename not in self.datasets:
            available = list(self.datasets.keys())
            error_msg = (
                f"Dataset '{filename}' no encontrado. Datasets disponibles: {available}"
            )
            raise ValueError(error_msg)
        
        # Verificar caché si está habilitado
        if use_cache and self.cache_dataframes and filename in self._dataframe_cache:
            return self._dataframe_cache[filename].copy()
        
        file_path = self.datasets[filename]["file_path"]
        
        try:
            if file_path.endswith('.csv'):
                # Detectar encoding para CSV
                encoding = self.detect_file_encoding(file_path)
                try:
                    df = pd.read_csv(file_path, encoding=encoding, on_bad_lines='skip', engine='python')
                except UnicodeDecodeError:
                    # Fallback a otros encodings comunes
                    logger.warning(
                        f"Error con encoding '{encoding}' para '{filename}', intentando fallbacks",
                        extra={'filename': filename, 'encoding': encoding}
                    )
                    for fallback_encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                        try:
                            df = pd.read_csv(file_path, encoding=fallback_encoding, on_bad_lines='skip', engine='python')
                            break
                        except (UnicodeDecodeError, Exception):
                            continue
                    else:
                        raise ValueError(f"No se pudo determinar el encoding del archivo CSV '{filename}'")
            else:
                # Para archivos Excel
                try:
                    df = pd.read_excel(file_path, engine='openpyxl' if file_path.endswith('.xlsx') else None)
                except Exception as e:
                    # Intentar con engine alternativo
                    logger.warning(
                        f"Error cargando Excel '{filename}' con engine por defecto: {str(e)}",
                        extra={'filename': filename, 'error': str(e)}
                    )
                    try:
                        df = pd.read_excel(file_path, engine='xlrd' if file_path.endswith('.xls') else 'openpyxl')
                    except Exception as excel_error:
                        error_msg = f"Error cargando archivo Excel '{filename}': {str(excel_error)}. El archivo puede estar corrupto."
                        logger.error(error_msg, extra={'filename': filename, 'error': str(excel_error)}, exc_info=True)
                        raise ValueError(error_msg) from excel_error
            
            # Validar que el DataFrame no esté vacío
            if df.empty:
                raise ValueError(f"El archivo '{filename}' está vacío o no contiene datos válidos")
            
            # Guardar en caché si está habilitado
            if self.cache_dataframes:
                self._update_cache(filename, df)
            
            return df
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error cargando archivo del dataset '{filename}' desde '{file_path}': {str(e)}"
            logger.error(error_msg, extra={'filename': filename, 'file_path': file_path, 'error': str(e)}, exc_info=True)
            raise Exception(error_msg) from e
    
    def get_dataframe_paginated(self, filename: str, page: int = 1, page_size: int = 1000) -> Dict[str, Any]:
        """
        Obtiene una página del DataFrame para datasets grandes.
        
        Args:
            filename: Nombre del archivo del dataset.
            page: Número de página (empezando en 1).
            page_size: Número de filas por página.
        
        Returns:
            Diccionario con:
                - data: Lista de diccionarios con los datos de la página
                - total_rows: Total de filas en el dataset
                - total_pages: Total de páginas
                - current_page: Página actual
                - page_size: Tamaño de página
        """
        df = self.get_dataframe(filename, use_cache=True)
        total_rows = len(df)
        total_pages = (total_rows + page_size - 1) // page_size
        
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        page_df = df.iloc[start_idx:end_idx]
        
        return {
            "data": self.safe_preview_data(page_df),
            "total_rows": total_rows,
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size
        }
    
    def _update_cache(self, filename: str, df: pd.DataFrame):
        """
        Actualiza el caché de DataFrames, limpiando si es necesario.
        
        Args:
            filename: Nombre del archivo.
            df: DataFrame a guardar en caché.
        """
        # Calcular tamaño aproximado del DataFrame en MB
        df_size_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
        
        # Si el caché es muy grande, limpiar el más antiguo
        if self._dataframe_cache:
            total_cache_size = sum(
                cached_df.memory_usage(deep=True).sum() / (1024 * 1024)
                for cached_df in self._dataframe_cache.values()
            )
            
            if total_cache_size + df_size_mb > self.max_cache_size_mb:
                # Eliminar el más antiguo
                oldest = min(self._cache_timestamps.items(), key=lambda x: x[1])
                if oldest[0] in self._dataframe_cache:
                    del self._dataframe_cache[oldest[0]]
                    del self._cache_timestamps[oldest[0]]
                    if oldest[0] in self._statistics_cache:
                        del self._statistics_cache[oldest[0]]
        
        # Guardar en caché
        self._dataframe_cache[filename] = df
        self._cache_timestamps[filename] = time.time()
    
    def clear_cache(self, filename: str = None):
        """
        Limpia el caché de DataFrames.
        
        Args:
            filename: Si se especifica, solo limpia ese dataset. Si es None, limpia todo.
        """
        if filename:
            self._dataframe_cache.pop(filename, None)
            self._cache_timestamps.pop(filename, None)
            self._statistics_cache.pop(filename, None)
        else:
            self._dataframe_cache.clear()
            self._cache_timestamps.clear()
            self._statistics_cache.clear()
    
    def get_dataset_preview(self, filename: str, rows: int = 10) -> List[Dict[str, Any]]:
        """
        Obtener vista previa de un dataset.
        
        Optimizado para usar caché y solo cargar las filas necesarias.
        
        Args:
            filename: Nombre del archivo del dataset.
            rows: Número de filas a mostrar.
        
        Returns:
            Lista de diccionarios con los datos de la vista previa.
        """
        df = self.get_dataframe(filename, use_cache=True)
        return self.safe_preview_data(df.head(rows))

    # Preprocessing methods
    def preprocess_missing_values(self, filename: str, strategy: str, constant_value: str = None) -> Dict[str, Any]:
        """
        Procesar valores faltantes en un dataset con estrategia explícita del usuario.
        
        IMPORTANTE: Este método aplica estrategias de manejo de valores faltantes
        SOLO cuando el usuario lo solicita explícitamente. Todas las acciones se
        documentan claramente para transparencia en publicaciones científicas.
        
        Args:
            filename: Nombre del archivo del dataset a procesar.
            strategy: Estrategia a aplicar. Opciones:
                - "drop": Eliminar filas con valores faltantes
                - "fill_mean": Imputar con media (solo columnas numéricas)
                - "fill_median": Imputar con mediana (solo columnas numéricas)
                - "fill_mode": Imputar con moda (solo columnas categóricas)
                - "fill_constant": Imputar con valor constante (requiere constant_value)
            constant_value: Valor constante para imputación (solo si strategy="fill_constant").
        
        Returns:
            Diccionario con información del dataset procesado, incluyendo:
                - missing_values_info: Información detallada sobre valores faltantes procesados
                - strategy_applied: Estrategia aplicada
                - rows_before: Número de filas antes del procesamiento
                - rows_after: Número de filas después del procesamiento
                - missing_values_by_column: Conteo de valores faltantes por columna antes del procesamiento
        
        Note:
            - Esta es una acción EXPLÍCITA del usuario/investigador.
            - Todas las acciones se documentan para transparencia en publicaciones.
            - Se recomienda documentar la estrategia utilizada en la metodología del estudio.
        
        Raises:
            ValueError: Si la estrategia no es válida o falta constant_value cuando se requiere.
            Exception: Si el dataset no se encuentra o ocurre un error durante el procesamiento.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        if filename not in self.datasets:
            raise ValueError(f"Dataset '{filename}' no encontrado")
        
        # Validar estrategia
        valid_strategies = ["drop", "fill_mean", "fill_median", "fill_mode", "fill_constant"]
        if strategy not in valid_strategies:
            raise ValueError(
                f"Estrategia '{strategy}' no válida. Estrategias válidas: {valid_strategies}"
            )
        
        if strategy == "fill_constant" and constant_value is None:
            raise ValueError(
                "Se requiere 'constant_value' cuando strategy='fill_constant'"
            )
        
        try:
            # Cargar dataset usando método centralizado
            df = self.get_dataframe(filename)
            
            original_rows = len(df)
            original_missing = df.isnull().sum().sum()
            
            # Contar valores faltantes por columna antes del procesamiento
            missing_by_column = df.isnull().sum().to_dict()
            missing_by_column = {k: int(v) for k, v in missing_by_column.items() if v > 0}
            
            logger.info(
                f"Procesando valores faltantes para '{filename}' con estrategia '{strategy}'",
                extra={
                    'filename': filename,
                    'strategy': strategy,
                    'original_rows': original_rows,
                    'original_missing': int(original_missing),
                    'missing_by_column': missing_by_column
                }
            )
            
            # Aplicar estrategia de valores faltantes
            if strategy == "drop":
                df = df.dropna()
                rows_removed = original_rows - len(df)
                logger.info(
                    f"Eliminadas {rows_removed} filas con valores faltantes",
                    extra={'rows_removed': rows_removed}
                )
            elif strategy == "fill_mean":
                numeric_columns = df.select_dtypes(include=[np.number]).columns
                imputed_counts = {}
                for col in numeric_columns:
                    missing_count = df[col].isnull().sum()
                    if missing_count > 0:
                        mean_value = df[col].mean()
                        df[col] = df[col].fillna(mean_value)
                        imputed_counts[col] = {
                            'count': int(missing_count),
                            'imputed_value': float(mean_value),
                            'method': 'mean'
                        }
                logger.info(
                    f"Imputados valores faltantes con media en {len(imputed_counts)} columnas",
                    extra={'imputed_counts': imputed_counts}
                )
            elif strategy == "fill_median":
                numeric_columns = df.select_dtypes(include=[np.number]).columns
                imputed_counts = {}
                for col in numeric_columns:
                    missing_count = df[col].isnull().sum()
                    if missing_count > 0:
                        median_value = df[col].median()
                        df[col] = df[col].fillna(median_value)
                        imputed_counts[col] = {
                            'count': int(missing_count),
                            'imputed_value': float(median_value),
                            'method': 'median'
                        }
                logger.info(
                    f"Imputados valores faltantes con mediana en {len(imputed_counts)} columnas",
                    extra={'imputed_counts': imputed_counts}
                )
            elif strategy == "fill_mode":
                imputed_counts = {}
                for col in df.columns:
                    if df[col].dtype == 'object':
                        missing_count = df[col].isnull().sum()
                        if missing_count > 0:
                            mode_value = df[col].mode()
                            if not mode_value.empty:
                                mode_val = mode_value.iloc[0]
                                df[col] = df[col].fillna(mode_val)
                                imputed_counts[col] = {
                                    'count': int(missing_count),
                                    'imputed_value': str(mode_val),
                                    'method': 'mode'
                                }
                logger.info(
                    f"Imputados valores faltantes con moda en {len(imputed_counts)} columnas",
                    extra={'imputed_counts': imputed_counts}
                )
            elif strategy == "fill_constant" and constant_value is not None:
                df = df.fillna(constant_value)
                logger.info(
                    f"Imputados todos los valores faltantes con constante '{constant_value}'",
                    extra={'constant_value': str(constant_value)}
                )
            
            processed_rows = len(df)
            final_missing = df.isnull().sum().sum()
            
            # Preparar información detallada sobre el procesamiento
            missing_info = {
                'strategy_applied': strategy,
                'rows_before': original_rows,
                'rows_after': processed_rows,
                'rows_removed': original_rows - processed_rows if strategy == "drop" else 0,
                'missing_values_before': int(original_missing),
                'missing_values_after': int(final_missing),
                'missing_values_by_column_before': missing_by_column,
                'constant_value_used': constant_value if strategy == "fill_constant" else None
            }
            
            # Actualizar dataset
            self.datasets[filename]["rows"] = processed_rows
            self.datasets[filename]["preview"] = self.safe_preview_data(df.head(10))
            self.datasets[filename]["missing_values_info"] = missing_info
            
            # Recalcular estadísticas
            variable_types = self.datasets[filename].get("variable_types", {})
            self.datasets[filename]["summary_stats"] = self.get_summary_statistics(
                df, variable_types, filename=filename
            )
            
            # Guardar cambios
            self.save_datasets()
            
            result = self.datasets[filename].copy()
            result['missing_values_info'] = missing_info
            
            logger.info(
                f"Procesamiento de valores faltantes completado para '{filename}'",
                extra={'filename': filename, 'missing_info': missing_info}
            )
            
            return result
            
        except ValueError:
            # Re-lanzar ValueError sin modificar
            raise
        except Exception as e:
            error_msg = f"Error procesando valores faltantes para dataset '{filename}': {str(e)}"
            logger.error(
                error_msg,
                extra={'filename': filename, 'strategy': strategy, 'error': str(e)},
                exc_info=True
            )
            raise Exception(error_msg) from e

    def preprocess_duplicates(self, filename: str, strategy: str) -> Dict[str, Any]:
        """Procesar duplicados en un dataset"""
        print(f"Procesando duplicados para {filename} con estrategia: {strategy}")
        
        if filename not in self.datasets:
            raise Exception("Dataset no encontrado")
        
        try:
            # Cargar dataset usando método centralizado
            df = self.get_dataframe(filename)
            
            original_rows = len(df)
            print(f"Dataset original: {original_rows} filas")
            
            # Aplicar estrategia de duplicados
            if strategy == "drop":
                df = df.drop_duplicates()
            elif strategy == "keep_first":
                df = df.drop_duplicates(keep='first')
            elif strategy == "keep_last":
                df = df.drop_duplicates(keep='last')
            
            processed_rows = len(df)
            print(f"Dataset procesado: {processed_rows} filas")
            
            # Actualizar dataset
            self.datasets[filename]["rows"] = processed_rows
            self.datasets[filename]["preview"] = self.safe_preview_data(df.head(10))
            
            # Recalcular estadísticas
            variable_types = self.datasets[filename].get("variable_types", {})
            self.datasets[filename]["summary_stats"] = self.get_summary_statistics(df, variable_types)
            
            # Guardar cambios
            self.save_datasets()
            
            result = self.datasets[filename]
            print(f"Procesamiento de duplicados completado")
            return result
            
        except Exception as e:
            print(f"Error en preprocess_duplicates: {str(e)}")
            raise Exception(f"Error procesando duplicados: {str(e)}")

    def preprocess_outliers(self, filename: str, method: str, strategy: str) -> Dict[str, Any]:
        """Procesar outliers en un dataset"""
        print(f"Procesando outliers para {filename} con método: {method}, estrategia: {strategy}")
        
        if filename not in self.datasets:
            raise Exception("Dataset no encontrado")
        
        try:
            # Cargar dataset usando método centralizado
            df = self.get_dataframe(filename)
            
            original_rows = len(df)
            print(f"Dataset original: {original_rows} filas")
            
            # Obtener columnas numéricas
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            
            if len(numeric_columns) == 0:
                print("No hay columnas numéricas para procesar outliers")
                return self.datasets[filename]
            
            # Aplicar detección y tratamiento de outliers
            for col in numeric_columns:
                if method == "iqr":
                    Q1 = df[col].quantile(0.25)
                    Q3 = df[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    if strategy == "remove":
                        df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
                    elif strategy == "cap":
                        df[col] = df[col].clip(lower=lower_bound, upper=upper_bound)
                    elif strategy == "transform":
                        df[col] = np.log1p(df[col] - df[col].min() + 1)
                
                elif method == "zscore":
                    z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                    
                    if strategy == "remove":
                        df = df[z_scores < 3]
                    elif strategy == "cap":
                        threshold = 3
                        df[col] = df[col].clip(
                            lower=df[col].mean() - threshold * df[col].std(),
                            upper=df[col].mean() + threshold * df[col].std()
                        )
                    elif strategy == "transform":
                        df[col] = np.log1p(df[col] - df[col].min() + 1)
            
            processed_rows = len(df)
            print(f"Dataset procesado: {processed_rows} filas")
            
            # Actualizar dataset
            self.datasets[filename]["rows"] = processed_rows
            self.datasets[filename]["preview"] = self.safe_preview_data(df.head(10))
            
            # Recalcular estadísticas
            variable_types = self.datasets[filename].get("variable_types", {})
            self.datasets[filename]["summary_stats"] = self.get_summary_statistics(df, variable_types)
            
            # Guardar cambios
            self.save_datasets()
            
            result = self.datasets[filename]
            print(f"Procesamiento de outliers completado")
            return result
            
        except Exception as e:
            print(f"Error en preprocess_outliers: {str(e)}")
            raise Exception(f"Error procesando outliers: {str(e)}")

    def preprocess_data_types(self, filename: str, action: str, conversion_params: Dict = None) -> Dict[str, Any]:
        """Procesar tipos de datos en un dataset"""
        print(f"Procesando tipos de datos para {filename} con acción: {action}")
        
        if filename not in self.datasets:
            raise Exception("Dataset no encontrado")
        
        try:
            # Cargar dataset usando método centralizado
            df = self.get_dataframe(filename)
            
            if action == "auto":
                # Detectar automáticamente tipos de variables solo para columnas que no tienen tipo asignado
                existing_variable_types = self.datasets[filename].get("variable_types", {})
                variable_types = existing_variable_types.copy()  # Preservar tipos existentes
                
                for column in df.columns:
                    # Solo clasificar automáticamente si no existe un tipo guardado
                    if column not in existing_variable_types:
                        variable_types[column] = self.classify_variable_type(df[column])
                
                # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
                if 'es_outlier' in df.columns and 'es_outlier' not in variable_types:
                    variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
                
                self.datasets[filename]["variable_types"] = variable_types
                self.datasets[filename]["summary_stats"] = self.get_summary_statistics(df, variable_types)
            
            elif action == "convert" and conversion_params:
                # Convertir tipo de datos de una variable específica
                variable = conversion_params.get("variable")
                target_type = conversion_params.get("target_type")
                
                if variable not in df.columns:
                    raise Exception(f"Variable '{variable}' no encontrada en el dataset")
                
                print(f"Convirtiendo variable '{variable}' a tipo '{target_type}'")
                
                if target_type == "numeric":
                    # Convertir a numérico
                    df[variable] = pd.to_numeric(df[variable], errors='coerce')
                elif target_type == "categorical":
                    # Convertir a categórico
                    df[variable] = df[variable].astype('category')
                elif target_type == "datetime":
                    # Convertir a datetime
                    df[variable] = pd.to_datetime(df[variable], errors='coerce')
                elif target_type == "boolean":
                    # Convertir a booleano
                    df[variable] = df[variable].astype(bool)
                
                # Reclasificar el tipo de variable después de la conversión
                variable_types = self.datasets[filename].get("variable_types", {})
                variable_types[variable] = self.classify_variable_type(df[variable])
                self.datasets[filename]["variable_types"] = variable_types
                
                # Recalcular estadísticas
                self.datasets[filename]["summary_stats"] = self.get_summary_statistics(df, variable_types)
                
                # Guardar el dataset modificado
                df.to_csv(file_path, index=False)
                print(f"Dataset guardado con conversión de tipo")
            
            # Guardar cambios
            self.save_datasets()
            
            result = self.datasets[filename]
            print(f"Procesamiento de tipos de datos completado")
            return result
            
        except Exception as e:
            print(f"Error en preprocess_data_types: {str(e)}")
            raise Exception(f"Error procesando tipos de datos: {str(e)}")

    def apply_all_preprocessing(self, filename: str, steps: List[Dict]) -> Dict[str, Any]:
        """Aplicar todos los cambios de preprocesamiento a una copia del dataset"""
        print(f"Aplicando todos los cambios de preprocesamiento para {filename}")
        
        if filename not in self.datasets:
            raise Exception("Dataset no encontrado")
        
        try:
            # Cargar dataset original usando método centralizado (sin modificar)
            df_original = self.get_dataframe(filename)
            
            # Crear una copia para procesar (el original permanece intacto)
            df_processed = df_original.copy()
            
            original_rows = len(df_original)
            print(f"Dataset original: {original_rows} filas")
            
            # Aplicar cada paso de preprocesamiento a la copia
            for step in steps:
                step_type = step.get("type")
                print(f"Aplicando paso: {step_type}")
                
                if step_type == "missing_values":
                    strategy = step.get("strategy", "drop")
                    constant_value = step.get("constant_value")
                    df_processed = self._apply_missing_values_strategy(df_processed, strategy, constant_value)
                
                elif step_type == "duplicates":
                    strategy = step.get("strategy", "drop")
                    df_processed = self._apply_duplicates_strategy(df_processed, strategy)
                
                elif step_type == "outliers":
                    method = step.get("method", "iqr")
                    strategy = step.get("strategy", "remove")
                    df_processed = self._apply_outliers_strategy(df_processed, method, strategy)
                
                elif step_type == "data_types":
                    action = step.get("action", "auto")
                    if action == "auto":
                        # Preservar tipos existentes y solo clasificar automáticamente los que no tienen tipo
                        existing_variable_types = self.datasets[filename].get("variable_types", {})
                        variable_types = existing_variable_types.copy()
                        
                        for column in df_processed.columns:
                            if column not in existing_variable_types:
                                variable_types[column] = self.classify_variable_type(df_processed[column])
                        
                        # Verificar si existe la columna es_outlier en el dataset pero no en variable_types
                        if 'es_outlier' in df_processed.columns and 'es_outlier' not in variable_types:
                            variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            
            processed_rows = len(df_processed)
            print(f"Dataset procesado: {processed_rows} filas")
            
            # Crear resultado con datos procesados (sin modificar el original)
            result = {
                "filename": filename,
                "rows": processed_rows,
                "columns": len(df_processed.columns),
                "preview": self.safe_preview_data(df_processed.head(10)),
                "processed_data": self.clean_dataframe_for_json(df_processed),  # Datos procesados para guardar (limpios para JSON)
                "processing_steps": steps,  # Pasos aplicados
                "original_rows": original_rows,  # Filas originales para comparación
                "rows_removed": original_rows - processed_rows  # Filas eliminadas
            }
            
            # Recalcular estadísticas para los datos procesados
            variable_types = self.datasets[filename].get("variable_types", {})
            result["summary_stats"] = self.get_summary_statistics(df_processed, variable_types)
            
            print(f"Aplicación de todos los cambios completada")
            return result
            
        except Exception as e:
            print(f"Error en apply_all_preprocessing: {str(e)}")
            raise Exception(f"Error aplicando todos los cambios: {str(e)}")

    def save_processed_dataset(self, original_filename: str, new_name: str, processed_data: Dict) -> Dict[str, Any]:
        """Guardar dataset procesado como archivo físico y en la base de datos"""
        print(f"Guardando dataset procesado: {new_name}")
        
        try:
            # Convertir los datos procesados de vuelta a DataFrame
            df_processed = pd.DataFrame(processed_data.get("processed_data", []))
            
            # Determinar la extensión del archivo original
            original_file_path = self.datasets[original_filename]["file_path"]
            file_extension = original_file_path.split('.')[-1].lower()
            
            # Crear nombre del archivo procesado
            if file_extension in ['csv', 'xlsx', 'xls']:
                new_file_path = f"uploads/{new_name}.{file_extension}"
            else:
                new_file_path = f"uploads/{new_name}.csv"
            
            # Guardar como archivo físico
            if new_file_path.endswith('.csv'):
                df_processed.to_csv(new_file_path, index=False)
            else:
                df_processed.to_excel(new_file_path, index=False)
            
            # Crear nuevo dataset con los datos procesados
            new_dataset = {
                "filename": f"{new_name}.{file_extension}" if file_extension in ['csv', 'xlsx', 'xls'] else f"{new_name}.csv",
                "file_path": new_file_path,
                "rows": processed_data.get("rows", len(df_processed)),
                "columns": processed_data.get("columns", len(df_processed.columns)),
                "uploaded_at": pd.Timestamp.now().isoformat(),
                "preview": self.safe_preview_data(df_processed.head(10)),
                "summary_stats": processed_data.get("summary_stats", {}),
                "variable_types": self.datasets[original_filename].get("variable_types", {}),
                "is_processed": True,  # Marcar como dataset procesado
                "original_dataset": original_filename,  # Referencia al dataset original
                "processing_steps": processed_data.get("processing_steps", []),  # Pasos aplicados
                "original_rows": processed_data.get("original_rows", 0),  # Filas originales
                "rows_removed": processed_data.get("rows_removed", 0)  # Filas eliminadas
            }
            
            # Guardar en la base de datos
            self.datasets[new_dataset["filename"]] = new_dataset
            self.save_datasets()
            
            print(f"Dataset procesado guardado: {new_dataset['filename']}")
            return new_dataset
            
        except Exception as e:
            print(f"Error en save_processed_dataset: {str(e)}")
            raise Exception(f"Error guardando dataset procesado: {str(e)}")

    # Helper methods for preprocessing
    def _apply_missing_values_strategy(self, df: pd.DataFrame, strategy: str, constant_value: str = None) -> pd.DataFrame:
        """Aplicar estrategia de valores faltantes"""
        if strategy == "drop":
            return df.dropna()
        elif strategy == "fill_mean":
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                df[col] = df[col].fillna(df[col].mean())
        elif strategy == "fill_median":
            numeric_columns = df.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                df[col] = df[col].fillna(df[col].median())
        elif strategy == "fill_mode":
            for col in df.columns:
                if df[col].dtype == 'object':
                    mode_value = df[col].mode()
                    if not mode_value.empty:
                        df[col] = df[col].fillna(mode_value.iloc[0])
        elif strategy == "fill_constant" and constant_value is not None:
            df = df.fillna(constant_value)
        
        return df

    def _apply_duplicates_strategy(self, df: pd.DataFrame, strategy: str) -> pd.DataFrame:
        """Aplicar estrategia de duplicados"""
        if strategy == "drop":
            return df.drop_duplicates()
        elif strategy == "keep_first":
            return df.drop_duplicates(keep='first')
        elif strategy == "keep_last":
            return df.drop_duplicates(keep='last')
        
        return df

    def _apply_outliers_strategy(self, df: pd.DataFrame, method: str, strategy: str) -> pd.DataFrame:
        """Aplicar estrategia de outliers"""
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            if method == "iqr":
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                if strategy == "remove":
                    df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
                elif strategy == "cap":
                    df[col] = df[col].clip(lower=lower_bound, upper=upper_bound)
                elif strategy == "transform":
                    df[col] = np.log1p(df[col] - df[col].min() + 1)
            
            elif method == "zscore":
                z_scores = np.abs((df[col] - df[col].mean()) / df[col].std())
                
                if strategy == "remove":
                    df = df[z_scores < 3]
                elif strategy == "cap":
                    threshold = 3
                    df[col] = df[col].clip(
                        lower=df[col].mean() - threshold * df[col].std(),
                        upper=df[col].mean() + threshold * df[col].std()
                    )
                elif strategy == "transform":
                    df[col] = np.log1p(df[col] - df[col].min() + 1)
        
        return df 
