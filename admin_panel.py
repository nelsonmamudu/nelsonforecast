from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app import db
from models import AdminSettings, PerformanceTracker, Prediction, Fixture
import logging
from datetime import datetime, date

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/')
def admin_dashboard():
    """Admin dashboard with system overview"""
    try:
        # Get current settings
        settings = AdminSettings.query.first()
        
        # Get system statistics
        total_fixtures = Fixture.query.count()
        total_predictions = Prediction.query.count()
        
        # Get recent performance
        recent_performance = PerformanceTracker.query.order_by(
            PerformanceTracker.date.desc()
        ).limit(7).all()
        
        # Calculate overall accuracy
        total_correct = sum(p.correct_predictions for p in recent_performance)
        total_pred = sum(p.total_predictions for p in recent_performance)
        overall_accuracy = round((total_correct / total_pred * 100), 1) if total_pred > 0 else 0
        
        return render_template('admin.html',
                             settings=settings,
                             total_fixtures=total_fixtures,
                             total_predictions=total_predictions,
                             recent_performance=recent_performance,
                             overall_accuracy=overall_accuracy)
                             
    except Exception as e:
        logging.error(f"Error in admin dashboard: {e}")
        flash('Error loading admin dashboard', 'error')
        return render_template('admin.html', error="Failed to load dashboard")

@admin_bp.route('/update_settings', methods=['POST'])
def update_settings():
    """Update admin settings"""
    try:
        settings = AdminSettings.query.first()
        if not settings:
            settings = AdminSettings()
        
        # Update thresholds
        settings.home_win_threshold = float(request.form.get('home_win_threshold', 65.0))
        settings.draw_threshold_min = float(request.form.get('draw_threshold_min', 40.0))
        settings.draw_threshold_max = float(request.form.get('draw_threshold_max', 64.0))
        settings.away_win_threshold = float(request.form.get('away_win_threshold', 39.0))
        
        # Update weights
        settings.form_weight = float(request.form.get('form_weight', 25.0))
        settings.home_away_weight = float(request.form.get('home_away_weight', 10.0))
        settings.player_availability_weight = float(request.form.get('player_availability_weight', 15.0))
        settings.match_stats_weight = float(request.form.get('match_stats_weight', 20.0))
        settings.h2h_weight = float(request.form.get('h2h_weight', 10.0))
        settings.ai_predictions_weight = float(request.form.get('ai_predictions_weight', 5.0))
        settings.odds_agreement_weight = float(request.form.get('odds_agreement_weight', 10.0))
        settings.intangibles_weight = float(request.form.get('intangibles_weight', 5.0))
        
        # Update scaling settings
        settings.max_matches_weekday = int(request.form.get('max_matches_weekday', 100))
        settings.max_matches_weekend = int(request.form.get('max_matches_weekend', 300))
        settings.scaling_start_date = request.form.get('scaling_start_date', '2025-07-13')
        
        db.session.add(settings)
        db.session.commit()
        
        flash('Settings updated successfully', 'success')
        return redirect(url_for('admin.admin_dashboard'))
        
    except Exception as e:
        logging.error(f"Error updating settings: {e}")
        flash('Error updating settings', 'error')
        return redirect(url_for('admin.admin_dashboard'))

@admin_bp.route('/reset_defaults', methods=['POST'])
def reset_defaults():
    """Reset settings to default values"""
    try:
        settings = AdminSettings.query.first()
        if not settings:
            settings = AdminSettings()
        
        # Reset to defaults
        settings.home_win_threshold = 65.0
        settings.draw_threshold_min = 40.0
        settings.draw_threshold_max = 64.0
        settings.away_win_threshold = 39.0
        settings.form_weight = 25.0
        settings.home_away_weight = 10.0
        settings.player_availability_weight = 15.0
        settings.match_stats_weight = 20.0
        settings.h2h_weight = 10.0
        settings.ai_predictions_weight = 5.0
        settings.odds_agreement_weight = 10.0
        settings.intangibles_weight = 5.0
        settings.max_matches_weekday = 100
        settings.max_matches_weekend = 300
        settings.scaling_start_date = '2025-07-13'
        
        db.session.add(settings)
        db.session.commit()
        
        flash('Settings reset to defaults', 'success')
        return redirect(url_for('admin.admin_dashboard'))
        
    except Exception as e:
        logging.error(f"Error resetting settings: {e}")
        flash('Error resetting settings', 'error')
        return redirect(url_for('admin.admin_dashboard'))

@admin_bp.route('/system_status')
def system_status():
    """Get system status for monitoring"""
    try:
        # Get cache statistics
        from models import CacheManagement
        total_cache_entries = CacheManagement.query.count()
        expired_cache_entries = CacheManagement.query.filter(
            CacheManagement.expiry_time < datetime.utcnow()
        ).count()
        
        # Get recent scraping activity
        recent_fixtures = Fixture.query.filter(
            Fixture.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        recent_predictions = Prediction.query.filter(
            Prediction.created_at >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        status = {
            'cache_entries': total_cache_entries,
            'expired_cache': expired_cache_entries,
            'recent_fixtures': recent_fixtures,
            'recent_predictions': recent_predictions,
            'system_health': 'Healthy' if recent_fixtures > 0 else 'Warning'
        }
        
        return jsonify(status)
        
    except Exception as e:
        logging.error(f"Error getting system status: {e}")
        return jsonify({'error': 'Failed to get system status'}), 500

@admin_bp.route('/clear_cache', methods=['POST'])
def clear_cache():
    """Clear expired cache entries"""
    try:
        from models import CacheManagement
        
        expired_entries = CacheManagement.query.filter(
            CacheManagement.expiry_time < datetime.utcnow()
        ).all()
        
        for entry in expired_entries:
            db.session.delete(entry)
        
        db.session.commit()
        
        flash(f'Cleared {len(expired_entries)} expired cache entries', 'success')
        return redirect(url_for('admin.admin_dashboard'))
        
    except Exception as e:
        logging.error(f"Error clearing cache: {e}")
        flash('Error clearing cache', 'error')
        return redirect(url_for('admin.admin_dashboard'))

@admin_bp.route('/prediction_performance')
def prediction_performance():
    """View detailed prediction performance"""
    try:
        # Get performance data for last 30 days
        from datetime import timedelta
        
        start_date = date.today() - timedelta(days=30)
        performance_data = PerformanceTracker.query.filter(
            PerformanceTracker.date >= start_date
        ).order_by(PerformanceTracker.date.desc()).all()
        
        # Calculate category accuracies
        total_home_predictions = sum(p.home_win_predictions for p in performance_data)
        total_home_correct = sum(p.home_win_correct for p in performance_data)
        home_accuracy = round((total_home_correct / total_home_predictions * 100), 1) if total_home_predictions > 0 else 0
        
        total_draw_predictions = sum(p.draw_predictions for p in performance_data)
        total_draw_correct = sum(p.draw_correct for p in performance_data)
        draw_accuracy = round((total_draw_correct / total_draw_predictions * 100), 1) if total_draw_predictions > 0 else 0
        
        total_away_predictions = sum(p.away_win_predictions for p in performance_data)
        total_away_correct = sum(p.away_win_correct for p in performance_data)
        away_accuracy = round((total_away_correct / total_away_predictions * 100), 1) if total_away_predictions > 0 else 0
        
        performance_summary = {
            'home_accuracy': home_accuracy,
            'draw_accuracy': draw_accuracy,
            'away_accuracy': away_accuracy,
            'total_predictions': sum(p.total_predictions for p in performance_data),
            'total_correct': sum(p.correct_predictions for p in performance_data)
        }
        
        return jsonify({
            'performance_data': [
                {
                    'date': p.date.isoformat(),
                    'accuracy': p.accuracy_percentage,
                    'total': p.total_predictions,
                    'correct': p.correct_predictions
                } for p in performance_data
            ],
            'summary': performance_summary
        })
        
    except Exception as e:
        logging.error(f"Error getting prediction performance: {e}")
        return jsonify({'error': 'Failed to get performance data'}), 500
