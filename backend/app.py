from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response
from pymongo import MongoClient
import secrets
import csv
from io import StringIO
from datetime import datetime
import os
import uuid
from werkzeug.utils import secure_filename
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')
TEMPLATES_DIR = os.path.join(FRONTEND_DIR, 'templates')
STATIC_DIR = os.path.join(FRONTEND_DIR, 'static')

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
    static_url_path='/static'
)
app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'student_learning_system')
client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

UPLOAD_FOLDER = os.path.join(app.static_folder, 'uploads', 'assignments')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_next_id(collection_name):
    doc = db[collection_name].find_one(sort=[("id", -1)])
    return (doc["id"] + 1) if doc and "id" in doc else 1

def student_to_dict(s):
    if not s: return None
    return {
        'id': s.get('id'),
        'name': s.get('name', ''),
        'roll_no': s.get('roll_no', ''),
        'email': s.get('email', ''),
        'tamil': s.get('tamil', 0.0), 'english': s.get('english', 0.0), 'maths': s.get('maths', 0.0),
        'science': s.get('science', 0.0), 'social_science': s.get('social_science', 0.0),
        'test_score': s.get('test_score', 0.0), 'attendance': s.get('attendance', 0.0), 'assignment': s.get('assignment', 0.0),
        'stability_score': s.get('stability_score', 0.0), 'category': s.get('category', ''),
        'previous_stability_score': s.get('previous_stability_score', 0.0),
        'prev_test_score': s.get('prev_test_score', 0.0), 'prev_attendance': s.get('prev_attendance', 0.0),
        'prev_assignment': s.get('prev_assignment', 0.0),
        'trend_category': s.get('trend_category', 'New'), 'trend_diff': s.get('trend_diff', 0.0),
        'recommendation': s.get('recommendation', ''),
        'user_role': s.get('user_role', 'student'), 'is_active': s.get('is_active', True),
        'password': s.get('password', ''), 'faculty_id': s.get('faculty_id'),
        'faculty_remarks': s.get('faculty_remarks', ''), 'class_name': s.get('class_name', '')
    }

def classify_risk(stability_score):
    try:
        score = float(stability_score or 0)
    except (TypeError, ValueError):
        score = 0.0
    if score >= 70: return 'stable'
    if score >= 50: return 'moderate'
    return 'high'

def risk_label(risk_key):
    if risk_key == 'stable': return 'Stable'
    if risk_key == 'moderate': return 'Moderate Risk'
    return 'High Risk'

def serialize_student_with_risk(student):
    payload = student_to_dict(student)
    risk_key = classify_risk(student.get('stability_score'))
    payload['risk_level'] = risk_key
    payload['risk_label'] = risk_label(risk_key)
    return payload

def sort_students_by_name(students):
    return sorted(
        students,
        key=lambda s: (
            (s.get('name') or '').strip().lower(),
            (s.get('roll_no') or '').strip().lower(),
            s.get('id') or 0
        )
    )

def student_records_for_analytics():
    records = list(db.student.find({'$or': [{'user_role': 'student'}, {'user_role': {'$exists': False}}]}))
    return sort_students_by_name(records)

def build_risk_summary(students):
    total_students = len(students)
    total_stable = sum(1 for s in students if classify_risk(s.get('stability_score')) == 'stable')
    total_moderate_risk = sum(1 for s in students if classify_risk(s.get('stability_score')) == 'moderate')
    total_high_risk = sum(1 for s in students if classify_risk(s.get('stability_score')) == 'high')
    def pct(v): return round((v / total_students) * 100, 2) if total_students else 0
    return {
        'total_students': total_students, 'total_stable': total_stable,
        'total_moderate_risk': total_moderate_risk, 'total_high_risk': total_high_risk,
        'risk_distribution': {
            'stable_pct': pct(total_stable), 'moderate_pct': pct(total_moderate_risk), 'high_pct': pct(total_high_risk)
        }
    }

def _normalize_token(value):
    return ''.join(ch for ch in (value or '').lower() if ch.isalnum())

def _faculty_email(name, faculty_id):
    return f"{_normalize_token(name)}.{(faculty_id or '').strip().lower()}@gmail.com"

@app.route('/login')
def login_page():
    if 'user_type' in session:
        if session['user_type'] == 'admin': return redirect(url_for('admin'))
        if session['user_type'] == 'faculty': return redirect(url_for('faculty'))
        return redirect(url_for('student'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if email == 'admin123@gmail.com' and password == 'Admin1':
        session['user_type'] = 'admin'
        session['user'] = 'Admin'
        return jsonify({'status': 'success', 'redirect': '/admin'})

    account = db.student.find_one({'email': re.compile(f'^{email}$', re.I)})
    if account:
        if account.get('is_active') is False:
            return jsonify({'status': 'error', 'message': 'Account is deactivated. Contact admin.'})

        role = account.get('user_role') if account.get('user_role') in ['admin', 'faculty', 'student'] else 'student'
        name_token = (account.get('name') or '').strip().lower().split(' ')[0]
        email_token = (account.get('email') or '').strip().lower().split('@')[0].split('.')[0]

        valid = False
        if role == 'faculty':
            expected_email = _faculty_email(account.get('name'), account.get('faculty_id') or account.get('roll_no'))
            valid = (email == expected_email and password == '123')
        else:
            if account.get('password'):
                valid = (password == account.get('password'))
            else:
                valid = (password.lower() == name_token or password.lower() == email_token)

        if valid:
            session['user_type'] = role
            session['user_id'] = account.get('id')
            session['user_name'] = account.get('name')
            session['user_roll'] = account.get('roll_no')
            if role == 'admin': return jsonify({'status': 'success', 'redirect': '/admin'})
            if role == 'faculty': return jsonify({'status': 'success', 'redirect': '/faculty'})
            return jsonify({'status': 'success', 'redirect': '/student'})

    if email.endswith('@gmail.com'):
        try:
            local_part = email.split('@')[0]
            parts = local_part.rsplit('.', 1)
            if len(parts) == 2:
                name_part, roll_part = parts[0], parts[1]
                student = db.student.find_one({'roll_no': roll_part})
                if student and (student.get('is_active') is not False):
                    stored_name = (student.get('name') or '').strip().lower()
                    if password.lower() in [name_part.lower(), stored_name.split(' ')[0]]:
                        session['user_type'] = 'student'
                        session['user_id'] = student.get('id')
                        session['user_name'] = student.get('name')
                        session['user_roll'] = student.get('roll_no')
                        return jsonify({'status': 'success', 'redirect': '/student'})
        except Exception:
            pass

    return jsonify({'status': 'error', 'message': 'Invalid credentials'})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

@app.route('/')
def index():
    return redirect(url_for('login_page'))

@app.route('/admin')
def admin():
    if session.get('user_type') != 'admin':
        return redirect(url_for('login_page'))
    students = student_records_for_analytics()
    summary = build_risk_summary(students)
    return render_template('admin.html', risk_summary=summary)

@app.route('/faculty')
def faculty():
    if session.get('user_type') != 'faculty':
        return redirect(url_for('login_page'))
    students = student_records_for_analytics()
    summary = build_risk_summary(students)
    faculty_class = ''
    faculty_id = session.get('user_id')
    if faculty_id:
        faculty_account = db.student.find_one({'id': faculty_id})
        if faculty_account:
            faculty_class = faculty_account.get('class_name') or ''
    return render_template(
        'faculty.html',
        risk_summary=summary,
        faculty_name=session.get('user_name', 'Faculty'),
        students=students,
        faculty_class=faculty_class
    )

@app.route('/at_risk_students')
def at_risk_students_page():
    if session.get('user_type') != 'admin':
        return redirect(url_for('login_page'))
    return render_template('at_risk_students.html')

@app.route('/student')
def student():
    user_type = session.get('user_type')
    user_id = session.get('user_id')
    if user_type != 'student':
        if user_type == 'admin': return render_template('student.html', user_type=user_type, user_id=user_id)
        if user_type == 'faculty': return redirect(url_for('faculty'))
        return redirect(url_for('login_page'))
    return render_template('student.html', user_type=user_type, user_id=user_id, target_student_id=None, dashboard_only=False)

@app.route('/faculty/student/<int:student_id>')
def faculty_student_dashboard(student_id):
    if session.get('user_type') != 'faculty':
        return redirect(url_for('login_page'))
    student = db.student.find_one({'id': student_id})
    if not student or (student.get('user_role') or 'student') != 'student':
        return redirect(url_for('faculty'))
    return render_template(
        'student.html',
        user_type='faculty_view',
        user_id=session.get('user_id'),
        target_student_id=student_id,
        dashboard_only=True
    )

@app.route('/api/students', methods=['GET', 'POST'])
def manage_students():
    if request.method == 'GET':
        user_type = session.get('user_type')
        if user_type == 'student':
            student_id = session.get('user_id')
            student = db.student.find_one({'id': student_id}) if student_id else None
            return jsonify([serialize_student_with_risk(student)] if student else [])
        if user_type not in ['admin', 'faculty']:
            return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
        students = student_records_for_analytics()
        return jsonify([serialize_student_with_risk(s) for s in students])
    return jsonify({'status': 'error', 'message': 'Student creation is managed by admin in Account portal.'}), 403


@app.route('/api/faculty/assignments', methods=['GET', 'POST'])
def faculty_assignments():
    if session.get('user_type') != 'faculty':
        return jsonify({'status': 'error', 'message': 'Only faculty can manage assignments.'}), 403

    if request.method == 'GET':
        assignments = list(db.assignment.find().sort('id', -1))
        for a in assignments: a['_id'] = str(a['_id'])
        return jsonify({'status': 'success', 'assignments': assignments})

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    due_date = (data.get('due_date') or '').strip()

    if not title: return jsonify({'status': 'error', 'message': 'Assignment title is required'}), 400
    if not due_date: return jsonify({'status': 'error', 'message': 'Deadline is required'}), 400

    assignment = {
        'id': get_next_id('assignment'),
        'title': title, 'description': description, 'due_date': due_date,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'created_by_faculty_id': session.get('user_id')
    }
    db.assignment.insert_one(assignment)

    students = student_records_for_analytics()
    submissions = []
    for student in students:
        submissions.append({
            'id': get_next_id('assignment_submission') + len(submissions),
            'assignment_id': assignment['id'],
            'student_id': student['id'],
            'status': 'Pending',
            'submitted_at': None, 'file_name': None, 'file_path': None, 'assignment_mark': None
        })
    if submissions: db.assignment_submission.insert_many(submissions)

    assignment['_id'] = str(assignment['_id'])
    return jsonify({'status': 'success', 'message': 'Assignment created successfully', 'assignment': assignment})

@app.route('/api/faculty/assignments/<int:assignment_id>/submissions', methods=['GET'])
def faculty_assignment_submissions(assignment_id):
    if session.get('user_type') != 'faculty':
        return jsonify({'status': 'error', 'message': 'Only faculty can view submission status.'}), 403
    assignment = db.assignment.find_one({'id': assignment_id})
    if not assignment: return jsonify({'status': 'error', 'message': 'Assignment not found'}), 404

    assignment['_id'] = str(assignment['_id'])
    subs = list(db.assignment_submission.find({'assignment_id': assignment_id}))
    submissions = []
    for sub in subs:
        student = db.student.find_one({'id': sub['student_id']})
        if not student: continue
        file_url = ''
        if sub.get('file_path'):
            rel_path = sub['file_path'].replace('\\', '/')
            if rel_path.startswith('static/'): rel_path = rel_path[len('static/'):]
            file_url = url_for('static', filename=rel_path)
        submissions.append({
            'id': sub['id'], 'assignment_id': assignment['id'], 'assignment_title': assignment['title'],
            'student_id': student['id'], 'student_name': student.get('name'), 'roll_no': student.get('roll_no'),
            'status': sub.get('status', 'Pending'), 'submitted_at': sub.get('submitted_at'),
            'file_name': sub.get('file_name'), 'file_url': file_url, 'assignment_mark': sub.get('assignment_mark')
        })
    submissions.sort(key=lambda x: ((x.get('student_name') or '').strip().lower(), x.get('roll_no') or ''))
    return jsonify({'status': 'success', 'assignment': assignment, 'submissions': submissions})

@app.route('/api/faculty/assignments/<int:assignment_id>/submissions/<int:student_id>', methods=['PUT'])
def faculty_update_submission_status(assignment_id, student_id):
    if session.get('user_type') != 'faculty':
        return jsonify({'status': 'error', 'message': 'Only faculty can update submission status.'}), 403
    submission = db.assignment_submission.find_one({'assignment_id': assignment_id, 'student_id': student_id})
    if not submission: return jsonify({'status': 'error', 'message': 'Submission record not found'}), 404

    data = request.get_json() or {}
    new_status = (data.get('status') or '').strip().title()
    if new_status not in ['Pending', 'Submitted', 'Late', 'Missing']:
        return jsonify({'status': 'error', 'message': 'Invalid status'}), 400

    updates = {'status': new_status}
    assignment_mark = data.get('assignment_mark')
    if assignment_mark not in [None, '']:
        try: assignment_mark = float(assignment_mark)
        except (TypeError, ValueError): return jsonify({'status': 'error', 'message': 'Invalid mark'}), 400
        if assignment_mark < 0 or assignment_mark > 100: return jsonify({'status': 'error', 'message': 'Mark must be 0-100'}), 400
        updates['assignment_mark'] = assignment_mark

    updates['submitted_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S') if new_status in ['Submitted', 'Late'] else None
    db.assignment_submission.update_one({'_id': submission['_id']}, {'$set': updates})
    return jsonify({'status': 'success', 'message': 'Submission status updated successfully'})

@app.route('/api/student/assignments', methods=['GET'])
def student_assignments():
    if session.get('user_type') != 'student':
        return jsonify({'status': 'error', 'message': 'Only students can access assignments.'}), 403
    student_id = session.get('user_id')
    if not student_id: return jsonify({'status': 'error', 'message': 'Student not found in session.'}), 400

    assignments = list(db.assignment.find().sort('id', -1))
    result = []
    for assignment in assignments:
        submission = db.assignment_submission.find_one({'assignment_id': assignment['id'], 'student_id': student_id})
        if not submission:
            submission = {'id': get_next_id('assignment_submission'), 'assignment_id': assignment['id'], 'student_id': student_id, 'status': 'Pending'}
            db.assignment_submission.insert_one(submission)
        result.append({
            'assignment_id': assignment['id'], 'title': assignment['title'], 'description': assignment.get('description', ''),
            'due_date': assignment['due_date'], 'status': submission.get('status', 'Pending'),
            'submitted_at': submission.get('submitted_at'), 'assignment_mark': submission.get('assignment_mark')
        })
    return jsonify({'status': 'success', 'assignments': result})

@app.route('/api/student/assignments/<int:assignment_id>/submit', methods=['POST', 'PUT'])
def submit_student_assignment(assignment_id):
    if session.get('user_type') != 'student':
        return jsonify({'status': 'error', 'message': 'Only students can submit assignments.'}), 403
    student_id = session.get('user_id')
    
    submission = db.assignment_submission.find_one({'assignment_id': assignment_id, 'student_id': student_id})
    if not submission:
        assignment = db.assignment.find_one({'id': assignment_id})
        if not assignment: return jsonify({'status': 'error', 'message': 'Assignment not found'}), 404
        submission = {'id': get_next_id('assignment_submission'), 'assignment_id': assignment_id, 'student_id': student_id, 'status': 'Pending'}
        result = db.assignment_submission.insert_one(submission)
        submission['_id'] = result.inserted_id

    updates = {}
    upload_file = request.files.get('file')
    if upload_file:
        filename = secure_filename(upload_file.filename or '')
        if not filename or not filename.lower().endswith('.pdf'): return jsonify({'status': 'error', 'message': 'Only PDF file is allowed'}), 400
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_name)
        upload_file.save(save_path)
        updates['file_name'] = filename
        updates['file_path'] = os.path.join('static', 'uploads', 'assignments', unique_name)

    due_date = None
    assignment = db.assignment.find_one({'id': assignment_id})
    if assignment and assignment.get('due_date'):
        try: due_date = datetime.strptime(assignment['due_date'], '%Y-%m-%d')
        except Exception: due_date = None

    now = datetime.now()
    is_late = due_date is not None and now.date() > due_date.date()
    updates['status'] = 'Late' if is_late else 'Submitted'
    updates['submitted_at'] = now.strftime('%Y-%m-%d %H:%M:%S')
    db.assignment_submission.update_one({'_id': submission['_id']}, {'$set': updates})
    return jsonify({'status': 'success', 'message': 'Assignment submitted successfully'})

@app.route('/api/student/feedback', methods=['POST'])
def submit_student_feedback():
    if session.get('user_type') != 'student': return jsonify({'status': 'error', 'message': 'Only students can submit feedback.'}), 403
    data = request.get_json() or {}
    message = (data.get('message') or '').strip()
    if not message: return jsonify({'status': 'error', 'message': 'Feedback message is required'}), 400
    fb = {'id': get_next_id('feedback'), 'student_id': session.get('user_id'), 'message': message, 'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    db.feedback.insert_one(fb)
    return jsonify({'status': 'success', 'message': 'Feedback submitted successfully'})

@app.route('/api/feedback', methods=['GET'])
def list_feedback():
    if session.get('user_type') not in ['admin', 'faculty']: return jsonify({'status': 'error', 'message': 'Only admin/faculty can view feedback.'}), 403
    feedbacks = list(db.feedback.find().sort('id', -1))
    res = []
    for f in feedbacks:
        student = db.student.find_one({'id': f['student_id']})
        if not student:
            continue
        res.append({
            'id': f['id'], 'student_id': f['student_id'], 'student_name': student.get('name'),
            'roll_no': student.get('roll_no'), 'message': f.get('message'), 'created_at': f.get('created_at')
        })
    return jsonify({'status': 'success', 'feedback': res})


@app.route('/api/students/<int:student_id>', methods=['PUT', 'DELETE'])
def update_delete_student(student_id):
    student = db.student.find_one({'id': student_id})
    if not student: return jsonify({'status': 'error', 'message': 'Student not found'}), 404

    if request.method == 'DELETE': return jsonify({'status': 'error', 'message': 'Deleting academic data is not allowed.'}), 403
    if session.get('user_type') != 'faculty': return jsonify({'status': 'error', 'message': 'Only faculty can edit academic records.'}), 403
    if (student.get('user_role') or 'student') != 'student': return jsonify({'status': 'error', 'message': 'Only student records can be updated here.'}), 400

    update_data = request.get_json() or {}
    previous_score = student.get('stability_score', 0)
    
    updates = {
        'prev_test_score': student.get('test_score', 0),
        'prev_attendance': student.get('attendance', 0),
        'prev_assignment': student.get('assignment', 0)
    }

    try:
        tamil = float(update_data.get('tamil', student.get('tamil', 0)))
        english = float(update_data.get('english', student.get('english', 0)))
        maths = float(update_data.get('maths', student.get('maths', 0)))
        science = float(update_data.get('science', student.get('science', 0)))
        social = float(update_data.get('social_science', student.get('social_science', 0)))
        test_score = round((tamil + english + maths + science + social) / 5, 2)
        attendance = float(update_data.get('attendance', student.get('attendance', 0)))
        assignment = float(update_data.get('assignment', student.get('assignment', 0)))

        updates.update({
            'tamil': tamil, 'english': english, 'maths': maths, 'science': science,
            'social_science': social, 'test_score': test_score, 'attendance': attendance, 'assignment': assignment
        })

        new_stability_score = round((test_score + attendance + assignment) / 3, 2)
        category = "Low Stability (Needs Improvement)"
        if new_stability_score >= 80: category = "High Stability (Advanced Learner)"
        elif new_stability_score >= 50: category = "Moderate Stability (Average Learner)"
        
        updates['stability_score'] = new_stability_score
        updates['category'] = category

        diff = new_stability_score - previous_score
        diff_percent = round((diff / previous_score) * 100, 2) if previous_score > 0 else 0
        
        trend_category = "Significant Decline"
        recommendation = "Attention needed. Please seek remedial support."
        if diff_percent >= 10:
            trend_category = "Significant Improvement"
            recommendation = "Great job! Keep up the excellent work."
        elif diff_percent > 0:
            trend_category = "Moderate Improvement"
            recommendation = "Good progress. Maintain this momentum."
        elif diff_percent == 0:
            trend_category = "No Change"
            recommendation = "Consistent. Look for areas to improve further."
        elif diff_percent > -10:
            trend_category = "Moderate Decline"
            recommendation = "Slight dip. Review recent topics to get back on track."

        updates.update({
            'previous_stability_score': previous_score, 'trend_category': trend_category,
            'trend_diff': diff_percent, 'recommendation': recommendation,
            'faculty_remarks': (update_data.get('faculty_remarks') or student.get('faculty_remarks', '')).strip()
        })
        db.student.update_one({'_id': student['_id']}, {'$set': updates})
        return jsonify({'status': 'success', 'message': 'Student updated successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/admin/risk_summary', methods=['GET'])
def admin_risk_summary():
    if session.get('user_type') != 'admin':
        return jsonify({'status': 'error', 'message': 'Only admin can view risk analytics.'}), 403
    students = student_records_for_analytics()
    return jsonify({'status': 'success', 'summary': build_risk_summary(students)})

@app.route('/api/at_risk_students', methods=['GET'])
def at_risk_students_api():
    if session.get('user_type') != 'admin':
        return jsonify({'status': 'error', 'message': 'Only admin can view at-risk students.'}), 403
    students = student_records_for_analytics()
    at_risk = [s for s in students if classify_risk(s.get('stability_score')) in ['moderate', 'high']]
    at_risk = sort_students_by_name(at_risk)
    return jsonify([serialize_student_with_risk(s) for s in at_risk])

@app.route('/api/users/<int:student_id>/access', methods=['PUT'])
def update_user_access(student_id):
    if session.get('user_type') != 'admin': return jsonify({'status': 'error', 'message': 'Only admin can manage roles and account status.'}), 403
    student = db.student.find_one({'id': student_id})
    if not student: return jsonify({'status': 'error', 'message': 'Student not found'}), 404

    data = request.get_json() or {}
    new_role = data.get('user_role')
    is_active = data.get('is_active')
    updates = {}
    if new_role is not None:
        if new_role not in ['admin', 'student', 'faculty']: return jsonify({'status': 'error', 'message': 'Invalid role value'}), 400
        updates['user_role'] = new_role
    if is_active is not None:
        updates['is_active'] = bool(is_active)
    if updates: db.student.update_one({'_id': student['_id']}, {'$set': updates})
    return jsonify({'status': 'success', 'message': 'User access updated successfully'})

@app.route('/api/accounts', methods=['GET', 'POST'])
def manage_accounts():
    if session.get('user_type') != 'admin': return jsonify({'status': 'error', 'message': 'Only admin can manage accounts.'}), 403

    if request.method == 'GET':
        accounts = sort_students_by_name(list(db.student.find()))
        return jsonify([student_to_dict(a) for a in accounts])

    data = request.get_json() or {}
    account_type = (data.get('account_type') or '').strip().lower()
    name = (data.get('name') or '').strip()
    class_name = (data.get('class_name') or '').strip()
    if account_type not in ['student', 'faculty']: return jsonify({'status': 'error', 'message': 'Invalid account type'}), 400
    if not name: return jsonify({'status': 'error', 'message': 'Name is required'}), 400

    if account_type == 'student':
        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        if not email or not password: return jsonify({'status': 'error', 'message': 'Email and password are required for student account'}), 400
        existing_email = db.student.find_one({'email': re.compile(f'^{email}$', re.I)})
        roll_no = (data.get('roll_no') or '').strip()
        if not roll_no: return jsonify({'status': 'error', 'message': 'Roll Number is required for student account'}), 400
        existing_by_roll = db.student.find_one({'roll_no': roll_no})

        if existing_by_roll:
            if existing_email and existing_email['_id'] != existing_by_roll['_id']:
                return jsonify({'status': 'error', 'message': 'Email already exists for another account'}), 400
            db.student.update_one({'_id': existing_by_roll['_id']}, {'$set': {
                'name': name, 'email': email, 'password': password, 'user_role': 'student', 'is_active': True, 'class_name': class_name
            }})
            existing_assignments = list(db.assignment.find())
            for assn in existing_assignments:
                if not db.assignment_submission.find_one({'assignment_id': assn['id'], 'student_id': existing_by_roll['id']}):
                    db.assignment_submission.insert_one({'id': get_next_id('assignment_submission'), 'assignment_id': assn['id'], 'student_id': existing_by_roll['id'], 'status': 'Pending'})
            return jsonify({'status': 'success', 'message': 'Student account updated successfully'})
        
        if existing_email: return jsonify({'status': 'error', 'message': 'Email already exists'}), 400
        new_student = {
            'id': get_next_id('student'), 'name': name, 'roll_no': roll_no, 'email': email, 'password': password,
            'user_role': 'student', 'is_active': True, 'category': 'New Account', 'class_name': class_name,
            'tamil': 0.0, 'english': 0.0, 'maths': 0.0, 'science': 0.0, 'social_science': 0.0,
            'test_score': 0.0, 'attendance': 0.0, 'assignment': 0.0, 'stability_score': 0.0,
            'previous_stability_score': 0.0, 'prev_test_score': 0.0, 'prev_attendance': 0.0, 'prev_assignment': 0.0,
            'trend_category': 'New', 'trend_diff': 0.0, 'recommendation': '', 'faculty_id': None, 'faculty_remarks': ''
        }
        res = db.student.insert_one(new_student)
        new_student_id = new_student['id']
        existing_assignments = list(db.assignment.find())
        for assn in existing_assignments:
            db.assignment_submission.insert_one({'id': get_next_id('assignment_submission'), 'assignment_id': assn['id'], 'student_id': new_student_id, 'status': 'Pending'})
        return jsonify({'status': 'success', 'message': 'Student account created successfully'})

    faculty_id = (data.get('faculty_id') or '').strip()
    if not faculty_id: return jsonify({'status': 'error', 'message': 'Faculty ID is required for faculty account'}), 400
    email = _faculty_email(name, faculty_id)
    password = '123'
    existing_email = db.student.find_one({'email': re.compile(f'^{email}$', re.I)})
    existing_by_faculty_id = db.student.find_one({'$or': [{'faculty_id': faculty_id}, {'roll_no': faculty_id}]})
    
    if existing_by_faculty_id:
        if existing_email and existing_email['_id'] != existing_by_faculty_id['_id']:
            return jsonify({'status': 'error', 'message': 'Email already exists for another account'}), 400
        db.student.update_one({'_id': existing_by_faculty_id['_id']}, {'$set': {
            'name': name, 'email': email, 'password': password, 'user_role': 'faculty', 'faculty_id': faculty_id,
            'is_active': True, 'class_name': class_name
        }})
        return jsonify({'status': 'success', 'message': f'Faculty account updated. Login: {email} | Password: 123'})
    
    if existing_email: return jsonify({'status': 'error', 'message': 'Email already exists'}), 400
    db.student.insert_one({
        'id': get_next_id('student'), 'name': name, 'roll_no': faculty_id, 'faculty_id': faculty_id, 'email': email, 'password': password,
        'user_role': 'faculty', 'is_active': True, 'category': 'Faculty Account', 'class_name': class_name
    })
    return jsonify({'status': 'success', 'message': f'Faculty account created. Login: {email} | Password: 123'})

@app.route('/api/accounts/<int:account_id>', methods=['PUT', 'DELETE'])
def update_account_details(account_id):
    if session.get('user_type') != 'admin':
        return jsonify({'status': 'error', 'message': 'Only admin can manage account details.'}), 403
    account = db.student.find_one({'id': account_id})
    if not account: return jsonify({'status': 'error', 'message': 'Account not found'}), 404

    if request.method == 'DELETE':
        if session.get('user_id') == account['id']: return jsonify({'status': 'error', 'message': 'You cannot delete your own active account.'}), 400
        db.student.delete_one({'_id': account['_id']})
        db.feedback.delete_many({'student_id': account['id']})
        db.assignment_submission.delete_many({'student_id': account['id']})
        return jsonify({'status': 'success', 'message': 'Account deleted successfully'})

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()
    account_type = (data.get('account_type') or '').strip().lower()
    identity_value = (data.get('identity_value') or '').strip()
    class_name = (data.get('class_name') or '').strip()

    if account_type not in ['student', 'faculty']: account_type = account.get('user_role') if account.get('user_role') in ['student', 'faculty'] else 'student'
    if not name: return jsonify({'status': 'error', 'message': 'Name is required'}), 400
    if not identity_value: return jsonify({'status': 'error', 'message': 'ID value is required'}), 400

    if account_type == 'faculty':
        email = _faculty_email(name, identity_value)
        password = '123'
    elif not email: return jsonify({'status': 'error', 'message': 'Email is required'}), 400

    email_owner = db.student.find_one({'email': re.compile(f'^{email}$', re.I)})
    if email_owner and email_owner['_id'] != account['_id']: return jsonify({'status': 'error', 'message': 'Email already exists'}), 400
    identity_owner = db.student.find_one({'roll_no': identity_value})
    if identity_owner and identity_owner['_id'] != account['_id']: return jsonify({'status': 'error', 'message': 'ID already exists'}), 400

    updates = {'name': name, 'email': email, 'class_name': class_name}
    if password: updates['password'] = password
    if account_type == 'faculty':
        updates['user_role'] = 'faculty'
        updates['faculty_id'] = identity_value
        updates['roll_no'] = identity_value
    else:
        updates['roll_no'] = identity_value
        updates['faculty_id'] = None
        
    db.student.update_one({'_id': account['_id']}, {'$set': updates})
    return jsonify({'status': 'success', 'message': 'Account details updated successfully'})


def _pdf_escape(text):
    return str(text or '').replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _wrap_text(text, max_chars=70):
    words = str(text or '').strip().split()
    if not words:
        return ['-']

    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _format_percent(value):
    try:
        return f"{float(value):.2f}%"
    except (TypeError, ValueError):
        return "0.00%"


def _build_single_page_pdf(commands):
    stream_data = "\n".join(commands).encode('latin-1', errors='ignore')

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj")
    objects.append(b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> >> endobj")
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj")
    objects.append(b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj")
    objects.append(b"6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >> endobj")
    objects.append(f"7 0 obj << /Length {len(stream_data)} >> stream\n".encode('latin-1') + stream_data + b"\nendstream endobj")

    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj + b"\n"
    xref_pos = len(pdf)
    pdf += f"xref\n0 {len(objects)+1}\n".encode('latin-1')
    pdf += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        pdf += f"{off:010d} 00000 n \n".encode('latin-1')
    pdf += f"trailer << /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode('latin-1')
    return pdf


def _simple_pdf(lines):
    content = ["BT /F1 11 Tf 50 790 Td"]
    for i, line in enumerate(lines):
        if i > 0:
            content.append("0 -16 Td")
        content.append(f"({_pdf_escape(line)}) Tj")
    content.append("ET")
    return _build_single_page_pdf(content)


def _student_report_pdf(student):
    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    school_name = "SVGV Matriculation Higher Secondary School"
    report_id = f"SR-{(student.get('roll_no') or 'NA')}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    risk_name = risk_label(classify_risk(student.get('stability_score')))

    commands = []

    def add_text(x, y, text, font='F1', size=10, color=(0.10, 0.12, 0.17)):
        commands.append("BT")
        commands.append(f"/{font} {size} Tf")
        commands.append(f"{color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg")
        commands.append(f"1 0 0 1 {x} {y} Tm")
        commands.append(f"({_pdf_escape(text)}) Tj")
        commands.append("ET")

    def add_rect(x, y, w, h, fill=None, stroke=None, mode='S'):
        if fill is not None:
            commands.append(f"{fill[0]:.3f} {fill[1]:.3f} {fill[2]:.3f} rg")
        if stroke is not None:
            commands.append(f"{stroke[0]:.3f} {stroke[1]:.3f} {stroke[2]:.3f} RG")
        commands.append(f"{x} {y} {w} {h} re {mode}")

    # Page frame and header
    add_rect(32, 32, 548, 728, stroke=(0.78, 0.82, 0.89), mode='S')
    add_rect(32, 708, 548, 52, fill=(0.10, 0.27, 0.46), mode='f')
    add_text(48, 739, school_name, font='F2', size=15, color=(1.0, 1.0, 1.0))
    add_text(48, 719, "Student Performance Report", font='F1', size=11, color=(0.90, 0.95, 1.0))

    # Report metadata
    add_text(48, 690, f"Generated On: {generated_at}", font='F1', size=10, color=(0.20, 0.23, 0.30))
    add_text(355, 690, f"Report ID: {report_id}", font='F1', size=10, color=(0.20, 0.23, 0.30))
    commands.append("0.85 0.89 0.94 RG")
    commands.append("48 683 m 564 683 l S")

    y = 656

    def add_section(title):
        nonlocal y
        add_rect(44, y - 4, 524, 18, fill=(0.16, 0.38, 0.61), mode='f')
        add_text(52, y, title, font='F2', size=10, color=(1.0, 1.0, 1.0))
        y -= 24

    def add_row(label, value, max_chars=68):
        nonlocal y
        add_text(52, y, f"{label}:", font='F2', size=10, color=(0.15, 0.18, 0.24))
        wrapped = _wrap_text(value, max_chars=max_chars)
        for i, line in enumerate(wrapped):
            add_text(185, y - (i * 13), line, font='F1', size=10, color=(0.12, 0.12, 0.12))
        y -= max(16, (13 * len(wrapped)) + 4)

    add_section("Student Information")
    add_row("Student Name", student.get('name', ''))
    add_row("Roll Number", student.get('roll_no', ''))
    add_row("Class", student.get('class_name', ''))
    add_row("Email", student.get('email', ''))
    add_row("Risk Level", risk_name)

    y -= 4
    add_section("Performance Summary")
    add_row("Stability Score", _format_percent(student.get('stability_score', 0)))
    add_row("Category", student.get('category', ''))
    add_row("Trend Change", _format_percent(student.get('trend_diff', 0)))
    add_row("Test Score", _format_percent(student.get('test_score', 0)))
    add_row("Attendance", _format_percent(student.get('attendance', 0)))
    add_row("Assignment", _format_percent(student.get('assignment', 0)))

    y -= 4
    add_section("Subject Breakdown")
    add_row("Tamil", _format_percent(student.get('tamil', 0)))
    add_row("English", _format_percent(student.get('english', 0)))
    add_row("Maths", _format_percent(student.get('maths', 0)))
    add_row("Science", _format_percent(student.get('science', 0)))
    add_row("Social Science", _format_percent(student.get('social_science', 0)))

    remarks = (student.get('faculty_remarks') or '').strip()
    if remarks:
        y -= 4
        add_section("Faculty Remarks")
        add_row("Remarks", remarks, max_chars=66)

    # Footer
    commands.append("0.85 0.89 0.94 RG")
    commands.append("48 68 m 564 68 l S")
    add_text(48, 52, "This is a system-generated academic report.", font='F3', size=9, color=(0.38, 0.42, 0.50))
    add_text(350, 52, school_name, font='F3', size=9, color=(0.38, 0.42, 0.50))

    return _build_single_page_pdf(commands)

@app.route('/api/reports/csv', methods=['GET'])
def export_students_csv():
    if session.get('user_type') != 'admin': return jsonify({'status': 'error', 'message': 'Only admin can generate reports.'}), 403
    students = student_records_for_analytics()
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['ID', 'Name', 'Roll No', 'Class', 'Email', 'Role', 'Active', 'Stability Score', 'Category', 'Trend Diff (%)', 'Test Score', 'Attendance', 'Assignment'])
    for s in students:
        writer.writerow([s['id'], s.get('name', ''), s.get('roll_no', ''), s.get('class_name', ''), s.get('email', ''), s.get('user_role', 'student'), 
                         'Yes' if s.get('is_active', True) else 'No', s.get('stability_score', 0), s.get('category', ''), 
                         s.get('trend_diff', 0), s.get('test_score', 0), s.get('attendance', 0), s.get('assignment', 0)])
    filename = f"student_stability_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(si.getvalue(), mimetype='text/csv', headers={'Content-Disposition': f'attachment; filename={filename}'})

@app.route('/api/reports/pdf', methods=['GET'])
def export_students_pdf():
    if session.get('user_type') != 'admin': return jsonify({'status': 'error', 'message': 'Only admin can generate reports.'}), 403
    students = student_records_for_analytics()
    lines = ["Student Stability Report", f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "-" * 80]
    for s in students:
        lines.append(f"#{s['id']} | {s.get('name', '')} | Roll: {s.get('roll_no', '')} | Class: {s.get('class_name', '')} | Role: {s.get('user_role', 'student')} | Active: {'Yes' if s.get('is_active', True) else 'No'} | Stability: {s.get('stability_score', 0)}% | Trend: {s.get('trend_diff', 0)}%")
    pdf_bytes = _simple_pdf(lines)
    filename = f"student_stability_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(pdf_bytes, mimetype='application/pdf', headers={'Content-Disposition': f'attachment; filename={filename}'})

@app.route('/api/reports/student/pdf', methods=['GET'])
@app.route('/api/reports/student/<int:student_id>/pdf', methods=['GET'])
def export_single_student_pdf(student_id=None):
    user_type = session.get('user_type')
    session_user_id = session.get('user_id')
    if user_type not in ['admin', 'faculty', 'student']: return jsonify({'status': 'error', 'message': 'Unauthorized'}), 403
    target_id = student_id if student_id is not None else session_user_id
    if not target_id: return jsonify({'status': 'error', 'message': 'Student not specified'}), 400
    if user_type == 'student' and int(target_id) != int(session_user_id or 0): return jsonify({'status': 'error', 'message': 'You can only export your own report.'}), 403
    
    student = db.student.find_one({'id': target_id})
    if not student: return jsonify({'status': 'error', 'message': 'Student not found'}), 404

    pdf_bytes = _student_report_pdf(student)
    filename = f"student_report_{student.get('roll_no', '')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(pdf_bytes, mimetype='application/pdf', headers={'Content-Disposition': f'attachment; filename={filename}'})

if __name__ == '__main__':
    debug_mode = str(os.getenv('FLASK_DEBUG', 'false')).strip().lower() in ['1', 'true', 'yes', 'on']
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5001'))
    app.run(debug=debug_mode, host=host, port=port)

