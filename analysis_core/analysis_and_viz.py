# Lógica de Análisis y Visualización de Outliers
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import Dict, List, Any, Tuple
import json
from scipy import stats
from scipy.stats import mannwhitneyu, chi2_contingency
import warnings
warnings.filterwarnings('ignore')

class AnalysisAndVisualization:
    """Clase para análisis y visualización de outliers"""
    
    def __init__(self, data_processor=None):
        """
        Inicializar clase de análisis y visualización.
        
        Args:
            data_processor: Instancia opcional de DataProcessor para acceder a datasets.
                Si se proporciona, se usará para cargar datasets de forma centralizada.
        """
        self.data_processor = data_processor
    
    def _map_outlier_id_to_index(self, outlier_id: Any, df: pd.DataFrame, 
                                  subject_id_column: str = None) -> List[int]:
        """
        Mapea un ID de outlier a los índices del DataFrame correspondientes.
        
        Este método implementa la lógica de mapeo de forma robusta y predecible:
        1. Si hay subject_id_column, busca directamente en esa columna
        2. Si el ID es "ID_X", extrae el número X y lo usa como índice
        3. Si el ID es numérico, lo usa directamente como índice
        
        Args:
            outlier_id: ID del outlier a mapear (puede ser string, int, o float).
            df: DataFrame donde buscar el outlier.
            subject_id_column: Nombre de la columna que contiene los IDs de sujetos.
                Si es None, se intentará inferir del formato del ID.
        
        Returns:
            Lista de índices del DataFrame que corresponden al outlier_id.
            Lista vacía si no se encuentra ninguna coincidencia.
        """
        indices = []
        
        # Caso 1: Si hay subject_id_column, buscar directamente en esa columna
        if subject_id_column and subject_id_column in df.columns:
            # Convertir outlier_id a string para comparación
            outlier_id_str = str(outlier_id)
            
            # Buscar coincidencias exactas
            mask = df[subject_id_column].astype(str) == outlier_id_str
            if mask.any():
                indices.extend(df[mask].index.tolist())
                return indices
        
        # Caso 2: Si el ID tiene formato "ID_X", extraer el número X
        if isinstance(outlier_id, str) and outlier_id.startswith("ID_"):
            try:
                index_num = int(outlier_id.replace("ID_", ""))
                if 0 <= index_num < len(df):
                    indices.append(df.index[index_num])
                    return indices
            except (ValueError, IndexError):
                pass
        
        # Caso 3: Si el ID es numérico (string o número), usarlo como índice
        if isinstance(outlier_id, str) and outlier_id.isdigit():
            try:
                index_num = int(outlier_id)
                if 0 <= index_num < len(df):
                    indices.append(df.index[index_num])
                    return indices
            except (ValueError, IndexError):
                pass
        elif isinstance(outlier_id, (int, float)):
            try:
                index_num = int(outlier_id)
                if 0 <= index_num < len(df):
                    indices.append(df.index[index_num])
                    return indices
            except (ValueError, IndexError):
                pass
        
        # Si no se encontró ninguna coincidencia, retornar lista vacía
        return indices

    def _normalize_outlier_id(self, outlier_id: Any) -> str:
        """Normalizar IDs de outliers para comparaciones consistentes."""
        # Permitir objetos con clave id
        if isinstance(outlier_id, dict) and 'id' in outlier_id:
            outlier_id = outlier_id.get('id')
        normalized = str(outlier_id).strip()
        # Normalizar valores numéricos con .0 (ej: "1.0" -> "1")
        if "." in normalized:
            try:
                as_float = float(normalized)
                if as_float.is_integer():
                    return str(int(as_float))
            except (ValueError, TypeError):
                pass
        return normalized

    def _select_outliers_df(self, df: pd.DataFrame, final_outliers: List[Any], subject_id_column: str = None) -> pd.DataFrame:
        """Selecciona filas de outliers preservando el conteo del listado final."""
        if not final_outliers:
            return None

        selected_indices = []

        if subject_id_column and subject_id_column in df.columns:
            id_to_indices = {}
            for idx, value in df[subject_id_column].items():
                key = self._normalize_outlier_id(value)
                id_to_indices.setdefault(key, []).append(idx)

            for outlier_id in final_outliers:
                key = self._normalize_outlier_id(outlier_id)
                indices_list = id_to_indices.get(key)
                if indices_list:
                    selected_indices.append(indices_list.pop(0))
                else:
                    fallback_indices = self._map_outlier_id_to_index(outlier_id, df, subject_id_column)
                    if fallback_indices:
                        selected_indices.append(fallback_indices[0])
        else:
            for outlier_id in final_outliers:
                fallback_indices = self._map_outlier_id_to_index(outlier_id, df, subject_id_column)
                if fallback_indices:
                    selected_indices.append(fallback_indices[0])

        if not selected_indices:
            return None

        return df.loc[selected_indices].copy()
    
    def load_data_with_outliers(self, dataset_info: Dict[str, Any], outlier_results: Dict[str, Any]) -> pd.DataFrame:
        """
        Carga datos con información de outliers marcada de forma robusta.
        
        Este método carga el DataFrame y marca los outliers identificados en
        `outlier_results`. El mapeo de IDs se realiza de forma predecible y
        sin fallbacks peligrosos.
        
        Args:
            dataset_info: Diccionario con información del dataset que debe incluir
                'filename' y 'file_path'.
            outlier_results: Diccionario con resultados de detección de outliers que debe
                incluir 'final_outliers' (lista de IDs de outliers) y opcionalmente
                'subject_id_column' (nombre de la columna de ID de sujetos).
        
        Returns:
            DataFrame con columna 'es_outlier' marcada como "Outlier" o "No Outlier".
        
        Note:
            - Usa el método centralizado de DataProcessor si está disponible.
            - El mapeo de IDs es robusto y predecible, sin fallbacks peligrosos.
            - Si un outlier no se puede mapear, se registra una advertencia pero no
              se marca incorrectamente.
            - La columna 'es_outlier' se inicializa como "No Outlier" para todas las filas.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        filename = dataset_info.get("filename")
        
        # Cargar DataFrame usando método centralizado si está disponible
        if self.data_processor and filename and filename in self.data_processor.datasets:
            df = self.data_processor.get_dataframe(filename)
        else:
            # Fallback: cargar directamente desde archivo
            file_path = dataset_info.get("file_path")
            if not file_path:
                raise ValueError("No se pudo determinar la ruta del archivo. Se requiere 'filename' o 'file_path'.")
            
            
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
        
        
        # Inicializar columna de outliers
        df['es_outlier'] = "No Outlier"
        
        # Marcar outliers basado en los resultados finales
        if "final_outliers" not in outlier_results or not outlier_results["final_outliers"]:
            logger.info("No se encontraron outliers para marcar")
            return df
        
        final_outliers = outlier_results["final_outliers"]
        subject_id_column = outlier_results.get('subject_id_column')
        
        logger.info(
            f"Marcando {len(final_outliers)} outliers en DataFrame de {len(df)} filas",
            extra={'num_outliers': len(final_outliers), 'subject_id_column': subject_id_column}
        )
        
        # Contadores para validación
        outliers_marked = 0
        outliers_not_found = []
        
        # Mapear cada outlier ID a índices del DataFrame
        for outlier_id in final_outliers:
            indices = self._map_outlier_id_to_index(outlier_id, df, subject_id_column)
            
            if indices:
                # Marcar todas las filas correspondientes como outliers
                for idx in indices:
                    df.loc[idx, 'es_outlier'] = "Outlier"
                    outliers_marked += 1
            else:
                # Registrar outlier no encontrado para diagnóstico
                outliers_not_found.append(outlier_id)
                logger.warning(
                    f"No se pudo mapear outlier ID '{outlier_id}' a ninguna fila del DataFrame",
                    extra={
                        'outlier_id': str(outlier_id),
                        'subject_id_column': subject_id_column,
                        'available_columns': list(df.columns)
                    }
                )
        
        # Validación final
        actual_outliers = len(df[df['es_outlier'] == 'Outlier'])
        expected_outliers = outlier_results.get('outliers_detected', len(final_outliers))
        
        logger.info(
            f"Marcado de outliers completado: {actual_outliers} marcados de {expected_outliers} esperados",
            extra={
                'actual_outliers': actual_outliers,
                'expected_outliers': expected_outliers,
                'outliers_not_found': len(outliers_not_found)
            }
        )
        
        # Advertencia si hay discrepancias significativas
        if outliers_not_found:
            logger.warning(
                f"{len(outliers_not_found)} outliers no pudieron ser mapeados. "
                f"IDs no encontrados: {outliers_not_found[:10]}",
                extra={'outliers_not_found_count': len(outliers_not_found)}
            )
        
        # Advertencia si el conteo no coincide (pero no corregir automáticamente)
        if actual_outliers != expected_outliers:
            logger.warning(
                f"Discrepancia en conteo de outliers: {actual_outliers} marcados vs {expected_outliers} esperados. "
                f"Esto puede deberse a IDs no encontrados o duplicados.",
                extra={
                    'actual_outliers': actual_outliers,
                    'expected_outliers': expected_outliers,
                    'difference': abs(actual_outliers - expected_outliers)
                }
            )
        
        return df
    
    def format_p_value(self, p_value: float) -> str:
        """Formatear p-valor para mostrar en notación científica si es muy pequeño"""
        if p_value < 0.000001:
            return f"{p_value:.2e}"
        elif p_value < 0.001:
            return f"{p_value:.6f}"
        else:
            return f"{p_value:.4f}"
    
    def is_numeric_variable(self, var_type: str) -> bool:
        """Determinar si una variable es numérica (consistente con detect_outliers.js)"""
        # Solo las variables cuantitativas son realmente numéricas
        # Las variables cualitativas con códigos numéricos NO son numéricas para análisis estadístico
        return var_type in ["cuantitativa_continua", "cuantitativa_discreta"]
    
    def is_categorical_variable(self, var_type: str) -> bool:
        """Determinar si una variable es categórica"""
        return var_type in ["cualitativa_nominal", "cualitativa_nominal_binaria", "cualitativa_ordinal"]
    
    def descriptive_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                           outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Análisis descriptivo comparativo entre outliers y no-outliers.
        
        IMPORTANTE: Este método elimina automáticamente valores faltantes (NaN) de cada
        variable antes de realizar cálculos estadísticos. Esta eliminación es necesaria
        para obtener estadísticas válidas, pero debe documentarse en publicaciones.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada.
            variable_types: Diccionario con tipos de variables.
            outlier_results: Diccionario con resultados de detección de outliers.
                           Si se proporciona, se usan estos valores como fuente de verdad
                           para los conteos de outliers y normales.
        
        Returns:
            Diccionario con resultados del análisis descriptivo, incluyendo información
            sobre valores faltantes eliminados por variable.
        
        Note:
            - Los valores faltantes se eliminan por variable (no por fila completa).
            - Esta información se incluye en los resultados para documentación.
            - Se recomienda reportar el número de valores faltantes en la metodología.
        """
        
        results = {
            "numerical_variables": {},
            "categorical_variables": {},
            "missing_values_info": {}  # Información sobre valores faltantes eliminados
        }
        
        # Obtener el conteo total de outliers usando outlier_results como fuente de verdad
        if outlier_results:
            total_outliers = int(outlier_results.get('outliers_detected', 0))
            total_records = int(outlier_results.get('total_records', len(df)))
            total_normal = total_records - total_outliers
        else:
            # Fallback: contar desde el DataFrame si no hay outlier_results
            total_outliers = len(df[df['es_outlier'] == 'Outlier'])
            total_normal = len(df[df['es_outlier'] == 'No Outlier'])
        
        # Variables numéricas
        numerical_cols = [col for col, var_type in variable_types.items() 
                         if self.is_numeric_variable(var_type)]
        
        for col in numerical_cols:
            if col in df.columns and col != 'es_outlier':
                # Eliminar valores faltantes para análisis estadístico
                # NOTA: Esta eliminación es necesaria para cálculos estadísticos válidos.
                # Se documenta para transparencia en publicaciones científicas.
                original_count = len(df[col])
                # Filtrar el DataFrame completo para mantener alineamiento de índices
                df_valid = df[[col, 'es_outlier']].dropna(subset=[col])
                missing_count = original_count - len(df_valid)
                if missing_count > 0:
                    # Guardar información sobre valores faltantes para documentación
                    results["missing_values_info"][col] = {
                        "variable": col,
                        "missing_count": int(missing_count),
                        "total_count": int(original_count),
                        "valid_count": int(len(df_valid)),
                        "missing_percentage": round((missing_count / original_count) * 100, 2) if original_count > 0 else 0,
                        "note": "Valores faltantes eliminados automáticamente para cálculos estadísticos válidos"
                    }
                
                # Separar en outliers y normales usando el DataFrame filtrado
                outliers_data = df_valid[df_valid['es_outlier'] == "Outlier"][col]
                normal_data = df_valid[df_valid['es_outlier'] == "No Outlier"][col]
                
                # Incluir variables incluso si no hay outliers o no hay datos normales
                # Esto permite que los selectores se muestren siempre
                try:
                    # Estadísticos para outliers (si existen)
                    if len(outliers_data) > 0:
                        outliers_mean = float(outliers_data.mean()) if not (np.isnan(outliers_data.mean()) or np.isinf(outliers_data.mean())) else 0.0
                        outliers_median = float(outliers_data.median()) if not (np.isnan(outliers_data.median()) or np.isinf(outliers_data.median())) else 0.0
                        outliers_std = float(outliers_data.std()) if not (np.isnan(outliers_data.std()) or np.isinf(outliers_data.std())) else 0.0
                        outliers_min = float(outliers_data.min()) if not (np.isnan(outliers_data.min()) or np.isinf(outliers_data.min())) else 0.0
                        outliers_max = float(outliers_data.max()) if not (np.isnan(outliers_data.max()) or np.isinf(outliers_data.max())) else 0.0
                    else:
                        outliers_mean = outliers_median = outliers_std = outliers_min = outliers_max = 0.0
                    
                    # Estadísticos para datos normales (siempre existen)
                    if len(normal_data) > 0:
                        normal_mean = float(normal_data.mean()) if not (np.isnan(normal_data.mean()) or np.isinf(normal_data.mean())) else 0.0
                        normal_median = float(normal_data.median()) if not (np.isnan(normal_data.median()) or np.isinf(normal_data.median())) else 0.0
                        normal_std = float(normal_data.std()) if not (np.isnan(normal_data.std()) or np.isinf(normal_data.std())) else 0.0
                        normal_min = float(normal_data.min()) if not (np.isnan(normal_data.min()) or np.isinf(normal_data.min())) else 0.0
                        normal_max = float(normal_data.max()) if not (np.isnan(normal_data.max()) or np.isinf(normal_data.max())) else 0.0
                    else:
                        normal_mean = normal_median = normal_std = normal_min = normal_max = 0.0
                    
                except Exception as e:
                    continue
                
                results["numerical_variables"][col] = {
                    "outliers": {
                        "count": total_outliers,
                        "mean": outliers_mean,
                        "median": outliers_median,
                        "std": outliers_std,
                        "min": outliers_min,
                        "max": outliers_max,
                        "values": outliers_data.tolist() if len(outliers_data) > 0 else []
                    },
                    "normal": {
                        "count": total_normal,
                        "mean": normal_mean,
                        "median": normal_median,
                        "std": normal_std,
                        "min": normal_min,
                        "max": normal_max,
                        "values": normal_data.tolist() if len(normal_data) > 0 else []
                    }
                }
        
        # Variables categóricas - incluir todas las que NO son numéricas (consistente con detect_outliers.js)
        categorical_cols = [col for col, var_type in variable_types.items() 
                           if not self.is_numeric_variable(var_type) and col != 'es_outlier']
        
        for col in categorical_cols:
            if col in df.columns and col != 'es_outlier':
                data = df[col].dropna()
                outliers_data = data[df['es_outlier'] == "Outlier"]
                normal_data = data[df['es_outlier'] == "No Outlier"]
                
                # Incluir variables categóricas incluso si no hay outliers
                # Frecuencias para outliers (si existen)
                if len(outliers_data) > 0:
                    outliers_freq = outliers_data.value_counts()
                    outliers_prop = outliers_data.value_counts(normalize=True)
                    outliers_freq_dict = {str(k): int(v) for k, v in outliers_freq.to_dict().items()}
                    outliers_prop_dict = {str(k): float(v) for k, v in outliers_prop.to_dict().items()}
                else:
                    outliers_freq_dict = {}
                    outliers_prop_dict = {}
                
                # Frecuencias para datos normales (siempre existen)
                if len(normal_data) > 0:
                    normal_freq = normal_data.value_counts()
                    normal_prop = normal_data.value_counts(normalize=True)
                    normal_freq_dict = {str(k): int(v) for k, v in normal_freq.to_dict().items()}
                    normal_prop_dict = {str(k): float(v) for k, v in normal_prop.to_dict().items()}
                else:
                    normal_freq_dict = {}
                    normal_prop_dict = {}
                
                results["categorical_variables"][col] = {
                    "outliers": {
                        "count": total_outliers,
                        "frequencies": outliers_freq_dict,
                        "proportions": outliers_prop_dict
                    },
                    "normal": {
                        "count": total_normal,
                        "frequencies": normal_freq_dict,
                        "proportions": normal_prop_dict
                    }
                }
        
        return results
    
    def mann_whitney_test(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                          outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Prueba U de Mann-Whitney para variables numéricas.
        
        IMPORTANTE: Este método elimina automáticamente valores faltantes (NaN) de cada
        variable antes de realizar la prueba estadística. Esta eliminación es necesaria
        para obtener resultados válidos, pero debe documentarse en publicaciones.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada.
            variable_types: Diccionario con tipos de variables.
            outlier_results: Diccionario con resultados de detección de outliers.
                           Si se proporciona, se usan estos valores como fuente de verdad
                           para los conteos de outliers y normales.
        
        Returns:
            Diccionario con resultados de la prueba, incluyendo información sobre
            valores faltantes eliminados.
        
        Note:
            - Los valores faltantes se eliminan por variable antes del análisis.
            - Esta información se incluye en los resultados para documentación.
            - Se recomienda reportar el manejo de valores faltantes en la metodología.
        """
        results = {
            "missing_values_info": {}  # Información sobre valores faltantes eliminados
        }
        
        # Obtener el conteo total de outliers usando outlier_results como fuente de verdad
        if outlier_results:
            total_outliers = int(outlier_results.get('outliers_detected', 0))
            total_records = int(outlier_results.get('total_records', len(df)))
            total_normal = total_records - total_outliers
        else:
            # Fallback: contar desde el DataFrame si no hay outlier_results
            total_outliers = len(df[df['es_outlier'] == 'Outlier'])
            total_normal = len(df[df['es_outlier'] == 'No Outlier'])
        
        # Variables numéricas
        numerical_cols = [col for col, var_type in variable_types.items() 
                         if self.is_numeric_variable(var_type)]
        
        for col in numerical_cols:
            if col in df.columns and col != 'es_outlier':
                # Filtrar el DataFrame completo para mantener alineamiento de índices
                # Eliminar valores faltantes de la variable numérica
                df_valid = df[[col, 'es_outlier']].dropna(subset=[col])
                
                # Documentar valores faltantes eliminados
                original_count = len(df[col])
                missing_count = original_count - len(df_valid)
                if missing_count > 0:
                    results["missing_values_info"][col] = {
                        "variable": col,
                        "missing_count": int(missing_count),
                        "total_count": int(original_count),
                        "valid_count": int(len(df_valid)),
                        "missing_percentage": round((missing_count / original_count) * 100, 2) if original_count > 0 else 0,
                        "note": "Valores faltantes eliminados automáticamente para la prueba estadística"
                    }
                
                # Separar en outliers y normales usando el DataFrame filtrado
                outliers_data = df_valid[df_valid['es_outlier'] == "Outlier"][col]
                normal_data = df_valid[df_valid['es_outlier'] == "No Outlier"][col]
                
                # Incluir variables incluso si no hay outliers o no hay datos normales
                if len(outliers_data) > 0 and len(normal_data) > 0:
                    try:
                        # Realizar prueba U de Mann-Whitney con corrección de continuidad
                        # NOTA: mannwhitneyu devuelve el estadístico U directamente
                        statistic_u, p_value = mannwhitneyu(outliers_data, normal_data, alternative='two-sided', use_continuity=True)
                        
                        # Calcular estadísticos adicionales
                        n1, n2 = len(outliers_data), len(normal_data)
                        N = n1 + n2
                        
                        # El estadístico U ya viene directamente de mannwhitneyu
                        # Calcular Z-score para Rosenthal's r
                        # Z = (U - μ_U) / σ_U
                        # donde μ_U = n1*n2/2 y σ_U = sqrt(n1*n2*(n1+n2+1)/12)
                        mu_U = n1 * n2 / 2
                        sigma_U = np.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
                        Z = (statistic_u - mu_U) / sigma_U
                        
                        # Calcular Rosenthal's r (magnitud del efecto)
                        # r = Z / sqrt(N)
                        r = Z / np.sqrt(N)
                        
                        # Limpiar valores infinitos y NaN
                        U_clean = float(statistic_u) if not (np.isnan(statistic_u) or np.isinf(statistic_u)) else 0.0
                        Z_clean = float(Z) if not (np.isnan(Z) or np.isinf(Z)) else 0.0
                        r_clean = float(r) if not (np.isnan(r) or np.isinf(r)) else 0.0
                        p_value_clean = float(p_value) if not (np.isnan(p_value) or np.isinf(p_value)) else 1.0
                        
                        results[col] = {
                            "statistic_u": U_clean,          # Estadístico U de Mann-Whitney (devuelto directamente por scipy)
                            "z_score": Z_clean,              # Z-score estandarizado
                            "rosenthal_r": r_clean,          # Magnitud del efecto (r de Rosenthal)
                            "p_value": p_value_clean,
                            "p_value_formatted": self.format_p_value(p_value_clean),
                            "significant": bool(p_value_clean < 0.05),
                            "interpretation": "Significativo" if p_value_clean < 0.05 else "No significativo",
                            "test_description": "Prueba U de Mann-Whitney (no paramétrica) con corrección de continuidad",
                            "outliers_count": total_outliers,  # Conteo total de outliers detectados (fuente de verdad)
                            "normal_count": total_normal,      # Conteo total de datos normales (fuente de verdad)
                            "outliers_count_valid": n1,        # Conteo de outliers con valores válidos en esta variable
                            "normal_count_valid": n2,          # Conteo de datos normales con valores válidos en esta variable
                            "total_count": N                   # Total de observaciones válidas para esta variable
                        }
                    except Exception as e:
                        results[col] = {
                            "error": str(e),
                            "outliers_count": total_outliers,
                            "normal_count": total_normal
                        }
                else:
                    # Caso donde no hay suficientes datos para la prueba
                    if len(outliers_data) == 0:
                        message = "No se detectaron outliers en esta variable"
                    elif len(normal_data) == 0:
                        message = "No hay datos normales para comparar"
                    else:
                        message = "Datos insuficientes para realizar la prueba"
                    
                    results[col] = {
                        "message": message,
                        "outliers_count": total_outliers,
                        "normal_count": total_normal,
                        "status": "insufficient_data"
                    }
        
        return results
    
    def monte_carlo_chi_square(self, contingency_table: pd.DataFrame, n_replicates: int = 10000) -> Tuple[float, float, int]:
        """
        Implementación manual del test de Chi-Cuadrado con simulación Monte Carlo
        para tablas con frecuencias esperadas < 5
        """
        try:
            # Calcular el estadístico Chi-Cuadrado observado
            chi2_obs, _, dof, expected = stats.chi2_contingency(contingency_table, correction=False)
            
            # Obtener los totales marginales
            row_totals = contingency_table.sum(axis=1).values
            col_totals = contingency_table.sum(axis=0).values
            n_total = contingency_table.values.sum()
            
            # Simular tablas de contingencia bajo la hipótesis nula
            chi2_simulated = []
            
            for _ in range(n_replicates):
                # Generar una tabla simulada usando distribución hipergeométrica
                # para mantener los totales marginales
                simulated_table = np.zeros_like(contingency_table.values)
                
                # Para cada celda, generar valores que respeten los totales marginales
                remaining_row_totals = row_totals.copy()
                remaining_col_totals = col_totals.copy()
                
                for i in range(contingency_table.shape[0]):
                    for j in range(contingency_table.shape[1]):
                        if i == contingency_table.shape[0] - 1 and j == contingency_table.shape[1] - 1:
                            # Última celda: completar con el total restante
                            simulated_table[i, j] = remaining_row_totals[i]
                        elif i == contingency_table.shape[0] - 1:
                            # Última fila: usar el total restante de la columna
                            simulated_table[i, j] = remaining_col_totals[j]
                            remaining_row_totals[i] -= simulated_table[i, j]
                            remaining_col_totals[j] = 0
                        elif j == contingency_table.shape[1] - 1:
                            # Última columna: usar el total restante de la fila
                            simulated_table[i, j] = remaining_row_totals[i]
                            remaining_col_totals[j] -= simulated_table[i, j]
                            remaining_row_totals[i] = 0
                        else:
                            # Celdas intermedias: usar distribución hipergeométrica
                            if remaining_row_totals[i] > 0 and remaining_col_totals[j] > 0:
                                # Calcular el máximo posible para esta celda
                                max_possible = min(remaining_row_totals[i], remaining_col_totals[j])
                                if max_possible > 0:
                                    # Usar distribución hipergeométrica
                                    simulated_table[i, j] = np.random.hypergeometric(
                                        remaining_col_totals[j], 
                                        n_total - remaining_col_totals[j], 
                                        remaining_row_totals[i]
                                    )
                                    # Asegurar que no exceda los límites
                                    simulated_table[i, j] = min(simulated_table[i, j], max_possible)
                                    simulated_table[i, j] = max(simulated_table[i, j], 0)
                                else:
                                    simulated_table[i, j] = 0
                            else:
                                simulated_table[i, j] = 0
                            
                            # Actualizar totales restantes
                            remaining_row_totals[i] -= simulated_table[i, j]
                            remaining_col_totals[j] -= simulated_table[i, j]
                
                # Calcular Chi-Cuadrado para la tabla simulada
                try:
                    chi2_sim, _, _, _ = stats.chi2_contingency(simulated_table, correction=False)
                    if not np.isnan(chi2_sim) and not np.isinf(chi2_sim):
                        chi2_simulated.append(chi2_sim)
                except:
                    continue
            
            # Calcular p-valor como proporción de valores simulados >= observado
            if len(chi2_simulated) > 0:
                p_value = np.mean(np.array(chi2_simulated) >= chi2_obs)
            else:
                # Si no se pudieron generar simulaciones válidas, usar el p-valor teórico
                _, p_value, _, _ = stats.chi2_contingency(contingency_table, correction=False)
            
            return float(chi2_obs), float(p_value), int(dof)
            
        except Exception as e:
            # En caso de error, usar el método estándar
            chi2, p_value, dof, _ = stats.chi2_contingency(contingency_table, correction=False)
            return float(chi2), float(p_value), int(dof)

    def chi_square_test(self, df: pd.DataFrame, variable_types: Dict[str, str]) -> Dict[str, Any]:
        """Prueba de Chi-Cuadrado para variables categóricas"""
        results = {}
        
        # Obtener el conteo total de outliers del DataFrame completo
        total_outliers = len(df[df['es_outlier'] == 'Outlier'])
        total_normal = len(df[df['es_outlier'] == 'No Outlier'])
        
        try:
            # Variables categóricas - incluir todas las que NO son numéricas (consistente con detect_outliers.js)
            categorical_cols = [col for col, var_type in variable_types.items() 
                               if not self.is_numeric_variable(var_type) and col != 'es_outlier']
            
            for col in categorical_cols:
                if col in df.columns and col != 'es_outlier':
                    # Filtrar el DataFrame completo para mantener alineamiento de índices
                    # Eliminar valores faltantes de la variable categórica
                    df_valid = df[[col, 'es_outlier']].dropna(subset=[col])
                    
                    # Separar en outliers y normales usando el DataFrame filtrado
                    outliers_data = df_valid[df_valid['es_outlier'] == "Outlier"][col]
                    normal_data = df_valid[df_valid['es_outlier'] == "No Outlier"][col]
                    
                    # Incluir variables categóricas incluso si no hay outliers
                    if len(outliers_data) > 0 and len(normal_data) > 0:
                        try:
                            # Crear tabla de contingencia usando el DataFrame filtrado (sin valores faltantes)
                            contingency_table = pd.crosstab(df_valid[col], df_valid['es_outlier'])
                            
                            # Verificar que hay suficientes datos
                            if contingency_table.shape[0] > 1 and contingency_table.shape[1] > 1:
                                # Verificar que no hay celdas con frecuencia esperada < 5
                                expected_freq = stats.chi2_contingency(contingency_table)[3]
                                
                                if np.all(expected_freq >= 5):
                                    # Chi-Cuadrado estándar cuando se cumplen las frecuencias esperadas
                                    chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
                                    test_type = "Chi-Cuadrado estándar"
                                    test_description = "Prueba de Chi-Cuadrado con frecuencias esperadas ≥ 5"
                                    
                                    # Calcular tamaño del efecto
                                    n = contingency_table.values.sum()
                                    effect_size_name = ""
                                    effect_size_value = 0.0
                                    effect_size_interpretation = ""
                                    
                                    if contingency_table.shape == (2, 2):
                                        # Coeficiente Phi para tablas 2x2
                                        phi = np.sqrt(chi2 / n)
                                        effect_size_name = "Coeficiente Phi (φ)"
                                        effect_size_value = float(phi) if not np.isnan(phi) else 0.0
                                        
                                        # Interpretación del coeficiente Phi
                                        phi_clean = phi if not np.isnan(phi) else 0.0
                                        if phi_clean < 0.1:
                                            effect_size_interpretation = "Efecto pequeño"
                                        elif phi_clean < 0.3:
                                            effect_size_interpretation = "Efecto pequeño a mediano"
                                        elif phi_clean < 0.5:
                                            effect_size_interpretation = "Efecto mediano"
                                        else:
                                            effect_size_interpretation = "Efecto grande"
                                    else:
                                        # V de Cramer para tablas mayores a 2x2
                                        min_dim = min(contingency_table.shape)
                                        cramer_v = np.sqrt(chi2 / (n * (min_dim - 1)))
                                        effect_size_name = "V de Cramer"
                                        effect_size_value = float(cramer_v) if not np.isnan(cramer_v) else 0.0
                                        
                                        # Interpretación de V de Cramer
                                        cramer_v_clean = cramer_v if not np.isnan(cramer_v) else 0.0
                                        if cramer_v_clean < 0.1:
                                            effect_size_interpretation = "Efecto pequeño"
                                        elif cramer_v_clean < 0.3:
                                            effect_size_interpretation = "Efecto pequeño a mediano"
                                        elif cramer_v_clean < 0.5:
                                            effect_size_interpretation = "Efecto mediano"
                                        else:
                                            effect_size_interpretation = "Efecto grande"
                                    
                                    results[col] = {
                                        "test_type": test_type,
                                        "test_description": test_description,
                                        "chi2_statistic": float(chi2),
                                        "p_value": float(p_value),
                                        "p_value_formatted": self.format_p_value(p_value),
                                        "degrees_of_freedom": int(dof),
                                        "significant": bool(p_value < 0.05),
                                        "interpretation": "Significativo" if p_value < 0.05 else "No significativo",
                                        "effect_size_name": effect_size_name,
                                        "effect_size_value": effect_size_value,
                                        "effect_size_interpretation": effect_size_interpretation,
                                        "contingency_table": {
                                            "columns": [str(col) for col in contingency_table.columns],
                                            "rows": [str(row) for row in contingency_table.index],
                                            "data": contingency_table.values.tolist()
                                        },
                                        "outliers_count": total_outliers,
                                        "normal_count": total_normal
                                    }
                                else:
                                    # Manejar casos donde las frecuencias esperadas son < 5
                                    if contingency_table.shape == (2, 2):
                                        # Para tablas 2x2: usar Test Exacto de Fisher
                                        try:
                                            odds_ratio, p_value = stats.fisher_exact(contingency_table)
                                            test_type = "Test Exacto de Fisher"
                                            test_description = "Test Exacto de Fisher (frecuencias esperadas < 5)"
                                            
                                            # Calcular Chi-Cuadrado observado para mostrar en el formato solicitado
                                            chi2_obs, _, dof, _ = stats.chi2_contingency(contingency_table, correction=False)
                                            
                                            # Calcular tamaño del efecto (Phi) directamente desde la tabla de contingencia
                                            n = contingency_table.values.sum()
                                            # Calcular Phi directamente desde los valores de la tabla
                                            a, b = contingency_table.iloc[0, 0], contingency_table.iloc[0, 1]
                                            c, d = contingency_table.iloc[1, 0], contingency_table.iloc[1, 1]
                                            phi = (a*d - b*c) / np.sqrt((a+b)*(c+d)*(a+c)*(b+d))
                                            effect_size_name = "Coeficiente Phi (φ)"
                                            effect_size_value = float(abs(phi)) if not np.isnan(phi) else 0.0
                                            
                                            # Interpretación del coeficiente Phi
                                            phi_abs = abs(phi) if not np.isnan(phi) else 0.0
                                            if phi_abs < 0.1:
                                                effect_size_interpretation = "Efecto pequeño"
                                            elif phi_abs < 0.3:
                                                effect_size_interpretation = "Efecto pequeño a mediano"
                                            elif phi_abs < 0.5:
                                                effect_size_interpretation = "Efecto mediano"
                                            else:
                                                effect_size_interpretation = "Efecto grande"
                                            
                                            # Validar que los valores no sean infinitos o NaN
                                            chi2_clean = float(chi2_obs) if not (np.isnan(chi2_obs) or np.isinf(chi2_obs)) else 0.0
                                            p_value_clean = float(p_value) if not (np.isnan(p_value) or np.isinf(p_value)) else 1.0
                                            effect_size_clean = float(effect_size_value) if not (np.isnan(effect_size_value) or np.isinf(effect_size_value)) else 0.0
                                            
                                            results[col] = {
                                                "test_type": test_type,
                                                "test_description": test_description,
                                                "chi2_statistic": chi2_clean,  # Chi-Cuadrado observado
                                                "p_value": p_value_clean,      # P-valor del Test de Fisher
                                                "p_value_formatted": self.format_p_value(p_value_clean),
                                                "degrees_of_freedom": int(dof),
                                                "significant": bool(p_value_clean < 0.05),
                                                "interpretation": "Significativo" if p_value_clean < 0.05 else "No significativo",
                                                "effect_size_name": effect_size_name,
                                                "effect_size_value": effect_size_clean,
                                                "effect_size_interpretation": effect_size_interpretation,
                                                "contingency_table": {
                                                    "columns": [str(col) for col in contingency_table.columns],
                                                    "rows": [str(row) for row in contingency_table.index],
                                                    "data": contingency_table.values.tolist()
                                                },
                                                "outliers_count": total_outliers,
                                                "normal_count": total_normal
                                            }
                                        except Exception as fisher_error:
                                            results[col] = {
                                                "error": f"Error en Test Exacto de Fisher: {str(fisher_error)}",
                                                "contingency_table": {
                                                    "columns": [str(col) for col in contingency_table.columns],
                                                    "rows": [str(row) for row in contingency_table.index],
                                                    "data": contingency_table.values.tolist()
                                                },
                                                "outliers_count": total_outliers,
                                                "normal_count": total_normal,
                                                "effect_size_name": "No aplicable",
                                                "effect_size_value": None,
                                                "effect_size_interpretation": "No aplicable"
                                            }
                                    else:
                                        # Para tablas mayores a 2x2: usar Chi-Cuadrado con Monte Carlo
                                        try:
                                            # Usar nuestra implementación manual de Monte Carlo
                                            chi2_obs, p_value_mc, dof = self.monte_carlo_chi_square(contingency_table, n_replicates=10000)
                                            
                                            test_type = "Chi-Cuadrado con Monte Carlo"
                                            test_description = "Chi-Cuadrado con simulación Monte Carlo (frecuencias esperadas < 5)"
                                            
                                            # Calcular tamaño del efecto
                                            n = contingency_table.values.sum()
                                            min_dim = min(contingency_table.shape)
                                            cramer_v = np.sqrt(chi2_obs / (n * (min_dim - 1)))
                                            effect_size_name = "V de Cramer"
                                            effect_size_value = float(cramer_v) if not np.isnan(cramer_v) else 0.0
                                            
                                            # Interpretación de V de Cramer
                                            cramer_v_clean = cramer_v if not np.isnan(cramer_v) else 0.0
                                            if cramer_v_clean < 0.1:
                                                effect_size_interpretation = "Efecto pequeño"
                                            elif cramer_v_clean < 0.3:
                                                effect_size_interpretation = "Efecto pequeño a mediano"
                                            elif cramer_v_clean < 0.5:
                                                effect_size_interpretation = "Efecto mediano"
                                            else:
                                                effect_size_interpretation = "Efecto grande"
                                            
                                            # Validar que los valores no sean infinitos o NaN
                                            chi2_clean = float(chi2_obs) if not (np.isnan(chi2_obs) or np.isinf(chi2_obs)) else 0.0
                                            p_value_clean = float(p_value_mc) if not (np.isnan(p_value_mc) or np.isinf(p_value_mc)) else 1.0
                                            effect_size_clean = float(effect_size_value) if not (np.isnan(effect_size_value) or np.isinf(effect_size_value)) else 0.0
                                            
                                            results[col] = {
                                                "test_type": test_type,
                                                "test_description": test_description,
                                                "chi2_statistic": chi2_clean,
                                                "p_value": p_value_clean,  # Usar p-value de Monte Carlo
                                                "p_value_formatted": self.format_p_value(p_value_clean),
                                                "degrees_of_freedom": int(dof),
                                                "significant": bool(p_value_clean < 0.05),
                                                "interpretation": "Significativo" if p_value_clean < 0.05 else "No significativo",
                                                "effect_size_name": effect_size_name,
                                                "effect_size_value": effect_size_clean,
                                                "effect_size_interpretation": effect_size_interpretation,
                                                "contingency_table": {
                                                    "columns": [str(col) for col in contingency_table.columns],
                                                    "rows": [str(row) for row in contingency_table.index],
                                                    "data": contingency_table.values.tolist()
                                                },
                                                "outliers_count": total_outliers,
                                                "normal_count": total_normal
                                            }
                                        except Exception as mc_error:
                                            results[col] = {
                                                "error": f"Error en Chi-Cuadrado con Monte Carlo: {str(mc_error)}",
                                                "contingency_table": {
                                                    "columns": [str(col) for col in contingency_table.columns],
                                                    "rows": [str(row) for row in contingency_table.index],
                                                    "data": contingency_table.values.tolist()
                                                },
                                                "outliers_count": total_outliers,
                                                "normal_count": total_normal,
                                                "effect_size_name": "No aplicable",
                                                "effect_size_value": None,
                                                "effect_size_interpretation": "No aplicable"
                                            }
                            else:
                                results[col] = {
                                    "error": "Insuficientes categorías para realizar la prueba",
                                    "contingency_table": {
                                        "columns": [str(col) for col in contingency_table.columns],
                                        "rows": [str(row) for row in contingency_table.index],
                                        "data": contingency_table.values.tolist()
                                    },
                                    "outliers_count": total_outliers,
                                    "normal_count": total_normal,
                                    "effect_size_name": "No aplicable",
                                    "effect_size_value": None,
                                    "effect_size_interpretation": "No aplicable"
                                }
                        except Exception as e:
                            results[col] = {
                                "error": str(e),
                                "outliers_count": total_outliers,
                                "normal_count": total_normal,
                                "effect_size_name": "No aplicable",
                                "effect_size_value": None,
                                "effect_size_interpretation": "No aplicable"
                            }
                    else:
                        # Caso donde no hay suficientes datos para la prueba
                        if len(outliers_data) == 0:
                            message = "No se detectaron outliers en esta variable"
                        elif len(normal_data) == 0:
                            message = "No hay datos normales para comparar"
                        else:
                            message = "Datos insuficientes para realizar la prueba"
                        
                        results[col] = {
                            "message": message,
                            "outliers_count": total_outliers,
                            "normal_count": total_normal,
                            "status": "insufficient_data",
                            "effect_size_name": "No aplicable",
                            "effect_size_value": None,
                            "effect_size_interpretation": "No aplicable"
                        }
        except Exception as e:
            results = {
                "error": f"Error general en prueba de Chi-Cuadrado: {str(e)}",
                "effect_size_name": "No aplicable",
                "effect_size_value": None,
                "effect_size_interpretation": "No aplicable"
            }
        
        return results
    
    def create_comparative_visualizations(self, df: pd.DataFrame, variable_types: Dict[str, str]) -> Dict[str, Any]:
        """Crear visualizaciones comparativas entre outliers y no-outliers"""
        visualizations = {}
        
        # Variables numéricas
        numerical_cols = [col for col, var_type in variable_types.items() 
                         if self.is_numeric_variable(var_type)]
        
        for col in numerical_cols:
            if col in df.columns and col != 'es_outlier':
                data = df[col].dropna()
                outliers_data = data[df['es_outlier'] == "Outlier"]
                normal_data = data[df['es_outlier'] == "No Outlier"]
                
                if len(outliers_data) > 0 and len(normal_data) > 0:
                    # Boxplot comparativo
                    fig_box = go.Figure()
                    
                    fig_box.add_trace(go.Box(
                        y=normal_data,
                        name='Datos Normales',
                        marker_color='lightblue',
                        line_color='darkblue'
                    ))
                    
                    fig_box.add_trace(go.Box(
                        y=outliers_data,
                        name='Outliers',
                        marker_color='lightcoral',
                        line_color='darkred'
                    ))
                    
                    fig_box.update_layout(
                        title=f'Comparación de {col} entre Outliers y Datos Normales',
                        yaxis_title=col,
                        showlegend=True,
                        height=400
                    )
                    
                    visualizations[f'boxplot_{col}'] = {
                        'type': 'boxplot',
                        'data': fig_box.to_json()
                    }
                    
                    # Violin plot comparativo
                    fig_violin = go.Figure()
                    
                    fig_violin.add_trace(go.Violin(
                        y=normal_data,
                        name='Datos Normales',
                        box_visible=True,
                        line_color='darkblue',
                        fillcolor='lightblue'
                    ))
                    
                    fig_violin.add_trace(go.Violin(
                        y=outliers_data,
                        name='Outliers',
                        box_visible=True,
                        line_color='darkred',
                        fillcolor='lightcoral'
                    ))
                    
                    fig_violin.update_layout(
                        title=f'Distribución de {col} entre Outliers y Datos Normales',
                        yaxis_title=col,
                        showlegend=True,
                        height=400
                    )
                    
                    visualizations[f'violin_{col}'] = {
                        'type': 'violin',
                        'data': fig_violin.to_json()
                    }
        
        # Variables categóricas - incluir todas las que NO son numéricas (consistente con detect_outliers.js)
        categorical_cols = [col for col, var_type in variable_types.items() 
                           if not self.is_numeric_variable(var_type) and col != 'es_outlier']
        
        for col in categorical_cols:
            if col in df.columns and col != 'es_outlier':
                data = df[col].dropna()
                outliers_data = data[df['es_outlier'] == "Outlier"]
                normal_data = data[df['es_outlier'] == "No Outlier"]
                
                if len(outliers_data) > 0 and len(normal_data) > 0:
                    # Gráfico de barras comparativo
                    fig_bar = go.Figure()
                    
                    # Frecuencias para outliers
                    outliers_freq = outliers_data.value_counts()
                    fig_bar.add_trace(go.Bar(
                        x=list(outliers_freq.index),
                        y=list(outliers_freq.values),
                        name='Outliers',
                        marker_color='lightcoral'
                    ))
                    
                    # Frecuencias para datos normales
                    normal_freq = normal_data.value_counts()
                    fig_bar.add_trace(go.Bar(
                        x=list(normal_freq.index),
                        y=list(normal_freq.values),
                        name='Datos Normales',
                        marker_color='lightblue'
                    ))
                    
                    fig_bar.update_layout(
                        title=f'Frecuencias de {col} entre Outliers y Datos Normales',
                        xaxis_title=col,
                        yaxis_title='Frecuencia',
                        barmode='group',
                        showlegend=True,
                        height=400
                    )
                    
                    visualizations[f'barchart_{col}'] = {
                        'type': 'barchart',
                        'data': fig_bar.to_json()
                    }
        
        return visualizations
    
    def clean_infinite_values(self, obj):
        """Función recursiva para limpiar valores infinitos y NaN de cualquier estructura de datos"""
        if isinstance(obj, dict):
            return {key: self.clean_infinite_values(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self.clean_infinite_values(item) for item in obj]
        elif isinstance(obj, float):
            if np.isnan(obj) or np.isinf(obj):
                return 0.0
            return obj
        elif isinstance(obj, (int, str, bool, type(None))):
            return obj
        else:
            return obj

    def perform_primary_analysis(self, dataset_info: Dict[str, Any], 
                               outlier_results: Dict[str, Any]) -> Dict[str, Any]:
        """Realizar análisis primario completo"""
        try:
            
            # Cargar datos con información de outliers
            df = self.load_data_with_outliers(dataset_info, outlier_results)
            
            # Obtener tipos de variables del dataset
            variable_types = dataset_info.get("variable_types", {})
            
            # Agregar es_outlier como variable categórica nominal binaria
            variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            
            # Realizar análisis descriptivo
            descriptive_results = self.descriptive_analysis(df, variable_types, outlier_results)
            
            # Realizar prueba de Mann-Whitney
            mann_whitney_results = self.mann_whitney_test(df, variable_types, outlier_results)
            
            # Realizar prueba de Chi-Cuadrado
            chi_square_results = self.chi_square_test(df, variable_types)
            
            # Crear visualizaciones comparativas
            visualizations = self.create_comparative_visualizations(df, variable_types)
            
            # Crear resultado final
            final_results = {
                "descriptive_analysis": descriptive_results,
                "mann_whitney_test": mann_whitney_results,
                "chi_square_test": chi_square_results,
                "visualizations": visualizations
            }
            
            # Limpiar valores infinitos y NaN de todo el resultado
            cleaned_results = self.clean_infinite_values(final_results)
            
            return cleaned_results
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "error": str(e),
                "descriptive_analysis": {},
                "mann_whitney_test": {},
                "chi_square_test": {},
                "visualizations": {}
            }
    
    def perform_advanced_analysis(self, dataset_info: Dict[str, Any], 
                                outlier_results: Dict[str, Any]) -> Dict[str, Any]:
        """Realizar análisis avanzado completo - solo proporciona variables disponibles"""
        try:
            # Cargar datos con información de outliers
            df = self.load_data_with_outliers(dataset_info, outlier_results)
            
            # Obtener tipos de variables del dataset
            variable_types = dataset_info.get("variable_types", {})
            
            # Agregar es_outlier como variable categórica nominal binaria
            variable_types['es_outlier'] = 'cualitativa_nominal_binaria'
            
            # Obtener variables disponibles para cada análisis
            numerical_variables = [col for col, var_type in variable_types.items() 
                                 if 'cuantitativa' in var_type and col != 'es_outlier']
            
            categorical_variables = [col for col, var_type in variable_types.items() 
                                   if 'cualitativa' in var_type and col != 'es_outlier']
            
            # Crear resultado con solo variables disponibles
            final_results = {
                "robust_regression": {
                    "available_variables": numerical_variables,
                    "message": "Selecciona variables para ejecutar el análisis"
                },
                "pca_analysis": {
                    "available_variables": numerical_variables,
                    "message": "Selecciona variables para ejecutar el análisis"
                },
                "logistic_regression": {
                    "available_variables": numerical_variables + categorical_variables,
                    "message": "Selecciona variables para ejecutar el análisis"
                },
                "clustering_analysis": {
                    "available_variables": numerical_variables,
                    "message": "Selecciona variables para ejecutar el análisis"
                }
            }
            
            return final_results
            
        except Exception as e:
            return {
                "error": str(e),
                "robust_regression": {"available_variables": [], "message": "Error al cargar variables"},
                "pca_analysis": {"available_variables": [], "message": "Error al cargar variables"},
                "logistic_regression": {"available_variables": [], "message": "Error al cargar variables"},
                "clustering_analysis": {"available_variables": [], "message": "Error al cargar variables"}
            }
    
    def robust_regression_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                                 target_var: str = None, predictor_vars: List[str] = None) -> Dict[str, Any]:
        """Análisis de regresión robusta comparando con regresión lineal estándar usando statsmodels"""
        try:
            import statsmodels.api as sm
            from statsmodels.robust.robust_linear_model import RLM
            from sklearn.preprocessing import StandardScaler
            import numpy as np
            
            # Si no se proporcionan variables específicas, devolver solo variables disponibles
            if not target_var or not predictor_vars or len(predictor_vars) < 2:
                numerical_variables = [col for col, var_type in variable_types.items() 
                                     if 'cuantitativa' in var_type and col != 'es_outlier']
                return {
                    "available_variables": numerical_variables,
                    "message": "Selecciona una variable objetivo y al menos dos variables predictoras"
                }
            
            # Usar las variables especificadas
            target_var = target_var
            predictor_vars = predictor_vars
            
            # Preparar datos
            df_clean = df[[target_var] + predictor_vars].dropna()
            
            if len(df_clean) < 10:
                return {
                    "message": f"Insuficientes datos válidos para el análisis de regresión robusta. Se requieren al menos 10 observaciones, pero solo hay {len(df_clean)} disponibles.",
                    "available_data_points": len(df_clean),
                    "minimum_required": 10,
                    "status": "insufficient_data"
                }
            
            # Preparar variables
            y = df_clean[target_var]
            X = df_clean[predictor_vars]
            
            # Agregar constante para statsmodels
            X_with_const = sm.add_constant(X)
            
            # Regresión lineal estándar con statsmodels
            lr_model = sm.OLS(y, X_with_const)
            lr_results = lr_model.fit()
            
            # Regresión robusta con statsmodels (IRLS - Iteratively Reweighted Least Squares)
            robust_model = RLM(y, X_with_const, M=sm.robust.norms.HuberT())
            robust_results = robust_model.fit()
            
            # Extraer estadísticas detalladas para regresión lineal estándar
            lr_residuals = lr_results.resid
            lr_residuals_stats = {
                "min": float(lr_residuals.min()),
                "q1": float(lr_residuals.quantile(0.25)),
                "median": float(lr_residuals.median()),
                "q3": float(lr_residuals.quantile(0.75)),
                "max": float(lr_residuals.max())
            }
            
            lr_coefficients = []
            for i, var_name in enumerate(['Intercept'] + predictor_vars):
                lr_coefficients.append({
                    "variable": var_name,
                    "estimate": float(lr_results.params[i]),
                    "std_error": float(lr_results.bse[i]),
                    "t_value": float(lr_results.tvalues[i]),
                    "p_value": float(lr_results.pvalues[i]),
                    "significance": self._get_significance_code(lr_results.pvalues[i])
                })
            
            # Extraer estadísticas detalladas para regresión robusta
            robust_residuals = robust_results.resid
            robust_residuals_stats = {
                "min": float(robust_residuals.min()),
                "q1": float(robust_residuals.quantile(0.25)),
                "median": float(robust_residuals.median()),
                "q3": float(robust_residuals.quantile(0.75)),
                "max": float(robust_residuals.max())
            }
            
            robust_coefficients = []
            for i, var_name in enumerate(['Intercept'] + predictor_vars):
                robust_coefficients.append({
                    "variable": var_name,
                    "estimate": float(robust_results.params[i]),
                    "std_error": float(robust_results.bse[i]),
                    "t_value": float(robust_results.tvalues[i]),
                    "p_value": float(robust_results.pvalues[i]),
                    "significance": self._get_significance_code(robust_results.pvalues[i])
                })
            
                         # Información de convergencia para regresión robusta
            convergence_info = {
                "converged": hasattr(robust_results, 'converged') and robust_results.converged if hasattr(robust_results, 'converged') else True,  # Asumir convergencia si no hay atributo
                "iterations": robust_results.iterations if hasattr(robust_results, 'iterations') else None,
                "method": "IRLS (Iteratively Reweighted Least Squares) con Huber"
            }
            
            # Pesos de robustez (si están disponibles)
            robustness_weights = None
            if hasattr(robust_results, 'weights'):
                try:
                    weights = robust_results.weights
                    outlier_indices = np.where(weights < 0.0021)[0]
                    robustness_weights = {
                        "min": float(weights.min()),
                        "q1": float(np.percentile(weights, 25)),
                        "median": float(np.median(weights)),
                        "mean": float(weights.mean()),
                        "q3": float(np.percentile(weights, 75)),
                        "max": float(weights.max()),
                        "outlier_observations": len(outlier_indices),
                        "outlier_indices": outlier_indices.tolist() if len(outlier_indices) <= 10 else outlier_indices[:10].tolist()
                    }
                except Exception as e:
                    print(f"Warning: Error processing robustness weights: {e}")
                    robustness_weights = None
            
            # Parámetros algorítmicos
            algorithmic_params = {
                "tuning_chi": 1.548,
                "bb": 0.5,
                "tuning_psi": 4.685,
                "refine_tol": 1e-7,
                "rel_tol": 1e-7,
                "scale_tol": 1e-10,
                "solve_tol": 1e-7,
                "eps_outlier": 2.128e-3,
                "eps_x": 8.404e-12,
                "warn_limit_reject": 0.5,
                "warn_limit_meanrw": 0.5
            }
            
            # Comparar coeficientes
            coef_diff = []
            coef_diff_percent = []
            for lr_coef, robust_coef in zip(lr_coefficients[1:], robust_coefficients[1:]):  # Excluir intercepto
                diff_abs = abs(lr_coef["estimate"] - robust_coef["estimate"])
                coef_diff.append(diff_abs)
                # Calcular diferencia porcentual relativa al coeficiente del modelo estándar
                if abs(lr_coef["estimate"]) > 1e-10:  # Evitar división por cero
                    diff_percent = (diff_abs / abs(lr_coef["estimate"])) * 100
                    coef_diff_percent.append(diff_percent)
                else:
                    coef_diff_percent.append(0.0)
            
            # Determinar si hay influencia significativa de outliers
            # Usar umbral más riguroso: diferencia > 10% del coeficiente original O diferencia absoluta > 0.1
            significant_influence = any(
                (diff > 0.1) or (diff_percent > 10) 
                for diff, diff_percent in zip(coef_diff, coef_diff_percent)
            )
            
            # Comparar métricas de rendimiento
            lr_rse = float(lr_results.mse_resid ** 0.5)
            robust_rse = float(robust_results.scale)
            rse_improvement = ((lr_rse - robust_rse) / lr_rse) * 100 if lr_rse > 0 else 0.0
            
            # Comparar R² si está disponible
            r_squared_comparison = None
            if hasattr(robust_results, 'rsquared') and robust_results.rsquared is not None:
                lr_r2 = float(lr_results.rsquared)
                robust_r2 = float(robust_results.rsquared)
                r_squared_comparison = {
                    "linear_r_squared": lr_r2,
                    "robust_r_squared": robust_r2,
                    "difference": robust_r2 - lr_r2,
                    "robust_better": robust_r2 > lr_r2
                }
            
            # Crear datos para visualización
            # Mapear índices correctamente después de dropna()
            df_with_outliers = df.loc[df_clean.index]  # Filtrar df usando los índices válidos
            outlier_status_regression = (df_with_outliers['es_outlier'] == 'Outlier').tolist()
            
            # Incluir datos de todas las predictoras para visualización
            predictors_data = {}
            for i, pred_var in enumerate(predictor_vars):
                predictors_data[pred_var] = X[pred_var].tolist()
            
            plot_data = {
                "predictors": predictors_data,  # Diccionario con todas las predictoras
                "target": y.tolist(),
                "lr_predictions": lr_results.fittedvalues.tolist(),
                "robust_predictions": robust_results.fittedvalues.tolist(),
                "outlier_status": outlier_status_regression
            }
            
            # Mantener compatibilidad con código anterior (solo primeras dos)
            plot_data["x"] = X[predictor_vars[0]].tolist()
            plot_data["y"] = X[predictor_vars[1]].tolist() if len(predictor_vars) > 1 else [0] * len(X)
            
            return {
                "target_variable": target_var,
                "predictor_variables": predictor_vars,
                "sample_size": len(df_clean),
                "linear_regression": {
                    "residuals": lr_residuals_stats,
                    "coefficients": lr_coefficients,
                    "residual_standard_error": float(lr_results.mse_resid ** 0.5),
                    "r_squared": float(lr_results.rsquared),
                    "adjusted_r_squared": float(lr_results.rsquared_adj),
                    "f_statistic": float(lr_results.fvalue),
                    "f_p_value": float(lr_results.f_pvalue),
                    "degrees_of_freedom": int(lr_results.df_resid)
                },
                "robust_regression": {
                    "residuals": robust_residuals_stats,
                    "coefficients": robust_coefficients,
                    "robust_residual_standard_error": float(robust_results.scale),
                    "r_squared": float(robust_results.rsquared) if hasattr(robust_results, 'rsquared') else None,
                    "adjusted_r_squared": float(robust_results.rsquared_adj) if hasattr(robust_results, 'rsquared_adj') else None,
                    "convergence": convergence_info,
                    "robustness_weights": robustness_weights,
                    "algorithmic_parameters": algorithmic_params
                },
                "comparison": {
                    "coefficient_differences": coef_diff,
                    "coefficient_differences_percent": coef_diff_percent,
                    "significant_outlier_influence": significant_influence,
                    "residual_standard_error": {
                        "linear": lr_rse,
                        "robust": robust_rse,
                        "improvement_percent": rse_improvement,
                        "robust_better": robust_rse < lr_rse
                    },
                    "r_squared_comparison": r_squared_comparison,
                    "interpretation": "Los outliers tienen influencia significativa en el modelo estándar. El modelo robusto proporciona estimaciones más confiables." if significant_influence else "Los outliers no tienen influencia significativa en el modelo estándar. Ambos modelos proporcionan estimaciones similares.",
                    "recommendation": "Se recomienda usar el modelo robusto debido a la influencia de outliers" if significant_influence else "Ambos modelos son apropiados, pero el modelo robusto es más generalizable"
                },
                "plot_data": plot_data,
                "available_variables": [col for col, var_type in variable_types.items() 
                                      if self.is_numeric_variable(var_type) and col != 'es_outlier']
            }
            
        except Exception as e:
            return {"error": f"Error en análisis de regresión robusta: {str(e)}"}
    
    def pca_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                    variables: List[str] = None) -> Dict[str, Any]:
        """Análisis de Componentes Principales (PCA) con selección automática de componentes"""
        try:
            from sklearn.decomposition import PCA
            from sklearn.preprocessing import StandardScaler
            import numpy as np
            
            # Si no se proporcionan variables específicas, devolver solo variables disponibles
            if not variables or len(variables) < 2:
                numerical_cols = [col for col, var_type in variable_types.items() 
                                 if self.is_numeric_variable(var_type) and col != 'es_outlier']
                return {
                    "available_variables": numerical_cols,
                    "message": "Selecciona al menos 2 variables numéricas para el análisis PCA"
                }
            
            # Usar las variables especificadas
            numerical_cols = variables
            
            # Preparar datos
            df_clean = df[numerical_cols].dropna()
            
            if len(df_clean) < 5:
                return {
                    "error": "Insuficientes datos válidos para el análisis PCA",
                    "available_data_points": len(df_clean)
                }
            
            # Estandarizar datos
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(df_clean)
            
            # Aplicar PCA con todos los componentes posibles
            max_components = min(len(numerical_cols), len(df_clean) - 1)
            pca_full = PCA(n_components=max_components)
            pca_full.fit(X_scaled)
            
            # Calcular eigenvalues y varianza explicada
            eigenvalues = pca_full.explained_variance_
            explained_variance_ratio = pca_full.explained_variance_ratio_
            cumulative_variance = np.cumsum(explained_variance_ratio)
            
            # Criterio 1: Varianza Total Explicada (80% y 90%)
            n_components_80 = int(np.argmax(cumulative_variance >= 0.80) + 1)
            n_components_90 = int(np.argmax(cumulative_variance >= 0.90) + 1)
            
            # Criterio 2: Kaiser (Eigenvalue > 1)
            n_components_kaiser = int(sum(1 for eigenval in eigenvalues if eigenval > 1))
            
            # Recomendación automática: usar el máximo entre Kaiser y 80% de varianza
            recommended_components = int(max(n_components_kaiser, n_components_80))
            
            # Asegurar que no exceda el máximo posible
            recommended_components = int(min(recommended_components, max_components))
            
            # Aplicar PCA con el número recomendado de componentes
            pca = PCA(n_components=recommended_components)
            pca_result = pca.fit_transform(X_scaled)
            
            # Obtener loadings para los componentes recomendados
            loadings = pca.components_.tolist()
            
            # Crear tabla detallada de componentes
            component_details = []
            for i in range(max_components):
                component_details.append({
                    "component": f"PC{i+1}",
                    "eigenvalue": float(eigenvalues[i]),
                    "variance_explained": float(explained_variance_ratio[i] * 100),
                    "cumulative_variance": float(cumulative_variance[i] * 100),
                    "kaiser_criterion": bool(eigenvalues[i] > 1),
                    "recommended": bool(i < recommended_components)
                })
            
            # Crear datos para visualización
            # Mapear índices correctamente después de dropna()
            df_with_outliers = df.loc[df_clean.index]  # Filtrar df usando los índices válidos
            outlier_status = (df_with_outliers['es_outlier'] == 'Outlier').tolist()
            
            plot_data = {
                "pc1": pca_result[:, 0].tolist(),
                "pc2": pca_result[:, 1].tolist(),
                "outlier_status": outlier_status,
                "original_indices": df_clean.index.tolist()
            }
            
            # Si hay 3 o más componentes, agregar PC3
            if recommended_components >= 3:
                plot_data["pc3"] = pca_result[:, 2].tolist()
            
            # Crear datos para scree plot
            scree_plot_data = {
                "components": [f"PC{i+1}" for i in range(max_components)],
                "eigenvalues": eigenvalues.tolist(),
                "variance_explained": [float(ratio * 100) for ratio in explained_variance_ratio],
                "cumulative_variance": [float(var * 100) for var in cumulative_variance]
            }
            
            # Crear tabla de loadings para los primeros 2-3 componentes
            loadings_table = []
            for i in range(min(3, recommended_components)):
                for j, variable in enumerate(numerical_cols):
                    loadings_table.append({
                        "component": f"PC{i+1}",
                        "variable": variable,
                        "loading": loadings[i][j],
                        "abs_loading": abs(loadings[i][j])
                    })
            
            # Crear datos para biplot
            # Mapear índices correctamente después de dropna()
            df_with_outliers = df.loc[df_clean.index]  # Filtrar df usando los índices válidos
            outlier_status_biplot = ['Outlier' if status == 'Outlier' else 'No Outlier' 
                                    for status in df_with_outliers['es_outlier'].tolist()]
            
            biplot_data = {
                "pc1": pca_result[:, 0].tolist(),
                "pc2": pca_result[:, 1].tolist(),
                "outlier_status": outlier_status_biplot,
                "original_indices": df_clean.index.tolist(),
                "loadings_pc1": loadings[0] if len(loadings) > 0 else [],
                "loadings_pc2": loadings[1] if len(loadings) > 1 else [],
                "variable_names": numerical_cols
            }
            
            return {
                "n_components": int(recommended_components),
                "variables_used": numerical_cols,
                "sample_size": int(len(df_clean)),
                "explained_variance_ratio": explained_variance_ratio[:recommended_components].tolist(),
                "cumulative_variance": cumulative_variance[:recommended_components].tolist(),
                "loadings": loadings,
                "loadings_labels": numerical_cols,
                "plot_data": plot_data,
                "biplot_data": biplot_data,
                "available_variables": numerical_cols,
                "recommendation": {
                    "recommended_components": int(recommended_components),
                    "variance_explained": float(cumulative_variance[recommended_components - 1] * 100),
                    "kaiser_components": int(n_components_kaiser),
                    "variance_80_components": int(n_components_80),
                    "variance_90_components": int(n_components_90),
                    "reasoning": f"Se recomienda usar {recommended_components} componentes principales que explican el {cumulative_variance[recommended_components - 1] * 100:.1f}% de la varianza total."
                },
                "component_details": component_details,
                "scree_plot_data": scree_plot_data,
                "loadings_table": loadings_table
            }
            
        except Exception as e:
            return {"error": f"Error en análisis PCA: {str(e)}"}
    
    def logistic_regression_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                                   predictors: List[str] = None, test_size: float = 0.2,
                                   auto_select_features: bool = True, max_features: int = 10) -> Dict[str, Any]:
        """
        Regresión Logística para CARACTERIZAR outliers (no predecir)
        
        Objetivo: Identificar qué variables son más importantes para distinguir outliers de normales,
        ayudando a entender el perfil característico de los outliers.
        
        Args:
            df: DataFrame con columna 'es_outlier'
            variable_types: Diccionario con tipos de variables
            predictors: Lista de variables predictoras (si None, se seleccionan automáticamente)
            test_size: Proporción para conjunto de prueba
            auto_select_features: Si True, selecciona automáticamente las mejores variables
            max_features: Número máximo de variables a seleccionar automáticamente
        """
        try:
            from sklearn.linear_model import LogisticRegression
            from sklearn.model_selection import train_test_split
            from sklearn.preprocessing import StandardScaler, LabelEncoder
            from sklearn.metrics import classification_report, roc_auc_score, roc_curve, confusion_matrix
            from sklearn.feature_selection import SelectKBest, f_classif, mutual_info_classif
            from scipy.stats import f_oneway
            import numpy as np
            import statsmodels.api as sm
            
            # Si no se proporcionan predictores específicos, devolver solo variables disponibles
            if not predictors or len(predictors) < 1:
                predictor_cols = [col for col, var_type in variable_types.items() 
                                 if col != 'es_outlier' and self.is_numeric_variable(var_type)]
                return {
                    "available_variables": predictor_cols,
                    "message": "Selecciona variables predictoras para caracterizar el perfil de outliers. Se recomienda seleccionar entre 3-10 variables para evitar sobreajuste.",
                    "analysis_purpose": "caracterización"
                }
            
            # Usar los predictores especificados
            predictor_cols = predictors
            
            # Preparar datos
            try:
                # Verificar que todas las columnas predictoras existan
                missing_cols = [col for col in predictor_cols if col not in df.columns]
                if missing_cols:
                    return {
                        "error": f"Las siguientes variables predictoras no se encuentran en el DataFrame: {missing_cols}",
                        "available_columns": list(df.columns),
                        "requested_predictors": predictor_cols
                    }
                
                # Verificar que la columna es_outlier exista
                if 'es_outlier' not in df.columns:
                    return {
                        "error": "La columna 'es_outlier' no se encuentra en el DataFrame. Asegúrate de haber ejecutado la detección de outliers primero.",
                        "available_columns": list(df.columns)
                    }
                
                df_clean = df[predictor_cols + ['es_outlier']].dropna()
                
                # Verificar que después de dropna haya suficientes datos
                if len(df_clean) < 20:
                    return {
                        "message": f"Insuficientes datos válidos para la regresión logística después de eliminar valores faltantes. Se requieren al menos 20 observaciones, pero solo hay {len(df_clean)} disponibles.",
                        "available_data_points": len(df_clean),
                        "minimum_required": 20,
                        "status": "insufficient_data"
                    }
                
                # Verificar que haya al menos 2 clases después de dropna
                unique_classes_after_dropna = df_clean['es_outlier'].unique()
                if len(unique_classes_after_dropna) < 2:
                    return {
                        "error": f"Solo hay una clase en los datos después de eliminar valores faltantes ({unique_classes_after_dropna[0] if len(unique_classes_after_dropna) > 0 else 'desconocida'}). Se requieren al menos dos clases para regresión logística.",
                        "available_data_points": len(df_clean),
                        "classes_found": list(unique_classes_after_dropna)
                    }
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                return {
                    "error": f"Error preparando datos: {str(e)}",
                    "predictors_requested": predictor_cols,
                    "df_shape": df.shape if hasattr(df, 'shape') else 'unknown',
                    "df_columns": list(df.columns) if hasattr(df, 'columns') else 'unknown'
                }
            
            if len(df_clean) < 20:
                return {
                    "message": f"Insuficientes datos válidos para la regresión logística. Se requieren al menos 20 observaciones, pero solo hay {len(df_clean)} disponibles.",
                    "available_data_points": len(df_clean),
                    "minimum_required": 20,
                    "status": "insufficient_data"
                }
            
            # Separar variables numéricas y categóricas
            numerical_cols = [col for col in predictor_cols 
                             if self.is_numeric_variable(variable_types.get(col, ''))]
            categorical_cols = [col for col in predictor_cols 
                               if not self.is_numeric_variable(variable_types.get(col, ''))]
            
            # Preparar variables predictoras
            X_numerical = df_clean[numerical_cols].values if numerical_cols else np.empty((len(df_clean), 0))
            X_categorical = np.empty((len(df_clean), 0))
            
            # Codificar variables categóricas
            label_encoders = {}
            if categorical_cols:
                for col in categorical_cols:
                    le = LabelEncoder()
                    encoded_values = le.fit_transform(df_clean[col].astype(str))
                    X_categorical = np.column_stack([X_categorical, encoded_values]) if X_categorical.size > 0 else encoded_values.reshape(-1, 1)
                    label_encoders[col] = le
            
            # Combinar variables numéricas y categóricas
            X = np.column_stack([X_numerical, X_categorical]) if X_numerical.size > 0 and X_categorical.size > 0 else (X_numerical if X_numerical.size > 0 else X_categorical)
            
            # Preparar variable objetivo
            le_target = LabelEncoder()
            y = le_target.fit_transform(df_clean['es_outlier'])
            
            # Inicializar lista de advertencias
            warnings_list = []
            
            # ANÁLISIS DE IMPORTANCIA DE VARIABLES (antes del modelo)
            # Calcular importancia usando F-test y Mutual Information
            feature_importance_analysis = []
            all_feature_names = numerical_cols + categorical_cols
            
            if len(numerical_cols) > 0:
                # Para variables numéricas: usar F-test (ANOVA)
                X_num_for_importance = df_clean[numerical_cols].values
                y_for_importance = y
                
                # Estandarizar para el análisis de importancia
                scaler_importance = StandardScaler()
                X_num_scaled = scaler_importance.fit_transform(X_num_for_importance)
                
                # F-test scores
                f_scores, f_pvalues = f_classif(X_num_scaled, y_for_importance)
                
                # Mutual information scores
                mi_scores = mutual_info_classif(X_num_scaled, y_for_importance, random_state=42)
                
                for i, var_name in enumerate(numerical_cols):
                    feature_importance_analysis.append({
                        "variable": var_name,
                        "f_score": float(f_scores[i]) if np.isfinite(f_scores[i]) else 0.0,
                        "f_pvalue": float(f_pvalues[i]) if np.isfinite(f_pvalues[i]) else 1.0,
                        "mutual_info": float(mi_scores[i]) if np.isfinite(mi_scores[i]) else 0.0,
                        "importance_rank": 0  # Se calculará después
                    })
            
            # Ordenar por importancia combinada (promedio normalizado de F-score y MI)
            if feature_importance_analysis:
                # Normalizar scores
                max_f = max([f["f_score"] for f in feature_importance_analysis]) if max([f["f_score"] for f in feature_importance_analysis]) > 0 else 1
                max_mi = max([f["mutual_info"] for f in feature_importance_analysis]) if max([f["mutual_info"] for f in feature_importance_analysis]) > 0 else 1
                
                for f in feature_importance_analysis:
                    normalized_f = float(f["f_score"] / max_f if max_f > 0 else 0)
                    normalized_mi = float(f["mutual_info"] / max_mi if max_mi > 0 else 0)
                    f["combined_importance"] = float((normalized_f + normalized_mi) / 2)  # Asegurar tipo float nativo
                
                # Ordenar por importancia combinada
                feature_importance_analysis.sort(key=lambda x: x["combined_importance"], reverse=True)
                
                # Asignar rankings
                for rank, f in enumerate(feature_importance_analysis, 1):
                    f["importance_rank"] = rank
            
            # SELECCIÓN AUTOMÁTICA DE CARACTERÍSTICAS si hay muchas variables
            selected_features = None
            
            if auto_select_features and len(predictor_cols) > max_features and feature_importance_analysis:
                # Seleccionar las top K variables basadas en importancia
                top_features = [f["variable"] for f in feature_importance_analysis[:max_features]]
                
                # Actualizar predictor_cols para usar solo las seleccionadas
                original_predictor_cols = predictor_cols.copy()
                predictor_cols = top_features
                
                # Recalcular variables numéricas y categóricas con solo las seleccionadas
                numerical_cols = [col for col in predictor_cols 
                                 if self.is_numeric_variable(variable_types.get(col, ''))]
                categorical_cols = [col for col in predictor_cols 
                                  if not self.is_numeric_variable(variable_types.get(col, ''))]
                
                # Recalcular X con solo las variables seleccionadas
                X_numerical = df_clean[numerical_cols].values if numerical_cols else np.empty((len(df_clean), 0))
                X_categorical = np.empty((len(df_clean), 0))
                
                # Re-codificar variables categóricas seleccionadas
                label_encoders = {}
                if categorical_cols:
                    for col in categorical_cols:
                        le = LabelEncoder()
                        encoded_values = le.fit_transform(df_clean[col].astype(str))
                        X_categorical = np.column_stack([X_categorical, encoded_values]) if X_categorical.size > 0 else encoded_values.reshape(-1, 1)
                        label_encoders[col] = le
                
                # Combinar variables numéricas y categóricas seleccionadas
                X = np.column_stack([X_numerical, X_categorical]) if X_numerical.size > 0 and X_categorical.size > 0 else (X_numerical if X_numerical.size > 0 else X_categorical)
                
                selected_features = {
                    "original_count": len(original_predictor_cols),
                    "selected_count": len(predictor_cols),
                    "selected_variables": predictor_cols,
                    "excluded_variables": [v for v in original_predictor_cols if v not in predictor_cols]
                }
            
            # Verificar distribución de clases ANTES del split
            unique_classes_before, class_counts_before = np.unique(y, return_counts=True)
            min_class_count_before = min(class_counts_before) if len(class_counts_before) > 1 else class_counts_before[0]
            
            # Dividir en entrenamiento y prueba usando el test_size proporcionado
            # Si hay muy pocos datos de una clase, no usar stratify para evitar errores
            try:
                if min_class_count_before >= 2:  # Necesitamos al menos 2 de cada clase para stratify
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
                else:
                    warnings_list.append(f"Advertencia: Clase minoritaria tiene solo {min_class_count_before} observación(es). No se puede usar estratificación.")
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=None)
            except ValueError as e:
                # Si stratify falla (por ejemplo, solo hay una clase), hacer split sin estratificación
                warnings_list.append(f"Advertencia: No se pudo estratificar el conjunto de prueba. Error: {str(e)}")
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=None)
            
            # Verificar distribución de clases DESPUÉS del split
            unique_classes_after, class_counts_after = np.unique(y_test, return_counts=True)
            min_class_count_after = min(class_counts_after) if len(class_counts_after) > 1 else class_counts_after[0]
            
            # Advertencia si hay muy pocos datos de una clase en el conjunto de prueba
            if min_class_count_after < 5:
                warnings_list.append(
                    f"ADVERTENCIA CRÍTICA: Clase minoritaria en conjunto de prueba tiene solo {min_class_count_after} observación(es). "
                    f"Los resultados de la regresión logística NO serán confiables. "
                    f"Distribución antes del split: {dict(zip(unique_classes_before, class_counts_before))}. "
                    f"Distribución en prueba: {dict(zip(unique_classes_after, class_counts_after))}."
                )
            
            # Estandarizar variables numéricas
            # Después del split, X_train y X_test ya están combinados (numéricos + categóricos)
            # Solo escalar si hay variables numéricas
            scaler = StandardScaler()
            try:
                if len(numerical_cols) > 0 and X.size > 0:
                    # Verificar dimensiones
                    if len(X_train.shape) == 1:
                        X_train = X_train.reshape(-1, 1)
                    if len(X_test.shape) == 1:
                        X_test = X_test.reshape(-1, 1)
                    
                    X_train_scaled = scaler.fit_transform(X_train)
                    X_test_scaled = scaler.transform(X_test)
                else:
                    # Si no hay variables numéricas, usar datos sin escalar
                    X_train_scaled = X_train
                    X_test_scaled = X_test
            except Exception as e:
                # Si hay error al escalar, usar datos sin escalar y agregar advertencia
                warnings_list.append(f"Advertencia: No se pudo escalar las variables. Usando datos sin escalar. Error: {str(e)}")
                X_train_scaled = X_train
                X_test_scaled = X_test
            
            # Verificar balance de clases
            unique_classes, class_counts = np.unique(y_train, return_counts=True)
            min_class_count = min(class_counts) if len(class_counts) > 1 else class_counts[0]
            
            # Detectar posibles problemas antes de entrenar
            # NO reinicializar warnings_list aquí, ya fue inicializado antes
            perfect_separation_suspected = False
            
            # Verificar si hay suficientes observaciones por variable
            n_features = X_train_scaled.shape[1] if len(X_train_scaled.shape) > 1 else 0
            if n_features > len(X_train) / 10:
                warnings_list.append(f"Advertencia: Muchas variables ({n_features}) comparado con el tamaño de muestra ({len(X_train)}). Riesgo de sobreajuste.")
                if not selected_features:
                    warnings_list.append("Recomendación: Considera usar selección automática de características o reducir el número de variables.")
            
            # Verificar balance de clases
            if min_class_count < 5:
                warnings_list.append(f"Advertencia: Clase minoritaria tiene solo {min_class_count} observaciones. Los resultados pueden no ser confiables.")
            
            # Entrenar modelo con regularización para evitar sobreajuste
            # Usar L2 (Ridge) con C=1.0 como valor por defecto (menor C = más regularización)
            model = LogisticRegression(random_state=42, max_iter=1000, C=1.0, penalty='l2', solver='lbfgs')
            
            try:
                model.fit(X_train_scaled, y_train)
            except Exception as e:
                # Si falla, intentar con más regularización
                print(f"Advertencia: Error en entrenamiento inicial, intentando con más regularización: {e}")
                model = LogisticRegression(random_state=42, max_iter=1000, C=0.1, penalty='l2', solver='lbfgs')
                model.fit(X_train_scaled, y_train)
                warnings_list.append("Se aplicó regularización adicional debido a problemas de convergencia.")
            
            # Predicciones
            y_pred = model.predict(X_test_scaled)
            y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
            
            # Detectar separación perfecta o sobreajuste extremo
            # Si todas las probabilidades están muy cerca de 0 o 1, puede haber separación perfecta
            prob_min = float(np.min(y_pred_proba))
            prob_max = float(np.max(y_pred_proba))
            if prob_min < 0.001 or prob_max > 0.999:
                perfect_separation_suspected = bool(True)  # Asegurar tipo nativo de Python
                warnings_list.append("ADVERTENCIA CRÍTICA: Posible separación perfecta detectada. El modelo puede estar sobreajustado.")
                warnings_list.append("Recomendación: No uses las mismas variables que se usaron para detectar outliers como predictores.")
            
            # Métricas
            try:
                auc_score = roc_auc_score(y_test, y_pred_proba)
            except ValueError:
                # Si solo hay una clase en y_test, AUC no es calculable
                auc_score = 0.5
                warnings_list.append("Advertencia: AUC no calculable (solo una clase presente en conjunto de prueba).")
            
            fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)
            
            # Tabla de confusión
            cm = confusion_matrix(y_test, y_pred)
            tn, fp, fn, tp = cm.ravel()
            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            accuracy = (tp + tn) / (tp + tn + fp + fn)
            
            # Detectar métricas sospechosamente perfectas
            if auc_score >= 0.99 and accuracy >= 0.99:
                perfect_separation_suspected = bool(True)  # Asegurar tipo nativo de Python
                warnings_list.append("ADVERTENCIA CRÍTICA: Métricas perfectas (AUC ≥ 0.99, Accuracy ≥ 0.99) sugieren separación perfecta o sobreajuste extremo.")
                warnings_list.append("Esto puede ocurrir si usas las mismas variables que definieron los outliers como predictores.")
            
            # Validar que las métricas sean finitas
            if not np.isfinite(auc_score):
                auc_score = 0.5
            if not np.isfinite(sensitivity):
                sensitivity = 0.0
            if not np.isfinite(specificity):
                specificity = 0.0
            if not np.isfinite(accuracy):
                accuracy = 0.0
            
            # Calcular p-valores usando statsmodels
            try:
                # Agregar constante para el intercepto
                X_with_const = sm.add_constant(X_train_scaled)
                model_stats = sm.Logit(y_train, X_with_const).fit(disp=0)
                
                # Coeficientes con p-valores
                feature_names = ['Intercept'] + numerical_cols + categorical_cols
                coefficients = model_stats.params.tolist()
                p_values = model_stats.pvalues.tolist()
                
                # Crear tabla de coeficientes
                coef_table = []
                for i, (name, coef, p_val) in enumerate(zip(feature_names, coefficients, p_values)):
                    if name != 'Intercept':  # No incluir intercepto en la tabla principal
                        # Manejar valores infinitos o NaN
                        if np.isfinite(coef) and np.isfinite(p_val):
                            significance = self._get_significance_code(p_val)
                            # Calcular odds ratio de forma segura con mejor manejo
                            coef_clipped = np.clip(coef, -50, 50)  # Clip para evitar overflow
                            odds_ratio = np.exp(coef_clipped)
                            
                            # Detectar coeficientes extremos (posible separación perfecta)
                            # Convertir explícitamente a bool nativo de Python para serialización JSON
                            is_extreme_coef = bool(abs(coef) > 20 or abs(coef_clipped - coef) > 0.01)
                            
                            # Interpretación mejorada
                            if is_extreme_coef:
                                if coef > 0:
                                    interpretation = "Separación perfecta: Variable caracteriza completamente a los outliers (coeficiente extremo)"
                                else:
                                    interpretation = "Separación perfecta: Variable caracteriza completamente a los normales (coeficiente extremo)"
                            else:
                                interpretation = "Aumenta la probabilidad de ser outlier" if coef > 0 else "Disminuye la probabilidad de ser outlier"
                            
                            coef_table.append({
                                "variable": name,
                                "coefficient": float(coef),
                                "p_value": float(p_val),
                                "significance": significance,
                                "odds_ratio": float(odds_ratio) if not is_extreme_coef else (float('inf') if coef > 0 else 0.0),
                                "interpretation": interpretation,
                                "is_extreme": bool(is_extreme_coef)  # Convertir explícitamente a bool nativo para JSON
                            })
                        else:
                            # Manejar casos problemáticos
                            coef_table.append({
                                "variable": name,
                                "coefficient": 0.0 if not np.isfinite(coef) else float(coef),
                                "p_value": 1.0 if not np.isfinite(p_val) else float(p_val),
                                "significance": "",
                                "odds_ratio": 1.0,
                                "interpretation": "No calculable (separación perfecta)"
                            })
                
                intercept = float(model_stats.params[0]) if np.isfinite(model_stats.params[0]) else 0.0
                
            except Exception as e:
                print(f"Error con statsmodels, usando sklearn solamente: {e}")
                # Fallback a sklearn solamente
                feature_names = numerical_cols + categorical_cols
                coefficients = model.coef_[0].tolist() if len(model.coef_) > 0 else []
                intercept = float(model.intercept_[0]) if len(model.intercept_) > 0 else 0.0
                
                # Crear tabla de coeficientes sin p-valores
                coef_table = []
                for i, (name, coef) in enumerate(zip(feature_names, coefficients)):
                    if np.isfinite(coef):
                        odds_ratio = np.exp(np.clip(coef, -50, 50))
                        coef_table.append({
                            "variable": name,
                            "coefficient": float(coef),
                            "p_value": None,
                            "significance": "N/A",
                            "odds_ratio": float(odds_ratio),
                            "interpretation": "Aumenta la probabilidad de ser outlier" if coef > 0 else "Disminuye la probabilidad de ser outlier"
                        })
                    else:
                        coef_table.append({
                            "variable": name,
                            "coefficient": 0.0,
                            "p_value": None,
                            "significance": "N/A",
                            "odds_ratio": 1.0,
                            "interpretation": "No calculable (separación perfecta)"
                        })
            
            # Ordenar por importancia (valor absoluto del coeficiente)
            coef_table.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
            
            # Asegurar que intercept esté definido
            if 'intercept' not in locals():
                intercept = float(model.intercept_[0]) if hasattr(model, 'intercept_') and len(model.intercept_) > 0 else 0.0
            
            # Datos para curva ROC - validar que sean finitos
            roc_data = {
                "fpr": [float(x) if np.isfinite(x) else 0.0 for x in fpr.tolist()],
                "tpr": [float(x) if np.isfinite(x) else 0.0 for x in tpr.tolist()],
                "thresholds": [float(x) if np.isfinite(x) else 0.0 for x in thresholds.tolist()]
            }
            
            result_dict = {
                "sample_size": len(df_clean),
                "training_size": len(X_train),
                "test_size": len(X_test),
                "numerical_variables": numerical_cols,
                "categorical_variables": categorical_cols,
                "auc_score": float(auc_score),
                "intercept": float(intercept) if np.isfinite(intercept) else 0.0,
                "coefficients_table": coef_table,
                "confusion_matrix": {
                    "true_negatives": int(tn),
                    "false_positives": int(fp),
                    "false_negatives": int(fn),
                    "true_positives": int(tp),
                    "sensitivity": float(sensitivity),
                    "specificity": float(specificity),
                    "accuracy": float(accuracy)
                },
                "roc_data": roc_data,
                "available_variables": predictor_cols,
                "model_performance": {
                    "auc_interpretation": "Excelente" if auc_score >= 0.9 else "Buena" if auc_score >= 0.8 else "Aceptable" if auc_score >= 0.7 else "Pobre",
                    "auc_value": float(auc_score)
                },
                "warnings": warnings_list,
                "perfect_separation_suspected": bool(perfect_separation_suspected),  # Convertir explícitamente a bool nativo
                "class_distribution": {
                    "class_0_count": int(class_counts[0]) if len(class_counts) > 0 else 0,
                    "class_1_count": int(class_counts[1]) if len(class_counts) > 1 else 0,
                    "class_0_label": str(le_target.inverse_transform([0])[0]) if hasattr(le_target, 'inverse_transform') else "Clase 0",
                    "class_1_label": str(le_target.inverse_transform([1])[0]) if hasattr(le_target, 'inverse_transform') and len(unique_classes) > 1 else "Clase 1"
                },
                "feature_importance_analysis": feature_importance_analysis,
                "selected_features_info": selected_features,
                "analysis_purpose": "caracterización",
                "interpretation_guide": {
                    "purpose": "Este análisis caracteriza el perfil de outliers, identificando qué variables son más importantes para distinguirlos.",
                    "key_metrics": [
                        "Coeficientes positivos: Variables que aumentan la probabilidad de ser outlier",
                        "Coeficientes negativos: Variables que disminuyen la probabilidad de ser outlier",
                        "Odds Ratio > 1: Mayor probabilidad de outlier",
                        "Odds Ratio < 1: Menor probabilidad de outlier"
                    ],
                    "limitations": [
                        "Este modelo NO predice outliers nuevos (usaría las mismas variables que los definieron)",
                        "El objetivo es entender QUÉ características distinguen a los outliers",
                        "Métricas perfectas (AUC=1) sugieren separación perfecta y deben interpretarse con cautela"
                    ]
                }
            }
            
            # Convertir todos los tipos numpy a tipos nativos de Python antes de retornar
            def convert_numpy_types(obj):
                """Convierte recursivamente tipos numpy a tipos nativos de Python"""
                if isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                elif isinstance(obj, np.bool_):
                    return bool(obj)
                elif isinstance(obj, np.ndarray):
                    return [convert_numpy_types(item) for item in obj.tolist()]
                elif isinstance(obj, dict):
                    return {key: convert_numpy_types(value) for key, value in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [convert_numpy_types(item) for item in obj]
                else:
                    return obj
            
            # Aplicar conversión recursiva a todo el diccionario de resultados
            return convert_numpy_types(result_dict)
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en regresión logística: {str(e)}"} 
    
    def _get_significance_code(self, p_value: float) -> str:
        """Obtener código de significancia basado en el p-valor"""
        if p_value < 0.001:
            return "***"
        elif p_value < 0.01:
            return "**"
        elif p_value < 0.05:
            return "*"
        elif p_value < 0.1:
            return "."
        else:
            return ""
    
    def comparative_correlation_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Análisis comparativo de correlaciones entre outliers y datos normales.
        
        Este análisis calcula matrices de correlación para outliers y normales por separado,
        identifica diferencias significativas en los patrones de correlación, y proporciona
        interpretación clínica de los hallazgos.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
        
        Returns:
            Diccionario con:
                - correlation_matrices: Matrices de correlación para outliers y normales
                - correlation_differences: Diferencias entre matrices
                - significant_differences: Pares de variables con diferencias significativas
                - interpretation: Interpretación clínica de los hallazgos
                - heatmap_data: Datos para visualización de heatmaps
        """
        try:
            from scipy.stats import pearsonr, spearmanr, norm
            import numpy as np
            
            # Verificar que existe la columna es_outlier
            if 'es_outlier' not in df.columns:
                return {
                    "error": "La columna 'es_outlier' no se encuentra en el DataFrame. Asegúrate de haber ejecutado la detección de outliers primero."
                }
            
            # Separar outliers y normales
            outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            normal_df = df[df['es_outlier'] == 'No Outlier'].copy()
            
            # Obtener el número real de outliers únicos (basado en final_outliers)
            # Esto evita contar duplicados si un outlier aparece en múltiples filas
            if outlier_results and 'final_outliers' in outlier_results:
                actual_outliers_count = len(outlier_results['final_outliers'])
            else:
                # Fallback: contar filas únicas marcadas como outliers
                actual_outliers_count = len(set(outliers_df.index)) if len(outliers_df) > 0 else len(outliers_df)
            
            # Contar normales: Total de registros menos outliers
            # Esto asegura que outliers_count + normal_count = total_records
            total_records = len(df)
            total_normal_count = total_records - actual_outliers_count
            
            if actual_outliers_count < 3:
                return {
                    "error": f"Insuficientes outliers para análisis de correlaciones. Se requieren al menos 3 outliers únicos, pero solo hay {actual_outliers_count}."
                }
            
            if total_normal_count < 3:
                return {
                    "error": f"Insuficientes datos normales para análisis de correlaciones. Se requieren al menos 3 observaciones normales, pero solo hay {total_normal_count}."
                }
            
            # Obtener solo variables numéricas
            numerical_cols = [col for col in df.columns 
                            if col != 'es_outlier' and self.is_numeric_variable(variable_types.get(col, ''))]
            
            if len(numerical_cols) < 2:
                return {
                    "error": "Se requieren al menos 2 variables numéricas para análisis de correlaciones."
                }
            
            # Filtrar datos válidos (sin NaN) para cada grupo (solo para cálculos de correlación)
            outliers_clean = outliers_df[numerical_cols].dropna()
            normal_clean = normal_df[numerical_cols].dropna()
            
            # Contar cuántos outliers y normales tienen datos válidos para correlaciones
            outliers_with_valid_data = len(outliers_clean)
            normals_with_valid_data = len(normal_clean)
            
            if len(outliers_clean) < 3 or len(normal_clean) < 3:
                return {
                    "error": "Insuficientes datos válidos después de eliminar valores faltantes para análisis de correlaciones."
                }
            
            # Calcular matrices de correlación
            # Usar Pearson para datos normales, Spearman como alternativa robusta
            outliers_corr_pearson = outliers_clean.corr(method='pearson')
            normal_corr_pearson = normal_clean.corr(method='pearson')
            
            outliers_corr_spearman = outliers_clean.corr(method='spearman')
            normal_corr_spearman = normal_clean.corr(method='spearman')
            
            # Calcular diferencias entre matrices
            correlation_differences = {}
            significant_differences = []
            
            # Para cada par de variables, comparar correlaciones
            for i, var1 in enumerate(numerical_cols):
                for j, var2 in enumerate(numerical_cols):
                    if i >= j:  # Evitar duplicados (matriz simétrica)
                        continue
                    
                    # Datos para outliers
                    outliers_var1 = outliers_clean[var1].values
                    outliers_var2 = outliers_clean[var2].values
                    
                    # Datos para normales
                    normal_var1 = normal_clean[var1].values
                    normal_var2 = normal_clean[var2].values
                    
                    # Verificar que hay variabilidad en ambos grupos
                    if (np.std(outliers_var1) == 0 or np.std(outliers_var2) == 0 or
                        np.std(normal_var1) == 0 or np.std(normal_var2) == 0):
                        continue
                    
                    # Calcular correlaciones
                    try:
                        # Correlación Pearson para outliers
                        outliers_pearson_r, outliers_pearson_p = pearsonr(outliers_var1, outliers_var2)
                        
                        # Correlación Pearson para normales
                        normal_pearson_r, normal_pearson_p = pearsonr(normal_var1, normal_var2)
                        
                        # Correlación Spearman para outliers
                        outliers_spearman_r, outliers_spearman_p = spearmanr(outliers_var1, outliers_var2)
                        
                        # Correlación Spearman para normales
                        normal_spearman_r, normal_spearman_p = spearmanr(normal_var1, normal_var2)
                        
                        # Calcular diferencia
                        diff_pearson = abs(outliers_pearson_r - normal_pearson_r)
                        diff_spearman = abs(outliers_spearman_r - normal_spearman_r)
                        
                        # Test de significancia de diferencia usando transformación de Fisher
                        # z = 0.5 * ln((1+r)/(1-r))
                        if abs(outliers_pearson_r) < 0.99 and abs(normal_pearson_r) < 0.99:
                            z_outliers = 0.5 * np.log((1 + outliers_pearson_r) / (1 - outliers_pearson_r))
                            z_normal = 0.5 * np.log((1 + normal_pearson_r) / (1 - normal_pearson_r))
                            
                            # Error estándar de la diferencia
                            se_diff = np.sqrt(1/(len(outliers_var1)-3) + 1/(len(normal_var1)-3))
                            z_score_diff = (z_outliers - z_normal) / se_diff
                            
                            # p-valor para la diferencia (test de dos colas)
                            p_value_diff = 2 * (1 - norm.cdf(abs(z_score_diff)))
                        else:
                            z_score_diff = None
                            p_value_diff = None
                        
                        # Considerar diferencia significativa si:
                        # 1. La diferencia es > 0.3 (cambio sustancial)
                        # 2. O si el p-valor de diferencia es < 0.05
                        is_significant = False
                        if diff_pearson > 0.3 or (p_value_diff is not None and p_value_diff < 0.05):
                            is_significant = True
                            significant_differences.append({
                                "variable1": var1,
                                "variable2": var2,
                                "outliers_pearson_r": float(outliers_pearson_r) if np.isfinite(outliers_pearson_r) else 0.0,
                                "normal_pearson_r": float(normal_pearson_r) if np.isfinite(normal_pearson_r) else 0.0,
                                "difference": float(diff_pearson),
                                "outliers_spearman_r": float(outliers_spearman_r) if np.isfinite(outliers_spearman_r) else 0.0,
                                "normal_spearman_r": float(normal_spearman_r) if np.isfinite(normal_spearman_r) else 0.0,
                                "z_score_diff": float(z_score_diff) if z_score_diff is not None and np.isfinite(z_score_diff) else None,
                                "p_value_diff": float(p_value_diff) if p_value_diff is not None and np.isfinite(p_value_diff) else None,
                                "interpretation": self._interpret_correlation_difference(
                                    outliers_pearson_r, normal_pearson_r, var1, var2
                                )
                            })
                        
                        correlation_differences[f"{var1}_{var2}"] = {
                            "variable1": var1,
                            "variable2": var2,
                            "outliers_pearson_r": float(outliers_pearson_r) if np.isfinite(outliers_pearson_r) else 0.0,
                            "normal_pearson_r": float(normal_pearson_r) if np.isfinite(normal_pearson_r) else 0.0,
                            "difference": float(diff_pearson),
                            "outliers_spearman_r": float(outliers_spearman_r) if np.isfinite(outliers_spearman_r) else 0.0,
                            "normal_spearman_r": float(normal_spearman_r) if np.isfinite(normal_spearman_r) else 0.0,
                            "is_significant": bool(is_significant),
                            "z_score_diff": float(z_score_diff) if z_score_diff is not None and np.isfinite(z_score_diff) else None,
                            "p_value_diff": float(p_value_diff) if p_value_diff is not None and np.isfinite(p_value_diff) else None
                        }
                    except Exception as e:
                        # Si hay error calculando correlación para este par, continuar
                        continue
            
            # Preparar datos para heatmaps
            # Convertir matrices de correlación a listas para JSON
            outliers_corr_matrix = []
            normal_corr_matrix = []
            diff_matrix = []
            
            for var1 in numerical_cols:
                outliers_row = []
                normal_row = []
                diff_row = []
                for var2 in numerical_cols:
                    if var1 == var2:
                        outliers_row.append(1.0)
                        normal_row.append(1.0)
                        diff_row.append(0.0)
                    else:
                        outliers_val = float(outliers_corr_pearson.loc[var1, var2]) if np.isfinite(outliers_corr_pearson.loc[var1, var2]) else 0.0
                        normal_val = float(normal_corr_pearson.loc[var1, var2]) if np.isfinite(normal_corr_pearson.loc[var1, var2]) else 0.0
                        outliers_row.append(outliers_val)
                        normal_row.append(normal_val)
                        diff_row.append(abs(outliers_val - normal_val))
                outliers_corr_matrix.append(outliers_row)
                normal_corr_matrix.append(normal_row)
                diff_matrix.append(diff_row)
            
            # Generar interpretación clínica
            # Usar los conteos REALES (no los filtrados por NaN)
            interpretation = self._generate_correlation_interpretation(
                significant_differences, actual_outliers_count, total_normal_count, numerical_cols
            )
            
            return {
                "success": True,
                "outliers_count": actual_outliers_count,  # Usar conteo de outliers únicos REAL
                "normal_count": total_normal_count,  # Usar conteo REAL de normales (total_records - outliers)
                "variables_analyzed": numerical_cols,
                "correlation_matrices": {
                    "outliers_pearson": {
                        "matrix": outliers_corr_matrix,
                        "labels": numerical_cols
                    },
                    "normal_pearson": {
                        "matrix": normal_corr_matrix,
                        "labels": numerical_cols
                    },
                    "outliers_spearman": {
                        "matrix": [[float(outliers_corr_spearman.loc[v1, v2]) if np.isfinite(outliers_corr_spearman.loc[v1, v2]) else 0.0 
                                   for v2 in numerical_cols] for v1 in numerical_cols],
                        "labels": numerical_cols
                    },
                    "normal_spearman": {
                        "matrix": [[float(normal_corr_spearman.loc[v1, v2]) if np.isfinite(normal_corr_spearman.loc[v1, v2]) else 0.0 
                                   for v2 in numerical_cols] for v1 in numerical_cols],
                        "labels": numerical_cols
                    }
                },
                "correlation_differences": list(correlation_differences.values()),
                "significant_differences": significant_differences,
                "difference_matrix": {
                    "matrix": diff_matrix,
                    "labels": numerical_cols
                },
                "interpretation": interpretation,
                "summary": {
                    "total_pairs_analyzed": len(correlation_differences),
                    "significant_differences_count": len(significant_differences),
                    "percentage_significant": round((len(significant_differences) / len(correlation_differences) * 100) if correlation_differences else 0, 2)
                }
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en análisis de correlaciones comparativo: {str(e)}"}
    
    def _interpret_correlation_difference(self, outliers_r: float, normal_r: float, var1: str, var2: str) -> str:
        """Interpreta la diferencia entre correlaciones de outliers y normales"""
        diff = abs(outliers_r - normal_r)
        
        if outliers_r > 0.7 and normal_r < 0.3:
            return f"Correlación fuerte positiva en outliers ({outliers_r:.2f}) pero débil en normales ({normal_r:.2f}). Los outliers muestran una relación más estrecha entre {var1} y {var2}."
        elif outliers_r < -0.7 and normal_r > -0.3:
            return f"Correlación fuerte negativa en outliers ({outliers_r:.2f}) pero débil en normales ({normal_r:.2f}). Los outliers muestran una relación inversa más marcada entre {var1} y {var2}."
        elif outliers_r > 0.5 and normal_r < 0:
            return f"Correlación positiva en outliers ({outliers_r:.2f}) pero negativa en normales ({normal_r:.2f}). Patrón inverso entre grupos."
        elif outliers_r < 0 and normal_r > 0.5:
            return f"Correlación negativa en outliers ({outliers_r:.2f}) pero positiva en normales ({normal_r:.2f}). Patrón inverso entre grupos."
        elif diff > 0.5:
            return f"Diferencia sustancial en correlación (outliers: {outliers_r:.2f}, normales: {normal_r:.2f}). Los outliers tienen un patrón de relación diferente entre {var1} y {var2}."
        else:
            return f"Diferencia moderada en correlación (outliers: {outliers_r:.2f}, normales: {normal_r:.2f})."
    
    def _get_variable_category(self, var_name: str) -> str:
        """Identifica la categoría de una variable (gen, bioquímico, etc.)"""
        var_upper = var_name.upper()
        
        # Genes y factores de transcripción
        genes = ['STAT3', 'STAT4', 'STAT5', 'STAT6', 'TBET', 'TGFB', 'TNFALFA', 'TNF-ALFA', 
                 'IL17', 'IL-17', 'RORGT', 'SOCS1', 'SOCS3', 'FOXP3', 'GATA3']
        
        # Marcadores bioquímicos
        biochemical = ['ACIDOURICO', 'BUN', 'COLESTEROL', 'CREATININ', 'GLUCOS', 'GLUCOSA',
                      'HB1AC', 'HBA1C', 'TG', 'TRIGLICERIDOS', 'UREA']
        
        if any(gene in var_upper for gene in genes):
            return 'gen'
        elif any(bio in var_upper for bio in biochemical):
            return 'bioquimico'
        else:
            return 'otro'
    
    def _get_clinical_mechanism(self, var1: str, var2: str, outliers_r: float, normal_r: float) -> str:
        """Genera explicación clínica específica para un par de variables"""
        cat1 = self._get_variable_category(var1)
        cat2 = self._get_variable_category(var2)
        diff = abs(outliers_r - normal_r)
        
        # Casos específicos conocidos
        var1_upper = var1.upper()
        var2_upper = var2.upper()
        
        # STAT y citocinas
        if 'STAT' in var1_upper and ('TNF' in var2_upper or 'IL' in var2_upper):
            if outliers_r > 0.7:
                return f"Los outliers muestran una correlación fuerte positiva entre {var1} y {var2} (r={outliers_r:.2f}), sugiriendo una activación coordinada de la señalización de STAT por citocinas proinflamatorias. Esto puede indicar un estado de inflamación crónica o activación inmune sostenida en estos pacientes."
            elif outliers_r < -0.7:
                return f"Los outliers muestran una correlación fuerte negativa entre {var1} y {var2} (r={outliers_r:.2f}), sugiriendo una desregulación en la señalización de STAT o mecanismos de retroalimentación negativa alterados."
        
        # TGFB y STAT
        if 'TGFB' in var1_upper and 'STAT' in var2_upper:
            if outliers_r > 0.7:
                return f"La correlación fuerte positiva entre {var1} y {var2} (r={outliers_r:.2f}) en outliers sugiere una activación coordinada de la vía de señalización TGF-β/STAT, asociada con procesos de fibrosis, inmunosupresión o diferenciación celular alterada."
        
        # TBET y STAT4 (diferenciación Th1)
        if ('TBET' in var1_upper or 'TBET' in var2_upper) and ('STAT4' in var1_upper or 'STAT4' in var2_upper):
            if outliers_r > 0.7:
                return f"La correlación fuerte positiva entre {var1} y {var2} (r={outliers_r:.2f}) en outliers indica una diferenciación Th1 coordinada, sugiriendo una respuesta inmune tipo 1 exagerada o desregulada."
        
        # SOCS y STAT (retroalimentación negativa)
        if 'SOCS' in var1_upper and 'STAT' in var2_upper:
            if outliers_r < -0.5:
                return f"La correlación negativa entre {var1} y {var2} (r={outliers_r:.2f}) en outliers sugiere que los mecanismos de retroalimentación negativa SOCS están funcionando, pero de manera diferente a la población normal, posiblemente indicando resistencia a la señalización de STAT."
        
        # Bioquímicos y genes
        if (cat1 == 'bioquimico' and cat2 == 'gen') or (cat1 == 'gen' and cat2 == 'bioquimico'):
            bio_var = var1 if cat1 == 'bioquimico' else var2
            gen_var = var2 if cat1 == 'bioquimico' else var1
            
            if outliers_r > 0.6:
                return f"La correlación positiva entre {bio_var} (marcador bioquímico) y {gen_var} (factor de transcripción/gen) (r={outliers_r:.2f}) en outliers sugiere que los valores extremos bioquímicos pueden estar asociados con alteraciones en la expresión o actividad de {gen_var}, posiblemente reflejando un estado metabólico o inflamatorio alterado."
            elif outliers_r < -0.6:
                return f"La correlación negativa entre {bio_var} y {gen_var} (r={outliers_r:.2f}) en outliers sugiere mecanismos compensatorios o de regulación inversa entre parámetros bioquímicos y expresión génica."
        
        # Bioquímicos entre sí
        if cat1 == 'bioquimico' and cat2 == 'bioquimico':
            if 'CREATININ' in var1_upper and 'UREA' in var2_upper or 'UREA' in var1_upper and 'CREATININ' in var2_upper:
                if outliers_r > 0.7:
                    return f"La correlación fuerte positiva entre {var1} y {var2} (r={outliers_r:.2f}) en outliers sugiere una función renal alterada, donde ambos marcadores de función renal están elevados de manera coordinada, posiblemente indicando insuficiencia renal o daño glomerular."
            
            if 'GLUCOS' in var1_upper or 'GLUCOS' in var2_upper:
                if outliers_r > 0.6:
                    return f"La correlación positiva entre {var1} y {var2} (r={outliers_r:.2f}) en outliers puede reflejar alteraciones metabólicas, posiblemente relacionadas con resistencia a la insulina o síndrome metabólico."
        
        # Genes entre sí (redes de señalización)
        if cat1 == 'gen' and cat2 == 'gen':
            if outliers_r > 0.7:
                return f"La correlación fuerte positiva entre {var1} y {var2} (r={outliers_r:.2f}) en outliers indica una co-activación coordinada de estas vías de señalización, sugiriendo que los outliers pueden tener una activación simultánea de múltiples rutas de señalización que normalmente están más independientes."
            elif outliers_r < -0.7:
                return f"La correlación fuerte negativa entre {var1} y {var2} (r={outliers_r:.2f}) en outliers sugiere una regulación cruzada o mecanismos de compensación entre estas vías, posiblemente indicando un desequilibrio en la diferenciación celular o respuesta inmune."
        
        # Patrón inverso (muy significativo clínicamente)
        if (outliers_r > 0.5 and normal_r < -0.3) or (outliers_r < -0.5 and normal_r > 0.3):
            return f"PATRÓN INVERSO CRÍTICO: Los outliers muestran una correlación {'positiva' if outliers_r > 0 else 'negativa'} (r={outliers_r:.2f}) entre {var1} y {var2}, mientras que en la población normal es {'negativa' if normal_r < 0 else 'positiva'} (r={normal_r:.2f}). Esto sugiere un mecanismo fisiopatológico fundamentalmente diferente en los outliers, posiblemente indicando un fenotipo distinto o una desregulación severa de las vías de señalización normales."
        
        # Correlación fuerte en outliers pero débil en normales
        if abs(outliers_r) > 0.7 and abs(normal_r) < 0.3:
            direction = "positiva" if outliers_r > 0 else "negativa"
            return f"Los outliers muestran una correlación fuerte {direction} (r={outliers_r:.2f}) entre {var1} y {var2}, mientras que en la población normal esta relación es débil (r={normal_r:.2f}). Esto sugiere que los outliers tienen una relación más estrecha y coordinada entre estas variables, posiblemente reflejando un estado patológico o una respuesta adaptativa extrema."
        
        # Diferencia sustancial
        if diff > 0.5:
            return f"Diferencia sustancial en la correlación entre {var1} y {var2}: outliers muestran r={outliers_r:.2f} vs normales r={normal_r:.2f}. Los outliers tienen un patrón de relación diferente, sugiriendo alteraciones en las vías de señalización o mecanismos reguladores normales."
        
        return f"Diferencia moderada en correlación entre {var1} y {var2} (outliers: r={outliers_r:.2f}, normales: r={normal_r:.2f})."
    
    def _generate_correlation_interpretation(self, significant_differences: List[Dict], 
                                            outliers_count: int, normal_count: int,
                                            variables: List[str]) -> Dict[str, Any]:
        """Genera interpretación clínica detallada y dinámica de los hallazgos de correlaciones"""
        
        if not significant_differences:
            return {
                "overall_interpretation": "No se encontraron diferencias significativas en los patrones de correlación entre outliers y datos normales. Esto sugiere que las relaciones entre variables biológicas son similares en ambos grupos, indicando que los outliers pueden representar variaciones extremas pero dentro del mismo marco fisiopatológico.",
                "clinical_implications": [
                    "Los outliers no muestran patrones de correlación distintos de la población normal.",
                    "Las relaciones entre variables biológicas son consistentes independientemente de los valores extremos.",
                    "Los outliers pueden representar variaciones extremas pero dentro del mismo patrón de relaciones biológicas normales."
                ],
                "recommendations": [
                    "Considerar otros factores (variables categóricas, factores externos, comorbilidades) para explicar los outliers.",
                    "Revisar si los outliers son errores de medición o representan casos clínicos genuinos con características extremas pero normales.",
                    "Explorar análisis multivariados adicionales (análisis de componentes principales, clustering) para identificar patrones no capturados por correlaciones simples."
                ],
                "detailed_analysis": []
            }
        
        # Clasificar variables
        genes = [v for v in variables if self._get_variable_category(v) == 'gen']
        biochemicals = [v for v in variables if self._get_variable_category(v) == 'bioquimico']
        
        # Analizar patrones de diferencias
        strong_positive_in_outliers = [d for d in significant_differences 
                                      if d['outliers_pearson_r'] > 0.7 and d['normal_pearson_r'] < 0.3]
        strong_negative_in_outliers = [d for d in significant_differences 
                                      if d['outliers_pearson_r'] < -0.7 and d['normal_pearson_r'] > -0.3]
        reversed_patterns = [d for d in significant_differences 
                            if (d['outliers_pearson_r'] > 0 and d['normal_pearson_r'] < 0) or
                               (d['outliers_pearson_r'] < 0 and d['normal_pearson_r'] > 0)]
        
        # Generar análisis detallado para cada diferencia significativa
        detailed_analysis = []
        for diff in significant_differences:
            mechanism = self._get_clinical_mechanism(
                diff['variable1'], 
                diff['variable2'], 
                diff['outliers_pearson_r'], 
                diff['normal_pearson_r']
            )
            detailed_analysis.append({
                "variables": f"{diff['variable1']} - {diff['variable2']}",
                "outliers_correlation": diff['outliers_pearson_r'],
                "normal_correlation": diff['normal_pearson_r'],
                "difference": diff['difference'],
                "p_value": diff.get('p_value_diff'),
                "mechanism_explanation": mechanism
            })
        
        # Construir interpretación general
        interpretation_parts = []
        clinical_implications = []
        pathophysiological_mechanisms = []
        recommendations = []
        
        # Interpretación general
        interpretation_parts.append(
            f"Se identificaron {len(significant_differences)} par(es) de variables con diferencias significativas en sus patrones de correlación entre outliers (n={outliers_count}) y datos normales (n={normal_count})."
        )
        
        # Patrones específicos
        if reversed_patterns:
            interpretation_parts.append(
                f"CRÍTICO: {len(reversed_patterns)} par(es) muestran patrones de correlación INVERSOS entre grupos, sugiriendo mecanismos fisiopatológicos fundamentalmente diferentes en los outliers."
            )
            pathophysiological_mechanisms.append(
                "Los patrones inversos indican que los outliers pueden tener una desregulación severa de las vías de señalización normales, posiblemente reflejando un fenotipo patológico distinto o una respuesta adaptativa extrema."
            )
        
        if strong_positive_in_outliers:
            interpretation_parts.append(
                f"{len(strong_positive_in_outliers)} par(es) muestran correlaciones fuertes positivas en outliers pero débiles en normales, sugiriendo co-activación coordinada de vías específicas."
            )
            pathophysiological_mechanisms.append(
                "Las correlaciones fuertes positivas en outliers pueden indicar activación simultánea de múltiples vías de señalización que normalmente están más independientes, posiblemente reflejando un estado de activación inmune o metabólica sostenida."
            )
        
        if strong_negative_in_outliers:
            interpretation_parts.append(
                f"{len(strong_negative_in_outliers)} par(es) muestran correlaciones fuertes negativas en outliers, sugiriendo mecanismos compensatorios o de retroalimentación alterados."
            )
            pathophysiological_mechanisms.append(
                "Las correlaciones negativas fuertes pueden reflejar mecanismos de compensación o regulación cruzada entre vías, posiblemente indicando intentos del sistema de mantener la homeostasis frente a alteraciones extremas."
            )
        
        # Análisis por categorías de variables
        gene_biochemical_pairs = [d for d in significant_differences 
                                  if (self._get_variable_category(d['variable1']) == 'gen' and 
                                      self._get_variable_category(d['variable2']) == 'bioquimico') or
                                     (self._get_variable_category(d['variable1']) == 'bioquimico' and 
                                      self._get_variable_category(d['variable2']) == 'gen')]
        
        if gene_biochemical_pairs:
            clinical_implications.append(
                f"Se encontraron {len(gene_biochemical_pairs)} diferencia(s) significativa(s) entre genes/factores de transcripción y marcadores bioquímicos. Esto sugiere que los valores extremos bioquímicos en outliers pueden estar asociados con alteraciones en la expresión o actividad de factores de transcripción, reflejando estados metabólicos o inflamatorios alterados."
            )
        
        gene_gene_pairs = [d for d in significant_differences 
                          if self._get_variable_category(d['variable1']) == 'gen' and 
                             self._get_variable_category(d['variable2']) == 'gen']
        
        if gene_gene_pairs:
            clinical_implications.append(
                f"Se identificaron {len(gene_gene_pairs)} diferencia(s) en correlaciones entre genes/factores de transcripción. Los outliers muestran patrones de co-activación o regulación cruzada alterados entre vías de señalización, lo cual puede indicar desregulación en la diferenciación celular, respuesta inmune o procesos inflamatorios."
            )
        
        biochemical_biochemical_pairs = [d for d in significant_differences 
                                         if self._get_variable_category(d['variable1']) == 'bioquimico' and 
                                            self._get_variable_category(d['variable2']) == 'bioquimico']
        
        if biochemical_biochemical_pairs:
            clinical_implications.append(
                f"Se encontraron {len(biochemical_biochemical_pairs)} diferencia(s) en correlaciones entre marcadores bioquímicos. Los outliers pueden tener alteraciones coordinadas en múltiples parámetros metabólicos o de función orgánica, posiblemente reflejando síndromes metabólicos, disfunción orgánica o estados patológicos específicos."
            )
        
        # Implicaciones clínicas generales
        if len(significant_differences) > len(variables) * 0.3:  # Más del 30% de pares posibles
            clinical_implications.append(
                f"El alto número de diferencias significativas ({len(significant_differences)} pares) indica que los outliers tienen un perfil de correlaciones sustancialmente diferente, sugiriendo que pueden representar un subgrupo con características fisiopatológicas distintas que requieren investigación adicional y posiblemente enfoques terapéuticos diferenciados."
            )
        
        # Recomendaciones específicas
        recommendations.extend([
            "Revisar la literatura clínica específica sobre las relaciones entre las variables que muestran diferencias significativas, especialmente aquellas con patrones inversos o correlaciones muy fuertes.",
            "Considerar análisis adicionales (clustering, análisis de componentes principales) para identificar si los outliers forman subgrupos clínicamente relevantes con perfiles similares.",
            "Evaluar factores de confusión potenciales (edad, sexo, comorbilidades, tratamientos) que puedan explicar las diferencias en correlaciones.",
            "Explorar análisis de interacciones y modelos multivariados para entender mejor cómo se relacionan las variables en outliers y identificar posibles mecanismos causales.",
            "Considerar estudios funcionales o experimentales para validar las relaciones identificadas, especialmente para pares con patrones inversos o correlaciones muy fuertes."
        ])
        
        overall = " ".join(interpretation_parts)
        
        return {
            "overall_interpretation": overall,
            "clinical_implications": clinical_implications if clinical_implications else [
                "Los outliers muestran patrones de correlación distintos que pueden tener implicaciones clínicas importantes para el diagnóstico, pronóstico o tratamiento."
            ],
            "pathophysiological_mechanisms": pathophysiological_mechanisms if pathophysiological_mechanisms else [
                "Las diferencias en correlaciones sugieren alteraciones en las vías de señalización normales, posiblemente reflejando estados patológicos o respuestas adaptativas extremas."
            ],
            "recommendations": recommendations,
            "detailed_analysis": detailed_analysis,
            "key_findings": [
                f"Total de diferencias significativas: {len(significant_differences)}",
                f"Outliers analizados: {outliers_count}",
                f"Datos normales analizados: {normal_count}",
                f"Variables analizadas: {len(variables)}",
                f"Variables genéticas/factores de transcripción: {len(genes)}",
                f"Marcadores bioquímicos: {len(biochemicals)}"
            ]
        }
    
    def clustering_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], variables: List[str], outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """Análisis de clustering para determinar el número óptimo de clústeres (k)"""
        try:
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
            
            
            # Filtrar solo las variables numéricas seleccionadas
            numerical_vars = []
            for var in variables:
                if var in variable_types and variable_types[var].startswith('cuantitativa'):
                    numerical_vars.append(var)
            
            if len(numerical_vars) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas para clustering"}
            
            
            # IMPORTANTE: Filtrar solo outliers para el clustering
            final_outliers = None
            subject_id_column = None
            if outlier_results and isinstance(outlier_results, dict):
                final_outliers = outlier_results.get('final_outliers') or None
                subject_id_column = outlier_results.get('subject_id_column')
            
            outliers_df = self._select_outliers_df(df, final_outliers, subject_id_column)
            if outliers_df is None:
                if 'es_outlier' not in df.columns:
                    return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame y no hay lista de outliers final disponible."}
                outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            
            # No eliminar duplicados aquí: preservar el conteo del listado final
            
            # Obtener conteo de outliers basado en las observaciones realmente usadas
            outliers_count = len(outliers_df)
            
            # Si no hay columna de ID, pero hay conteo reportado, evitar inconsistencias con datos duplicados
            if not (subject_id_column and subject_id_column in outliers_df.columns):
                reported_count = None
                if outlier_results and isinstance(outlier_results, dict):
                    if 'outliers_detected' in outlier_results and outlier_results['outliers_detected'] is not None:
                        try:
                            reported_count = int(outlier_results['outliers_detected'])
                        except (ValueError, TypeError):
                            reported_count = None
                    elif 'final_outliers' in outlier_results and outlier_results['final_outliers'] is not None:
                        try:
                            reported_count = len(outlier_results['final_outliers'])
                        except (TypeError):
                            reported_count = None
                if reported_count is not None and reported_count != outliers_count:
                    pass

            
            # Preparar datos para clustering (solo outliers únicos)
            df_cluster = outliers_df[numerical_vars].copy()
            
            # Imputar valores faltantes para no reducir la muestra (usar mediana por columna)
            missing_cols = [col for col in df_cluster.columns if df_cluster[col].isna().any()]
            if missing_cols:
                medians = df_cluster.median(numeric_only=True)
                if medians.isna().any():
                    return {
                        "error": "No se puede imputar valores faltantes porque una o más variables tienen solo valores NaN.",
                        "missing_columns": [col for col in df_cluster.columns if df_cluster[col].isna().all()]
                    }
                df_cluster = df_cluster.fillna(medians)
            
            # Actualizar conteo de muestra según datos realmente usados
            outliers_count = len(df_cluster)
            
            if outliers_count < 3:
                return {
                    "error": f"Insufficient outliers for clustering. Detected: {outliers_count}, Minimum required: 3.",
                    "outliers_detected": outliers_count,
                    "minimum_required": 3
                }
            
            insufficient_data_warning = None
            if len(df_cluster) < 10:
                insufficient_data_warning = {
                    "message": f"Advertencia: Pocas observaciones para clustering. Se requieren al menos 10 observaciones, pero solo hay {len(df_cluster)} disponibles. Los resultados pueden no ser confiables.",
                    "available_data_points": len(df_cluster),
                    "minimum_required": 10,
                    "status": "warning_insufficient_data"
                }
            
            
            # Estandarizar variables
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(df_cluster)
            
            # Definir rango de k a evaluar
            k_range = range(2, min(11, len(df_cluster) // 2 + 1))
            
            # Métricas para evaluar
            wss_scores = []  # Within Sum of Squares (Elbow Method)
            silhouette_scores = []
            calinski_scores = []
            davies_scores = []
            
            
            # Calcular métricas para cada k
            for k in k_range:
                try:
                    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                    cluster_labels = kmeans.fit_predict(data_scaled)
                    
                    # Within Sum of Squares (Elbow Method)
                    wss = kmeans.inertia_
                    wss_scores.append(float(wss))
                    
                    # Silhouette Score (mayor es mejor)
                    if k > 1:  # Silhouette requiere al menos 2 clústeres
                        sil_score = silhouette_score(data_scaled, cluster_labels)
                        silhouette_scores.append(float(sil_score))
                    else:
                        silhouette_scores.append(0.0)
                    
                    # Calinski-Harabasz Score (mayor es mejor)
                    if k > 1:
                        cal_score = calinski_harabasz_score(data_scaled, cluster_labels)
                        calinski_scores.append(float(cal_score))
                    else:
                        calinski_scores.append(0.0)
                    
                    # Davies-Bouldin Score (menor es mejor)
                    if k > 1:
                        db_score = davies_bouldin_score(data_scaled, cluster_labels)
                        davies_scores.append(float(db_score))
                    else:
                        davies_scores.append(float('inf'))
                        
                except Exception as e:
                    wss_scores.append(0.0)
                    silhouette_scores.append(0.0)
                    calinski_scores.append(0.0)
                    davies_scores.append(float('inf'))
            
            # Determinar k óptimo para cada método
            k_values = list(k_range)
            
            # Método del Codo (Elbow Method)
            # Buscar el punto donde la reducción en WSS se estabiliza
            # Usar el método de la segunda derivada mejorado
            if len(wss_scores) >= 3:
                # Calcular primera derivada (reducción en WSS)
                wss_diffs = [wss_scores[i-1] - wss_scores[i] for i in range(1, len(wss_scores))]
                # Calcular segunda derivada (cambio en la tasa de reducción)
                if len(wss_diffs) >= 2:
                    wss_diffs2 = [wss_diffs[i-1] - wss_diffs[i] for i in range(1, len(wss_diffs))]
                    if wss_diffs2:
                        # El codo está donde la segunda derivada es máxima (mayor cambio en la tasa de reducción)
                        max_diff2_idx = wss_diffs2.index(max(wss_diffs2))
                        # El índice en k_values corresponde a max_diff2_idx + 2 (porque empezamos desde k=2)
                        if max_diff2_idx + 2 < len(k_values):
                            elbow_k = k_values[max_diff2_idx + 2]
                        else:
                            # Fallback: usar el punto medio del rango
                            elbow_k = k_values[len(k_values) // 2]
                    else:
                        elbow_k = k_values[len(k_values) // 2]
                else:
                    elbow_k = k_values[len(k_values) // 2]
            elif len(wss_scores) == 2:
                # Si solo hay 2 puntos, elegir el primero (k=2)
                elbow_k = k_values[0]
            else:
                elbow_k = k_values[0] if k_values else 2
            
            # Coeficiente de Silueta (máximo)
            if silhouette_scores:
                silhouette_k = k_values[silhouette_scores.index(max(silhouette_scores))]
            else:
                silhouette_k = k_values[0]
            
            # Calinski-Harabasz (máximo)
            if calinski_scores:
                calinski_k = k_values[calinski_scores.index(max(calinski_scores))]
            else:
                calinski_k = k_values[0]
            
            # Davies-Bouldin (mínimo)
            if davies_scores and any(np.isfinite(score) for score in davies_scores):
                valid_davies = [score if np.isfinite(score) else float('inf') for score in davies_scores]
                davies_k = k_values[valid_davies.index(min(valid_davies))]
            else:
                davies_k = k_values[0]
            
            # ESTRATEGIA DE DECISIÓN: Priorizar Silhouette Score
            # Según la literatura, Silhouette es el método más robusto
            # Los demás métodos se usan como validación y contexto
            
            # Obtener el Silhouette Score del K óptimo sugerido por Silhouette
            silhouette_idx = k_values.index(silhouette_k)
            silhouette_score_at_optimal = silhouette_scores[silhouette_idx] if silhouette_idx < len(silhouette_scores) else 0.0
            
            # Calcular votos de todos los métodos para contexto
            votes = [elbow_k, silhouette_k, calinski_k, davies_k]
            from collections import Counter
            vote_counts = Counter(votes)
            
            # Decisión basada en prioridad de Silhouette
            recommended_k = silhouette_k  # Por defecto, usar Silhouette
            
            # Si Silhouette Score es alto (>0.5), confiar completamente en él
            if silhouette_score_at_optimal > 0.5:
                recommended_k = silhouette_k
                decision_reasoning = f"Silhouette Score alto ({silhouette_score_at_optimal:.3f}) - método más robusto según literatura"
            else:
                # Si Silhouette no es claro, considerar otros métodos pero aún priorizar Silhouette
                # Verificar si otros métodos coinciden con Silhouette
                # Si Silhouette coincide con mayoría, usarlo
                if vote_counts[silhouette_k] >= 2:
                    recommended_k = silhouette_k
                    decision_reasoning = f"Silhouette Score ({silhouette_score_at_optimal:.3f}) coincide con otros métodos - priorizado por robustez"
                else:
                    # Si Silhouette difiere mucho, aún así priorizarlo pero documentar discrepancias
                    recommended_k = silhouette_k
                    other_methods = [elbow_k, calinski_k, davies_k]
                    differing_methods = [k for k in other_methods if k != silhouette_k]
                    decision_reasoning = f"Silhouette Score ({silhouette_score_at_optimal:.3f}) priorizado como método más robusto. Otros métodos sugieren: {sorted(set(differing_methods))}"
            
            # Guardar información de la decisión
            decision_info = {
                "primary_method": "Silhouette Score",
                "recommended_k": int(recommended_k),
                "silhouette_score_at_k": float(silhouette_score_at_optimal),
                "reasoning": decision_reasoning,
                "all_methods_suggestions": {
                    "elbow": int(elbow_k),
                    "silhouette": int(silhouette_k),
                    "calinski_harabasz": int(calinski_k),
                    "davies_bouldin": int(davies_k)
                },
                "agreement_count": vote_counts.get(recommended_k, 1)
            }
            
            # Crear tabla de resultados
            results_table = []
            for i, k in enumerate(k_values):
                results_table.append({
                    "k": int(k),
                    "wss": float(wss_scores[i]),
                    "silhouette": float(silhouette_scores[i]),
                    "calinski_harabasz": float(calinski_scores[i]),
                    "davies_bouldin": float(davies_scores[i]) if np.isfinite(davies_scores[i]) else None,
                    "is_elbow_optimal": k == elbow_k,
                    "is_silhouette_optimal": k == silhouette_k,
                    "is_calinski_optimal": k == calinski_k,
                    "is_davies_optimal": k == davies_k,
                    "is_recommended": k == recommended_k
                })
            
            # Datos para el gráfico del método del codo
            elbow_plot_data = {
                "k_values": [int(k) for k in k_values],
                "wss_values": [float(wss) for wss in wss_scores],
                "optimal_k": int(recommended_k)
            }
            
            # Resumen de recomendaciones
            recommendations = {
                "elbow_method": int(elbow_k),
                "silhouette_method": int(silhouette_k),
                "calinski_harabasz_method": int(calinski_k),
                "davies_bouldin_method": int(davies_k),
                "final_recommendation": int(recommended_k),
                "vote_distribution": dict(vote_counts)
            }
            
            result = {
                "variables_used": numerical_vars,
                "sample_size": outliers_count,  # Conteo de observaciones usadas en clustering
                "k_range": [int(k) for k in k_values],
                "results_table": results_table,
                "elbow_plot_data": elbow_plot_data,
                "recommendations": recommendations,
                "available_variables": [var for var in variables if var in variable_types and variable_types[var].startswith('cuantitativa')],
                "missing_value_imputation": {
                    "applied": bool(missing_cols),
                    "columns": missing_cols
                }
            }
            
            # Agregar advertencia si existe
            if insufficient_data_warning:
                result.update(insufficient_data_warning)
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Error en análisis de clustering: {str(e)}"}
    
    def apply_kmeans_visualization(self, df: pd.DataFrame, variable_types: Dict[str, str], variables: List[str], optimal_k: int, outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """Aplicar K-means y generar visualización con PCA"""
        try:
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            from sklearn.decomposition import PCA
            from scipy.stats import chi2
            import numpy as np
            
            
            # Filtrar solo las variables numéricas seleccionadas
            numerical_vars = []
            for var in variables:
                if var in variable_types and variable_types[var].startswith('cuantitativa'):
                    numerical_vars.append(var)
            
            if len(numerical_vars) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas para clustering"}
            
            
            # IMPORTANTE: Filtrar solo outliers para el clustering
            final_outliers = None
            subject_id_column = None
            if outlier_results and isinstance(outlier_results, dict):
                final_outliers = outlier_results.get('final_outliers') or None
                subject_id_column = outlier_results.get('subject_id_column')
            
            outliers_df = self._select_outliers_df(df, final_outliers, subject_id_column)
            if outliers_df is None:
                if 'es_outlier' not in df.columns:
                    return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame y no hay lista de outliers final disponible."}
                outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            
            # No eliminar duplicados aquí: preservar el conteo del listado final
            
            # Obtener conteo de outliers basado en las observaciones realmente usadas
            outliers_count = len(outliers_df)
            
            # Si no hay columna de ID, pero hay conteo reportado, evitar inconsistencias con datos duplicados
            if not (subject_id_column and subject_id_column in outliers_df.columns):
                reported_count = None
                if outlier_results and isinstance(outlier_results, dict):
                    if 'outliers_detected' in outlier_results and outlier_results['outliers_detected'] is not None:
                        try:
                            reported_count = int(outlier_results['outliers_detected'])
                        except (ValueError, TypeError):
                            reported_count = None
                    elif 'final_outliers' in outlier_results and outlier_results['final_outliers'] is not None:
                        try:
                            reported_count = len(outlier_results['final_outliers'])
                        except (TypeError):
                            reported_count = None
                if reported_count is not None and reported_count != outliers_count:
                    pass

            
            # Preparar datos para clustering (solo outliers únicos)
            df_cluster = outliers_df[numerical_vars].copy()
            
            # Imputar valores faltantes para no reducir la muestra (usar mediana por columna)
            missing_cols = [col for col in df_cluster.columns if df_cluster[col].isna().any()]
            if missing_cols:
                medians = df_cluster.median(numeric_only=True)
                if medians.isna().any():
                    return {
                        "error": "No se puede imputar valores faltantes porque una o más variables tienen solo valores NaN.",
                        "missing_columns": [col for col in df_cluster.columns if df_cluster[col].isna().all()]
                    }
                df_cluster = df_cluster.fillna(medians)
            
            # Actualizar conteo de muestra según datos realmente usados
            outliers_count = len(df_cluster)
            
            if outliers_count < optimal_k:
                return {
                    "error": f"Insufficient outliers for clustering. Detected: {outliers_count}, Minimum required: {optimal_k}.",
                    "outliers_detected": outliers_count,
                    "minimum_required": optimal_k
                }
            
            insufficient_data_warning = None
            if outliers_count < 10:
                insufficient_data_warning = {
                    "message": f"Advertencia: Pocas observaciones para clustering. Se recomienda al menos 10 observaciones, pero solo hay {outliers_count} disponibles. Los resultados pueden no ser confiables.",
                    "available_data_points": outliers_count,
                    "minimum_required": 10,
                    "status": "warning_insufficient_data"
                }
            
            
            # Estandarizar variables
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(df_cluster)
            
            # MÉTODO K-MEANS (Particional):
            # - Divide los datos en K grupos optimizando la distancia a los centroides
            # - Algoritmo iterativo que minimiza la suma de cuadrados intra-cluster (WSS)
            # - Se aplica directamente en el espacio original escalado (todas las variables)
            # - Produce clusters esféricos/convexos
            kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(data_scaled)
            
            # Aplicar PCA SOLO para visualización 2D (después del clustering)
            # El clustering se hizo en el espacio completo de variables originales
            pca = PCA(n_components=2)
            pca_coords = pca.fit_transform(data_scaled)
            
            # Calcular estadísticas de los clústeres
            cluster_stats = []
            for i in range(optimal_k):
                cluster_mask = cluster_labels == i
                cluster_size = np.sum(cluster_mask)
                cluster_percentage = (cluster_size / len(cluster_labels)) * 100
                
                # Calcular centroide del clúster en espacio PCA
                cluster_pca_coords = pca_coords[cluster_mask]
                centroid_pca = np.mean(cluster_pca_coords, axis=0)
                
                # Calcular elipse de confianza (95%)
                if cluster_size > 2:
                    # Calcular matriz de covarianza
                    cov_matrix = np.cov(cluster_pca_coords.T)
                    
                    # Calcular eigenvalores y eigenvectores
                    eigenvals, eigenvecs = np.linalg.eigh(cov_matrix)
                    
                    # Calcular radio de la elipse (95% de confianza)
                    chi2_val = chi2.ppf(0.95, 2)  # 2 dimensiones
                    ellipse_radii = np.sqrt(chi2_val * eigenvals)
                    
                    # Calcular ángulo de rotación
                    angle = np.arctan2(eigenvecs[1, 0], eigenvecs[0, 0])
                else:
                    ellipse_radii = [0.1, 0.1]
                    angle = 0
                
                cluster_stats.append({
                    "cluster_id": int(i),
                    "size": int(cluster_size),
                    "percentage": float(cluster_percentage),
                    "centroid_pca": [float(centroid_pca[0]), float(centroid_pca[1])],
                    "ellipse_radii": [float(ellipse_radii[0]), float(ellipse_radii[1])],
                    "ellipse_angle": float(angle)
                })
            
            # Preparar datos para visualización
            pca_data = []
            for i in range(len(cluster_labels)):
                pca_data.append({
                    "pc1": float(pca_coords[i, 0]),
                    "pc2": float(pca_coords[i, 1]),
                    "cluster": int(cluster_labels[i]),
                    "original_index": int(df_cluster.index[i])
                })
            
            # Calcular varianza explicada por PCA
            explained_variance = pca.explained_variance_ratio_
            total_variance_explained = np.sum(explained_variance)
            
            # Calcular métricas de calidad del clustering
            from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
            
            silhouette_avg = silhouette_score(data_scaled, cluster_labels)
            calinski_score = calinski_harabasz_score(data_scaled, cluster_labels)
            davies_score = davies_bouldin_score(data_scaled, cluster_labels)
            
            # Información del PCA
            pca_info = {
                "explained_variance_pc1": float(explained_variance[0]),
                "explained_variance_pc2": float(explained_variance[1]),
                "total_variance_explained": float(total_variance_explained),
                "loadings": {}
            }
            
            # Calcular loadings de las variables originales
            for i, var in enumerate(numerical_vars):
                pca_info["loadings"][var] = {
                    "pc1": float(pca.components_[0, i]),
                    "pc2": float(pca.components_[1, i])
                }
            
            result = {
                "optimal_k": int(optimal_k),
                "variables_used": numerical_vars,
                "sample_size": outliers_count,  # Conteo de observaciones usadas en clustering
                "cluster_stats": cluster_stats,
                "pca_data": pca_data,
                "pca_info": pca_info,
                "clustering_metrics": {
                    "silhouette_score": float(silhouette_avg),
                    "calinski_harabasz_score": float(calinski_score),
                    "davies_bouldin_score": float(davies_score)
                },
                "kmeans_model_info": {
                    "inertia": float(kmeans.inertia_),
                    "n_iterations": int(kmeans.n_iter_)
                },
                "missing_value_imputation": {
                    "applied": bool(missing_cols),
                    "columns": missing_cols
                }
            }
            
            # Agregar advertencia si existe
            if insufficient_data_warning:
                result.update(insufficient_data_warning)
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Error en aplicación de K-means: {str(e)}"}
    
    def run_hierarchical_pca_plot(self, df: pd.DataFrame, variable_types: Dict[str, str], variables: List[str], optimal_k: int, id_column: str = None, linkage_method: str = 'ward', outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """Ejecutar clustering jerárquico con PCA y generar dendrogramas"""
        try:
            from sklearn.decomposition import PCA
            from sklearn.preprocessing import StandardScaler
            from scipy.spatial.distance import pdist
            from scipy.cluster.hierarchy import linkage, fcluster, dendrogram
            from scipy.stats import chi2
            import numpy as np
            
            
            # Filtrar solo las variables numéricas seleccionadas
            numerical_vars = []
            for var in variables:
                if var in variable_types and variable_types[var].startswith('cuantitativa'):
                    numerical_vars.append(var)
            
            if len(numerical_vars) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas para clustering"}
            
            
            # IMPORTANTE: Filtrar solo outliers para el clustering jerárquico
            final_outliers = None
            subject_id_column = None
            if outlier_results and isinstance(outlier_results, dict):
                final_outliers = outlier_results.get('final_outliers') or None
                subject_id_column = outlier_results.get('subject_id_column')
            if not subject_id_column and id_column:
                subject_id_column = id_column

            outliers_df = self._select_outliers_df(df, final_outliers, subject_id_column)
            if outliers_df is None:
                if 'es_outlier' not in df.columns:
                    return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame y no hay lista de outliers final disponible."}
                outliers_df = df[df['es_outlier'] == 'Outlier'].copy()


            # Preparar datos para clustering (solo outliers)
            df_cluster = outliers_df[numerical_vars].copy()

            # Imputar valores faltantes para no reducir la muestra (usar mediana por columna)
            missing_cols = [col for col in df_cluster.columns if df_cluster[col].isna().any()]
            if missing_cols:
                medians = df_cluster.median(numeric_only=True)
                if medians.isna().any():
                    return {
                        "error": "No se puede imputar valores faltantes porque una o más variables tienen solo valores NaN.",
                        "missing_columns": [col for col in df_cluster.columns if df_cluster[col].isna().all()]
                    }
                df_cluster = df_cluster.fillna(medians)

            # Conteo de muestra según datos realmente usados
            outliers_count = len(df_cluster)

            if outliers_count < 3:
                return {
                    "error": f"Insufficient outliers for hierarchical clustering. Detected: {outliers_count}, Minimum required: 3.",
                    "outliers_detected": outliers_count,
                    "minimum_required": 3
                }

            # Verificar si hay suficientes datos y crear advertencia si es necesario
            insufficient_data_warning = None
            if outliers_count < 10:
                insufficient_data_warning = {
                    "message": f"Advertencia: Pocas observaciones para clustering jerárquico. Se recomienda al menos 10 observaciones, pero solo hay {outliers_count} disponibles. Los resultados pueden no ser confiables.",
                    "available_data_points": outliers_count,
                    "minimum_required": 10,
                    "status": "warning_insufficient_data"
                }
            
            
            # Estandarizar variables
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(df_cluster)
            
            # IMPORTANTE: El clustering jerárquico se aplica en el ESPACIO ORIGINAL escalado
            # (usando TODAS las variables), NO en espacio PCA reducido
            # Esto es diferente de K-means que también usa el espacio original
            
            # Calcular matriz de distancias en el espacio original escalado
            distances = pdist(data_scaled)
            
            # Aplicar clustering jerárquico con el método seleccionado
            # Los métodos disponibles: 'ward', 'complete', 'average', 'single', 'centroid'
            linkage_matrix = linkage(distances, method=linkage_method)
            
            # IMPORTANTE: Usar el k óptimo calculado previamente (K-means)
            from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

            hierarchical_optimal_k = int(optimal_k) if optimal_k else 2

            if hierarchical_optimal_k < 2 or hierarchical_optimal_k > len(df_cluster):
                return {
                    "error": f"K inválido para clustering jerárquico. Recibido: {hierarchical_optimal_k}, Observaciones disponibles: {len(df_cluster)}.",
                    "outliers_detected": outliers_count,
                    "minimum_required": 2
                }
            
            # Calcular métricas de calidad para el k utilizado
            test_labels = fcluster(linkage_matrix, hierarchical_optimal_k, criterion='maxclust') - 1
            silhouette_avg = silhouette_score(data_scaled, test_labels)
            calinski_score = calinski_harabasz_score(data_scaled, test_labels)
            davies_score = davies_bouldin_score(data_scaled, test_labels)

            
            # Cortar el dendrograma usando el k óptimo determinado
            cluster_labels = fcluster(linkage_matrix, hierarchical_optimal_k, criterion='maxclust')
            
            # Calcular la altura de corte correspondiente al número de clusters
            heights = linkage_matrix[:, 2]
            sorted_heights = np.sort(heights)
            # La altura de corte está entre las últimas (hierarchical_optimal_k-1) fusiones
            if len(sorted_heights) >= hierarchical_optimal_k - 1:
                cut_height_approx = sorted_heights[-(hierarchical_optimal_k - 1)] if hierarchical_optimal_k > 1 else sorted_heights[-1]
            else:
                cut_height_approx = max(heights) * 0.7  # Fallback
            
            # Convertir etiquetas a base 0 para consistencia
            cluster_labels = cluster_labels - 1
            
            # AHORA aplicar PCA solo para visualización (después del clustering)
            pca = PCA(n_components=2)
            pca_coords = pca.fit_transform(data_scaled)
            
            # Calcular estadísticas de los clústeres usando el k óptimo determinado
            unique_clusters = np.unique(cluster_labels)
            actual_k = len(unique_clusters)
            cluster_stats = []
            for i in unique_clusters:
                cluster_mask = cluster_labels == i
                cluster_size = np.sum(cluster_mask)
                cluster_percentage = (cluster_size / len(cluster_labels)) * 100
                
                # Calcular centroide del clúster en espacio PCA
                cluster_pca_coords = pca_coords[cluster_mask]
                centroid_pca = np.mean(cluster_pca_coords, axis=0)
                
                # Calcular elipse de confianza (95%)
                if cluster_size > 2:
                    # Calcular matriz de covarianza
                    cov_matrix = np.cov(cluster_pca_coords.T)
                    
                    # Calcular eigenvalores y eigenvectores
                    eigenvals, eigenvecs = np.linalg.eigh(cov_matrix)
                    
                    # Calcular radio de la elipse (95% de confianza)
                    chi2_val = chi2.ppf(0.95, 2)  # 2 dimensiones
                    ellipse_radii = np.sqrt(chi2_val * eigenvals)
                    
                    # Calcular ángulo de rotación
                    angle = np.arctan2(eigenvecs[1, 0], eigenvecs[0, 0])
                else:
                    ellipse_radii = [0.1, 0.1]
                    angle = 0
                
                cluster_stats.append({
                    "cluster_id": int(i),
                    "size": int(cluster_size),
                    "percentage": float(cluster_percentage),
                    "centroid_pca": [float(centroid_pca[0]), float(centroid_pca[1])],
                    "ellipse_radii": [float(ellipse_radii[0]), float(ellipse_radii[1])],
                    "ellipse_angle": float(angle)
                })
            
            # Preparar datos para visualización PCA
            pca_data = []
            # Crear mapeo de índice original a cluster para el dendrograma
            index_to_cluster = {}
            for i in range(len(cluster_labels)):
                original_idx = int(df_cluster.index[i])
                index_to_cluster[original_idx] = int(cluster_labels[i])
                
                point_data = {
                    "pc1": float(pca_coords[i, 0]),
                    "pc2": float(pca_coords[i, 1]),
                    "cluster": int(cluster_labels[i]),
                    "original_index": original_idx
                }
                
                # Añadir ID si está disponible
                if id_column and id_column in df.columns:
                    # Usar .loc porque df_cluster.index[i] es el índice del DataFrame original, no una posición
                    point_data["id"] = str(df.loc[df_cluster.index[i], id_column])
                
                pca_data.append(point_data)
            
            # Calcular varianza explicada por PCA (solo para visualización)
            explained_variance = pca.explained_variance_ratio_
            total_variance_explained = np.sum(explained_variance)
            
            # Calcular métricas de calidad del clustering jerárquico
            # IMPORTANTE: Las métricas se calculan en el ESPACIO ORIGINAL escalado
            # (donde se aplicó el clustering jerárquico), NO en el espacio PCA reducido
            # Ya calculadas arriba para el k utilizado: silhouette_avg, calinski_score, davies_score
            
            
            # Generar datos para dendrogramas con colores según clusters
            # Usar fcluster para obtener los clusters y colorear el dendrograma
            dendrogram_data = dendrogram(
                linkage_matrix, 
                no_plot=True,
                color_threshold=0.7 * max(linkage_matrix[:, 2])  # Umbral para colorear
            )
            
            # Crear mapeo de índices a IDs para las etiquetas del eje X
            leaf_labels = []
            if id_column and id_column in df.columns:
                # Usar IDs de la columna especificada
                for leaf_idx in dendrogram_data['leaves']:
                    original_idx = df_cluster.index[leaf_idx]
                    # Usar .loc porque original_idx es el índice del DataFrame original, no una posición
                    leaf_labels.append(str(df.loc[original_idx, id_column]))
            else:
                # Usar índices originales como fallback
                for leaf_idx in dendrogram_data['leaves']:
                    original_idx = df_cluster.index[leaf_idx]
                    leaf_labels.append(f"ID {original_idx}")
            
            # Crear mapeo de posición de hoja a cluster para colorear el dendrograma
            leaf_position_to_cluster = {}
            for pos, leaf_idx in enumerate(dendrogram_data['leaves']):
                original_idx = df_cluster.index[leaf_idx]
                if original_idx in index_to_cluster:
                    leaf_position_to_cluster[pos] = index_to_cluster[original_idx]
            
            # Preparar datos del dendrograma para Plotly
            dendrogram_plot_data = {
                "icoord": dendrogram_data['icoord'],
                "dcoord": dendrogram_data['dcoord'],
                "ivl": leaf_labels,  # Usar nuestros labels personalizados
                "leaves": dendrogram_data['leaves'],
                "color_list": dendrogram_data.get('color_list', []),
                "max_height": float(max(linkage_matrix[:, 2])),
                "min_height": float(min(linkage_matrix[:, 2])),
                "cut_height": float(cut_height_approx),  # Altura de corte calculada
                "leaf_position_to_cluster": leaf_position_to_cluster  # Mapeo para colorear
            }
            
            # Preparar datos para heatmap clusterizado
            # Clustering jerárquico para las observaciones (columnas) - ya tenemos linkage_matrix
            # Clustering jerárquico para las variables (filas)
            from scipy.spatial.distance import squareform
            n_obs, n_vars = data_scaled.shape
            
            # Clustering de variables: calcular distancias entre variables (transponer)
            variable_distances = pdist(data_scaled.T)  # Forma: (n_vars * (n_vars - 1) / 2,)
            variable_linkage = linkage(variable_distances, method=linkage_method)
            
            # Generar dendrograma de variables con validación
            try:
                variable_dendrogram = dendrogram(variable_linkage, no_plot=True)
                variable_order_raw = np.array(variable_dendrogram['leaves'], dtype=int)
            except Exception as e:
                # Fallback: usar orden original
                variable_order_raw = np.arange(n_vars)
            
            # Validar índices del dendrograma de variables
            if len(variable_order_raw) != n_vars:
                variable_order_raw = np.arange(n_vars)
            
            if variable_order_raw.max() >= n_vars or variable_order_raw.min() < 0:
                # Si hay índices fuera de rango, usar orden original
                variable_order_raw = np.arange(n_vars)
            
            # Asegurar que todos los índices estén presentes
            if len(np.unique(variable_order_raw)) != n_vars:
                variable_order_raw = np.arange(n_vars)
            
            variable_order = variable_order_raw
            
            # Orden de observaciones según dendrograma de observaciones
            observation_order_raw = np.array(dendrogram_data['leaves'], dtype=int)
            
            # Validar índices del dendrograma de observaciones
            if len(observation_order_raw) != n_obs:
                observation_order_raw = np.arange(n_obs)
            
            if observation_order_raw.max() >= n_obs or observation_order_raw.min() < 0:
                observation_order_raw = np.arange(n_obs)
            
            # Asegurar que todos los índices estén presentes
            if len(np.unique(observation_order_raw)) != n_obs:
                observation_order_raw = np.arange(n_obs)
            
            observation_order = observation_order_raw
            
            
            # Crear matriz reordenada
            # np.ix_ crea un índice que reordena filas (observaciones) y columnas (variables)
            data_reordered = data_scaled[np.ix_(observation_order, variable_order)]
            
            
            # Regenerar dendrograma de variables con los datos correctos para el frontend
            try:
                variable_dendrogram = dendrogram(variable_linkage, no_plot=True)
            except Exception as e:
                # Crear un dendrograma dummy si falla
                variable_dendrogram = {
                    'icoord': [],
                    'dcoord': [],
                    'leaves': variable_order.tolist(),
                    'ivl': [numerical_vars[i] for i in variable_order]
                }
            
            # Preparar labels para el heatmap
            observation_labels_heatmap = []
            if id_column and id_column in df.columns:
                for obs_idx in observation_order:
                    original_idx = df_cluster.index[obs_idx]
                    # Usar .loc porque original_idx es el índice del DataFrame original, no una posición
                    observation_labels_heatmap.append(str(df.loc[original_idx, id_column]))
            else:
                for obs_idx in observation_order:
                    original_idx = df_cluster.index[obs_idx]
                    observation_labels_heatmap.append(f"ID {original_idx}")
            
            # Crear labels para las variables en el orden del dendrograma
            variable_labels_heatmap = [numerical_vars[int(i)] for i in variable_order]
            
            # Preparar datos del dendrograma de variables
            variable_dendrogram_data = {
                "icoord": variable_dendrogram['icoord'],
                "dcoord": variable_dendrogram['dcoord'],
                "ivl": variable_labels_heatmap,
                "leaves": variable_dendrogram['leaves'],
                "max_height": float(max(variable_linkage[:, 2])),
                "min_height": float(min(variable_linkage[:, 2]))
            }
            
            # Para Plotly heatmap: z debe tener forma [nVariables x nObservations]
            # donde filas = variables (eje Y) y columnas = observaciones (eje X)
            # data_reordered tiene forma (n_obs, n_vars), necesitamos transponer
            heatmap_matrix = data_reordered.T.tolist()  # Transponer: (n_vars, n_obs)
            
            
            heatmap_data = {
                "matrix": heatmap_matrix,  # Matriz transpuesta: filas = variables, columnas = observaciones
                "observation_labels": observation_labels_heatmap,
                "variable_labels": variable_labels_heatmap,
                "observation_order": observation_order.tolist(),
                "variable_order": variable_order.tolist(),
                "min_value": float(np.min(data_scaled)),
                "max_value": float(np.max(data_scaled)),
                "observation_dendrogram": dendrogram_plot_data,
                "variable_dendrogram": variable_dendrogram_data
            }
            
            # Información del PCA
            pca_info = {
                "explained_variance_pc1": float(explained_variance[0]),
                "explained_variance_pc2": float(explained_variance[1]),
                "total_variance_explained": float(total_variance_explained),
                "loadings": {}
            }
            
            # Calcular loadings de las variables originales
            for i, var in enumerate(numerical_vars):
                pca_info["loadings"][var] = {
                    "pc1": float(pca.components_[0, i]),
                    "pc2": float(pca.components_[1, i])
                }
            
            result = {
                "optimal_k": int(hierarchical_optimal_k),  # Usar el k óptimo determinado para jerárquico
                "kmeans_optimal_k": int(optimal_k),  # Guardar también el k de K-means para referencia
                "variables_used": numerical_vars,
                "sample_size": outliers_count,  # Conteo de observaciones usadas
                "cluster_stats": cluster_stats,
                "pca_data": pca_data,
                "pca_info": pca_info,
                "dendrogram_data": dendrogram_plot_data,
                "linkage_matrix": linkage_matrix.tolist(),
                "clustering_metrics": {
                    "silhouette_score": float(silhouette_avg),
                    "calinski_harabasz_score": float(calinski_score),
                    "davies_bouldin_score": float(davies_score)
                },
                "hierarchical_info": {
                    "method": linkage_method.capitalize(),
                    "optimal_k_determined": int(hierarchical_optimal_k),
                    "kmeans_optimal_k_received": int(hierarchical_optimal_k),
                    "evaluation_scores": {
                        "silhouette": float(silhouette_avg),
                        "calinski_harabasz": float(calinski_score),
                        "davies_bouldin": float(davies_score)
                    },
                    "all_evaluations": [
                        {
                            "k": int(hierarchical_optimal_k),
                            "silhouette": float(silhouette_avg),
                            "calinski_harabasz": float(calinski_score),
                            "davies_bouldin": float(davies_score),
                            "is_optimal": True
                        }
                    ],
                    "distance_metric": "Euclidean",
                    "linkage_matrix_shape": linkage_matrix.shape,
                    "linkage_method_used": linkage_method,
                    "linkage_method_display": {
                        'ward': 'Ward Method',
                        'complete': 'Complete Linkage',
                        'average': 'Average Linkage',
                        'single': 'Single Linkage',
                        'centroid': 'Centroid Linkage'
                    }.get(linkage_method, linkage_method.capitalize())
                },
                "id_column_name": id_column if id_column else None,
                "heatmap_data": heatmap_data,  # Datos para el heatmap clusterizado
                "missing_value_imputation": {
                    "applied": bool(missing_cols),
                    "columns": missing_cols
                }
            }
            
            # Agregar advertencia de datos insuficientes si existe
            if insufficient_data_warning:
                result.update(insufficient_data_warning)
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Error en clustering jerárquico: {str(e)}"}
    
    def run_clustering_validation(self, df: pd.DataFrame, variable_types: Dict[str, str], variables: List[str], outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """Ejecutar validación de clustering comparando datos reales con datos simulados"""
        try:
            from sklearn.decomposition import PCA
            from sklearn.preprocessing import StandardScaler
            from sklearn.cluster import KMeans
            import numpy as np
            
            
            # Filtrar solo las variables numéricas seleccionadas
            numerical_vars = []
            for var in variables:
                if var in variable_types and variable_types[var].startswith('cuantitativa'):
                    numerical_vars.append(var)
            
            if len(numerical_vars) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas para la validación"}
            
            
            # Preparar datos reales para análisis (usar solo outliers)
            final_outliers = None
            subject_id_column = None
            if outlier_results and isinstance(outlier_results, dict):
                final_outliers = outlier_results.get('final_outliers') or None
                subject_id_column = outlier_results.get('subject_id_column')

            df_outliers = self._select_outliers_df(df, final_outliers, subject_id_column)
            if df_outliers is None:
                if 'es_outlier' not in df.columns:
                    return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame y no hay lista de outliers final disponible."}
                df_outliers = df[df['es_outlier'] == 'Outlier'].copy()

            df_real = df_outliers[numerical_vars].copy()

            # Imputar valores faltantes para no reducir la muestra (usar mediana por columna)
            missing_cols = [col for col in df_real.columns if df_real[col].isna().any()]
            if missing_cols:
                medians = df_real.median(numeric_only=True)
                if medians.isna().any():
                    return {
                        "error": "No se puede imputar valores faltantes porque una o más variables tienen solo valores NaN.",
                        "missing_columns": [col for col in df_real.columns if df_real[col].isna().all()]
                    }
                df_real = df_real.fillna(medians)
            
            # Verificar si hay suficientes datos y crear advertencia si es necesario
            insufficient_data_warning = None
            if len(df_real) < 10:
                insufficient_data_warning = {
                    "message": f"Advertencia: Pocas observaciones para validación de clustering. Se requieren al menos 10 observaciones, pero solo hay {len(df_real)} disponibles. Los resultados pueden no ser confiables.",
                    "available_data_points": len(df_real),
                    "minimum_required": 10,
                    "status": "warning_insufficient_data"
                }
            
            
            # Estandarizar variables reales
            scaler = StandardScaler()
            data_real_scaled = scaler.fit_transform(df_real)
            
            # Ejecutar clustering automático para generar grupos
            # Determinar K óptimo usando el método del codo
            from sklearn.metrics import silhouette_score
            max_k = min(10, len(data_real_scaled) // 2)  # Máximo 10 clusters o la mitad de los datos
            if max_k < 2:
                max_k = 2
            
            inertias = []
            silhouette_scores = []
            k_range = range(2, max_k + 1)
            
            for k in k_range:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                kmeans.fit(data_real_scaled)
                inertias.append(kmeans.inertia_)
                
                if k > 1:  # Silhouette score requiere al menos 2 clusters
                    labels = kmeans.labels_
                    silhouette_scores.append(silhouette_score(data_real_scaled, labels))
                else:
                    silhouette_scores.append(0)
            
            # Determinar K óptimo (método del codo + silhouette)
            optimal_k = 2  # Por defecto
            if len(inertias) > 1:
                # Método del codo simplificado
                elbow_scores = []
                for i in range(1, len(inertias)):
                    if inertias[i-1] > 0:
                        elbow_scores.append((inertias[i-1] - inertias[i]) / inertias[i-1])
                    else:
                        elbow_scores.append(0)
                
                # Encontrar el punto donde la reducción de inercia se estabiliza
                if len(elbow_scores) > 0:
                    optimal_k = k_range[np.argmax(elbow_scores)] if np.argmax(elbow_scores) < len(k_range) else 2
                else:
                    optimal_k = 2
            
            # Aplicar clustering con K óptimo
            kmeans_optimal = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            cluster_labels = kmeans_optimal.fit_predict(data_real_scaled)
            
            
            # Generar datos simulados aleatorios con la misma forma y rango
            np.random.seed(42)  # Para reproducibilidad
            data_simulated = np.random.uniform(
                low=np.min(data_real_scaled, axis=0),
                high=np.max(data_real_scaled, axis=0),
                size=data_real_scaled.shape
            )
            
            # Aplicar PCA a ambos datasets
            pca = PCA(n_components=2)
            
            # PCA para datos reales
            pca_real = pca.fit_transform(data_real_scaled)
            explained_variance_real = pca.explained_variance_ratio_
            
            # PCA para datos simulados (usando el mismo scaler y PCA)
            pca_simulated = pca.transform(data_simulated)
            
            # Preparar datos para visualización
            real_data = []
            for i in range(len(pca_real)):
                point_data = {
                    "pc1": float(pca_real[i, 0]),
                    "pc2": float(pca_real[i, 1]),
                    "dataset": "real",
                    "original_index": int(df_real.index[i]),
                    "cluster": int(cluster_labels[i]),
                    "cluster_name": f"Cluster {cluster_labels[i] + 1}"
                }
                real_data.append(point_data)
            
            simulated_data = []
            for i in range(len(pca_simulated)):
                point_data = {
                    "pc1": float(pca_simulated[i, 0]),
                    "pc2": float(pca_simulated[i, 1]),
                    "dataset": "simulated",
                    "original_index": i
                }
                simulated_data.append(point_data)
            
            # Calcular estadísticas descriptivas
            real_stats = {
                "mean_pc1": float(np.mean(pca_real[:, 0])),
                "mean_pc2": float(np.mean(pca_real[:, 1])),
                "std_pc1": float(np.std(pca_real[:, 0])),
                "std_pc2": float(np.std(pca_real[:, 1])),
                "explained_variance_pc1": float(explained_variance_real[0]),
                "explained_variance_pc2": float(explained_variance_real[1]),
                "total_variance_explained": float(np.sum(explained_variance_real))
            }
            
            simulated_stats = {
                "mean_pc1": float(np.mean(pca_simulated[:, 0])),
                "mean_pc2": float(np.mean(pca_simulated[:, 1])),
                "std_pc1": float(np.std(pca_simulated[:, 0])),
                "std_pc2": float(np.std(pca_simulated[:, 1])),
                "explained_variance_pc1": float(explained_variance_real[0]),  # Mismo que real
                "explained_variance_pc2": float(explained_variance_real[1]),  # Mismo que real
                "total_variance_explained": float(np.sum(explained_variance_real))  # Mismo que real
            }
            
            # Calcular Hopkins statistic (simplificado)
            # Hopkins statistic mide la tendencia de clustering
            # Valores cercanos a 0 indican fuerte tendencia de clustering
            # Valores cercanos a 0.5 indican distribución aleatoria
            
            # Calcular distancias mínimas para puntos reales
            from scipy.spatial.distance import cdist
            real_distances = cdist(data_real_scaled, data_real_scaled)
            np.fill_diagonal(real_distances, np.inf)
            min_real_distances = np.min(real_distances, axis=1)
            
            # Generar puntos aleatorios uniformes en el mismo espacio
            random_points = np.random.uniform(
                low=np.min(data_real_scaled, axis=0),
                high=np.max(data_real_scaled, axis=0),
                size=(len(data_real_scaled), data_real_scaled.shape[1])
            )
            
            # Calcular distancias mínimas para puntos aleatorios
            random_distances = cdist(random_points, data_real_scaled)
            min_random_distances = np.min(random_distances, axis=1)
            
            # Calcular Hopkins statistic
            hopkins_statistic = np.sum(min_random_distances) / (np.sum(min_random_distances) + np.sum(min_real_distances))
            
            # Calcular VAT (Visual Assessment of Cluster Tendency) para ambos datasets
            # VAT reordena la matriz de distancias para mostrar patrones de clustering
            
            # VAT para datos reales
            from scipy.cluster.hierarchy import linkage, dendrogram
            from scipy.spatial.distance import pdist
            
            # Calcular matriz de distancias para datos reales
            real_dist_matrix = cdist(data_real_scaled, data_real_scaled)
            
            # Aplicar clustering jerárquico para obtener el orden de reordenamiento
            real_linkage = linkage(pdist(data_real_scaled), method='ward')
            real_dendro = dendrogram(real_linkage, no_plot=True)
            real_order = real_dendro['leaves']
            
            # Reordenar matriz de distancias para datos reales
            real_vat_matrix = real_dist_matrix[real_order][:, real_order]
            
            # VAT para datos simulados
            simulated_dist_matrix = cdist(data_simulated, data_simulated)
            
            # Aplicar clustering jerárquico para obtener el orden de reordenamiento
            simulated_linkage = linkage(pdist(data_simulated), method='ward')
            simulated_dendro = dendrogram(simulated_linkage, no_plot=True)
            simulated_order = simulated_dendro['leaves']
            
            # Reordenar matriz de distancias para datos simulados
            simulated_vat_matrix = simulated_dist_matrix[simulated_order][:, simulated_order]
            
            # Preparar datos VAT para visualización
            vat_data = {
                "real": {
                    "matrix": real_vat_matrix.tolist(),
                    "order": real_order if isinstance(real_order, list) else real_order.tolist(),
                    "min_value": float(np.min(real_vat_matrix)),
                    "max_value": float(np.max(real_vat_matrix))
                },
                "simulated": {
                    "matrix": simulated_vat_matrix.tolist(),
                    "order": simulated_order if isinstance(simulated_order, list) else simulated_order.tolist(),
                    "min_value": float(np.min(simulated_vat_matrix)),
                    "max_value": float(np.max(simulated_vat_matrix))
                }
            }
            
            # Interpretación del Hopkins statistic
            if hopkins_statistic < 0.3:
                clustering_tendency = "Fuerte"
                interpretation = "Los datos muestran una fuerte tendencia de clustering. Es apropiado aplicar métodos de clustering."
            elif hopkins_statistic < 0.5:
                clustering_tendency = "Moderada"
                interpretation = "Los datos muestran una tendencia moderada de clustering. Los métodos de clustering pueden ser útiles."
            else:
                clustering_tendency = "Débil"
                interpretation = "Los datos no muestran una tendencia clara de clustering. Los resultados del clustering deben interpretarse con cautela."
            
            result = {
                "variables_used": numerical_vars,
                "sample_size": len(df_real),
                "real_data": real_data,
                "simulated_data": simulated_data,
                "real_stats": real_stats,
                "simulated_stats": simulated_stats,
                "hopkins_statistic": float(hopkins_statistic),
                "clustering_tendency": clustering_tendency,
                "interpretation": interpretation,
                "clustering_info": {
                    "optimal_k": int(optimal_k),
                    "clusters_generated": int(len(np.unique(cluster_labels))),
                    "cluster_distribution": {f"Cluster {i+1}": int(np.sum(cluster_labels == i)) for i in range(optimal_k)},
                    "method": "K-means automático para visualización"
                },
                "validation_info": {
                    "method": "Visual Assessment of Cluster Tendency (VAT)",
                    "comparison": "Dataset real vs. Dataset simulado aleatorio",
                    "pca_components": 2
                },
                "vat_data": vat_data,
                "missing_value_imputation": {
                    "applied": bool(missing_cols),
                    "columns": missing_cols
                }
            }
            
            # Agregar advertencia de datos insuficientes si existe
            if insufficient_data_warning:
                result.update(insufficient_data_warning)
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Error en validación de clustering: {str(e)}"}
    
    # ============================================================================
    # MARCO ANALÍTICO COMPLETO PARA OUTLIERS EN INVESTIGACIÓN EN SALUD
    # ============================================================================
    
    def demographic_clinical_profile_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                                            categorical_variables: List[str] = None) -> Dict[str, Any]:
        """
        Fase 1.1: Análisis de Perfil Demográfico/Clínico
        
        Analiza la asociación entre la condición de outlier y variables categóricas o continuas
        demográficas/clínicas usando tablas de contingencia, Chi-cuadrado/Fisher, ANOVA y Mann-Whitney.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            categorical_variables: Lista opcional de variables categóricas a analizar. 
                                  Si es None, devuelve las variables disponibles para selección.
        
        Returns:
            Diccionario con resultados del análisis demográfico/clínico o variables disponibles
        """
        try:
            from scipy.stats import kruskal, f_oneway
            from scipy.stats import fisher_exact
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            # Obtener todas las variables categóricas disponibles
            all_categorical_vars = [col for col in df.columns 
                                   if col != 'es_outlier' and 
                                   self.is_categorical_variable(variable_types.get(col, ''))]
            
            # Si no se proporcionan variables categóricas, devolver las disponibles
            if categorical_variables is None or len(categorical_variables) == 0:
                # Filtrar variables que parezcan IDs (sugerencia, pero el usuario puede seleccionarlas)
                id_like_keywords = ['id', 'codigo', 'code', 'identificador', 'identifier', 'key']
                suggested_vars = [v for v in all_categorical_vars 
                                if not any(keyword in v.lower() for keyword in id_like_keywords)]
                
                return {
                    "available_categorical_variables": all_categorical_vars,
                    "suggested_categorical_variables": suggested_vars,
                    "message": "Selecciona las variables categóricas que deseas analizar. Las variables numéricas se analizarán automáticamente."
                }
            
            # Validar que las variables seleccionadas existan y sean categóricas
            invalid_vars = [v for v in categorical_variables 
                          if v not in all_categorical_vars]
            if invalid_vars:
                return {
                    "error": f"Las siguientes variables no son categóricas o no existen: {invalid_vars}",
                    "available_categorical_variables": all_categorical_vars
                }
            
            results = {
                "categorical_analyses": [],
                "continuous_analyses": [],
                "summary": {}
            }
            
            # Separar outliers y normales
            outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            normal_df = df[df['es_outlier'] == 'No Outlier'].copy()
            
            # Análisis de variables categóricas (solo las seleccionadas)
            categorical_vars = categorical_variables
            
            for cat_var in categorical_vars:
                try:
                    # Crear tabla de contingencia
                    contingency_table = pd.crosstab(df['es_outlier'], df[cat_var])
                    
                    if contingency_table.shape[0] < 2 or contingency_table.shape[1] < 2:
                        continue
                    
                    # Prueba Chi-cuadrado
                    chi2, p_value_chi2, dof, expected = chi2_contingency(contingency_table)
                    
                    # Fisher's Exact Test si la tabla es 2x2 y hay frecuencias esperadas < 5
                    fisher_p = None
                    if contingency_table.shape == (2, 2):
                        if (expected < 5).any().any():
                            oddsratio, fisher_p = fisher_exact(contingency_table)
                    
                    # Calcular proporciones
                    proportions = contingency_table.div(contingency_table.sum(axis=1), axis=0)
                    
                    results["categorical_analyses"].append({
                        "variable": cat_var,
                        "contingency_table": contingency_table.to_dict(),
                        "proportions": proportions.to_dict(),
                        "chi2_statistic": float(chi2) if np.isfinite(chi2) else None,
                        "chi2_p_value": float(p_value_chi2) if np.isfinite(p_value_chi2) else None,
                        "degrees_of_freedom": int(dof),
                        "fisher_exact_p_value": float(fisher_p) if fisher_p is not None and np.isfinite(fisher_p) else None,
                        "interpretation": self._interpret_categorical_association(cat_var, chi2, p_value_chi2, fisher_p, proportions)
                    })
                except Exception as e:
                    continue
            
            # Análisis de variables continuas
            continuous_vars = [col for col in df.columns 
                             if col != 'es_outlier' and 
                             self.is_numeric_variable(variable_types.get(col, ''))]
            
            for cont_var in continuous_vars:
                try:
                    outliers_values = outliers_df[cont_var].dropna()
                    normal_values = normal_df[cont_var].dropna()
                    
                    if len(outliers_values) < 2 or len(normal_values) < 2:
                        continue
                    
                    # Mann-Whitney U (no paramétrico)
                    u_statistic, u_p_value = mannwhitneyu(outliers_values, normal_values, alternative='two-sided')
                    
                    # Prueba t (paramétrico) si los datos son aproximadamente normales
                    t_statistic = None
                    t_p_value = None
                    try:
                        from scipy.stats import ttest_ind, shapiro
                        # Verificar normalidad en ambos grupos
                        _, p_outliers_norm = shapiro(outliers_values) if len(outliers_values) <= 5000 else (None, 0.05)
                        _, p_normal_norm = shapiro(normal_values) if len(normal_values) <= 5000 else (None, 0.05)
                        
                        if p_outliers_norm > 0.05 and p_normal_norm > 0.05:
                            t_statistic, t_p_value = ttest_ind(outliers_values, normal_values)
                    except:
                        pass
                    
                    # Estadísticas descriptivas
                    outliers_stats = {
                        "mean": float(outliers_values.mean()) if np.isfinite(outliers_values.mean()) else None,
                        "median": float(outliers_values.median()) if np.isfinite(outliers_values.median()) else None,
                        "std": float(outliers_values.std()) if np.isfinite(outliers_values.std()) else None,
                        "q25": float(outliers_values.quantile(0.25)) if np.isfinite(outliers_values.quantile(0.25)) else None,
                        "q75": float(outliers_values.quantile(0.75)) if np.isfinite(outliers_values.quantile(0.75)) else None,
                        "n": len(outliers_values)
                    }
                    
                    normal_stats = {
                        "mean": float(normal_values.mean()) if np.isfinite(normal_values.mean()) else None,
                        "median": float(normal_values.median()) if np.isfinite(normal_values.median()) else None,
                        "std": float(normal_values.std()) if np.isfinite(normal_values.std()) else None,
                        "q25": float(normal_values.quantile(0.25)) if np.isfinite(normal_values.quantile(0.25)) else None,
                        "q75": float(normal_values.quantile(0.75)) if np.isfinite(normal_values.quantile(0.75)) else None,
                        "n": len(normal_values)
                    }
                    
                    results["continuous_analyses"].append({
                        "variable": cont_var,
                        "outliers_statistics": outliers_stats,
                        "normal_statistics": normal_stats,
                        "mann_whitney_u": float(u_statistic) if np.isfinite(u_statistic) else None,
                        "mann_whitney_p_value": float(u_p_value) if np.isfinite(u_p_value) else None,
                        "t_statistic": float(t_statistic) if t_statistic is not None and np.isfinite(t_statistic) else None,
                        "t_p_value": float(t_p_value) if t_p_value is not None and np.isfinite(t_p_value) else None,
                        "interpretation": self._interpret_continuous_association(cont_var, outliers_stats, normal_stats, u_p_value, t_p_value)
                    })
                except Exception as e:
                    continue
            
            results["summary"] = {
                "total_categorical_variables": len(categorical_vars),
                "total_continuous_variables": len(continuous_vars),
                "categorical_associations_found": len([a for a in results["categorical_analyses"] if a.get("chi2_p_value", 1) < 0.05]),
                "continuous_associations_found": len([a for a in results["continuous_analyses"] if a.get("mann_whitney_p_value", 1) < 0.05])
            }
            
            return results
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en análisis demográfico/clínico: {str(e)}"}
    
    def _interpret_categorical_association(self, var_name: str, chi2: float, p_value: float, fisher_p: float, proportions: pd.DataFrame) -> str:
        """Interpreta la asociación entre outliers y una variable categórica"""
        if fisher_p is not None and fisher_p < 0.05:
            return f"Asociación estadísticamente significativa entre outliers y {var_name} (Fisher's Exact Test, p={fisher_p:.4f}). Las proporciones de outliers difieren significativamente entre las categorías de {var_name}."
        elif p_value < 0.05:
            return f"Asociación estadísticamente significativa entre outliers y {var_name} (Chi-cuadrado={chi2:.2f}, p={p_value:.4f}). Las proporciones de outliers difieren significativamente entre las categorías de {var_name}."
        else:
            return f"No se encontró asociación estadísticamente significativa entre outliers y {var_name} (p={p_value:.4f})."
    
    def _interpret_continuous_association(self, var_name: str, outliers_stats: Dict, normal_stats: Dict, u_p_value: float, t_p_value: float) -> str:
        """Interpreta la asociación entre outliers y una variable continua"""
        p_value_to_use = t_p_value if t_p_value is not None else u_p_value
        test_name = "t-test" if t_p_value is not None else "Mann-Whitney U"
        
        outliers_mean = outliers_stats.get("mean")
        normal_mean = normal_stats.get("mean")
        
        if p_value_to_use < 0.05:
            if outliers_mean is not None and normal_mean is not None:
                direction = "mayor" if outliers_mean > normal_mean else "menor"
                return f"Diferencia estadísticamente significativa en {var_name} entre outliers y normales ({test_name}, p={p_value_to_use:.4f}). Los outliers tienen valores {direction}es (media outliers: {outliers_mean:.2f}, media normales: {normal_mean:.2f})."
            else:
                return f"Diferencia estadísticamente significativa en {var_name} entre outliers y normales ({test_name}, p={p_value_to_use:.4f})."
        else:
            return f"No se encontró diferencia estadísticamente significativa en {var_name} entre outliers y normales ({test_name}, p={p_value_to_use:.4f})."
    
    def cooccurrence_patterns_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], outlier_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fase 1.2: Análisis de Patrones de Co-Ocurrencia de Outliers
        
        Analiza si los outliers en diferentes variables tienden a co-ocurrir,
        sugiriendo vías biológicas interrumpidas.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            outlier_results: Resultados de detección de outliers con información por método
        
        Returns:
            Diccionario con análisis de co-ocurrencia
        """
        try:
            from scipy.stats import spearmanr
            from scipy.cluster.hierarchy import linkage, dendrogram
            from scipy.spatial.distance import pdist, squareform
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            # Obtener número correcto de outliers desde outlier_results
            outliers_detected_count = outlier_results.get('outliers_detected', 0)
            
            # Obtener solo outliers del DataFrame (puede tener múltiples filas por sujeto)
            outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            
            # Validar que hay suficientes outliers únicos
            if outliers_detected_count < 3:
                return {
                    "error": f"Insufficient outliers for co-occurrence analysis. Detected: {outliers_detected_count}, Minimum required: 3.",
                    "outliers_detected": outliers_detected_count,
                    "minimum_required": 3
                }
            
            # Obtener variables numéricas
            numerical_cols = [col for col in df.columns 
                            if col != 'es_outlier' and self.is_numeric_variable(variable_types.get(col, ''))]
            
            if len(numerical_cols) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas."}
            
            # Filtrar datos válidos
            outliers_clean = outliers_df[numerical_cols].dropna()
            
            # Validar que hay suficientes datos válidos después de filtrar NaN
            # Nota: outliers_clean puede tener más filas que outliers_detected_count si hay múltiples filas por sujeto
            if len(outliers_clean) < 3:
                return {"error": "Insuficientes datos válidos después de filtrar NaN."}
            
            # Calcular matriz de correlación Spearman (robusta)
            correlation_matrix = outliers_clean.corr(method='spearman')
            
            # Identificar pares con correlaciones significativas
            significant_pairs = []
            for i, var1 in enumerate(numerical_cols):
                for j, var2 in enumerate(numerical_cols):
                    if i >= j:
                        continue
                    try:
                        data1 = outliers_clean[var1].values
                        data2 = outliers_clean[var2].values
                        if len(data1) > 2 and len(data2) > 2:
                            corr, p_value = spearmanr(data1, data2)
                            if p_value < 0.05:
                                significant_pairs.append({
                                    "variable1": var1,
                                    "variable2": var2,
                                    "correlation": float(corr) if np.isfinite(corr) else 0.0,
                                    "p_value": float(p_value) if np.isfinite(p_value) else 1.0
                                })
                    except:
                        continue
            
            # Preparar datos para heatmap con clustering
            correlation_matrix_clean = correlation_matrix.fillna(0)
            
            # Clustering jerárquico
            try:
                distance_matrix = 1 - correlation_matrix_clean.abs()
                condensed_distances = squareform(distance_matrix.values, checks=False)
                linkage_matrix = linkage(condensed_distances, method='ward')
            except:
                linkage_matrix = None
            
            # Calcular estadísticas adicionales para interpretación
            total_possible_pairs = len(numerical_cols) * (len(numerical_cols) - 1) // 2
            percentage_significant = (len(significant_pairs) / total_possible_pairs * 100) if total_possible_pairs > 0 else 0
            
            return {
                "success": True,
                "outliers_count": outliers_detected_count,  # Usar el número correcto de outliers únicos
                "outliers_count_rows": len(outliers_df),  # Número de filas (puede ser mayor si hay múltiples filas por sujeto)
                "variables_analyzed": numerical_cols,
                "total_variables": len(numerical_cols),
                "total_possible_pairs": total_possible_pairs,
                "correlation_matrix": {
                    "matrix": correlation_matrix_clean.values.tolist(),
                    "labels": numerical_cols
                },
                "significant_pairs": significant_pairs,
                "linkage_matrix": linkage_matrix.tolist() if linkage_matrix is not None else None,
                "interpretation": self._interpret_cooccurrence_patterns(
                    significant_pairs, 
                    numerical_cols, 
                    outliers_detected_count,  # Usar el número correcto de outliers únicos
                    total_possible_pairs,
                    percentage_significant
                )
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en análisis de co-ocurrencia: {str(e)}"}
    
    def _interpret_cooccurrence_patterns(self, significant_pairs: List[Dict], variables: List[str], 
                                        outliers_count: int, total_pairs: int, percentage_significant: float) -> str:
        """
        Interpreta los patrones de co-ocurrencia de manera dinámica y detallada
        
        Args:
            significant_pairs: Lista de pares con correlaciones significativas
            variables: Lista de variables analizadas
            outliers_count: Número de outliers analizados
            total_pairs: Total de pares posibles
            percentage_significant: Porcentaje de pares significativos
        """
        interpretation_parts = []
        
        # Introducción
        interpretation_parts.append(
            f"<strong>Resumen del Análisis:</strong> Se analizaron {outliers_count} outliers en {len(variables)} variables numéricas, "
            f"evaluando {total_pairs} posibles pares de correlaciones."
        )
        
        if not significant_pairs:
            interpretation_parts.append(
                "<br><strong>Resultado Principal:</strong> No se encontraron correlaciones significativas (p<0.05) entre variables "
                "en el grupo de outliers. Esto sugiere que los outliers en diferentes variables son <strong>independientes</strong>, "
                "lo que puede indicar que cada outlier representa un evento aislado o que los mecanismos subyacentes son distintos "
                "para cada variable."
            )
            return " ".join(interpretation_parts)
        
        # Análisis de correlaciones significativas
        positive_correlations = [p for p in significant_pairs if p['correlation'] > 0.5]
        negative_correlations = [p for p in significant_pairs if p['correlation'] < -0.5]
        moderate_positive = [p for p in significant_pairs if 0.3 < p['correlation'] <= 0.5]
        moderate_negative = [p for p in significant_pairs if -0.5 <= p['correlation'] < -0.3]
        weak_correlations = [p for p in significant_pairs if abs(p['correlation']) <= 0.3]
        
        interpretation_parts.append(
            f"<br><strong>Resultado Principal:</strong> Se identificaron <strong>{len(significant_pairs)} par(es) de variables</strong> "
            f"con correlaciones significativas (p<0.05), representando el <strong>{percentage_significant:.1f}%</strong> de todos los pares posibles. "
            f"Esto indica que existe una <strong>estructura de co-ocurrencia</strong> en los outliers."
        )
        
        # Correlaciones positivas fuertes
        if positive_correlations:
            top_positive = sorted(positive_correlations, key=lambda x: x['correlation'], reverse=True)[:3]
            top_pairs_str = ", ".join([f"{p['variable1']}-{p['variable2']} (r={p['correlation']:.2f})" for p in top_positive])
            
            interpretation_parts.append(
                f"<br><strong>Correlaciones Positivas Fuertes (r>0.5):</strong> Se encontraron <strong>{len(positive_correlations)} par(es)</strong> "
                f"con correlaciones positivas fuertes. Los pares más destacados son: {top_pairs_str}. "
                f"Esto sugiere que cuando un outlier ocurre en una de estas variables, tiende a ocurrir también en la otra, "
                f"lo que puede indicar <strong>co-activación</strong>, <strong>vías biológicas compartidas</strong>, o "
                f"<strong>mecanismos fisiopatológicos comunes</strong>."
            )
        
        # Correlaciones negativas fuertes
        if negative_correlations:
            top_negative = sorted(negative_correlations, key=lambda x: x['correlation'])[:3]
            top_pairs_str = ", ".join([f"{p['variable1']}-{p['variable2']} (r={p['correlation']:.2f})" for p in top_negative])
            
            interpretation_parts.append(
                f"<br><strong>Correlaciones Negativas Fuertes (r<-0.5):</strong> Se encontraron <strong>{len(negative_correlations)} par(es)</strong> "
                f"con correlaciones negativas fuertes. Los pares más destacados son: {top_pairs_str}. "
                f"Esto sugiere que cuando un outlier ocurre en una variable, tiende a NO ocurrir en la otra, "
                f"lo que puede indicar <strong>mecanismos compensatorios</strong>, <strong>regulación cruzada</strong>, "
                f"o <strong>vías biológicas antagónicas</strong>."
            )
        
        # Correlaciones moderadas
        if moderate_positive or moderate_negative:
            interpretation_parts.append(
                f"<br><strong>Correlaciones Moderadas:</strong> Se encontraron <strong>{len(moderate_positive) + len(moderate_negative)} par(es)</strong> "
                f"con correlaciones moderadas (0.3<|r|≤0.5), sugiriendo asociaciones más débiles pero aún significativas entre variables."
            )
        
        # Correlaciones débiles pero significativas
        if weak_correlations:
            interpretation_parts.append(
                f"<br><strong>Correlaciones Débiles:</strong> Se encontraron <strong>{len(weak_correlations)} par(es)</strong> "
                f"con correlaciones débiles pero estadísticamente significativas (|r|≤0.3), lo que puede indicar asociaciones sutiles "
                f"o efectos indirectos entre variables."
            )
        
        # Interpretación clínica general
        if len(significant_pairs) > total_pairs * 0.3:
            interpretation_parts.append(
                f"<br><strong>Interpretación Clínica:</strong> El alto porcentaje de correlaciones significativas ({percentage_significant:.1f}%) "
                f"sugiere que los outliers no son eventos aleatorios, sino que forman <strong>patrones estructurados</strong>. "
                f"Esto puede indicar la presencia de <strong>subtipos de outliers</strong> con perfiles biológicos distintos, "
                f"lo cual es relevante para la caracterización clínica y la identificación de fenotipos específicos."
            )
        elif len(significant_pairs) > total_pairs * 0.1:
            interpretation_parts.append(
                f"<br><strong>Interpretación Clínica:</strong> El porcentaje moderado de correlaciones significativas ({percentage_significant:.1f}%) "
                f"sugiere que algunos outliers comparten mecanismos comunes, mientras que otros pueden ser eventos más aislados. "
                f"Esto puede ayudar a identificar <strong>grupos específicos de outliers</strong> con características compartidas."
            )
        else:
            interpretation_parts.append(
                f"<br><strong>Interpretación Clínica:</strong> Aunque el porcentaje de correlaciones significativas es bajo ({percentage_significant:.1f}%), "
                f"las correlaciones encontradas pueden ser clínicamente relevantes. Se recomienda examinar los pares específicos "
                f"para identificar posibles vías biológicas o mecanismos compartidos."
            )
        
        # Recomendaciones
        interpretation_parts.append(
            f"<br><strong>Recomendaciones:</strong> Revisa la tabla de pares significativos y el heatmap de correlaciones para identificar "
            f"los patrones más relevantes. Considera realizar análisis de clustering adicionales para identificar grupos de outliers "
            f"con perfiles similares."
        )
        
        return " ".join(interpretation_parts)
    
    def supervised_pca_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], variables: List[str] = None, outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fase 2.1: PCA Supervisado (Outliers vs Normales)
        
        Realiza PCA incluyendo a todos los sujetos, pero coloreando/simbolizando los outliers vs no outliers.
        Permite identificar si los outliers se agrupan en regiones específicas del espacio PCA.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            variables: Lista de variables a usar (si None, usa todas las numéricas)
            outlier_results: Diccionario con resultados de detección de outliers (opcional, para obtener conteos correctos)
        
        Returns:
            Diccionario con resultados del PCA supervisado
        """
        try:
            # Reutilizar la función PCA existente pero asegurar que incluya información de outliers
            if variables is None or len(variables) < 2:
                numerical_cols = [col for col, var_type in variable_types.items() 
                                 if self.is_numeric_variable(var_type) and col != 'es_outlier']
                return {
                    "available_variables": numerical_cols,
                    "message": "Selecciona al menos 2 variables numéricas para el análisis PCA supervisado"
                }
            
            # Obtener conteos CORRECTOS de outliers finales del outlier_results
            # Esto es la fuente de verdad, no el DataFrame que puede tener inconsistencias
            # Usar outliers_detected que viene directamente del módulo de detección
            
            if outlier_results:
                # Usar outliers_detected si está disponible (es la fuente de verdad)
                if 'outliers_detected' in outlier_results:
                    total_outliers_original = int(outlier_results['outliers_detected'])
                elif 'final_outliers' in outlier_results:
                    total_outliers_original = len(outlier_results['final_outliers'])
                else:
                    total_outliers_original = 0
                
                # Obtener total de registros del outlier_results si está disponible
                if 'total_records' in outlier_results:
                    total_records = int(outlier_results['total_records'])
                else:
                    total_records = len(df)
                
                total_normals_original = total_records - total_outliers_original
            else:
                # Fallback: contar del DataFrame (menos confiable)
                total_outliers_original = len(df[df['es_outlier'] == 'Outlier'])
                total_normals_original = len(df[df['es_outlier'] == 'No Outlier'])
                total_records = len(df)
            
            # Obtener índices de outliers finales ANTES del PCA
            # IMPORTANTE: Usar un diccionario para mapear cada outlier_id único a sus índices
            # Esto evita contar múltiples veces el mismo outlier si hay duplicados en subject_id
            final_outlier_indices_set = set()
            final_outlier_ids_set = set(outlier_results.get('final_outliers', [])) if outlier_results else set()
            
            if outlier_results and 'final_outliers' in outlier_results:
                subject_id_column = outlier_results.get('subject_id_column')
                
                # Mapear cada outlier_id único a sus índices
                for outlier_id in final_outlier_ids_set:
                    indices = self._map_outlier_id_to_index(outlier_id, df, subject_id_column)
                    if indices:
                        final_outlier_indices_set.update(indices)
                    else:
                        continue
                
            else:
                pass
            
            # Usar la función PCA existente
            pca_results = self.pca_analysis(df, variable_types, variables)
            
            if 'error' in pca_results:
                return pca_results
            
            # El PCA existente ya incluye outlier_status en biplot_data
            # Agregar análisis específico de separación entre grupos
            if 'biplot_data' in pca_results and 'outlier_status' in pca_results['biplot_data']:
                outlier_status = pca_results['biplot_data']['outlier_status']
                pc1 = pca_results['biplot_data']['pc1']
                pc2 = pca_results['biplot_data']['pc2']
                original_indices = pca_results['biplot_data'].get('original_indices', [])
                
                # IMPORTANTE: Contar solo los outliers FINALES que están presentes después del dropna
                # CORRECCIÓN: Contar por IDs únicos de outliers, no por índices
                # Esto evita el problema de contar múltiples veces el mismo outlier si hay duplicados en subject_id
                outliers_after_dropna = 0
                normals_after_dropna = 0
                outliers_pc1 = []
                outliers_pc2 = []
                normal_pc1 = []
                normal_pc2 = []
                
                # Crear un conjunto de IDs de outliers que están presentes después del dropna
                outliers_present_after_dropna = set()
                
                
                # Mapear índices después del dropna a sus IDs de outliers
                # CORRECCIÓN: Contar por IDs únicos de final_outliers, no por índices
                if final_outlier_indices_set and final_outlier_ids_set:
                    subject_id_column = outlier_results.get('subject_id_column') if outlier_results else None
                    
                    # Crear un mapeo inverso: índice -> ID de outlier
                    index_to_outlier_id = {}
                    for outlier_id in final_outlier_ids_set:
                        indices = self._map_outlier_id_to_index(outlier_id, df, subject_id_column)
                        for idx in indices:
                            index_to_outlier_id[idx] = outlier_id
                    
                    # Para cada índice presente después del dropna, verificar si es un outlier
                    for i, idx in enumerate(original_indices):
                        if idx in final_outlier_indices_set:
                            # Este índice corresponde a un outlier
                            # Obtener el ID del outlier original para este índice
                            outlier_id = index_to_outlier_id.get(idx)
                            
                            # Solo contar una vez por ID único de outlier
                            if outlier_id and outlier_id not in outliers_present_after_dropna:
                                outliers_present_after_dropna.add(outlier_id)
                                outliers_after_dropna += 1
                            
                            outliers_pc1.append(pc1[i])
                            outliers_pc2.append(pc2[i])
                        else:
                            normals_after_dropna += 1
                            normal_pc1.append(pc1[i])
                            normal_pc2.append(pc2[i])
                    
                elif final_outlier_indices_set:
                    # Si no tenemos final_outliers pero sí tenemos índices, contar por índices
                    for i, idx in enumerate(original_indices):
                        if idx in final_outlier_indices_set:
                            outliers_after_dropna += 1
                            outliers_pc1.append(pc1[i])
                            outliers_pc2.append(pc2[i])
                        else:
                            normals_after_dropna += 1
                            normal_pc1.append(pc1[i])
                            normal_pc2.append(pc2[i])
                else:
                    # Solo usar fallback si realmente no hay final_outliers (no debería pasar)
                    for i, status in enumerate(outlier_status):
                        if status == 'Outlier' or status == True:
                            outliers_after_dropna += 1
                            outliers_pc1.append(pc1[i])
                            outliers_pc2.append(pc2[i])
                        else:
                            normals_after_dropna += 1
                            normal_pc1.append(pc1[i])
                            normal_pc2.append(pc2[i])
                
                # Calcular centroides
                outlier_centroid = [
                    np.mean(outliers_pc1) if outliers_pc1 else 0,
                    np.mean(outliers_pc2) if outliers_pc2 else 0
                ]
                normal_centroid = [
                    np.mean(normal_pc1) if normal_pc1 else 0,
                    np.mean(normal_pc2) if normal_pc2 else 0
                ]
                
                # Distancia entre centroides
                centroid_distance = np.sqrt(
                    (outlier_centroid[0] - normal_centroid[0])**2 + 
                    (outlier_centroid[1] - normal_centroid[1])**2
                )
                
                # Test de separación (usando distancia de Mahalanobis en espacio PCA)
                try:
                    from scipy.spatial.distance import mahalanobis
                    from scipy.linalg import inv
                    
                    # Usar los datos correctos de outliers que ya calculamos
                    if outliers_pc1 and normal_pc1:
                        outliers_coords = np.array([[outliers_pc1[i], outliers_pc2[i]] for i in range(len(outliers_pc1))])
                        normal_coords = np.array([[normal_pc1[i], normal_pc2[i]] for i in range(len(normal_pc1))])
                    else:
                        # Fallback: usar outlier_status del biplot_data
                        outliers_coords = np.array([[pc1[i], pc2[i]] for i, status in enumerate(outlier_status) if status == 'Outlier' or status == True])
                        normal_coords = np.array([[pc1[i], pc2[i]] for i, status in enumerate(outlier_status) if status == 'No Outlier' or status == False])
                    
                    if len(outliers_coords) > 1 and len(normal_coords) > 1:
                        outliers_cov = np.cov(outliers_coords.T)
                        normal_cov = np.cov(normal_coords.T)
                        pooled_cov = (outliers_cov + normal_cov) / 2
                        
                        try:
                            pooled_cov_inv = inv(pooled_cov)
                            mahalanobis_dist = mahalanobis(outlier_centroid, normal_centroid, pooled_cov_inv)
                        except:
                            mahalanobis_dist = centroid_distance
                    else:
                        mahalanobis_dist = centroid_distance
                except:
                    mahalanobis_dist = centroid_distance
                
                pca_results['supervised_analysis'] = {
                    "outlier_centroid": [float(x) for x in outlier_centroid],
                    "normal_centroid": [float(x) for x in normal_centroid],
                    "centroid_distance": float(centroid_distance),
                    "mahalanobis_distance": float(mahalanobis_dist),
                    "outliers_count_original": total_outliers_original,  # Antes del dropna
                    "normals_count_original": total_normals_original,    # Antes del dropna
                    "outliers_count_after_dropna": outliers_after_dropna,  # Después del dropna
                    "normals_count_after_dropna": normals_after_dropna,    # Después del dropna
                    "outliers_excluded": total_outliers_original - outliers_after_dropna,  # Outliers excluidos por NaN
                    "normals_excluded": total_normals_original - normals_after_dropna,      # Normales excluidos por NaN
                    "interpretation": self._interpret_supervised_pca(
                        centroid_distance, mahalanobis_dist, 
                        outliers_after_dropna, normals_after_dropna,
                        total_outliers_original, total_normals_original
                    )
                }
            
            return pca_results
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en PCA supervisado: {str(e)}"}
    
    def _interpret_supervised_pca(self, centroid_distance: float, mahalanobis_dist: float, 
                                  outliers_count: int, normals_count: int,
                                  outliers_original: int, normals_original: int) -> str:
        """Interpreta los resultados del PCA supervisado"""
        interpretation_parts = []
        
        # SIEMPRE usar los conteos originales en el texto principal
        interpretation_parts.append(
            f"Se analizaron <strong>{outliers_original} outliers finales</strong> y <strong>{normals_original} datos normales</strong> "
            f"identificados en la detección de outliers."
        )
        
        # Información adicional sobre el conteo después del dropna (solo si hay diferencia)
        if outliers_original != outliers_count or normals_original != normals_count:
            excluded_outliers = outliers_original - outliers_count
            excluded_normals = normals_original - normals_count
            interpretation_parts.append(
                f"<br><small class='text-muted'><i class='fas fa-info-circle me-1'></i>"
                f"Nota: De estos, {outliers_count} outlier(s) y {normals_count} dato(s) normal(es) tienen valores válidos "
                f"en todas las variables seleccionadas para este PCA. "
                f"{excluded_outliers} outlier(s) y {excluded_normals} dato(s) normal(es) fueron excluidos por tener valores faltantes en alguna variable.</small>"
            )
        
        # Interpretación de la separación
        if mahalanobis_dist > 3:
            interpretation_parts.append(
                f"<br><br><strong>Separación entre grupos:</strong> Los outliers se agrupan en una región DISTINTA del espacio PCA "
                f"(distancia de Mahalanobis={mahalanobis_dist:.2e}), confirmando su naturaleza extrema y sugiriendo un fenotipo diferente."
            )
        elif mahalanobis_dist > 1.5:
            interpretation_parts.append(
                f"<br><br><strong>Separación entre grupos:</strong> Los outliers muestran cierta separación del grupo normal en el espacio PCA "
                f"(distancia de Mahalanobis={mahalanobis_dist:.2e}), pero con cierto solapamiento, sugiriendo variaciones extremas dentro del mismo marco fisiopatológico."
            )
        else:
            interpretation_parts.append(
                f"<br><br><strong>Separación entre grupos:</strong> Los outliers y normales están bien mezclados en el espacio PCA "
                f"(distancia de Mahalanobis={mahalanobis_dist:.2e}), sugiriendo que los outliers pueden ser variaciones extremas pero dentro del mismo patrón multivariado."
            )
        
        return " ".join(interpretation_parts)
    
    def network_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fase 2.3: Análisis de Redes de Co-expresión
        
        Construye redes de co-expresión (usando correlaciones significativas) para el grupo de outliers
        y las compara con la red del grupo normal. Analiza cambios en centralidad de genes/variables.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            outlier_results: Resultados de detección de outliers
        
        Returns:
            Diccionario con análisis de redes
        """
        try:
            from scipy.stats import spearmanr
            import networkx as nx
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            # Obtener número correcto de outliers desde outlier_results
            outliers_detected_count = outlier_results.get('outliers_detected', 0) if outlier_results else 0
            total_records = outlier_results.get('total_records', len(df)) if outlier_results else len(df)
            normals_count = total_records - outliers_detected_count
            
            # Separar outliers y normales
            outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            normal_df = df[df['es_outlier'] == 'No Outlier'].copy()
            
            # Validar que hay suficientes datos para ambos grupos
            if outliers_detected_count < 3:
                return {
                    "error": f"Insufficient outliers for network analysis. Detected: {outliers_detected_count}, Minimum required: 3.",
                    "outliers_detected": outliers_detected_count,
                    "minimum_required": 3
                }
            
            if normals_count < 3:
                return {
                    "error": f"Insufficient normal data for network analysis. Normal records: {normals_count}, Minimum required: 3.",
                    "normal_records": normals_count,
                    "minimum_required": 3
                }
            
            # Obtener variables numéricas (genes, factores de transcripción, etc.)
            numerical_cols = [col for col in df.columns 
                            if col != 'es_outlier' and self.is_numeric_variable(variable_types.get(col, ''))]
            
            if len(numerical_cols) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas."}
            
            # Filtrar datos válidos
            outliers_clean = outliers_df[numerical_cols].dropna()
            normal_clean = normal_df[numerical_cols].dropna()
            
            if len(outliers_clean) < 3 or len(normal_clean) < 3:
                return {"error": "Insuficientes datos válidos después de filtrar NaN."}
            
            # Construir redes de correlación
            def build_correlation_network(data, threshold=0.5, p_threshold=0.05):
                """Construye una red basada en correlaciones significativas"""
                G = nx.Graph()
                G.add_nodes_from(numerical_cols)
                
                edges = []
                for i, var1 in enumerate(numerical_cols):
                    for j, var2 in enumerate(numerical_cols):
                        if i >= j:
                            continue
                        try:
                            data1 = data[var1].values
                            data2 = data[var2].values
                            if len(data1) > 2 and len(data2) > 2:
                                corr, p_value = spearmanr(data1, data2)
                                if abs(corr) >= threshold and p_value < p_threshold:
                                    G.add_edge(var1, var2, weight=abs(corr), correlation=corr, p_value=p_value)
                                    edges.append({
                                        "source": var1,
                                        "target": var2,
                                        "correlation": float(corr) if np.isfinite(corr) else 0.0,
                                        "weight": float(abs(corr)) if np.isfinite(corr) else 0.0,
                                        "p_value": float(p_value) if np.isfinite(p_value) else 1.0
                                    })
                        except:
                            continue
                return G, edges
            
            # Construir redes
            outliers_network, outliers_edges = build_correlation_network(outliers_clean)
            normal_network, normal_edges = build_correlation_network(normal_clean)
            
            # Calcular métricas de centralidad
            def calculate_centrality_metrics(G):
                """Calcula métricas de centralidad para cada nodo"""
                if G.number_of_nodes() == 0 or G.number_of_edges() == 0:
                    return {}
                
                try:
                    degree_centrality = nx.degree_centrality(G)
                    betweenness_centrality = nx.betweenness_centrality(G)
                    closeness_centrality = nx.closeness_centrality(G)
                    
                    metrics = {}
                    for node in G.nodes():
                        metrics[node] = {
                            "degree_centrality": float(degree_centrality.get(node, 0)),
                            "betweenness_centrality": float(betweenness_centrality.get(node, 0)),
                            "closeness_centrality": float(closeness_centrality.get(node, 0)),
                            "degree": int(G.degree(node))
                        }
                    return metrics
                except:
                    return {}
            
            outliers_centrality = calculate_centrality_metrics(outliers_network)
            normal_centrality = calculate_centrality_metrics(normal_network)
            
            # Comparar centralidad entre redes
            centrality_comparison = []
            all_nodes = set(list(outliers_centrality.keys()) + list(normal_centrality.keys()))
            
            for node in all_nodes:
                outliers_deg = outliers_centrality.get(node, {}).get("degree_centrality", 0)
                normal_deg = normal_centrality.get(node, {}).get("degree_centrality", 0)
                diff = outliers_deg - normal_deg
                
                if abs(diff) > 0.1:  # Diferencia significativa
                    centrality_comparison.append({
                        "variable": node,
                        "outliers_degree_centrality": outliers_deg,
                        "normal_degree_centrality": normal_deg,
                        "difference": diff,
                        "interpretation": f"{'Mayor' if diff > 0 else 'Menor'} centralidad en outliers (diferencia: {diff:.3f}), sugiriendo que esta variable es {'más' if diff > 0 else 'menos'} importante en la red de outliers."
                    })
            
            # Identificar hubs (nodos con alta centralidad)
            outliers_hubs = [node for node, metrics in outliers_centrality.items() 
                           if metrics.get("degree_centrality", 0) > 0.3]
            normal_hubs = [node for node, metrics in normal_centrality.items() 
                         if metrics.get("degree_centrality", 0) > 0.3]
            
            # Identificar cambios en hubs (hubs que aparecen/desaparecen)
            hubs_only_outliers = [h for h in outliers_hubs if h not in normal_hubs]
            hubs_only_normal = [h for h in normal_hubs if h not in outliers_hubs]
            common_hubs = [h for h in outliers_hubs if h in normal_hubs]
            
            # Preparar datos para visualización de redes
            # Añadir información de categoría (gen vs bioquímico) a cada nodo
            def prepare_network_for_visualization(network, edges, centrality, hubs):
                """Prepara datos de red para visualización"""
                nodes_data = []
                for node in network.nodes():
                    node_cat = self._get_variable_category(node)
                    is_hub = node in hubs
                    nodes_data.append({
                        "id": node,
                        "label": node,
                        "category": node_cat,
                        "degree": centrality.get(node, {}).get("degree", 0),
                        "degree_centrality": centrality.get(node, {}).get("degree_centrality", 0),
                        "betweenness_centrality": centrality.get(node, {}).get("betweenness_centrality", 0),
                        "is_hub": is_hub
                    })
                return nodes_data
            
            outliers_nodes_viz = prepare_network_for_visualization(
                outliers_network, outliers_edges, outliers_centrality, outliers_hubs
            )
            normal_nodes_viz = prepare_network_for_visualization(
                normal_network, normal_edges, normal_centrality, normal_hubs
            )
            
            return {
                "success": True,
                "outliers_network": {
                    "nodes": list(outliers_network.nodes()),
                    "edges": outliers_edges,
                    "n_nodes": outliers_network.number_of_nodes(),
                    "n_edges": outliers_network.number_of_edges(),
                    "centrality": outliers_centrality,
                    "hubs": outliers_hubs,
                    "nodes_data": outliers_nodes_viz  # Datos para visualización
                },
                "normal_network": {
                    "nodes": list(normal_network.nodes()),
                    "edges": normal_edges,
                    "n_nodes": normal_network.number_of_nodes(),
                    "n_edges": normal_network.number_of_edges(),
                    "centrality": normal_centrality,
                    "hubs": normal_hubs,
                    "nodes_data": normal_nodes_viz  # Datos para visualización
                },
                "hubs_comparison": {
                    "only_outliers": hubs_only_outliers,
                    "only_normal": hubs_only_normal,
                    "common": common_hubs
                },
                "centrality_comparison": sorted(centrality_comparison, key=lambda x: abs(x["difference"]), reverse=True),
                "interpretation": self._interpret_network_analysis(outliers_hubs, normal_hubs, centrality_comparison, outliers_network.number_of_edges(), normal_network.number_of_edges())
            }
            
        except ImportError:
            return {"error": "La librería networkx no está instalada. Instala con: pip install networkx"}
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en análisis de redes: {str(e)}"}
    
    def _interpret_network_analysis(self, outliers_hubs: List[str], normal_hubs: List[str], 
                                   centrality_comparison: List[Dict], outliers_edges: int, normal_edges: int) -> str:
        """Interpreta los resultados del análisis de redes"""
        interpretation_parts = []
        
        interpretation_parts.append(
            f"La red de outliers tiene {outliers_edges} conexiones significativas vs {normal_edges} en la red normal."
        )
        
        if len(outliers_hubs) > 0:
            interpretation_parts.append(
                f"Los hubs en la red de outliers son: {', '.join(outliers_hubs[:5])}. "
                f"Estas variables tienen alta centralidad y pueden ser clave en la patología de outliers."
            )
        
        if len(centrality_comparison) > 0:
            top_changes = centrality_comparison[:3]
            interpretation_parts.append(
                f"Las variables con mayor cambio en centralidad son: {', '.join([c['variable'] for c in top_changes])}. "
                f"Esto sugiere cambios en la importancia relativa de estas variables en outliers vs normales."
            )
        
        return " ".join(interpretation_parts) if interpretation_parts else "No se encontraron diferencias significativas en las redes."
    
    def survival_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], 
                         time_variable: str, event_variable: str) -> Dict[str, Any]:
        """
        Fase 3.1: Análisis de Supervivencia (Kaplan-Meier y Cox)
        
        Evalúa si los outliers tienen un riesgo significativamente diferente de desarrollar un evento
        (muerte, recurrencia, complicación) usando curvas de Kaplan-Meier y modelo de Cox.
        
        IMPORTANTE SOBRE LA VARIABLE DE TIEMPO:
        - Para análisis de supervivencia tradicional: La variable debe ser tiempo hasta evento (días, meses, años)
        - Para datos longitudinales (múltiples mediciones): Se puede usar el tiempo de seguimiento desde inicio
        - Si tienes mediciones en diferentes tiempos (basal, medición 2, medición 3), necesitas:
          * Una variable que indique el tiempo desde inicio hasta cada medición
          * O usar el tiempo de la última medición como tiempo de seguimiento
          * La variable de evento debe indicar si ocurrió el evento de interés (0/1 o False/True)
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            time_variable: Nombre de la variable de tiempo hasta evento
            event_variable: Nombre de la variable de evento (0/1, False/True, o categórica binaria)
        
        Returns:
            Diccionario con resultados del análisis de supervivencia
        """
        try:
            from lifelines import KaplanMeierFitter, CoxPHFitter
            from lifelines.statistics import logrank_test
            import numpy as np
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            if time_variable not in df.columns:
                return {"error": f"La variable de tiempo '{time_variable}' no se encuentra en el DataFrame."}
            
            if event_variable not in df.columns:
                return {"error": f"La variable de evento '{event_variable}' no se encuentra en el DataFrame."}
            
            # Preparar datos
            df_clean = df[['es_outlier', time_variable, event_variable]].dropna()
            
            if len(df_clean) < 10:
                return {"error": "Insuficientes datos para análisis de supervivencia (mínimo 10 observaciones)."}
            
            # Convertir variable de evento a binaria (0/1)
            event_values = df_clean[event_variable]
            if event_values.dtype == 'bool':
                events = event_values.astype(int)
            elif event_values.dtype == 'object' or event_values.dtype.name == 'category':
                # Intentar convertir categorías a 0/1
                unique_vals = event_values.unique()
                if len(unique_vals) == 2:
                    # Mapear a 0 y 1 (asumir que el segundo valor es el evento)
                    val_map = {unique_vals[0]: 0, unique_vals[1]: 1}
                    events = event_values.map(val_map)
                else:
                    return {"error": f"La variable de evento debe tener exactamente 2 valores únicos. Encontrados: {unique_vals.tolist()}"}
            else:
                events = event_values.astype(float)
                # Verificar que solo tenga valores 0 y 1
                if not set(events.unique()).issubset({0, 1}):
                    return {"error": f"La variable de evento debe contener solo valores 0 y 1. Valores encontrados: {set(events.unique())}"}
            
            # Obtener tiempos
            times = df_clean[time_variable].astype(float)
            
            # Verificar que los tiempos sean positivos
            if (times <= 0).any():
                return {"error": "La variable de tiempo debe contener solo valores positivos."}
            
            # Separar por grupo de outliers
            outliers_mask = df_clean['es_outlier'] == 'Outlier'
            outliers_times = times[outliers_mask].values
            outliers_events = events[outliers_mask].values
            normal_times = times[~outliers_mask].values
            normal_events = events[~outliers_mask].values
            
            if len(outliers_times) < 3 or len(normal_times) < 3:
                return {"error": "Insuficientes observaciones en al menos uno de los grupos (mínimo 3 por grupo)."}
            
            # Ajustar curvas de Kaplan-Meier
            kmf_outliers = KaplanMeierFitter()
            kmf_outliers.fit(outliers_times, outliers_events, label='Outliers')
            
            kmf_normal = KaplanMeierFitter()
            kmf_normal.fit(normal_times, normal_events, label='Normales')
            
            # Test de log-rank
            results_logrank = logrank_test(outliers_times, normal_times, 
                                         event_observed_A=outliers_events, 
                                         event_observed_B=normal_events)
            
            # Preparar datos para curvas de supervivencia
            survival_curves = {
                "outliers": {
                    "times": kmf_outliers.survival_function_.index.tolist(),
                    "survival_probability": kmf_outliers.survival_function_['Outliers'].values.tolist()
                },
                "normal": {
                    "times": kmf_normal.survival_function_.index.tolist(),
                    "survival_probability": kmf_normal.survival_function_['Normales'].values.tolist()
                }
            }
            
            # Calcular medianas de supervivencia
            try:
                outliers_median = kmf_outliers.median_survival_time_
                normal_median = kmf_normal.median_survival_time_
            except:
                outliers_median = None
                normal_median = None
            
            # Modelo de Cox (si hay suficientes eventos)
            cox_results = None
            if events.sum() >= 5:  # Al menos 5 eventos totales
                try:
                    cox_df = pd.DataFrame({
                        'outlier_status': (df_clean['es_outlier'] == 'Outlier').astype(int).values,
                        'T': times.values,
                        'E': events.values
                    })
                    
                    cph = CoxPHFitter()
                    cph.fit(cox_df, duration_col='T', event_col='E')
                    
                    # Obtener resultados del modelo
                    hr_value = None
                    p_value_cox = None
                    ci_lower = None
                    ci_upper = None
                    
                    try:
                        if 'outlier_status' in cph.hazard_ratios_.index:
                            hr_value = float(np.exp(cph.hazard_ratios_['outlier_status']))
                        elif len(cph.hazard_ratios_) > 0:
                            hr_value = float(np.exp(cph.hazard_ratios_.iloc[0]))
                    except:
                        pass
                    
                    try:
                        if 'outlier_status' in cph.summary.index:
                            p_value_cox = float(cph.summary.loc['outlier_status', 'p'])
                        elif len(cph.summary) > 0:
                            p_value_cox = float(cph.summary.iloc[0]['p'])
                    except:
                        pass
                    
                    try:
                        if 'outlier_status' in cph.confidence_intervals_.index:
                            ci_lower = float(cph.confidence_intervals_.loc['outlier_status', 'lower 0.95'])
                            ci_upper = float(cph.confidence_intervals_.loc['outlier_status', 'upper 0.95'])
                    except:
                        pass
                    
                    cox_results = {
                        "hazard_ratio": hr_value,
                        "p_value": p_value_cox,
                        "ci_lower": ci_lower,
                        "ci_upper": ci_upper,
                        "interpretation": self._interpret_cox_model(hr_value if hr_value else 1, p_value_cox if p_value_cox else 1)
                    }
                except Exception as e:
                    cox_results = {"error": f"No se pudo ajustar el modelo de Cox: {str(e)}"}
            
            return {
                "success": True,
                "time_variable": time_variable,
                "event_variable": event_variable,
                "outliers_count": len(outliers_times),
                "normals_count": len(normal_times),
                "outliers_events": int(outliers_events.sum()),
                "normals_events": int(normal_events.sum()),
                "survival_curves": survival_curves,
                "median_survival": {
                    "outliers": float(outliers_median) if outliers_median is not None and np.isfinite(outliers_median) else None,
                    "normal": float(normal_median) if normal_median is not None and np.isfinite(normal_median) else None
                },
                "logrank_test": {
                    "test_statistic": float(results_logrank.test_statistic) if np.isfinite(results_logrank.test_statistic) else None,
                    "p_value": float(results_logrank.p_value) if np.isfinite(results_logrank.p_value) else None,
                    "interpretation": self._interpret_logrank_test(results_logrank.p_value)
                },
                "cox_model": cox_results,
                "interpretation": self._interpret_survival_analysis(results_logrank.p_value, outliers_median, normal_median, cox_results)
            }
            
        except ImportError:
            return {"error": "La librería lifelines no está instalada. Instala con: pip install lifelines"}
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en análisis de supervivencia: {str(e)}"}
    
    def _interpret_logrank_test(self, p_value: float) -> str:
        """Interpreta el test de log-rank"""
        if p_value < 0.001:
            return f"Diferencia altamente significativa en supervivencia entre grupos (p<0.001)."
        elif p_value < 0.05:
            return f"Diferencia significativa en supervivencia entre grupos (p={p_value:.4f})."
        else:
            return f"No se encontró diferencia significativa en supervivencia entre grupos (p={p_value:.4f})."
    
    def _interpret_cox_model(self, hazard_ratio: float, p_value: float) -> str:
        """Interpreta el modelo de Cox"""
        if p_value < 0.05:
            if hazard_ratio > 1:
                return f"Los outliers tienen un riesgo {hazard_ratio:.2f} veces mayor de desarrollar el evento (HR={hazard_ratio:.2f}, p={p_value:.4f})."
            else:
                return f"Los outliers tienen un riesgo {1/hazard_ratio:.2f} veces menor de desarrollar el evento (HR={hazard_ratio:.2f}, p={p_value:.4f})."
        else:
            return f"No se encontró asociación significativa entre outliers y el riesgo de evento (HR={hazard_ratio:.2f}, p={p_value:.4f})."
    
    def _interpret_survival_analysis(self, logrank_p: float, outliers_median: float, normal_median: float, cox_results: Dict) -> str:
        """Interpreta los resultados completos del análisis de supervivencia"""
        interpretation_parts = []
        
        if logrank_p < 0.05:
            interpretation_parts.append("Las curvas de supervivencia difieren significativamente entre outliers y normales.")
            if outliers_median is not None and normal_median is not None:
                if outliers_median < normal_median:
                    interpretation_parts.append(f"Los outliers tienen una mediana de supervivencia menor ({outliers_median:.2f}) que los normales ({normal_median:.2f}), sugiriendo peor pronóstico.")
                else:
                    interpretation_parts.append(f"Los outliers tienen una mediana de supervivencia mayor ({outliers_median:.2f}) que los normales ({normal_median:.2f}), sugiriendo mejor pronóstico.")
        else:
            interpretation_parts.append("No se encontraron diferencias significativas en las curvas de supervivencia entre grupos.")
        
        if cox_results and 'hazard_ratio' in cox_results and cox_results.get('p_value', 1) < 0.05:
            hr = cox_results['hazard_ratio']
            interpretation_parts.append(f"El modelo de Cox confirma una asociación significativa (HR={hr:.2f}), ajustando por otras variables.")
        
        return " ".join(interpretation_parts) if interpretation_parts else "Análisis de supervivencia completado."
    
    def outlier_clustering_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], method: str = 'kmeans', outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fase 2.2: Clustering de Outliers (K-means y DBSCAN)
        
        Identifica subtipos dentro de los outliers mediante clustering.
        DBSCAN encuentra grupos densos sin especificar el número a priori.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            method: 'kmeans', 'dbscan', o 'both'
            outlier_results: Diccionario con resultados de detección de outliers (opcional, para obtener conteos correctos)
        
        Returns:
            Diccionario con resultados de clustering
        """
        try:
            from sklearn.cluster import KMeans, DBSCAN
            from sklearn.preprocessing import StandardScaler
            from sklearn.metrics import silhouette_score
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            # Obtener conteo CORRECTO de outliers finales del outlier_results
            # Esto es la fuente de verdad, no el DataFrame que puede tener inconsistencias
            total_outliers_original = None
            if outlier_results:
                # Usar outliers_detected si está disponible (es la fuente de verdad)
                if 'outliers_detected' in outlier_results:
                    total_outliers_original = int(outlier_results['outliers_detected'])
                elif 'final_outliers' in outlier_results:
                    total_outliers_original = len(outlier_results['final_outliers'])
            
            # Obtener solo outliers para el clustering (necesitamos las filas para el análisis)
            outliers_df = df[df['es_outlier'] == 'Outlier'].copy()
            
            # Usar el conteo correcto de outliers_detected si está disponible
            outliers_count = total_outliers_original if total_outliers_original is not None else len(outliers_df)
            
            if outliers_count < 3:
                return {
                    "error": f"Insufficient outliers for clustering. Detected: {outliers_count}, Minimum required: 3.",
                    "outliers_detected": outliers_count,
                    "minimum_required": 3
                }
            
            # Obtener variables numéricas
            numerical_cols = [col for col in df.columns 
                            if col != 'es_outlier' and self.is_numeric_variable(variable_types.get(col, ''))]
            
            if len(numerical_cols) < 2:
                return {"error": "Se requieren al menos 2 variables numéricas."}
            
            # Filtrar y escalar datos
            outliers_clean = outliers_df[numerical_cols].dropna()
            
            if len(outliers_clean) < 3:
                return {"error": "Insuficientes datos válidos después de filtrar NaN."}
            
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(outliers_clean)
            
            # Contar outliers únicos después del dropna usando IDs de final_outliers
            outliers_count_after_dropna = None
            if outlier_results and 'final_outliers' in outlier_results:
                subject_id_column = outlier_results.get('subject_id_column')
                final_outlier_ids_set = set(outlier_results['final_outliers'])
                
                # Contar cuántos IDs únicos de outliers están presentes después del dropna
                outliers_present_after_dropna = set()
                for idx in outliers_clean.index:
                    outlier_id = None
                    if subject_id_column and subject_id_column in df.columns:
                        outlier_id = str(df.loc[idx, subject_id_column])
                    else:
                        outlier_id = f"ID_{idx}"
                    
                    if outlier_id in final_outlier_ids_set:
                        outliers_present_after_dropna.add(outlier_id)
                
                outliers_count_after_dropna = len(outliers_present_after_dropna)
            
            # Usar el conteo correcto si está disponible, sino usar el número de filas
            outliers_count_display = total_outliers_original if total_outliers_original is not None else len(outliers_clean)
            
            results = {
                "outliers_count": outliers_count_display,  # Usar conteo correcto de outliers únicos
                "outliers_count_rows": len(outliers_clean),  # Número de filas usadas para clustering
                "variables_used": numerical_cols,
                "kmeans_results": None,
                "dbscan_results": None
            }
            
            # K-means
            if method in ['kmeans', 'both']:
                try:
                    # Determinar número óptimo de clusters (máximo 5 o n/3)
                    max_k = min(5, max(2, len(outliers_clean) // 3))
                    best_k = 2
                    best_silhouette = -1
                    
                    
                    for k in range(2, max_k + 1):
                        try:
                            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                            labels = kmeans.fit_predict(X_scaled)
                            if len(set(labels)) > 1:
                                silhouette = silhouette_score(X_scaled, labels)
                                if silhouette > best_silhouette:
                                    best_silhouette = silhouette
                                    best_k = k
                        except Exception as e:
                            continue
                    
                    if best_silhouette == -1:
                        # Si no se pudo calcular silueta, usar k=2 por defecto
                        best_k = 2
                        best_silhouette = 0.0
                    
                    kmeans_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
                    kmeans_labels = kmeans_final.fit_predict(X_scaled)
                    
                    # Reducir dimensionalidad a 2D usando PCA para visualización
                    from sklearn.decomposition import PCA
                    pca_viz = PCA(n_components=2)
                    X_pca = pca_viz.fit_transform(X_scaled)
                    
                    # Agrupar outliers por cluster y obtener IDs de sujetos
                    cluster_assignments = {}
                    cluster_assignments_ids = {}  # IDs de sujetos en lugar de índices
                    cluster_data_points = {}  # Datos para visualización
                    subject_id_column = outlier_results.get('subject_id_column') if outlier_results else None
                    
                    for idx, label in enumerate(kmeans_labels):
                        outlier_idx = outliers_clean.index[idx]
                        # Convertir label a int nativo de Python (no numpy)
                        label_int = int(label) if not isinstance(label, (int, str)) else label
                        
                        # Obtener ID de sujeto
                        subject_id = None
                        if subject_id_column and subject_id_column in df.columns:
                            subject_id = str(df.loc[outlier_idx, subject_id_column])
                        else:
                            subject_id = f"ID_{outlier_idx}"
                        
                        if label_int not in cluster_assignments:
                            cluster_assignments[label_int] = []
                            cluster_assignments_ids[label_int] = []
                            cluster_data_points[label_int] = []
                        
                        # Agregar índice
                        try:
                            cluster_assignments[label_int].append(int(outlier_idx))
                        except (ValueError, TypeError):
                            cluster_assignments[label_int].append(str(outlier_idx))
                        
                        # Agregar ID de sujeto
                        cluster_assignments_ids[label_int].append(subject_id)
                        
                        # Agregar datos para visualización (coordenadas PCA)
                        cluster_data_points[label_int].append({
                            'pc1': float(X_pca[idx, 0]),
                            'pc2': float(X_pca[idx, 1]),
                            'subject_id': subject_id,
                            'index': int(outlier_idx) if isinstance(outlier_idx, (int, np.integer)) else str(outlier_idx)
                        })
                    
                    # Formatear interpretación de forma segura
                    silhouette_str = f"{best_silhouette:.3f}" if np.isfinite(best_silhouette) else "N/A"
                    interpretation = f"K-means identificó {best_k} subtipos de outliers"
                    if best_silhouette != -1 and np.isfinite(best_silhouette):
                        interpretation += f" con un score de silueta de {best_silhouette:.3f}"
                    interpretation += "."
                    
                    # Convertir cluster_centers a lista de forma segura
                    cluster_centers_list = []
                    try:
                        for center in kmeans_final.cluster_centers_:
                            center_list = [float(x) if np.isfinite(x) else 0.0 for x in center]
                            cluster_centers_list.append(center_list)
                    except Exception as e:
                        cluster_centers_list = []
                    
                    # Calcular centroides en espacio PCA para visualización
                    cluster_centers_pca = {}
                    for cluster_id, points in cluster_data_points.items():
                        if points:
                            center_pc1 = np.mean([p['pc1'] for p in points])
                            center_pc2 = np.mean([p['pc2'] for p in points])
                            cluster_centers_pca[cluster_id] = {
                                'pc1': float(center_pc1),
                                'pc2': float(center_pc2)
                            }
                    
                    results["kmeans_results"] = {
                        "n_clusters": int(best_k),
                        "silhouette_score": float(best_silhouette) if np.isfinite(best_silhouette) else None,
                        "cluster_assignments": cluster_assignments,  # Índices (para compatibilidad)
                        "cluster_assignments_ids": cluster_assignments_ids,  # IDs de sujetos
                        "cluster_data_points": cluster_data_points,  # Datos para visualización
                        "cluster_centers": cluster_centers_list,  # Centroides en espacio original
                        "cluster_centers_pca": cluster_centers_pca,  # Centroides en espacio PCA
                        "pca_explained_variance": [float(x) for x in pca_viz.explained_variance_ratio_],
                        "interpretation": interpretation
                    }
                except Exception as e:
                    import traceback
                    error_trace = traceback.format_exc()
                    results["kmeans_results"] = None
            
            # DBSCAN
            if method in ['dbscan', 'both']:
                try:
                    # Ajustar parámetros de DBSCAN
                    eps = 0.5  # Distancia máxima entre puntos
                    min_samples = max(2, len(outliers_clean) // 10)  # Mínimo de puntos por cluster
                    
                    
                    dbscan = DBSCAN(eps=eps, min_samples=min_samples)
                    dbscan_labels = dbscan.fit_predict(X_scaled)
                    
                    n_clusters_dbscan = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
                    n_noise = list(dbscan_labels).count(-1)
                    
                    # Reducir dimensionalidad a 2D usando PCA para visualización DBSCAN
                    from sklearn.decomposition import PCA
                    pca_viz_dbscan = PCA(n_components=2)
                    X_pca_dbscan = pca_viz_dbscan.fit_transform(X_scaled)
                    
                    # Agrupar outliers por cluster y obtener IDs de sujetos
                    cluster_assignments_dbscan = {}
                    cluster_assignments_dbscan_ids = {}  # IDs de sujetos
                    subject_id_column_dbscan = outlier_results.get('subject_id_column') if outlier_results else None
                    
                    for idx, label in enumerate(dbscan_labels):
                        if label == -1:
                            continue  # Ruido
                        outlier_idx = outliers_clean.index[idx]
                        # Convertir label a int nativo de Python (no numpy)
                        label_int = int(label) if not isinstance(label, (int, str)) else label
                        
                        # Obtener ID de sujeto
                        subject_id = None
                        if subject_id_column_dbscan and subject_id_column_dbscan in df.columns:
                            subject_id = str(df.loc[outlier_idx, subject_id_column_dbscan])
                        else:
                            subject_id = f"ID_{outlier_idx}"
                        
                        if label_int not in cluster_assignments_dbscan:
                            cluster_assignments_dbscan[label_int] = []
                            cluster_assignments_dbscan_ids[label_int] = []
                        
                        # Agregar índice
                        try:
                            cluster_assignments_dbscan[label_int].append(int(outlier_idx))
                        except (ValueError, TypeError):
                            cluster_assignments_dbscan[label_int].append(str(outlier_idx))
                        
                        # Agregar ID de sujeto
                        cluster_assignments_dbscan_ids[label_int].append(subject_id)
                    
                    results["dbscan_results"] = {
                        "n_clusters": n_clusters_dbscan,
                        "n_noise_points": n_noise,
                        "eps": eps,
                        "min_samples": min_samples,
                        "cluster_assignments": cluster_assignments_dbscan,  # Índices (para compatibilidad)
                        "cluster_assignments_ids": cluster_assignments_dbscan_ids,  # IDs de sujetos
                        "interpretation": f"DBSCAN identificó {n_clusters_dbscan} clusters densos y {n_noise} puntos de ruido."
                    }
                except Exception as e:
                    import traceback
                    error_trace = traceback.format_exc()
                    results["dbscan_results"] = None
            
            return results
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en clustering de outliers: {str(e)}"}
    
    def predictive_model_analysis(self, df: pd.DataFrame, variable_types: Dict[str, str], predictors: List[str] = None, outlier_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Fase 3.2: Modelo Predictivo (Random Forest)
        
        Entrena un modelo para predecir la condición de outlier usando variables
        clínicas/demográficas y analiza la importancia de variables.
        
        Args:
            df: DataFrame con columna 'es_outlier' marcada
            variable_types: Diccionario con tipos de variables
            predictors: Lista de variables predictoras (si None, usa todas las numéricas y categóricas)
            outlier_results: Diccionario con resultados de detección de outliers (para obtener subject_id_column)
        
        Returns:
            Diccionario con resultados del modelo predictivo
        """
        try:
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.model_selection import train_test_split
            from sklearn.preprocessing import LabelEncoder, StandardScaler
            from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
            
            if 'es_outlier' not in df.columns:
                return {"error": "La columna 'es_outlier' no se encuentra en el DataFrame."}
            
            # Obtener subject_id_column de outlier_results para excluirlo de predictores
            subject_id_column = None
            if outlier_results:
                subject_id_column = outlier_results.get('subject_id_column')
            
            # Preparar variables predictoras
            if predictors is None:
                predictors = [col for col in df.columns 
                            if col != 'es_outlier' and 
                            col != subject_id_column and  # Excluir ID del sujeto para evitar sobreajuste
                            (self.is_numeric_variable(variable_types.get(col, '')) or 
                             self.is_categorical_variable(variable_types.get(col, '')))]
            else:
                # Filtrar explícitamente el subject_id_column si está en la lista de predictores
                if subject_id_column and subject_id_column in predictors:
                    predictors = [p for p in predictors if p != subject_id_column]
                    warnings.warn(f"La columna '{subject_id_column}' (ID del sujeto) ha sido excluida de las variables predictoras para evitar sobreajuste.")
            
            if not predictors:
                return {"error": "No se encontraron variables predictoras válidas (excluyendo ID del sujeto)."}
            
            # Preparar datos
            df_clean = df[['es_outlier'] + predictors].dropna()
            
            if len(df_clean) < 10:
                return {
                    "error": f"Insufficient data to train the model. Available: {len(df_clean)} observations, Minimum required: 10.",
                    "available_data_points": len(df_clean),
                    "minimum_required": 10
                }
            
            # Codificar variable objetivo
            le_target = LabelEncoder()
            y = le_target.fit_transform(df_clean['es_outlier'])
            
            if len(set(y)) < 2:
                unique_classes_after_encoding = df_clean['es_outlier'].unique()
                return {
                    "error": f"Only one class found in the data after encoding: {unique_classes_after_encoding[0] if len(unique_classes_after_encoding) > 0 else 'unknown'}. At least 2 classes are required for predictive modeling.",
                    "available_data_points": len(df_clean),
                    "classes_found": list(unique_classes_after_encoding)
                }
            
            # Preparar features
            X = df_clean[predictors].copy()
            
            # Codificar variables categóricas
            le_dict = {}
            for col in predictors:
                if self.is_categorical_variable(variable_types.get(col, '')):
                    le = LabelEncoder()
                    X[col] = le.fit_transform(X[col].astype(str))
                    le_dict[col] = le
            
            # Escalar variables numéricas
            numeric_cols = [col for col in predictors if self.is_numeric_variable(variable_types.get(col, ''))]
            if numeric_cols:
                scaler = StandardScaler()
                X[numeric_cols] = scaler.fit_transform(X[numeric_cols])
            
            # Verificar distribución de clases ANTES del split
            unique_classes, class_counts = np.unique(y, return_counts=True)
            min_class_count = min(class_counts) if len(class_counts) > 1 else class_counts[0]
            
            # Validar que hay suficientes datos para entrenar y probar el modelo
            # Necesitamos al menos 2 de cada clase en el conjunto de entrenamiento
            # y al menos 1 de cada clase en el conjunto de prueba
            if min_class_count < 2:
                return {
                    "error": f"Insufficient data for predictive model. The minority class has only {min_class_count} observation(s). Minimum required: 2 observations per class.",
                    "available_data_points": len(df_clean),
                    "minority_class_count": int(min_class_count),
                    "minimum_required_per_class": 2,
                    "class_distribution": {f"Class {int(cls)}": int(count) for cls, count in zip(unique_classes, class_counts)}
                }
            
            # Ajustar test_size si hay muy pocos datos
            # Si hay menos de 20 observaciones, usar un test_size más pequeño
            test_size = 0.2
            if len(df_clean) < 20:
                # Con pocos datos, usar test_size más pequeño para asegurar que haya datos en ambos conjuntos
                test_size = max(0.1, min_class_count / len(df_clean))
                if test_size >= 0.5:
                    # Si necesitamos más del 50% para el test, no podemos hacer el split
                    return {
                        "error": f"Insufficient data for train/test split. Need at least 2 observations per class in training set, but only {min_class_count} available in minority class.",
                        "available_data_points": len(df_clean),
                        "minority_class_count": int(min_class_count),
                        "minimum_required_per_class": 2
                    }
            
            # Dividir en entrenamiento y prueba
            # Si hay muy pocos datos de una clase, no usar stratify para evitar errores
            if min_class_count >= 2:  # Necesitamos al menos 2 de cada clase para stratify
                try:
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)
                except ValueError as e:
                    # Si stratify falla, hacer split sin estratificación
                    warnings.warn(f"Could not stratify train/test split: {str(e)}. Proceeding without stratification.")
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=None)
            else:
                warnings.warn(f"Minority class has only {min_class_count} observation(s). Cannot use stratification.")
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=None)
            
            # Verificar que después del split hay al menos 2 clases en ambos conjuntos
            unique_classes_train = np.unique(y_train)
            unique_classes_test = np.unique(y_test)
            
            # Calcular distribución de clases en entrenamiento y prueba para logging y resultados
            train_class_counts = np.bincount(y_train)
            test_class_counts = np.bincount(y_test)
            
            # Mapear clases numéricas a nombres (0 = Normal, 1 = Outlier típicamente)
            class_names = le_target.classes_
            train_class_distribution = {}
            test_class_distribution = {}
            for i, class_name in enumerate(class_names):
                train_class_distribution[str(class_name)] = int(train_class_counts[i]) if i < len(train_class_counts) else 0
                test_class_distribution[str(class_name)] = int(test_class_counts[i]) if i < len(test_class_counts) else 0
            
            print(f"  Total observaciones: {len(df_clean)}")
            for i, class_name in enumerate(class_names):
                print(f"  {class_name}: {class_counts[i]}")
            print(f"  Entrenamiento ({len(X_train)} observaciones):")
            for class_name, count in train_class_distribution.items():
                print(f"    {class_name}: {count}")
            print(f"  Prueba ({len(X_test)} observaciones):")
            for class_name, count in test_class_distribution.items():
                print(f"    {class_name}: {count}")
            
            if len(unique_classes_train) < 2:
                return {
                    "error": f"Insufficient data in training set. Only {len(unique_classes_train)} class(es) found after train/test split. Need at least 2 classes.",
                    "available_data_points": len(df_clean),
                    "training_set_size": len(y_train),
                    "test_set_size": len(y_test),
                    "classes_in_training": [int(cls) for cls in unique_classes_train]
                }
            
            if len(unique_classes_test) < 2:
                return {
                    "error": f"Insufficient data in test set. Only {len(unique_classes_test)} class(es) found after train/test split. Need at least 2 classes.",
                    "available_data_points": len(df_clean),
                    "training_set_size": len(y_train),
                    "test_set_size": len(y_test),
                    "classes_in_test": [int(cls) for cls in unique_classes_test]
                }
            
            # Calcular parámetros de regularización según el tamaño del dataset
            # Para evitar sobreajuste, especialmente en datasets pequeños
            n_samples = len(X_train)
            
            # Ajustar max_depth según el tamaño del dataset
            # Para datasets pequeños (< 50), usar max_depth más conservador
            if n_samples < 20:
                max_depth = 3
                min_samples_split = 5
                min_samples_leaf = 2
            elif n_samples < 50:
                max_depth = 5
                min_samples_split = 4
                min_samples_leaf = 2
            elif n_samples < 100:
                max_depth = 7
                min_samples_split = 3
                min_samples_leaf = 1
            else:
                max_depth = 10
                min_samples_split = 2
                min_samples_leaf = 1
            
            # Ajustar n_estimators según el tamaño del dataset
            n_estimators = min(100, max(50, n_samples // 2))
            
            # Entrenar Random Forest con parámetros de regularización
            rf = RandomForestClassifier(
                n_estimators=n_estimators,
                random_state=42,
                max_depth=max_depth,
                min_samples_split=min_samples_split,
                min_samples_leaf=min_samples_leaf,
                max_features='sqrt',  # Usar sqrt de features para más regularización
                class_weight='balanced'  # Balancear clases si hay desbalance
            )
            rf.fit(X_train, y_train)
            
            # Predicciones
            y_pred = rf.predict(X_test)
            y_pred_proba = rf.predict_proba(X_test)[:, 1]
            
            # Métricas
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
            
            auc_score = roc_auc_score(y_test, y_pred_proba)
            cm = confusion_matrix(y_test, y_pred)
            tn, fp, fn, tp = cm.ravel()
            
            # Calcular métricas adicionales
            accuracy = accuracy_score(y_test, y_pred)
            precision = precision_score(y_test, y_pred, zero_division=0)
            recall = recall_score(y_test, y_pred, zero_division=0)
            f1 = f1_score(y_test, y_pred, zero_division=0)
            
            # Curva ROC
            fpr, tpr, roc_thresholds = roc_curve(y_test, y_pred_proba)
            
            # Limpiar valores infinitos y NaN de la curva ROC para JSON
            # Los thresholds pueden tener valores inf, necesitamos limpiarlos
            fpr_clean = [float(x) if np.isfinite(x) else 0.0 for x in fpr]
            tpr_clean = [float(x) if np.isfinite(x) else 0.0 for x in tpr]
            # Para thresholds, reemplazar inf con valores extremos pero finitos
            thresholds_clean = []
            for x in roc_thresholds:
                if np.isinf(x) and x > 0:
                    thresholds_clean.append(1.0)  # Infinito positivo -> 1.0
                elif np.isinf(x) and x < 0:
                    thresholds_clean.append(0.0)  # Infinito negativo -> 0.0
                elif np.isfinite(x):
                    thresholds_clean.append(float(x))
                else:
                    thresholds_clean.append(0.0)  # NaN -> 0.0
            
            # Importancia de variables
            feature_importance = list(zip(predictors, rf.feature_importances_))
            feature_importance.sort(key=lambda x: x[1], reverse=True)
            
            # Detectar posible sobreajuste (métricas perfectas)
            overfitting_warning = None
            if accuracy >= 0.999 and precision >= 0.999 and recall >= 0.999 and auc_score >= 0.999:
                overfitting_warning = (
                    "⚠️ ADVERTENCIA: El modelo muestra métricas perfectas (1.000), lo cual puede indicar sobreajuste. "
                    "Posibles causas: (1) Dataset muy pequeño, (2) Variables predictoras incluyen información que define directamente los outliers, "
                    "(3) El modelo está memorizando los datos en lugar de aprender patrones generalizables. "
                    "Se recomienda: (1) Usar más datos, (2) Revisar las variables predictoras seleccionadas, "
                    "(3) Validar el modelo con datos independientes."
                )
            
            return {
                "success": True,
                "model_type": "Random Forest",
                "auc_score": float(auc_score) if np.isfinite(auc_score) else None,
                "accuracy": float(accuracy) if np.isfinite(accuracy) else None,
                "precision": float(precision) if np.isfinite(precision) else None,
                "recall": float(recall) if np.isfinite(recall) else None,
                "f1_score": float(f1) if np.isfinite(f1) else None,
                "overfitting_warning": overfitting_warning,
                "model_params": {
                    "n_estimators": n_estimators,
                    "max_depth": max_depth,
                    "min_samples_split": min_samples_split,
                    "min_samples_leaf": min_samples_leaf,
                    "training_samples": len(X_train),
                    "test_samples": len(X_test)
                },
                "confusion_matrix": {
                    "true_negatives": int(tn),
                    "false_positives": int(fp),
                    "false_negatives": int(fn),
                    "true_positives": int(tp),
                    "matrix": cm.tolist()  # Matriz completa para visualización
                },
                "roc_curve": {
                    "fpr": fpr_clean,
                    "tpr": tpr_clean,
                    "thresholds": thresholds_clean
                },
                "feature_importance": [
                    {"variable": var, "importance": float(imp)} 
                    for var, imp in feature_importance
                ],
                "training_size": len(X_train),
                "test_size": len(X_test),
                "interpretation": self._interpret_predictive_model(auc_score, feature_importance[:5])
            }
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            return {"error": f"Error en modelo predictivo: {str(e)}"}
    
    def _interpret_predictive_model(self, auc_score: float, top_features: List[Tuple]) -> str:
        """Interpreta los resultados del modelo predictivo"""
        interpretation = f"El modelo Random Forest alcanzó un AUC-ROC de {auc_score:.3f}. "
        
        if auc_score >= 0.9:
            interpretation += "Excelente capacidad predictiva. "
        elif auc_score >= 0.8:
            interpretation += "Buena capacidad predictiva. "
        elif auc_score >= 0.7:
            interpretation += "Capacidad predictiva aceptable. "
        else:
            interpretation += "Capacidad predictiva limitada. "
        
        if top_features:
            top_vars = [var for var, _ in top_features]
            interpretation += f"Las variables más importantes para predecir outliers son: {', '.join(top_vars[:3])}."
        
        return interpretation