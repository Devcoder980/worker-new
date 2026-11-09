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
          <p className="saved-name">{done.name}</p>
          <p>Registration successful</p>
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
      <header className="hero">
        <div className="hero-icon">👷</div>
        <div>
          <h1>काम के लिए रजिस्टर करें</h1>
          <p>Register for work · 1 मिनट</p>
        </div>
      </header>
      <WorkerForm key={key} mode="public" onSaved={setDone} />
    </main>
  );
}
