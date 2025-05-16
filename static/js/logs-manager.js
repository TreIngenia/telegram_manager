/**
 * logs-manager.js
 * Gestione dei file di log dell'applicazione
 */

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
        
        if (errorsContainer) {
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
        }
    } catch (e) {
        console.error("Errore nel caricamento degli errori recenti:", e);
    }
}

// Inizializza gli eventi della pagina logs
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
    
    // Aggiungi event listener per pulsante pulizia filtro
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            const logFilterInput = document.getElementById('logFilter');
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
            const logFileSelect = document.getElementById('logFileSelect');
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
    
    // Carica errori recenti
    loadRecentErrors();
    
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

// Esporta funzioni
window.loadLogContent = loadLogContent;
window.filterLogContent = filterLogContent;
window.downloadLogFile = downloadLogFile;
window.loadRecentErrors = loadRecentErrors;
window.initLogsPage = initLogsPage;