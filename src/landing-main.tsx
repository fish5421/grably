import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const Landing: React.FC = () => (
  <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-sky-100 via-white to-blue-100 text-slate-800">
    <img src="/icon.png" alt="Grably" className="w-20 h-20" />
    <h1 className="text-4xl font-black tracking-tight text-slate-900">Welcome to Grably</h1>
    <p className="max-w-xl text-center text-lg text-slate-600">
      Grably lets you download videos, extract audio, and transcribe media with Whisper AI directly on your Mac.
      Launch the desktop app to start grabbing from over 1,000 platforms in seconds.
    </p>
    <a
      className="px-6 py-3 rounded-full bg-slate-900 text-white font-semibold shadow-lg hover:bg-slate-800 transition"
      href="https://grably.space"
      target="_blank"
      rel="noreferrer"
    >
      Visit grably.space
    </a>
  </main>
);

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <Landing />
    </React.StrictMode>
  );
}
