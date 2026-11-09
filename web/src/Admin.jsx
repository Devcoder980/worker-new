import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import WorkerForm from "./WorkerForm.jsx";
import { CATEGORIES, api, categoryLabel } from "./api.js";

export default function Admin() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [view, setView] = useState({ name: "list" }); // list | add | added | edit | qr

  useEffect(() => {
    api("/api/admin/stats").then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <main className="page"><p className="muted center">Loading…</p></main>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const toList = () => setView({ name: "list" });
  const onAuthError = (e) => { if (e.status === 401) setAuthed(false); };

  if (view.name === "add")
    return (
      <main className="page">
        <h1 className="title">नया वर्कर / Add Worker</h1>
        <WorkerForm key={view.key} mode="add" onSaved={(w) => setView({ name: "added", worker: w })} onCancel={toList} />
      </main>
    );

  if (view.name === "added")
    return (
      <main className="page">
        <div className="success">
          <div className="tick">✓</div>
          <h1>सेव हो गया / Saved</h1>
          <p>{view.worker.name} — {view.worker.mobile}</p>
          <button className="btn primary big" onClick={() => setView({ name: "add", key: Date.now() })}>
            ➕ अगला वर्कर / Add Another Worker
          </button>
          <button className="btn secondary" onClick={toList}>लिस्ट देखें / View list</button>
        </div>
      </main>
    );

  if (view.name === "edit")
    return (
      <main className="page">
        <h1 className="title">एडिट / Edit Worker</h1>
        <WorkerForm mode="edit" worker={view.worker} onSaved={toList} onCancel={toList} />
      </main>
    );

  if (view.name === "qr") return <QrView onBack={toList} />;

  return (
    <Dashboard
      onAdd={() => setView({ name: "add", key: Date.now() })}
      onEdit={(w) => setView({ name: "edit", worker: w })}
      onQr={() => setView({ name: "qr" })}
      onAuthError={onAuthError}
      onLogout={async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); setAuthed(false); }}
    />
  );
}

function Login({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1 className="title">🔒 Admin Login</h1>
      <form className="form" onSubmit={submit}>
        <label>
          <span>पासवर्ड / Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !password}>{busy ? "…" : "Login"}</button>
      </form>
    </main>
  );
}

function Dashboard({ onAdd, onEdit, onQr, onLogout, onAuthError }) {
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const [workers, setWorkers] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const q = new URLSearchParams({ search, category });
      const [s, list] = await Promise.all([api("/api/admin/stats"), api(`/api/admin/workers?${q}`)]);
      setStats(s);
      setWorkers(list);
      setError("");
    } catch (e) {
      onAuthError(e);
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, category]);

  async function remove(w) {
    if (!confirm(`Delete ${w.name} (${w.mobile})? / हटाएँ?`)) return;
    try {
      await api(`/api/admin/workers/${w.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <main className="page wide">
      <header className="topbar">
        <h1>👷 Workers</h1>
        <button className="link" onClick={onLogout}>Logout</button>
      </header>

      <div className="stats">
        <div><b>{stats.total}</b><span>कुल / Total</span></div>
        <div><b>{stats.today}</b><span>आज / Today</span></div>
      </div>

      <div className="toolbar">
        <button className="btn primary" onClick={onAdd}>➕ वर्कर जोड़ें / Add</button>
        <button className="btn secondary" onClick={onQr}>QR कोड</button>
        <a className="btn secondary" href="/api/admin/export.csv">⬇ CSV</a>
      </div>

      <div className="filters">
        <input type="search" placeholder="नाम या मोबाइल खोजें / Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">सभी काम / All</option>
          {CATEGORIES.map(([v, hi]) => <option key={v} value={v}>{hi}</option>)}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {workers === null ? (
        <p className="muted center">Loading…</p>
      ) : workers.length === 0 ? (
        <p className="muted center">कोई वर्कर नहीं मिला / No workers found</p>
      ) : (
        <ul className="cards">
          {workers.map((w) => (
            <li key={w.id} className="card">
              {w.photo_path ? (
                <img src={`/api/admin/photos/${w.photo_path}`} alt="" loading="lazy" />
              ) : (
                <div className="noimg">👤</div>
              )}
              <div className="info">
                <strong>{w.name}</strong>
                <a className="phone" href={`tel:+91${w.mobile}`}>📞 {w.mobile}</a>
                <span className="tag">{categoryLabel(w.work_category)}</span>
                {w.area && <span className="muted">📍 {w.area}</span>}
                {w.work_description && <span className="muted desc">{w.work_description}</span>}
              </div>
              <div className="card-actions">
                <button className="link" onClick={() => onEdit(w)}>Edit</button>
                <button className="link danger" onClick={() => remove(w)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function QrView({ onBack }) {
  const canvas = useRef(null);
  const url = window.location.origin + "/";

  useEffect(() => {
    QRCode.toCanvas(canvas.current, url, { width: 320, margin: 2 });
  }, [url]);

  async function download() {
    const png = await QRCode.toDataURL(url, { width: 1024, margin: 3 });
    const a = document.createElement("a");
    a.href = png;
    a.download = "worker-registration-qr.png";
    a.click();
  }

  return (
    <main className="page">
      <h1 className="title">QR कोड / Registration QR</h1>
      <div className="qr">
        <canvas ref={canvas} />
        <p>स्कैन करें और रजिस्टर करें<br /><small>Scan to register</small></p>
        <code>{url}</code>
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onBack}>← Back</button>
        <button className="btn primary" onClick={download}>⬇ Download PNG</button>
      </div>
    </main>
  );
}
