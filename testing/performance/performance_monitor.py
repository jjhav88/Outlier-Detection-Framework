# -*- coding: utf-8 -*-
"""
Sistema de monitoreo de rendimiento
Mide tiempos de ejecución, uso de memoria y CPU
"""

import time
import psutil
import os
from functools import wraps
from typing import Dict, List
from collections import deque
from datetime import datetime
import json


class PerformanceMonitor:
    """Monitor de rendimiento para la aplicación"""
    
    def __init__(self, max_history: int = 1000):
        self.max_history = max_history
        self.request_times: deque = deque(maxlen=max_history)
        self.endpoint_stats: Dict[str, Dict] = {}
        self.process = psutil.Process(os.getpid())
        self.start_time = time.time()
    
    def record_request(self, endpoint: str, method: str, duration: float, status_code: int):
        """Registrar una petición HTTP"""
        timestamp = datetime.now().isoformat()
        record = {
            'timestamp': timestamp,
            'endpoint': endpoint,
            'method': method,
            'duration': duration,
            'status_code': status_code
        }
        self.request_times.append(record)
        
        # Actualizar estadísticas por endpoint
        key = f"{method} {endpoint}"
        if key not in self.endpoint_stats:
            self.endpoint_stats[key] = {
                'count': 0,
                'total_time': 0,
                'min_time': float('inf'),
                'max_time': 0,
                'avg_time': 0,
                'errors': 0,
                'success': 0
            }
        
        stats = self.endpoint_stats[key]
        stats['count'] += 1
        stats['total_time'] += duration
        stats['min_time'] = min(stats['min_time'], duration)
        stats['max_time'] = max(stats['max_time'], duration)
        stats['avg_time'] = stats['total_time'] / stats['count']
        
        if status_code >= 400:
            stats['errors'] += 1
        else:
            stats['success'] += 1
    
    def get_system_metrics(self) -> Dict:
        """Obtener métricas del sistema"""
        try:
            cpu_percent = self.process.cpu_percent(interval=0.1)
            memory_info = self.process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            
            return {
                'cpu_percent': cpu_percent,
                'memory_mb': round(memory_mb, 2),
                'memory_percent': self.process.memory_percent(),
                'uptime_seconds': time.time() - self.start_time,
                'num_threads': self.process.num_threads(),
                'open_files': len(self.process.open_files())
            }
        except:
            return {
                'cpu_percent': 0,
                'memory_mb': 0,
                'memory_percent': 0,
                'uptime_seconds': time.time() - self.start_time,
                'num_threads': 0,
                'open_files': 0
            }
    
    def get_performance_summary(self) -> Dict:
        """Obtener resumen de rendimiento"""
        if not self.request_times:
            return {
                'total_requests': 0,
                'avg_response_time': 0,
                'min_response_time': 0,
                'max_response_time': 0,
                'requests_per_second': 0,
                'error_rate': 0
            }
        
        durations = [r['duration'] for r in self.request_times]
        errors = sum(1 for r in self.request_times if r['status_code'] >= 400)
        total_time = time.time() - self.start_time
        
        return {
            'total_requests': len(self.request_times),
            'avg_response_time': sum(durations) / len(durations),
            'min_response_time': min(durations),
            'max_response_time': max(durations),
            'requests_per_second': len(self.request_times) / total_time if total_time > 0 else 0,
            'error_rate': errors / len(self.request_times) if self.request_times else 0,
            'endpoint_stats': self.endpoint_stats
        }
    
    def get_slow_requests(self, threshold: float = 1.0) -> List[Dict]:
        """Obtener requests que tardaron más del umbral"""
        return [r for r in self.request_times if r['duration'] > threshold]
    
    def reset_performance_metrics(self):
        """Resetear métricas de rendimiento (mantiene métricas del sistema como uptime)"""
        self.request_times.clear()
        self.endpoint_stats.clear()
        # No resetear start_time ni process, ya que son métricas del sistema
    
    def export_report(self, filepath: str = "performance_report.json"):
        """Exportar reporte de rendimiento"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'system_metrics': self.get_system_metrics(),
            'performance_summary': self.get_performance_summary(),
            'slow_requests': self.get_slow_requests()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return report


# Instancia global del monitor
performance_monitor = PerformanceMonitor()


def measure_performance(endpoint_name: str = None):
    """Decorador para medir el rendimiento de funciones"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                # Registrar si es un endpoint HTTP
                if endpoint_name:
                    performance_monitor.record_request(
                        endpoint_name,
                        'POST' if 'request' in str(func) else 'GET',
                        duration,
                        200
                    )
                return result
            except Exception as e:
                duration = time.time() - start_time
                if endpoint_name:
                    performance_monitor.record_request(
                        endpoint_name,
                        'POST' if 'request' in str(func) else 'GET',
                        duration,
                        500
                    )
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                if endpoint_name:
                    performance_monitor.record_request(
                        endpoint_name,
                        'POST' if 'request' in str(func) else 'GET',
                        duration,
                        200
                    )
                return result
            except Exception as e:
                duration = time.time() - start_time
                if endpoint_name:
                    performance_monitor.record_request(
                        endpoint_name,
                        'POST' if 'request' in str(func) else 'GET',
                        duration,
                        500
                    )
                raise
        
        # Retornar el wrapper apropiado según si la función es async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator

