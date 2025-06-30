import json
import logging
from datetime import datetime, timedelta
from app import db
from models import *
import random

class PredictionEngine:
    def __init__(self):
        self.weights = self._load_admin_weights()
    
    def _load_admin_weights(self):
        """Load prediction weights from admin settings"""
        try:
            settings = AdminSettings.query.first()
            if settings:
                return {
                    'form_standings': settings.form_weight,
                    'home_away': settings.home_away_weight,
                    'player_availability': settings.player_availability_weight,
                    'match_stats': settings.match_stats_weight,
                    'h2h': settings.h2h_weight,
                    'ai_predictions': settings.ai_predictions_weight,
                    'odds_agreement': settings.odds_agreement_weight,
                    'intangibles': settings.intangibles_weight
                }
            else:
                # Default weights
                return {
                    'form_standings': 25.0,
                    'home_away': 10.0,
                    'player_availability': 15.0,
                    'match_stats': 20.0,
                    'h2h': 10.0,
                    'ai_predictions': 5.0,
                    'odds_agreement': 10.0,
                    'intangibles': 5.0
                }
        except Exception as e:
            logging.error(f"Error loading admin weights: {e}")
            return {}
    
    def predict_match(self, fixture):
        """Generate comprehensive prediction for a match"""
        try:
            home_team = fixture.home_team
            away_team = fixture.away_team
            
            # Initialize scoring system
            home_score = 0.0
            away_score = 0.0
            confidence_factors = []
            warnings = []
            criteria_scores = {}
            
            # 1. Form & Standings Analysis (25%)
            form_result = self._analyze_form_standings(home_team, away_team)
            if form_result:
                home_score += form_result['home_score'] * (self.weights['form_standings'] / 100)
                away_score += form_result['away_score'] * (self.weights['form_standings'] / 100)
                criteria_scores['form_standings'] = form_result
                confidence_factors.append('form_data')
            else:
                warnings.append("⚠️ Form data missing — confidence reduced")
            
            # 2. Home/Away Factor (10%)
            home_away_result = self._analyze_home_away_factor(home_team, away_team)
            if home_away_result:
                home_score += home_away_result['home_score'] * (self.weights['home_away'] / 100)
                away_score += home_away_result['away_score'] * (self.weights['home_away'] / 100)
                criteria_scores['home_away'] = home_away_result
                confidence_factors.append('home_away_data')
            else:
                warnings.append("⚠️ Home/Away stats missing — using average")
            
            # 3. Player Availability (15%)
            player_result = self._analyze_player_availability(home_team, away_team)
            if player_result:
                home_score += player_result['home_score'] * (self.weights['player_availability'] / 100)
                away_score += player_result['away_score'] * (self.weights['player_availability'] / 100)
                criteria_scores['player_availability'] = player_result
                confidence_factors.append('player_data')
            else:
                warnings.append("⚠️ Player availability data missing — confidence reduced")
            
            # 4. Match Statistics (20%)
            stats_result = self._analyze_match_statistics(home_team, away_team)
            if stats_result:
                home_score += stats_result['home_score'] * (self.weights['match_stats'] / 100)
                away_score += stats_result['away_score'] * (self.weights['match_stats'] / 100)
                criteria_scores['match_stats'] = stats_result
                confidence_factors.append('stats_data')
            else:
                warnings.append("⚠️ Team statistics missing — using form only")
            
            # 5. Head-to-Head Analysis (10%)
            h2h_result = self._analyze_head_to_head(home_team, away_team)
            if h2h_result:
                home_score += h2h_result['home_score'] * (self.weights['h2h'] / 100)
                away_score += h2h_result['away_score'] * (self.weights['h2h'] / 100)
                criteria_scores['h2h'] = h2h_result
                confidence_factors.append('h2h_data')
            else:
                warnings.append("⚠️ Head-to-head data limited — reduced weight")
            
            # 6. AI Predictions Consensus (5%)
            ai_result = self._get_ai_predictions_consensus(fixture.id)
            if ai_result:
                if ai_result['prediction'] == 'Home':
                    home_score += self.weights['ai_predictions'] / 100
                elif ai_result['prediction'] == 'Away':
                    away_score += self.weights['ai_predictions'] / 100
                criteria_scores['ai_predictions'] = ai_result
                confidence_factors.append('ai_data')
            else:
                warnings.append("⚠️ AI predictions unavailable — using manual analysis")
            
            # 7. Betting Odds Agreement (10%)
            odds_result = self._analyze_betting_odds(fixture.id)
            if odds_result:
                home_score += odds_result['home_score'] * (self.weights['odds_agreement'] / 100)
                away_score += odds_result['away_score'] * (self.weights['odds_agreement'] / 100)
                criteria_scores['odds_agreement'] = odds_result
                confidence_factors.append('odds_data')
            else:
                warnings.append("⚠️ Odds unavailable — using form stats only")
            
            # 8. Intangibles (5%)
            intangibles_result = self._analyze_intangibles(fixture)
            if intangibles_result:
                home_score += intangibles_result['home_score'] * (self.weights['intangibles'] / 100)
                away_score += intangibles_result['away_score'] * (self.weights['intangibles'] / 100)
                criteria_scores['intangibles'] = intangibles_result
                confidence_factors.append('intangibles_data')
            
            # Calculate final prediction
            total_score = home_score + away_score
            
            if total_score > 0:
                home_percentage = (home_score / total_score) * 100
                away_percentage = (away_score / total_score) * 100
            else:
                home_percentage = 50.0
                away_percentage = 50.0
            
            # Determine prediction based on admin thresholds
            settings = AdminSettings.query.first()
            home_threshold = settings.home_win_threshold if settings else 65.0
            away_threshold = settings.away_win_threshold if settings else 39.0
            
            if home_percentage >= home_threshold:
                prediction = 'Home'
                confidence = home_percentage
            elif away_percentage >= (100 - away_threshold):
                prediction = 'Away'
                confidence = away_percentage
            else:
                prediction = 'Draw'
                confidence = 100 - max(home_percentage, away_percentage)
            
            # Apply immediate draw override conditions
            if self._check_draw_override_conditions(fixture, criteria_scores):
                prediction = 'Draw'
                confidence = max(50.0, confidence * 0.8)
                warnings.append("⚠️ Draw override applied — special conditions detected")
            
            # Calculate final confidence based on available data
            data_availability = len(confidence_factors) / 8  # 8 total criteria
            final_confidence = confidence * data_availability
            
            # Generate reasoning
            reasoning = self._generate_reasoning(
                home_team, away_team, prediction, final_confidence, 
                criteria_scores, warnings
            )
            
            return {
                'prediction': prediction,
                'confidence': round(final_confidence, 1),
                'reasoning': reasoning,
                'criteria_scores': criteria_scores,
                'warnings': warnings,
                'home_percentage': round(home_percentage, 1),
                'away_percentage': round(away_percentage, 1),
                'data_availability': round(data_availability * 100, 1)
            }
            
        except Exception as e:
            logging.error(f"Error in match prediction: {e}")
            return {
                'prediction': 'Draw',
                'confidence': 35.0,
                'reasoning': 'Prediction failed due to insufficient data',
                'warnings': ['System error occurred during prediction']
            }
    
    def _analyze_form_standings(self, home_team, away_team):
        """Analyze team form and league standings"""
        try:
            home_standing = Standings.query.filter_by(team_id=home_team.id).first()
            away_standing = Standings.query.filter_by(team_id=away_team.id).first()
            
            if not home_standing or not away_standing:
                return None
            
            # Calculate form scores based on position and recent form
            home_form_score = max(0, (20 - home_standing.position)) * 5  # Better position = higher score
            away_form_score = max(0, (20 - away_standing.position)) * 5
            
            # Add points difference factor
            points_diff = home_standing.points - away_standing.points
            if points_diff > 0:
                home_form_score += min(points_diff * 2, 20)
            else:
                away_form_score += min(abs(points_diff) * 2, 20)
            
            return {
                'home_score': home_form_score,
                'away_score': away_form_score,
                'home_position': home_standing.position,
                'away_position': away_standing.position,
                'points_difference': points_diff
            }
            
        except Exception as e:
            logging.error(f"Error analyzing form/standings: {e}")
            return None
    
    def _analyze_home_away_factor(self, home_team, away_team):
        """Analyze home/away performance"""
        try:
            home_standing = Standings.query.filter_by(team_id=home_team.id).first()
            away_standing = Standings.query.filter_by(team_id=away_team.id).first()
            
            if not home_standing or not away_standing:
                return None
            
            # Home advantage calculation
            home_win_rate = home_standing.home_wins / max(1, (home_standing.home_wins + home_standing.home_draws + home_standing.home_losses))
            away_win_rate = away_standing.away_wins / max(1, (away_standing.away_wins + away_standing.away_draws + away_standing.away_losses))
            
            home_score = home_win_rate * 60 + 25  # Base home advantage
            away_score = away_win_rate * 60
            
            return {
                'home_score': home_score,
                'away_score': away_score,
                'home_win_rate': round(home_win_rate * 100, 1),
                'away_win_rate': round(away_win_rate * 100, 1)
            }
            
        except Exception as e:
            logging.error(f"Error analyzing home/away factor: {e}")
            return None
    
    def _analyze_player_availability(self, home_team, away_team):
        """Analyze player injuries and suspensions"""
        try:
            home_injuries = InjurySuspension.query.filter_by(
                player_id=Player.query.filter_by(team_id=home_team.id).subquery().c.id
            ).filter(InjurySuspension.status == 'Out').count()
            
            away_injuries = InjurySuspension.query.filter_by(
                player_id=Player.query.filter_by(team_id=away_team.id).subquery().c.id
            ).filter(InjurySuspension.status == 'Out').count()
            
            # Calculate availability scores (fewer injuries = higher score)
            home_score = max(0, 100 - (home_injuries * 15))
            away_score = max(0, 100 - (away_injuries * 15))
            
            return {
                'home_score': home_score,
                'away_score': away_score,
                'home_injuries': home_injuries,
                'away_injuries': away_injuries
            }
            
        except Exception as e:
            logging.error(f"Error analyzing player availability: {e}")
            return None
    
    def _analyze_match_statistics(self, home_team, away_team):
        """Analyze team statistics and performance metrics"""
        try:
            # This would analyze goals scored/conceded, possession, shots, etc.
            # For now, using standings data as proxy
            
            home_standing = Standings.query.filter_by(team_id=home_team.id).first()
            away_standing = Standings.query.filter_by(team_id=away_team.id).first()
            
            if not home_standing or not away_standing:
                return None
            
            # Goals scored/conceded ratio
            home_goal_diff = home_standing.goal_difference
            away_goal_diff = away_standing.goal_difference
            
            home_score = 50 + min(max(home_goal_diff, -20), 20) * 2
            away_score = 50 + min(max(away_goal_diff, -20), 20) * 2
            
            return {
                'home_score': home_score,
                'away_score': away_score,
                'home_goal_diff': home_goal_diff,
                'away_goal_diff': away_goal_diff
            }
            
        except Exception as e:
            logging.error(f"Error analyzing match statistics: {e}")
            return None
    
    def _analyze_head_to_head(self, home_team, away_team):
        """Analyze head-to-head record"""
        try:
            # Query recent fixtures between these teams
            h2h_fixtures = Fixture.query.filter(
                ((Fixture.home_team_id == home_team.id) & (Fixture.away_team_id == away_team.id)) |
                ((Fixture.home_team_id == away_team.id) & (Fixture.away_team_id == home_team.id))
            ).filter(Fixture.status == 'Finished').order_by(Fixture.kickoff_time.desc()).limit(5).all()
            
            if not h2h_fixtures:
                return None
            
            home_wins = 0
            away_wins = 0
            draws = 0
            
            for fixture in h2h_fixtures:
                if fixture.home_team_id == home_team.id:
                    if fixture.home_score > fixture.away_score:
                        home_wins += 1
                    elif fixture.home_score < fixture.away_score:
                        away_wins += 1
                    else:
                        draws += 1
                else:  # Away team was home in that fixture
                    if fixture.home_score > fixture.away_score:
                        away_wins += 1
                    elif fixture.home_score < fixture.away_score:
                        home_wins += 1
                    else:
                        draws += 1
            
            total_games = len(h2h_fixtures)
            home_score = (home_wins / total_games) * 100
            away_score = (away_wins / total_games) * 100
            
            return {
                'home_score': home_score,
                'away_score': away_score,
                'home_wins': home_wins,
                'away_wins': away_wins,
                'draws': draws,
                'total_games': total_games
            }
            
        except Exception as e:
            logging.error(f"Error analyzing head-to-head: {e}")
            return None
    
    def _get_ai_predictions_consensus(self, fixture_id):
        """Get AI predictions consensus from aggregated sources"""
        try:
            aggregations = PredictionAggregation.query.filter_by(fixture_id=fixture_id).all()
            
            if not aggregations:
                return None
            
            home_count = sum(1 for a in aggregations if a.prediction == 'Home')
            draw_count = sum(1 for a in aggregations if a.prediction == 'Draw')
            away_count = sum(1 for a in aggregations if a.prediction == 'Away')
            
            total = len(aggregations)
            
            if home_count > draw_count and home_count > away_count:
                prediction = 'Home'
                confidence = (home_count / total) * 100
            elif draw_count > away_count:
                prediction = 'Draw'
                confidence = (draw_count / total) * 100
            else:
                prediction = 'Away'
                confidence = (away_count / total) * 100
            
            return {
                'prediction': prediction,
                'confidence': confidence,
                'home_count': home_count,
                'draw_count': draw_count,
                'away_count': away_count,
                'total_sources': total
            }
            
        except Exception as e:
            logging.error(f"Error getting AI consensus: {e}")
            return None
    
    def _analyze_betting_odds(self, fixture_id):
        """Analyze betting odds for market confidence"""
        try:
            odds = BettingOdds.query.filter_by(fixture_id=fixture_id).all()
            
            if not odds:
                return None
            
            # Calculate implied probabilities and find consensus
            home_probs = []
            draw_probs = []
            away_probs = []
            
            for odd in odds:
                if odd.home_odds and odd.draw_odds and odd.away_odds:
                    home_prob = 1 / odd.home_odds
                    draw_prob = 1 / odd.draw_odds
                    away_prob = 1 / odd.away_odds
                    
                    total = home_prob + draw_prob + away_prob
                    
                    home_probs.append((home_prob / total) * 100)
                    draw_probs.append((draw_prob / total) * 100)
                    away_probs.append((away_prob / total) * 100)
            
            if home_probs:
                avg_home_prob = sum(home_probs) / len(home_probs)
                avg_away_prob = sum(away_probs) / len(away_probs)
                
                return {
                    'home_score': avg_home_prob,
                    'away_score': avg_away_prob,
                    'bookmaker_count': len(odds),
                    'home_probability': round(avg_home_prob, 1),
                    'away_probability': round(avg_away_prob, 1)
                }
            
            return None
            
        except Exception as e:
            logging.error(f"Error analyzing betting odds: {e}")
            return None
    
    def _analyze_intangibles(self, fixture):
        """Analyze intangible factors like importance, motivation"""
        try:
            home_score = 50.0
            away_score = 50.0
            factors = []
            
            # Match importance boost
            if fixture.importance_level:
                if fixture.importance_level in ['Derby', 'Final', 'Semi-Final']:
                    home_score += 15  # Home team gets boost in important matches
                    factors.append(f"{fixture.importance_level} match importance")
                
                if fixture.importance_level == 'Relegation':
                    # Both teams get motivation boost, but depends on position
                    home_score += 10
                    away_score += 10
                    factors.append("Relegation battle intensity")
            
            # Weekend vs weekday factor
            if fixture.kickoff_time.weekday() >= 5:  # Weekend
                home_score += 5  # Slightly better home atmosphere
                factors.append("Weekend fixture advantage")
            
            return {
                'home_score': home_score,
                'away_score': away_score,
                'factors': factors
            }
            
        except Exception as e:
            logging.error(f"Error analyzing intangibles: {e}")
            return None
    
    def _check_draw_override_conditions(self, fixture, criteria_scores):
        """Check for conditions that force a draw prediction"""
        try:
            # Override conditions (admin configurable)
            override_conditions = [
                # Very close teams in standings
                self._teams_very_close_standings(fixture),
                # Both teams have poor away/home form
                self._both_teams_poor_form(criteria_scores),
                # Derby matches with close history
                self._derby_with_close_history(fixture, criteria_scores)
            ]
            
            return any(override_conditions)
            
        except Exception as e:
            logging.error(f"Error checking draw override: {e}")
            return False
    
    def _teams_very_close_standings(self, fixture):
        """Check if teams are very close in standings"""
        try:
            home_standing = Standings.query.filter_by(team_id=fixture.home_team_id).first()
            away_standing = Standings.query.filter_by(team_id=fixture.away_team_id).first()
            
            if home_standing and away_standing:
                position_diff = abs(home_standing.position - away_standing.position)
                points_diff = abs(home_standing.points - away_standing.points)
                
                return position_diff <= 2 and points_diff <= 3
            
            return False
            
        except Exception as e:
            logging.error(f"Error checking standings closeness: {e}")
            return False
    
    def _both_teams_poor_form(self, criteria_scores):
        """Check if both teams have poor recent form"""
        try:
            if 'form_standings' in criteria_scores:
                form_data = criteria_scores['form_standings']
                return (form_data['home_score'] < 30 and 
                       form_data['away_score'] < 30)
            return False
            
        except Exception as e:
            logging.error(f"Error checking poor form: {e}")
            return False
    
    def _derby_with_close_history(self, fixture, criteria_scores):
        """Check for derby with close historical record"""
        try:
            if (fixture.importance_level == 'Derby' and 
                'h2h' in criteria_scores):
                
                h2h_data = criteria_scores['h2h']
                total_games = h2h_data['total_games']
                
                if total_games >= 5:
                    home_wins = h2h_data['home_wins']
                    away_wins = h2h_data['away_wins']
                    
                    return abs(home_wins - away_wins) <= 1
            
            return False
            
        except Exception as e:
            logging.error(f"Error checking derby history: {e}")
            return False
    
    def _generate_reasoning(self, home_team, away_team, prediction, confidence, 
                          criteria_scores, warnings):
        """Generate human-readable reasoning for the prediction"""
        try:
            reasoning_parts = []
            
            reasoning_parts.append(f"**{prediction} Win Predicted** ({confidence}% confidence)")
            reasoning_parts.append("")
            
            # Key factors
            reasoning_parts.append("**Key Factors:**")
            
            if 'form_standings' in criteria_scores:
                form = criteria_scores['form_standings']
                reasoning_parts.append(
                    f"• League Position: {home_team.name} ({form['home_position']}) vs "
                    f"{away_team.name} ({form['away_position']})"
                )
            
            if 'home_away' in criteria_scores:
                ha = criteria_scores['home_away']
                reasoning_parts.append(
                    f"• Home/Away Form: {ha['home_win_rate']}% home wins vs "
                    f"{ha['away_win_rate']}% away wins"
                )
            
            if 'player_availability' in criteria_scores:
                pa = criteria_scores['player_availability']
                if pa['home_injuries'] > 0 or pa['away_injuries'] > 0:
                    reasoning_parts.append(
                        f"• Player Availability: {pa['home_injuries']} home injuries, "
                        f"{pa['away_injuries']} away injuries"
                    )
            
            if 'ai_predictions' in criteria_scores:
                ai = criteria_scores['ai_predictions']
                reasoning_parts.append(
                    f"• AI Consensus: {ai['prediction']} ({ai['total_sources']} sources)"
                )
            
            reasoning_parts.append("")
            
            # Warnings
            if warnings:
                reasoning_parts.append("**Data Warnings:**")
                for warning in warnings:
                    reasoning_parts.append(f"• {warning}")
                reasoning_parts.append("")
            
            # Confidence explanation
            if confidence >= 70:
                reasoning_parts.append("**High confidence** prediction based on multiple strong indicators.")
            elif confidence >= 50:
                reasoning_parts.append("**Moderate confidence** prediction with some supporting data.")
            else:
                reasoning_parts.append("**Low confidence** prediction due to limited data availability.")
            
            return "\n".join(reasoning_parts)
            
        except Exception as e:
            logging.error(f"Error generating reasoning: {e}")
            return f"Prediction: {prediction} ({confidence}% confidence)"
