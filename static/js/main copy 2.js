// Inizializzazione quando il documento è pronto
document.addEventListener("DOMContentLoaded", function() {
    console.log("Documento caricato, inizializzazione applicazione...");
    
    // Inizializza componenti Bootstrap
    initBootstrapComponents();
    
    // Inizializza Socket.IO
    initSocketIO();
    
    // Inizializza le impostazioni dell'applicazione
    initSettings();
    
    // Inizializza gestore eventi UI
    initUIEventHandlers();
    
    // Inizializza notifiche
    initNotifications();
    
    // Carica script specifici per la pagina corrente
    loadPageSpecificScripts();
    
    console.log("Inizializzazione completata");
});

// Inizializza componenti Bootstrap
function initBootstrapComponents() {
    try {
        // Inizializza tooltips
        var tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        if (tooltipTriggerList.length > 0) {
            tooltipTriggerList.forEach(function(tooltipTriggerEl) {
                new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
        
        // Inizializza popovers
        var popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        if (popoverTriggerList.length > 0) {
            popoverTriggerList.forEach(function(popoverTriggerEl) {
                new bootstrap.Popover(popoverTriggerEl);
            });
        }
        
        console.log("Componenti Bootstrap inizializzati");
    } catch (e) {
        console.error("Errore nell'inizializzazione dei componenti Bootstrap:", e);
    }
}

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
        
        // Gestisci eventi di aggiornamento
        socket.on('update', function(data) {
            console.log('Ricevuto aggiornamento:', data);
            handleUpdate(data);
        });
        
        // Gestisci eventi di monitoraggio
        socket.on('monitor_started', function(data) {
            console.log('Monitoraggio avviato:', data);
            showNotification('Monitoraggio avviato', `Avviato monitoraggio per l'utente ${data.user_phone}`);
            updateMonitoringStatus(data);
        });
        
        socket.on('monitor_stopped', function(data) {
            console.log('Monitoraggio fermato:', data);
            showNotification('Monitoraggio fermato', `Fermato monitoraggio per l'utente ${data.user_phone}`);
            updateMonitoringStatus(data, false);
        });
        
        // Gestisci eventi di download
        socket.on('download_started', function(data) {
            console.log('Download avviato:', data);
            showNotification('Download avviato', `Avviato download per il gruppo ${data.group_name}`);
            updateDownloadStatus(data);
        });
        
        socket.on('download_progress', function(data) {
            console.log('Progresso download:', data);
            updateDownloadProgress(data);
        });
        
        socket.on('download_completed', function(data) {
            console.log('Download completato:', data);
            showNotification('Download completato', `Completato download per il gruppo ${data.group_name}`);
            updateDownloadStatus(data, 'completed');
        });
        
        socket.on('download_error', function(data) {
            console.error('Errore download:', data);
            showNotification('Errore download', `Errore nel download per il gruppo: ${data.error}`, 'danger');
            updateDownloadStatus(data, 'error');
        });
        
        // Gestisci eventi di archiviazione
        socket.on('archive_started', function(data) {
            console.log('Archiviazione avviata:', data);
            showNotification('Archiviazione avviata', `Avviata archiviazione per il gruppo ${data.group_name}`);
            updateArchiveStatus(data);
        });
        
        socket.on('archive_scanning', function(data) {
            console.log('Scansione archivio:', data);
            updateArchiveProgress(data, 'scanning');
        });
        
        socket.on('archive_progress', function(data) {
            console.log('Progresso archiviazione:', data);
            updateArchiveProgress(data, 'downloading');
        });
        
        socket.on('archive_completed', function(data) {
            console.log('Archiviazione completata:', data);
            showNotification('Archiviazione completata', `Completata archiviazione per il gruppo ${data.group_name}`);
            updateArchiveStatus(data, 'completed');
        });
        
        socket.on('archive_error', function(data) {
            console.error('Errore archiviazione:', data);
            showNotification('Errore archiviazione', `Errore nell'archiviazione per il gruppo: ${data.error}`, 'danger');
            updateArchiveStatus(data, 'error');
        });
        
        // Gestisci eventi di media
        socket.on('private_media_saved', function(data) {
            console.log('Media privato salvato:', data);
            showNotification('Media privato salvato', `Salvato media da ${data.sender}`);
            updateMediaStatus(data, 'private');
        });
        
        socket.on('group_media_saved', function(data) {
            console.log('Media di gruppo salvato:', data);
            showNotification('Media di gruppo salvato', `Salvato media dal gruppo ${data.group_name}`);
            updateMediaStatus(data, 'group');
        });
        
        console.log("Socket.IO inizializzato");
    } catch (e) {
        console.error("Errore nell'inizializzazione di Socket.IO:", e);
    }
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

// Gestisci aggiornamenti
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

// Aggiorna lo stato dell'utente
function updateUserStatus(userData) {
    try {
        if (!userData || !userData.phone) return;
        
        const userCard = document.querySelector(`.user-card[data-phone="${userData.phone}"]`);
        if (!userCard) return;
        
        const statusIndicator = userCard.querySelector('.user-status');
        if (statusIndicator) {
            statusIndicator.classList.remove('online', 'offline');
            statusIndicator.classList.add(userData.connected ? 'online' : 'offline');
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato utente:", e);
    }
}

// Aggiorna la lista dei gruppi
function updateGroupList(groups) {
    try {
        const groupsContainer = document.getElementById('groupsContainer');
        if (!groupsContainer) return;
        
        // Svuota il container
        groupsContainer.innerHTML = '';
        
        if (!groups || groups.length === 0) {
            groupsContainer.innerHTML = '<div class="alert alert-info">Nessun gruppo trovato</div>';
            return;
        }
        
        // Crea elemento row per le card
        const row = document.createElement('div');
        row.className = 'row';
        
        // Aggiungi ogni gruppo
        groups.forEach(group => {
            const groupCard = createGroupCard(group);
            row.appendChild(groupCard);
        });
        
        groupsContainer.appendChild(row);
    } catch (e) {
        console.error("Errore nell'aggiornamento della lista gruppi:", e);
    }
}

// Crea una card per un gruppo
function createGroupCard(group) {
    try {
        if (!group || !group.id) return document.createElement('div');
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'col-md-4 mb-3';
        
        groupDiv.innerHTML = `
            <div class="card group-card" data-group-id="${group.id}">
                <div class="card-header d-flex align-items-center">
                    <div class="group-icon">
                        <i class="bi bi-${group.entity_type === 'channel' ? 'broadcast' : 'people-fill'}"></i>
                    </div>
                    <h5 class="card-title mb-0">${group.title || 'Gruppo senza nome'}</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">
                        <small class="text-muted">
                            ${group.members_count || 0} membri
                            ${group.unread_count > 0 ? `<span class="badge bg-danger">${group.unread_count} non letti</span>` : ''}
                        </small>
                    </p>
                    <div class="d-grid gap-2">
                        <button class="btn btn-sm btn-primary btn-monitor" data-group-id="${group.id}">
                            <i class="bi bi-broadcast"></i> Monitora
                        </button>
                        <button class="btn btn-sm btn-success btn-download" data-group-id="${group.id}">
                            <i class="bi bi-cloud-download"></i> Download
                        </button>
                        <button class="btn btn-sm btn-info btn-archive" data-group-id="${group.id}">
                            <i class="bi bi-archive"></i> Archivia
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi event listener per i pulsanti
        const monitorBtn = groupDiv.querySelector('.btn-monitor');
        const downloadBtn = groupDiv.querySelector('.btn-download');
        const archiveBtn = groupDiv.querySelector('.btn-archive');
        
        if (monitorBtn) {
            monitorBtn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                startMonitoring(groupId);
            });
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                startDownload(groupId);
            });
        }
        
        if (archiveBtn) {
            archiveBtn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                startArchive(groupId);
            });
        }
        
        return groupDiv;
    } catch (e) {
        console.error("Errore nella creazione della card gruppo:", e);
        return document.createElement('div');
    }
}

// Aggiorna lo stato del monitoraggio
function updateMonitoringStatus(data, isActive = true) {
    try {
        const monitoringContainer = document.getElementById('monitoringContainer');
        if (!monitoringContainer) return;
        
        if (isActive && data && data.user_phone) {
            // Aggiungi o aggiorna elemento di monitoraggio
            let monitorItem = document.querySelector(`.monitor-item[data-user="${data.user_phone}"]`);
            
            if (!monitorItem) {
                monitorItem = document.createElement('div');
                monitorItem.className = 'monitor-item card mb-3 fade-in';
                monitorItem.dataset.user = data.user_phone;
                monitoringContainer.appendChild(monitorItem);
                
                // Rimuovi il messaggio "nessun monitoraggio attivo" se presente
                const noMonitorMsg = monitoringContainer.querySelector('.alert.alert-info');
                if (noMonitorMsg) {
                    noMonitorMsg.remove();
                }
            }
            
            monitorItem.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">
                        <i class="bi bi-broadcast"></i> Monitoraggio: ${data.user_phone}
                    </h5>
                    <button class="btn btn-sm btn-danger btn-stop-monitor" data-user="${data.user_phone}">
                        <i class="bi bi-stop-circle"></i> Stop
                    </button>
                </div>
                <div class="card-body">
                    <p>Gruppi monitorati: ${(data.group_ids && data.group_ids.length) || 0}</p>
                    <p>Avviato: ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
                </div>
            `;
            
            // Aggiungi event listener per il pulsante di stop
            const stopBtn = monitorItem.querySelector('.btn-stop-monitor');
            if (stopBtn) {
                stopBtn.addEventListener('click', function() {
                    const userPhone = this.dataset.user;
                    stopMonitoring(userPhone);
                });
            }
        } else if (!isActive && data && data.user_phone) {
            // Rimuovi elemento di monitoraggio
            const monitorItem = document.querySelector(`.monitor-item[data-user="${data.user_phone}"]`);
            if (monitorItem) {
                monitorItem.classList.add('fade-out');
                setTimeout(() => {
                    monitorItem.remove();
                    
                    // Se non ci sono più monitoraggi attivi, mostra messaggio
                    if (monitoringContainer.querySelectorAll('.monitor-item').length === 0) {
                        monitoringContainer.innerHTML = '<div class="alert alert-info">Nessun monitoraggio attivo</div>';
                    }
                }, 500);
            }
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato di monitoraggio:", e);
    }
}

// Aggiorna lo stato del download
function updateDownloadStatus(data, status = 'in_progress') {
    try {
        if (!data || !data.task_id) return;
        
        const downloadsContainer = document.getElementById('downloadsContainer');
        if (!downloadsContainer) return;
        
        let downloadItem = document.querySelector(`.download-item[data-task-id="${data.task_id}"]`);
        
        if (!downloadItem) {
            downloadItem = document.createElement('div');
            downloadItem.className = 'download-item card mb-3 fade-in';
            downloadItem.dataset.taskId = data.task_id;
            downloadsContainer.appendChild(downloadItem);
            
            // Rimuovi il messaggio "nessun download in corso" se presente
            const noDownloadsMsg = downloadsContainer.querySelector('.alert.alert-info');
            if (noDownloadsMsg) {
                noDownloadsMsg.remove();
            }
        }
        
        // Aggiorna contenuto in base allo stato
        let statusBadge = '';
        let progressBar = '';
        
        switch (status) {
            case 'in_progress':
                statusBadge = '<span class="badge bg-primary">In corso</span>';
                progressBar = `
                    <div class="progress">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: 0%" 
                             aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                    </div>
                    <p class="text-center mt-1">0/0 media scaricati</p>
                `;
                break;
            case 'completed':
                statusBadge = '<span class="badge bg-success">Completato</span>';
                progressBar = `
                    <div class="progress">
                        <div class="progress-bar bg-success" 
                             role="progressbar" style="width: 100%" 
                             aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">100%</div>
                    </div>
                    <p class="text-center mt-1">${data.downloaded_media || 0}/${data.total_media || 0} media scaricati</p>
                `;
                break;
            case 'error':
                statusBadge = '<span class="badge bg-danger">Errore</span>';
                progressBar = `
                    <div class="alert alert-danger mt-2">
                        ${data.error || 'Si è verificato un errore durante il download'}
                    </div>
                `;
                break;
        }
        
        downloadItem.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-cloud-download"></i> Download: ${data.group_name || 'Gruppo'}
                </h5>
                ${statusBadge}
            </div>
            <div class="card-body">
                <p>Utente: ${data.user_phone || 'N/D'}</p>
                <p>Avviato: ${new Date(data.timestamp || data.start_time || Date.now()).toLocaleString()}</p>
                ${progressBar}
            </div>
        `;
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato di download:", e);
    }
}

// Aggiorna il progresso del download
function updateDownloadProgress(data) {
    try {
        if (!data || !data.task_id) return;
        
        const downloadItem = document.querySelector(`.download-item[data-task-id="${data.task_id}"]`);
        if (!downloadItem) return;
        
        const progressBar = downloadItem.querySelector('.progress-bar');
        const progressText = downloadItem.querySelector('.text-center');
        
        if (progressBar) {
            const progress = data.progress || 0;
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
            progressBar.textContent = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${data.downloaded_media || 0}/${data.total_media || 0} media scaricati`;
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento del progresso di download:", e);
    }
}

// Aggiorna lo stato dell'archivio
function updateArchiveStatus(data, status = 'in_progress') {
    try {
        if (!data || !data.task_id) return;
        
        const archivesContainer = document.getElementById('archivesContainer');
        if (!archivesContainer) return;
        
        let archiveItem = document.querySelector(`.archive-item[data-task-id="${data.task_id}"]`);
        
        if (!archiveItem) {
            archiveItem = document.createElement('div');
            archiveItem.className = 'archive-item card mb-3 fade-in';
            archiveItem.dataset.taskId = data.task_id;
            archivesContainer.appendChild(archiveItem);
            
            // Rimuovi il messaggio "nessun archivio in corso" se presente
            const noArchivesMsg = archivesContainer.querySelector('.alert.alert-info');
            if (noArchivesMsg) {
                noArchivesMsg.remove();
            }
        }
        
        // Aggiorna contenuto in base allo stato
        let statusBadge = '';
        let progressBar = '';
        
        switch (status) {
            case 'in_progress':
                statusBadge = '<span class="badge bg-primary">In corso</span>';
                progressBar = `
                    <div class="progress">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: 0%" 
                             aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                    </div>
                    <p class="text-center mt-1">Inizializzazione...</p>
                `;
                break;
            case 'completed':
                statusBadge = '<span class="badge bg-success">Completato</span>';
                progressBar = `
                    <div class="progress">
                        <div class="progress-bar bg-success" 
                             role="progressbar" style="width: 100%" 
                             aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">100%</div>
                    </div>
                    <p class="text-center mt-1">${data.archived_media || 0}/${data.total_media || 0} media archiviati</p>
                `;
                break;
            case 'error':
                statusBadge = '<span class="badge bg-danger">Errore</span>';
                progressBar = `
                    <div class="alert alert-danger mt-2">
                        ${data.error || 'Si è verificato un errore durante l\'archiviazione'}
                    </div>
                `;
                break;
        }
        
        archiveItem.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-archive"></i> Archivio: ${data.group_name || 'Gruppo'}
                </h5>
                ${statusBadge}
            </div>
            <div class="card-body">
                <p>Utente: ${data.user_phone || 'N/D'}</p>
                <p>Avviato: ${new Date(data.timestamp || data.start_time || Date.now()).toLocaleString()}</p>
                ${progressBar}
            </div>
        `;
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato dell'archivio:", e);
    }
}

// Aggiorna il progresso dell'archivio
function updateArchiveProgress(data, phase) {
    try {
        if (!data || !data.task_id) return;
        
        const archiveItem = document.querySelector(`.archive-item[data-task-id="${data.task_id}"]`);
        if (!archiveItem) return;
        
        const progressBar = archiveItem.querySelector('.progress-bar');
        const progressText = archiveItem.querySelector('.text-center');
        
        if (progressBar) {
            const progress = data.progress || 0;
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
            progressBar.textContent = `${progress}%`;
        }
        
        if (progressText) {
            if (phase === 'scanning') {
                progressText.textContent = `Scansione messaggi: ${data.processed_messages || 0}/${data.total_messages || 0}`;
            } else {
                progressText.textContent = `${data.archived_media || 0}/${data.total_media || 0} media archiviati`;
            }
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento del progresso dell'archivio:", e);
    }
}

// Aggiorna lo stato dei media
function updateMediaStatus(data, type) {
    try {
        // Aggiungi logica specifica per aggiornare l'UI quando vengono ricevuti nuovi media
        if (type === 'private') {
            // Per media privati
            appendToMessageLog(`Media privato ricevuto: ${data.media_type} da ${data.sender}`);
            appendToMediaGrid(data);
        } else if (type === 'group') {
            // Per media di gruppo
            appendToMessageLog(`Media di gruppo ricevuto: ${data.media_type} da ${data.group_name}`);
            appendToMediaGrid(data);
        }
    } catch (e) {
        console.error("Errore nell'aggiornamento dello stato dei media:", e);
    }
}

// Aggiungi messaggio al log
function appendToMessageLog(message) {
    try {
        const messagesContainer = document.getElementById('recentMessagesContainer');
        if (!messagesContainer) return;
        
        // Rimuovi messaggio iniziale se presente
        const initialMessage = messagesContainer.querySelector('.text-center.text-muted');
        if (initialMessage) {
            initialMessage.remove();
        }
        
        // Crea elemento per il messaggio
        const messageElement = document.createElement('div');
        messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        // Aggiungi al container
        messagesContainer.appendChild(messageElement);
        
        // Scroll alla fine del log
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Mostra sezione se nascosta
        const messagesSection = document.getElementById('recentMessagesSection');
        if (messagesSection) {
            messagesSection.style.display = 'block';
        }
    } catch (e) {
        console.error("Errore nell'aggiunta di un messaggio al log:", e);
    }
}

// Aggiungi media alla grid
function appendToMediaGrid(data) {
    try {
        const mediaContainer = document.getElementById('recentMediaContainer');
        if (!mediaContainer) return;
        
        // Crea elemento per il media
        const mediaElement = document.createElement('div');
        mediaElement.className = 'media-item';
        
        // Determina il tipo di media
        if (data.media_type === 'immagini' || data.media_type === 'image') {
            mediaElement.innerHTML = `
                <img src="/media/${data.path}" alt="Immagine">
                <div class="media-info">
                    <small>${new Date().toLocaleTimeString()}</small>
                    <p class="mb-0">${data.sender || data.group_name || 'Sconosciuto'}</p>
                </div>
            `;
        } else if (data.media_type === 'video') {
            mediaElement.innerHTML = `
                <video controls>
                    <source src="/media/${data.path}" type="video/mp4">
                    Il tuo browser non supporta il tag video.
                </video>
                <div class="media-info">
                    <small>${new Date().toLocaleTimeString()}</small>
                    <p class="mb-0">${data.sender || data.group_name || 'Sconosciuto'}</p>
                </div>
            `;
        } else {
            mediaElement.innerHTML = `
                <div class="media-placeholder">
                    <i class="bi bi-file-earmark"></i>
                </div>
                <div class="media-info">
                    <small>${new Date().toLocaleTimeString()}</small>
                    <p class="mb-0">${data.sender || data.group_name || 'Sconosciuto'}</p>
                </div>
            `;
        }
        
        // Aggiungi al container
        mediaContainer.appendChild(mediaElement);
        
        // Mostra sezione se nascosta
        const mediaSection = document.getElementById('recentMediaSection');
        if (mediaSection) {
            mediaSection.style.display = 'block';
        }
    } catch (e) {
        console.error("Errore nell'aggiunta di un media alla grid:", e);
    }
}

// Avvia monitoraggio gruppi
function startMonitoring(groupIds) {
    try {
        if (!groupIds) return;
        
        if (!Array.isArray(groupIds)) {
            groupIds = [groupIds];
        }
        
        const userPhoneInput = document.getElementById('monitorUserPhone');
        if (!userPhoneInput) {
            showNotification('Errore', 'Seleziona un utente per il monitoraggio', 'danger');
            return;
        }
        
        const userPhone = userPhoneInput.value.trim();
        if (!userPhone)// Inizializzazione quando il documento è pronto
            document.addEventListener("DOMContentLoaded", function() {
            initApp();
        });
    } catch (e) {
        console.error("Errore nell'aggiunta di un media alla grid:", e);
    }
}

// Funzione principale di inizializzazione
function initApp() {
    // Inizializza componenti Bootstrap
    initBootstrapComponents();
    
    // Inizializza Socket.IO
    initSocketIO();
    
    // Inizializza le impostazioni dell'applicazione
    initSettings();
    
    // Inizializza gestore eventi UI
    initUIEventHandlers();
    
    // Inizializza notifiche
    initNotifications();
    
    // Carica script specifici per la pagina corrente
    loadPageSpecificScripts();
}

// Inizializzazione componenti Bootstrap omessa per brevità...

// Inizializzazione Socket.IO omessa per brevità...

// Funzioni di aggiornamento UI omesse per brevità...

// Inizializzazione notifiche omessa per brevità...

// Carica script specifici per la pagina corrente
function loadPageSpecificScripts() {
    // Ottieni il nome della pagina corrente
    const path = window.location.pathname;
    
    switch (path) {
        case '/':
            initDashboardPage();
            break;
        case '/users':
            initUsersPage();
            break;
        case '/groups':
            initGroupsPage();
            break;
        case '/monitor':
            initMonitorPage();
            break;
        case '/download':
            initDownloadPage();
            break;
        case '/archive':
            initArchivePage();
            break;
        case '/logs':
            initLogsPage();
            break;
    }
}

// Inizializza pagina logs
function initLogsPage() {
    console.log('Inizializzazione pagina logs');
    
    // Aggiungi event listener per select file di log
    const logFileSelect = document.getElementById('logFileSelect');
    if (logFileSelect) {
        logFileSelect.addEventListener('change', function() {
            const selectedFile = this.value;
            if (selectedFile) {
                // Aggiorna URL con parametro file
                const url = new URL(window.location.href);
                url.searchParams.set('file', selectedFile);
                window.history.replaceState({}, '', url);
                
                // Carica contenuto del file di log
                loadLogContent(selectedFile);
            }
        });
    }
    
    // Aggiungi event listener per filtro log
    const logFilterInput = document.getElementById('logFilter');
    if (logFilterInput) {
        logFilterInput.addEventListener('input', function() {
            filterLogContent(this.value);
        });
    }
    
    // Aggiungi event listener per pulsante refresh
    const refreshLogBtn = document.getElementById('refreshLogBtn');
    if (refreshLogBtn) {
        refreshLogBtn.addEventListener('click', function() {
            const logFileSelect = document.getElementById('logFileSelect');
            if (logFileSelect && logFileSelect.value) {
                loadLogContent(logFileSelect.value);
            }
        });
    }
    
    // Aggiungi event listener per pulsante download
    const downloadLogBtn = document.getElementById('downloadLogBtn');
    if (downloadLogBtn) {
        downloadLogBtn.addEventListener('click', function() {
            const logFileSelect = document.getElementById('logFileSelect');
            if (logFileSelect && logFileSelect.value) {
                downloadLogFile(logFileSelect.value);
            }
        });
    }
    
    // Carica contenuto del log iniziale se presente nella URL
    const urlParams = new URLSearchParams(window.location.search);
    const logFile = urlParams.get('file');
    if (logFile) {
        // Seleziona file nella select
        if (logFileSelect) {
            logFileSelect.value = logFile;
        }
        
        // Carica contenuto
        loadLogContent(logFile);
    }
}

// Carica contenuto del file di log
function loadLogContent(logFile) {
    // Mostra spinner
    const logViewer = document.getElementById('logViewer');
    if (logViewer) {
        logViewer.innerHTML = `
            <div class="spinner-container">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
    }
    
    // Esegui richiesta API
    fetch(`/api/logs/${logFile}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna contenuto log viewer
                if (logViewer) {
                    // Formatta contenuto come pre
                    logViewer.innerHTML = `<pre>${data.content.join('')}</pre>`;
                    
                    // Applica filtro corrente
                    const logFilterInput = document.getElementById('logFilter');
                    if (logFilterInput && logFilterInput.value) {
                        filterLogContent(logFilterInput.value);
                    }
                    
                    // Scroll alla fine del log
                    logViewer.scrollTop = logViewer.scrollHeight;
                }
            } else {
                if (logViewer) {
                    logViewer.innerHTML = `
                        <div class="alert alert-danger">
                            Errore nel caricamento del file di log: ${data.error || 'Errore sconosciuto'}
                        </div>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento del file di log:', error);
            if (logViewer) {
                logViewer.innerHTML = `
                    <div class="alert alert-danger">
                        Errore nel caricamento del file di log: ${error.message}
                    </div>
                `;
            }
        });
}

// Filtra contenuto del log
function filterLogContent(filter) {
    const logViewer = document.getElementById('logViewer');
    const pre = logViewer ? logViewer.querySelector('pre') : null;
    
    if (!pre) return;
    
    // Se filtro vuoto, mostra tutto
    if (!filter) {
        pre.querySelectorAll('span').forEach(span => {
            span.style.display = '';
        });
        
        // Ripristina testo originale
        if (pre.dataset.originalContent) {
            pre.innerHTML = pre.dataset.originalContent;
            delete pre.dataset.originalContent;
        }
        
        return;
    }
    
    // Salva contenuto originale se non già salvato
    if (!pre.dataset.originalContent) {
        pre.dataset.originalContent = pre.innerHTML;
    }
    
    // Leggi contenuto originale
    const lines = pre.dataset.originalContent.split('\n');
    
    // Filtra le righe
    const filteredLines = lines.map(line => {
        if (line.toLowerCase().includes(filter.toLowerCase())) {
            return `<span class="log-highlight">${line}</span>`;
        } else {
            return `<span class="log-hidden">${line}</span>`;
        }
    });
    
    // Aggiorna contenuto
    pre.innerHTML = filteredLines.join('\n');
    
    // Nascondi righe che non contengono il filtro
    pre.querySelectorAll('.log-hidden').forEach(span => {
        span.style.display = 'none';
    });
}

// Scarica file di log
function downloadLogFile(logFile) {
    // Crea URL di download
    const downloadUrl = `/api/logs/${logFile}/download`;
    
    // Crea elemento a temporaneo per il download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = logFile;
    a.style.display = 'none';
    
    // Aggiungi al DOM, clicca e rimuovi
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Inizializza pagina dashboard
function initDashboardPage() {
    console.log('Inizializzazione pagina dashboard');
    
    // Carica statistiche
    loadDashboardStats();
    
    // Carica informazioni utenti attivi
    loadActiveUsers();
    
    // Carica informazioni monitoraggi attivi
    loadActiveMonitors();
    
    // Carica informazioni download in corso
    loadActiveDownloads();
    
    // Aggiorna periodicamente le informazioni
    setInterval(function() {
        loadDashboardStats();
        loadActiveUsers();
        loadActiveMonitors();
        loadActiveDownloads();
    }, 30000); // Aggiorna ogni 30 secondi
}

// Carica statistiche dashboard
function loadDashboardStats() {
    fetch('/api/dashboard/stats')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna statistiche nella UI
                updateDashboardStats(data.stats);
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento delle statistiche:', error);
        });
}

// Aggiorna statistiche dashboard nella UI
function updateDashboardStats(stats) {
    // Aggiorna contatori
    document.getElementById('usersCount').textContent = stats.users_count || 0;
    document.getElementById('groupsCount').textContent = stats.groups_count || 0;
    document.getElementById('monitorCount').textContent = stats.monitors_count || 0;
    document.getElementById('downloadCount').textContent = stats.downloads_count || 0;
    document.getElementById('archiveCount').textContent = stats.archives_count || 0;
    
    // Aggiorna statistiche media
    document.getElementById('totalMedia').textContent = formatNumber(stats.total_media || 0);
    document.getElementById('totalImages').textContent = formatNumber(stats.total_images || 0);
    document.getElementById('totalVideos').textContent = formatNumber(stats.total_videos || 0);
    document.getElementById('totalSize').textContent = formatBytes(stats.total_size || 0);
}

// Formatta numero con separatore migliaia
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Formatta bytes in formato leggibile
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Carica utenti attivi
function loadActiveUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            // Aggiorna lista utenti attivi nella UI
            updateActiveUsersList(users);
        })
        .catch(error => {
            console.error('Errore nel caricamento degli utenti attivi:', error);
        });
}

// Aggiorna lista utenti attivi nella UI
function updateActiveUsersList(users) {
    const activeUsersContainer = document.getElementById('activeUsersContainer');
    if (!activeUsersContainer) return;
    
    // Svuota container
    activeUsersContainer.innerHTML = '';
    
    if (users.length === 0) {
        activeUsersContainer.innerHTML = '<div class="alert alert-info">Nessun utente attivo</div>';
        return;
    }
    
    // Crea lista utenti
    const row = document.createElement('div');
    row.className = 'row';
    
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'col-md-4 mb-3';
        userCard.innerHTML = `
            <div class="card user-card">
                <div class="card-header d-flex align-items-center">
                    <div class="user-avatar">
                        <i class="bi bi-person"></i>
                    </div>
                    <h5 class="card-title mb-0">${user.first_name} ${user.last_name || ''}</h5>
                    <div class="user-status ${user.connected ? 'online' : 'offline'}"></div>
                </div>
                <div class="card-body">
                    <p class="card-text">
                        <i class="bi bi-phone"></i> ${user.phone}<br>
                        <i class="bi bi-person-badge"></i> ${user.username || 'N/D'}
                    </p>
                </div>
            </div>
        `;
        
        row.appendChild(userCard);
    });
    
    activeUsersContainer.appendChild(row);
}

// Carica monitoraggi attivi
function loadActiveMonitors() {
    fetch('/api/monitor/active')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna lista monitoraggi attivi nella UI
                updateActiveMonitorsList(data.monitors);
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dei monitoraggi attivi:', error);
        });
}

// Aggiorna lista monitoraggi attivi nella UI
function updateActiveMonitorsList(monitors) {
    const activeMonitorsContainer = document.getElementById('activeMonitorsContainer');
    if (!activeMonitorsContainer) return;
    
    // Svuota container
    activeMonitorsContainer.innerHTML = '';
    
    if (Object.keys(monitors).length === 0) {
        activeMonitorsContainer.innerHTML = '<div class="alert alert-info">Nessun monitoraggio attivo</div>';
        return;
    }
    
    // Crea lista monitoraggi
    for (const [userPhone, groupIds] of Object.entries(monitors)) {
        const monitorItem = document.createElement('div');
        monitorItem.className = 'card mb-3';
        monitorItem.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-broadcast"></i> ${userPhone}
                </h5>
                <button class="btn btn-sm btn-danger btn-stop-monitor" data-user="${userPhone}">
                    <i class="bi bi-stop-circle"></i> Stop
                </button>
            </div>
            <div class="card-body">
                <p>Gruppi monitorati: ${groupIds.length}</p>
            </div>
        `;
        
        // Aggiungi event listener per il pulsante di stop
        const stopBtn = monitorItem.querySelector('.btn-stop-monitor');
        if (stopBtn) {
            stopBtn.addEventListener('click', function() {
                const userPhone = this.dataset.user;
                stopMonitoring(userPhone);
            });
        }
        
        activeMonitorsContainer.appendChild(monitorItem);
    }
}

// Carica download in corso
function loadActiveDownloads() {
    fetch('/api/download/active')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna lista download in corso nella UI
                updateActiveDownloadsList(data.downloads);
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dei download in corso:', error);
        });
}

// Aggiorna lista download in corso nella UI
function updateActiveDownloadsList(downloads) {
    const activeDownloadsContainer = document.getElementById('activeDownloadsContainer');
    if (!activeDownloadsContainer) return;
    
    // Svuota container
    activeDownloadsContainer.innerHTML = '';
    
    if (Object.keys(downloads).length === 0) {
        activeDownloadsContainer.innerHTML = '<div class="alert alert-info">Nessun download in corso</div>';
        return;
    }
    
    // Crea lista download
    for (const [taskId, download] of Object.entries(downloads)) {
        const downloadItem = document.createElement('div');
        downloadItem.className = 'card mb-3';
        downloadItem.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-cloud-download"></i> ${download.group_name}
                </h5>
                <span class="badge ${download.status === 'completed' ? 'bg-success' : download.status === 'error' ? 'bg-danger' : 'bg-primary'}">
                    ${download.status === 'completed' ? 'Completato' : download.status === 'error' ? 'Errore' : 'In corso'}
                </span>
            </div>
            <div class="card-body">
                <p>Utente: ${download.user_phone}</p>
                <p>Avviato: ${new Date(download.start_time).toLocaleString()}</p>
                <div class="progress">
                    <div class="progress-bar ${download.status === 'completed' ? 'bg-success' : download.status === 'error' ? 'bg-danger' : 'progress-bar-striped progress-bar-animated'}" 
                         role="progressbar" style="width: ${download.progress}%" 
                         aria-valuenow="${download.progress}" aria-valuemin="0" aria-valuemax="100">${download.progress}%</div>
                </div>
                <p class="text-center mt-1">${download.downloaded_media || 0}/${download.total_media || 0} media ${download.status === 'completed' ? 'scaricati' : 'scaricati finora'}</p>
            </div>
        `;
        
        activeDownloadsContainer.appendChild(downloadItem);
    }
}

// Inizializza pagina utenti
function initUsersPage() {
    console.log('Inizializzazione pagina utenti');
    
    // Aggiungi event listener per pulsante aggiungi utente
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', addUser);
    }
    
    // Aggiungi event listener per pulsanti rimuovi utente
    const removeUserBtns = document.querySelectorAll('.btn-remove-user');
    removeUserBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const phone = this.dataset.phone;
            showConfirmationModal(
                'Rimuovere utente',
                `Sei sicuro di voler rimuovere l'utente ${phone}?`,
                () => removeUser(phone)
            );
        });
    });
}
