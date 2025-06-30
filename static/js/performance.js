// NelsonPredicts Performance Tracking System

class PerformanceTracker {
    constructor() {
        this.performanceData = [];
        this.charts = {};
        this.updateInterval = null;
        this.currentView = 'daily';
        
        this.initialize();
    }
    
    initialize() {
        this.loadPerformanceData();
        this.setupEventListeners();
        this.initializeCharts();
        this.startAutoUpdate();
    }
    
    setupEventListeners() {
        // View toggle buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-performance-view]')) {
                const view = e.target.closest('[data-performance-view]').dataset.performanceView;
                this.switchView(view);
            }
        });
        
        // Refresh button
        document.addEventListener('click', (e) => {
            if (e.target.closest('#refreshPerformanceBtn')) {
                this.refreshData();
            }
        });
        
        // Export button
        document.addEventListener('click', (e) => {
            if (e.target.closest('#exportPerformanceBtn')) {
                this.exportPerformanceData();
            }
        });
        
        // Date range selector
        const dateRangeSelect = document.getElementById('performanceDateRange');
        if (dateRangeSelect) {
            dateRangeSelect.addEventListener('change', (e) => {
                this.loadPerformanceData(e.target.value);
            });
        }
    }
    
    async loadPerformanceData(dateRange = '7') {
        try {
            this.showLoadingState();
            
            const response = await fetch(`/admin/prediction_performance?days=${dateRange}`);
            const data = await response.json();
            
            if (response.ok) {
                this.performanceData = data.performance_data || [];
                this.updateDisplays(data.summary || {});
                this.updateCharts();
            } else {
                throw new Error(data.error || 'Failed to load performance data');
            }
        } catch (error) {
            console.error('Performance data loading error:', error);
            this.showErrorState(error.message);
        } finally {
            this.hideLoadingState();
        }
    }
    
    updateDisplays(summary) {
        // Update summary cards
        this.updateSummaryCard('totalPredictions', summary.total_predictions || 0);
        this.updateSummaryCard('totalCorrect', summary.total_correct || 0);
        this.updateSummaryCard('overallAccuracy', `${summary.overall_accuracy || 0}%`);
        this.updateSummaryCard('homeAccuracy', `${summary.home_accuracy || 0}%`);
        this.updateSummaryCard('drawAccuracy', `${summary.draw_accuracy || 0}%`);
        this.updateSummaryCard('awayAccuracy', `${summary.away_accuracy || 0}%`);
        
        // Update performance breakdown
        this.updatePerformanceBreakdown(summary);
        
        // Update trend indicators
        this.updateTrendIndicators(summary);
    }
    
    updateSummaryCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            // Animate number changes
            if (typeof value === 'number' || (typeof value === 'string' && value.includes('%'))) {
                this.animateNumber(element, value);
            } else {
                element.textContent = value;
            }
        }
    }
    
    animateNumber(element, targetValue) {
        const isPercentage = typeof targetValue === 'string' && targetValue.includes('%');
        const numericValue = isPercentage ? 
            parseFloat(targetValue.replace('%', '')) : 
            parseInt(targetValue);
        
        const currentValue = isPercentage ? 
            parseFloat(element.textContent.replace('%', '') || '0') :
            parseInt(element.textContent || '0');
        
        const duration = 1000; // 1 second
        const steps = 30;
        const stepValue = (numericValue - currentValue) / steps;
        const stepDuration = duration / steps;
        
        let step = 0;
        const timer = setInterval(() => {
            step++;
            const value = currentValue + (stepValue * step);
            
            if (step >= steps) {
                clearInterval(timer);
                element.textContent = isPercentage ? `${numericValue}%` : numericValue;
            } else {
                element.textContent = isPercentage ? 
                    `${Math.round(value)}%` : 
                    Math.round(value);
            }
        }, stepDuration);
    }
    
    updatePerformanceBreakdown(summary) {
        const breakdownElement = document.getElementById('performanceBreakdown');
        if (!breakdownElement) return;
        
        const homeAccuracy = summary.home_accuracy || 0;
        const drawAccuracy = summary.draw_accuracy || 0;
        const awayAccuracy = summary.away_accuracy || 0;
        
        breakdownElement.innerHTML = `
            <div class="row text-center">
                <div class="col-4">
                    <div class="performance-metric">
                        <i class="fas fa-home text-success"></i>
                        <h6>Home Wins</h6>
                        <div class="metric-value">${homeAccuracy}%</div>
                        <div class="progress mt-2" style="height: 6px;">
                            <div class="progress-bar bg-success" style="width: ${homeAccuracy}%"></div>
                        </div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="performance-metric">
                        <i class="fas fa-equals text-warning"></i>
                        <h6>Draws</h6>
                        <div class="metric-value">${drawAccuracy}%</div>
                        <div class="progress mt-2" style="height: 6px;">
                            <div class="progress-bar bg-warning" style="width: ${drawAccuracy}%"></div>
                        </div>
                    </div>
                </div>
                <div class="col-4">
                    <div class="performance-metric">
                        <i class="fas fa-plane text-danger"></i>
                        <h6>Away Wins</h6>
                        <div class="metric-value">${awayAccuracy}%</div>
                        <div class="progress mt-2" style="height: 6px;">
                            <div class="progress-bar bg-danger" style="width: ${awayAccuracy}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateTrendIndicators(summary) {
        const trendElement = document.getElementById('performanceTrend');
        if (!trendElement || this.performanceData.length < 2) return;
        
        // Calculate trend from last two data points
        const latest = this.performanceData[0];
        const previous = this.performanceData[1];
        
        if (!latest || !previous) return;
        
        const currentAccuracy = latest.accuracy || 0;
        const previousAccuracy = previous.accuracy || 0;
        const trend = currentAccuracy - previousAccuracy;
        
        const trendIcon = trend > 0 ? 'fas fa-arrow-up text-success' : 
                         trend < 0 ? 'fas fa-arrow-down text-danger' : 
                         'fas fa-minus text-secondary';
        
        const trendText = trend > 0 ? `+${trend.toFixed(1)}%` : 
                         trend < 0 ? `${trend.toFixed(1)}%` : 
                         'No change';
        
        trendElement.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="${trendIcon} me-2"></i>
                <span>${trendText} from yesterday</span>
            </div>
        `;
    }
    
    initializeCharts() {
        this.createAccuracyChart();
        this.createVolumeChart();
        this.createBreakdownChart();
        this.createConfidenceChart();
    }
    
    createAccuracyChart() {
        const ctx = document.getElementById('accuracyChart');
        if (!ctx) return;
        
        this.charts.accuracy = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Accuracy',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Target (65%)',
                    data: [],
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Prediction Accuracy Trend'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    createVolumeChart() {
        const ctx = document.getElementById('volumeChart');
        if (!ctx) return;
        
        this.charts.volume = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Predictions',
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }, {
                    label: 'Correct Predictions',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Prediction Volume'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
    
    createBreakdownChart() {
        const ctx = document.getElementById('breakdownChart');
        if (!ctx) return;
        
        this.charts.breakdown = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Home Wins', 'Draws', 'Away Wins'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Prediction Distribution'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    createConfidenceChart() {
        const ctx = document.getElementById('confidenceChart');
        if (!ctx) return;
        
        this.charts.confidence = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Correct Predictions',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)'
                }, {
                    label: 'Incorrect Predictions',
                    data: [],
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Confidence vs Accuracy'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Confidence Level (%)'
                        },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Predictions'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    updateCharts() {
        if (this.performanceData.length === 0) return;
        
        // Prepare data
        const labels = this.performanceData.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }).reverse();
        
        const accuracyData = this.performanceData.map(d => d.accuracy || 0).reverse();
        const totalData = this.performanceData.map(d => d.total || 0).reverse();
        const correctData = this.performanceData.map(d => d.correct || 0).reverse();
        const targetData = new Array(labels.length).fill(65); // 65% target
        
        // Update accuracy chart
        if (this.charts.accuracy) {
            this.charts.accuracy.data.labels = labels;
            this.charts.accuracy.data.datasets[0].data = accuracyData;
            this.charts.accuracy.data.datasets[1].data = targetData;
            this.charts.accuracy.update('active');
        }
        
        // Update volume chart
        if (this.charts.volume) {
            this.charts.volume.data.labels = labels;
            this.charts.volume.data.datasets[0].data = totalData;
            this.charts.volume.data.datasets[1].data = correctData;
            this.charts.volume.update('active');
        }
        
        // Update breakdown chart with latest data
        if (this.charts.breakdown && this.performanceData.length > 0) {
            const latest = this.performanceData[0];
            this.charts.breakdown.data.datasets[0].data = [
                latest.home_predictions || 0,
                latest.draw_predictions || 0,
                latest.away_predictions || 0
            ];
            this.charts.breakdown.update('active');
        }
        
        // Update confidence chart (simplified visualization)
        if (this.charts.confidence) {
            // This would need individual prediction data to be fully implemented
            // For now, showing placeholder structure
            this.charts.confidence.update('active');
        }
    }
    
    switchView(view) {
        this.currentView = view;
        
        // Update active button
        document.querySelectorAll('[data-performance-view]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-performance-view="${view}"]`).classList.add('active');
        
        // Update chart time ranges
        let days;
        switch(view) {
            case 'weekly':
                days = 7;
                break;
            case 'monthly':
                days = 30;
                break;
            case 'yearly':
                days = 365;
                break;
            default:
                days = 7;
        }
        
        this.loadPerformanceData(days);
    }
    
    async refreshData() {
        const refreshBtn = document.getElementById('refreshPerformanceBtn');
        if (refreshBtn) {
            const originalHTML = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';
            refreshBtn.disabled = true;
            
            try {
                await this.loadPerformanceData();
                this.showNotification('Performance data refreshed', 'success');
            } catch (error) {
                this.showNotification('Failed to refresh data', 'error');
            } finally {
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.disabled = false;
            }
        }
    }
    
    startAutoUpdate() {
        // Update performance data every 5 minutes
        this.updateInterval = setInterval(() => {
            this.loadPerformanceData();
        }, 300000);
    }
    
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    exportPerformanceData() {
        const exportData = {
            exported_at: new Date().toISOString(),
            current_view: this.currentView,
            performance_data: this.performanceData,
            summary: this.calculateSummaryStats()
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `nelson_performance_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        this.showNotification('Performance data exported', 'success');
    }
    
    calculateSummaryStats() {
        if (this.performanceData.length === 0) return {};
        
        const totals = this.performanceData.reduce((acc, day) => {
            acc.total_predictions += day.total || 0;
            acc.total_correct += day.correct || 0;
            acc.home_predictions += day.home_predictions || 0;
            acc.home_correct += day.home_correct || 0;
            acc.draw_predictions += day.draw_predictions || 0;
            acc.draw_correct += day.draw_correct || 0;
            acc.away_predictions += day.away_predictions || 0;
            acc.away_correct += day.away_correct || 0;
            return acc;
        }, {
            total_predictions: 0,
            total_correct: 0,
            home_predictions: 0,
            home_correct: 0,
            draw_predictions: 0,
            draw_correct: 0,
            away_predictions: 0,
            away_correct: 0
        });
        
        return {
            ...totals,
            overall_accuracy: totals.total_predictions > 0 ? 
                (totals.total_correct / totals.total_predictions * 100).toFixed(1) : 0,
            home_accuracy: totals.home_predictions > 0 ? 
                (totals.home_correct / totals.home_predictions * 100).toFixed(1) : 0,
            draw_accuracy: totals.draw_predictions > 0 ? 
                (totals.draw_correct / totals.draw_predictions * 100).toFixed(1) : 0,
            away_accuracy: totals.away_predictions > 0 ? 
                (totals.away_correct / totals.away_predictions * 100).toFixed(1) : 0
        };
    }
    
    showLoadingState() {
        const loadingElements = document.querySelectorAll('.performance-loading');
        loadingElements.forEach(el => el.classList.remove('d-none'));
        
        const contentElements = document.querySelectorAll('.performance-content');
        contentElements.forEach(el => el.style.opacity = '0.5');
    }
    
    hideLoadingState() {
        const loadingElements = document.querySelectorAll('.performance-loading');
        loadingElements.forEach(el => el.classList.add('d-none'));
        
        const contentElements = document.querySelectorAll('.performance-content');
        contentElements.forEach(el => el.style.opacity = '1');
    }
    
    showErrorState(message) {
        const errorContainer = document.getElementById('performanceError');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${message}
                    <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="window.performanceTracker.refreshData()">
                        <i class="fas fa-retry me-1"></i>Retry
                    </button>
                </div>
            `;
            errorContainer.classList.remove('d-none');
        }
    }
    
    showNotification(message, type) {
        if (window.NelsonPredicts && window.NelsonPredicts.showNotification) {
            window.NelsonPredicts.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    destroy() {
        this.stopAutoUpdate();
        
        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        
        this.charts = {};
        this.performanceData = [];
    }
}

// Performance Analysis Utilities
class PerformanceAnalyzer {
    static calculateTrends(data) {
        if (data.length < 2) return null;
        
        const recent = data.slice(0, 7); // Last 7 days
        const previous = data.slice(7, 14); // Previous 7 days
        
        const recentAvg = recent.reduce((sum, d) => sum + (d.accuracy || 0), 0) / recent.length;
        const previousAvg = previous.reduce((sum, d) => sum + (d.accuracy || 0), 0) / previous.length;
        
        return {
            current_average: recentAvg.toFixed(1),
            previous_average: previousAvg.toFixed(1),
            trend: recentAvg - previousAvg,
            trend_percentage: previous.length > 0 ? ((recentAvg - previousAvg) / previousAvg * 100).toFixed(1) : 0
        };
    }
    
    static findBestPerformingDays(data) {
        return data
            .filter(d => d.total > 0)
            .sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0))
            .slice(0, 5)
            .map(d => ({
                date: d.date,
                accuracy: d.accuracy,
                total: d.total,
                correct: d.correct
            }));
    }
    
    static calculateConfidenceCorrelation(predictions) {
        // This would analyze if higher confidence predictions are more accurate
        const confidenceBuckets = {
            high: { total: 0, correct: 0 }, // 70%+
            medium: { total: 0, correct: 0 }, // 50-69%
            low: { total: 0, correct: 0 } // <50%
        };
        
        predictions.forEach(p => {
            const bucket = p.confidence >= 70 ? 'high' : 
                          p.confidence >= 50 ? 'medium' : 'low';
            
            confidenceBuckets[bucket].total++;
            if (p.correct) confidenceBuckets[bucket].correct++;
        });
        
        return Object.entries(confidenceBuckets).map(([level, data]) => ({
            confidence_level: level,
            accuracy: data.total > 0 ? (data.correct / data.total * 100).toFixed(1) : 0,
            total_predictions: data.total
        }));
    }
    
    static generateInsights(performanceData) {
        const insights = [];
        
        if (performanceData.length === 0) return insights;
        
        const latest = performanceData[0];
        const trends = this.calculateTrends(performanceData);
        
        // Accuracy insights
        if (latest.accuracy >= 70) {
            insights.push({
                type: 'success',
                message: `Excellent performance today with ${latest.accuracy}% accuracy!`,
                icon: 'fas fa-trophy'
            });
        } else if (latest.accuracy < 50) {
            insights.push({
                type: 'warning',
                message: `Below target performance today (${latest.accuracy}%). Review prediction criteria.`,
                icon: 'fas fa-exclamation-triangle'
            });
        }
        
        // Trend insights
        if (trends && trends.trend > 5) {
            insights.push({
                type: 'info',
                message: `Strong upward trend: +${trends.trend.toFixed(1)}% improvement over last week`,
                icon: 'fas fa-arrow-trend-up'
            });
        } else if (trends && trends.trend < -5) {
            insights.push({
                type: 'warning',
                message: `Declining trend: ${trends.trend.toFixed(1)}% decrease from last week`,
                icon: 'fas fa-arrow-trend-down'
            });
        }
        
        // Volume insights
        if (latest.total > 50) {
            insights.push({
                type: 'info',
                message: `High prediction volume today: ${latest.total} matches analyzed`,
                icon: 'fas fa-chart-bar'
            });
        }
        
        return insights;
    }
}

// Initialize performance tracker when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('#accuracyChart, #performanceChart, [data-performance-view]')) {
        window.performanceTracker = new PerformanceTracker();
    }
});

// Handle page visibility change to pause/resume updates
document.addEventListener('visibilitychange', function() {
    if (window.performanceTracker) {
        if (document.hidden) {
            window.performanceTracker.stopAutoUpdate();
        } else {
            window.performanceTracker.startAutoUpdate();
        }
    }
});

// Export for use in other modules
window.PerformanceTracker = PerformanceTracker;
window.PerformanceAnalyzer = PerformanceAnalyzer;
