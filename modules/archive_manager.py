import os
import logging
import asyncio
import shutil
from datetime import datetime
from pathlib import Path
from telethon import types
from dotenv import load_dotenv
from modules.telegram_client import TelegramClientManager
from modules.group_manager import GroupManager
from modules.utils import setup_logger, ensure_directory, sanitize_filename

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logger
logger = setup_logger('archive_manager', os.path.join(os.getenv('LOGS_PATH'), 'archive_manager.log'))

class ArchiveManager:
    """Gestisce l'archivio storico dei media dei gruppi Telegram."""
    
    def __init__(self, socketio=None):
        self.telegram_manager = TelegramClientManager()
        self.group_manager = GroupManager()
        self.socketio = socketio
        self.archives_in_progress = {}  # {task_id: {status, progress, ...}}
        logger.info("ArchiveManager inizializzato")
    
    async def create_archive(self, user_phone, group_id, media_types=None, limit=None):
        """Crea un archivio storico dei media di un gruppo Telegram."""
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
            
            # Crea directory per l'archivio del gruppo
            group_name = sanitize_filename(group_info['title'])
            group_dir_name = f"{group_name}-{group_id}"
            archive_path = Path(os.getenv('BASE_ARCHIVE_PATH')) / group_dir_name
            
            # Crea directory per i tipi di media
            media_paths = {}
            for media_type in ['immagini', 'video']:
                media_paths[media_type] = archive_path / media_type
                ensure_directory(media_paths[media_type])
            
            # Crea file di log dei messaggi
            archive_log_file = archive_path / 'messages.txt'
            
            # Task ID per questo download
            task_id = f"archive_{user_phone}_{group_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            # Inizializza stato archivio
            self.archives_in_progress[task_id] = {
                'user_phone': user_phone,
                'group_id': group_id,
                'group_name': group_info['title'],
                'start_time': datetime.now().isoformat(),
                'status': 'in_progress',
                'progress': 0,
                'total_media': 0,
                'archived_media': 0,
                'media_types': media_types
            }
            
            # Invia notifica tramite Socket.IO
            if self.socketio:
                self.socketio.emit('archive_started', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'group_name': group_info['title'],
                    'timestamp': datetime.now().isoformat(),
                    'media_types': media_types
                })
            
            # Ottieni il numero totale di messaggi
            total_messages = 0
            
            if limit is None:
                # Conta il numero totale di messaggi (può richiedere tempo)
                total_messages_gen = client.iter_messages(group_id, limit=1)
                async for _ in total_messages_gen:
                    total_messages += 1
                
                # Se non ci sono messaggi, usa un limite ragionevole
                if total_messages == 0:
                    total_messages = 1000
            else:
                total_messages = limit
            
            # Ottieni i messaggi dal gruppo
            messages = []
            logger.info(f"Scaricando tutti i messaggi dal gruppo {group_info['title']} per {user_phone}")
            
            # Aggiorna stato con il numero totale di messaggi da elaborare
            self.archives_in_progress[task_id]['total_messages'] = total_messages
            
            # Invia aggiornamento
            if self.socketio:
                self.socketio.emit('archive_status', {
                    'task_id': task_id,
                    'status': 'scanning',
                    'progress': 0,
                    'total_messages': total_messages,
                    'processed_messages': 0
                })
            
            # Scarica tutti i messaggi con progressi periodici
            processed_messages = 0
            async for message in client.iter_messages(group_id, limit=limit):
                messages.append(message)
                processed_messages += 1
                
                # Aggiorna stato ogni 100 messaggi
                if processed_messages % 100 == 0:
                    progress = int((processed_messages / total_messages) * 50) if total_messages > 0 else 0
                    self.archives_in_progress[task_id]['progress'] = progress
                    self.archives_in_progress[task_id]['processed_messages'] = processed_messages
                    
                    # Invia aggiornamento
                    if self.socketio:
                        self.socketio.emit('archive_scanning', {
                            'task_id': task_id,
                            'progress': progress,
                            'processed_messages': processed_messages,
                            'total_messages': total_messages
                        })
            
            # Aggiorna stato archivio
            total_media = len([m for m in messages if m.media])
            self.archives_in_progress[task_id]['total_media'] = total_media
            self.archives_in_progress[task_id]['progress'] = 50  # 50% del lavoro fatto
            
            # Invia aggiornamento
            if self.socketio:
                self.socketio.emit('archive_status', {
                    'task_id': task_id,
                    'status': 'downloading',
                    'progress': 50,
                    'total_media': total_media,
                    'archived_media': 0
                })
            
            # Salva log dei messaggi
            with open(archive_log_file, 'w', encoding='utf-8') as f:
                for message in reversed(messages):
                    # Ottieni info mittente
                    sender = await message.get_sender()
                    sender_name = f"{sender.first_name} {sender.last_name if hasattr(sender, 'last_name') and sender.last_name else ''}"
                    
                    # Formatta timestamp
                    timestamp = message.date.strftime('%Y-%m-%d %H:%M:%S')
                    
                    # Scrivi messaggio nel log
                    f.write(f"[{timestamp}] [{sender_name}]: {message.text or '<media>'}\n")
            
            # Scarica media
            archived_count = 0
            
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
                                archived_count += 1
                                
                                # Aggiorna stato archivio
                                progress = 50 + int((archived_count / total_media) * 50) if total_media > 0 else 100
                                self.archives_in_progress[task_id]['progress'] = progress
                                self.archives_in_progress[task_id]['archived_media'] = archived_count
                                
                                # Invia aggiornamento
                                if self.socketio and archived_count % 10 == 0:  # Aggiorna ogni 10 media
                                    self.socketio.emit('archive_progress', {
                                        'task_id': task_id,
                                        'progress': progress,
                                        'archived_media': archived_count,
                                        'total_media': total_media
                                    })
                                
                                logger.info(f"Archiviato media {archived_count}/{total_media} dal gruppo {group_info['title']}: {downloaded_path}")
                        
                        except Exception as e:
                            logger.error(f"Errore nell'archiviazione del media: {e}")
            
            # Archivio completato
            self.archives_in_progress[task_id]['status'] = 'completed'
            self.archives_in_progress[task_id]['end_time'] = datetime.now().isoformat()
            self.archives_in_progress[task_id]['progress'] = 100
            
            # Invia notifica di completamento
            if self.socketio:
                self.socketio.emit('archive_completed', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'group_name': group_info['title'],
                    'archived_media': archived_count,
                    'total_media': total_media,
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"Archivio completato per il gruppo {group_info['title']} dell'utente {user_phone}. Media archiviati: {archived_count}/{total_media}")
            return True
        
        except Exception as e:
            # In caso di errore aggiorna lo stato
            if task_id in self.archives_in_progress:
                self.archives_in_progress[task_id]['status'] = 'error'
                self.archives_in_progress[task_id]['error'] = str(e)
            
            # Invia notifica di errore
            if self.socketio:
                self.socketio.emit('archive_error', {
                    'task_id': task_id,
                    'user_phone': user_phone,
                    'group_id': group_id,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.error(f"Errore nella creazione dell'archivio per il gruppo {group_id} dell'utente {user_phone}: {e}")
            return False
    
    async def get_archive_info(self, group_dir_name):
        """Ottiene informazioni su un archivio esistente."""
        try:
            archive_path = Path(os.getenv('BASE_ARCHIVE_PATH')) / group_dir_name
            
            if not archive_path.exists():
                return None
            
            # Conta i file nei vari percorsi
            images_count = len(list((archive_path / 'immagini').glob('*'))) if (archive_path / 'immagini').exists() else 0
            videos_count = len(list((archive_path / 'video').glob('*'))) if (archive_path / 'video').exists() else 0
            
            # Ottieni data di creazione dell'archivio
            creation_time = archive_path.stat().st_ctime
            creation_date = datetime.fromtimestamp(creation_time).isoformat()
            
            # Ottieni dimensione totale
            total_size = sum(f.stat().st_size for f in archive_path.glob('**/*') if f.is_file())
            
            return {
                'group_dir_name': group_dir_name,
                'images_count': images_count,
                'videos_count': videos_count,
                'total_media': images_count + videos_count,
                'creation_date': creation_date,
                'total_size': total_size,
                'path': str(archive_path)
            }
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento delle informazioni dell'archivio {group_dir_name}: {e}")
            return None
    
    async def get_all_archives(self):
        """Ottiene tutti gli archivi disponibili."""
        try:
            archives = []
            archive_base_path = Path(os.getenv('BASE_ARCHIVE_PATH'))
            
            if not archive_base_path.exists():
                return []
            
            # Ottieni tutte le directory nel percorso di base
            for archive_dir in archive_base_path.iterdir():
                if archive_dir.is_dir():
                    archive_info = await self.get_archive_info(archive_dir.name)
                    if archive_info:
                        archives.append(archive_info)
            
            return archives
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento degli archivi: {e}")
            return []
    
    async def delete_archive(self, group_dir_name):
        """Elimina un archivio esistente."""
        try:
            archive_path = Path(os.getenv('BASE_ARCHIVE_PATH')) / group_dir_name
            
            if not archive_path.exists():
                return False
            
            # Elimina la directory e tutto il suo contenuto
            shutil.rmtree(archive_path)
            
            logger.info(f"Archivio {group_dir_name} eliminato con successo")
            return True
        
        except Exception as e:
            logger.error(f"Errore nell'eliminazione dell'archivio {group_dir_name}: {e}")
            return False
    
    def get_archive_status(self, task_id):
        """Ottiene lo stato di un archivio in corso."""
        return self.archives_in_progress.get(task_id)
    
    def get_all_archive_operations(self):
        """Ottiene tutte le operazioni di archiviazione in corso o completate."""
        return self.archives_in_progress