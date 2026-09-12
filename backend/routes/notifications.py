"""
Notification & Alert Routes
Provides in-app alerts for AI detections, severity warnings, and dispatch updates.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from backend.extensions import db
from backend.models.notification import Notification

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    unread_only = request.args.get('unread', 'false').lower() == 'true'
    severity = request.args.get('severity')
    limit = request.args.get('limit', 50, type=int)

    query = Notification.query
    if unread_only:
        query = query.filter_by(is_read=False)
    if severity:
        query = query.filter_by(severity=severity)

    notes = query.order_by(Notification.created_at.desc()).limit(limit).all()
    unread_count = Notification.query.filter_by(is_read=False).count()

    return jsonify({
        'notifications': [n.to_dict() for n in notes],
        'unread_count': unread_count
    }), 200


@notifications_bp.route('/<int:id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(id):
    note = db.session.get(Notification, id)
    if not note:
        return jsonify({'error': 'Notification not found'}), 404
    note.is_read = True
    db.session.commit()
    return jsonify({'message': 'Notification marked as read', 'notification': note.to_dict()}), 200


@notifications_bp.route('/read-all', methods=['PUT'])
@jwt_required()
def mark_all_notifications_read():
    Notification.query.filter_by(is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'}), 200


@notifications_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_notification(id):
    note = db.session.get(Notification, id)
    if not note:
        return jsonify({'error': 'Notification not found'}), 404
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Notification deleted successfully'}), 200


@notifications_bp.route('', methods=['DELETE'])
@jwt_required()
def clear_all_notifications():
    Notification.query.delete()
    db.session.commit()
    return jsonify({'message': 'All notifications cleared'}), 200

