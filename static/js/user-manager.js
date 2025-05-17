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

//Aggiornamento manuale del codice di verifica
function setupManualCodeInput() {
    // Crea un nuovo bottone per inserimento manuale
    const addUserForm = document.getElementById('addUserForm');
    if (!addUserForm) return;
    
    // Verifica se esiste già il container
    let manualCodeContainer = document.getElementById('manualCodeInputContainer');
    if (manualCodeContainer) return;
    
    // Crea container per input manuale
    manualCodeContainer = document.createElement('div');
    manualCodeContainer.id = 'manualCodeInputContainer';
    manualCodeContainer.className = 'col-md-6 mt-3';
    manualCodeContainer.innerHTML = `
        <div class="card">
            <div class="card-header bg-info text-white">
                <h5 class="mb-0">Inserimento manuale codice</h5>
            </div>
            <div class="card-body">
                <p class="text-muted">Se non ricevi il codice sul telefono, puoi inserirlo manualmente qui:</p>
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="manualPhone" class="form-label">Numero di telefono</label>
                        <input type="text" class="form-control" id="manualPhone" placeholder="393xxxxxxxxx">
                    </div>
                    <div class="col-md-6">
                        <label for="manualCode" class="form-label">Codice di verifica</label>
                        <input type="text" class="form-control" id="manualCode" placeholder="12345">
                    </div>
                    <div class="col-12">
                        <button type="button" class="btn btn-info" id="submitManualCodeBtn">
                            <i class="bi bi-check-circle"></i> Verifica codice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Aggiungi elemento al form
    addUserForm.appendChild(manualCodeContainer);
    
    // Aggiungi event listener per il pulsante di verifica manuale
    const submitManualCodeBtn = document.getElementById('submitManualCodeBtn');
    if (submitManualCodeBtn) {
        submitManualCodeBtn.addEventListener('click', function() {
            const manualPhone = document.getElementById('manualPhone').value.trim();
            const manualCode = document.getElementById('manualCode').value.trim();
            
            if (!manualPhone || !manualCode) {
                showNotification('Errore', 'Inserisci sia il numero di telefono che il codice', 'danger');
                return;
            }
            
            // Cerca phone_code_hash nel localStorage o chiedi all'utente
            let phoneCodeHash = localStorage.getItem(`phoneCodeHash_${manualPhone}`);
            
            if (!phoneCodeHash) {
                // Prova a usare l'ultimo hash salvato per qualsiasi numero
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('phoneCodeHash_')) {
                        phoneCodeHash = localStorage.getItem(key);
                        break;
                    }
                }
            }
            
            if (!phoneCodeHash) {
                // Chiedi hash all'utente se non trovato
                phoneCodeHash = prompt("Inserisci il phone_code_hash (se lo conosci, altrimenti premi Annulla):");
                
                // Se l'utente annulla, usa metodo alternativo
                if (!phoneCodeHash) {
                    useAlternativeVerification(manualPhone, manualCode);
                    return;
                }
            }
            
            // Salva hash nel localStorage per usi futuri
            localStorage.setItem(`phoneCodeHash_${manualPhone}`, phoneCodeHash);
            
            // Effettua verifica
            submitVerificationCode(manualPhone, manualCode, phoneCodeHash);
        });
    }
}

// Metodo alternativo di verifica
function useAlternativeVerification(phone, code) {
    showSpinner("Verifica codice", "Tentativo alternativo di verifica del codice...");
    
    // Chiamata API modificata per un approccio alternativo
    fetch('/api/users/verify-alternative', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            phone: phone, 
            code: code
        })
    })
    .then(response => response.json())
    .then(data => {
        hideSpinner();
        
        console.log("Risposta verifica alternativa:", data);
        
        if (data.success) {
            showNotification('Successo', 'Utente verificato con successo', 'success');
            window.location.reload();
        } else {
            showNotification('Errore', data.message || 'Errore durante la verifica del codice', 'danger');
        }
    })
    .catch(error => {
        hideSpinner();
        console.error('Errore nella richiesta API:', error);
        showNotification('Errore', 'Si è verificato un errore durante la connessione al server', 'danger');
    });
}

// Aggiornamento della funzione di aggiunta utente per salvare phone_code_hash nel localStorage
function addUser() {
    try {
        // Ottieni numero di telefono
        const phoneInput = document.getElementById('newUserPhone');
        if (!phoneInput) return;
        
        let phone = phoneInput.value.trim();
        
        // Verifica formato base
        if (!phone) {
            showNotification('Errore', 'Inserisci un numero di telefono valido', 'danger');
            return;
        }
        
        // Format phone number properly
        if (phone.startsWith('+')) {
            phone = phone.substring(1); // Remove the '+' if present
        }
        
        // Rimuovi spazi
        phone = phone.replace(/\s/g, '');
        
        // Verifica che contenga solo cifre
        if (!/^\d+$/.test(phone)) {
            showNotification('Errore', 'Il numero di telefono deve contenere solo cifre', 'danger');
            return;
        }
        
        // Make sure it has correct international format
        if (!phone.match(/^\d{7,15}$/)) {
            showNotification('Errore', 'Il formato del numero non è valido. Usa il formato internazionale senza il "+", ad esempio: 393451234567', 'danger');
            return;
        }
        
        // Log registration attempt
        console.log(`Tentativo di registrazione per il numero: ${phone}`);
        
        // Mostra modal caricamento
        showSpinner("Aggiunta utente", "Connessione a Telegram in corso...");
        
        // Esegui richiesta API
        fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone: phone })
        })
        .then(response => {
            // Check if the response is OK
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Nascondi spinner
            hideSpinner();
            
            console.log("Risposta API addUser:", data);
            
            if (data.success) {
                // Utente aggiunto con successo
                showNotification('Successo', 'Utente aggiunto con successo', 'success');
                
                // Aggiorna lista utenti
                window.location.reload();
            } else if (data.status === 'code_sent') {
                // Codice inviato, mostra dialog per inserimento codice
                console.log(`Codice inviato a ${data.phone}, phone_code_hash: ${data.phone_code_hash}`);
                showNotification('Info', `Codice di verifica inviato a ${data.phone}`, 'info');
                
                // Salva phone_code_hash nel localStorage per poterlo recuperare in seguito
                if (data.phone_code_hash) {
                    localStorage.setItem(`phoneCodeHash_${data.phone}`, data.phone_code_hash);
                    console.log(`Hash salvato per ${data.phone}: ${data.phone_code_hash}`);
                }
                
                // Mostra sia il dialog standard che l'opzione di input manuale
                showVerificationCodeDialog(data.phone, data.phone_code_hash);
                setupManualCodeInput();
                
                // Precompila il campo del telefono nell'input manuale
                const manualPhoneInput = document.getElementById('manualPhone');
                if (manualPhoneInput) {
                    manualPhoneInput.value = data.phone;
                }
            } else if (data.status === 'password_required') {
                // Richiesta password 2FA, mostra dialog per inserimento password
                console.log("Password 2FA richiesta per:", data.phone);
                showNotification('Info', 'Password a due fattori richiesta', 'info');
                show2FAPasswordDialog(data.phone);
            } else if (data.status === 'flood_wait') {
                // Limite di tempo (FloodWait) di Telegram
                console.log(`FloodWait richiesto per ${data.phone} - Secondi: ${data.wait_seconds}`);
                showNotification('Attenzione', data.message || 'Limite di tempo raggiunto, riprova più tardi', 'warning');
                showFloodWaitModal(data.phone, data.message, data.wait_seconds);
                
                // Mostra anche l'input manuale come alternativa
                setupManualCodeInput();
                
                // Precompila il campo del telefono nell'input manuale
                const manualPhoneInput = document.getElementById('manualPhone');
                if (manualPhoneInput) {
                    manualPhoneInput.value = data.phone;
                }
            } else if (data.status === 'connection_error') {
                // Cannot connect to Telegram
                showNotification('Errore', 'Impossibile connettersi a Telegram. Verifica le credenziali API e la connessione Internet.', 'danger');
                
                // Mostra l'input manuale come alternativa
                setupManualCodeInput();
            } else if (data.status === 'user_exists') {
                // User already exists
                showNotification('Info', `L'utente ${data.phone} è già registrato`, 'info');
            } else {
                // Errore generico
                const errorMsg = data.message || 'Errore durante l\'aggiunta dell\'utente';
                console.error('Errore API:', data);
                showNotification('Errore', errorMsg, 'danger');
                
                // Mostra l'input manuale come fallback
                setupManualCodeInput();
                
                // Precompila il campo del telefono nell'input manuale
                const manualPhoneInput = document.getElementById('manualPhone');
                if (manualPhoneInput && data.phone) {
                    manualPhoneInput.value = data.phone;
                }
                
                // Show detailed error modal for debugging
                showErrorDetailsModal('Errore durante l\'aggiunta dell\'utente', errorMsg, data);
            }
        })
        .catch(error => {
            // Nascondi spinner
            hideSpinner();
            
            console.error('Errore nella richiesta API:', error);
            showNotification('Errore', 'Si è verificato un errore durante la connessione al server', 'danger');
            
            // Mostra l'input manuale come fallback
            setupManualCodeInput();
            
            // Show detailed error for debugging
            showErrorDetailsModal('Errore di connessione', error.message, { error: error.toString() });
        });
    } catch (e) {
        hideSpinner();
        console.error("Errore nell'aggiunta dell'utente:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'aggiunta dell\'utente', 'danger');
        
        // Mostra l'input manuale come fallback
        setupManualCodeInput();
    }
}

// Create detailed error modal for debugging
function showErrorDetailsModal(title, message, details) {
    // Create modal if it doesn't exist
    let errorModal = document.getElementById('errorDetailsModal');
    
    if (!errorModal) {
        errorModal = document.createElement('div');
        errorModal.id = 'errorDetailsModal';
        errorModal.className = 'modal fade';
        errorModal.setAttribute('tabindex', '-1');
        errorModal.setAttribute('aria-labelledby', 'errorDetailsModalLabel');
        errorModal.setAttribute('aria-hidden', 'true');
        
        document.body.appendChild(errorModal);
    }
    
    // Set modal content
    errorModal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title" id="errorDetailsModalLabel">${title}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger">${message}</div>
                    <h6>Dettagli tecnici:</h6>
                    <div class="json-viewer">
                        <pre>${JSON.stringify(details, null, 2)}</pre>
                    </div>
                    <div class="mt-3">
                        <p><strong>Suggerimenti per la risoluzione:</strong></p>
                        <ul>
                            <li>Verifica che le credenziali API di Telegram (API_ID e API_HASH) siano corrette nel file .env</li>
                            <li>Assicurati che il numero di telefono sia formattato correttamente</li>
                            <li>Controlla che non ci siano problemi di connessione alla rete</li>
                            <li>Verifica che l'account Telegram sia attivo e non abbia restrizioni</li>
                            <li>Controlla i log del server per maggiori dettagli</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                </div>
            </div>
        </div>
    `;
    
    // Show the modal
    try {
        const bsModal = new bootstrap.Modal(errorModal);
        bsModal.show();
    } catch (error) {
        console.error("Errore nell'inizializzazione della modale Bootstrap:", error);
        
        // Fallback manuale
        errorModal.classList.add('show');
        errorModal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Crea backdrop manualmente
        const backdropExists = document.querySelector('.modal-backdrop');
        if (!backdropExists) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    }
}

function showFloodWaitModal(phone, message, waitSeconds) {
    try {
        console.log("Mostrando modal FloodWait per:", phone);
        
        // Calcola data e ora quando sarà possibile riprovare
        const retryTime = new Date(Date.now() + waitSeconds * 1000);
        const formattedRetryTime = retryTime.toLocaleString();
        
        // Crea o trova la modal
        let modalId = 'floodWaitModal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'floodWaitModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="floodWaitModalLabel">Limite di tempo Telegram</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="bi bi-exclamation-triangle"></i> <strong>Attesa richiesta</strong>
                            </div>
                            <p id="floodWaitMessage">${message}</p>
                            <p>Potrai richiedere un nuovo codice a partire da:<br>
                            <strong id="floodWaitRetryTime">${formattedRetryTime}</strong></p>
                            <p class="mt-3">Questo è un limite imposto da Telegram per prevenire abusi del sistema di autenticazione.</p>
                            <hr>
                            <p>Se hai già un account autenticato in precedenza, puoi provare ad usare quello invece di crearne uno nuovo.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Chiudi</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            // Aggiorna contenuto se la modal esiste già
            const messageElem = modal.querySelector('#floodWaitMessage');
            const retryTimeElem = modal.querySelector('#floodWaitRetryTime');
            
            if (messageElem) messageElem.textContent = message;
            if (retryTimeElem) retryTimeElem.textContent = formattedRetryTime;
        }
        
        // Mostra la modal
        try {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            console.log("Modal FloodWait mostrata con bootstrap.Modal");
        } catch (error) {
            console.error("Errore nell'inizializzazione della modal Bootstrap:", error);
            
            // Fallback manuale
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Crea backdrop manualmente
            const backdropExists = document.querySelector('.modal-backdrop');
            if (!backdropExists) {
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            
            console.log("Modal FloodWait mostrata manualmente");
        }
    } catch (e) {
        console.error("Errore nella visualizzazione della modal FloodWait:", e);
        showNotification('Errore', message || 'È necessario attendere prima di richiedere un nuovo codice di verifica', 'warning');
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
// Improved version of the showVerificationCodeDialog function
function showVerificationCodeDialog(phone, phoneCodeHash) {
    try {
        console.log("Mostrando dialog di verifica per:", phone, "phone_code_hash:", phoneCodeHash);
        
        // Controlla se la modale esiste già, altrimenti la crea
        let modal = document.getElementById('verificationCodeModal');
        if (!modal) {
            console.log("Creazione modale di verifica per il codice");
            modal = document.createElement('div');
            modal.id = 'verificationCodeModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'verificationCodeModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            // Store phone_code_hash as data attribute for better retrieval later
            if (phoneCodeHash) {
                modal.dataset.phoneCodeHash = phoneCodeHash;
            }
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="verificationCodeModalLabel">Verifica Telegram</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Telegram ha inviato un codice di verifica al numero ${phone}.</p>
                            <p>Inserisci il codice ricevuto:</p>
                            <input type="text" class="form-control" id="verificationCode" placeholder="Codice" maxlength="5">
                            <input type="hidden" id="verificationPhone" value="${phone}">
                            <input type="hidden" id="phoneCodeHash" value="${phoneCodeHash || ''}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
                            <button type="button" class="btn btn-primary" id="submitVerificationCode">Verifica</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Aggiungi event listener per il pulsante submit
            const submitBtn = document.getElementById('submitVerificationCode');
            if (submitBtn) {
                submitBtn.addEventListener('click', function() {
                    const code = document.getElementById('verificationCode').value.trim();
                    const phone = document.getElementById('verificationPhone').value;
                    const phoneCodeHash = document.getElementById('phoneCodeHash').value || modal.dataset.phoneCodeHash;
                    
                    if (!code) {
                        showNotification('Errore', 'Inserisci il codice di verifica', 'danger');
                        return;
                    }
                    
                    submitVerificationCode(phone, code, phoneCodeHash);
                });
                
                // Also allow submission by pressing Enter
                const codeInput = document.getElementById('verificationCode');
                if (codeInput) {
                    codeInput.addEventListener('keyup', function(event) {
                        if (event.key === "Enter") {
                            submitBtn.click();
                        }
                    });
                }
            }
        } else {
            // Aggiorna telefono e phone_code_hash se la modale esiste già
            const phoneInput = modal.querySelector('#verificationPhone');
            if (phoneInput) {
                phoneInput.value = phone;
            }
            
            const phoneCodeHashInput = modal.querySelector('#phoneCodeHash');
            if (phoneCodeHashInput && phoneCodeHash) {
                phoneCodeHashInput.value = phoneCodeHash;
            }
            
            // Also store as data attribute
            if (phoneCodeHash) {
                modal.dataset.phoneCodeHash = phoneCodeHash;
            }
        }
        
        // Mostra la modale
        try {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            console.log("Modale mostrata con bootstrap.Modal");
            
            // Focus on the input field
            setTimeout(() => {
                const codeInput = document.getElementById('verificationCode');
                if (codeInput) codeInput.focus();
            }, 500);
        } catch (error) {
            console.error("Errore nell'inizializzazione della modale Bootstrap:", error);
            
            // Fallback manuale
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Crea backdrop manualmente
            const backdropExists = document.querySelector('.modal-backdrop');
            if (!backdropExists) {
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            
            console.log("Modale mostrata manualmente");
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del dialog di verifica:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del dialog di verifica', 'danger');
    }
}

// Mostra dialog per inserimento password 2FA
function show2FAPasswordDialog(phone) {
    try {
        console.log("Tentativo di mostrare la modale 2FA per:", phone);
        
        // Controlla se la modale esiste già, altrimenti la crea
        let modal = document.getElementById('twoFAPasswordModal');
        if (!modal) {
            console.log("Creazione modale per password 2FA");
            modal = document.createElement('div');
            modal.id = 'twoFAPasswordModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-labelledby', 'twoFAPasswordModalLabel');
            modal.setAttribute('aria-hidden', 'true');
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="twoFAPasswordModalLabel">Autenticazione a due fattori</h5>
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
            
            // Aggiungi event listener per il pulsante submit
            const submitBtn = document.getElementById('submitTwoFAPassword');
            if (submitBtn) {
                submitBtn.addEventListener('click', function() {
                    const password = document.getElementById('twoFAPassword').value.trim();
                    const phone = document.getElementById('twoFAPhone').value;
                    
                    if (!password) {
                        showNotification('Errore', 'Inserisci la password 2FA', 'danger');
                        return;
                    }
                    
                    submitTwoFAPassword(phone, password);
                });
            }
        } else {
            // Aggiorna telefono se la modale esiste già
            const phoneInput = modal.querySelector('#twoFAPhone');
            if (phoneInput) {
                phoneInput.value = phone;
            }
        }
        
        // Mostra la modale
        try {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            console.log("Modale 2FA mostrata con bootstrap.Modal");
        } catch (error) {
            console.error("Errore nell'inizializzazione della modale Bootstrap per 2FA:", error);
            
            // Fallback manuale
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Crea backdrop manualmente
            const backdropExists = document.querySelector('.modal-backdrop');
            if (!backdropExists) {
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            
            console.log("Modale 2FA mostrata manualmente");
        }
    } catch (e) {
        console.error("Errore nella visualizzazione del dialog 2FA:", e);
        showNotification('Errore', 'Si è verificato un errore durante la visualizzazione del dialog 2FA', 'danger');
    }
}

// Versione migliorata della funzione submitVerificationCode
function submitVerificationCode(phone, code, phoneCodeHash) {
    try {
        if (!phone || !code) {
            showNotification('Errore', 'Dati incompleti per la verifica', 'danger');
            return;
        }
        
        console.log("Invio codice di verifica per:", phone, "codice:", code, "phone_code_hash:", phoneCodeHash);
        
        // Mostra spinner
        showSpinner("Verifica codice", "Verifica del codice in corso...");
        
        // Chiudi modal verificazione se aperta
        const verificationModal = document.getElementById('verificationCodeModal');
        if (verificationModal) {
            try {
                const bsModal = bootstrap.Modal.getInstance(verificationModal);
                if (bsModal) {
                    bsModal.hide();
                } else {
                    verificationModal.classList.remove('show');
                    verificationModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }
            } catch (e) {
                console.error("Errore nella chiusura della modale di verifica:", e);
            }
        }
        
        // Esegui richiesta API
        fetch('/api/users/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                phone: phone, 
                code: code,
                phone_code_hash: phoneCodeHash
            })
        })
        .then(response => response.json())
        .then(data => {
            // Nascondi spinner
            hideSpinner();
            
            console.log("Risposta verifica codice:", data);
            
            if (data.success) {
                // Verifica completata con successo
                showNotification('Successo', 'Utente verificato con successo', 'success');
                
                // Aggiorna lista utenti
                window.location.reload();
            } else if (data.status === 'password_required') {
                // Richiesta password 2FA
                show2FAPasswordDialog(phone);
            } else if (data.status === 'code_expired') {
                // Codice scaduto
                showNotification('Errore', 'Il codice di verifica è scaduto, richiedi un nuovo codice', 'warning');
                
                // Richiedi nuovo codice automaticamente
                requestNewCode(phone);
            } else if (data.status === 'code_invalid') {
                // Codice non valido
                showNotification('Errore', 'Il codice di verifica non è valido, controlla e riprova', 'danger');
                
                // Mostra l'input manuale come fallback
                setupManualCodeInput();
                
                // Precompila il campo del telefono nell'input manuale
                const manualPhoneInput = document.getElementById('manualPhone');
                if (manualPhoneInput) {
                    manualPhoneInput.value = phone;
                }
            } else {
                // Errore
                showNotification('Errore', data.message || 'Errore durante la verifica del codice', 'danger');
                
                // Mostra l'input manuale come fallback
                setupManualCodeInput();
                
                // Precompila il campo del telefono nell'input manuale
                const manualPhoneInput = document.getElementById('manualPhone');
                if (manualPhoneInput) {
                    manualPhoneInput.value = phone;
                }
            }
        })
        .catch(error => {
            // Nascondi spinner
            hideSpinner();
            
            console.error('Errore nella richiesta API:', error);
            showNotification('Errore', 'Si è verificato un errore durante la connessione al server', 'danger');
            
            // Mostra l'input manuale come fallback
            setupManualCodeInput();
            
            // Precompila il campo del telefono nell'input manuale
            const manualPhoneInput = document.getElementById('manualPhone');
            if (manualPhoneInput) {
                manualPhoneInput.value = phone;
            }
        });
    } catch (e) {
        hideSpinner();
        console.error("Errore nell'invio del codice di verifica:", e);
        showNotification('Errore', 'Si è verificato un errore durante l\'invio del codice di verifica', 'danger');
        
        // Mostra l'input manuale come fallback
        setupManualCodeInput();
    }
}

// Funzione per richiedere un nuovo codice
function requestNewCode(phone) {
    if (!phone) return;
    
    showSpinner("Richiedi nuovo codice", "Invio richiesta per un nuovo codice...");
    
    fetch('/api/users/request-code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: phone })
    })
    .then(response => response.json())
    .then(data => {
        hideSpinner();
        
        if (data.success === false && data.status === 'code_sent') {
            // Codice inviato con successo
            showNotification('Info', `Nuovo codice di verifica inviato a ${data.phone}`, 'info');
            
            // Salva il nuovo phone_code_hash
            if (data.phone_code_hash) {
                localStorage.setItem(`phoneCodeHash_${data.phone}`, data.phone_code_hash);
                console.log(`Nuovo hash salvato per ${data.phone}: ${data.phone_code_hash}`);
            }
            
            // Mostra dialog per inserimento codice
            showVerificationCodeDialog(data.phone, data.phone_code_hash);
        } else if (data.status === 'flood_wait') {
            // Limite di tempo
            showNotification('Attenzione', data.message || 'Limite di tempo raggiunto, riprova più tardi', 'warning');
            showFloodWaitModal(data.phone, data.message, data.wait_seconds);
            
            // Mostra l'input manuale come alternativa
            setupManualCodeInput();
            
            // Precompila il campo del telefono nell'input manuale
            const manualPhoneInput = document.getElementById('manualPhone');
            if (manualPhoneInput) {
                manualPhoneInput.value = phone;
            }
        } else {
            // Errore
            showNotification('Errore', data.message || 'Errore durante la richiesta del nuovo codice', 'danger');
            
            // Mostra l'input manuale come fallback
            setupManualCodeInput();
            
            // Precompila il campo del telefono nell'input manuale
            const manualPhoneInput = document.getElementById('manualPhone');
            if (manualPhoneInput) {
                manualPhoneInput.value = phone;
            }
        }
    })
    .catch(error => {
        hideSpinner();
        console.error('Errore nella richiesta del nuovo codice:', error);
        showNotification('Errore', 'Si è verificato un errore durante la richiesta del nuovo codice', 'danger');
        
        // Mostra l'input manuale come fallback
        setupManualCodeInput();
        
        // Precompila il campo del telefono nell'input manuale
        const manualPhoneInput = document.getElementById('manualPhone');
        if (manualPhoneInput) {
            manualPhoneInput.value = phone;
        }
    });
}

// Invia password 2FA
function submitTwoFAPassword(phone, password) {
    try {
        console.log("Invio password 2FA per:", phone);
        
        // Chiudi modal se aperta
        const modal = document.getElementById('twoFAPasswordModal');
        if (modal) {
            try {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                } else {
                    modal.classList.remove('show');
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }
            } catch (e) {
                console.error("Errore nella chiusura della modale 2FA:", e);
            }
        }
        
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
                
                console.log("Risposta verifica password 2FA:", data);
                
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
                        <h5 class="modal-title" id="${modalId}Title">${title || 'Caricamento'}</h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="d-flex justify-content-center mb-3">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Caricamento...</span>
                            </div>
                        </div>
                        <p id="${modalId}Message">${message || 'Operazione in corso...'}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } else {
        // Aggiorna contenuto
        const modalTitle = document.getElementById(`${modalId}Title`);
        const modalMessage = document.getElementById(`${modalId}Message`);
        
        if (modalTitle) modalTitle.textContent = title || 'Caricamento';
        if (modalMessage) modalMessage.textContent = message || 'Operazione in corso...';
    }
    
    // Mostra modal
    try {
        const spinnerModal = new bootstrap.Modal(modal);
        spinnerModal.show();
        
        // Salva istanza per poterla chiudere
        window.currentSpinnerModal = spinnerModal;
    } catch (e) {
        console.error("Errore nell'inizializzazione dello spinner:", e);
        
        // Fallback manuale
        modal.classList.add('show');
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Crea backdrop manualmente
        const backdropExists = document.querySelector('.modal-backdrop');
        if (!backdropExists) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
        
        // Salva riferimento per poterlo chiudere manualmente
        window.currentSpinnerModalElement = modal;
    }
}

// Nascondi spinner di caricamento
function hideSpinner() {
    try {
        if (window.currentSpinnerModal) {
            window.currentSpinnerModal.hide();
            window.currentSpinnerModal = null;
        } else if (window.currentSpinnerModalElement) {
            // Chiusura manuale
            const modal = window.currentSpinnerModalElement;
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
            window.currentSpinnerModalElement = null;
        }
    } catch (e) {
        console.error("Errore nella chiusura dello spinner:", e);
        
        // Tenta rimozione forzata dei modali se tutto fallisce
        document.body.classList.remove('modal-open');
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }
}


// Avvia la configurazione dell'input manuale quando il documento è pronto
document.addEventListener("DOMContentLoaded", function() {
    // Verifica se siamo nella pagina utenti
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        // Aggiungi un pulsante per mostrare l'input manuale
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            const manualBtn = document.createElement('button');
            manualBtn.type = 'button';
            manualBtn.className = 'btn btn-outline-info ms-2';
            manualBtn.innerHTML = '<i class="bi bi-keyboard"></i> Input manuale';
            manualBtn.addEventListener('click', setupManualCodeInput);
            
            // Aggiungi dopo il pulsante di aggiunta
            addUserBtn.parentNode.insertBefore(manualBtn, addUserBtn.nextSibling);
        }
    }
});

// Esporta funzioni
window.addUser = addUser;
window.removeUser = removeUser;
window.loadActiveUsers = loadActiveUsers;
window.updateUserStatus = updateUserStatus;
window.showVerificationCodeDialog = showVerificationCodeDialog;
window.show2FAPasswordDialog = show2FAPasswordDialog;
window.submitVerificationCode = submitVerificationCode;
window.submitTwoFAPassword = submitTwoFAPassword;
window.showSpinner = showSpinner;
window.hideSpinner = hideSpinner;
window.showFloodWaitModal = showFloodWaitModal;