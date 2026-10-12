# AI Smart Assistant

An AI-powered web application that lets users ask questions and receive intelligent responses using the **Google Gemini API**. Built for academic demonstration — functional, visually polished, and easy to run locally.

---

## Features

- 💬 **Real-time AI chat** powered by Google Gemini
- 🎨 **Clean, modern UI** with responsive design (desktop + mobile)
- 🗂️ **Multiple conversations** within a single session
- ✨ **Suggestion cards** to get started quickly
- 📝 **Markdown rendering** — code blocks, bold, italic, lists, headings
- 🔄 **Retry on failure** with clear error messages
- 🔒 **Secure** — API key is never exposed to the browser
- ⚡ **Lightweight** — no databases, no complex frameworks

---

## Technology Stack

| Layer           | Technology                        |
| --------------- | --------------------------------- |
| Frontend        | HTML5, CSS3, Vanilla JS           |
| Backend         | Python 3 + Flask                  |
| AI Integration  | Google Gemini (google-genai SDK)  |
| Configuration   | python-dotenv                     |

---

## Project Structure

```
AI_Assistant/
├── app.py               # Flask backend (API + serves frontend)
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variable template
├── .env                  # Your local config (git-ignored)
├── .gitignore
├── README.md
├── templates/
│   └── index.html        # Main HTML page
└── static/
    ├── css/
    │   └── style.css     # Stylesheet
    └── js/
        └── app.js        # Frontend logic
```

---

## Setup Instructions (Windows)

### 1. Prerequisites

- **Python 3.10+** installed and available in PATH
- A **Google Gemini API key** — get one at <https://aistudio.google.com/>

### 2. Create a virtual environment

Open a terminal in the project folder and run:

```bash
python -m venv venv
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure your API key

Copy the example file and add your key:

```bash
copy .env.example .env
```

Then edit `.env` and replace the placeholder:

```
GEMINI_API_KEY=your_actual_api_key_here
GEMINI_MODEL=gemini-3.8-flash
FLASK_DEBUG=false
```

> **Tip:** You can change `GEMINI_MODEL` to any model available on your Google AI account (e.g. `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-flash-latest`).

### 5. Run the application

```bash
python app.py
```

### 6. Open in your browser

Navigate to: **<http://127.0.0.1:5000>**

---

## How It Works

```
┌──────────────┐       HTTP/JSON       ┌──────────────┐    google-genai      ┌──────────────┐
│   Browser    │ ◄──────────────────► │  Flask API   │ ◄──────────────────► │  Google      │
│  (HTML/JS)   │   POST /api/chat     │  (app.py)    │ generate_content()  │  Gemini API  │
└──────────────┘                       └──────────────┘                     └──────────────┘
```

1. **User** types a message in the chat interface.
2. **Frontend (app.js)** sends the message history to `POST /api/chat` as JSON.
3. **Flask backend (app.py)** validates the request, adds a system instruction, and calls the Google Gemini API via the official google-genai Python SDK.
4. **Gemini** processes the conversation and returns a response.
5. **Flask** extracts the reply and sends it back as JSON (`{ "reply": "..." }`).
6. **Frontend** renders the response with Markdown formatting in the chat window.

---

## API Endpoints

| Method | Endpoint       | Description                         |
| ------ | -------------- | ----------------------------------- |
| GET    | `/api/health`  | Server status and API configuration |
| POST   | `/api/chat`    | Send a message and get an AI reply  |

### POST /api/chat — Request

```json
{
  "messages": [
    { "role": "user", "content": "Explain Python in simple terms." }
  ]
}
```

### POST /api/chat — Success Response

```json
{
  "reply": "Python is a programming language..."
}
```

---

## Troubleshooting

| Problem                         | Solution                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `ModuleNotFoundError`           | Run `pip install -r requirements.txt` inside the activated venv          |
| API key not configured warning  | Check that `.env` exists and contains a valid `GEMINI_API_KEY`           |
| `401/403 Unauthorized`          | Verify your API key is correct and active at aistudio.google.com         |
| `429 Rate Limit`                | Wait a moment and retry — you've hit Google's rate limit                 |
| Page won't load                 | Ensure `python app.py` is running and visit `http://127.0.0.1:5000`     |
| Port 5000 already in use        | Kill the other process or change the port in `app.py`                   |

---

## License

This project is created for academic purposes.
