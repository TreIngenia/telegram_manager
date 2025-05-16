import os
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from telethon import types
from dotenv import load_dotenv
from modules.telegram_client import TelegramClientManager
from modules.group_manager import GroupManager
from modules.utils import setup_logger, ensure_directory, sanitize_filename, get_media_type

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logger
logger = setup_logger('media_downloader', os.path.join(os.getenv('LOGS_PATH'), 'media_downloader.log'))

class MediaDownloader:
    """Gestisce il download dei media dai gruppi Telegram."""
    
    def __init__(self, socketio=None):
        self.telegram_manager = TelegramClientManager()
        self.group_manager = GroupManager()
        self.socketio = socketio
        self.downloads_in_progress = {}  # {task_id: {status, progress, ...}}
        logger.info("MediaDownloader inizializzato")
    
    async def download_media(self, user_phone, group_id, media_types=None, limit=100):
        """Scarica i media da un gruppo Telegram."""
        if media_types is None:
            media_types = ['photo', 'video']
        
        try:
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return False
            
            # Ottieni informazioni del gruppo
            group_info = await self.group_manager.get_group_info(user_phone, group_id)
            if not group_info:
                logger.error(f"Informazioni del gruppo {group_id} non trovate per {user_phone}")
                return False
            
            # Crea directory per i download del gruppo
            group_name = sanitize_filename(group_info['title'])
            group_dir_name = f"{group_name}-{group_id}"
            download_path = Path(os.getenv('BASE_DOWNLOAD_PATH')) / group_dir_name
            
            # Crea directory per i tipi di media
            media_paths = {}
            for media_type in ['immagini', 'video']:
                media_paths[media_type] = download_path / media_type
                ensure_directory(media_paths[media_type])
            
            # Crea file di log dei messaggi
            group_log_file = download_path / 'messages.txt'
            
            # Task ID per questo download
            task_id = f"download_{user_phone}_{group_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # Inizializza stato download
            self.downloads_in_progress[task_id] = {
                'user_phone': user_phone,
                'group_id': group_id,
                'group_name': group_info['title'],
                'start_time': datetime.now().isoformat(),
                'status': 'in_progress',
                'progress': 0,
                'total_media': 0,
                'downloaded_media': 0,
                'media_types': media_types
            }
            
            # Invia notifica tramite Socket.IO
            if self.socketio:
                self.socketio.emit('download_started', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'group_name': group_info['title'],
                    'timestamp': datetime.now().isoformat(),
                    'media_types': media_types
                })
            
            # Ottieni i messaggi dal gruppo
            messages = []
            logger.info(f"Scaricando messaggi dal gruppo {group_info['title']} per {user_phone}")
            
            async for message in client.iter_messages(group_id, limit=limit):
                messages.append(message)
            
            # Aggiorna stato download
            total_media = len([m for m in messages if m.media])
            self.downloads_in_progress[task_id]['total_media'] = total_media
            
            # Invia aggiornamento
            if self.socketio:
                self.socketio.emit('download_status', {
                    'task_id': task_id,
                    'status': 'downloading',
                    'progress': 0,
                    'total_media': total_media,
                    'downloaded_media': 0
                })
            
            # Salva log dei messaggi
            with open(group_log_file, 'w', encoding='utf-8') as f:
                for message in reversed(messages):
                    # Ottieni info mittente
                    sender = await message.get_sender()
                    sender_name = f"{sender.first_name} {sender.last_name if hasattr(sender, 'last_name') and sender.last_name else ''}"
                    
                    # Formatta timestamp
                    timestamp = message.date.strftime('%Y-%m-%d %H:%M:%S')
                    
                    # Scrivi messaggio nel log
                    f.write(f"[{timestamp}] [{sender_name}]: {message.text or '<media>'}\n")
            
            # Scarica media
            downloaded_count = 0
            
            for message in messages:
                if message.media:
                    # Determina il tipo di media
                    media_type = None
                    
                    if 'photo' in media_types and (isinstance(message.media, types.MessageMediaPhoto) or 
                                                   (hasattr(message.media, 'photo') and message.media.photo)):
                        media_type = 'immagini'
                    elif 'video' in media_types and (isinstance(message.media, types.MessageMediaDocument) and 
                                                    hasattr(message.media.document, 'mime_type') and 
                                                    'video' in message.media.document.mime_type):
                        media_type = 'video'
                    
                    if media_type:
                        # Crea percorso di salvataggio
                        save_path = media_paths[media_type]
                        timestamp = int(message.date.timestamp())
                        sender_id = message.from_id.user_id if hasattr(message.from_id, 'user_id') else 0
                        filename = f"{sender_id}_{timestamp}"
                        
                        # Scarica il media
                        try:
                            downloaded_path = await client.download_media(
                                message.media,
                                file=save_path / filename
                            )
                            
                            if downloaded_path:
                                downloaded_count += 1
                                
                                # Aggiorna stato download
                                progress = int((downloaded_count / total_media) * 100) if total_media > 0 else 0
                                self.downloads_in_progress[task_id]['progress'] = progress
                                self.downloads_in_progress[task_id]['downloaded_media'] = downloaded_count
                                
                                # Invia aggiornamento
                                if self.socketio:
                                    self.socketio.emit('download_progress', {
                                        'task_id': task_id,
                                        'progress': progress,
                                        'downloaded_media': downloaded_count,
                                        'total_media': total_media
                                    })
                                
                                logger.info(f"Scaricato media {downloaded_count}/{total_media} dal gruppo {group_info['title']}: {downloaded_path}")
                        
                        except Exception as e:
                            logger.error(f"Errore nel download del media: {e}")
            
            # Download completato
            self.downloads_in_progress[task_id]['status'] = 'completed'
            self.downloads_in_progress[task_id]['end_time'] = datetime.now().isoformat()
            self.downloads_in_progress[task_id]['progress'] = 100
            
            # Invia notifica di completamento
            if self.socketio:
                self.socketio.emit('download_completed', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'group_name': group_info['title'],
                    'downloaded_media': downloaded_count,
                    'total_media': total_media,
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"Download completato per il gruppo {group_info['title']} dell'utente {user_phone}. Media scaricati: {downloaded_count}/{total_media}")
            return True
        
        except Exception as e:
            # In caso di errore aggiorna lo stato
            if task_id in self.downloads_in_progress:
                self.downloads_in_progress[task_id]['status'] = 'error'
                self.downloads_in_progress[task_id]['error'] = str(e)
            
            # Invia notifica di errore
            if self.socketio:
                self.socketio.emit('download_error', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.error(f"Errore nel download dei media per il gruppo {group_id} dell'utente {user_phone}: {e}")
            return False
    
    def get_download_status(self, task_id):
        """Ottiene lo stato di un download."""
        return self.downloads_in_progress.get(task_id)
    
    def get_all_downloads(self):
        """Ottiene tutti i download in corso o completati."""
        return self.downloads_in_progress