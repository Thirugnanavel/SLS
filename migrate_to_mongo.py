import os
import sqlite3
import pymongo

def migrate():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect('instance/students.db')
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    # Connect to MongoDB (match app.py: MONGO_URI / MONGO_DB_NAME)
    mongo_client = pymongo.MongoClient(os.environ.get('MONGO_URI', 'mongodb://127.0.0.1:27017/'))
    db = mongo_client[os.environ.get('MONGO_DB_NAME', 'student_learning_system')]

    # Clear existing collections
    db.student.drop()
    db.assignment.drop()
    db.assignment_submission.drop()
    db.feedback.drop()

    # Migrate Student
    cursor.execute("SELECT * FROM student")
    students = cursor.fetchall()
    if students:
        db.student.insert_many([dict(s) for s in students])
        print(f"Migrated {len(students)} students.")

    # Migrate Assignment
    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assignment'")
    if cursor.fetchone():
        cursor.execute("SELECT * FROM assignment")
        assignments = cursor.fetchall()
        if assignments:
            db.assignment.insert_many([dict(a) for a in assignments])
            print(f"Migrated {len(assignments)} assignments.")

    # Migrate AssignmentSubmission
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assignment_submission'")
    if cursor.fetchone():
        cursor.execute("SELECT * FROM assignment_submission")
        submissions = cursor.fetchall()
        if submissions:
            db.assignment_submission.insert_many([dict(s) for s in submissions])
            print(f"Migrated {len(submissions)} assignment submissions.")

    # Migrate Feedback
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
    if cursor.fetchone():
        cursor.execute("SELECT * FROM feedback")
        feedbacks = cursor.fetchall()
        if feedbacks:
            db.feedback.insert_many([dict(f) for f in feedbacks])
            print(f"Migrated {len(feedbacks)} feedbacks.")

    sqlite_conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
