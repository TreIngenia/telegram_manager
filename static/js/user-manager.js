/**
 * user-manager.js
 * Gestione degli utenti Telegram per l'applicazione
 */

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

// Aggiungi un nuovo utente
function addUser() {
    try {
        // Ottieni numero di telefono
        const phoneInput = document.getElementById('newUserPhone');
        if (!phoneInput) return;
        
        const phone = phoneInput.value.trim();
        if (!phone) {
            showNotification('Errore', 'Inserisci un numero di telefono valido', 'danger');
            return;
        }
        
        // Mostra modal caricamento
        showSpinner("Aggiunta utente", "Connessione a Telegram in corso...");
        
        // Esegui richiesta API
        fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: `+${phone}` })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Utente aggiunto con successo
                    showNotification('Successo', 'Utente aggiunto con successo', 'success');
                    
                    // Aggiorna lista utenti
                    window.location.reload();
                } else if (data.status === 'code_sent') {
                    // Codice inviato, mostra dialog per inserimento codice
                    showVerificationCodeDialog(data.phone);
                } else if (data.status === 'password_required') {
                    // Richiesta password 2FA, mostra dialog per inserimento password
                    show2FAPasswordDialog(data.phone);
                } else {
                    // Errore generico
                    showNotification('Errore', data.message || 'Errore durante l\'aggiunta dell\'utente', 'danger');
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
        console.error("Errore nell'aggiunta dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'aggiunta dell\'utente', 'danger');
    }
}

// Rimuovi un utente
function removeUser(phone) {
    try {
        if (!phone) return;
        
        // Mostra spinner
        showSpinner("Rimozione utente", "Rimozione dell'utente in corso...");
        
        // Esegui richiesta API
        fetch('/api/users', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: phone })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Utente rimosso con successo
                    showNotification('Successo', 'Utente rimosso con successo', 'success');
                    
                    // Rimuovi card utente dalla UI
                    const userCard = document.querySelector(`.user-card[data-phone="${phone}"]`);
                    if (userCard) {
                        const parentCol = userCard.closest('.col-md-4');
                        if (parentCol) {
                            parentCol.remove();
                        }
                    }
                    
                    // Se non ci sono più utenti, mostra messaggio
                    const usersContainer = document.getElementById('usersContainer');
                    if (usersContainer && !usersContainer.querySelector('.user-card')) {
                        usersContainer.innerHTML = '<div class="alert alert-info">Nessun utente registrato</div>';
                    }
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante la rimozione dell\'utente', 'danger');
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
        console.error("Errore nella rimozione dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante la rimozione dell\'utente', 'danger');
    }
}

// Mostra dialog per inserimento codice di verifica
function showVerificationCodeDialog(phone) {
    try {
        // Crea modal dinamicamente
        const modalId = 'verificationCodeModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', `${modalId}Label`);
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}Label">Verifica Telegram</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Telegram ha inviato un codice di verifica al tuo numero ${phone}.</p>
                            <p>Inserisci il codice ricevuto:</p>
                            <input type="text" class="form-control" id="verificationCode" placeholder="Codice" maxlength="5">
                            <input type="hidden" id="verificationPhone" value="${phone}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="submitVerificationCode">Verifica</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            // Aggiorna phone se modal già esistente
            const phoneInput = modal.querySelector('#verificationPhone');
            if (phoneInput) {
                phoneInput.value = phone;
            }
        }
        
        // Inizializza modal
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Aggiungi event listener per submit
        const submitBtn = document.getElementById('submitVerificationCode');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                const code = document.getElementById('verificationCode').value.trim();
                const phone = document.getElementById('verificationPhone').value;
                
                if (!code) {
                    showNotification('Errore', 'Inserisci il codice di verifica', 'danger');
                    return;
                }
                
                // Chiudi modal
                modalInstance.hide();
                
                // Invia codice
                submitVerificationCode(phone, code);
            });
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del dialog di verifica:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del dialog di verifica', 'danger');
    }
}

// Mostra dialog per inserimento password 2FA
function show2FAPasswordDialog(phone) {
    try {
        // Crea modal dinamicamente
        const modalId = 'twoFAPasswordModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', `${modalId}Label`);
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="${modalId}Label">Autenticazione a due fattori</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Il tuo account Telegram richiede l'autenticazione a due fattori.</p>
                            <p>Inserisci la password 2FA:</p>
                            <input type="password" class="form-control" id="twoFAPassword" placeholder="Password">
                            <input type="hidden" id="twoFAPhone" value="${phone}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="submitTwoFAPassword">Verifica</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            // Aggiorna phone se modal già esistente
            const phoneInput = modal.querySelector('#twoFAPhone');
            if (phoneInput) {
                phoneInput.value = phone;
            }
        }
        
        // Inizializza modal
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        // Aggiungi event listener per submit
        const submitBtn = document.getElementById('submitTwoFAPassword');
        if (submitBtn) {
            submitBtn.addEventListener('click', function() {
                const password = document.getElementById('twoFAPassword').value.trim();
                const phone = document.getElementById('twoFAPhone').value;
                
                if (!password) {
                    showNotification('Errore', 'Inserisci la password 2FA', 'danger');
                    return;
                }
                
                // Chiudi modal
                modalInstance.hide();
                
                // Invia password
                submitTwoFAPassword(phone, password);
            });
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del dialog 2FA:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del dialog 2FA', 'danger');
    }
}

// Invia codice di verifica
function submitVerificationCode(phone, code) {
    try {
        // Mostra spinner
        showSpinner("Verifica codice", "Verifica del codice in corso...");
        
        // Esegui richiesta API
        fetch('/api/users/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: phone, code: code })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Verifica completata con successo
                    showNotification('Successo', 'Utente verificato con successo', 'success');
                    
                    // Aggiorna lista utenti
                    window.location.reload();
                } else if (data.status === 'password_required') {
                    // Richiesta password 2FA
                    show2FAPasswordDialog(phone);
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante la verifica del codice', 'danger');
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
        console.error("Errore nell'invio del codice di verifica:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'invio del codice di verifica', 'danger');
    }
}

// Invia password 2FA
function submitTwoFAPassword(phone, password) {
    try {
        // Mostra spinner
        showSpinner("Verifica password", "Verifica della password in corso...");
        
        // Esegui richiesta API
        fetch('/api/users/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: phone, password: password })
        })
            .then(response => response.json())
            .then(data => {
                // Nascondi spinner
                hideSpinner();
                
                if (data.success) {
                    // Verifica completata con successo
                    showNotification('Successo', 'Utente verificato con successo', 'success');
                    
                    // Aggiorna lista utenti
                    window.location.reload();
                } else {
                    // Errore
                    showNotification('Errore', data.message || 'Errore durante la verifica della password', 'danger');
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
        console.error("Errore nell'invio della password 2FA:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'invio della password 2FA', 'danger');
    }
}

// Carica utenti attivi (per dashboard)
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

// Mostra spinner di caricamento
function showSpinner(title, message) {
    // Crea modal spinner dinamicamente
    const modalId = 'spinnerModal';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('data-bs-backdrop', 'static');
        modal.setAttribute('data-bs-keyboard', 'false');
        
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${modalId}Title"></h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="d-flex justify-content-center mb-3">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Caricamento...</span>
                            </div>
                        </div>
                        <p id="${modalId}Message"></p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Aggiorna contenuto
    const modalTitle = document.getElementById(`${modalId}Title`);
    const modalMessage = document.getElementById(`${modalId}Message`);
    
    if (modalTitle) modalTitle.textContent = title || 'Caricamento';
    if (modalMessage) modalMessage.textContent = message || 'Operazione in corso...';
    
    // Mostra modal
    const spinnerModal = new bootstrap.Modal(modal);
    spinnerModal.show();
    
    // Salva istanza per poterla chiudere
    window.currentSpinnerModal = spinnerModal;
}

// Nascondi spinner di caricamento
function hideSpinner() {
    if (window.currentSpinnerModal) {
        window.currentSpinnerModal.hide();
        window.currentSpinnerModal = null;
    }
}

// Esporta funzioni
window.addUser = addUser;
window.removeUser = removeUser;
window.loadActiveUsers = loadActiveUsers;
window.updateUserStatus = updateUserStatus;