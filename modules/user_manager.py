import os
import logging
import asyncio
import random
import time
from pathlib import Path
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError, FloodWaitError
from telethon.sessions import StringSession
from dotenv import load_dotenv
from .utils import setup_logger, save_to_json, load_from_json, ensure_directory

# Carica variabili d'ambiente
load_dotenv()

# Ottieni API ID e Hash da .env
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SESSIONS_PATH = os.getenv('SESSIONS_PATH')

# Configurazione logger
logger = setup_logger('user_manager', os.path.join(os.getenv('LOGS_PATH'), 'user_manager.log'))

class UserManager:
    """Gestisce gli utenti Telegram e le loro sessioni."""
    
    def __init__(self):
        self.sessions_dir = Path(SESSIONS_PATH)
        ensure_directory(self.sessions_dir)
        self.users_file = self.sessions_dir / 'users.json'
        self.users = load_from_json(self.users_file, default=[])
        self.phone_code_hashes = {}  # {phone: phone_code_hash}
        logger.info("UserManager inizializzato")
    
    async def add_user(self, phone):
        """Aggiunge un nuovo utente Telegram. Versione migliorata basata sull'implementazione funzionante."""
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
            
            # Formatta il numero di telefono
            formatted_phone = phone
            if not formatted_phone.startswith("+"):
                formatted_phone = f"+{phone}"
                
            logger.info(f"Tentativo di autenticazione per {formatted_phone}")
            
            # Crea un nuovo client Telegram
            client = await self._create_client(phone)
            
            # Controlla se il client è stato creato correttamente
            if not client:
                logger.error(f"Impossibile creare client per {phone}")
                return {
                    'success': False,
                    'status': 'error',
                    'message': "Errore nella creazione del client Telegram",
                    'phone': phone
                }
            
            # Connetti il client
            try:
                await client.connect()
                logger.info(f"Client connesso per {phone}")
            except Exception as e:
                logger.error(f"Errore nella connessione del client per {phone}: {e}")
                return {
                    'success': False,
                    'status': 'connection_error',
                    'message': f"Impossibile connettersi a Telegram: {str(e)}",
                    'phone': phone
                }
            
            # Verifica se l'utente è già autenticato
            is_authorized = await client.is_user_authorized()
            logger.info(f"Controllo autorizzazione per {phone}: {is_authorized}")
            
            if is_authorized:
                # L'utente è già autenticato, aggiungi alle sessioni
                me = await client.get_me()
                
                # Crea directory per i media dell'utente
                user_media_dir = Path(os.getenv('BASE_MEDIA_PATH')) / phone / 'privata'
                ensure_directory(user_media_dir / 'immagini')
                ensure_directory(user_media_dir / 'video')
                
                # Aggiorna lista utenti
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
                
                logger.info(f"Utente {phone} già autenticato, aggiunto con successo")
                return {
                    'success': True,
                    'status': 'authenticated',
                    'user': user_data,
                    'phone': phone
                }
            else:
                # L'utente richiede autenticazione, invia codice
                try:
                    # Usa un approccio più simile al client.start() ma senza richiedere interazione
                    # diretta con l'utente, mantenendo il flusso web-friendly
                    sent_code = await client.send_code_request(formatted_phone)
                    phone_code_hash = sent_code.phone_code_hash
                    
                    logger.info(f"Codice di autenticazione richiesto per {phone}, phone_code_hash: {phone_code_hash}")
                    
                    # Salva il phone_code_hash per recuperarlo successivamente
                    self.phone_code_hashes[phone] = phone_code_hash
                    self._save_phone_code_hash(phone, phone_code_hash)
                    
                    return {
                        'success': False,
                        'status': 'code_sent',
                        'message': 'Codice di verifica inviato',
                        'phone': phone,
                        'phone_code_hash': phone_code_hash
                    }
                except FloodWaitError as e:
                    # Converti i secondi in formato più leggibile
                    wait_minutes = e.seconds // 60
                    wait_hours = wait_minutes // 60
                    
                    if wait_hours > 0:
                        wait_message = f"Devi attendere {wait_hours} ore e {wait_minutes % 60} minuti prima di poter richiedere un altro codice"
                    else:
                        wait_message = f"Devi attendere {wait_minutes} minuti prima di poter richiedere un altro codice"
                    
                    logger.error(f"Limite di tempo per {phone}: {wait_message} (FloodWait di {e.seconds} secondi)")
                    
                    return {
                        'success': False,
                        'status': 'flood_wait',
                        'message': wait_message,
                        'wait_seconds': e.seconds,
                        'phone': phone
                    }
                except Exception as e:
                    logger.error(f"Errore nell'invio del codice per {phone}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'invio del codice: {str(e)}",
                        'phone': phone
                    }
        except Exception as e:
            logger.error(f"Errore nell'aggiunta dell'utente {phone}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }

    async def authenticate_user(self, phone, code=None, password=None, phone_code_hash=None):
        """Autentica un utente Telegram con codice o password."""
        try:
            # Ottieni client esistente o creane uno nuovo
            client = await self._create_client(phone)
            
            # Connetti il client
            try:
                await client.connect()
                logger.info(f"Client connesso per {phone}")
            except Exception as e:
                logger.error(f"Errore nella connessione del client per {phone}: {e}")
                return {
                    'success': False,
                    'status': 'connection_error',
                    'message': f"Impossibile connettersi a Telegram: {str(e)}",
                    'phone': phone
                }
            
            # Se phone_code_hash non è fornito, prova a recuperarlo
            if not phone_code_hash:
                phone_code_hash = self._get_phone_code_hash(phone)
                logger.info(f"Recuperato phone_code_hash salvato per {phone}: {phone_code_hash}")
            
            # Formatta il numero di telefono
            formatted_phone = phone
            if not formatted_phone.startswith("+"):
                formatted_phone = f"+{phone}"
            
            # Invia codice se non è stato fornito
            if not code and not password:
                # Invia il codice e ottieni il phone_code_hash
                try:
                    sent_code = await client.send_code_request(formatted_phone)
                    phone_code_hash = sent_code.phone_code_hash
                    
                    logger.info(f"Codice di autenticazione richiesto per {phone}, phone_code_hash: {phone_code_hash}")
                    
                    # Salva il phone_code_hash
                    self._save_phone_code_hash(phone, phone_code_hash)
                    
                    return {
                        'success': False,
                        'status': 'code_sent',
                        'message': 'Codice di verifica inviato',
                        'phone': phone,
                        'phone_code_hash': phone_code_hash
                    }
                except FloodWaitError as e:
                    # Converti i secondi in formato più leggibile
                    wait_minutes = e.seconds // 60
                    wait_hours = wait_minutes // 60
                    
                    if wait_hours > 0:
                        wait_message = f"Devi attendere {wait_hours} ore e {wait_minutes % 60} minuti prima di poter richiedere un altro codice"
                    else:
                        wait_message = f"Devi attendere {wait_minutes} minuti prima di poter richiedere un altro codice"
                    
                    logger.error(f"Limite di tempo per {phone}: {wait_message} (FloodWait di {e.seconds} secondi)")
                    
                    return {
                        'success': False,
                        'status': 'flood_wait',
                        'message': wait_message,
                        'wait_seconds': e.seconds,
                        'phone': phone
                    }
                except Exception as e:
                    logger.error(f"Errore nell'invio del codice per {phone}: {e}")
                    
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'invio del codice: {str(e)}",
                        'phone': phone
                    }
            
            # Tenta il login con il codice fornito
            if code:
                try:
                    # Verifica che phone_code_hash sia disponibile
                    if not phone_code_hash:
                        logger.error(f"phone_code_hash non trovato per {phone}")
                        return {
                            'success': False,
                            'status': 'error',
                            'message': 'Sessione di verifica scaduta, riprova',
                            'phone': phone
                        }
                    
                    logger.info(f"Tentativo di sign_in per {phone} con code={code}, phone_code_hash={phone_code_hash}")
                    
                    # Prova con diversi tentativi in caso di errori
                    try:
                        # Prima prova con il formato normale
                        await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
                    except Exception as e1:
                        logger.warning(f"Primo tentativo di sign_in fallito: {e1}")
                        try:
                            # Prova con il formato con + all'inizio
                            await client.sign_in(formatted_phone, code, phone_code_hash=phone_code_hash)
                        except Exception as e2:
                            # Riprova con più timeout
                            logger.warning(f"Secondo tentativo di sign_in fallito: {e2}")
                            for attempt in range(3):
                                try:
                                    await asyncio.sleep(2 * (attempt + 1))  # Aumenta attesa a ogni tentativo
                                    await client.sign_in(phone, code, phone_code_hash=phone_code_hash)
                                    break
                                except Exception as e_retry:
                                    if attempt == 2:  # Ultimo tentativo fallito
                                        raise e_retry
                                    logger.warning(f"Tentativo {attempt+1} fallito: {e_retry}")
                    
                    # Se l'autenticazione è andata a buon fine, aggiungi l'utente
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
                    
                    # Salva la sessione
                    await self._save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self._remove_phone_code_hash(phone)
                    
                    logger.info(f"Autenticazione con codice completata con successo per {phone}")
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'user': user_data,
                        'phone': phone
                    }
                except SessionPasswordNeededError:
                    logger.info(f"Password 2FA richiesta per {phone}")
                    return {
                        'success': False,
                        'status': 'password_required',
                        'message': 'Richiesta password 2FA',
                        'phone': phone
                    }
                except Exception as e:
                    # Gestisci i diversi tipi di errori
                    error_message = str(e).lower()
                    
                    if "phone code expired" in error_message:
                        logger.error(f"Codice di verifica scaduto per {phone}")
                        return {
                            'success': False,
                            'status': 'code_expired',
                            'message': 'Il codice di verifica è scaduto, richiedi un nuovo codice',
                            'phone': phone
                        }
                    elif "phone code invalid" in error_message:
                        logger.error(f"Codice di verifica non valido per {phone}")
                        return {
                            'success': False,
                            'status': 'code_invalid',
                            'message': 'Il codice di verifica non è valido, controlla e riprova',
                            'phone': phone
                        }
                    else:
                        logger.error(f"Errore nell'autenticazione con codice per {phone}: {e}")
                        return {
                            'success': False,
                            'status': 'error',
                            'message': f"Errore nell'autenticazione con codice: {str(e)}",
                            'phone': phone
                        }
            
            # Tenta il login con la password 2FA
            elif password:
                try:
                    await client.sign_in(password=password)
                    
                    # Se l'autenticazione è andata a buon fine, aggiungi l'utente
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
                    
                    # Salva la sessione
                    await self._save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self._remove_phone_code_hash(phone)
                    
                    logger.info(f"Autenticazione 2FA completata con successo per {phone}")
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'user': user_data,
                        'phone': phone
                    }
                except Exception as e:
                    logger.error(f"Errore nell'autenticazione 2FA per {phone}: {e}")
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'autenticazione con password: {str(e)}",
                        'phone': phone
                    }
        except Exception as e:
            logger.error(f"Errore generale nell'autenticazione dell'utente {phone}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
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
            
            # Crea e connetti un client se necessario
            client = await self._create_client(phone)
            if not client:
                logger.error(f"Impossibile creare client per {phone}")
                return {
                    'success': False,
                    'status': 'error',
                    'message': f"Impossibile creare client per {phone}",
                    'phone': phone
                }
            
            try:
                await client.connect()
            except Exception as e:
                logger.error(f"Errore nella connessione del client per {phone}: {e}")
                return {
                    'success': False,
                    'status': 'connection_error',
                    'message': f"Impossibile connettersi a Telegram: {str(e)}",
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
                    'status': 'code_required',
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
            
            # Disconnetti client in modo asincrono
            asyncio.create_task(self._disconnect_client(phone))
            
            # Rimuovi file di sessione
            session_file = self.sessions_dir / f"{phone}.session"
            user_file = self.sessions_dir / f"{phone}.json"
            hash_file = self.sessions_dir / f"{phone}.hash"
            
            if session_file.exists():
                session_file.unlink()
            
            if user_file.exists():
                user_file.unlink()
                
            if hash_file.exists():
                hash_file.unlink()
            
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
            # Per ora si assume che l'utente sia connesso se esiste nella lista
            user['connected'] = True
            return user
        return None
    
    async def restore_all_sessions(self):
        """Ripristina tutte le sessioni salvate."""
        try:
            # Ottieni tutti gli utenti
            for user in self.users:
                phone = user.get('phone')
                if phone:
                    # Ripristina sessione
                    client = await self._create_client(phone)
                    if client:
                        try:
                            await client.connect()
                            is_authorized = await client.is_user_authorized()
                            
                            if is_authorized:
                                logger.info(f"Sessione ripristinata per {phone}")
                            else:
                                logger.warning(f"Sessione non autorizzata per {phone}")
                        except Exception as e:
                            logger.error(f"Errore nel ripristino della sessione per {phone}: {e}")
            
            return True
        except Exception as e:
            logger.error(f"Errore nel ripristino delle sessioni: {e}")
            return False

    # Metodi privati
    async def _create_client(self, nickname):
        """Crea un client con gestione migliorata delle sessioni."""
        try:
            # Usa il client standard ma con parametri migliorati
            session_path = f'session_{nickname}'
            
            # Controlla se esiste una stringa di sessione salvata
            session_file = self.sessions_dir / f"{nickname}.session"
            string_session = None
            
            if session_file.exists():
                with open(session_file, 'r') as f:
                    string_session = f.read().strip()
                    logger.info(f"Sessione esistente caricata per {nickname}")
            
            # Crea il client con parametri migliorati
            client = TelegramClient(
                StringSession(string_session) if string_session else StringSession(),
                API_ID, 
                API_HASH,
                device_model="Telegram Web Manager",
                system_version="1.0",
                app_version="1.0",
                lang_code="it",
                connection_retries=10,
                retry_delay=3,
                timeout=30  # Aumenta il timeout
            )
            
            return client
        except Exception as e:
            logger.error(f"Errore nella creazione del client per {nickname}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    async def _save_session(self, phone, client):
        """Salva la sessione di un client Telegram su file."""
        try:
            # Ottieni stringa di sessione
            string_session = client.session.save()
            
            # Salva su file
            session_file = self.sessions_dir / f"{phone}.session"
            with open(session_file, 'w') as f:
                f.write(string_session)
            
            # Salva anche dati utente
            try:
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
            except Exception as e:
                logger.error(f"Errore nell'ottenere informazioni dell'utente per {phone}: {e}")
            
            logger.info(f"Sessione salvata con successo per {phone}")
            return True
        except Exception as e:
            logger.error(f"Errore nel salvataggio della sessione per {phone}: {e}")
            return False
    
    async def _disconnect_client(self, phone):
        """Disconnette un client Telegram."""
        try:
            # Crea e connetti un client temporaneo
            client = await self._create_client(phone)
            if client:
                try:
                    await client.connect()
                    if client.is_connected():
                        await client.disconnect()
                        logger.info(f"Client Telegram disconnesso per {phone}")
                except Exception as e:
                    logger.error(f"Errore nella disconnessione del client per {phone}: {e}")
            return True
        except Exception as e:
            logger.error(f"Errore nella disconnessione del client per {phone}: {e}")
            return False
    
    # Metodi per gestire il phone_code_hash
    def _save_phone_code_hash(self, phone, phone_code_hash):
        """Salva il phone_code_hash associato a un numero di telefono."""
        try:
            # Salva in memoria
            self.phone_code_hashes[phone] = phone_code_hash
            
            # Salva su file per persistenza
            hash_file = self.sessions_dir / f"{phone}.hash"
            with open(hash_file, 'w') as f:
                f.write(phone_code_hash)
                
            logger.info(f"phone_code_hash salvato per {phone}: {phone_code_hash}")
            return True
        except Exception as e:
            logger.error(f"Errore nel salvataggio del phone_code_hash per {phone}: {e}")
            return False
    
    def _get_phone_code_hash(self, phone):
        """Ottiene il phone_code_hash associato a un numero di telefono."""
        try:
            # Prova prima dalla memoria
            if phone in self.phone_code_hashes:
                return self.phone_code_hashes.get(phone)
            
            # Altrimenti prova dal file
            hash_file = self.sessions_dir / f"{phone}.hash"
            if hash_file.exists():
                with open(hash_file, 'r') as f:
                    phone_code_hash = f.read().strip()
                    # Aggiorna anche la cache in memoria
                    self.phone_code_hashes[phone] = phone_code_hash
                    return phone_code_hash
            
            return None
        except Exception as e:
            logger.error(f"Errore nella lettura del phone_code_hash per {phone}: {e}")
            return None

    def _remove_phone_code_hash(self, phone):
        """Rimuove il phone_code_hash associato a un numero di telefono."""
        try:
            # Rimuovi dalla memoria
            if phone in self.phone_code_hashes:
                del self.phone_code_hashes[phone]
            
            # Rimuovi dal file
            hash_file = self.sessions_dir / f"{phone}.hash"
            if hash_file.exists():
                hash_file.unlink()
                
            logger.info(f"phone_code_hash rimosso per {phone}")
            return True
        except Exception as e:
            logger.error(f"Errore nella rimozione del phone_code_hash per {phone}: {e}")
            return False

    async def verify_and_add_user(self, phone, code=None, password=None, phone_code_hash=None):
        """Verifica e aggiunge un utente in modo asincrono."""
        try:
            # Se abbiamo già code o password, autentica direttamente
            if code or password:
                result = await self.authenticate_user(phone, code, password, phone_code_hash)
                return result
            
            # Altrimenti, inizia il processo di aggiunta
            result = await self.add_user(phone)
            return result
            
        except Exception as e:
            logger.error(f"Errore durante la verifica dell'account: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'status': 'error',
                'message': f"Errore durante la verifica dell'account: {str(e)}",
                'phone': phone
            }