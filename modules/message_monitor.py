import os
import logging
import asyncio
import json
import time
from pathlib import Path
from datetime import datetime
from telethon import events
from dotenv import load_dotenv
from modules.telegram_client import TelegramClientManager
from modules.group_manager import GroupManager
from modules.utils import setup_logger, ensure_directory, sanitize_filename, get_media_type

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logger
logger = setup_logger('message_monitor', os.path.join(os.getenv('LOGS_PATH'), 'message_monitor.log'))

class MessageMonitor:
    """Monitora i messaggi in tempo reale dai gruppi Telegram."""
    
    def __init__(self, socketio=None):
        self.telegram_manager = TelegramClientManager()
        self.group_manager = GroupManager()
        self.socketio = socketio
        self.active_monitors = {}  # {user_phone: [group_id]}
        self.event_handlers = {}   # {user_phone: [handler_id]}
        logger.info("MessageMonitor inizializzato")
    
    async def start_monitoring(self, user_phone, group_ids):
        """Avvia il monitoraggio dei messaggi per i gruppi specificati."""
        try:
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return False
            
            # Crea directory per i media privati dell'utente
            user_media_dir = Path(os.getenv('BASE_MEDIA_PATH')) / user_phone / 'privata'
            ensure_directory(user_media_dir / 'immagini')
            ensure_directory(user_media_dir / 'video')
            
            # Crea file di log dei messaggi
            messages_log_file = Path(os.getenv('LOGS_PATH')) / f"messages_{user_phone}.txt"
            
            # Registra handler per i messaggi
            @client.on(events.NewMessage())
            async def new_message_handler(event):
                try:
                    # Ottieni il messaggio
                    message = event.message
                    chat_id = event.chat_id
                    
                    # Verifica se il messaggio proviene da uno dei gruppi monitorati
                    if chat_id not in group_ids and chat_id > 0:  # chat_id > 0 indica chat private
                        # Salva messaggi privati
                        await self._handle_private_message(user_phone, event)
                    elif chat_id in group_ids:
                        # Salva messaggi dai gruppi monitorati
                        await self._handle_group_message(user_phone, event)
                
                except Exception as e:
                    logger.error(f"Errore nella gestione del messaggio: {e}")
            
            # Salva l'handler per poterlo rimuovere in seguito
            if user_phone not in self.event_handlers:
                self.event_handlers[user_phone] = []
            self.event_handlers[user_phone].append(new_message_handler)
            
            # Aggiorna stato monitoraggio
            self.active_monitors[user_phone] = group_ids
            
            # Invia notifica tramite Socket.IO
            if self.socketio:
                self.socketio.emit('monitor_started', {
                    'user_phone': user_phone,
                    'group_ids': group_ids,
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"Monitoraggio avviato per l'utente {user_phone} sui gruppi {group_ids}")
            return True
        
        except Exception as e:
            logger.error(f"Errore nell'avvio del monitoraggio per {user_phone}: {e}")
            return False
    
    def stop_monitoring(self, user_phone):
        """Ferma il monitoraggio dei messaggi per l'utente specificato."""
        try:
            # Rimuovi gli handler
            if user_phone in self.event_handlers:
                for handler in self.event_handlers[user_phone]:
                    client = asyncio.run(self.telegram_manager.get_client(user_phone))
                    if client:
                        client.remove_event_handler(handler)
                
                del self.event_handlers[user_phone]
            
            # Aggiorna stato monitoraggio
            if user_phone in self.active_monitors:
                del self.active_monitors[user_phone]
            
            # Invia notifica tramite Socket.IO
            if self.socketio:
                self.socketio.emit('monitor_stopped', {
                    'user_phone': user_phone,
                    'timestamp': datetime.now().isoformat()
                })
            
            logger.info(f"Monitoraggio fermato per l'utente {user_phone}")
            return True
        
        except Exception as e:
            logger.error(f"Errore nell'arresto del monitoraggio per {user_phone}: {e}")
            return False
    
    async def _handle_private_message(self, user_phone, event):
        """Gestisce un messaggio privato ricevuto."""
        try:
            message = event.message
            sender = await event.get_sender()
            
            # Crea directory per i media privati dell'utente
            user_media_dir = Path(os.getenv('BASE_MEDIA_PATH')) / user_phone / 'privata'
            
            # Salva messaggio nel log
            messages_log_file = Path(os.getenv('LOGS_PATH')) / f"messages_{user_phone}.txt"
            with open(messages_log_file, 'a', encoding='utf-8') as f:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                sender_name = f"{sender.first_name} {sender.last_name if sender.last_name else ''}"
                f.write(f"[{timestamp}] [Privato] [{sender_name}]: {message.text or '<media>'}\n")
            
            # Controlla se il messaggio contiene media con timer
            if message.media and hasattr(message.media, 'ttl_seconds') and message.media.ttl_seconds:
                # Se il messaggio si autodistruggerà, salvalo
                client = await self.telegram_manager.get_client(user_phone)
                
                if not client:
                    logger.error(f"Client non trovato per {user_phone}")
                    return
                
                # Determina il tipo di media e la directory di destinazione
                media_type = None
                if hasattr(message.media, 'photo'):
                    media_type = 'immagini'
                elif hasattr(message.media, 'video'):
                    media_type = 'video'
                
                if media_type:
                    # Crea percorso di salvataggio
                    save_path = user_media_dir / media_type
                    timestamp = int(time.time())
                    sender_id = sender.id
                    filename = f"{sender_id}_{timestamp}"
                    
                    # Scarica il media
                    downloaded_path = await client.download_media(
                        message.media,
                        file=save_path / filename
                    )
                    
                    logger.info(f"Salvato media a tempo da {sender_name} per {user_phone}: {downloaded_path}")
                    
                    # Invia notifica tramite Socket.IO
                    if self.socketio:
                        self.socketio.emit('private_media_saved', {
                            'user_phone': user_phone,
                            'sender': sender_name,
                            'media_type': media_type,
                            'ttl_seconds': message.media.ttl_seconds,
                            'path': str(downloaded_path),
                            'timestamp': datetime.now().isoformat()
                        })
            
            logger.info(f"Gestito messaggio privato da {sender.id} per {user_phone}")
        
        except Exception as e:
            logger.error(f"Errore nella gestione del messaggio privato: {e}")
    
    async def _handle_group_message(self, user_phone, event):
        """Gestisce un messaggio di gruppo ricevuto."""
        try:
            message = event.message
            chat_id = event.chat_id
            sender = await event.get_sender()
            chat = await event.get_chat()
            
            # Ottieni informazioni del gruppo
            group_info = await self.group_manager.get_group_info(user_phone, chat_id)
            if not group_info:
                logger.error(f"Informazioni del gruppo {chat_id} non trovate per {user_phone}")
                return
            
            # Crea nome directory sicuro
            group_name = sanitize_filename(group_info['title'])
            group_dir_name = f"{group_name}-{chat_id}"
            
            # Crea directory per i download del gruppo
            download_path = Path(os.getenv('BASE_DOWNLOAD_PATH')) / group_dir_name
            ensure_directory(download_path / 'video')
            ensure_directory(download_path / 'immagini')
            
            # Salva messaggio nel log del gruppo
            group_log_file = download_path / 'messages.txt'
            with open(group_log_file, 'a', encoding='utf-8') as f:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                sender_name = f"{sender.first_name} {sender.last_name if hasattr(sender, 'last_name') and sender.last_name else ''}"
                f.write(f"[{timestamp}] [{sender_name}]: {message.text or '<media>'}\n")
            
            # Controlla se il messaggio contiene media
            if message.media:
                # Scarica il media
                client = await self.telegram_manager.get_client(user_phone)
                
                if not client:
                    logger.error(f"Client non trovato per {user_phone}")
                    return
                
                # Determina il tipo di media e la directory di destinazione
                media_type = None
                if hasattr(message.media, 'photo'):
                    media_type = 'immagini'
                elif hasattr(message.media, 'document'):
                    # Controlla se è un video
                    if hasattr(message.media.document, 'mime_type') and 'video' in message.media.document.mime_type:
                        media_type = 'video'
                    else:
                        # Altri tipi di documenti vengono salvati nella cartella delle immagini
                        media_type = 'immagini'
                
                if media_type:
                    # Crea percorso di salvataggio
                    save_path = download_path / media_type
                    timestamp = int(time.time())
                    sender_id = sender.id
                    filename = f"{sender_id}_{timestamp}"
                    
                    # Scarica il media
                    downloaded_path = await client.download_media(
                        message.media,
                        file=save_path / filename
                    )
                    
                    logger.info(f"Salvato media dal gruppo {group_info['title']} per {user_phone}: {downloaded_path}")
                    
                    # Invia notifica tramite Socket.IO
                    if self.socketio:
                        self.socketio.emit('group_media_saved', {
                            'user_phone': user_phone,
                            'group_id': chat_id,
                            'group_name': group_info['title'],
                            'sender': sender_name,
                            'media_type': media_type,
                            'path': str(downloaded_path),
                            'timestamp': datetime.now().isoformat()
                        })
            
            logger.info(f"Gestito messaggio dal gruppo {group_info['title']} per {user_phone}")
        
        except Exception as e:
            logger.error(f"Errore nella gestione del messaggio di gruppo: {e}")
    
    def get_active_monitors(self):
        """Ottiene i monitoraggi attivi."""
        return self.active_monitors