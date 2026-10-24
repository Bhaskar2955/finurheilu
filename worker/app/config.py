"""Settings, all read from environment variables (see worker/.env.example)."""
import os
import tempfile


def _load_env_file() -> None:
    """Read worker/.env (KEY=value lines) so you don't have to set variables by hand.
    Real environment variables win over the file."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# Writer = summaries, podcast scripts, rewrites. Fast = small checks.
MODEL_WRITER = os.environ.get("CLAUDE_MODEL_WRITER", "claude-sonnet-5-5")
MODEL_FAST = os.environ.get("CLAUDE_MODEL_FAST", "claude-haiku-5-5")

# Which AI writes: "claude", "gemini" (free tier) or "demo" (no AI, no key).
# Empty = use whichever key is set, else demo.
AI_PROVIDER = os.environ.get("AI_PROVIDER", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Shared secret between the Next.js server and this worker.
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")

# Supabase Storage for audio/video. If unset, files are kept on local disk
# and served by this worker under /media (handy for local development).
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "media")
MEDIA_DIR = os.environ.get("MEDIA_DIR", os.path.join(tempfile.gettempdir(), "finurheilu-media"))
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")

# Azure AI Speech for human-sounding voices. Optional.
AZURE_SPEECH_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.environ.get("AZURE_SPEECH_REGION", "northeurope")

_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",          # Linux / Docker
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",             # macOS
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",                                  # Windows
    "C:/Windows/Fonts/segoeuib.ttf",
]
FONT_FILE = os.environ.get("FONT_FILE") or next((f for f in _FONTS if os.path.exists(f)), _FONTS[0])
