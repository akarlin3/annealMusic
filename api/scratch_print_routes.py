import sys
import os

# Add the current directory to python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import create_app

app = create_app()

print("REGISTERED ROUTES:")
for route in app.routes:
    methods = getattr(route, "methods", "WS")
    print(f"{methods} {route.path}")
