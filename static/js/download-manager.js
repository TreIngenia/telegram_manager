/**
 * download-manager.js
 * Gestione del download dei media dai gruppi Telegram
 */

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

// Avvia download media
function startDownload(groupId, mediaTypes, limit) {
    try {
        if (!groupId) return;
        
        // Se mediaTypes non è specificato, ottienilo dalla UI
        if (!mediaTypes) {
            mediaTypes = [];
            if (document.getElementById('downloadPhoto') && document.getElementById('downloadPhoto').checked) {
                mediaTypes.push('photo');
            }
            if (document.getElementById('downloadVideo') && document.getElementById('downloadVideo').checked) {
                mediaTypes.push('video');
            }
        }
        
        // Se il limite non è specificato, ottienilo dalla UI
        if (!limit && document.getElementById('downloadLimit')) {
            limit = parseInt(document.getElementById('downloadLimit').value) || 100;
        }
        
        // Ottieni utente selezionato
        const userPhoneInput = document.getElementById('downloadUserPhone');
        if (!userPhoneInput) {
            showNotification('Errore', 'Seleziona un utente per il download', 'danger');
            return;
        }
        
        const userPhone = userPhoneInput.value.trim();
        if (!userPhone) {
            showNotification('Errore', 'Seleziona un utente per il download', 'danger');
            return;
        }
        
        // Mostra spinner
        showSpinner("Avvio download", "Avvio download dei media in corso...");
        
        // Esegui richiesta API
        fetch('/api/download/start', {
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
                    // Download avviato con successo
                    showNotification('Successo', 'Download avviato con successo', 'success');
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante l\'avvio del download', 'danger');
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
        console.error("Errore nell'avvio del download:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio del download', 'danger');
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

// Carica download completati
function loadCompletedDownloads() {
    const completedContainer = document.getElementById('completedDownloadsContainer');
    
    if (completedContainer) {
        // Mostra spinner
        completedContainer.innerHTML = `
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
        
        // Esegui richiesta API
        fetch('/api/download/completed')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const downloads = data.downloads;
                    
                    if (downloads.length === 0) {
                        completedContainer.innerHTML = `
                            <div class="alert alert-info">
                                <i class="bi bi-info-circle"></i> Nessun download completato.
                            </div>
                        `;
                    } else {
                        completedContainer.innerHTML = '';
                        
                        // Crea tabella con download completati
                        const table = document.createElement('div');
                        table.className = 'table-responsive';
                        table.innerHTML = `
                            <table class="table table-striped">
                                <thead>
                                    <tr>
                                        <th>Gruppo</th>
                                        <th>Utente</th>
                                        <th>Data</th>
                                        <th>Media</th>
                                        <th>Dimensione</th>
                                        <th>Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${downloads.map(download => `
                                        <tr>
                                            <td>${download.group_name}</td>
                                            <td>${download.user_phone}</td>
                                            <td>${new Date(download.completion_time).toLocaleString()}</td>
                                            <td>${download.media_count} (${download.images_count} img, ${download.videos_count} vid)</td>
                                            <td>${download.size_formatted}</td>
                                            <td>
                                                <div class="btn-group">
                                                    <a href="/download/${download.group_dir_name}" class="btn btn-sm btn-primary" target="_blank">
                                                        <i class="bi bi-folder"></i> Apri
                                                    </a>
                                                    <button type="button" class="btn btn-sm btn-danger btn-delete-download" data-download-id="${download.id}">
                                                        <i class="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `;
                        
                        completedContainer.appendChild(table);
                        
                        // Aggiungi event listener per pulsanti elimina
                        document.querySelectorAll('.btn-delete-download').forEach(btn => {
                            btn.addEventListener('click', function() {
                                const downloadId = this.dataset.downloadId;
                                deleteDownload(downloadId);
                            });
                        });
                    }
                } else {
                    completedContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle"></i> Errore nel caricamento dei download completati.
                            ${data.error || ''}
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei download completati:', error);
                
                completedContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> Si è verificato un errore durante il caricamento dei download completati.
                    </div>
                `;
            });
    }
}

// Elimina un download completato
function deleteDownload(downloadId) {
    // Chiedi conferma
    showConfirmationModal(
        'Elimina download',
        'Sei sicuro di voler eliminare questo download? Tutti i file scaricati verranno eliminati definitivamente.',
        () => {
            // Mostra spinner
            showSpinner("Eliminazione download", "Eliminazione del download in corso...");
            
            // Esegui richiesta API
            fetch(`/api/download/${downloadId}`, {
                method: 'DELETE'
            })
                .then(response => response.json())
                .then(data => {
                    // Nascondi spinner
                    hideSpinner();
                    
                    if (data.success) {
                        showNotification('Successo', 'Download eliminato con successo', 'success');
                        
                        // Aggiorna lista download completati
                        loadCompletedDownloads();
                    } else {
                        showNotification('Errore', data.message || 'Errore nell\'eliminazione del download', 'danger');
                    }
                })
                .catch(error => {
                    // Nascondi spinner
                    hideSpinner();
                    
                    console.error('Errore nell\'eliminazione del download:', error);
                    showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione del download', 'danger');
                });
        }
    );
}

// Esporta funzioni
window.startDownload = startDownload;
window.loadActiveDownloads = loadActiveDownloads;
window.loadCompletedDownloads = loadCompletedDownloads;
window.deleteDownload = deleteDownload;
window.updateDownloadStatus = updateDownloadStatus;
window.updateDownloadProgress = updateDownloadProgress;