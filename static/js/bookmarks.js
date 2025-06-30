// NelsonPredicts Bookmark Management System

class BookmarkManager {
    constructor() {
        this.bookmarks = new Set();
        this.storage = window.localStorage;
        this.storageKey = 'nelson_bookmarks';
        this.syncTimeout = null;
        
        this.initialize();
    }
    
    initialize() {
        this.loadBookmarks();
        this.setupEventListeners();
        this.syncWithServer();
    }
    
    loadBookmarks() {
        try {
            const stored = this.storage.getItem(this.storageKey);
            if (stored) {
                const bookmarkArray = JSON.parse(stored);
                this.bookmarks = new Set(bookmarkArray);
            }
        } catch (error) {
            console.error('Error loading bookmarks from storage:', error);
        }
    }
    
    saveBookmarks() {
        try {
            const bookmarkArray = Array.from(this.bookmarks);
            this.storage.setItem(this.storageKey, JSON.stringify(bookmarkArray));
        } catch (error) {
            console.error('Error saving bookmarks to storage:', error);
        }
    }
    
    setupEventListeners() {
        // Listen for bookmark button clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.bookmark-btn')) {
                e.preventDefault();
                this.handleBookmarkClick(e.target.closest('.bookmark-btn'));
            }
        });
        
        // Listen for bulk bookmark operations
        document.addEventListener('click', (e) => {
            if (e.target.id === 'bookmarkAllBtn') {
                this.bookmarkAllVisible();
            } else if (e.target.id === 'removeAllBookmarksBtn') {
                this.removeAllBookmarks();
            }
        });
        
        // Sync with server on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.syncWithServer();
            }
        });
    }
    
    async handleBookmarkClick(button) {
        const fixtureId = parseInt(button.dataset.fixtureId);
        const isCurrentlyBookmarked = this.isBookmarked(fixtureId);
        
        try {
            button.disabled = true;
            this.showButtonLoading(button);
            
            if (isCurrentlyBookmarked) {
                await this.removeBookmark(fixtureId);
                this.updateButtonState(button, false);
                this.showNotification('Bookmark removed', 'info');
            } else {
                await this.addBookmark(fixtureId);
                this.updateButtonState(button, true);
                this.showNotification('Match bookmarked', 'success');
            }
            
            this.updateBookmarkCount();
            
        } catch (error) {
            console.error('Bookmark operation failed:', error);
            this.showNotification('Bookmark operation failed', 'error');
        } finally {
            button.disabled = false;
        }
    }
    
    async addBookmark(fixtureId) {
        // Add to local storage immediately
        this.bookmarks.add(fixtureId);
        this.saveBookmarks();
        
        // Sync with server
        try {
            const response = await fetch(`/api/bookmark/${fixtureId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Server sync failed');
            }
            
            const data = await response.json();
            if (!data.bookmarked) {
                // Server rejected the bookmark, remove from local storage
                this.bookmarks.delete(fixtureId);
                this.saveBookmarks();
                throw new Error('Bookmark was rejected by server');
            }
            
        } catch (error) {
            console.error('Server sync error:', error);
            // Keep local bookmark but schedule retry
            this.scheduleSync();
        }
    }
    
    async removeBookmark(fixtureId) {
        // Remove from local storage immediately
        this.bookmarks.delete(fixtureId);
        this.saveBookmarks();
        
        // Sync with server
        try {
            const response = await fetch(`/api/bookmark/${fixtureId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Server sync failed');
            }
            
        } catch (error) {
            console.error('Server sync error:', error);
            // Schedule retry
            this.scheduleSync();
        }
    }
    
    isBookmarked(fixtureId) {
        return this.bookmarks.has(fixtureId);
    }
    
    showButtonLoading(button) {
        button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    updateButtonState(button, isBookmarked) {
        const icon = isBookmarked ? 'fas fa-star' : 'far fa-star';
        button.innerHTML = `<i class="${icon}"></i>`;
        button.dataset.bookmarked = isBookmarked;
        
        if (isBookmarked) {
            button.classList.add('bookmarked');
            button.classList.remove('btn-outline-warning');
            button.classList.add('btn-warning');
        } else {
            button.classList.remove('bookmarked');
            button.classList.remove('btn-warning');
            button.classList.add('btn-outline-warning');
        }
    }
    
    updateBookmarkCount() {
        const countElements = document.querySelectorAll('[data-bookmark-count]');
        countElements.forEach(element => {
            element.textContent = this.bookmarks.size;
        });
        
        // Update page-specific counts
        const totalBookmarks = document.getElementById('totalBookmarks');
        if (totalBookmarks) {
            totalBookmarks.textContent = this.bookmarks.size;
        }
    }
    
    async bookmarkAllVisible() {
        const visibleBookmarkButtons = document.querySelectorAll('.bookmark-btn:not([data-bookmarked="true"])');
        const total = visibleBookmarkButtons.length;
        
        if (total === 0) {
            this.showNotification('No new matches to bookmark', 'info');
            return;
        }
        
        let success = 0;
        const progressModal = this.showProgressModal('Bookmarking matches...', total);
        
        for (let i = 0; i < visibleBookmarkButtons.length; i++) {
            const button = visibleBookmarkButtons[i];
            const fixtureId = parseInt(button.dataset.fixtureId);
            
            try {
                await this.addBookmark(fixtureId);
                this.updateButtonState(button, true);
                success++;
            } catch (error) {
                console.error(`Failed to bookmark fixture ${fixtureId}:`, error);
            }
            
            this.updateProgressModal(progressModal, i + 1, total);
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.hideProgressModal(progressModal);
        this.showNotification(`Bookmarked ${success} out of ${total} matches`, 'success');
        this.updateBookmarkCount();
    }
    
    async removeAllBookmarks() {
        if (!confirm('Are you sure you want to remove all bookmarks?')) {
            return;
        }
        
        const bookmarkArray = Array.from(this.bookmarks);
        const total = bookmarkArray.length;
        
        if (total === 0) {
            this.showNotification('No bookmarks to remove', 'info');
            return;
        }
        
        const progressModal = this.showProgressModal('Removing bookmarks...', total);
        let success = 0;
        
        for (let i = 0; i < bookmarkArray.length; i++) {
            const fixtureId = bookmarkArray[i];
            
            try {
                await this.removeBookmark(fixtureId);
                
                // Update UI for this fixture
                const button = document.querySelector(`[data-fixture-id="${fixtureId}"]`);
                if (button) {
                    this.updateButtonState(button, false);
                }
                
                success++;
            } catch (error) {
                console.error(`Failed to remove bookmark ${fixtureId}:`, error);
            }
            
            this.updateProgressModal(progressModal, i + 1, total);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.hideProgressModal(progressModal);
        this.showNotification(`Removed ${success} bookmarks`, 'success');
        this.updateBookmarkCount();
    }
    
    showProgressModal(title, total) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-body text-center">
                        <h6>${title}</h6>
                        <div class="progress mt-3">
                            <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                        </div>
                        <small class="text-muted mt-2 d-block">
                            <span class="current">0</span> / <span class="total">${total}</span>
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal, { backdrop: 'static' });
        modalInstance.show();
        
        return { element: modal, instance: modalInstance };
    }
    
    updateProgressModal(modal, current, total) {
        const progressBar = modal.element.querySelector('.progress-bar');
        const currentSpan = modal.element.querySelector('.current');
        
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
        currentSpan.textContent = current;
    }
    
    hideProgressModal(modal) {
        modal.instance.hide();
        setTimeout(() => {
            modal.element.remove();
        }, 300);
    }
    
    async syncWithServer() {
        try {
            // Get server bookmarks
            const response = await fetch('/api/bookmarks');
            if (!response.ok) return;
            
            const serverBookmarks = await response.json();
            const serverSet = new Set(serverBookmarks.map(b => b.fixture_id));
            
            // Find differences
            const localOnly = new Set([...this.bookmarks].filter(id => !serverSet.has(id)));
            const serverOnly = new Set([...serverSet].filter(id => !this.bookmarks.has(id)));
            
            // Sync local-only bookmarks to server
            for (const fixtureId of localOnly) {
                try {
                    await fetch(`/api/bookmark/${fixtureId}`, { method: 'POST' });
                } catch (error) {
                    console.error(`Failed to sync bookmark ${fixtureId} to server:`, error);
                }
            }
            
            // Add server-only bookmarks to local
            for (const fixtureId of serverOnly) {
                this.bookmarks.add(fixtureId);
            }
            
            this.saveBookmarks();
            this.updateAllBookmarkButtons();
            
        } catch (error) {
            console.error('Bookmark sync failed:', error);
        }
    }
    
    scheduleSync() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        
        // Retry sync after 30 seconds
        this.syncTimeout = setTimeout(() => {
            this.syncWithServer();
        }, 30000);
    }
    
    updateAllBookmarkButtons() {
        const buttons = document.querySelectorAll('.bookmark-btn');
        buttons.forEach(button => {
            const fixtureId = parseInt(button.dataset.fixtureId);
            const isBookmarked = this.isBookmarked(fixtureId);
            this.updateButtonState(button, isBookmarked);
        });
        
        this.updateBookmarkCount();
    }
    
    showNotification(message, type) {
        if (window.NelsonPredicts && window.NelsonPredicts.showNotification) {
            window.NelsonPredicts.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    exportBookmarks() {
        const bookmarkData = {
            exported_at: new Date().toISOString(),
            total_bookmarks: this.bookmarks.size,
            fixture_ids: Array.from(this.bookmarks)
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bookmarkData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `nelson_bookmarks_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        this.showNotification('Bookmarks exported successfully', 'success');
    }
    
    async importBookmarks(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!Array.isArray(data.fixture_ids)) {
                throw new Error('Invalid bookmark file format');
            }
            
            let imported = 0;
            const total = data.fixture_ids.length;
            const progressModal = this.showProgressModal('Importing bookmarks...', total);
            
            for (let i = 0; i < data.fixture_ids.length; i++) {
                const fixtureId = parseInt(data.fixture_ids[i]);
                
                if (!this.isBookmarked(fixtureId)) {
                    try {
                        await this.addBookmark(fixtureId);
                        imported++;
                    } catch (error) {
                        console.error(`Failed to import bookmark ${fixtureId}:`, error);
                    }
                }
                
                this.updateProgressModal(progressModal, i + 1, total);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.hideProgressModal(progressModal);
            this.showNotification(`Imported ${imported} new bookmarks`, 'success');
            this.updateAllBookmarkButtons();
            
        } catch (error) {
            console.error('Import failed:', error);
            this.showNotification('Failed to import bookmarks', 'error');
        }
    }
    
    getBookmarkStats() {
        return {
            total: this.bookmarks.size,
            lastSynced: this.lastSyncTime,
            pendingSync: this.syncTimeout !== null
        };
    }
}

// Initialize bookmark manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.bookmarkManager = new BookmarkManager();
    
    // Add export/import functionality to bookmark page
    const exportBtn = document.getElementById('exportBookmarksBtn');
    const importBtn = document.getElementById('importBookmarksBtn');
    const importFile = document.getElementById('importBookmarksFile');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            window.bookmarkManager.exportBookmarks();
        });
    }
    
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });
        
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                window.bookmarkManager.importBookmarks(file);
            }
        });
    }
});

// Export for use in other modules
window.BookmarkManager = BookmarkManager;
