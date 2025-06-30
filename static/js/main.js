// NelsonPredicts Main JavaScript

// Global variables
let userPreferences = {
    theme: 'light',
    lightweightMode: false,
    favoriteTeams: [],
    favoriteLeagues: []
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load user preferences
    loadUserPreferences();
    
    // Initialize theme
    initializeTheme();
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize bookmark system
    initializeBookmarks();
    
    // Initialize tooltips and popovers
    initializeBootstrapComponents();
    
    // Initialize real-time updates
    initializeRealTimeUpdates();
    
    // Add event listeners
    addEventListeners();
    
    // Update last update time
    updateLastUpdateTime();
}

// Theme Management
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const lightweightToggle = document.getElementById('lightweightMode');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (lightweightToggle) {
        lightweightToggle.addEventListener('change', toggleLightweightMode);
    }
    
    // Apply saved theme
    applyTheme(userPreferences.theme);
    
    // Apply lightweight mode
    if (userPreferences.lightweightMode) {
        document.body.classList.add('lightweight-mode');
        if (lightweightToggle) lightweightToggle.checked = true;
    }
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            if (userPreferences.theme === 'auto') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    applyTheme(newTheme);
    userPreferences.theme = newTheme;
    saveUserPreferences();
}

function applyTheme(theme) {
    const themeIcon = document.getElementById('themeIcon');
    
    document.documentElement.setAttribute('data-bs-theme', theme);
    
    if (themeIcon) {
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-sun';
        } else {
            themeIcon.className = 'fas fa-moon';
        }
    }
    
    // Trigger custom event for other components
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function toggleLightweightMode() {
    const isLightweight = document.getElementById('lightweightMode').checked;
    
    if (isLightweight) {
        document.body.classList.add('lightweight-mode');
    } else {
        document.body.classList.remove('lightweight-mode');
    }
    
    userPreferences.lightweightMode = isLightweight;
    saveUserPreferences();
    
    // Show notification
    showNotification(
        isLightweight ? 'Lightweight mode enabled' : 'Lightweight mode disabled',
        'info'
    );
}

// Search Functionality
function initializeSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchButton = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        
        const query = this.value.trim();
        
        if (query.length < 2) {
            hideSearchResults();
            return;
        }
        
        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    searchInput.addEventListener('blur', function() {
        // Delay hiding to allow clicking on results
        setTimeout(hideSearchResults, 200);
    });
    
    searchInput.addEventListener('focus', function() {
        if (this.value.trim().length >= 2) {
            performSearch(this.value.trim());
        }
    });
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                performSearch(query);
            }
        });
    }
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideSearchResults();
            this.blur();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const firstResult = searchResults.querySelector('.search-result-item');
            if (firstResult) {
                firstResult.click();
            }
        }
    });
}

async function performSearch(query) {
    const searchResults = document.getElementById('searchResults');
    
    try {
        showSearchLoading();
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (response.ok) {
            displaySearchResults(data.results);
        } else {
            showSearchError(data.error || 'Search failed');
        }
    } catch (error) {
        console.error('Search error:', error);
        showSearchError('Search unavailable');
    }
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="search-result-item text-center text-muted">
                <i class="fas fa-search me-2"></i>No results found
            </div>
        `;
    } else {
        searchResults.innerHTML = results.map(result => `
            <div class="search-result-item" onclick="navigateToResult('${result.url}')">
                <div class="d-flex align-items-center">
                    <i class="fas fa-${getResultIcon(result.type)} me-2 text-muted"></i>
                    <div>
                        <div class="fw-bold">${escapeHtml(result.name)}</div>
                        <small class="text-muted">
                            ${result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                            ${result.country ? ` • ${escapeHtml(result.country)}` : ''}
                            ${result.position ? ` • ${escapeHtml(result.position)}` : ''}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    showSearchResults();
}

function getResultIcon(type) {
    const icons = {
        team: 'shield-alt',
        league: 'trophy',
        player: 'user',
        venue: 'map-marker-alt'
    };
    return icons[type] || 'search';
}

function showSearchLoading() {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = `
        <div class="search-result-item text-center">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Searching...
        </div>
    `;
    showSearchResults();
}

function showSearchError(message) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = `
        <div class="search-result-item text-center text-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>${escapeHtml(message)}
        </div>
    `;
    showSearchResults();
}

function showSearchResults() {
    const searchResults = document.getElementById('searchResults');
    searchResults.classList.remove('d-none');
}

function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.classList.add('d-none');
    }
}

function navigateToResult(url) {
    hideSearchResults();
    window.location.href = url;
}

// Bookmark System
function initializeBookmarks() {
    // Add event listeners to all bookmark buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.bookmark-btn')) {
            e.preventDefault();
            handleBookmarkClick(e.target.closest('.bookmark-btn'));
        }
    });
}

async function handleBookmarkClick(button) {
    const fixtureId = button.dataset.fixtureId;
    const isBookmarked = button.dataset.bookmarked === 'true';
    
    try {
        button.disabled = true;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const method = isBookmarked ? 'DELETE' : 'POST';
        const response = await fetch(`/api/bookmark/${fixtureId}`, { method });
        const data = await response.json();
        
        if (response.ok) {
            // Update button state
            const icon = data.bookmarked ? 'fas fa-star' : 'far fa-star';
            button.innerHTML = `<i class="${icon}"></i>`;
            button.dataset.bookmarked = data.bookmarked;
            
            if (data.bookmarked) {
                button.classList.add('bookmarked');
                showNotification('Match bookmarked', 'success');
            } else {
                button.classList.remove('bookmarked');
                showNotification('Bookmark removed', 'info');
            }
        } else {
            button.innerHTML = originalHTML;
            showNotification(data.error || 'Bookmark failed', 'error');
        }
    } catch (error) {
        console.error('Bookmark error:', error);
        button.innerHTML = '<i class="fas fa-star"></i>';
        showNotification('Bookmark unavailable', 'error');
    } finally {
        button.disabled = false;
    }
}

// Real-time Updates
function initializeRealTimeUpdates() {
    // Update live scores every 30 seconds
    setInterval(updateLiveScores, 30000);
    
    // Update last update time every minute
    setInterval(updateLastUpdateTime, 60000);
    
    // Check for new predictions every 5 minutes
    setInterval(checkForNewPredictions, 300000);
}

async function updateLiveScores() {
    try {
        const liveMatches = document.querySelectorAll('[data-status*="Progress"], [data-status*="Half"]');
        
        if (liveMatches.length === 0) return;
        
        // This would make API calls to update live scores
        console.log('Checking for live score updates...');
        
        // Update UI indicators
        updateLiveIndicators();
        
    } catch (error) {
        console.error('Live score update error:', error);
    }
}

function updateLiveIndicators() {
    const liveElements = document.querySelectorAll('.badge:contains("Live")');
    liveElements.forEach(element => {
        element.classList.toggle('pulse');
    });
}

async function checkForNewPredictions() {
    try {
        const unpredictedMatches = document.querySelectorAll('.generate-prediction');
        
        if (unpredictedMatches.length > 0) {
            console.log(`Found ${unpredictedMatches.length} matches without predictions`);
            // Could auto-generate predictions for high-priority matches
        }
    } catch (error) {
        console.error('Prediction check error:', error);
    }
}

function updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        const now = new Date();
        lastUpdateElement.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

// Bootstrap Components
function initializeBootstrapComponents() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Event Listeners
function addEventListeners() {
    // Handle prediction generation
    document.addEventListener('click', function(e) {
        if (e.target.closest('.generate-prediction')) {
            e.preventDefault();
            const button = e.target.closest('.generate-prediction');
            const fixtureId = button.dataset.fixtureId;
            generatePrediction(fixtureId, button);
        }
    });
    
    // Handle match details
    document.addEventListener('click', function(e) {
        if (e.target.closest('.view-details, .match-details-btn')) {
            e.preventDefault();
            const button = e.target.closest('.view-details, .match-details-btn');
            const fixtureId = button.dataset.fixtureId;
            showMatchDetails(fixtureId);
        }
    });
    
    // Handle confidence filter changes
    document.addEventListener('change', function(e) {
        if (e.target.name === 'confidenceFilter') {
            filterByConfidence(e.target.value);
        }
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Escape to close modals and dropdowns
        if (e.key === 'Escape') {
            hideSearchResults();
            
            // Close any open modals
            const openModals = document.querySelectorAll('.modal.show');
            openModals.forEach(modal => {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) modalInstance.hide();
            });
        }
    });
    
    // Handle window resize for responsive adjustments
    window.addEventListener('resize', debounce(handleWindowResize, 250));
    
    // Handle online/offline status
    window.addEventListener('online', function() {
        showNotification('Connection restored', 'success');
        // Retry failed requests
        retryFailedRequests();
    });
    
    window.addEventListener('offline', function() {
        showNotification('Connection lost - using cached data', 'warning');
    });
}

async function generatePrediction(fixtureId, button) {
    const originalHTML = button.innerHTML;
    
    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';
        
        const response = await fetch(`/api/predict/${fixtureId}`);
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Prediction generated successfully', 'success');
            
            // Update UI with new prediction
            updatePredictionDisplay(fixtureId, data);
            
            // Hide the generate button
            button.style.display = 'none';
        } else {
            throw new Error(data.error || 'Prediction failed');
        }
    } catch (error) {
        console.error('Prediction error:', error);
        button.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Error';
        showNotification(error.message, 'error');
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 3000);
    }
}

function updatePredictionDisplay(fixtureId, predictionData) {
    const matchCard = document.querySelector(`[data-fixture-id="${fixtureId}"]`).closest('.card');
    const predictionArea = matchCard.querySelector('.prediction-display') || 
                          matchCard.querySelector('.text-center');
    
    if (predictionArea) {
        const confidenceColor = getConfidenceColor(predictionData.confidence);
        const confidenceDisplay = formatConfidenceDisplay(predictionData);
        
        predictionArea.innerHTML = `
            <div class="prediction-display mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong>Prediction:</strong>
                    <span class="badge bg-${confidenceColor} fs-6">
                        ${confidenceDisplay}
                    </span>
                </div>
                <div class="confidence-meter">
                    <div class="progress mb-2" style="height: 8px;">
                        <div class="progress-bar bg-${confidenceColor}" 
                             style="width: ${predictionData.confidence}%"></div>
                    </div>
                    <small class="text-muted">
                        Confidence: ${predictionData.confidence}%
                    </small>
                </div>
                ${predictionData.warnings ? `
                <div class="mt-2">
                    ${predictionData.warnings.map(warning => 
                        `<small class="text-warning d-block">${warning}</small>`
                    ).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }
}

function getConfidenceColor(confidence) {
    if (confidence >= 70) return 'success';
    if (confidence >= 50) return 'warning';
    return 'danger';
}

function formatConfidenceDisplay(prediction) {
    const emoji = prediction.confidence >= 70 ? '🟢' : 
                  prediction.confidence >= 50 ? '🟡' : '🔴';
    return `${emoji} ${prediction.confidence}% ${prediction.prediction} Win`;
}

function filterByConfidence(filterValue) {
    const matchCards = document.querySelectorAll('.fixture-card');
    
    matchCards.forEach(card => {
        const confidence = parseFloat(card.dataset.confidence || 0);
        let show = true;
        
        switch(filterValue) {
            case 'high':
                show = confidence >= 70;
                break;
            case 'medium':
                show = confidence >= 50 && confidence < 70;
                break;
            case 'low':
                show = confidence > 0 && confidence < 50;
                break;
            default:
                show = true;
        }
        
        card.style.display = show ? 'block' : 'none';
    });
}

function showMatchDetails(fixtureId) {
    // This would show a modal with detailed match information
    console.log(`Showing details for fixture ${fixtureId}`);
    
    // For now, show a placeholder modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Match Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="text-center py-3">
                        <div class="spinner-border" role="status"></div>
                        <p class="mt-2">Loading match details...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', function() {
        modal.remove();
    });
}

function handleWindowResize() {
    // Adjust calendar layout on mobile
    const calendar = document.querySelector('.calendar-grid');
    if (calendar && window.innerWidth < 768) {
        calendar.classList.add('mobile-layout');
    } else if (calendar) {
        calendar.classList.remove('mobile-layout');
    }
    
    // Adjust search results position
    const searchResults = document.getElementById('searchResults');
    if (searchResults && window.innerWidth < 576) {
        searchResults.style.width = '100vw';
        searchResults.style.left = '0';
    }
}

// User Preferences Management
async function loadUserPreferences() {
    try {
        const response = await fetch('/api/user/preferences');
        const prefs = await response.json();
        
        userPreferences = {
            theme: prefs.theme || 'light',
            lightweightMode: prefs.lightweight_mode || false,
            favoriteTeams: prefs.favorite_teams || [],
            favoriteLeagues: prefs.favorite_leagues || []
        };
    } catch (error) {
        console.error('Error loading preferences:', error);
        // Use defaults
    }
}

async function saveUserPreferences() {
    try {
        const response = await fetch('/api/user/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userPreferences)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save preferences');
        }
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

// Utility Functions
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification fade-in`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
    `;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${icons[type]} me-2"></i>
            <span>${escapeHtml(message)}</span>
            <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatTime(date) {
    return new Intl.DateTimeFormat('default', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

function formatDate(date) {
    return new Intl.DateTimeFormat('default', {
        month: 'short',
        day: 'numeric'
    }).format(new Date(date));
}

async function retryFailedRequests() {
    // Retry any failed network requests when connection is restored
    console.log('Retrying failed requests...');
}

// Export for use in other modules
window.NelsonPredicts = {
    userPreferences,
    loadUserPreferences,
    saveUserPreferences,
    showNotification,
    generatePrediction,
    handleBookmarkClick,
    escapeHtml,
    formatNumber,
    formatTime,
    formatDate
};
