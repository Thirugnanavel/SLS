import sqlite3
import pymongo
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.path.join(BASE_DIR, 'instance', 'students.db')
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'student_learning_system')

def migrate():
    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    # Connect to MongoDB
    mongo_client = pymongo.MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB_NAME]

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
