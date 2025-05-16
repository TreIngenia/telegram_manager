/**
 * group-manager.js
 * Gestione dei gruppi Telegram per l'applicazione
 */

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
        
        // Aggiungi event listener per le card appena create
        initGroupCardEventListeners();
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
                        <button class="btn btn-sm btn-secondary btn-invite-link" data-group-id="${group.id}">
                            <i class="bi bi-link-45deg"></i> Link invito
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return groupDiv;
    } catch (e) {
        console.error("Errore nella creazione della card gruppo:", e);
        return document.createElement('div');
    }
}

// Inizializza event listener per le card dei gruppi
function initGroupCardEventListeners() {
    try {
        // Ottieni utente selezionato
        const selectedUserElement = document.getElementById('monitorUserPhone') || 
                                   document.getElementById('downloadUserPhone') || 
                                   document.getElementById('archiveUserPhone');
        const selectedUser = selectedUserElement ? selectedUserElement.value : '';
        
        // Aggiungi event listener per pulsanti delle card dei gruppi
        document.querySelectorAll('.btn-monitor').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
                showMonitorModal(groupId, groupName);
            });
        });
        
        document.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
                showDownloadModal(groupId, groupName);
            });
        });
        
        document.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                const groupName = this.closest('.group-card').querySelector('.card-title').textContent.trim();
                showArchiveModal(groupId, groupName);
            });
        });
        
        document.querySelectorAll('.btn-invite-link').forEach(btn => {
            btn.addEventListener('click', function() {
                const groupId = this.dataset.groupId;
                getInviteLink(selectedUser, groupId);
            });
        });
    } catch (e) {
        console.error("Errore nell'inizializzazione degli event listener per le card dei gruppi:", e);
    }
}

// Carica gruppi di un utente
function loadUserGroups(userPhone) {
    try {
        if (!userPhone) return;
        
        // Mostra spinner nel container gruppi
        const groupsContainer = document.getElementById('groupsContainer');
        if (groupsContainer) {
            groupsContainer.innerHTML = `
                <div class="d-flex justify-content-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Caricamento gruppi...</span>
                    </div>
                </div>
                <p class="text-center mt-2">Caricamento gruppi in corso...</p>
            `;
        }
        
        // Esegui richiesta API
        fetch(`/api/groups/${userPhone}`)
            .then(response => response.json())
            .then(groups => {
                // Aggiorna lista gruppi
                updateGroupList(groups);
            })
            .catch(error => {
                console.error('Errore nel caricamento dei gruppi:', error);
                
                if (groupsContainer) {
                    groupsContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="bi bi-exclamation-triangle"></i> Errore nel caricamento dei gruppi.
                            ${error.message || ''}
                        </div>
                    `;
                }
            });
    } catch (e) {
        console.error("Errore nel caricamento dei gruppi:", e);
        showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
    }
}

// Carica gruppi di un utente per il download
function loadUserGroupsForDownload(userPhone) {
    const groupSelect = document.getElementById('downloadGroupSelect');
    const startDownloadBtn = document.querySelector('.btn-start-download');
    
    if (!groupSelect) return;
    
    // Disabilita la select e imposta messaggio di caricamento
    groupSelect.disabled = true;
    groupSelect.innerHTML = '<option value="">Caricamento gruppi...</option>';
    
    // Esegui richiesta API
    fetch(`/api/groups/${userPhone}`)
        .then(response => response.json())
        .then(groups => {
            // Aggiorna select dei gruppi
            groupSelect.innerHTML = '<option value="">Seleziona gruppo</option>';
            
            if (groups.length === 0) {
                groupSelect.innerHTML += '<option value="" disabled>Nessun gruppo trovato</option>';
                groupSelect.disabled = true;
                if (startDownloadBtn) startDownloadBtn.disabled = true;
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
                if (startDownloadBtn) startDownloadBtn.disabled = true;
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dei gruppi:', error);
            
            // Mostra errore nella select
            groupSelect.innerHTML = '<option value="">Errore nel caricamento dei gruppi</option>';
            groupSelect.disabled = true;
            if (startDownloadBtn) startDownloadBtn.disabled = true;
            
            // Mostra notifica
            showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
        });
}

// Carica gruppi di un utente per l'archiviazione
function loadUserGroupsForArchive(userPhone) {
    const groupSelect = document.getElementById('archiveGroupSelect');
    const startArchiveBtn = document.querySelector('.btn-start-archive');
    
    if (!groupSelect) return;
    
    // Disabilita la select e imposta messaggio di caricamento
    groupSelect.disabled = true;
    groupSelect.innerHTML = '<option value="">Caricamento gruppi...</option>';
    
    // Esegui richiesta API
    fetch(`/api/groups/${userPhone}`)
        .then(response => response.json())
        .then(groups => {
            // Aggiorna select dei gruppi
            groupSelect.innerHTML = '<option value="">Seleziona gruppo</option>';
            
            if (groups.length === 0) {
                groupSelect.innerHTML += '<option value="" disabled>Nessun gruppo trovato</option>';
                groupSelect.disabled = true;
                if (startArchiveBtn) startArchiveBtn.disabled = true;
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
                if (startArchiveBtn) startArchiveBtn.disabled = true;
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dei gruppi:', error);
            
            // Mostra errore nella select
            groupSelect.innerHTML = '<option value="">Errore nel caricamento dei gruppi</option>';
            groupSelect.disabled = true;
            if (startArchiveBtn) startArchiveBtn.disabled = true;
            
            // Mostra notifica
            showNotification('Errore', 'Si è verificato un errore durante il caricamento dei gruppi', 'danger');
        });
}

// Mostra modal per monitoraggio
function showMonitorModal(groupId, groupName) {
    const monitorModal = document.getElementById('monitorModal');
    const monitorGroupId = document.getElementById('monitorGroupId');
    const monitorGroupName = document.getElementById('monitorGroupName');
    
    if (monitorModal && monitorGroupId && monitorGroupName) {
        monitorGroupId.value = groupId;
        monitorGroupName.textContent = groupName;
        
        const modalInstance = new bootstrap.Modal(monitorModal);
        modalInstance.show();
    }
}

// Mostra modal per download
function showDownloadModal(groupId, groupName) {
    const downloadModal = document.getElementById('downloadModal');
    const downloadGroupId = document.getElementById('downloadGroupId');
    const downloadGroupName = document.getElementById('downloadGroupName');
    
    if (downloadModal && downloadGroupId && downloadGroupName) {
        downloadGroupId.value = groupId;
        downloadGroupName.textContent = groupName;
        
        const modalInstance = new bootstrap.Modal(downloadModal);
        modalInstance.show();
    }
}

// Mostra modal per archiviazione
function showArchiveModal(groupId, groupName) {
    const archiveModal = document.getElementById('archiveModal');
    const archiveGroupId = document.getElementById('archiveGroupId');
    const archiveGroupName = document.getElementById('archiveGroupName');
    
    if (archiveModal && archiveGroupId && archiveGroupName) {
        archiveGroupId.value = groupId;
        archiveGroupName.textContent = groupName;
        
        const modalInstance = new bootstrap.Modal(archiveModal);
        modalInstance.show();
    }
}

// Ottieni link di invito
function getInviteLink(userPhone, groupId) {
    // Mostra modal
    const inviteLinkModal = document.getElementById('inviteLinkModal');
    const inviteLinkSpinner = document.getElementById('inviteLinkSpinner');
    const inviteLinkContent = document.getElementById('inviteLinkContent');
    const inviteLinkError = document.getElementById('inviteLinkError');
    const inviteLinkInput = document.getElementById('inviteLinkInput');
    const inviteLinkErrorMessage = document.getElementById('inviteLinkErrorMessage');
    
    if (inviteLinkModal && inviteLinkSpinner && inviteLinkContent && inviteLinkError && inviteLinkInput && inviteLinkErrorMessage) {
        // Reset modal
        inviteLinkSpinner.classList.remove('d-none');
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
}

// Esporta funzioni
window.loadUserGroups = loadUserGroups;
window.loadUserGroupsForDownload = loadUserGroupsForDownload;
window.loadUserGroupsForArchive = loadUserGroupsForArchive;
window.updateGroupList = updateGroupList;
window.createGroupCard = createGroupCard;
window.showMonitorModal = showMonitorModal;
window.showDownloadModal = showDownloadModal;
window.showArchiveModal = showArchiveModal;
window.getInviteLink = getInviteLink;