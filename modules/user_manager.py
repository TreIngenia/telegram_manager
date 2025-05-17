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
            
            # Crea un nuovo client Telegram per l'utente con i parametri migliorati
            client_info = await self.telegram_manager.create_client(phone)
            
            # Se l'utente richiede autenticazione, usa l'approccio più diretto
            if not client_info['success'] and client_info['status'] == 'authentication_required':
                try:
                    client = client_info['client']
                    
                    # Usa un approccio più simile al client.start() ma senza richiedere interazione
                    # diretta con l'utente, mantenendo il flusso web-friendly
                    sent_code = await client.send_code_request(formatted_phone)
                    phone_code_hash = sent_code.phone_code_hash
                    
                    logger.info(f"Codice di autenticazione richiesto per {phone}, phone_code_hash: {phone_code_hash}")
                    
                    # Salva il phone_code_hash per recuperarlo successivamente
                    self.telegram_manager._save_phone_code_hash(phone, phone_code_hash)
                    
                    return {
                        'success': False,
                        'status': 'code_sent',
                        'message': 'Codice di verifica inviato',
                        'phone': phone,
                        'phone_code_hash': phone_code_hash
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
            elif client_info['success']:
                # L'utente è già autenticato, aggiungilo alla lista
                client = client_info['client']
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
                
                logger.info(f"Utente {phone} aggiunto con successo")
                return {
                    'success': True,
                    'status': 'authenticated',
                    'user': user_data,
                    'phone': phone
                }
            else:
                # Errore durante la creazione del client
                logger.error(f"Errore nella creazione del client per {phone}: {client_info.get('message', 'Errore sconosciuto')}")
                return client_info
        
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
        """Autentica un utente Telegram con codice o password. Versione migliorata."""
        try:
            # Ottieni client Telegram
            client_info = await self.telegram_manager.get_client(phone)
            if not client_info:
                logger.error(f"Client non trovato per {phone}")
                return {
                    'success': False,
                    'status': 'error',
                    'message': f"Client non trovato per {phone}",
                    'phone': phone
                }
                
            client = client_info
            
            # Formatta il numero di telefono
            formatted_phone = phone
            if not formatted_phone.startswith("+"):
                formatted_phone = f"+{phone}"
                
            # Se phone_code_hash non è fornito, prova a recuperarlo
            if not phone_code_hash:
                phone_code_hash = self.telegram_manager._get_phone_code_hash(phone)
                logger.info(f"Recuperato phone_code_hash salvato per {phone}: {phone_code_hash}")
                
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
                    
                    # Salva il client
                    self.telegram_manager.clients[phone] = client
                    logger.info(f"Autenticazione completata con successo per {phone}")
                    
                    # Salva la sessione
                    await self.telegram_manager.save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self.telegram_manager._remove_phone_code_hash(phone)
                    
                    return {
                        'success': True,
                        'status': 'authenticated',
                        'user': user_data,
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
                    elif "2fa" in str(e).lower() or "password" in str(e).lower() or isinstance(e, SessionPasswordNeededError):
                        logger.info(f"Password 2FA richiesta per {phone}")
                        return {
                            'success': False,
                            'status': 'password_required',
                            'message': 'Richiesta password 2FA',
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
                    
                    # Salva il client
                    self.telegram_manager.clients[phone] = client
                    logger.info(f"Autenticazione 2FA completata con successo per {phone}")
                    
                    # Salva la sessione
                    await self.telegram_manager.save_session(phone, client)
                    
                    # Pulisci il phone_code_hash
                    self.telegram_manager._remove_phone_code_hash(phone)
                    
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
            else:
                # Né codice né password forniti, invia nuovo codice
                try:
                    # Invia il codice e ottieni il phone_code_hash
                    sent_code = await client.send_code_request(formatted_phone)
                    phone_code_hash = sent_code.phone_code_hash
                    
                    logger.info(f"Nuovo codice di autenticazione richiesto per {phone}, phone_code_hash: {phone_code_hash}")
                    
                    # Salva il phone_code_hash
                    self.telegram_manager._save_phone_code_hash(phone, phone_code_hash)
                    
                    return {
                        'success': False,
                        'status': 'code_sent',
                        'message': 'Nuovo codice di verifica inviato',
                        'phone': phone,
                        'phone_code_hash': phone_code_hash
                    }
                except Exception as e:
                    logger.error(f"Errore nell'invio del codice per {phone}: {e}")
                    return {
                        'success': False,
                        'status': 'error',
                        'message': f"Errore nell'invio del codice: {str(e)}",
                        'phone': phone
                    }
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