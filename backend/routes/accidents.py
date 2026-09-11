"""
Accident Incident Management Routes
Complete CRUD, human-in-the-loop verification, and emergency response lifecycle.
"""

from datetime import datetime, timezone
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.extensions import db
from backend.models.accident import Accident
from backend.models.accident_detection import AccidentDetection
from backend.models.emergency_unit import EmergencyUnit
from backend.models.assignment import EmergencyAssignment
from backend.models.user import User
from backend.middleware.auth_middleware import operator_or_admin_required, admin_required
from backend.services.audit_service import log_action
from backend.services.notification_service import create_notification

accidents_bp = Blueprint('accidents', __name__)


@accidents_bp.route('', methods=['GET'])
@jwt_required()
def get_accidents():
    """Retrieve filtered list of accidents."""
    verification_status = request.args.get('verification_status')
    response_status = request.args.get('response_status')
    severity = request.args.get('severity')
    search = request.args.get('search', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    query = Accident.query

    if verification_status:
        query = query.filter_by(verification_status=verification_status)
    if response_status:
        query = query.filter_by(response_status=response_status)
    if severity:
        query = query.filter_by(severity=severity)
    if search:
        query = query.filter(
            (Accident.incident_id.ilike(f'%{search}%')) |
            (Accident.address.ilike(f'%{search}%')) |
            (Accident.description.ilike(f'%{search}%'))
        )

    query = query.order_by(Accident.date_time.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'accidents': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    }), 200


@accidents_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_accident_detail(id):
    """Retrieve full incident details including assignment timeline."""
    accident = db.session.get(Accident, id)
    if not accident:
        return jsonify({'error': 'Accident not found'}), 404
    data = accident.to_dict()
    data['timeline'] = [a.to_dict() for a in accident.assignments]
    return jsonify({'accident': data}), 200


@accidents_bp.route('', methods=['POST'])
@jwt_required()
def create_accident():
    """Create a new accident record from AI detection or operator report."""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if user_id else None
    data = request.get_json() or {}

    detection_id = data.get('detection_id')
    latitude = data.get('latitude', 40.7128)
    longitude = data.get('longitude', -74.0060)
    address = data.get('address', '').strip()
    description = data.get('description', '').strip()
    severity = data.get('severity', 'Medium')
    ai_confidence = data.get('ai_confidence', 0.0)
    reporter = data.get('reporter', user.full_name if user else 'Emergency Dispatcher')
    photo = data.get('photo') or data.get('photo_url')

    if not address:
        address = f"Coordinates: {latitude:.4f}, {longitude:.4f}"

    incident_code = f"INC-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:6].upper()}"

    accident = Accident(
        incident_id=incident_code,
        detection_id=detection_id,
        latitude=float(latitude),
        longitude=float(longitude),
        address=address,
        description=description,
        severity=severity,
        ai_confidence=float(ai_confidence),
        verification_status='Pending',
        response_status='Pending',
        reporter=reporter,
        photo=photo
    )

    db.session.add(accident)
    db.session.commit()

    log_action(
        user_id=user.id if user else None,
        username=user.username if user else 'SYSTEM',
        action='CREATE_ACCIDENT',
        entity='Accident',
        entity_id=accident.incident_id,
        details=f'Created incident {accident.incident_id} at {address} with severity {severity}'
    )

    create_notification(
        title=f"New Incident Registered: {accident.incident_id}",
        message=f"Incident registered at {address}. Severity: {severity}. Requires verification.",
        notification_type='detection',
        severity='warning' if severity in ['High', 'Critical'] else 'info',
        incident_id=accident.id
    )

    return jsonify({
        'message': 'Accident registered successfully',
        'accident': accident.to_dict()
    }), 201


@accidents_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@operator_or_admin_required()
def update_accident(id):
    """Update editable fields of an accident record."""
    accident = db.session.get(Accident, id)
    if not accident:
        return jsonify({'error': 'Accident not found'}), 404
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if user_id else None
    data = request.get_json() or {}

    if 'address' in data:
        accident.address = data['address'].strip()
    if 'description' in data:
        accident.description = data['description'].strip()
    if 'severity' in data:
        accident.severity = data['severity']
    if 'latitude' in data:
        accident.latitude = float(data['latitude'])
    if 'longitude' in data:
        accident.longitude = float(data['longitude'])

    db.session.commit()

    log_action(
        user_id=user.id if user else None,
        username=user.username if user else 'UNKNOWN',
        action='UPDATE_ACCIDENT',
        entity='Accident',
        entity_id=accident.incident_id,
        details=f'Updated accident {accident.incident_id} details'
    )

    return jsonify({'message': 'Accident updated', 'accident': accident.to_dict()}), 200


@accidents_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@admin_required()
def delete_accident(id):
    """Delete an accident record (Admin only)."""
    accident = db.session.get(Accident, id)
    if not accident:
        return jsonify({'error': 'Accident not found'}), 404
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if user_id else None
    incident_code = accident.incident_id

    db.session.delete(accident)
    db.session.commit()

    log_action(
        user_id=user.id if user else None,
        username=user.username if user else 'ADMIN',
        action='DELETE_ACCIDENT',
        entity='Accident',
        entity_id=incident_code,
        details=f'Deleted incident {incident_code}'
    )

    return jsonify({'message': f'Incident {incident_code} deleted'}), 200


@accidents_bp.route('/<int:id>/verify', methods=['PUT'])
@jwt_required()
@operator_or_admin_required()
def verify_accident(id):
    """
    Human verification step.
    Operator confirms or rejects the AI incident detection.
    """
    accident = db.session.get(Accident, id)
    if not accident:
        return jsonify({'error': 'Accident not found'}), 404
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if user_id else None
    data = request.get_json() or {}

    status = data.get('verification_status')
    if status not in ['Verified', 'Rejected']:
        return jsonify({'error': 'verification_status must be either "Verified" or "Rejected"'}), 400

    accident.verification_status = status
    accident.verified_by_id = user.id if user else None
    accident.verified_at = datetime.now(timezone.utc)
    
    if 'severity' in data:
        accident.severity = data['severity']

    if status == 'Rejected':
        accident.response_status = 'Cancelled'

    db.session.commit()

    action_name = 'VERIFY_INCIDENT' if status == 'Verified' else 'REJECT_INCIDENT'
    log_action(
        user_id=user.id,
        username=user.username,
        action=action_name,
        entity='Accident',
        entity_id=accident.incident_id,
        details=f"Operator {user.full_name} marked {accident.incident_id} as {status}"
    )

    create_notification(
        title=f"Incident {status}: {accident.incident_id}",
        message=f"{accident.incident_id} has been marked as {status} by {user.full_name}.",
        notification_type='status',
        severity='warning' if status == 'Verified' else 'info',
        incident_id=accident.id
    )

    return jsonify({
        'message': f'Incident successfully marked as {status}',
        'accident': accident.to_dict()
    }), 200


@accidents_bp.route('/<int:id>/status', methods=['PUT'])
@jwt_required()
@operator_or_admin_required()
def update_accident_response_status(id):
    """
    Emergency lifecycle transition.
    Statuses: Pending -> Unit Assigned -> Dispatched -> En Route -> On Scene -> Resolved -> Cancelled
    Human verification is required prior to dispatch.
    """
    accident = db.session.get(Accident, id)
    if not accident:
        return jsonify({'error': 'Accident not found'}), 404
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if user_id else None
    data = request.get_json() or {}

    new_status = data.get('response_status')
    valid_statuses = ['Pending', 'Unit Assigned', 'Dispatched', 'En Route', 'On Scene', 'Resolved', 'Cancelled']
    
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid response status. Allowed: {valid_statuses}'}), 400

    # Scientific integrity guard: require human verification before active dispatch
    if new_status in ['Dispatched', 'En Route', 'On Scene'] and accident.verification_status != 'Verified':
        return jsonify({
            'error': 'Verification Required',
            'message': 'Incident must be human-verified before dispatching emergency response units.'
        }), 400

    old_status = accident.response_status
    accident.response_status = new_status

    # If resolved or cancelled, release assigned emergency unit
    if new_status in ['Resolved', 'Cancelled'] and accident.assigned_unit:
        accident.assigned_unit.status = 'Available'

    db.session.commit()

    log_action(
        user_id=user.id,
        username=user.username,
        action='STATUS_CHANGE',
        entity='Accident',
        entity_id=accident.incident_id,
        details=f'Changed response status from {old_status} to {new_status}'
    )

    create_notification(
        title=f"Incident Status: {new_status}",
        message=f"Incident {accident.incident_id} transitioned to {new_status}.",
        notification_type='status',
        severity='info' if new_status != 'Critical' else 'critical',
        incident_id=accident.id
    )

    return jsonify({
        'message': f'Incident status transitioned to {new_status}',
        'accident': accident.to_dict()
    }), 200
