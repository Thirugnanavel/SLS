import os
from backend.app import app

if __name__ == '__main__':
    debug_mode = str(os.getenv('FLASK_DEBUG', 'false')).strip().lower() in ['1', 'true', 'yes', 'on']
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', '5001'))
    app.run(debug=debug_mode, host=host, port=port)
