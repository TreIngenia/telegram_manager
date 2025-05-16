import os
import json
import logging
from datetime import datetime
from pathlib import Path

def setup_logger(name, log_file, level=logging.INFO):
    """Configura un logger con salvataggio su file."""
    # Crea directory per i log se non esiste
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    # Configurazione logger
    handler = logging.FileHandler(log_file)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.addHandler(handler)
    
    # Aggiungi anche un handler per la console
    console = logging.StreamHandler()
    console.setLevel(level)
    console.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(console)
    
    return logger

def json_serialize(obj):
    """Serializzatore JSON personalizzato per oggetti non serializzabili di default."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, Path):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def save_to_json(data, file_path):
    """Salva dati in formato JSON su file."""
    try:
        # Crea directory se non esiste
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, default=json_serialize, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"Errore nel salvataggio del file JSON {file_path}: {e}")
        return False

def load_from_json(file_path, default=None):
    """Carica dati da un file JSON."""
    try:
        if not os.path.exists(file_path):
            return default
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Errore nel caricamento del file JSON {file_path}: {e}")
        return default

def ensure_directory(path):
    """Assicura che una directory esista."""
    try:
        os.makedirs(path, exist_ok=True)
        return True
    except Exception as e:
        logging.error(f"Errore nella creazione della directory {path}: {e}")
        return False

def sanitize_filename(filename):
    """Sanitizza il nome di un file rimuovendo caratteri non validi."""
    # Caratteri non validi nei nomi dei file
    invalid_chars = '<>:"/\\|?*'
    
    # Sostituisci caratteri non validi
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    
    # Limita la lunghezza del nome file
    if len(filename) > 255:
        filename = filename[:255]
    
    return filename

def get_file_extension(filename):
    """Ottiene l'estensione di un file."""
    return os.path.splitext(filename)[1].lower()

def get_media_type(filename):
    """Determina il tipo di media in base all'estensione del file."""
    ext = get_file_extension(filename)
    
    # Estensioni comuni per immagini
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    
    # Estensioni comuni per video
    video_extensions = {'.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'}
    
    if ext in image_extensions:
        return 'image'
    elif ext in video_extensions:
        return 'video'
    else:
        return 'other'

def format_bytes(size):
    """Formatta dimensioni in bytes in un formato leggibile."""
    power = 2**10  # 1024
    n = 0
    power_labels = {0: 'B', 1: 'KB', 2: 'MB', 3: 'GB', 4: 'TB'}
    
    while size > power and n < 4:
        size /= power
        n += 1
    
    return f"{size:.2f} {power_labels[n]}"