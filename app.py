"""
AI Smart Assistant — Flask Backend
Serves the frontend and proxies chat requests to the Google Gemini API.
"""

import os
import logging
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")

# Safety limits
MAX_INPUT_LENGTH = 4000          # max characters per user message
MAX_HISTORY_MESSAGES = 20        # max conversation turns sent to the API

# System prompt — sent with every API call
SYSTEM_PROMPT = (
    "You are AI Smart Assistant, a helpful, accurate, and friendly AI. "
    "Answer questions clearly and concisely. When providing code, use "
    "Markdown code blocks with the language specified. Be honest when "
    "you are unsure about something."
)

# ---------------------------------------------------------------------------
# Logging (never log secrets or full conversations)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)

# ---------------------------------------------------------------------------
# Lazy Gemini client initialisation
# ---------------------------------------------------------------------------
_gemini_client = None


def get_gemini_client():
    """Return a cached Gemini client, or None if the key is missing."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client

    if not GEMINI_API_KEY:
        log.warning("GEMINI_API_KEY is not set — AI features are disabled.")
        return None

    try:
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        log.info("Gemini client initialised (model=%s).", GEMINI_MODEL)
        return _gemini_client
    except Exception as exc:
        log.error("Failed to create Gemini client: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Serve the single-page frontend."""
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health():
    """Report service status without revealing the API key."""
    api_configured = bool(GEMINI_API_KEY)
    return jsonify({
        "status": "ok",
        "api_configured": api_configured,
        "model": GEMINI_MODEL if api_configured else None,
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    """Accept a conversation and return the assistant's reply."""

    # --- validate content type ---
    if not request.is_json:
        return jsonify({"error": "Request must be JSON."}), 400

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Invalid JSON body."}), 400

    # --- validate messages list ---
    messages = body.get("messages")
    if not isinstance(messages, list) or len(messages) == 0:
        return jsonify({"error": "A non-empty 'messages' array is required."}), 400

    # --- validate each message ---
    cleaned: list[dict] = []
    for msg in messages[-MAX_HISTORY_MESSAGES:]:
        role = msg.get("role")
        content = msg.get("content", "")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        # Gemini uses "model" instead of "assistant" for the AI role
        cleaned.append({
            "role": "model" if role == "assistant" else "user",
            "parts": [{"text": content.strip()[:MAX_INPUT_LENGTH]}],
        })

    if not cleaned or cleaned[-1]["role"] != "user":
        return jsonify({"error": "The last message must be a non-empty user message."}), 400

    # --- check API key ---
    client = get_gemini_client()
    if client is None:
        return jsonify({
            "error": "The Gemini API key is not configured. "
                     "Please set GEMINI_API_KEY in your .env file."
        }), 503

    # --- call Gemini ---
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=cleaned,
            config={
                "system_instruction": SYSTEM_PROMPT,
            },
        )
        reply = response.text
        log.info("Gemini responded (%d chars).", len(reply))
        return jsonify({"reply": reply})

    except Exception as exc:
        error_str = str(exc).lower()

        # Check for temporary unavailability / model not found and try fallback
        if ("503" in error_str or "unavailable" in error_str or "not_found" in error_str or "404" in error_str) and GEMINI_MODEL != "gemini-3.5-flash-lite":
            try:
                log.warning("Primary model %s unavailable, falling back to gemini-3.5-flash-lite...", GEMINI_MODEL)
                fallback_resp = client.models.generate_content(
                    model="gemini-3.5-flash-lite",
                    contents=cleaned,
                    config={"system_instruction": SYSTEM_PROMPT},
                )
                reply = fallback_resp.text
                log.info("Gemini fallback responded (%d chars).", len(reply))
                return jsonify({"reply": reply})
            except Exception as fb_exc:
                log.error("Fallback also failed: %s", fb_exc)

        # Rate limit
        if "rate" in error_str or "429" in error_str or "quota" in error_str:
            log.warning("Gemini rate limit hit.")
            return jsonify({"error": "Rate limit reached. Please wait a moment and try again."}), 429

        # Auth
        if "auth" in error_str or "401" in error_str or "403" in error_str or "api key" in error_str:
            log.error("Gemini authentication error.")
            return jsonify({"error": "Invalid API key. Check your GEMINI_API_KEY."}), 401

        # Generic
        log.error("Gemini API error: %s", exc)
        return jsonify({"error": "The AI service encountered an error. Please try again."}), 502


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=FLASK_DEBUG)
