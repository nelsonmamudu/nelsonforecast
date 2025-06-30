import hashlib
import json
from datetime import datetime, timedelta
from flask import session
import uuid
import logging

def get_user_session():
    """Get or create user session ID"""
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    return session['user_id']

def calculate_confidence_color(confidence):
    """Calculate color class based on confidence level"""
    if confidence >= 70:
        return 'success'  # Green
    elif confidence >= 50:
        return 'warning'  # Yellow
    else:
        return 'danger'   # Red

def format_confidence_display(prediction):
    """Format confidence display with emoji and percentage"""
    if not prediction:
        return None
    
    confidence = prediction.confidence
    pred_type = prediction.prediction
    
    if confidence >= 70:
        emoji = '🟢'
    elif confidence >= 50:
        emoji = '🟡'
    else:
        emoji = '🔴'
    
    return f"{emoji} {confidence}% {pred_type} Win"

def generate_cache_key(prefix, *args):
    """Generate cache key from prefix and arguments"""
    key_string = f"{prefix}:" + ":".join(str(arg) for arg in args)
    return hashlib.md5(key_string.encode()).hexdigest()

def is_cache_valid(cache_entry, hours=1):
    """Check if cache entry is still valid"""
    try:
        if not cache_entry:
            return False
        
        expiry_time = cache_entry.expiry_time
        return datetime.utcnow() < expiry_time
        
    except Exception as e:
        logging.error(f"Error checking cache validity: {e}")
        return False

def format_match_time(kickoff_time, user_timezone='UTC'):
    """Format match time for display"""
    try:
        # Convert to user timezone (simplified for now)
        formatted_time = kickoff_time.strftime('%H:%M')
        formatted_date = kickoff_time.strftime('%d/%m')
        
        return f"{formatted_date} {formatted_time}"
        
    except Exception as e:
        logging.error(f"Error formatting match time: {e}")
        return "TBD"

def calculate_accuracy_percentage(correct, total):
    """Calculate accuracy percentage"""
    if total == 0:
        return 0.0
    return round((correct / total) * 100, 1)

def get_match_status_icon(status):
    """Get icon for match status"""
    status_icons = {
        'Not Started': '⏰',
        'In Progress': '🔴',
        '1st Half': '🔴',
        '2nd Half': '🔴',
        'Half Time': '⏸️',
        'Finished': '✅',
        'Postponed': '⏸️',
        'Cancelled': '❌'
    }
    return status_icons.get(status, '⚽')

def format_prediction_breakdown(aggregation_data):
    """Format prediction breakdown for display"""
    try:
        if not aggregation_data:
            return "No predictions available"
        
        breakdown = aggregation_data.get('breakdown', {})
        total = breakdown.get('total', 0)
        
        if total == 0:
            return "No predictions available"
        
        home = breakdown.get('home', 0)
        draw = breakdown.get('draw', 0)
        away = breakdown.get('away', 0)
        
        return f"Home: {home}/{total} | Draw: {draw}/{total} | Away: {away}/{total}"
        
    except Exception as e:
        logging.error(f"Error formatting prediction breakdown: {e}")
        return "Error formatting predictions"

def detect_lightweight_mode_request():
    """Detect if user prefers lightweight mode based on request headers"""
    # This could analyze connection type, user agent, etc.
    # For now, just check if explicitly requested
    return False

def sanitize_search_query(query):
    """Sanitize search query to prevent injection"""
    if not query:
        return ""
    
    # Remove potentially dangerous characters
    sanitized = query.strip()
    sanitized = ''.join(c for c in sanitized if c.isalnum() or c in ' -_.')
    
    return sanitized[:100]  # Limit length

def format_team_form(wins, draws, losses):
    """Format team form as a string"""
    total = wins + draws + losses
    if total == 0:
        return "No games"
    
    win_rate = round((wins / total) * 100)
    
    if win_rate >= 70:
        return f"Excellent ({win_rate}%)"
    elif win_rate >= 50:
        return f"Good ({win_rate}%)"
    elif win_rate >= 30:
        return f"Average ({win_rate}%)"
    else:
        return f"Poor ({win_rate}%)"

def calculate_goal_difference_impact(goal_diff):
    """Calculate impact score based on goal difference"""
    # Normalize goal difference to a score between 0-100
    normalized = max(-20, min(20, goal_diff))  # Clamp between -20 and 20
    return 50 + (normalized * 2.5)  # Convert to 0-100 scale

def format_venue_capacity(capacity):
    """Format venue capacity for display"""
    if not capacity:
        return "Unknown"
    
    if capacity >= 1000000:
        return f"{capacity/1000000:.1f}M"
    elif capacity >= 1000:
        return f"{capacity/1000:.0f}K"
    else:
        return str(capacity)

def get_league_priority(league_name):
    """Get priority level for league (for sorting/filtering)"""
    premier_leagues = [
        'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 
        'Ligue 1', 'Champions League', 'Europa League'
    ]
    
    if any(premier in league_name for premier in premier_leagues):
        return 1  # High priority
    else:
        return 2  # Normal priority

def validate_date_range(start_date, end_date):
    """Validate date range for queries"""
    try:
        if start_date and end_date:
            start = datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.strptime(end_date, '%Y-%m-%d')
            
            # Check if range is reasonable (not more than 1 year)
            if (end - start).days > 365:
                return False
            
            # Check if start is before end
            return start <= end
        
        return True
        
    except ValueError:
        return False

def format_odds_display(odds):
    """Format odds for display"""
    if not odds:
        return "N/A"
    
    return f"{odds:.2f}"

def calculate_prediction_consensus_confidence(predictions):
    """Calculate confidence based on consensus agreement"""
    if not predictions:
        return 0.0
    
    total = len(predictions)
    
    # Count predictions by type
    home_count = sum(1 for p in predictions if p.prediction == 'Home')
    draw_count = sum(1 for p in predictions if p.prediction == 'Draw')
    away_count = sum(1 for p in predictions if p.prediction == 'Away')
    
    # Find majority
    max_count = max(home_count, draw_count, away_count)
    
    # Calculate confidence based on consensus strength
    consensus_strength = max_count / total
    
    # Base confidence from consensus percentage
    base_confidence = consensus_strength * 100
    
    # Adjust based on total number of predictions
    source_confidence = min(1.0, total / 10)  # More sources = higher confidence
    
    return base_confidence * source_confidence
