/**
 * archive-manager.js
 * Gestione dell'archiviazione dei gruppi Telegram
 */

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
        let actions = '';
        
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
                actions = `
                    <div class="d-grid gap-2 mt-3">
                        <a href="/archivio/${data.group_dir_name || `${data.group_name}-${data.group_id}`}" class="btn btn-sm btn-success" target="_blank">
                            <i class="bi bi-folder"></i> Apri archivio
                        </a>
                    </div>
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
                ${actions}
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

// Avvia archiviazione
function startArchive(groupId, mediaTypes, limit) {
    try {
        if (!groupId) return;
        
        // Se mediaTypes non è specificato, ottienilo dalla UI
        if (!mediaTypes) {
            mediaTypes = [];
            if (document.getElementById('archivePhoto') && document.getElementById('archivePhoto').checked) {
                mediaTypes.push('photo');
            }
            if (document.getElementById('archiveVideo') && document.getElementById('archiveVideo').checked) {
                mediaTypes.push('video');
            }
        }
        
        // Se il limite non è specificato, ottienilo dalla UI
        if (!limit && document.getElementById('archiveLimit')) {
            limit = parseInt(document.getElementById('archiveLimit').value) || 0;
        }
        
        // Ottieni utente selezionato
        const userPhoneInput = document.getElementById('archiveUserPhone');
        if (!userPhoneInput) {
            showNotification('Errore', 'Seleziona un utente per l\'archiviazione', 'danger');
            return;
        }
        
        const userPhone = userPhoneInput.value.trim();
        if (!userPhone) {
            showNotification('Errore', 'Seleziona un utente per l\'archiviazione', 'danger');
            return;
        }
        
        // Mostra spinner
        showSpinner("Avvio archiviazione", "Avvio archiviazione dei media in corso...");
        
        // Esegui richiesta API
        fetch('/api/archive/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_phone: userPhone,
                group_id: groupId,
                media_types: mediaTypes,
                limit: limit
            })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Archiviazione avviata con successo
                    showNotification('Successo', 'Archiviazione avviata con successo', 'success');
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante l\'avvio dell\'archiviazione', 'danger');
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
        console.error("Errore nell'avvio dell'archiviazione:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio dell\'archiviazione', 'danger');
    }
}

// Carica archivi disponibili
function loadAvailableArchives() {
    const archivesContainer = document.getElementById('availableArchivesContainer');
    
    if (archivesContainer) {
        // Mostra spinner
        archivesContainer.innerHTML = `
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
        
        // Esegui richiesta API
        fetch('/api/archive/all')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const archives = data.archives;
                    
                    if (archives.length === 0) {
                        archivesContainer.innerHTML = `
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i> Nessun archivio disponibile. Crea un nuovo archivio utilizzando il form qui sopra.
                            </div>
                        `;
                    } else {
                        // Crea grid di card per gli archivi
                        archivesContainer.innerHTML = `<div class="row">`;
                        
                        archives.forEach(archive => {
                            const archiveCard = `
                                <div class="col-md-4 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <h5 class="card-title mb-0">
                                                <i class="bi bi-archive"></i> ${archive.group_dir_name.split('-')[0]}
                                            </h5>
                                            <span class="badge bg-info">${archive.total_media} media</span>
                                        </div>
                                        <div class="card-body">
                                            <p><i class="bi bi-calendar"></i> Creato: ${new Date(archive.creation_date).toLocaleString()}</p>
                                            <p>
                                                <i class="bi bi-image"></i> Immagini: ${archive.images_count}<br>
                                                <i class="bi bi-film"></i> Video: ${archive.videos_count}
                                            </p>
                                            <p><i class="bi bi-hdd"></i> Dimensione: ${formatBytes(archive.total_size)}</p>
                                            <div class="d-grid gap-2">
                                                <a href="/archivio/${archive.group_dir_name}" class="btn btn-sm btn-primary" target="_blank">
                                                    <i class="bi bi-folder"></i> Apri archivio
                                                </a>
                                                <button type="button" class="btn btn-sm btn-danger btn-delete-archive" data-archive-id="${archive.group_dir_name}">
                                                    <i class="bi bi-trash"></i> Elimina
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                            
                            archivesContainer.innerHTML += archiveCard;
                        });
                        
                        archivesContainer.innerHTML += `</div>`;
                        
                        // Aggiungi event listener per pulsanti elimina
                        document.querySelectorAll('.btn-delete-archive').forEach(btn => {
                            btn.addEventListener('click', function() {
                                const archiveId = this.dataset.archiveId;
                                deleteArchive(archiveId);
                            });
                        });
                    }
                } else {
                    archivesContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle"></i> Errore nel caricamento degli archivi.
                            ${data.error || ''}
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento degli archivi:', error);
                
                archivesContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> Si è verificato un errore durante il caricamento degli archivi.
                    </div>
                `;
            });
    }
}

// Elimina un archivio
function deleteArchive(archiveId) {
    // Chiedi conferma
    showConfirmationModal(
        'Elimina archivio',
        'Sei sicuro di voler eliminare questo archivio? Tutti i file archiviati verranno eliminati definitivamente.',
        () => {
            // Mostra spinner
            showSpinner("Eliminazione archivio", "Eliminazione dell'archivio in corso...");
            
            // Esegui richiesta API
            fetch(`/api/archive/${archiveId}`, {
                method: 'DELETE'
            })
                .then(response => response.json())
                .then(data => {
                    // Nascondi spinner
                    hideSpinner();
                    
                    if (data.success) {
                        showNotification('Successo', 'Archivio eliminato con successo', 'success');
                        
                        // Aggiorna lista archivi
                        loadAvailableArchives();
                    } else {
                        showNotification('Errore', data.message || 'Errore nell\'eliminazione dell\'archivio', 'danger');
                    }
                })
                .catch(error => {
                    // Nascondi spinner
                    hideSpinner();
                    
                    console.error('Errore nell\'eliminazione dell\'archivio:', error);
                    showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione dell\'archivio', 'danger');
                });
        }
    );
}

// Esporta funzioni
window.startArchive = startArchive;
window.loadAvailableArchives = loadAvailableArchives;
window.deleteArchive = deleteArchive;
window.updateArchiveStatus = updateArchiveStatus;
window.updateArchiveProgress = updateArchiveProgress;