// NelsonPredicts Calendar Management System

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentView = 'month';
        this.matchData = {};
        this.filters = {
            league: '',
            confidence: '',
            prediction: ''
        };
        this.selectedDate = null;
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
        this.loadCalendarData();
        this.renderCalendar();
        this.initializeFilters();
    }
    
    setupEventListeners() {
        // Navigation controls
        document.getElementById('prevBtn')?.addEventListener('click', () => this.navigateCalendar(-1));
        document.getElementById('nextBtn')?.addEventListener('click', () => this.navigateCalendar(1));
        document.getElementById('todayBtn')?.addEventListener('click', () => this.goToToday());
        document.getElementById('jumpToDateBtn')?.addEventListener('click', () => this.jumpToDate());
        
        // View switching
        document.querySelectorAll('[data-calendar-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.calendarView);
            });
        });
        
        // Filter controls
        document.getElementById('leagueFilter')?.addEventListener('change', (e) => {
            this.filters.league = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('confidenceFilter')?.addEventListener('change', (e) => {
            this.filters.confidence = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('predictionFilter')?.addEventListener('change', (e) => {
            this.filters.prediction = e.target.value;
            this.applyFilters();
        });
        
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateCalendar(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateCalendar(1);
                    break;
                case 'Home':
                    e.preventDefault();
                    this.goToToday();
                    break;
                case 'Escape':
                    this.closeModals();
                    break;
            }
        });
    }
    
    async loadCalendarData() {
        try {
            this.showLoadingState();
            
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth() + 1;
            
            const response = await fetch(`/api/calendar/${year}/${month}`);
            const data = await response.json();
            
            if (response.ok) {
                this.matchData = data.calendar_data || {};
                this.updateSummaryStats();
                this.renderCalendar();
            } else {
                throw new Error(data.error || 'Failed to load calendar data');
            }
        } catch (error) {
            console.error('Calendar data loading error:', error);
            this.showErrorState(error.message);
        } finally {
            this.hideLoadingState();
        }
    }
    
    renderCalendar() {
        switch(this.currentView) {
            case 'month':
                this.renderMonthView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
        }
        
        this.updatePeriodHeader();
    }
    
    renderMonthView() {
        const calendarDays = document.getElementById('calendarDays');
        if (!calendarDays) return;
        
        calendarDays.innerHTML = '';
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Get calendar layout
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = this.createEmptyDayElement();
            calendarDays.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = this.createDayElement(year, month, day);
            calendarDays.appendChild(dayElement);
        }
        
        // Add empty cells to complete the grid
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells; // 6 rows × 7 days
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = this.createEmptyDayElement();
            calendarDays.appendChild(emptyDay);
        }
    }
    
    createEmptyDayElement() {
        const element = document.createElement('div');
        element.className = 'calendar-day empty';
        return element;
    }
    
    createDayElement(year, month, day) {
        const element = document.createElement('div');
        element.className = 'calendar-day';
        
        const dateKey = this.formatDateKey(year, month, day);
        const dayMatches = this.getFilteredMatches(dateKey);
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        element.appendChild(dayNumber);
        
        // Check if today
        const today = new Date();
        if (year === today.getFullYear() && 
            month === today.getMonth() && 
            day === today.getDate()) {
            element.classList.add('today');
        }
        
        // Add matches if any
        if (dayMatches.length > 0) {
            element.classList.add('has-matches');
            
            // Add confidence indicators
            const indicators = this.createConfidenceIndicators(dayMatches);
            element.appendChild(indicators);
            
            // Add match count
            if (dayMatches.length > 3) {
                const countBadge = document.createElement('div');
                countBadge.className = 'match-count-badge';
                countBadge.textContent = `+${dayMatches.length - 3}`;
                element.appendChild(countBadge);
            }
            
            // Make clickable
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                this.showDayMatches(dateKey, dayMatches);
            });
            
            // Tooltip
            element.title = `${dayMatches.length} matches`;
        }
        
        return element;
    }
    
    createConfidenceIndicators(matches) {
        const container = document.createElement('div');
        container.className = 'confidence-indicators';
        
        // Show up to 3 matches
        const visibleMatches = matches.slice(0, 3);
        
        visibleMatches.forEach(match => {
            const dot = document.createElement('div');
            dot.className = 'confidence-dot';
            
            if (match.prediction && match.prediction.confidence) {
                const confidence = match.prediction.confidence;
                if (confidence >= 70) {
                    dot.classList.add('bg-success');
                } else if (confidence >= 50) {
                    dot.classList.add('bg-warning');
                } else {
                    dot.classList.add('bg-danger');
                }
            } else {
                dot.classList.add('bg-secondary');
            }
            
            // Tooltip with match info
            dot.title = `${match.fixture.home_team.name} vs ${match.fixture.away_team.name}`;
            
            container.appendChild(dot);
        });
        
        return container;
    }
    
    renderWeekView() {
        const weekContent = document.getElementById('weekViewContent');
        if (!weekContent) return;
        
        const startOfWeek = this.getStartOfWeek(this.currentDate);
        const weekDays = [];
        
        // Generate 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            weekDays.push(date);
        }
        
        let html = `
            <div class="week-view-grid">
                <div class="week-header">
                    ${weekDays.map(date => `
                        <div class="week-day-header">
                            <div class="day-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div class="day-date">${date.getDate()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="week-content">
                    ${weekDays.map(date => {
                        const dateKey = this.formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
                        const dayMatches = this.getFilteredMatches(dateKey);
                        
                        return `
                            <div class="week-day-column">
                                ${dayMatches.map(match => this.createMatchCard(match, 'compact')).join('')}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        weekContent.innerHTML = html;
    }
    
    renderDayView() {
        const dayContent = document.getElementById('dayViewContent');
        if (!dayContent) return;
        
        const dateKey = this.formatDateKey(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth(),
            this.currentDate.getDate()
        );
        
        const dayMatches = this.getFilteredMatches(dateKey);
        
        let html = `
            <div class="day-view-container">
                <div class="day-view-header">
                    <h4>${this.currentDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</h4>
                    <div class="day-stats">
                        <span class="badge bg-primary">${dayMatches.length} matches</span>
                    </div>
                </div>
                <div class="day-matches">
                    ${dayMatches.length > 0 ? 
                        dayMatches.map(match => this.createMatchCard(match, 'detailed')).join('') :
                        '<div class="no-matches"><i class="fas fa-calendar-times fa-2x text-muted mb-2"></i><p>No matches scheduled</p></div>'
                    }
                </div>
            </div>
        `;
        
        dayContent.innerHTML = html;
    }
    
    createMatchCard(match, size = 'normal') {
        const prediction = match.prediction;
        const confidence = prediction?.confidence || 0;
        const confidenceColor = this.getConfidenceColor(confidence);
        
        if (size === 'compact') {
            return `
                <div class="match-card compact" data-fixture-id="${match.fixture.id}">
                    <div class="match-time">${new Date(match.fixture.kickoff_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="match-teams">
                        <div class="team">${this.truncateText(match.fixture.home_team.name, 8)}</div>
                        <div class="vs">vs</div>
                        <div class="team">${this.truncateText(match.fixture.away_team.name, 8)}</div>
                    </div>
                    ${prediction ? `
                        <div class="prediction-indicator ${confidenceColor}">
                            ${confidence}%
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        return `
            <div class="match-card detailed" data-fixture-id="${match.fixture.id}">
                <div class="match-header">
                    <div class="league-info">
                        <span class="league-name">${match.fixture.league.name}</span>
                        <span class="match-time">${new Date(match.fixture.kickoff_time).toLocaleTimeString()}</span>
                    </div>
                    <div class="match-actions">
                        <button class="btn btn-sm btn-outline-warning bookmark-btn" data-fixture-id="${match.fixture.id}">
                            <i class="fas fa-star"></i>
                        </button>
                    </div>
                </div>
                <div class="match-teams-detailed">
                    <div class="team-info">
                        <div class="team-name">${match.fixture.home_team.name}</div>
                        <small class="text-muted">Home</small>
                    </div>
                    <div class="match-vs">VS</div>
                    <div class="team-info">
                        <div class="team-name">${match.fixture.away_team.name}</div>
                        <small class="text-muted">Away</small>
                    </div>
                </div>
                ${prediction ? `
                    <div class="prediction-details">
                        <div class="prediction-result">
                            <span class="badge bg-${confidenceColor}">${this.formatPredictionDisplay(prediction)}</span>
                        </div>
                        <div class="confidence-bar">
                            <div class="progress" style="height: 4px;">
                                <div class="progress-bar bg-${confidenceColor}" style="width: ${confidence}%"></div>
                            </div>
                            <small class="text-muted">Confidence: ${confidence}%</small>
                        </div>
                    </div>
                ` : '<div class="no-prediction text-muted small">No prediction available</div>'}
            </div>
        `;
    }
    
    showDayMatches(dateKey, matches) {
        const modal = new bootstrap.Modal(document.getElementById('matchModal'));
        const modalDate = document.getElementById('modalDate');
        const modalMatches = document.getElementById('modalMatches');
        
        // Set modal title
        const date = new Date(dateKey);
        modalDate.textContent = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Populate matches
        modalMatches.innerHTML = matches.map(match => this.createMatchCard(match, 'detailed')).join('');
        
        modal.show();
    }
    
    getFilteredMatches(dateKey) {
        const matches = this.matchData[dateKey] || [];
        
        return matches.filter(match => {
            // League filter
            if (this.filters.league && match.fixture.league.name !== this.filters.league) {
                return false;
            }
            
            // Confidence filter
            if (this.filters.confidence && match.prediction) {
                const confidence = match.prediction.confidence;
                switch(this.filters.confidence) {
                    case 'high':
                        if (confidence < 70) return false;
                        break;
                    case 'medium':
                        if (confidence < 50 || confidence >= 70) return false;
                        break;
                    case 'low':
                        if (confidence >= 50) return false;
                        break;
                }
            }
            
            // Prediction type filter
            if (this.filters.prediction && match.prediction) {
                if (match.prediction.prediction.toLowerCase() !== this.filters.prediction) {
                    return false;
                }
            }
            
            return true;
        });
    }
    
    navigateCalendar(direction) {
        switch(this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() + direction);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
                break;
            case 'day':
                this.currentDate.setDate(this.currentDate.getDate() + direction);
                break;
        }
        
        this.loadCalendarData();
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.loadCalendarData();
    }
    
    jumpToDate() {
        const dateInput = document.getElementById('dateJump');
        if (!dateInput || !dateInput.value) return;
        
        const selectedDate = new Date(dateInput.value);
        if (selectedDate instanceof Date && !isNaN(selectedDate)) {
            this.currentDate = selectedDate;
            this.loadCalendarData();
        }
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update active button
        document.querySelectorAll('[data-calendar-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-calendar-view="${view}"]`)?.classList.add('active');
        
        // Show/hide view containers
        document.querySelectorAll('.calendar-view').forEach(viewEl => {
            viewEl.classList.add('d-none');
        });
        document.getElementById(`${view}View`)?.classList.remove('d-none');
        
        this.renderCalendar();
    }
    
    updatePeriodHeader() {
        const periodElement = document.getElementById('currentPeriod');
        if (!periodElement) return;
        
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        switch(this.currentView) {
            case 'month':
                periodElement.textContent = `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
                break;
            case 'week':
                const startOfWeek = this.getStartOfWeek(this.currentDate);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                periodElement.textContent = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
                break;
            case 'day':
                periodElement.textContent = this.currentDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                break;
        }
    }
    
    updateSummaryStats() {
        let totalMatches = 0;
        let highConfidenceMatches = 0;
        let totalConfidence = 0;
        let homeWins = 0, draws = 0, awayWins = 0;
        let confidenceCount = 0;
        
        Object.values(this.matchData).forEach(dayMatches => {
            dayMatches.forEach(match => {
                totalMatches++;
                
                if (match.prediction && match.prediction.confidence) {
                    totalConfidence += match.prediction.confidence;
                    confidenceCount++;
                    
                    if (match.prediction.confidence >= 70) {
                        highConfidenceMatches++;
                    }
                    
                    switch(match.prediction.prediction) {
                        case 'Home': homeWins++; break;
                        case 'Draw': draws++; break;
                        case 'Away': awayWins++; break;
                    }
                }
            });
        });
        
        // Update summary elements
        this.updateSummaryElement('totalMatches', totalMatches);
        this.updateSummaryElement('highConfidenceMatches', highConfidenceMatches);
        this.updateSummaryElement('avgConfidence', 
            confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) + '%' : '0%'
        );
        this.updateSummaryElement('predictionBreakdown', 
            `<small>H: ${homeWins} | D: ${draws} | A: ${awayWins}</small>`
        );
    }
    
    updateSummaryElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            if (typeof value === 'string' && value.includes('<')) {
                element.innerHTML = value;
            } else {
                element.textContent = value;
            }
        }
    }
    
    applyFilters() {
        this.renderCalendar();
        this.updateSummaryStats();
    }
    
    clearFilters() {
        this.filters = {
            league: '',
            confidence: '',
            prediction: ''
        };
        
        // Reset filter controls
        document.getElementById('leagueFilter').value = '';
        document.getElementById('confidenceFilter').value = '';
        document.getElementById('predictionFilter').value = '';
        
        this.applyFilters();
    }
    
    initializeFilters() {
        // Populate league filter with available leagues
        const leagues = new Set();
        Object.values(this.matchData).forEach(dayMatches => {
            dayMatches.forEach(match => {
                leagues.add(match.fixture.league.name);
            });
        });
        
        const leagueFilter = document.getElementById('leagueFilter');
        if (leagueFilter && leagues.size > 0) {
            leagues.forEach(league => {
                const option = document.createElement('option');
                option.value = league;
                option.textContent = league;
                leagueFilter.appendChild(option);
            });
        }
    }
    
    // Utility methods
    formatDateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }
    
    getConfidenceColor(confidence) {
        if (confidence >= 70) return 'success';
        if (confidence >= 50) return 'warning';
        return 'danger';
    }
    
    formatPredictionDisplay(prediction) {
        const emoji = prediction.confidence >= 70 ? '🟢' : 
                      prediction.confidence >= 50 ? '🟡' : '🔴';
        return `${emoji} ${prediction.confidence}% ${prediction.prediction}`;
    }
    
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    showLoadingState() {
        const loadingElements = document.querySelectorAll('.calendar-loading');
        loadingElements.forEach(el => el.classList.remove('d-none'));
    }
    
    hideLoadingState() {
        const loadingElements = document.querySelectorAll('.calendar-loading');
        loadingElements.forEach(el => el.classList.add('d-none'));
    }
    
    showErrorState(message) {
        const errorContainer = document.getElementById('calendarError');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                    <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="window.calendarManager.loadCalendarData()">
                        <i class="fas fa-retry me-1"></i>Retry
                    </button>
                </div>
            `;
            errorContainer.classList.remove('d-none');
        }
    }
    
    closeModals() {
        const openModals = document.querySelectorAll('.modal.show');
        openModals.forEach(modal => {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) modalInstance.hide();
        });
    }
    
    destroy() {
        // Cleanup event listeners and resources
        this.matchData = {};
        this.filters = { league: '', confidence: '', prediction: '' };
    }
}

// Calendar Export/Import functionality
class CalendarExporter {
    static exportToICS(matches, filename = 'nelson-predictions.ics') {
        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//NelsonPredicts//Football Predictions//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];
        
        matches.forEach(match => {
            const startDate = new Date(match.fixture.kickoff_time);
            const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // 2 hours later
            
            const formatDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };
            
            const predictionText = match.prediction ? 
                ` (Predicted: ${match.prediction.prediction} - ${match.prediction.confidence}%)` : '';
            
            icsContent.push(
                'BEGIN:VEVENT',
                `UID:nelson-${match.fixture.id}@nelsonpredicts.com`,
                `DTSTART:${formatDate(startDate)}`,
                `DTEND:${formatDate(endDate)}`,
                `SUMMARY:${match.fixture.home_team.name} vs ${match.fixture.away_team.name}${predictionText}`,
                `DESCRIPTION:League: ${match.fixture.league.name}\\n${predictionText}`,
                `LOCATION:${match.fixture.venue || 'TBD'}`,
                'STATUS:CONFIRMED',
                'TRANSP:OPAQUE',
                'END:VEVENT'
            );
        });
        
        icsContent.push('END:VCALENDAR');
        
        const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
    
    static exportToJSON(calendarData, filename = 'nelson-calendar.json') {
        const exportData = {
            exported_at: new Date().toISOString(),
            calendar_data: calendarData,
            metadata: {
                total_matches: Object.values(calendarData).reduce((sum, matches) => sum + matches.length, 0),
                date_range: {
                    start: Math.min(...Object.keys(calendarData)),
                    end: Math.max(...Object.keys(calendarData))
                }
            }
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
}

// Initialize calendar manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('#calendarDays, #monthView, [data-calendar-view]')) {
        window.calendarManager = new CalendarManager();
    }
});

// Export for use in other modules
window.CalendarManager = CalendarManager;
window.CalendarExporter = CalendarExporter;
