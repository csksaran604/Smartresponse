"""
Accident Incident Model
Represents verified or pending emergency incidents reported by AI or operators.
"""

from backend.extensions import db, utc_now, to_iso_utc


class Accident(db.Model):
    __tablename__ = 'accidents'

    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.String(50), unique=True, nullable=False)
    detection_id = db.Column(db.Integer, db.ForeignKey('accident_detections.id'), nullable=True)
    date_time = db.Column(db.DateTime, default=utc_now)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(20), nullable=False, default='Medium')  # Low, Medium, High, Critical
    ai_confidence = db.Column(db.Float, default=0.0)
    verification_status = db.Column(db.String(30), default='Pending')      # Pending, Verified, Rejected
    response_status = db.Column(db.String(30), default='Pending')          # Pending, Unit Assigned, Dispatched, En Route, On Scene, Resolved, Cancelled
    assigned_unit_id = db.Column(db.Integer, db.ForeignKey('emergency_units.id'), nullable=True)
    reporter = db.Column(db.String(120), default='AI Vision System')
    photo = db.Column(db.Text, nullable=True)
    verified_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    detection = db.relationship('AccidentDetection', back_populates='accident')
    assigned_unit = db.relationship('EmergencyUnit', back_populates='accidents')
    verified_by = db.relationship('User', back_populates='verified_accidents')
    assignments = db.relationship('EmergencyAssignment', back_populates='incident', cascade='all, delete-orphan', lazy=True)
    notifications = db.relationship('Notification', back_populates='incident', cascade='all, delete-orphan', lazy=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'incident_id': self.incident_id,
            'detection_id': self.detection_id,
            'detection': self.detection.to_dict() if self.detection else None,
            'date_time': to_iso_utc(self.date_time),
            'latitude': float(self.latitude),
            'longitude': float(self.longitude),
            'address': self.address,
            'description': self.description,
            'severity': self.severity,
            'ai_confidence': float(self.ai_confidence) if self.ai_confidence else 0.0,
            'verification_status': self.verification_status,
            'response_status': self.response_status,
            'assigned_unit_id': self.assigned_unit_id,
            'assigned_unit': self.assigned_unit.to_dict() if self.assigned_unit else None,
            'reporter': self.reporter,
            'photo': self.photo,
            'verified_by_id': self.verified_by_id,
            'verified_by_name': self.verified_by.full_name if self.verified_by else None,
            'verified_at': to_iso_utc(self.verified_at),
            'created_at': to_iso_utc(self.created_at),
            'updated_at': to_iso_utc(self.updated_at)
        }
