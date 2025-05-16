');
            if (logFileSelect && logFileSelect.value) {
                downloadLogFile(logFileSelect.value);
            }
        });
    }
    
    // Aggiungi event listener per pulsante refresh errori
    const refreshErrorsBtn = document.getElementById('refreshErrorsBtn');
    if (refreshErrorsBtn) {
        refreshErrorsBtn.addEventListener('click', loadRecentErrors);
    }
    
    // Carica contenuto del log iniziale se presente nella URL
    const urlParams = new URLSearchParams(window.location.search);
    const logFile = urlParams.get('file');
    if (logFile && logFileSelect) {
        // Seleziona file nella select
        logFileSelect.value = logFile;
        
        // Carica contenuto
        loadLogContent(logFile);
    }
    
    // Carica errori recenti
    loadRecentErrors();
}

// Carica contenuto del file di log
function loadLogContent(logFile) {
    try {
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
    } catch (e) {
        console.error("Errore nel caricamento del file di log:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento del file di log', 'danger');
    }
}

// Filtra contenuto del log
function filterLogContent(filter) {
    try {
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
        
        // Evidenzia le occorrenze del filtro nelle righe visibili
        pre.querySelectorAll('.log-highlight').forEach(span => {
            const content = span.innerHTML;
            const regex = new RegExp(`(${filter})`, 'gi');
            span.innerHTML = content.replace(regex, '<mark>$1</mark>');
        });
    } catch (e) {
        console.error("Errore nel filtraggio del contenuto del log:", e);
        showNotification('Errore', 'Si è verificato un errore durante il filtraggio del log', 'danger');
    }
}

// Scarica file di log
function downloadLogFile(logFile) {
    try {
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
    } catch (e) {
        console.error("Errore nel download del file di log:", e);
        showNotification('Errore', 'Si è verificato un errore durante il download del file di log', 'danger');
    }
}

// Carica errori recenti
function loadRecentErrors() {
    try {
        const errorsContainer = document.getElementById('errorsContainer');
        
        if (!errorsContainer) return;
        
        // Mostra spinner
        errorsContainer.innerHTML = `
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
        
        // Esegui richiesta API
        fetch('/api/logs/errors')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const errors = data.errors;
                    
                    if (errors.length === 0) {
                        errorsContainer.innerHTML = `
                            <div class="alert alert-success">
                                <i class="bi bi-check-circle"></i> Nessun errore recente rilevato!
                            </div>
                        `;
                    } else {
                        // Crea lista errori
                        errorsContainer.innerHTML = `
                            <div class="list-group">
                                ${errors.map(error => `
                                    <div class="list-group-item list-group-item-danger">
                                        <div class="d-flex w-100 justify-content-between">
                                            <h6 class="mb-1">${error.file}</h6>
                                            <small>${new Date(error.timestamp).toLocaleString()}</small>
                                        </div>
                                        <p class="mb-1">${error.message}</p>
                                        <small>
                                            <a href="?file=${error.file}" class="text-decoration-none">
                                                <i class="bi bi-eye"></i> Visualizza file di log
                                            </a>
                                        </small>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                } else {
                    errorsContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle"></i> Errore nel caricamento degli errori recenti.
                            ${data.error || ''}
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento degli errori recenti:', error);
                
                errorsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> Si è verificato un errore durante il caricamento degli errori recenti.
                    </div>
                `;
            });
    } catch (e) {
        console.error("Errore nel caricamento degli errori recenti:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento degli errori recenti', 'danger');
    }
}
iteLinkSpinner.classList.remove('d-none');
            inviteLinkContent.classList.add('d-none');
            inviteLinkError.classList.add('d-none');
            
            // Mostra modal
            const modalInstance = new bootstrap.Modal(inviteLinkModal);
            modalInstance.show();
            
            // Esegui richiesta API
            fetch(`/api/group/invite/${userPhone}/${groupId}`)
                .then(response => response.json())
                .then(data => {
                    // Nascondi spinner
                    inviteLinkSpinner.classList.add('d-none');
                    
                    if (data.success) {
                        // Mostra link
                        inviteLinkContent.classList.remove('d-none');
                        inviteLinkInput.value = data.invite_link;
                    } else {
                        // Mostra errore
                        inviteLinkError.classList.remove('d-none');
                        inviteLinkErrorMessage.textContent = data.message || 'Errore sconosciuto';
                    }
                })
                .catch(error => {
                    // Nascondi spinner
                    inviteLinkSpinner.classList.add('d-none');
                    
                    // Mostra errore
                    inviteLinkError.classList.remove('d-none');
                    inviteLinkErrorMessage.textContent = error.message || 'Errore di connessione';
                    
                    console.error('Errore nell\'ottenimento del link di invito:', error);
                });
        }
    } catch (e) {
        console.error("Errore nell'ottenimento del link di invito:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'ottenimento del link di invito', 'danger');
    }
}

// Inizializza pagina monitor
function initMonitorPage() {
    console.log('Inizializzazione pagina monitor');
    
    // Ottieni utente selezionato
    const selectedUser = new URLSearchParams(window.location.search).get('user');
    
    // Aggiungi event listener per pulsante aggiungi monitoraggio
    const startMonitoringBtn = document.getElementById('startMonitoringBtn');
    if (startMonitoringBtn) {
        startMonitoringBtn.addEventListener('click', function() {
            const monitorUserSelect = document.getElementById('monitorUserSelect');
            const monitorGroupSelect = document.getElementById('monitorGroupSelect');
            
            if (!monitorUserSelect || !monitorGroupSelect) return;
            
            const userPhone = monitorUserSelect.value;
            const groupId = monitorGroupSelect.value;
            
            if (!userPhone || !groupId) {
                showNotification('Errore', 'Seleziona utente e gruppo per il monitoraggio', 'danger');
                return;
            }
            
            // Aggiorna input nascosto con il telefono dell'utente
            const monitorUserPhone = document.getElementById('monitorUserPhone');
            if (monitorUserPhone) {
                monitorUserPhone.value = userPhone;
            }
            
            // Avvia monitoraggio
            startMonitoring([groupId]);
        });
    }
    
    // Aggiungi event listener per pulsanti stop monitoraggio
    document.querySelectorAll('.btn-stop-monitor').forEach(btn => {
        btn.addEventListener('click', function() {
            const userPhone = this.dataset.user;
            stopMonitoring(userPhone);
        });
    });
    
    // Aggiungi event listener per cambio utente
    const monitorUserSelect = document.getElementById('monitorUserSelect');
    if (monitorUserSelect) {
        monitorUserSelect.addEventListener('change', function() {
            const userPhone = this.value;
            
            // Aggiorna input nascosto con il telefono dell'utente
            const monitorUserPhone = document.getElementById('monitorUserPhone');
            if (monitorUserPhone) {
                monitorUserPhone.value = userPhone;
            }
            
            // Carica gruppi dell'utente
            if (userPhone) {
                loadGroupsForMonitor(userPhone);
            } else {
                // Reset select gruppi
                const groupSelect = document.getElementById('monitorGroupSelect');
                if (groupSelect) {
                    groupSelect.innerHTML = '<option value="">Seleziona prima un utente</option>';
                    groupSelect.disabled = true;
                }
                
                // Disabilita pulsante avvio
                if (startMonitoringBtn) {
                    startMonitoringBtn.disabled = true;
                }
            }
        });
    }
    
    // Carica gruppi se l'utente è selezionato
    if (selectedUser && monitorUserSelect) {
        monitorUserSelect.value = selectedUser;
        
        // Aggiorna input nascosto con il telefono dell'utente
        const monitorUserPhone = document.getElementById('monitorUserPhone');
        if (monitorUserPhone) {
            monitorUserPhone.value = selectedUser;
        }
        
        // Carica gruppi dell'utente
        loadGroupsForMonitor(selectedUser);
    }
}

// Carica gruppi per monitoraggio
function loadGroupsForMonitor(userPhone) {
    try {
        const groupSelect = document.getElementById('monitorGroupSelect');
        const startMonitoringBtn = document.getElementById('startMonitoringBtn');
        
        if (!groupSelect) return;
        
        // Disabilita select durante caricamento
        groupSelect.disabled = true;
        groupSelect.innerHTML = '<option value="">Caricamento gruppi...</option>';
        
        // Disabilita pulsante avvio
        if (startMonitoringBtn) {
            startMonitoringBtn.disabled = true;
        }
        
        // Carica gruppi dell'utente
        fetch(`/api/groups/${userPhone}`)
            .then(response => response.json())
            .then(groups => {
                // Aggiorna select dei gruppi
                groupSelect.innerHTML = '<option value="">Seleziona gruppo</option>';
                
                if (!groups || groups.length === 0) {
                    groupSelect.innerHTML += '<option value="" disabled>Nessun gruppo trovato</option>';
                    groupSelect.disabled = true;
                    
                    // Disabilita pulsante avvio
                    if (startMonitoringBtn) {
                        startMonitoringBtn.disabled = true;
                    }
                } else {
                    // Aggiungi opzioni per i gruppi
                    groups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.title;
                        groupSelect.appendChild(option);
                    });
                    
                    // Abilita la select
                    groupSelect.disabled = false;
                    
                    // Abilita pulsante avvio se gruppo già selezionato
                    if (startMonitoringBtn && groupSelect.value) {
                        startMonitoringBtn.disabled = false;
                    }
                    
                    // Aggiungi event listener per cambio gruppo
                    groupSelect.addEventListener('change', function() {
                        if (startMonitoringBtn) {
                            startMonitoringBtn.disabled = !this.value;
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei gruppi:', error);
                
                // Mostra errore nella select
                groupSelect.innerHTML = '<option value="">Errore nel caricamento dei gruppi</option>';
                groupSelect.disabled = true;
                
                // Disabilita pulsante avvio
                if (startMonitoringBtn) {
                    startMonitoringBtn.disabled = true;
                }
                
                // Mostra notifica
                showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
            });
    } catch (e) {
        console.error("Errore nel caricamento dei gruppi per monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
    }
}

// Inizializza pagina download
function initDownloadPage() {
    console.log('Inizializzazione pagina download');
    
    // Aggiungi event listener per cambio utente
    const downloadUserSelect = document.getElementById('downloadUserSelect');
    if (downloadUserSelect) {
        downloadUserSelect.addEventListener('change', function() {
            const userPhone = this.value;
            
            // Aggiorna input nascosto con il telefono dell'utente
            const downloadUserPhone = document.getElementById('downloadUserPhone');
            if (downloadUserPhone) {
                downloadUserPhone.value = userPhone;
            }
            
            // Carica gruppi dell'utente
            if (userPhone) {
                loadGroupsForDownload(userPhone);
            } else {
                // Reset select gruppi
                const groupSelect = document.getElementById('downloadGroupSelect');
                if (groupSelect) {
                    groupSelect.innerHTML = '<option value="">Seleziona prima un utente</option>';
                    groupSelect.disabled = true;
                }
                
                // Disabilita pulsante avvio
                const startDownloadBtn = document.querySelector('.btn-start-download');
                if (startDownloadBtn) {
                    startDownloadBtn.disabled = true;
                }
            }
        });
    }
    
    // Aggiungi event listener per pulsante refresh download completati
    const refreshCompletedBtn = document.getElementById('refreshCompletedBtn');
    if (refreshCompletedBtn) {
        refreshCompletedBtn.addEventListener('click', loadCompletedDownloads);
    }
    
    // Carica download completati
    loadCompletedDownloads();
}

// Carica gruppi per download
function loadGroupsForDownload(userPhone) {
    try {
        const groupSelect = document.getElementById('downloadGroupSelect');
        const startDownloadBtn = document.querySelector('.btn-start-download');
        
        if (!groupSelect) return;
        
        // Disabilita select durante caricamento
        groupSelect.disabled = true;
        groupSelect.innerHTML = '<option value="">Caricamento gruppi...</option>';
        
        // Disabilita pulsante avvio
        if (startDownloadBtn) {
            startDownloadBtn.disabled = true;
        }
        
        // Carica gruppi dell'utente
        fetch(`/api/groups/${userPhone}`)
            .then(response => response.json())
            .then(groups => {
                // Aggiorna select dei gruppi
                groupSelect.innerHTML = '<option value="">Seleziona gruppo</option>';
                
                if (!groups || groups.length === 0) {
                    groupSelect.innerHTML += '<option value="" disabled>Nessun gruppo trovato</option>';
                    groupSelect.disabled = true;
                    
                    // Disabilita pulsante avvio
                    if (startDownloadBtn) {
                        startDownloadBtn.disabled = true;
                    }
                } else {
                    // Aggiungi opzioni per i gruppi
                    groups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.title;
                        groupSelect.appendChild(option);
                    });
                    
                    // Abilita la select
                    groupSelect.disabled = false;
                    
                    // Il pulsante rimane disabilitato finché non viene selezionato un gruppo
                    if (startDownloadBtn) {
                        startDownloadBtn.disabled = true;
                    }
                    
                    // Aggiungi event listener per cambio gruppo
                    groupSelect.addEventListener('change', function() {
                        if (startDownloadBtn) {
                            startDownloadBtn.disabled = !this.value;
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei gruppi:', error);
                
                // Mostra errore nella select
                groupSelect.innerHTML = '<option value="">Errore nel caricamento dei gruppi</option>';
                groupSelect.disabled = true;
                
                // Disabilita pulsante avvio
                if (startDownloadBtn) {
                    startDownloadBtn.disabled = true;
                }
                
                // Mostra notifica
                showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
            });
    } catch (e) {
        console.error("Errore nel caricamento dei gruppi per download:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
    }
}

// Carica download completati
function loadCompletedDownloads() {
    try {
        const completedContainer = document.getElementById('completedDownloadsContainer');
        
        if (!completedContainer) return;
        
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
    } catch (e) {
        console.error("Errore nel caricamento dei download completati:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento dei download completati', 'danger');
    }
}

// Elimina download
function deleteDownload(downloadId) {
    try {
        // Chiedi conferma
        showConfirmationModal(
            'Elimina download',
            'Sei sicuro di voler eliminare questo download? Tutti i file scaricati verranno eliminati definitivamente.',
            () => {
                // Esegui richiesta API
                fetch(`/api/download/${downloadId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Successo', 'Download eliminato con successo', 'success');
                        
                        // Aggiorna lista download completati
                        loadCompletedDownloads();
                    } else {
                        showNotification('Errore', data.message || 'Errore nell\'eliminazione del download', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Errore nell\'eliminazione del download:', error);
                    showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione del download', 'danger');
                });
            }
        );
    } catch (e) {
        console.error("Errore nell'eliminazione del download:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione del download', 'danger');
    }
}

// Inizializza pagina archivio
function initArchivePage() {
    console.log('Inizializzazione pagina archivio');
    
    // Aggiungi event listener per cambio utente
    const archiveUserSelect = document.getElementById('archiveUserSelect');
    if (archiveUserSelect) {
        archiveUserSelect.addEventListener('change', function() {
            const userPhone = this.value;
            
            // Aggiorna input nascosto con il telefono dell'utente
            const archiveUserPhone = document.getElementById('archiveUserPhone');
            if (archiveUserPhone) {
                archiveUserPhone.value = userPhone;
            }
            
            // Carica gruppi dell'utente
            if (userPhone) {
                loadGroupsForArchive(userPhone);
            } else {
                // Reset select gruppi
                const groupSelect = document.getElementById('archiveGroupSelect');
                if (groupSelect) {
                    groupSelect.innerHTML = '<option value="">Seleziona prima un utente</option>';
                    groupSelect.disabled = true;
                }
                
                // Disabilita pulsante avvio
                const startArchiveBtn = document.querySelector('.btn-start-archive');
                if (startArchiveBtn) {
                    startArchiveBtn.disabled = true;
                }
            }
        });
    }
    
    // Aggiungi event listener per pulsante refresh archivi
    const refreshArchivesBtn = document.getElementById('refreshArchivesBtn');
    if (refreshArchivesBtn) {
        refreshArchivesBtn.addEventListener('click', loadAvailableArchives);
    }
    
    // Carica archivi disponibili
    loadAvailableArchives();
}

// Carica gruppi per archivio
function loadGroupsForArchive(userPhone) {
    try {
        const groupSelect = document.getElementById('archiveGroupSelect');
        const startArchiveBtn = document.querySelector('.btn-start-archive');
        
        if (!groupSelect) return;
        
        // Disabilita select durante caricamento
        groupSelect.disabled = true;
        groupSelect.innerHTML = '<option value="">Caricamento gruppi...</option>';
        
        // Disabilita pulsante avvio
        if (startArchiveBtn) {
            startArchiveBtn.disabled = true;
        }
        
        // Carica gruppi dell'utente
        fetch(`/api/groups/${userPhone}`)
            .then(response => response.json())
            .then(groups => {
                // Aggiorna select dei gruppi
                groupSelect.innerHTML = '<option value="">Seleziona gruppo</option>';
                
                if (!groups || groups.length === 0) {
                    groupSelect.innerHTML += '<option value="" disabled>Nessun gruppo trovato</option>';
                    groupSelect.disabled = true;
                    
                    // Disabilita pulsante avvio
                    if (startArchiveBtn) {
                        startArchiveBtn.disabled = true;
                    }
                } else {
                    // Aggiungi opzioni per i gruppi
                    groups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.title;
                        groupSelect.appendChild(option);
                    });
                    
                    // Abilita la select
                    groupSelect.disabled = false;
                    
                    // Il pulsante rimane disabilitato finché non viene selezionato un gruppo
                    if (startArchiveBtn) {
                        startArchiveBtn.disabled = true;
                    }
                    
                    // Aggiungi event listener per cambio gruppo
                    groupSelect.addEventListener('change', function() {
                        if (startArchiveBtn) {
                            startArchiveBtn.disabled = !this.value;
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei gruppi:', error);
                
                // Mostra errore nella select
                groupSelect.innerHTML = '<option value="">Errore nel caricamento dei gruppi</option>';
                groupSelect.disabled = true;
                
                // Disabilita pulsante avvio
                if (startArchiveBtn) {
                    startArchiveBtn.disabled = true;
                }
                
                // Mostra notifica
                showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
            });
    } catch (e) {
        console.error("Errore nel caricamento dei gruppi per archivio:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
    }
}

// Carica archivi disponibili
function loadAvailableArchives() {
    try {
        const archivesContainer = document.getElementById('availableArchivesContainer');
        
        if (!archivesContainer) return;
        
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
                        archivesContainer.innerHTML = '<div class="row">';
                        
                        archives.forEach(archive => {
                            archivesContainer.innerHTML += `
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
                        });
                        
                        archivesContainer.innerHTML += '</div>';
                        
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
    } catch (e) {
        console.error("Errore nel caricamento degli archivi disponibili:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento degli archivi', 'danger');
    }
}

// Elimina archivio
function deleteArchive(archiveId) {
    try {
        // Chiedi conferma
        showConfirmationModal(
            'Elimina archivio',
            'Sei sicuro di voler eliminare questo archivio? Tutti i file archiviati verranno eliminati definitivamente.',
            () => {
                // Esegui richiesta API
                fetch(`/api/archive/${archiveId}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showNotification('Successo', 'Archivio eliminato con successo', 'success');
                        
                        // Aggiorna lista archivi
                        loadAvailableArchives();
                    } else {
                        showNotification('Errore', data.message || 'Errore nell\'eliminazione dell\'archivio', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Errore nell\'eliminazione dell\'archivio:', error);
                    showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione dell\'archivio', 'danger');
                });
            }
        );
    } catch (e) {
        console.error("Errore nell'eliminazione dell'archivio:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'eliminazione dell\'archivio', 'danger');
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
    
    // Aggiungi event listener per pulsante pulisci filtro
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            if (logFilterInput) {
                logFilterInput.value = '';
                filterLogContent('');
            }
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
            const logFileSelect = document.getElementById('logFileSelect// Inizializzazione quando il documento è pronto
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

// Inizializza impostazioni applicazione
function initSettings() {
    try {
        // Carica impostazioni da localStorage
        const settings = JSON.parse(localStorage.getItem('telegramManagerSettings')) || {
            maxDownloads: 3,
            notificationsEnabled: true,
            darkMode: false
        };
        
        // Applica impostazioni
        document.getElementById('maxDownloads').value = settings.maxDownloads;
        document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
        document.getElementById('darkMode').checked = settings.darkMode;
        
        // Applica tema scuro se abilitato
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Salva impostazioni su click bottone
        document.getElementById('saveSettings').addEventListener('click', function() {
            saveSettings();
        });
        
        console.log("Impostazioni inizializzate");
    } catch (e) {
        console.error("Errore nell'inizializzazione delle impostazioni:", e);
    }
}

// Salva impostazioni
function saveSettings() {
    try {
        // Ottieni valori dai campi
        const settings = {
            maxDownloads: parseInt(document.getElementById('maxDownloads').value) || 3,
            notificationsEnabled: document.getElementById('notificationsEnabled').checked,
            darkMode: document.getElementById('darkMode').checked
        };
        
        // Salva in localStorage
        localStorage.setItem('telegramManagerSettings', JSON.stringify(settings));
        
        // Applica tema scuro
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Chiudi modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        if (modal) {
            modal.hide();
        }
        
        // Mostra notifica
        showNotification('Impostazioni', 'Impostazioni salvate con successo', 'success');
        
        console.log("Impostazioni salvate:", settings);
    } catch (e) {
        console.error("Errore nel salvataggio delle impostazioni:", e);
        showNotification('Errore', 'Errore nel salvataggio delle impostazioni', 'danger');
    }
}

// Inizializza gestore eventi UI
function initUIEventHandlers() {
    try {
        // Aggiungi event listener per toggle sidebar
        const sidebarCollapse = document.getElementById('sidebarCollapse');
        if (sidebarCollapse) {
            sidebarCollapse.addEventListener('click', function() {
                document.getElementById('sidebar').classList.toggle('active');
                document.getElementById('content').classList.toggle('active');
            });
        }
        
        // Aggiungi event listener per riconnessione WebSocket
        const reconnectWs = document.getElementById('reconnectWs');
        if (reconnectWs) {
            reconnectWs.addEventListener('click', function() {
                if (window.socket) {
                    window.socket.disconnect();
                    window.socket.connect();
                    showNotification('WebSocket', 'Tentativo di riconnessione in corso...', 'info');
                }
            });
        }
        
        console.log("Event handlers UI inizializzati");
    } catch (e) {
        console.error("Errore nell'inizializzazione degli event handlers UI:", e);
    }
}

// Inizializza notifiche
function initNotifications() {
    try {
        // Aggiunge event listeners per chiudere alert
        document.querySelectorAll('.alert .btn-close').forEach(function(btn) {
            btn.addEventListener('click', function() {
                this.closest('.alert').remove();
            });
        });
        
        console.log("Notifiche inizializzate");
    } catch (e) {
        console.error("Errore nell'inizializzazione delle notifiche:", e);
    }
}

// Mostra notifica toast
function showNotification(title, message, type = 'primary') {
    try {
        // Verifica se le notifiche sono abilitate
        const settings = JSON.parse(localStorage.getItem('telegramManagerSettings')) || {};
        if (settings.notificationsEnabled === false) {
            console.log('Notifica non mostrata (disabilitata):', title, message);
            return;
        }
        
        // Ottieni elementi
        const toast = document.getElementById('notificationToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastTime = document.getElementById('toastTime');
        
        // Aggiorna contenuto
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        toastTime.textContent = new Date().toLocaleTimeString();
        
        // Aggiorna stile in base al tipo
        toast.className = 'toast';
        toast.classList.add(`border-${type}`);
        
        // Mostra toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        console.log('Notifica mostrata:', title, message);
    } catch (e) {
        console.error("Errore nella visualizzazione della notifica:", e);
    }
}

// Mostra modal di conferma
function showConfirmationModal(title, message, confirmCallback) {
    try {
        // Ottieni elementi
        const modal = document.getElementById('confirmationModal');
        const modalTitle = document.getElementById('confirmationModalLabel');
        const modalMessage = document.getElementById('confirmationMessage');
        const confirmButton = document.getElementById('confirmAction');
        
        // Aggiorna contenuto
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Rimuovi vecchi event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Aggiungi nuovo event listener
        newConfirmButton.addEventListener('click', function() {
            // Chiudi modal
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
            
            // Esegui callback
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
        });
        
        // Mostra modal
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    } catch (e) {
        console.error("Errore nella visualizzazione del modal di conferma:", e);
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
                startMonitoring([groupId]);
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
        if (!userPhone) {
            showNotification('Errore', 'Seleziona un utente per il monitoraggio', 'danger');
            return;
        }
        
        // Invia richiesta API
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
            if (data.success) {
                showNotification('Monitoraggio', 'Monitoraggio avviato con successo', 'success');
            } else {
                showNotification('Errore', data.error || 'Errore nell\'avvio del monitoraggio', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'avvio del monitoraggio:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'avvio del monitoraggio', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'avvio del monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio del monitoraggio', 'danger');
    }
}

// Ferma monitoraggio
function stopMonitoring(userPhone) {
    try {
        if (!userPhone) return;
        
        // Invia richiesta API
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
            if (data.success) {
                showNotification('Monitoraggio', 'Monitoraggio fermato con successo', 'success');
            } else {
                showNotification('Errore', data.error || 'Errore nell\'arresto del monitoraggio', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'arresto del monitoraggio:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'arresto del monitoraggio', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'arresto del monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'arresto del monitoraggio', 'danger');
    }
}

// Avvia download
function startDownload(groupId, mediaTypes, limit) {
    try {
        if (!groupId) return;
        
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
        
        // Se non specificati, ottieni tipi di media dai checkbox
        if (!mediaTypes) {
            mediaTypes = [];
            if (document.getElementById('downloadPhoto') && document.getElementById('downloadPhoto').checked) {
                mediaTypes.push('photo');
            }
            if (document.getElementById('downloadVideo') && document.getElementById('downloadVideo').checked) {
                mediaTypes.push('video');
            }
        }
        
        // Se non ci sono tipi di media selezionati, mostra errore
        if (mediaTypes.length === 0) {
            showNotification('Errore', 'Seleziona almeno un tipo di media da scaricare', 'danger');
            return;
        }
        
        // Se non specificato, ottieni limite dai campi
        if (!limit && document.getElementById('downloadLimit')) {
            limit = parseInt(document.getElementById('downloadLimit').value) || 100;
        } else if (!limit) {
            limit = 100; // Default
        }
        
        // Invia richiesta API
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
            if (data.success) {
                showNotification('Download', 'Download avviato con successo', 'success');
            } else {
                showNotification('Errore', data.error || 'Errore nell\'avvio del download', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'avvio del download:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'avvio del download', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'avvio del download:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio del download', 'danger');
    }
}

// Avvia archiviazione
function startArchive(groupId, mediaTypes, limit) {
    try {
        if (!groupId) return;
        
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
        
        // Se non specificati, ottieni tipi di media dai checkbox
        if (!mediaTypes) {
            mediaTypes = [];
            if (document.getElementById('archivePhoto') && document.getElementById('archivePhoto').checked) {
                mediaTypes.push('photo');
            }
            if (document.getElementById('archiveVideo') && document.getElementById('archiveVideo').checked) {
                mediaTypes.push('video');
            }
        }
        
        // Se non ci sono tipi di media selezionati, mostra errore
        if (mediaTypes.length === 0) {
            showNotification('Errore', 'Seleziona almeno un tipo di media da archiviare', 'danger');
            return;
        }
        
        // Se non specificato, ottieni limite dai campi
        if (!limit && document.getElementById('archiveLimit')) {
            limit = parseInt(document.getElementById('archiveLimit').value) || 0;
        } else if (!limit) {
            limit = 0; // Default: tutti i messaggi
        }
        
        // Invia richiesta API
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
            if (data.success) {
                showNotification('Archiviazione', 'Archiviazione avviata con successo', 'success');
            } else {
                showNotification('Errore', data.error || 'Errore nell\'avvio dell\'archiviazione', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'avvio dell\'archiviazione:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'avvio dell\'archiviazione', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'avvio dell'archiviazione:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'avvio dell\'archiviazione', 'danger');
    }
}

// Aggiunge un nuovo utente
function addUser() {
    try {
        // Ottieni numero di telefono
        const phoneInput = document.getElementById('newUserPhone');
        if (!phoneInput) {
            showNotification('Errore', 'Campo numero di telefono non trovato', 'danger');
            return;
        }
        
        const phone = '+' + phoneInput.value.trim();
        
        if (!phone || phone === '+') {
            showNotification('Errore', 'Inserisci un numero di telefono valido', 'danger');
            return;
        }
        
        // Invia richiesta API
        fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Utente', 'Utente aggiunto con successo', 'success');
                // Ricarica la pagina per mostrare il nuovo utente
                window.location.reload();
            } else if (data.status === 'code_sent') {
                // Mostra campo per inserire codice di verifica
                showVerificationCodeForm(phone);
            } else if (data.status === 'password_required') {
                // Mostra campo per inserire password 2FA
                show2FAPasswordForm(phone);
            } else {
                showNotification('Errore', data.message || 'Errore nell\'aggiunta dell\'utente', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'aggiunta dell\'utente:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'aggiunta dell\'utente', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'aggiunta dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'aggiunta dell\'utente', 'danger');
    }
}

// Mostra form per inserimento codice di verifica
function showVerificationCodeForm(phone) {
    try {
        // Crea modal
        const modalHtml = `
            <div class="modal fade" id="verificationCodeModal" tabindex="-1" aria-labelledby="verificationCodeModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="verificationCodeModalLabel">Verifica Telegram</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Un codice di verifica è stato inviato al tuo account Telegram. Inseriscilo qui sotto:</p>
                            <div class="mb-3">
                                <label for="verificationCode" class="form-label">Codice di verifica</label>
                                <input type="text" class="form-control" id="verificationCode" placeholder="12345">
                            </div>
                            <input type="hidden" id="userPhone" value="${phone}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="submitVerificationCode">Verifica</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const verificationModal = new bootstrap.Modal(document.getElementById('verificationCodeModal'));
        verificationModal.show();
        
        // Aggiungi event listener per pulsante di verifica
        document.getElementById('submitVerificationCode').addEventListener('click', function() {
            const code = document.getElementById('verificationCode').value.trim();
            const userPhone = document.getElementById('userPhone').value;
            
            if (!code) {
                showNotification('Errore', 'Inserisci il codice di verifica', 'danger');
                return;
            }
            
            // Invia richiesta di verifica
            verifyUser(userPhone, code);
            
            // Chiudi modal
            verificationModal.hide();
            
            // Rimuovi modal dal DOM
            setTimeout(() => {
                document.getElementById('verificationCodeModal').remove();
            }, 500);
        });
    } catch (e) {
        console.error("Errore nella visualizzazione del form di verifica:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del form di verifica', 'danger');
    }
}

// Mostra form per inserimento password 2FA
function show2FAPasswordForm(phone) {
    try {
        // Crea modal
        const modalHtml = `
            <div class="modal fade" id="twoFAPasswordModal" tabindex="-1" aria-labelledby="twoFAPasswordModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="twoFAPasswordModalLabel">Autenticazione a due fattori</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Il tuo account Telegram ha l'autenticazione a due fattori attiva. Inserisci la tua password:</p>
                            <div class="mb-3">
                                <label for="twoFAPassword" class="form-label">Password 2FA</label>
                                <input type="password" class="form-control" id="twoFAPassword">
                            </div>
                            <input type="hidden" id="userPhone" value="${phone}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="submitTwoFAPassword">Verifica</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Aggiungi modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostra modal
        const twoFAModal = new bootstrap.Modal(document.getElementById('twoFAPasswordModal'));
        twoFAModal.show();
        
        // Aggiungi event listener per pulsante di verifica
        document.getElementById('submitTwoFAPassword').addEventListener('click', function() {
            const password = document.getElementById('twoFAPassword').value;
            const userPhone = document.getElementById('userPhone').value;
            
            if (!password) {
                showNotification('Errore', 'Inserisci la password 2FA', 'danger');
                return;
            }
            
            // Invia richiesta di verifica
            verifyUser(userPhone, null, password);
            
            // Chiudi modal
            twoFAModal.hide();
            
            // Rimuovi modal dal DOM
            setTimeout(() => {
                document.getElementById('twoFAPasswordModal').remove();
            }, 500);
        });
    } catch (e) {
        console.error("Errore nella visualizzazione del form 2FA:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del form 2FA', 'danger');
    }
}

// Verifica utente con codice o password
function verifyUser(phone, code = null, password = null) {
    try {
        // Invia richiesta API
        fetch('/api/users/authenticate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                code: code,
                password: password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Utente', 'Utente autenticato con successo', 'success');
                // Ricarica la pagina per mostrare il nuovo utente
                window.location.reload();
            } else if (data.status === 'code_sent') {
                // Mostra campo per inserire codice di verifica
                showVerificationCodeForm(phone);
            } else if (data.status === 'password_required') {
                // Mostra campo per inserire password 2FA
                show2FAPasswordForm(phone);
            } else {
                showNotification('Errore', data.message || 'Errore nell\'autenticazione dell\'utente', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nell\'autenticazione dell\'utente:', error);
            showNotification('Errore', 'Si è verificato un errore durante l\'autenticazione dell\'utente', 'danger');
        });
    } catch (e) {
        console.error("Errore nell'autenticazione dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'autenticazione dell\'utente', 'danger');
    }
}

// Rimuove un utente
function removeUser(phone) {
    try {
        if (!phone) return;
        
        // Invia richiesta API
        fetch('/api/users', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: phone
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Utente', 'Utente rimosso con successo', 'success');
                
                // Rimuovi card utente dalla UI
                const userCard = document.querySelector(`.user-card[data-phone="${phone}"]`);
                if (userCard) {
                    userCard.closest('.col-md-4').remove();
                }
                
                // Se non ci sono più utenti, mostra messaggio
                const usersContainer = document.getElementById('usersContainer');
                if (usersContainer && usersContainer.querySelectorAll('.user-card').length === 0) {
                    usersContainer.innerHTML = '<div class="alert alert-info">Nessun utente registrato</div>';
                }
            } else {
                showNotification('Errore', data.message || 'Errore nella rimozione dell\'utente', 'danger');
            }
        })
        .catch(error => {
            console.error('Errore nella rimozione dell\'utente:', error);
            showNotification('Errore', 'Si è verificato un errore durante la rimozione dell\'utente', 'danger');
        });
    } catch (e) {
        console.error("Errore nella rimozione dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante la rimozione dell\'utente', 'danger');
    }
}

// Carica gruppi di un utente
function loadUserGroups(userPhone) {
    try {
        if (!userPhone) return;
        
        const groupsContainer = document.getElementById('groupsContainer');
        if (!groupsContainer) return;
        
        // Mostra spinner
        groupsContainer.innerHTML = `
            <div class="spinner-container">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Caricamento...</span>
                </div>
            </div>
        `;
        
        // Invia richiesta API
        fetch(`/api/groups/${userPhone}`)
            .then(response => response.json())
            .then(groups => {
                // Pulisci il container
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
            })
            .catch(error => {
                console.error('Errore nel caricamento dei gruppi:', error);
                groupsContainer.innerHTML = '<div class="alert alert-danger">Errore nel caricamento dei gruppi</div>';
            });
    } catch (e) {
        console.error("Errore nel caricamento dei gruppi:", e);
        const groupsContainer = document.getElementById('groupsContainer');
        if (groupsContainer) {
            groupsContainer.innerHTML = '<div class="alert alert-danger">Errore nel caricamento dei gruppi</div>';
        }
    }
}

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
    
    // Aggiorna barre di progresso
    if (stats.total_media > 0) {
        // Immagini
        const imagesProgress = document.querySelector('.progress-bar.bg-primary');
        if (imagesProgress) {
            const imagesPercent = Math.round((stats.total_images / stats.total_media) * 100);
            imagesProgress.style.width = imagesPercent + '%';
            imagesProgress.setAttribute('aria-valuenow', imagesPercent);
            imagesProgress.textContent = imagesPercent + '%';
        }
        
        // Video
        const videosProgress = document.querySelector('.progress-bar.bg-danger');
        if (videosProgress) {
            const videosPercent = Math.round((stats.total_videos / stats.total_media) * 100);
            videosProgress.style.width = videosPercent + '%';
            videosProgress.setAttribute('aria-valuenow', videosPercent);
            videosProgress.textContent = videosPercent + '%';
        }
    }
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
        userCard.className = 'col-md-6 mb-3';
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
    
    // Aggiungi event listener per il form di aggiunta utente
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addUser();
        });
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

// Inizializza pagina gruppi
function initGroupsPage() {
    console.log('Inizializzazione pagina gruppi');
    
    // Ottieni utente selezionato
    const selectedUser = new URLSearchParams(window.location.search).get('user');
    
    // Aggiungi event listener per pulsante aggiorna gruppi
    const refreshGroupsBtn = document.getElementById('refreshGroupsBtn');
    if (refreshGroupsBtn) {
        refreshGroupsBtn.addEventListener('click', function() {
            if (selectedUser) {
                loadUserGroups(selectedUser);
            }
        });
    }
    
    // Aggiungi event listener per pulsanti delle card dei gruppi
    document.querySelectorAll('.btn-monitor').forEach(btn => {
        btn.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
            showMonitorModal(groupId, groupName, selectedUser);
        });
    });
    
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
            showDownloadModal(groupId, groupName, selectedUser);
        });
    });
    
    document.querySelectorAll('.btn-archive').forEach(btn => {
        btn.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
            showArchiveModal(groupId, groupName, selectedUser);
        });
    });
    
    document.querySelectorAll('.btn-invite-link').forEach(btn => {
        btn.addEventListener('click', function() {
            const groupId = this.dataset.groupId;
            getInviteLink(selectedUser, groupId);
        });
    });
}

// Mostra modal per monitoraggio
function showMonitorModal(groupId, groupName, userPhone) {
    try {
        // Verifica che esista un modal per il monitoraggio
        let monitorModal = document.getElementById('monitorModal');
        
        // Se il modal non esiste, crealo
        if (!monitorModal) {
            const modalHtml = `
                <div class="modal fade" id="monitorModal" tabindex="-1" aria-labelledby="monitorModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="monitorModalLabel">Monitoraggio Gruppo</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p>Avvia il monitoraggio dei messaggi per il gruppo <span id="monitorGroupName" class="fw-bold"></span>.</p>
                                <input type="hidden" id="monitorGroupId">
                                <input type="hidden" id="monitorUserPhone" value="${userPhone}">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                                <button type="button" class="btn btn-primary" id="startMonitorBtn">
                                    <i class="bi bi-play-circle"></i> Avvia monitoraggio
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Aggiungi modal al DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            monitorModal = document.getElementById('monitorModal');
            
            // Aggiungi event listener per il pulsante di avvio
            const startMonitorBtn = document.getElementById('startMonitorBtn');
            if (startMonitorBtn) {
                startMonitorBtn.addEventListener('click', function() {
                    const groupId = document.getElementById('monitorGroupId').value;
                    startMonitoring([groupId]);
                    
                    // Chiudi modal
                    const modal = bootstrap.Modal.getInstance(monitorModal);
                    if (modal) {
                        modal.hide();
                    }
                });
            }
        }
        
        // Aggiorna dati nel modal
        const monitorGroupId = document.getElementById('monitorGroupId');
        const monitorGroupName = document.getElementById('monitorGroupName');
        const monitorUserPhone = document.getElementById('monitorUserPhone');
        
        if (monitorGroupId && monitorGroupName && monitorUserPhone) {
            monitorGroupId.value = groupId;
            monitorGroupName.textContent = groupName;
            monitorUserPhone.value = userPhone;
            
            // Mostra modal
            const modalInstance = new bootstrap.Modal(monitorModal);
            modalInstance.show();
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del modal di monitoraggio:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del modal di monitoraggio', 'danger');
    }
}

// Mostra modal per download
function showDownloadModal(groupId, groupName, userPhone) {
    try {
        // Verifica che esista un modal per il download
        let downloadModal = document.getElementById('downloadModal');
        
        // Se il modal non esiste, crealo
        if (!downloadModal) {
            const modalHtml = `
                <div class="modal fade" id="downloadModal" tabindex="-1" aria-labelledby="downloadModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="downloadModalLabel">Download Media</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p>Scarica i media dal gruppo <span id="downloadGroupName" class="fw-bold"></span>.</p>
                                <input type="hidden" id="downloadGroupId">
                                <input type="hidden" id="downloadUserPhone" value="${userPhone}">
                                
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" id="downloadPhoto" checked>
                                    <label class="form-check-label" for="downloadPhoto">
                                        <i class="bi bi-image"></i> Scarica immagini
                                    </label>
                                </div>
                                
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" id="downloadVideo" checked>
                                    <label class="form-check-label" for="downloadVideo">
                                        <i class="bi bi-film"></i> Scarica video
                                    </label>
                                </div>
                                
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" id="downloadMessages" checked>
                                    <label class="form-check-label" for="downloadMessages">
                                        <i class="bi bi-chat-text"></i> Salva messaggi
                                    </label>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="downloadLimit" class="form-label">Limite messaggi</label>
                                    <input type="number" class="form-control" id="downloadLimit" value="100" min="1">
                                    <small class="form-text text-muted">Un valore alto potrebbe richiedere molto tempo</small>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                                <button type="button" class="btn btn-primary" id="startDownloadBtn">
                                    <i class="bi bi-cloud-download"></i> Avvia download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Aggiungi modal al DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            downloadModal = document.getElementById('downloadModal');
            
            // Aggiungi event listener per il pulsante di avvio
            const startDownloadBtn = document.getElementById('startDownloadBtn');
            if (startDownloadBtn) {
                startDownloadBtn.addEventListener('click', function() {
                    const groupId = document.getElementById('downloadGroupId').value;
                    startDownload(groupId);
                    
                    // Chiudi modal
                    const modal = bootstrap.Modal.getInstance(downloadModal);
                    if (modal) {
                        modal.hide();
                    }
                });
            }
        }
        
        // Aggiorna dati nel modal
        const downloadGroupId = document.getElementById('downloadGroupId');
        const downloadGroupName = document.getElementById('downloadGroupName');
        const downloadUserPhone = document.getElementById('downloadUserPhone');
        
        if (downloadGroupId && downloadGroupName && downloadUserPhone) {
            downloadGroupId.value = groupId;
            downloadGroupName.textContent = groupName;
            downloadUserPhone.value = userPhone;
            
            // Mostra modal
            const modalInstance = new bootstrap.Modal(downloadModal);
            modalInstance.show();
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del modal di download:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del modal di download', 'danger');
    }
}

// Mostra modal per archiviazione
function showArchiveModal(groupId, groupName, userPhone) {
    try {
        // Verifica che esista un modal per l'archiviazione
        let archiveModal = document.getElementById('archiveModal');
        
        // Se il modal non esiste, crealo
        if (!archiveModal) {
            const modalHtml = `
                <div class="modal fade" id="archiveModal" tabindex="-1" aria-labelledby="archiveModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="archiveModalLabel">Archiviazione Gruppo</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p>Crea un archivio completo dei media dal gruppo <span id="archiveGroupName" class="fw-bold"></span>.</p>
                                <input type="hidden" id="archiveGroupId">
                                <input type="hidden" id="archiveUserPhone" value="${userPhone}">
                                
                                <div class="alert alert-warning">
                                    <i class="bi bi-exclamation-triangle"></i> Attenzione: l'archiviazione completa di un gruppo può richiedere molto tempo e spazio su disco.
                                </div>
                                
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" id="archivePhoto" checked>
                                    <label class="form-check-label" for="archivePhoto">
                                        <i class="bi bi-image"></i> Archivia immagini
                                    </label>
                                </div>
                                
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" id="archiveVideo" checked>
                                    <label class="form-check-label" for="archiveVideo">
                                        <i class="bi bi-film"></i> Archivia video
                                    </label>
                                </div>
                                
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" id="archiveMessages" checked>
                                    <label class="form-check-label" for="archiveMessages">
                                        <i class="bi bi-chat-text"></i> Salva messaggi
                                    </label>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="archiveLimit" class="form-label">Limite messaggi (0 = tutti)</label>
                                    <input type="number" class="form-control" id="archiveLimit" value="0" min="0">
                                    <small class="form-text text-muted">Un valore pari a 0 scaricherà tutti i messaggi del gruppo</small>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                                <button type="button" class="btn btn-primary" id="startArchiveBtn">
                                    <i class="bi bi-archive"></i> Avvia archiviazione
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Aggiungi modal al DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            archiveModal = document.getElementById('archiveModal');
            
            // Aggiungi event listener per il pulsante di avvio
            const startArchiveBtn = document.getElementById('startArchiveBtn');
            if (startArchiveBtn) {
                startArchiveBtn.addEventListener('click', function() {
                    const groupId = document.getElementById('archiveGroupId').value;
                    startArchive(groupId);
                    
                    // Chiudi modal
                    const modal = bootstrap.Modal.getInstance(archiveModal);
                    if (modal) {
                        modal.hide();
                    }
                });
            }
        }
        
        // Aggiorna dati nel modal
        const archiveGroupId = document.getElementById('archiveGroupId');
        const archiveGroupName = document.getElementById('archiveGroupName');
        const archiveUserPhone = document.getElementById('archiveUserPhone');
        
        if (archiveGroupId && archiveGroupName && archiveUserPhone) {
            archiveGroupId.value = groupId;
            archiveGroupName.textContent = groupName;
            archiveUserPhone.value = userPhone;
            
            // Mostra modal
            const modalInstance = new bootstrap.Modal(archiveModal);
            modalInstance.show();
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del modal di archiviazione:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del modal di archiviazione', 'danger');
    }
}

// Ottieni link di invito per un gruppo
function getInviteLink(userPhone, groupId) {
    try {
        // Verifica che esista un modal per il link di invito
        let inviteLinkModal = document.getElementById('inviteLinkModal');
        
        // Se il modal non esiste, crealo
        if (!inviteLinkModal) {
            const modalHtml = `
                <div class="modal fade" id="inviteLinkModal" tabindex="-1" aria-labelledby="inviteLinkModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="inviteLinkModalLabel">Link di invito</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div id="inviteLinkSpinner">
                                    <div class="d-flex justify-content-center">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Caricamento...</span>
                                        </div>
                                    </div>
                                    <p class="text-center mt-2">Generazione link in corso...</p>
                                </div>
                                <div id="inviteLinkContent" class="d-none">
                                    <div class="alert alert-info">
                                        <i class="bi bi-info-circle"></i> Usa questo link per invitare altri utenti nel gruppo:
                                    </div>
                                    <div class="input-group mb-3">
                                        <input type="text" class="form-control" id="inviteLinkInput" readonly>
                                        <button class="btn btn-outline-primary" type="button" id="copyInviteLinkBtn">
                                            <i class="bi bi-clipboard"></i> Copia
                                        </button>
                                    </div>
                                </div>
                                <div id="inviteLinkError" class="d-none">
                                    <div class="alert alert-danger">
                                        <i class="bi bi-exclamation-triangle"></i> Impossibile generare il link di invito.
                                        <span id="inviteLinkErrorMessage"></span>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Aggiungi modal al DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            inviteLinkModal = document.getElementById('inviteLinkModal');
            
            // Aggiungi event listener per il pulsante di copia
            const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
            if (copyInviteLinkBtn) {
                copyInviteLinkBtn.addEventListener('click', function() {
                    const inviteLinkInput = document.getElementById('inviteLinkInput');
                    if (inviteLinkInput) {
                        inviteLinkInput.select();
                        document.execCommand('copy');
                        
                        // Cambia testo pulsante temporaneamente
                        const originalText = this.innerHTML;
                        this.innerHTML = '<i class="bi bi-check"></i> Copiato!';
                        
                        setTimeout(() => {
                            this.innerHTML = originalText;
                        }, 2000);
                    }
                });
            }
        }
        
        // Reset modal
        const inviteLinkSpinner = document.getElementById('inviteLinkSpinner');
        const inviteLinkContent = document.getElementById('inviteLinkContent');
        const inviteLinkError = document.getElementById('inviteLinkError');
        const inviteLinkInput = document.getElementById('inviteLinkInput');
        const inviteLinkErrorMessage = document.getElementById('inviteLinkErrorMessage');
        
        if (inviteLinkSpinner && inviteLinkContent && inviteLinkError && inviteLinkInput && inviteLinkErrorMessage) {
            inv alert-danger mt-2">
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
                    <div class="alert