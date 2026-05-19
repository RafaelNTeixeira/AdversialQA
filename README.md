# ⚖️ The Examination Chamber
### Adversarial Q&A Simulator - Thesis Defense & Technical Interview

A full-stack application that acts as a merciless AI examiner. Feed it your thesis PDF or your CV and it will interrogate you like a 30-year veteran committee member or a Staff Engineer who has already decided to reject you.

---

## Features

- **Two distinct examination modes**
  - 🎓 **Thesis Defense** - attacks methodology, statistical validity, overgeneralization, missing literature, and theoretical framework choices
  - 💻 **Tech Interview** - demands justification for every tech choice, probes edge cases, scalability limits, security holes, and CV vagueness

- **Two languages**
  - 🇬🇧 English - deep authoritative voice via TTS
  - 🇵🇹 Portuguese - PT-PT locale for both TTS and speech recognition

- **Voice-first interface** (Web Speech API - no backend audio processing needed)
  - 🔊 **Text-to-Speech**: questions are read aloud by the examiner in the correct language
  - 🎤 **Speech-to-Text**: defend yourself verbally; transcript appears in real time
  - Text input always available as fallback

- **Escalating pressure** - questions get harder after question 3, targeting the single most vulnerable point in your document

- **Post-session report** with score /10, verdict, strengths, critical gaps, and study priorities - all in the language you chose

---

## Project Structure

```
adversarial-qa/
├── backend/
│   ├── main.py           # FastAPI app - upload, session, answer, end endpoints
│   ├── requirements.txt  # Python dependencies
│   └── .env.example      # Copy to .env and add your API key
├── frontend/
│   ├── index.html        # HTML shell with Google Fonts
│   ├── vite.config.js    # Dev server + proxy to :8000
│   ├── package.json
│   └── src/
│       ├── main.jsx      # React entry point
│       ├── App.jsx       # All UI: upload → ready → session → assessment
│       └── index.css     # Global styles, CSS variables, animations
└── .gitignore
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/api-keys)

### Manual setup (any OS)

```bash
# Terminal 1 - Backend
cd backend
cp .env.example .env          # then add your GEMINI_API_KEY to .env
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload PDF/TXT. Returns `session_id`. |
| `POST` | `/session/{id}/start` | Start exam with `{ mode, language }`. Returns first question. |
| `POST` | `/session/{id}/answer` | Submit answer text. Returns `{ feedback, question }`. |
| `POST` | `/session/{id}/end` | End session. Returns full performance assessment. |
| `GET`  | `/health` | Health check. |

### Mode values
- `thesis_defense`
- `technical_interview`

### Language values
- `en` - English (TTS: `en-GB`, STT: `en-US`)
- `pt` - Portuguese (TTS: `pt-PT`, STT: `pt-PT`)

---

## Browser Compatibility

Web Speech API is supported in:
- ✅ Chrome / Chromium (best support)
- ✅ Edge
- ⚠️ Safari (TTS yes, STT limited)
- ❌ Firefox (STT not supported - text input still works)

---

## Customisation Tips

**Add more languages**: Add entries to `T` in `App.jsx`, add locale codes to `useTTS`/`useSTT`, and add `RULES`/`FOCUS`/`PERSONAS`/`ASSESSMENT_PROMPTS` entries in `backend/main.py`.

**Change the examiner's voice**: Modify the voice selection logic in `useTTS()` - list available voices with `window.speechSynthesis.getVoices()` in the browser console.

**Adjust question count before escalation**: Change the `question_number >= 3` threshold in `build_system_prompt()` in `main.py`.

**Persist sessions**: Replace the in-memory `sessions` dict in `main.py` with Redis or a database for multi-user / persistent deployments.

---

## License

MIT
