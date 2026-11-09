import { useState } from "react";
import WorkerForm from "./WorkerForm.jsx";

export default function PublicRegister() {
  const [done, setDone] = useState(null);
  const [key, setKey] = useState(0);

  if (done) {
    return (
      <main className="page">
        <div className="success">
          <div className="tick">✓</div>
          <h1>रजिस्ट्रेशन हो गया!</h1>
          <p>Registration successful{done.name ? `, ${done.name}` : ""}.</p>
          <p className="muted">काम मिलने पर हम आपको फोन करेंगे। / We will call you when work is available.</p>
          <button className="btn secondary" onClick={() => { setDone(null); setKey(key + 1); }}>
            दूसरा रजिस्ट्रेशन / Register another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="head">
        <h1>👷 मजदूर रजिस्ट्रेशन</h1>
        <p className="muted">Worker Registration — 1 मिनट में फॉर्म भरें</p>
      </header>
      <WorkerForm key={key} mode="public" onSaved={setDone} />
    </main>
  );
}
