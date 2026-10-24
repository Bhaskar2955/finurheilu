"""Settings, all read from environment variables (see worker/.env.example)."""
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# Writer = summaries, podcast scripts, rewrites. Fast = small checks.
MODEL_WRITER = os.environ.get("CLAUDE_MODEL_WRITER", "claude-sonnet-5-5")
MODEL_FAST = os.environ.get("CLAUDE_MODEL_FAST", "claude-haiku-5-5")

# Shared secret between the Next.js server and this worker.
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")

# Supabase Storage for audio/video. If unset, files are kept on local disk
# and served by this worker under /media (handy for local development).
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "media")
MEDIA_DIR = os.environ.get("MEDIA_DIR", "/tmp/finurheilu-media")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")

# Azure AI Speech for human-sounding voices. Optional.
AZURE_SPEECH_KEY = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.environ.get("AZURE_SPEECH_REGION", "northeurope")

FONT_FILE = os.environ.get("FONT_FILE", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
