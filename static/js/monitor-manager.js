/**
 * monitor-manager.js
 * Gestione del monitoraggio messaggi per l'applicazione Telegram Manager
 */

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
        if (!userPhone) {
            showNotification('Errore', 'Seleziona un utente per il monitoraggio', 'danger');
            return;
        }
        
        // Mostra spinner
        showSpinner("Avvio monitoraggio", "Avvio monitoraggio dei messaggi in corso...");
        
        // Esegui richiesta API
        fetch('/api/monitor/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_phone: userPhone,
                group_ids: groupIds
            })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Monitoraggio avviato con successo
                    showNotification('Successo', 'Monitoraggio avviato con successo', 'success');
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante l\'avvio del monitoraggio', 'danger');
                }
            })
            .catch(error => {
                // Nascondi spinner
                hideSpinner();
                
                console.error('Errore nella richiesta API:', error);
                showNotification('Errore', 'Si è verificato un errore durante la connessione al server', 'danger');
            });
    } catch (e) {
        hideSpinner();
        console.error("Errore nell'avvio del monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio del monitoraggio', 'danger');
    }
}

// Ferma monitoraggio
function stopMonitoring(userPhone) {
    try {
        if (!userPhone) return;
        
        // Mostra spinner
        showSpinner("Arresto monitoraggio", "Arresto monitoraggio dei messaggi in corso...");
        
        // Esegui richiesta API
        fetch('/api/monitor/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_phone: userPhone
            })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Monitoraggio fermato con successo
                    showNotification('Successo', 'Monitoraggio fermato con successo', 'success');
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante l\'arresto del monitoraggio', 'danger');
                }
            })
            .catch(error => {
                // Nascondi spinner
                hideSpinner();
                
                console.error('Errore nella richiesta API:', error);
                showNotification('Errore', 'Si è verificato un errore durante la connessione al server', 'danger');
            });
    } catch (e) {
        hideSpinner();
        console.error("Errore nell'arresto del monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'arresto del monitoraggio', 'danger');
    }
}

// Aggiorna Media Status when monitored
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

// Esporta funzioni
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.updateMonitoringStatus = updateMonitoringStatus;
window.updateMediaStatus = updateMediaStatus;
window.appendToMessageLog = appendToMessageLog;
window.appendToMediaGrid = appendToMediaGrid;
window.loadActiveMonitors = loadActiveMonitors;