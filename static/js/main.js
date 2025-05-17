/**
 * main.js
 * File principale per l'inizializzazione dell'applicazione Telegram Manager
 */

// Inizializzazione quando il documento è pronto
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

/**
 * Questo file principale importa e coordina tutti i moduli dell'applicazione:
 * 
 * 1. core-utils.js - Utilità di base dell'applicazione
 *    - initBootstrapComponents()
 *    - initSettings()
 *    - initUIEventHandlers()
 *    - initNotifications()
 *    - showNotification(title, message, type)
 *    - showConfirmationModal(title, message, confirmCallback, args)
 *    - formatBytes(bytes, decimals)
 *    - formatNumber(num)
 * 
 * 2. socket-manager.js - Gestione delle connessioni WebSocket
 *    - initSocketIO()
 *    - updateSocketStatus(status)
 *    - requestInitialUpdates()
 *    - handleUpdate(data)
 * 
 * 3. user-manager.js - Gestione degli utenti Telegram
 *    - updateUserStatus(userData)
 *    - addUser()
 *    - removeUser(phone)
 *    - loadActiveUsers()
 *    - updateActiveUsersList(users)
 *    - showSpinner(title, message)
 *    - hideSpinner()
 * 
 * 4. group-manager.js - Gestione dei gruppi Telegram
 *    - updateGroupList(groups)
 *    - createGroupCard(group)
 *    - loadUserGroups(userPhone)
 *    - loadUserGroupsForDownload(userPhone)
 *    - loadUserGroupsForArchive(userPhone)
 *    - showMonitorModal(groupId, groupName)
 *    - showDownloadModal(groupId, groupName)
 *    - showArchiveModal(groupId, groupName)
 *    - getInviteLink(userPhone, groupId)
 * 
 * 5. monitor-manager.js - Gestione del monitoraggio messaggi
 *    - updateMonitoringStatus(data, isActive)
 *    - startMonitoring(groupIds)
 *    - stopMonitoring(userPhone)
 *    - updateMediaStatus(data, type)
 *    - appendToMessageLog(message)
 *    - appendToMediaGrid(data)
 *    - loadActiveMonitors()
 *    - updateActiveMonitorsList(monitors)
 * 
 * 6. download-manager.js - Gestione download media
 *    - updateDownloadStatus(data, status)
 *    - updateDownloadProgress(data)
 *    - startDownload(groupId, mediaTypes, limit)
 *    - loadActiveDownloads()
 *    - loadCompletedDownloads()
 *    - deleteDownload(downloadId)
 * 
 * 7. archive-manager.js - Gestione archivio
 *    - updateArchiveStatus(data, status)
 *    - updateArchiveProgress(data, phase)
 *    - startArchive(groupId, mediaTypes, limit)
 *    - loadAvailableArchives()
 *    - deleteArchive(archiveId)
 * 
 * 8. logs-manager.js - Gestione dei file di log
 *    - loadLogContent(logFile)
 *    - filterLogContent(filter)
 *    - downloadLogFile(logFile)
 *    - loadRecentErrors()
 *    - initLogsPage()
 * 
 * 9. dashboard-manager.js - Gestione dashboard
 *    - initDashboardPage()
 *    - loadDashboardStats()
 *    - updateDashboardStats(stats)
 *    - loadRecentActivities()
 *    - updateRecentActivitiesList(activities)
 * 
 * 10. page-manager.js - Gestione caricamento pagine
 *    - loadPageSpecificScripts()
 *    - initUsersPage()
 *    - initGroupsPage()
 *    - initMonitorPage()
 *    - initDownloadPage()
 *    - initArchivePage()
 */