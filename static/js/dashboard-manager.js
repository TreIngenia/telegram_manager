/**
 * dashboard-manager.js
 * Gestione della dashboard dell'applicazione
 */

// Inizializza la pagina dashboard
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
    const usersCountElement = document.getElementById('usersCount');
    const groupsCountElement = document.getElementById('groupsCount');
    const monitorCountElement = document.getElementById('monitorCount');
    const downloadCountElement = document.getElementById('downloadCount');
    const archiveCountElement = document.getElementById('archiveCount');
    
    // Aggiorna statistiche media
    const totalMediaElement = document.getElementById('totalMedia');
    const totalImagesElement = document.getElementById('totalImages');
    const totalVideosElement = document.getElementById('totalVideos');
    const totalSizeElement = document.getElementById('totalSize');
    
    // Aggiorna solo gli elementi che esistono
    if (usersCountElement) usersCountElement.textContent = stats.users_count || 0;
    if (groupsCountElement) groupsCountElement.textContent = stats.groups_count || 0;
    if (monitorCountElement) monitorCountElement.textContent = stats.monitors_count || 0;
    if (downloadCountElement) downloadCountElement.textContent = stats.downloads_count || 0;
    if (archiveCountElement) archiveCountElement.textContent = stats.archives_count || 0;
    
    if (totalMediaElement) totalMediaElement.textContent = formatNumber(stats.total_media || 0);
    if (totalImagesElement) totalImagesElement.textContent = formatNumber(stats.total_images || 0);
    if (totalVideosElement) totalVideosElement.textContent = formatNumber(stats.total_videos || 0);
    if (totalSizeElement) totalSizeElement.textContent = formatBytes(stats.total_size || 0);
    
    // Aggiorna barre di progresso per le percentuali di media
    if (stats.total_media > 0) {
        const imagesPercentage = Math.round((stats.total_images / stats.total_media) * 100);
        const videosPercentage = Math.round((stats.total_videos / stats.total_media) * 100);
        
        // Aggiorna barre di progresso se esistono
        const imagesProgressBar = document.querySelector('.progress-bar.bg-primary');
        const videosProgressBar = document.querySelector('.progress-bar.bg-danger');
        
        if (imagesProgressBar) {
            imagesProgressBar.style.width = `${imagesPercentage}%`;
            imagesProgressBar.setAttribute('aria-valuenow', imagesPercentage);
            imagesProgressBar.textContent = `${imagesPercentage}%`;
        }
        
        if (videosProgressBar) {
            videosProgressBar.style.width = `${videosPercentage}%`;
            videosProgressBar.setAttribute('aria-valuenow', videosPercentage);
            videosProgressBar.textContent = `${videosPercentage}%`;
        }
    }
}

// Carica attività recenti
function loadRecentActivities() {
    fetch('/api/dashboard/activities')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Aggiorna attività recenti nella UI
                updateRecentActivitiesList(data.activities);
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento delle attività recenti:', error);
        });
}

// Aggiorna lista attività recenti nella UI
function updateRecentActivitiesList(activities) {
    const activitiesContainer = document.querySelector('.list-group');
    if (!activitiesContainer) return;
    
    // Svuota container
    activitiesContainer.innerHTML = '';
    
    if (activities.length === 0) {
        activitiesContainer.innerHTML = '<div class="alert alert-info">Nessuna attività recente</div>';
        return;
    }
    
    // Crea lista attività
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'list-group-item';
        activityItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${activity.title}</h6>
                <small>${activity.time}</small>
            </div>
            <p class="mb-1">${activity.description}</p>
            <small>${activity.user}</small>
        `;
        
        activitiesContainer.appendChild(activityItem);
    });
}

// Esporta funzioni
window.initDashboardPage = initDashboardPage;
window.loadDashboardStats = loadDashboardStats;
window.loadRecentActivities = loadRecentActivities;