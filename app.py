import os
import json
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Moduli dell'applicazione
from modules.telegram_client import TelegramClientManager
from modules.user_manager import UserManager
from modules.group_manager import GroupManager
from modules.message_monitor import MessageMonitor
from modules.media_downloader import MediaDownloader
from modules.archive_manager import ArchiveManager
from modules.utils import setup_logger, json_serialize

# Carica variabili d'ambiente
load_dotenv()

# Configurazione app Flask
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # Limite upload di 50MB

# Configurazione SocketIO per comunicazioni in tempo reale
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')  # Cambiato da eventlet a threading

# Configurazione logger
logger = setup_logger('app', os.path.join(os.getenv('LOGS_PATH'), 'app.log'))

# Inizializzazione managers
telegram_manager = TelegramClientManager()
user_manager = UserManager()
group_manager = GroupManager()
message_monitor = MessageMonitor(socketio)
media_downloader = MediaDownloader()
archive_manager = ArchiveManager()

# Task in background
background_tasks = {}

# Stato globale dell'applicazione
app_state = {
    'active_users': set(),
    'monitored_groups': {},
    'downloads_in_progress': {},
    'archive_operations': {}
}

# Funzioni utility

# Funzione utility per formattare i bytes
def format_bytes(size, decimals=2):
    """Formatta dimensioni in bytes in un formato leggibile."""
    if size == 0:
        return "0 B"
    names = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = 0
    while size >= 1024 and i < len(names) - 1:
        size /= 1024
        i += 1
    return f"{size:.{decimals}f} {names[i]}"

# Funzione utility per formattare i bytes

# Aggiungi filtri Jinja2 personalizzati
@app.template_filter('format_datetime')
def format_datetime(value, format='%d/%m/%Y %H:%M:%S'):
    """Formatta un oggetto datetime o una stringa ISO in un formato leggibile."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.strftime(format)
    return value

@app.route('/')
def index():
    """Route principale - Dashboard."""
    users = user_manager.get_all_users()
    
    # Conta il numero totale di gruppi
    groups_count = 0
    for user in users:
        try:
            user_groups = asyncio.run(group_manager.get_user_groups(user['phone']))
            groups_count += len(user_groups)
        except:
            pass
    
    # Statistiche sui media
    total_media = 0
    total_images = 0
    total_videos = 0
    total_size = 0
    
    try:
        # Implementare il conteggio dei media (per ora solo valori fittizi per dimostrazione)
        total_media = 100
        total_images = 70
        total_videos = 30
        total_size = 1024 * 1024 * 500  # 500 MB
    except:
        pass
    
    # Monitoraggi attivi
    monitored = message_monitor.get_active_monitors()
    
    # Download in corso
    downloads = media_downloader.get_all_downloads()
    
    # Archivi disponibili
    try:
        archives = asyncio.run(archive_manager.get_all_archives())
    except:
        archives = []
    
    # Attività recenti
    recent_activities = [
        {
            'title': 'Download completato',
            'description': 'Download dei media dal gruppo "Esempio" completato con successo',
            'user': 'Sistema',
            'time': datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        },
        {
            'title': 'Monitoraggio avviato',
            'description': 'Avviato monitoraggio messaggi per il gruppo "Test"',
            'user': 'Sistema',
            'time': datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        }
    ]
    
    # Formatta la dimensione totale
    total_size_formatted = format_bytes(total_size)
    
    return render_template('index.html', 
                          active_page='dashboard',
                          users=users,
                          groups_count=groups_count,
                          total_media=total_media,
                          total_images=total_images,
                          total_videos=total_videos,
                          total_size=total_size,
                          total_size_formatted=total_size_formatted,
                          monitored=monitored,
                          downloads=downloads,
                          archives=archives,
                          recent_activities=recent_activities)

@app.route('/users')
def users():
    """Gestione utenti Telegram."""
    users_list = user_manager.get_all_users()
    return render_template('users.html', active_page='users', users=users_list)

@app.route('/groups')
def groups():
    """Gestione gruppi Telegram."""
    # Ottieni tutti gli utenti
    users_list = user_manager.get_all_users()
    
    # Ottieni utente selezionato dalla query string
    selected_user = request.args.get('user', '')
    
    # Se non c'è un utente selezionato ma ci sono utenti disponibili, seleziona il primo
    if not selected_user and users_list:
        selected_user = users_list[0]['phone']
    
    # Ottieni i gruppi dell'utente selezionato
    groups_list = []
    if selected_user:
        try:
            groups_list = asyncio.run(group_manager.get_user_groups(selected_user))
        except Exception as e:
            logger.error(f"Errore nel caricamento dei gruppi per {selected_user}: {e}")
    
    return render_template('groups.html', 
                          active_page='groups', 
                          users=users_list,
                          groups=groups_list, 
                          selected_user=selected_user)

@app.route('/monitor')
def monitor():
    """Monitoraggio messaggi in tempo reale."""
    users_list = user_manager.get_all_users()
    monitored = message_monitor.get_active_monitors()
    return render_template('monitor.html', active_page='monitor', users=users_list, monitored=monitored)

@app.route('/download')
def download():
    """Download media dai gruppi."""
    users_list = user_manager.get_all_users()
    downloads = media_downloader.get_all_downloads()
    return render_template('download.html', active_page='download', users=users_list, downloads=downloads)

@app.route('/archive')
def archive():
    """Archivio storico media."""
    users_list = user_manager.get_all_users()
    archives = archive_manager.get_all_archive_operations()
    return render_template('archive.html', active_page='archive', users=users_list, archives=archives)

@app.route('/logs')
def logs():
    """Visualizzazione log dell'applicazione."""
    log_files = []
    logs_dir = Path(os.getenv('LOGS_PATH'))
    if logs_dir.exists():
        log_files = [f.name for f in logs_dir.iterdir() if f.is_file() and f.suffix == '.log']
    
    selected_log = request.args.get('file', 'app.log')
    log_content = []
    log_path = logs_dir / selected_log
    
    if log_path.exists() and log_path.is_file():
        with open(log_path, 'r') as f:
            log_content = f.readlines()
    
    return render_template('logs.html', active_page='logs', 
                          log_files=log_files, 
                          selected_log=selected_log, 
                          log_content=log_content)

# API routes per operazioni AJAX
@app.route('/api/users', methods=['GET', 'POST', 'DELETE'])
def api_users():
    """API per la gestione degli utenti."""
    if request.method == 'GET':
        return jsonify(user_manager.get_all_users())
    
    elif request.method == 'POST':
        try:
            data = request.json
            phone = data.get('phone')
            if not phone:
                return jsonify({'success': False, 'error': 'Numero di telefono mancante', 'status': 'error'}), 400
            
            # Log per debug
            logger.info(f"Tentativo di aggiunta utente con telefono: {phone}")
            
            result = asyncio.run(user_manager.add_user(phone))
            
            # Log risultato
            logger.info(f"Risultato add_user: {result}")
            
            # Assicurati che 'status' e 'phone' siano nella risposta
            if 'status' not in result:
                result['status'] = 'error' if not result.get('success') else 'success'
            if 'phone' not in result:
                result['phone'] = phone
                
            return jsonify(result)
        except Exception as e:
            logger.error(f"Errore nell'aggiunta dell'utente: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False, 
                'status': 'error',
                'error': str(e),
                'phone': phone if 'phone' in locals() else None
            }), 500
    
    elif request.method == 'DELETE':
        try:
            data = request.json
            phone = data.get('phone')
            if not phone:
                return jsonify({'success': False, 'error': 'Numero di telefono mancante'}), 400
            
            result = user_manager.remove_user(phone)
            return jsonify(result)
        except Exception as e:
            logger.error(f"Errore nella rimozione dell'utente: {str(e)}")
            return jsonify({
                'success': False, 
                'status': 'error',
                'error': str(e),
                'phone': phone if 'phone' in locals() else None
            }), 500

@app.route('/api/users/verify', methods=['POST'])
def api_users_verify():
    """API per verificare un utente con codice o password."""
    try:
        data = request.json
        phone = data.get('phone')
        code = data.get('code')
        password = data.get('password')
        phone_code_hash = data.get('phone_code_hash')
        
        if not phone:
            return jsonify({'success': False, 'error': 'Numero di telefono mancante', 'status': 'error'}), 400
        
        # Log per debug
        logger.info(f"Tentativo di verifica per {phone}, codice: {code is not None}, password: {password is not None}, phone_code_hash: {phone_code_hash}")
        
        # Passa phone_code_hash al metodo authenticate_user
        result = asyncio.run(user_manager.authenticate_user(phone, code, password, phone_code_hash))
        
        # Log risultato
        logger.info(f"Risultato verifica: {result}")
        
        # Assicurati che status e phone siano nella risposta
        if 'status' not in result:
            result['status'] = 'error' if not result.get('success') else 'success'
        if 'phone' not in result:
            result['phone'] = phone
            
        return jsonify(result)
    except Exception as e:
        logger.error(f"Errore nella verifica dell'utente: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False, 
            'status': 'error',
            'error': str(e),
            'phone': phone if 'phone' in locals() else None
        }), 500

@app.route('/api/users/status/<phone>', methods=['GET'])
def api_user_status(phone):
    """API per verificare lo stato di autenticazione di un utente."""
    try:
        # Controlla lo stato dell'utente
        client_info = asyncio.run(user_manager.get_user_auth_status(phone))
        return jsonify(client_info)
    except Exception as e:
        app.logger.error(f"Errore nel controllo dello stato di {phone}: {e}")
        return jsonify({
            'success': False,
            'status': 'error',
            'message': str(e),
            'phone': phone
        })
    
@app.route('/api/groups/<user_phone>', methods=['GET'])
def api_groups(user_phone):
    """API per ottenere i gruppi di un utente."""
    groups = asyncio.run(group_manager.get_user_groups(user_phone))
    return jsonify(groups)

@app.route('/api/group/invite/<user_phone>/<group_id>', methods=['GET'])
def api_group_invite(user_phone, group_id):
    """API per ottenere il link di invito di un gruppo."""
    invite_link = asyncio.run(group_manager.get_invite_link(user_phone, int(group_id)))
    return jsonify({'success': True, 'invite_link': invite_link})

@app.route('/api/monitor/start', methods=['POST'])
def api_monitor_start():
    """API per avviare il monitoraggio messaggi."""
    data = request.json
    user_phone = data.get('user_phone')
    group_ids = data.get('group_ids', [])
    
    if not user_phone or not group_ids:
        return jsonify({'success': False, 'error': 'Parametri mancanti'}), 400
    
    # Avvia monitoraggio in un task separato
    task_id = f"monitor_{user_phone}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    def run_monitor():
        asyncio.run(message_monitor.start_monitoring(user_phone, group_ids))
    
    import threading
    thread = threading.Thread(target=run_monitor)
    thread.daemon = True
    thread.start()
    
    background_tasks[task_id] = thread
    app_state['monitored_groups'][user_phone] = group_ids
    
    return jsonify({'success': True, 'task_id': task_id})

@app.route('/api/monitor/stop', methods=['POST'])
def api_monitor_stop():
    """API per fermare il monitoraggio messaggi."""
    data = request.json
    user_phone = data.get('user_phone')
    
    if not user_phone:
        return jsonify({'success': False, 'error': 'Parametri mancanti'}), 400
    
    message_monitor.stop_monitoring(user_phone)
    
    if user_phone in app_state['monitored_groups']:
        del app_state['monitored_groups'][user_phone]
    
    return jsonify({'success': True})

@app.route('/api/download/start', methods=['POST'])
def api_download_start():
    """API per avviare il download dei media da un gruppo."""
    data = request.json
    user_phone = data.get('user_phone')
    group_id = data.get('group_id')
    media_types = data.get('media_types', ['photo', 'video'])
    
    if not user_phone or not group_id:
        return jsonify({'success': False, 'error': 'Parametri mancanti'}), 400
    
    # Avvia download in un task separato
    task_id = f"download_{user_phone}_{group_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    def run_download():
        asyncio.run(media_downloader.download_media(user_phone, int(group_id), media_types))
    
    import threading
    thread = threading.Thread(target=run_download)
    thread.daemon = True
    thread.start()
    
    background_tasks[task_id] = thread
    app_state['downloads_in_progress'][task_id] = {
        'user_phone': user_phone,
        'group_id': group_id,
        'start_time': datetime.now().isoformat(),
        'status': 'in_progress'
    }
    
    return jsonify({'success': True, 'task_id': task_id})

@app.route('/api/download/status/<task_id>', methods=['GET'])
def api_download_status(task_id):
    """API per controllare lo stato di un download."""
    if task_id in app_state['downloads_in_progress']:
        return jsonify({
            'success': True,
            'status': app_state['downloads_in_progress'][task_id]
        })
    return jsonify({'success': False, 'error': 'Task non trovato'}), 404

@app.route('/api/archive/create', methods=['POST'])
def api_archive_create():
    """API per creare un archivio storico dei media di un gruppo."""
    data = request.json
    user_phone = data.get('user_phone')
    group_id = data.get('group_id')
    media_types = data.get('media_types', ['photo', 'video'])
    
    if not user_phone or not group_id:
        return jsonify({'success': False, 'error': 'Parametri mancanti'}), 400
    
    # Avvia creazione archivio in un task separato
    task_id = f"archive_{user_phone}_{group_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    def run_archive():
        asyncio.run(archive_manager.create_archive(user_phone, int(group_id), media_types))
    
    import threading
    thread = threading.Thread(target=run_archive)
    thread.daemon = True
    thread.start()
    
    background_tasks[task_id] = thread
    app_state['archive_operations'][task_id] = {
        'user_phone': user_phone,
        'group_id': group_id,
        'start_time': datetime.now().isoformat(),
        'status': 'in_progress'
    }
    
    return jsonify({'success': True, 'task_id': task_id})

@app.route('/api/logs/<log_file>', methods=['GET'])
def api_logs(log_file):
    """API per ottenere il contenuto di un file di log."""
    log_path = os.path.join(os.getenv('LOGS_PATH'), secure_filename(log_file))
    
    if not os.path.exists(log_path):
        return jsonify({'success': False, 'error': 'File di log non trovato'}), 404
    
    with open(log_path, 'r') as f:
        log_content = f.readlines()
    
    return jsonify({'success': True, 'content': log_content})

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    """Gestisce la connessione di un client WebSocket."""
    logger.info(f"Client connesso: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """Gestisce la disconnessione di un client WebSocket."""
    logger.info(f"Client disconnesso: {request.sid}")

@socketio.on('request_updates')
def handle_update_request(data):
    """Gestisce la richiesta di aggiornamenti da un client."""
    user_phone = data.get('user_phone')
    if user_phone:
        # Invia aggiornamenti specifici per l'utente
        emit('update', {'type': 'user_status', 'data': user_manager.get_user_status(user_phone)})

# Funzione iniziale per avviare le sessioni salvate
def start_saved_sessions():
    """Avvia le sessioni Telegram salvate."""
    logger.info("Avvio delle sessioni Telegram salvate...")
    try:
        user_manager.restore_all_sessions()
        logger.info("Sessioni ripristinate con successo")
    except Exception as e:
        logger.error(f"Errore nel ripristino delle sessioni: {e}")

if __name__ == '__main__':
    # Avvia le sessioni salvate
    start_saved_sessions()
    
    # Avvia il server Flask con SocketIO
    host = os.getenv('HOST', '127.0.0.1')  # Usa 127.0.0.1 invece di 0.0.0.0 o localhost
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Avvio dell'applicazione su {host}:{port}, debug={debug}")
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)