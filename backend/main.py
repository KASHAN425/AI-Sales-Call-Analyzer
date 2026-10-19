import os
import sys

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"[Railway] Starting FastAPI backend on 0.0.0.0:{port}...")
    uvicorn.run("app:app", host="0.0.0.0", port=port)
