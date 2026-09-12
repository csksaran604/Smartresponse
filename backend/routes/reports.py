"""
Reports & Analytics Routes
Offers aggregated metrics, filtering, and CSV export capabilities for public safety audits.
"""

import io
import csv
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from backend.extensions import db
from backend.models.accident import Accident
from backend.models.emergency_unit import EmergencyUnit
from backend.models.assignment import EmergencyAssignment

reports_bp = Blueprint('reports', __name__)


def apply_filters(query, args):
    start_date = args.get('start_date')
    end_date = args.get('end_date')
    severity = args.get('severity')
    verification_status = args.get('verification_status')
    response_status = args.get('response_status')

    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.filter(Accident.date_time >= sd)
        except Exception:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.filter(Accident.date_time <= ed)
        except Exception:
            pass
    if severity:
        query = query.filter(Accident.severity == severity)
    if verification_status:
        query = query.filter(Accident.verification_status == verification_status)
    if response_status:
        query = query.filter(Accident.response_status == response_status)

    return query


@reports_bp.route('/accidents', methods=['GET'])
@jwt_required()
def get_accidents_report():
    query = apply_filters(Accident.query, request.args)
    accidents = query.order_by(Accident.date_time.desc()).all()

    # Verification summary
    verified_count = sum(1 for a in accidents if a.verification_status == 'Verified')
    rejected_count = sum(1 for a in accidents if a.verification_status == 'Rejected')
    pending_count = sum(1 for a in accidents if a.verification_status == 'Pending')

    # Group by date for per-day accident counts
    daily_counts = {}
    for a in accidents:
        if a.date_time:
            d_str = a.date_time.strftime('%Y-%m-%d')
            daily_counts[d_str] = daily_counts.get(d_str, 0) + 1
    daily_breakdown = [{'date': k, 'count': v} for k, v in sorted(daily_counts.items())]

    return jsonify({
        'total': len(accidents),
        'summary': {
            'verified': verified_count,
            'rejected': rejected_count,
            'pending': pending_count
        },
        'daily_breakdown': daily_breakdown,
        'records': [a.to_dict() for a in accidents]
    }), 200


@reports_bp.route('/daily', methods=['GET'])
@jwt_required()
def get_daily_report():
    query = apply_filters(Accident.query, request.args)
    daily_counts = query.with_entities(
        func.date(Accident.date_time).label('report_date'),
        func.count(Accident.id).label('incident_count')
    ).group_by(func.date(Accident.date_time)).order_by(func.date(Accident.date_time)).all()

    result = [{'date': str(row.report_date), 'count': row.incident_count} for row in daily_counts]
    return jsonify({'daily': result, 'total': sum(r['count'] for r in result)}), 200


@reports_bp.route('/severity', methods=['GET'])
@jwt_required()
def get_severity_report():
    query = apply_filters(Accident.query, request.args)
    severity_counts = query.with_entities(
        Accident.severity, func.count(Accident.id)
    ).group_by(Accident.severity).all()

    result = [{'severity': s, 'count': count} for s, count in severity_counts]
    return jsonify({'severity_distribution': result}), 200


@reports_bp.route('/response-time', methods=['GET'])
@jwt_required()
def get_response_time_report():
    """Computes average dispatch, arrival, and resolution times by unit type."""
    assignments = EmergencyAssignment.query.filter(
        EmergencyAssignment.dispatched_at.isnot(None),
        EmergencyAssignment.assigned_at.isnot(None)
    ).all()

    by_type = {'Ambulance': [], 'Police': [], 'Fire & Rescue': []}

    for a in assignments:
        diff_min = (a.dispatched_at - a.assigned_at).total_seconds() / 60.0
        if diff_min >= 0 and a.unit:
            u_type = a.unit.type
            if u_type in by_type:
                by_type[u_type].append(diff_min)

    summary = []
    for u_type, times in by_type.items():
        avg_t = round(sum(times) / len(times), 1) if times else 0.0
        summary.append({
            'unit_type': u_type,
            'dispatches_tracked': len(times),
            'avg_dispatch_minutes': avg_t
        })

    # Emergency unit usage
    units = EmergencyUnit.query.all()
    unit_usage = []
    for u in units:
        count = EmergencyAssignment.query.filter_by(unit_id=u.id).count()
        unit_usage.append({
            'unit_id': u.unit_id,
            'vehicle_number': u.vehicle_number,
            'type': u.type,
            'total_assignments': count,
            'current_status': u.status
        })

    return jsonify({
        'response_times_by_type': summary,
        'unit_usage': unit_usage
    }), 200


@reports_bp.route('/export-csv', methods=['GET'])
@jwt_required()
def export_accidents_csv():
    query = apply_filters(Accident.query, request.args)
    accidents = query.order_by(Accident.date_time.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Incident ID', 'Date/Time', 'Address', 'Latitude', 'Longitude',
        'Severity', 'AI Confidence (%)', 'Verification Status', 'Response Status',
        'Assigned Unit', 'Reporter', 'Verified By'
    ])

    for a in accidents:
        writer.writerow([
            a.incident_id,
            a.date_time.strftime('%Y-%m-%d %H:%M:%S') if a.date_time else '',
            a.address,
            a.latitude,
            a.longitude,
            a.severity,
            a.ai_confidence,
            a.verification_status,
            a.response_status,
            a.assigned_unit.unit_id if a.assigned_unit else 'None',
            a.reporter,
            a.verified_by.full_name if a.verified_by else 'None'
        ])

    csv_data = output.getvalue()
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=emergency_accidents_report.csv'}
    )
