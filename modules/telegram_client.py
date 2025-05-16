import os
import logging
import asyncio
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession
from pathlib import Path
from dotenv import load_dotenv
from modules.utils import setup_logger, save_to_json, load_from_json, ensure_directory

# Carica variabili d'ambiente
load_dotenv()

# Ottieni API ID e Hash da .env
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SESSIONS_PATH = os.getenv('SESSIONS_PATH')

# Configurazione logger
logger = setup_logger('telegram_client', os.path.join(os.getenv('LOGS_PATH'), 'telegram_client.log'))

class TelegramClientManager:
    """Gestisce le sessioni Telegram per gli utenti."""
    
    def __init__(self):
        self.clients = {}  # {phone: TelegramClient}
        self.sessions_dir = Path(SESSIONS_PATH)
        ensure_directory(self.sessions_dir)
        logger.info("TelegramClientManager inizializzato")
    
    async def create_client(self, phone):
        """Crea e configura un client Telegram per il numero di telefono specificato."""
        try:
            logger.info(f"Creazione client Telegram per {phone}")
            
            # Carica sessione esistente se disponibile
            session_file = self.sessions_dir / f"{phone}.session"
            string_session = None
            
            if session_file.exists():
                with open(session_file, 'r') as f:
                    string_session = f.read().strip()
                    logger.info(f"Sessione esistente caricata per {phone}")
            
            # Crea il client
            client = TelegramClient(
                StringSession(string_session) if string_session else StringSession(),
                API_ID, 
                API_HASH,
                device_model="Telegram Web Manager",
                system_version="1.0",
                app_version="1.0",
                lang_code="it"
            )
            
            # Connetti il client
            await client.connect()
            
            # Se non è già autenticato, avvia processo di login
            if not await client.is_user_authorized():
                logger.info(f"Utente {phone} non autenticato. Avvio processo di autenticazione.")
                return {
                    'success': False,
                    'status': 'authentication_required',
                    'client': client,
                    'phone': phone
                }
            
            # Salva il client
            self.clients[phone] = client
            logger.info(f"Client Telegram creato con successo per {phone}")
            
            # Salva la sessione
            await self.save_session(phone, client)
            
            return {
                'success': True,
                'status': 'authenticated',
                'client': client,
                'phone': phone
            }
        
        except Exception as e:
            logger.error(f"Errore nella creazione del client Telegram per {phone}: {e}")
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    async def authenticate_client(self, phone, code=None, password=None):
        """Autentica un client Telegram con codice o password."""
        try:
            # Ottieni client esistente o creane uno nuovo
            client_info = self.clients.get(phone)
            
            if not client_info:
                client_info = await self.create_client(phone)
                if not client_info['success'] and client_info['status'] != 'authentication_required':
                    return client_info
                client = client_info['client']
            else:
                client = client_info
            
            # Invia codice se non è stato fornito
            if not code:
                await client.send_code_request(phone)
                logger.info(f"Codice di autenticazione richiesto per {phone}")
                return {
                    'success': True,
                    'status': 'code_sent',
                    'phone': phone
                }
            
            # Tenta il login con il codice fornito
            try:
                await client.sign_in(phone, code)
                
                # Se l'autenticazione è andata a buon fine, salva il client
                self.clients[phone] = client
                logger.info(f"Autenticazione completata con successo per {phone}")
                
                # Salva la sessione
                await self.save_session(phone, client)
                
                return {
                    'success': True,
                    'status': 'authenticated',
                    'phone': phone
                }
            
            except SessionPasswordNeededError:
                if not password:
                    logger.info(f"Password 2FA richiesta per {phone}")
                    return {
                        'success': False,
                        'status': 'password_required',
                        'phone': phone
                    }
                
                # Tenta il login con la password
                await client.sign_in(password=password)
                
                # Se l'autenticazione è andata a buon fine, salva il client
                self.clients[phone] = client
                logger.info(f"Autenticazione 2FA completata con successo per {phone}")
                
                # Salva la sessione
                await self.save_session(phone, client)
                
                return {
                    'success': True,
                    'status': 'authenticated',
                    'phone': phone
                }
            
        except Exception as e:
            logger.error(f"Errore nell'autenticazione del client Telegram per {phone}: {e}")
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    async def save_session(self, phone, client):
        """Salva la sessione di un client Telegram su file."""
        try:
            # Ottieni stringa di sessione
            string_session = client.session.save()
            
            # Salva su file
            session_file = self.sessions_dir / f"{phone}.session"
            with open(session_file, 'w') as f:
                f.write(string_session)
            
            # Salva anche dati utente
            me = await client.get_me()
            user_data = {
                'id': me.id,
                'first_name': me.first_name,
                'last_name': me.last_name,
                'username': me.username,
                'phone': phone,
                'session_created': str(session_file.stat().st_ctime)
            }
            
            user_file = self.sessions_dir / f"{phone}.json"
            save_to_json(user_data, user_file)
            
            logger.info(f"Sessione salvata con successo per {phone}")
            return True
        
        except Exception as e:
            logger.error(f"Errore nel salvataggio della sessione per {phone}: {e}")
            return False
    
    async def disconnect_client(self, phone):
        """Disconnette un client Telegram."""
        try:
            if phone in self.clients:
                await self.clients[phone].disconnect()
                del self.clients[phone]
                logger.info(f"Client Telegram disconnesso per {phone}")
                return True
            return False
        except Exception as e:
            logger.error(f"Errore nella disconnessione del client per {phone}: {e}")
            return False
    
    async def get_client(self, phone):
        """Ottiene un client Telegram per il numero specificato."""
        # Se il client esiste già, restituiscilo
        if phone in self.clients:
            return self.clients[phone]
        
        # Altrimenti tenta di crearlo
        client_info = await self.create_client(phone)
        if client_info['success']:
            return client_info['client']
        
        return None
    
    def get_all_sessions(self):
        """Ottiene tutti i file di sessione salvati."""
        sessions = []
        for session_file in self.sessions_dir.glob('*.json'):
            phone = session_file.stem
            user_data = load_from_json(session_file)
            if user_data:
                sessions.append(user_data)
        
        return sessions