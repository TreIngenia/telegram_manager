/**
 * socket-manager.js
 * Gestione delle connessioni WebSocket per l'applicazione Telegram Manager
 */

// Inizializza Socket.IO
function initSocketIO() {
    try {
        // Crea connessione Socket.IO
        const socket = io();
        
        // Salva l'istanza di socket nell'oggetto window per uso globale
        window.socket = socket;
        
        // Gestisci eventi di connessione
        socket.on('connect', function() {
            console.log('Socket.IO connesso');
            updateSocketStatus('connected');
            
            // Richiedi aggiornamenti iniziali
            requestInitialUpdates();
        });
        
        socket.on('disconnect', function() {
            console.log('Socket.IO disconnesso');
            updateSocketStatus('disconnected');
        });
        
        socket.on('connect_error', function(error) {
            console.error('Errore di connessione Socket.IO:', error);
            updateSocketStatus('disconnected');
        });
        
        // Gestisci eventi di aggiornamento generici
        socket.on('update', function(data) {
            console.log('Ricevuto aggiornamento:', data);
            handleUpdate(data);
        });
        
        // Gestisci eventi di monitoraggio
        initMonitoringSocketEvents(socket);
        
        // Gestisci eventi di download
        initDownloadSocketEvents(socket);
        
        // Gestisci eventi di archiviazione
        initArchiveSocketEvents(socket);
        
        // Gestisci eventi di media
        initMediaSocketEvents(socket);
        
        console.log("Socket.IO inizializzato");
    } catch (e) {
        console.error("Errore nell'inizializzazione di Socket.IO:", e);
    }
}

// Inizializza eventi socket per monitoraggio
function initMonitoringSocketEvents(socket) {
    // Gestisci evento di avvio monitoraggio
    socket.on('monitor_started', function(data) {
        console.log('Monitoraggio avviato:', data);
        showNotification('Monitoraggio avviato', `Avviato monitoraggio per l'utente ${data.user_phone}`);
        updateMonitoringStatus(data);
    });
    
    // Gestisci evento di stop monitoraggio
    socket.on('monitor_stopped', function(data) {
        console.log('Monitoraggio fermato:', data);
        showNotification('Monitoraggio fermato', `Fermato monitoraggio per l'utente ${data.user_phone}`);
        updateMonitoringStatus(data, false);
    });
}

// Inizializza eventi socket per download
function initDownloadSocketEvents(socket) {
    // Gestisci evento di avvio download
    socket.on('download_started', function(data) {
        console.log('Download avviato:', data);
        showNotification('Download avviato', `Avviato download per il gruppo ${data.group_name}`);
        updateDownloadStatus(data);
    });
    
    // Gestisci evento di progresso download
    socket.on('download_progress', function(data) {
        console.log('Progresso download:', data);
        updateDownloadProgress(data);
    });
    
    // Gestisci evento di completamento download
    socket.on('download_completed', function(data) {
        console.log('Download completato:', data);
        showNotification('Download completato', `Completato download per il gruppo ${data.group_name}`);
        updateDownloadStatus(data, 'completed');
        
        // Aggiorna lista download completati se disponibile
        if (typeof loadCompletedDownloads === 'function') {
            setTimeout(loadCompletedDownloads, 1000);
        }
    });
    
    // Gestisci evento di errore download
    socket.on('download_error', function(data) {
        console.error('Errore download:', data);
        showNotification('Errore download', `Errore nel download per il gruppo: ${data.error}`, 'danger');
        updateDownloadStatus(data, 'error');
    });
}

// Inizializza eventi socket per archiviazione
function initArchiveSocketEvents(socket) {
    // Gestisci evento di avvio archiviazione
    socket.on('archive_started', function(data) {
        console.log('Archiviazione avviata:', data);
        showNotification('Archiviazione avviata', `Avviata archiviazione per il gruppo ${data.group_name}`);
        updateArchiveStatus(data);
    });
    
    // Gestisci evento di scansione archiviazione
    socket.on('archive_scanning', function(data) {
        console.log('Scansione archivio:', data);
        updateArchiveProgress(data, 'scanning');
    });
    
    // Gestisci evento di progresso archiviazione
    socket.on('archive_progress', function(data) {
        console.log('Progresso archiviazione:', data);
        updateArchiveProgress(data, 'downloading');
    });
    
    // Gestisci evento di completamento archiviazione
    socket.on('archive_completed', function(data) {
        console.log('Archiviazione completata:', data);
        showNotification('Archiviazione completata', `Completata archiviazione per il gruppo ${data.group_name}`);
        updateArchiveStatus(data, 'completed');
        
        // Aggiorna lista archivi se disponibile
        if (typeof loadAvailableArchives === 'function') {
            setTimeout(loadAvailableArchives, 1000);
        }
    });
    
    // Gestisci evento di errore archiviazione
    socket.on('archive_error', function(data) {
        console.error('Errore archiviazione:', data);
        showNotification('Errore archiviazione', `Errore nell'archiviazione per il gruppo: ${data.error}`, 'danger');
        updateArchiveStatus(data, 'error');
    });
}

// Inizializza eventi socket per media
function initMediaSocketEvents(socket) {
    // Gestisci evento di salvataggio media privato
    socket.on('private_media_saved', function(data) {
        console.log('Media privato salvato:', data);
        showNotification('Media privato salvato', `Salvato media da ${data.sender}`);
        updateMediaStatus(data, 'private');
    });
    
    // Gestisci evento di salvataggio media di gruppo
    socket.on('group_media_saved', function(data) {
        console.log('Media di gruppo salvato:', data);
        showNotification('Media di gruppo salvato', `Salvato media dal gruppo ${data.group_name}`);
        updateMediaStatus(data, 'group');
    });
}

// Aggiorna lo stato della connessione Socket.IO
function updateSocketStatus(status) {
    try {
        const wsStatus = document.getElementById('wsStatus');
        if (!wsStatus) return;
        
        wsStatus.className = 'badge';
        
        switch (status) {
            case 'connected':
                wsStatus.classList.add('bg-success');
                wsStatus.textContent = 'Connesso';
                break;
            case 'disconnected':
                wsStatus.classList.add('bg-danger');
                wsStatus.textContent = 'Disconnesso';
                break;
            case 'connecting':
                wsStatus.classList.add('bg-warning');
                wsStatus.textContent = 'Connessione...';
                break;
            default:
                wsStatus.classList.add('bg-secondary');
                wsStatus.textContent = 'Sconosciuto';
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato Socket.IO:", e);
    }
}

// Richiedi aggiornamenti iniziali
function requestInitialUpdates() {
    try {
        // Ottieni l'utente correntemente selezionato
        const selectedUser = document.querySelector('.user-card.selected');
        if (selectedUser) {
            const userPhone = selectedUser.dataset.phone;
            if (userPhone && window.socket) {
                window.socket.emit('request_updates', { user_phone: userPhone });
            }
        }
    } catch (e) {
        console.error("Errore nella richiesta di aggiornamenti iniziali:", e);
    }
}

// Gestisci aggiornamenti generici
function handleUpdate(data) {
    try {
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'user_status':
                updateUserStatus(data.data);
                break;
            case 'group_list':
                updateGroupList(data.data);
                break;
            case 'monitor_status':
                updateMonitoringStatus(data.data);
                break;
            case 'download_status':
                updateDownloadList(data.data);
                break;
            case 'archive_status':
                updateArchiveList(data.data);
                break;
            default:
                console.log('Tipo di aggiornamento non gestito:', data.type);
        }
    } catch (e) {
        console.error("Errore nella gestione dell'aggiornamento:", e);
    }
}

// Esporta funzioni
window.initSocketIO = initSocketIO;
window.updateSocketStatus = updateSocketStatus;