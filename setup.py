import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_directory(path):
    """Crea una directory se non esiste già."""
    try:
        os.makedirs(path, exist_ok=True)
        logger.info(f"Directory creata: {path}")
    except Exception as e:
        logger.error(f"Errore nella creazione della directory {path}: {e}")

def setup_application():
    """Configura la struttura delle directory dell'applicazione."""
    logger.info("Inizializzazione struttura directory dell'applicazione...")
    
    # Directory principali
    base_dir = Path.cwd()
    
    # Crea directory base
    directories = [
        base_dir / "templates",
        base_dir / "static",
        base_dir / "static" / "css",
        base_dir / "static" / "js",
        base_dir / "static" / "img",
        base_dir / os.getenv("SESSIONS_PATH").strip("/"),
        base_dir / os.getenv("LOGS_PATH").strip("/"),
        base_dir / os.getenv("BASE_MEDIA_PATH").strip("/"),
        base_dir / os.getenv("BASE_DOWNLOAD_PATH").strip("/"),
        base_dir / os.getenv("BASE_ARCHIVE_PATH").strip("/"),
    ]
    
    # Crea tutte le directory
    for directory in directories:
        create_directory(directory)
    
    # Crea file di log iniziale
    log_path = base_dir / os.getenv("LOGS_PATH").strip("/") / "app.log"
    with open(log_path, 'w') as f:
        f.write("# Log dell'applicazione Telegram Manager\n")
    
    # Crea file README.md
    with open(base_dir / "README.md", 'w') as f:
        f.write("# Telegram Manager\n\n")
        f.write("Applicazione web per la gestione di utenti Telegram, monitoraggio messaggi e download media.\n\n")
        f.write("## Installazione\n\n")
        f.write("1. Clona il repository\n")
        f.write("2. Installa le dipendenze: `pip install -r requirements.txt`\n")
        f.write("3. Configura il file `.env` con i tuoi API_ID e API_HASH di Telegram\n")
        f.write("4. Esegui `python setup.py` per creare la struttura delle directory\n")
        f.write("5. Avvia l'applicazione: `python app.py`\n\n")
        f.write("## Funzionalità\n\n")
        f.write("- Gestione utenti Telegram\n")
        f.write("- Gestione gruppi\n")
        f.write("- Monitoraggio messaggi in tempo reale\n")
        f.write("- Download media dai gruppi\n")
        f.write("- Archivio storico media\n")
        f.write("- Interfaccia web moderna con Bootstrap 5\n")
    
    logger.info("Configurazione completata con successo!")

if __name__ == "__main__":
    setup_application()