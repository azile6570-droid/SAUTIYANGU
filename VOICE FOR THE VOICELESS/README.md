# Voice for the Voiceless

Voice for the Voiceless is a school project prototype designed to make urgent communication easier for people who may struggle to speak clearly in stressful situations.

## Project overview

This project includes:
- a static frontend prototype for English and Kiswahili communication
- a Node.js backend using Express for authentication and API routes
- demo messaging and prototype privacy notices for presentation purposes

## Project structure

```text
VOICE FOR THE VOICELESS/
├── BACKEND/
│   ├── .env.example
│   ├── database.js
│   ├── package.json
│   ├── server.js
│   └── ...
├── FRONTEND/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── ...
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- A modern browser with speech synthesis support

## Backend setup

1. Open the backend folder:
   ```bash
   cd "VOICE FOR THE VOICELESS/BACKEND"
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Update the values in `.env` if needed, especially `JWT_SECRET`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the backend:
   ```bash
   npm run dev
   ```

The backend should run on `http://localhost:3000` by default.

## Frontend setup

You can open the HTML file directly in a browser, or run a local static server in the frontend folder:

```bash
cd "VOICE FOR THE VOICELESS/FRONTEND"
python -m http.server 8000
```

Then open:
```text
http://localhost:8000
```

## Important note

This is a prototype interface for a school project. It demonstrates the user experience, account flow, message storage, and speech features. Demo messages are stored as readable text and are not end-to-end encrypted; do not use real personal or sensitive information. A production deployment would need encryption and key management, stronger account protections, deployment over HTTPS, and a full media signaling layer for live calls.

## Submission guidance

Before submission, confirm that:
- the frontend loads without console errors
- speech playback works in your browser
- the backend starts successfully with the `.env` file
- the project is clearly presented as a prototype
