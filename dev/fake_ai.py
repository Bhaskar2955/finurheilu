"""Run the worker locally with the free demo writer (no AI key, no cost).

    cd worker && DATABASE_URL=... WORKER_TOKEN=dev python ../dev/fake_ai.py

Same as running the worker with AI_PROVIDER=demo. The first draft has a
deliberate shot-count mistake so you can try the fact check."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "worker"))
os.environ["AI_PROVIDER"] = "demo"

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
