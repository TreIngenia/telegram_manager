import os
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from modules.telegram_client import TelegramClientManager
from modules.utils import setup_logger, save_to_json, load_from_json, ensure_directory

# Carica variabili d'ambiente
load_dotenv()

# Configurazione logger
logger = setup_logger('user_manager', os.path.join(os.getenv('LOGS_PATH'), 'user_manager.log'))

class UserManager:
    """Gestisce gli utenti Telegram e le loro sessioni."""
    
    def __init__(self):
        self.telegram_manager = TelegramClientManager()
        self.sessions_dir = Path(os.getenv('SESSIONS_PATH'))
        self.users_file = self.sessions_dir / 'users.json'
        self.users = load_from_json(self.users_file, default=[])
        logger.info("UserManager inizializzato")
    
    async def add_user(self, phone):
        """Aggiunge un nuovo utente Telegram."""
        try:
            # Verifica se l'utente esiste già
            for user in self.users:
                if user.get('phone') == phone:
                    logger.info(f"Utente {phone} già esistente")
                    return {
                        'success': False,
                        'status': 'user_exists',
                        'message': f"L'utente {phone} esiste già",
                        'phone': phone
                    }
            
            # Crea un nuovo client Telegram per l'utente
            client_info = await self.telegram_manager.create_client(phone)
            
            # Se l'utente richiede autenticazione, restituisci stato
            if not client_info['success'] and client_info['status'] == 'authentication_required':
                # Invia codice di verifica
                auth_info = await self.telegram_manager.authenticate_client(phone)
                
                # Aggiungi log di debug
                logger.info(f"Risultato auth_info per {phone}: {auth_info}")
                
                # Assicurati che lo 'status' e 'phone' siano nella risposta
                if 'status' not in auth_info:
                    auth_info['status'] = 'error' if not auth_info.get('success') else 'success'
                if 'phone' not in auth_info:
                    auth_info['phone'] = phone
                    
                return auth_info
        
        except Exception as e:
            logger.error(f"Errore nell'aggiunta dell'utente {phone}: {e}")
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    async def authenticate_user(self, phone, code=None, password=None, phone_code_hash=None):
        """Autentica un utente Telegram con codice o password."""
        try:
            # Tenta l'autenticazione
            auth_info = await self.telegram_manager.authenticate_client(phone, code, password, phone_code_hash)
            
            # Se l'autenticazione è andata a buon fine, aggiorna l'utente
            if auth_info['success'] and auth_info['status'] == 'authenticated':
                # Ottieni client
                client = await self.telegram_manager.get_client(phone)
                
                # Ottieni informazioni utente
                me = await client.get_me()
                
                # Crea directory per i media dell'utente
                user_media_dir = Path(os.getenv('BASE_MEDIA_PATH')) / phone / 'privata'
                ensure_directory(user_media_dir / 'immagini')
                ensure_directory(user_media_dir / 'video')
                
                # Aggiorna o aggiungi utente
                user_data = {
                    'id': me.id,
                    'first_name': me.first_name,
                    'last_name': me.last_name,
                    'username': me.username,
                    'phone': phone,
                    'status': 'active'
                }
                
                # Cerca utente esistente
                found = False
                for i, user in enumerate(self.users):
                    if user.get('phone') == phone:
                        self.users[i] = user_data
                        found = True
                        break
                
                # Se non trovato, aggiungi
                if not found:
                    self.users.append(user_data)
                
                # Salva lista utenti
                save_to_json(self.users, self.users_file)
                
                logger.info(f"Utente {phone} autenticato con successo")
                return {
                    'success': True,
                    'status': 'authenticated',
                    'user': user_data,
                    'phone': phone
                }
            
            # Altrimenti restituisci il risultato dell'autenticazione
            return auth_info
        
        except Exception as e:
            logger.error(f"Errore nell'autenticazione dell'utente {phone}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    def remove_user(self, phone):
        """Rimuove un utente Telegram."""
        try:
            # Cerca l'utente
            found = False
            for i, user in enumerate(self.users):
                if user.get('phone') == phone:
                    self.users.pop(i)
                    found = True
                    break
            
            if not found:
                logger.warning(f"Utente {phone} non trovato per la rimozione")
                return {
                    'success': False,
                    'status': 'user_not_found',
                    'message': f"Utente {phone} non trovato",
                    'phone': phone
                }
            
            # Salva lista utenti
            save_to_json(self.users, self.users_file)
            
            # Disconnetti client
            asyncio.run(self.telegram_manager.disconnect_client(phone))
            
            # Rimuovi file di sessione
            session_file = self.sessions_dir / f"{phone}.session"
            user_file = self.sessions_dir / f"{phone}.json"
            
            if session_file.exists():
                session_file.unlink()
            
            if user_file.exists():
                user_file.unlink()
            
            logger.info(f"Utente {phone} rimosso con successo")
            return {
                'success': True,
                'status': 'user_removed',
                'message': f"Utente {phone} rimosso con successo",
                'phone': phone
            }
        
        except Exception as e:
            logger.error(f"Errore nella rimozione dell'utente {phone}: {e}")
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    def get_all_users(self):
        """Ottiene tutti gli utenti registrati."""
        return self.users
    
    def get_user(self, phone):
        """Ottiene un utente specifico."""
        for user in self.users:
            if user.get('phone') == phone:
                return user
        return None
    
    def get_user_status(self, phone):
        """Ottiene lo stato di un utente."""
        user = self.get_user(phone)
        if user:
            # Verifica se il client è connesso
            is_connected = phone in self.telegram_manager.clients
            user['connected'] = is_connected
            return user
        return None
    
    def restore_all_sessions(self):
        """Ripristina tutte le sessioni salvate."""
        # Ottieni tutte le sessioni
        sessions = self.telegram_manager.get_all_sessions()
        
        # Ripristina ogni sessione
        for session in sessions:
            phone = session.get('phone')
            if phone:
                # Avvia sessione in modo asincrono
                asyncio.create_task(self.telegram_manager.create_client(phone))
                logger.info(f"Sessione ripristinata per {phone}")
        
        return True
    
    async def get_user_auth_status(self, phone):
        """Ottiene lo stato di autenticazione di un utente."""
        try:
            # Controlla se l'utente esiste già nella lista
            for user in self.users:
                if user.get('phone') == phone:
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'phone': phone
                    }
            
            # Ottieni client Telegram
            client = await self.telegram_manager.get_client(phone)
            
            if client is None:
                # Nessun client, probabile che sia necessario il codice
                return {
                    'success': False,
                    'status': 'code_sent',
                    'phone': phone
                }
            
            # Controlla se il client è autorizzato
            is_authorized = await client.is_user_authorized()
            
            if is_authorized:
                return {
                    'success': True,
                    'status': 'authenticated',
                    'phone': phone
                }
            else:
                # Client esiste ma non autorizzato
                return {
                    'success': False,
                    'status': 'code_sent',
                    'phone': phone
                }
        except Exception as e:
            logger.error(f"Errore nel controllo dello stato di {phone}: {e}")
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }