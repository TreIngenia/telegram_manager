import os
import logging
import asyncio
from telethon import functions
from pathlib import Path
from dotenv import load_dotenv
from modules.telegram_client import TelegramClientManager
from modules.utils import setup_logger, save_to_json, load_from_json, ensure_directory, sanitize_filename

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logger
logger = setup_logger('group_manager', os.path.join(os.getenv('LOGS_PATH'), 'group_manager.log'))

class GroupManager:
    """Gestisce i gruppi Telegram degli utenti."""
    
    def __init__(self):
        self.telegram_manager = TelegramClientManager()
        self.groups_cache = {}  # {user_phone: {group_id: group_data}}
        logger.info("GroupManager inizializzato")
    
    async def get_user_groups(self, user_phone):
        """Ottiene tutti i gruppi di un utente."""
        try:
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return []
            
            # Ottieni dialoghi (chats e gruppi)
            dialogs = await client.get_dialogs()
            
            # Filtra solo i gruppi e i supergroup
            groups = []
            for dialog in dialogs:
                if dialog.is_group or dialog.is_channel:
                    # Ottieni informazioni del gruppo
                    group_data = {
                        'id': dialog.id,
                        'title': dialog.title,
                        'entity_type': 'channel' if dialog.is_channel else 'group',
                        'members_count': getattr(dialog.entity, 'participants_count', 0),
                        'unread_count': dialog.unread_count,
                        'last_message_date': str(dialog.date) if dialog.date else None
                    }
                    
                    # Aggiungi alla lista
                    groups.append(group_data)
            
            # Cache dei gruppi
            self.groups_cache[user_phone] = {group['id']: group for group in groups}
            
            logger.info(f"Ottenuti {len(groups)} gruppi per l'utente {user_phone}")
            return groups
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento dei gruppi per {user_phone}: {e}")
            return []
    
    async def get_group_info(self, user_phone, group_id):
        """Ottiene informazioni dettagliate su un gruppo."""
        try:
            # Controlla se abbiamo già la cache
            if user_phone in self.groups_cache and group_id in self.groups_cache[user_phone]:
                return self.groups_cache[user_phone][group_id]
            
            # Altrimenti ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return None
            
            # Ottieni entità del gruppo
            entity = await client.get_entity(group_id)
            
            # Ottieni informazioni del gruppo
            group_data = {
                'id': entity.id,
                'title': entity.title,
                'entity_type': 'channel' if hasattr(entity, 'broadcast') else 'group',
                'members_count': getattr(entity, 'participants_count', 0) if hasattr(entity, 'participants_count') else 0,
                'username': entity.username if hasattr(entity, 'username') else None,
                'date': str(entity.date) if hasattr(entity, 'date') else None,
                'description': entity.about if hasattr(entity, 'about') else None
            }
            
            # Aggiorna cache
            if user_phone not in self.groups_cache:
                self.groups_cache[user_phone] = {}
            self.groups_cache[user_phone][group_id] = group_data
            
            logger.info(f"Ottenute informazioni per il gruppo {group_id} ({group_data['title']}) dell'utente {user_phone}")
            return group_data
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento delle informazioni del gruppo {group_id} per {user_phone}: {e}")
            return None
    
    async def get_invite_link(self, user_phone, group_id):
        """Ottiene il link di invito di un gruppo."""
        try:
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return None
            
            # Ottieni entità del gruppo
            entity = await client.get_entity(group_id)
            
            # Ottieni o crea link di invito
            result = await client(functions.messages.ExportChatInviteRequest(
                peer=entity
            ))
            
            logger.info(f"Ottenuto link di invito per il gruppo {group_id} dell'utente {user_phone}")
            return result.link
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento del link di invito per il gruppo {group_id} dell'utente {user_phone}: {e}")
            return None
    
    async def get_group_members(self, user_phone, group_id):
        """Ottiene i membri di un gruppo."""
        try:
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(user_phone)
            if not client:
                logger.error(f"Client non trovato per {user_phone}")
                return []
            
            # Ottieni entità del gruppo
            entity = await client.get_entity(group_id)
            
            # Ottieni i membri
            members = await client.get_participants(entity)
            
            # Formatta i dati
            members_data = []
            for member in members:
                member_data = {
                    'id': member.id,
                    'first_name': member.first_name,
                    'last_name': member.last_name,
                    'username': member.username,
                    'phone': member.phone,
                    'is_bot': member.bot,
                    'is_verified': member.verified,
                    'is_restricted': member.restricted,
                    'is_deleted': member.deleted,
                    'is_scam': member.scam
                }
                members_data.append(member_data)
            
            logger.info(f"Ottenuti {len(members_data)} membri per il gruppo {group_id} dell'utente {user_phone}")
            return members_data
        
        except Exception as e:
            logger.error(f"Errore nell'ottenimento dei membri del gruppo {group_id} per {user_phone}: {e}")
            return []
    
    async def create_group_directories(self, user_phone, group_id):
        """Crea le directory necessarie per un gruppo."""
        try:
            # Ottieni informazioni del gruppo
            group_info = await self.get_group_info(user_phone, group_id)
            if not group_info:
                logger.error(f"Informazioni del gruppo {group_id} non trovate per {user_phone}")
                return False
            
            # Crea nome directory sicuro
            group_name = sanitize_filename(group_info['title'])
            group_dir_name = f"{group_name}-{group_id}"
            
            # Crea directory per download
            download_path = Path(os.getenv('BASE_DOWNLOAD_PATH')) / group_dir_name
            ensure_directory(download_path / 'video')
            ensure_directory(download_path / 'immagini')
            
            # Crea directory per archivio
            archive_path = Path(os.getenv('BASE_ARCHIVE_PATH')) / group_dir_name
            ensure_directory(archive_path / 'video')
            ensure_directory(archive_path / 'immagini')
            
            logger.info(f"Directory create per il gruppo {group_id} ({group_info['title']}) dell'utente {user_phone}")
            return {
                'group_id': group_id,
                'group_name': group_info['title'],
                'group_dir_name': group_dir_name,
                'download_path': str(download_path),
                'archive_path': str(archive_path)
            }
        
        except Exception as e:
            logger.error(f"Errore nella creazione delle directory per il gruppo {group_id} dell'utente {user_phone}: {e}")
            return False