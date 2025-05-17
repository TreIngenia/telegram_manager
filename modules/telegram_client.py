import os
import logging
import asyncio
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.sessions import StringSession
from pathlib import Path
from dotenv import load_dotenv
from modules.utils import setup_logger, save_to_json, load_from_json, ensure_directory
from telethon.errors import SessionPasswordNeededError, FloodWaitError

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

    def ensure_formatted_phone(phone):
        if not phone.startswith("+"):
            return f"+{phone}"
        return phone

    async def create_client(self, phone):
        """Crea e configura un client Telegram per il numero di telefono specificato."""
        try:
            logger.info(f"Creazione client Telegram per {phone}")
            
            # Format phone number properly - ensure it has a "+" at the beginning
            formatted_phone = phone
            if not formatted_phone.startswith("+"):
                formatted_phone = f"+{phone}"
                
            logger.info(f"Utilizzo numero formattato: {formatted_phone}")
                
            # Log API credentials (partial for security)
            api_id_partial = API_ID[:3] + "..." if API_ID else "None"
            api_hash_partial = API_HASH[:5] + "..." if API_HASH else "None"
            logger.info(f"Utilizzando API_ID: {api_id_partial}, API_HASH: {api_hash_partial}")
            
            # Verify API credentials are present
            if not API_ID or not API_HASH:
                logger.error("API_ID o API_HASH mancanti. Controlla il file .env")
                return {
                    'success': False,
                    'status': 'error',
                    'message': "Credenziali API di Telegram mancanti. Controlla il file .env",
                    'phone': phone
                }
            
            # Carica sessione esistente se disponibile
            session_file = self.sessions_dir / f"{phone}.session"
            string_session = None
            
            if session_file.exists():
                with open(session_file, 'r') as f:
                    string_session = f.read().strip()
                    logger.info(f"Sessione esistente caricata per {phone}")
            
            # Crea il client con parametri di retry e timeout migliorati
            client = TelegramClient(
                StringSession(string_session) if string_session else StringSession(),
                API_ID, 
                API_HASH,
                device_model="Telegram Web Manager",
                system_version="1.0",
                app_version="1.0",
                lang_code="it",
                connection_retries=10,  # Aggiunti parametri di retry come nell'app funzionante
                retry_delay=3,
                timeout=30  # Aumenta il timeout
            )
            
            # Connetti il client
            logger.info(f"Tentativo di connessione al client per {phone}")
            try:
                await client.connect()
                logger.info(f"Connessione al client riuscita per {phone}")
            except Exception as connection_error:
                logger.error(f"Errore nella connessione al client per {phone}: {connection_error}")
                return {
                    'success': False,
                    'status': 'connection_error',
                    'message': f"Impossibile connettersi a Telegram: {str(connection_error)}",
                    'phone': phone
                }
            
            # Se non è già autenticato, avvia processo di login
            is_authorized = False
            try:
                is_authorized = await client.is_user_authorized()
                logger.info(f"Controllo autorizzazione per {phone}: {is_authorized}")
            except Exception as auth_check_error:
                logger.error(f"Errore nel controllo dell'autorizzazione per {phone}: {auth_check_error}")
                return {
                    'success': False,
                    'status': 'auth_check_error',
                    'message': f"Errore nel controllo dell'autorizzazione: {str(auth_check_error)}",
                    'phone': phone
                }
                
            if not is_authorized:
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
            try:
                await self.save_session(phone, client)
            except Exception as session_error:
                logger.error(f"Errore nel salvataggio della sessione per {phone}: {session_error}")
                # Non interrompiamo l'esecuzione per questo errore
            
            return {
                'success': True,
                'status': 'authenticated',
                'client': client,
                'phone': phone
            }
        
        except Exception as e:
            logger.error(f"Errore nella creazione del client Telegram per {phone}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }
    
    """
    Modifica da apportare al file modules/telegram_client.py per correggere il problema
    di autenticazione con il codice di verifica Telegram
    """
    async def authenticate_client(self, phone, code=None, password=None, phone_code_hash=None):
        """Autentica un client Telegram con codice o password."""
        try:
            # Ottieni client esistente o creane uno nuovo
            client = None
            client_info = None
            
            # Formatta il numero di telefono correttamente
            formatted_phone = phone
            if not formatted_phone.startswith("+"):
                formatted_phone = f"+{phone}"
                
            logger.info(f"Tentativo di autenticazione per {formatted_phone}")
            
            # Se c'è già un client per questo numero nel dizionario, usalo
            if phone in self.clients:
                client = self.clients[phone]
                logger.info(f"Utilizzo client esistente per {phone}")
            else:
                # Altrimenti, crea un nuovo client
                client_info = await self.create_client(phone)
                if not client_info['success'] and client_info['status'] != 'authentication_required':
                    return client_info
                client = client_info.get('client')
                
            if not client:
                logger.error(f"Impossibile ottenere un client valido per {phone}")
                return {
                    'success': False,
                    'status': 'error',
                    'message': f"Impossibile ottenere un client valido per {phone}",
                    'phone': phone
                }
                
            # Verifica se il client è connesso
            if not client.is_connected():
                await client.connect()
                logger.info(f"Client connesso per {phone}")
            
            # Se phone_code_hash non è fornito, prova a recuperarlo
            if not phone_code_hash:
                phone_code_hash = self._get_phone_code_hash(phone)
                logger.info(f"Recuperato phone_code_hash salvato per {phone}: {phone_code_hash}")
            
            # CASO 1: Invia codice se non è stato fornito né codice né password
            if not code and not password:
                # Invia il codice e ottieni il phone_code_hash
                try:
                    result = await client.send_code_request(formatted_phone)
                    phone_code_hash = result.phone_code_hash
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
                    import traceback
                    logger.error(traceback.format_exc())
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'invio del codice: {str(e)}",
                        'phone': phone
                    }
            
            # CASO 2: Tenta il login con il codice fornito
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
                    
                    # Usa il phone_code_hash per la sign_in
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
                            # Ultimo tentativo con parametri alternativi
                            await client.sign_in(phone_number=formatted_phone, code=code, phone_code_hash=phone_code_hash)
                    
                    # Se l'autenticazione è andata a buon fine, salva il client
                    self.clients[phone] = client
                    logger.info(f"Autenticazione completata con successo per {phone}")
                    
                    # Salva la sessione
                    await self.save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self._remove_phone_code_hash(phone)
                    
                    # Ottieni info dell'utente
                    me = await client.get_me()
                    user_info = {
                        'id': me.id,
                        'first_name': me.first_name,
                        'last_name': me.last_name if hasattr(me, 'last_name') else None,
                        'username': me.username if hasattr(me, 'username') else None,
                        'phone': phone
                    }
                    
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'user': user_info,
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
                    if "phone code expired" in str(e).lower():
                        logger.error(f"Codice di verifica scaduto per {phone}")
                        return {
                            'success': False,
                            'status': 'code_expired',
                            'message': 'Il codice di verifica è scaduto, richiedi un nuovo codice',
                            'phone': phone
                        }
                    elif "phone code invalid" in str(e).lower():
                        logger.error(f"Codice di verifica non valido per {phone}")
                        return {
                            'success': False,
                            'status': 'code_invalid',
                            'message': 'Il codice di verifica non è valido, controlla e riprova',
                            'phone': phone
                        }
                    else:
                        logger.error(f"Errore nell'autenticazione con codice per {phone}: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                        return {
                            'success': False,
                            'status': 'error',
                            'message': f"Errore nell'autenticazione con codice: {str(e)}",
                            'phone': phone
                        }
            
            # CASO 3: Tenta il login con la password 2FA
            elif password:
                try:
                    await client.sign_in(password=password)
                    
                    # Se l'autenticazione è andata a buon fine, salva il client
                    self.clients[phone] = client
                    logger.info(f"Autenticazione 2FA completata con successo per {phone}")
                    
                    # Salva la sessione
                    await self.save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self._remove_phone_code_hash(phone)
                    
                    # Ottieni info dell'utente
                    me = await client.get_me()
                    user_info = {
                        'id': me.id,
                        'first_name': me.first_name,
                        'last_name': me.last_name if hasattr(me, 'last_name') else None,
                        'username': me.username if hasattr(me, 'username') else None,
                        'phone': phone
                    }
                    
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'user': user_info,
                        'phone': phone
                    }
                except Exception as e:
                    logger.error(f"Errore nell'autenticazione 2FA per {phone}: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'autenticazione con password: {str(e)}",
                        'phone': phone
                    }
            
            # CASO NON GESTITO: nessuna operazione specificata
            return {
                'success': False,
                'status': 'error',
                'message': 'Nessuna operazione di autenticazione specificata',
                'phone': phone
            }
        
        except Exception as e:
            logger.error(f"Errore generale nell'autenticazione del client Telegram per {phone}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'status': 'error',
                'message': str(e),
                'phone': phone
            }

    # Aggiungi questi metodi per gestire il phone_code_hash
    # In telegram_client.py - aggiungere questi metodi
    def _save_phone_code_hash(self, phone, phone_code_hash):
        """Salva il phone_code_hash associato a un numero di telefono."""
        if not hasattr(self, 'phone_code_hashes'):
            self.phone_code_hashes = {}
        
        self.phone_code_hashes[phone] = phone_code_hash
        
        # Opzionalmente, salva anche su file per persistenza
        try:
            hash_file = Path(self.sessions_dir) / f"{phone}.hash"
            with open(hash_file, 'w') as f:
                f.write(phone_code_hash)
        except Exception as e:
            logger.error(f"Errore nel salvataggio del phone_code_hash per {phone}: {e}")

    def _get_phone_code_hash(self, phone):
        """Ottiene il phone_code_hash associato a un numero di telefono."""
        # Prova prima dalla memoria
        if hasattr(self, 'phone_code_hashes') and phone in self.phone_code_hashes:
            return self.phone_code_hashes.get(phone)
        
        # Altrimenti prova dal file
        try:
            hash_file = Path(self.sessions_dir) / f"{phone}.hash"
            if hash_file.exists():
                with open(hash_file, 'r') as f:
                    return f.read().strip()
        except Exception as e:
            logger.error(f"Errore nella lettura del phone_code_hash per {phone}: {e}")
        
        return None

    def _remove_phone_code_hash(self, phone):
        """Rimuove il phone_code_hash associato a un numero di telefono."""
        # Rimuovi dalla memoria
        if hasattr(self, 'phone_code_hashes') and phone in self.phone_code_hashes:
            del self.phone_code_hashes[phone]
        
        # Rimuovi dal file
        try:
            hash_file = Path(self.sessions_dir) / f"{phone}.hash"
            if hash_file.exists():
                hash_file.unlink()
        except Exception as e:
            logger.error(f"Errore nella rimozione del phone_code_hash per {phone}: {e}")
    
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