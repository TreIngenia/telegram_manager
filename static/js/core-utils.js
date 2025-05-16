/**
 * core-utils.js
 * Funzioni di utilità core dell'applicazione Telegram Manager
 */

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
        
        // Inizializza sidebar toggle
        const sidebarCollapse = document.getElementById('sidebarCollapse');
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('content');
        
        if (sidebarCollapse && sidebar && content) {
            sidebarCollapse.addEventListener('click', function() {
                sidebar.classList.toggle('active');
                content.classList.toggle('active');
            });
        }
        
        console.log("Componenti Bootstrap inizializzati");
    } catch (e) {
        console.error("Errore nell'inizializzazione dei componenti Bootstrap:", e);
    }
}

// Inizializza impostazioni dell'applicazione
function initSettings() {
    try {
        // Carica impostazioni salvate
        const savedSettings = JSON.parse(localStorage.getItem('telegramManagerSettings')) || {};
        
        // Impostazioni di default
        const defaultSettings = {
            maxDownloads: 3,
            notificationsEnabled: true,
            darkMode: false
        };
        
        // Unisci impostazioni salvate con quelle di default
        const settings = {...defaultSettings, ...savedSettings};
        
        // Salva in window per accesso globale
        window.appSettings = settings;
        
        // Aggiorna UI in base alle impostazioni
        updateSettingsUI(settings);
        
        // Aggiungi event listener per salvataggio impostazioni
        const saveSettingsBtn = document.getElementById('saveSettings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveSettings);
        }
        
        // Applica tema
        applyTheme(settings.darkMode);
        
        console.log("Impostazioni inizializzate:", settings);
    } catch (e) {
        console.error("Errore nell'inizializzazione delle impostazioni:", e);
    }
}

// Aggiorna UI in base alle impostazioni
function updateSettingsUI(settings) {
    // Aggiorna campi della modal settings
    const maxDownloadsInput = document.getElementById('maxDownloads');
    if (maxDownloadsInput) {
        maxDownloadsInput.value = settings.maxDownloads;
    }
    
    const notificationsEnabledInput = document.getElementById('notificationsEnabled');
    if (notificationsEnabledInput) {
        notificationsEnabledInput.checked = settings.notificationsEnabled;
    }
    
    const darkModeInput = document.getElementById('darkMode');
    if (darkModeInput) {
        darkModeInput.checked = settings.darkMode;
    }
}

// Salva impostazioni
function saveSettings() {
    try {
        // Ottieni valori dai campi
        const maxDownloadsInput = document.getElementById('maxDownloads');
        const notificationsEnabledInput = document.getElementById('notificationsEnabled');
        const darkModeInput = document.getElementById('darkMode');
        
        // Crea oggetto impostazioni
        const settings = {
            maxDownloads: parseInt(maxDownloadsInput?.value || 3),
            notificationsEnabled: notificationsEnabledInput?.checked || true,
            darkMode: darkModeInput?.checked || false
        };
        
        // Salva impostazioni nel localStorage
        localStorage.setItem('telegramManagerSettings', JSON.stringify(settings));
        
        // Aggiorna impostazioni globali
        window.appSettings = settings;
        
        // Applica tema
        applyTheme(settings.darkMode);
        
        // Chiudi modal
        const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        if (settingsModal) {
            settingsModal.hide();
        }
        
        // Mostra notifica
        showNotification('Impostazioni', 'Impostazioni salvate con successo', 'success');
        
        console.log("Impostazioni salvate:", settings);
    } catch (e) {
        console.error("Errore nel salvataggio delle impostazioni:", e);
        showNotification('Errore', 'Si è verificato un errore durante il salvataggio delle impostazioni', 'danger');
    }
}

// Applica tema (chiaro/scuro)
function applyTheme(darkMode) {
    if (darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

// Inizializza gestore eventi UI
function initUIEventHandlers() {
    try {
        // Gestisci click sul pulsante di riconnessione WebSocket
        const reconnectWsBtn = document.getElementById('reconnectWs');
        if (reconnectWsBtn) {
            reconnectWsBtn.addEventListener('click', function() {
                if (window.socket) {
                    // Disconnetti e ricrea socket
                    window.socket.disconnect();
                    initSocketIO();
                    showNotification('WebSocket', 'Riconnessione in corso...', 'info');
                }
            });
        }
        
        // Gestione della conferma nelle modal
        const confirmationModal = document.getElementById('confirmationModal');
        if (confirmationModal) {
            // Salva la callback di conferma
            confirmationModal.addEventListener('show.bs.modal', function(event) {
                const button = event.relatedTarget;
                const callback = button.dataset.callback;
                
                if (callback && typeof window[callback] === 'function') {
                    document.getElementById('confirmAction').dataset.callback = callback;
                }
            });
            
            // Esegui la callback quando confermato
            const confirmBtn = document.getElementById('confirmAction');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', function() {
                    const callback = this.dataset.callback;
                    const callbackArgs = this.dataset.callbackArgs;
                    
                    // Chiudi modal
                    const modal = bootstrap.Modal.getInstance(confirmationModal);
                    if (modal) {
                        modal.hide();
                    }
                    
                    // Esegui callback se presente
                    if (callback && typeof window[callback] === 'function') {
                        if (callbackArgs) {
                            window[callback](JSON.parse(callbackArgs));
                        } else {
                            window[callback]();
                        }
                    }
                });
            }
        }
        
        console.log("Event handler UI inizializzati");
    } catch (e) {
        console.error("Errore nell'inizializzazione degli event handler UI:", e);
    }
}

// Mostra modal di conferma
function showConfirmationModal(title, message, confirmCallback, args) {
    try {
        const confirmationModal = document.getElementById('confirmationModal');
        const confirmationModalLabel = document.getElementById('confirmationModalLabel');
        const confirmationMessage = document.getElementById('confirmationMessage');
        const confirmAction = document.getElementById('confirmAction');
        
        if (confirmationModal && confirmationModalLabel && confirmationMessage && confirmAction) {
            // Imposta titolo e messaggio
            confirmationModalLabel.textContent = title;
            confirmationMessage.textContent = message;
            
            // Salva callback
            if (typeof confirmCallback === 'function') {
                window.tempConfirmCallback = confirmCallback;
                confirmAction.dataset.callback = 'tempConfirmCallback';
            } else if (typeof confirmCallback === 'string') {
                confirmAction.dataset.callback = confirmCallback;
            }
            
            // Salva argomenti
            if (args) {
                confirmAction.dataset.callbackArgs = JSON.stringify(args);
            } else {
                delete confirmAction.dataset.callbackArgs;
            }
            
            // Mostra modal
            const modal = new bootstrap.Modal(confirmationModal);
            modal.show();
        }
    } catch (e) {
        console.error("Errore nella visualizzazione della modal di conferma:", e);
    }
}

// Inizializza sistema di notifiche
function initNotifications() {
    try {
        console.log("Sistema di notifiche inizializzato");
    } catch (e) {
        console.error("Errore nell'inizializzazione del sistema di notifiche:", e);
    }
}

// Mostra notifica toast
function showNotification(title, message, type = 'info') {
    try {
        // Controlla se le notifiche sono abilitate
        if (window.appSettings && !window.appSettings.notificationsEnabled) {
            return;
        }
        
        const notificationToast = document.getElementById('notificationToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastTime = document.getElementById('toastTime');
        
        if (notificationToast && toastTitle && toastMessage) {
            // Imposta contenuto
            toastTitle.textContent = title;
            toastMessage.textContent = message;
            
            // Imposta orario
            if (toastTime) {
                toastTime.textContent = new Date().toLocaleTimeString();
            }
            
            // Imposta classe in base al tipo
            notificationToast.className = 'toast';
            notificationToast.classList.add(`border-${type}`);
            
            // Crea istanza toast e mostra
            const toast = new bootstrap.Toast(notificationToast);
            toast.show();
        }
    } catch (e) {
        console.error("Errore nella visualizzazione della notifica:", e);
    }
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

// Formatta numero con separatore migliaia
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Esporta funzioni
window.initBootstrapComponents = initBootstrapComponents;
window.initSettings = initSettings;
window.initUIEventHandlers = initUIEventHandlers;
window.initNotifications = initNotifications;
window.showNotification = showNotification;
window.showConfirmationModal = showConfirmationModal;
window.formatBytes = formatBytes;
window.formatNumber = formatNumber;