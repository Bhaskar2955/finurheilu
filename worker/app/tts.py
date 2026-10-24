"""Podcast voices with Azure AI Speech (neural voices: one female, one male host).

If AZURE_SPEECH_KEY is not set we skip audio and the app reads the script with
the phone's own voice instead."""
from __future__ import annotations

from xml.sax.saxutils import escape

import httpx

from . import config

# Host A = female, host B = male. Calm, polite neural voices for each language.
VOICES = {
    "fi": {"A": "fi-FI-SelmaNeural", "B": "fi-FI-HarriNeural", "lang": "fi-FI"},
    "sv": {"A": "sv-SE-SofieNeural", "B": "sv-SE-MattiasNeural", "lang": "sv-SE"},
    "en": {"A": "en-GB-SoniaNeural", "B": "en-GB-RyanNeural", "lang": "en-GB"},
}


def enabled() -> bool:
    return bool(config.AZURE_SPEECH_KEY)


def ssml(lines: list[dict], language: str) -> str:
    v = VOICES[language]
    parts = [f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{v["lang"]}">']
    for ln in lines:
        voice = v["B"] if ln.get("host") == "B" else v["A"]
        parts.append(f'<voice name="{voice}"><prosody rate="-4%">{escape(ln["text"])}</prosody>'
                     f'<break time="350ms"/></voice>')
    parts.append("</speak>")
    return "".join(parts)


def synthesize(lines: list[dict], language: str) -> bytes:
    url = f"https://{config.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    r = httpx.post(url, content=ssml(lines, language).encode("utf-8"), timeout=120, headers={
        "Ocp-Apim-Subscription-Key": config.AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "finurheilu-worker",
    })
    r.raise_for_status()
    return r.content
