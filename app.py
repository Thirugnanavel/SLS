from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
import json
import os
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(16) # Secure secret key

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///students.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Student Model
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    roll_no = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), nullable=False)
    
    # Subject Marks
    tamil = db.Column(db.Float, default=0.0)
    english = db.Column(db.Float, default=0.0)
    maths = db.Column(db.Float, default=0.0)
    science = db.Column(db.Float, default=0.0)
    social_science = db.Column(db.Float, default=0.0)

    # Scores (Calculated)
    test_score = db.Column(db.Float, default=0.0) # Average of 5 subjects
    attendance = db.Column(db.Float, default=0.0)
    assignment = db.Column(db.Float, default=0.0)
    
    # Analysis
    stability_score = db.Column(db.Float, default=0.0)
    category = db.Column(db.String(100))
    
    # Trends
    previous_stability_score = db.Column(db.Float, default=0.0)
    prev_test_score = db.Column(db.Float, default=0.0)
    prev_attendance = db.Column(db.Float, default=0.0)
    prev_assignment = db.Column(db.Float, default=0.0)

    trend_category = db.Column(db.String(100), default="New")
    trend_diff = db.Column(db.Float, default=0.0)
    recommendation = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'roll_no': self.roll_no,
            'email': self.email,
            'tamil': self.tamil,
            'english': self.english,
            'maths': self.maths,
            'science': self.science,
            'social_science': self.social_science,
            'test_score': self.test_score,
            'attendance': self.attendance,
            'assignment': self.assignment,
            'stability_score': self.stability_score,
            'category': self.category,
            'previous_stability_score': self.previous_stability_score,
            'prev_test_score': self.prev_test_score,
            'prev_attendance': self.prev_attendance,
            'prev_assignment': self.prev_assignment,
            'trend_category': self.trend_category,
            'trend_diff': self.trend_diff,
            'recommendation': self.recommendation
        }

# Migration Logic (Enhanced for Schema Updates)
def check_and_migrate_db():
    with app.app_context():
        # Check if columns exist
        inspector = db.inspect(db.engine)
        columns = [c['name'] for c in inspector.get_columns('student')]
        
        new_columns = {
            'tamil': 'FLOAT DEFAULT 0',
            'english': 'FLOAT DEFAULT 0',
            'maths': 'FLOAT DEFAULT 0',
            'science': 'FLOAT DEFAULT 0',
            'social_science': 'FLOAT DEFAULT 0',
            'prev_test_score': 'FLOAT DEFAULT 0',
            'prev_attendance': 'FLOAT DEFAULT 0',
            'prev_assignment': 'FLOAT DEFAULT 0'
        }
        
        for col, type_def in new_columns.items():
            if col not in columns:
                print(f"Migrating DB: Adding column {col}...")
                with db.engine.connect() as conn:
                    conn.execute(text(f'ALTER TABLE student ADD COLUMN {col} {type_def}'))
                    conn.commit()

# Initialize Database
with app.app_context():
    db.create_all()
    check_and_migrate_db()

# Authentication Routes
@app.route('/login')
def login_page():
    if 'user_type' in session:
        if session['user_type'] == 'admin':
            return redirect(url_for('admin'))
        else:
            return redirect(url_for('student'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login_api():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    
    # 1. Check Admin
    if email == 'admin123@gmail.com' and password == 'Admin1':
        session['user_type'] = 'admin'
        session['user'] = 'Admin'
        return jsonify({'status': 'success', 'redirect': '/admin'})
        
    # 2. Check Student
    # Expected format: name.rollno@gmail.com
    if email.endswith('@gmail.com'):
        try:
            local_part = email.split('@')[0] # john.101
            parts = local_part.rsplit('.', 1) # ['john', '101']
            
            if len(parts) == 2:
                name_part = parts[0]
                roll_part = parts[1]
                
                # Check directly from DB
                student = Student.query.filter_by(roll_no=roll_part).first()
                
                if student:
                    # Check Name match (case-insensitive)
                    stored_name = student.name.strip().lower()
                    if stored_name == name_part:
                        # Check Password (must be student name as per Requirement)
                        if password.lower() == name_part or password.lower() == stored_name:
                            session['user_type'] = 'student'
                            session['user_id'] = student.id
                            session['user_name'] = student.name
                            session['user_roll'] = student.roll_no
                            return jsonify({'status': 'success', 'redirect': '/student'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': 'Error parsing credentials'})
            
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
    return render_template('admin.html')

@app.route('/student')
def student():
    user_type = session.get('user_type')
    user_id = session.get('user_id')
    
    if user_type != 'student':
        if user_type == 'admin':
             return render_template('student.html', user_type=user_type, user_id=user_id)
        return redirect(url_for('login_page'))
    return render_template('student.html', user_type=user_type, user_id=user_id)

@app.route('/api/students', methods=['GET', 'POST'])
def manage_students():
    if request.method == 'GET':
        if session.get('user_type') == 'student':
            # RESTRICTED: Only return own data
            student_id = session.get('user_id')
            if student_id:
                student = Student.query.get(student_id)
                return jsonify([student.to_dict()] if student else [])
            return jsonify([]) # Should not happen if logged in
            
        students = Student.query.all()
        return jsonify([s.to_dict() for s in students])
    elif request.method == 'POST':
        data = request.get_json()
        
        # Validate Roll No
        roll_no = data.get('roll_no', '').strip()
        if not roll_no:
            return jsonify({'status': 'error', 'message': 'Roll Number is required'})
            
        # Check for duplicate Roll No
        if Student.query.filter_by(roll_no=roll_no).first():
            return jsonify({'status': 'error', 'message': 'Roll Number already exists'})

        # Calculate scores
        try:
            # Subject Marks
            tamil = float(data.get('tamil', 0))
            english = float(data.get('english', 0))
            maths = float(data.get('maths', 0))
            science = float(data.get('science', 0))
            social = float(data.get('social_science', 0))

            # Average Test Score
            test_score = round((tamil + english + maths + science + social) / 5, 2)
            
            attendance = float(data.get('attendance', 0))
            assignment = float(data.get('assignment', 0))
            
            stability_score = round((test_score + attendance + assignment) / 3, 2)
            
            if stability_score >= 80:
                category = "High Stability (Advanced Learner)"
            elif stability_score >= 50:
                category = "Moderate Stability (Average Learner)"
            else:
                category = "Low Stability (Needs Improvement)"
                
            new_student = Student(
                name=data.get('name', ''),
                roll_no=roll_no,
                email=data.get('email', ''),
                tamil=tamil,
                english=english,
                maths=maths,
                science=science,
                social_science=social,
                test_score=test_score,
                attendance=attendance,
                assignment=assignment,
                stability_score=stability_score,
                category=category,
                previous_stability_score=stability_score,
                trend_category="New",
                trend_diff=0,
                recommendation="Welcome! Maintain a consistent study schedule."
            )

            db.session.add(new_student)
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Student added successfully'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/students/<int:student_id>', methods=['PUT', 'DELETE'])
def update_delete_student(student_id):
    student = Student.query.get(student_id)
    
    if not student:
        return jsonify({'status': 'error', 'message': 'Student not found'}), 404
        
    if request.method == 'DELETE':
        try:
            db.session.delete(student)
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Student deleted successfully'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)})
        
    elif request.method == 'PUT':
        update_data = request.get_json()
        
        # Check for duplicate Roll No if key is present and changed
        if 'roll_no' in update_data:
            new_roll = update_data['roll_no'].strip()
            if new_roll and new_roll.lower() != student.roll_no.lower():
                existing = Student.query.filter_by(roll_no=new_roll).first()
                if existing and existing.id != student_id:
                     return jsonify({'status': 'error', 'message': 'Roll Number already exists'})
                student.roll_no = new_roll

        # Update other basic fields
        if 'name' in update_data: student.name = update_data['name']
        if 'email' in update_data: student.email = update_data['email']

        # Capture previous score before update
        previous_score = student.stability_score
        
        # --- NEW: Capture other previous metrics ---
        student.prev_test_score = student.test_score
        student.prev_attendance = student.attendance
        student.prev_assignment = student.assignment

        # Recalculate scores if needed
        try:
            # Get values from update_data or fall back to current student values
            tamil = float(update_data.get('tamil', student.tamil))
            english = float(update_data.get('english', student.english))
            maths = float(update_data.get('maths', student.maths))
            science = float(update_data.get('science', student.science))
            social = float(update_data.get('social_science', student.social_science))

            # Recalculate Test Score Average
            test_score = round((tamil + english + maths + science + social) / 5, 2)
            
            attendance = float(update_data.get('attendance', student.attendance))
            assignment = float(update_data.get('assignment', student.assignment))
            
            # Update the fields in object
            student.tamil = tamil
            student.english = english
            student.maths = maths
            student.science = science
            student.social_science = social
            student.test_score = test_score
            student.attendance = attendance
            student.assignment = assignment

            new_stability_score = round((test_score + attendance + assignment) / 3, 2)
            
            if new_stability_score >= 80:
                category = "High Stability (Advanced Learner)"
            elif new_stability_score >= 50:
                category = "Moderate Stability (Average Learner)"
            else:
                category = "Low Stability (Needs Improvement)"
                
            student.stability_score = new_stability_score
            student.category = category
            
            # Trend Analysis
            diff = new_stability_score - previous_score
            diff_percent = round((diff / previous_score) * 100, 2) if previous_score > 0 else 0
            
            trend_category = "No Change"
            recommendation = "Consistent performance."

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
            else:
                trend_category = "Significant Decline"
                recommendation = "Attention needed. Please seek remedial support."
            
            student.previous_stability_score = previous_score
            student.trend_category = trend_category
            student.trend_diff = diff_percent
            student.recommendation = recommendation
            
            db.session.commit()
            return jsonify({'status': 'success', 'message': 'Student updated successfully'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
