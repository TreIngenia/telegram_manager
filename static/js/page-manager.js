/**
 * page-manager.js
 * Gestisce il caricamento delle pagine specifiche dell'applicazione
 */

// Funzione per caricare script specifici per la pagina corrente
function loadPageSpecificScripts() {
    // Ottieni il nome della pagina corrente
    const path = window.location.pathname;
    
    // Inizializza la pagina in base al path
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

// Inizializza pagina degli utenti
function initUsersPage() {
    console.log('Inizializzazione pagina utenti');
    
    // Gestisci l'invio del form di aggiunta utente
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addUser();
        });
    }
    
    // Aggiungi event listener per il pulsante di aggiunta utente
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

// Inizializza pagina dei gruppi
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
    
    // Inizializza event listeners per le card dei gruppi
    initGroupCardEventListeners();
    
    // Aggiungi event listener per i pulsanti delle modali
    initGroupModalsEventListeners();
    
    // Aggiungi event listener per il pulsante copia link
    initCopyInviteLinkEventListener();
}

// Inizializza i pulsanti delle modali dei gruppi
function initGroupModalsEventListeners() {
    // Pulsante di avvio monitoraggio
    const startMonitorBtn = document.getElementById('startMonitorBtn');
    if (startMonitorBtn) {
        startMonitorBtn.addEventListener('click', function() {
            const groupId = document.getElementById('monitorGroupId').value;
            startMonitoring([groupId]);
            
            // Chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('monitorModal'));
            if (modal) {
                modal.hide();
            }
        });
    }
    
    // Pulsante di avvio download
    const startDownloadBtn = document.getElementById('startDownloadBtn');
    if (startDownloadBtn) {
        startDownloadBtn.addEventListener('click', function() {
            const groupId = document.getElementById('downloadGroupId').value;
            startDownload(groupId);
            
            // Chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('downloadModal'));
            if (modal) {
                modal.hide();
            }
        });
    }
    
    // Pulsante di avvio archiviazione
    const startArchiveBtn = document.getElementById('startArchiveBtn');
    if (startArchiveBtn) {
        startArchiveBtn.addEventListener('click', function() {
            const groupId = document.getElementById('archiveGroupId').value;
            startArchive(groupId);
            
            // Chiudi modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('archiveModal'));
            if (modal) {
                modal.hide();
            }
        });
    }
}

// Inizializza event listener per copia link invito
function initCopyInviteLinkEventListener() {
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

// Inizializza pagina di monitoraggio
function initMonitorPage() {
    console.log('Inizializzazione pagina monitoraggio');
    
    // Ottieni utente selezionato
    const monitorUserSelect = document.getElementById('monitorUserSelect');
    if (monitorUserSelect) {
        monitorUserSelect.addEventListener('change', function() {
            // Aggiorna l'utente selezionato per il monitoraggio
            const userPhone = this.value;
            const monitorUserPhoneInput = document.getElementById('monitorUserPhone');
            if (monitorUserPhoneInput) {
                monitorUserPhoneInput.value = userPhone;
            }
        });
    }
    
    // Aggiungi event listener per pulsanti stop monitoraggio
    document.querySelectorAll('.btn-stop-monitor').forEach(btn => {
        btn.addEventListener('click', function() {
            const userPhone = this.dataset.user;
            stopMonitoring(userPhone);
        });
    });
}

// Inizializza pagina di download
function initDownloadPage() {
    console.log('Inizializzazione pagina download');
    
    // Ottieni utente selezionato
    const downloadUserSelect = document.getElementById('downloadUserSelect');
    if (downloadUserSelect) {
        downloadUserSelect.addEventListener('change', function() {
            const selectedUser = this.value;
            const downloadUserPhone = document.getElementById('downloadUserPhone');
            
            if (downloadUserPhone) {
                downloadUserPhone.value = selectedUser;
            }
            
            if (selectedUser) {
                // Carica gruppi dell'utente
                loadUserGroupsForDownload(selectedUser);
            }
        });
    }
    
    // Aggiungi event listener per cambio gruppo
    const downloadGroupSelect = document.getElementById('downloadGroupSelect');
    if (downloadGroupSelect) {
        downloadGroupSelect.addEventListener('change', function() {
            const selectedGroup = this.value;
            const startDownloadBtn = document.querySelector('.btn-start-download');
            
            // Abilita/disabilita pulsante avvio in base alla selezione
            if (startDownloadBtn) {
                startDownloadBtn.disabled = !selectedGroup;
            }
        });
    }
    
    // Aggiungi event listener per pulsante avvio download
    const startDownloadBtn = document.querySelector('.btn-start-download');
    if (startDownloadBtn) {
        startDownloadBtn.addEventListener('click', function() {
            // Ottieni gruppo selezionato
            const groupId = document.getElementById('downloadGroupSelect').value;
            startDownload(groupId);
        });
    }
    
    // Carica download completati
    loadCompletedDownloads();
    
    // Aggiungi event listener per pulsante aggiorna download completati
    const refreshCompletedBtn = document.getElementById('refreshCompletedBtn');
    if (refreshCompletedBtn) {
        refreshCompletedBtn.addEventListener('click', loadCompletedDownloads);
    }
}

// Inizializza pagina di archiviazione
function initArchivePage() {
    console.log('Inizializzazione pagina archiviazione');
    
    // Ottieni utente selezionato
    const archiveUserSelect = document.getElementById('archiveUserSelect');
    if (archiveUserSelect) {
        archiveUserSelect.addEventListener('change', function() {
            const selectedUser = this.value;
            const archiveUserPhone = document.getElementById('archiveUserPhone');
            
            if (archiveUserPhone) {
                archiveUserPhone.value = selectedUser;
            }
            
            if (selectedUser) {
                // Carica gruppi dell'utente
                loadUserGroupsForArchive(selectedUser);
            }
        });
    }
    
    // Aggiungi event listener per cambio gruppo
    const archiveGroupSelect = document.getElementById('archiveGroupSelect');
    if (archiveGroupSelect) {
        archiveGroupSelect.addEventListener('change', function() {
            const selectedGroup = this.value;
            const startArchiveBtn = document.querySelector('.btn-start-archive');
            
            // Abilita/disabilita pulsante avvio in base alla selezione
            if (startArchiveBtn) {
                startArchiveBtn.disabled = !selectedGroup;
            }
        });
    }
    
    // Aggiungi event listener per pulsante avvio archiviazione
    const startArchiveBtn = document.querySelector('.btn-start-archive');
    if (startArchiveBtn) {
        startArchiveBtn.addEventListener('click', function() {
            // Ottieni gruppo selezionato
            const groupId = document.getElementById('archiveGroupSelect').value;
            startArchive(groupId);
        });
    }
    
    // Carica archivi disponibili
    loadAvailableArchives();
    
    // Aggiungi event listener per pulsante aggiorna archivi
    const refreshArchivesBtn = document.getElementById('refreshArchivesBtn');
    if (refreshArchivesBtn) {
        refreshArchivesBtn.addEventListener('click', loadAvailableArchives);
    }
}

// Esporta funzioni
window.loadPageSpecificScripts = loadPageSpecificScripts;
window.initUsersPage = initUsersPage;
window.initGroupsPage = initGroupsPage;
window.initMonitorPage = initMonitorPage;
window.initDownloadPage = initDownloadPage;
window.initArchivePage = initArchivePage;