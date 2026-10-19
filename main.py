import os
import sys

# Ensure backend directory is in python search path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if os.path.exists(backend_dir) and backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"[Railway Root] Starting FastAPI backend on 0.0.0.0:{port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port)
