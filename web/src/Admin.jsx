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

  useEffect(() => window.scrollTo(0, 0), [view.name, view.key]);

  if (authed === null) return <main className="page"><p className="muted center"><span className="spinner dark" /> Loading…</p></main>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  const toList = () => setView({ name: "list" });
  const onAuthError = (e) => { if (e.status === 401) setAuthed(false); };

  if (view.name === "add")
    return (
      <Screen title="नया वर्कर" sub="Add worker" onBack={toList}>
        <WorkerForm key={view.key} mode="add" onSaved={(w) => setView({ name: "added", worker: w })} />
      </Screen>
    );

  if (view.name === "added")
    return (
      <main className="page">
        <div className="success">
          <div className="tick">✓</div>
          <h1>सेव हो गया</h1>
          <p className="saved-name">{view.worker.name}<br /><span className="muted">{view.worker.mobile}</span></p>
          <button className="btn primary big" onClick={() => setView({ name: "add", key: Date.now() })}>
            ➕ अगला वर्कर जोड़ें
            <small>Add another worker</small>
          </button>
          <button className="btn secondary" onClick={toList}>लिस्ट देखें / View list</button>
        </div>
      </main>
    );

  if (view.name === "edit") {
    const w = view.worker;
    const remove = async () => {
      if (!confirm(`${w.name} (${w.mobile}) को हटाना है?\nDelete this worker?`)) return;
      try {
        await api(`/api/admin/workers/${w.id}`, { method: "DELETE" });
        toList();
      } catch (e) {
        onAuthError(e);
        alert(e.message);
      }
    };
    return (
      <Screen title="एडिट करें" sub={w.name} onBack={toList}>
        <WorkerForm mode="edit" worker={w} onSaved={toList} onDelete={remove} />
      </Screen>
    );
  }

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

function Screen({ title, sub, onBack, children }) {
  return (
    <main className="page">
      <header className="screen-head">
        <button className="back" onClick={onBack} aria-label="Back">←</button>
        <div>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
      </header>
      {children}
    </main>
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
      <div className="login-mark">👷</div>
      <h1 className="center-text">एडमिन लॉगिन</h1>
      <p className="muted center-text">Admin login</p>
      <form className="form" onSubmit={submit}>
        <input type="text" name="username" value="admin" autoComplete="username" readOnly hidden />
        <div className="field">
          <label htmlFor="pw">पासवर्ड <small>Password</small></label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !password}>
          {busy ? <span className="spinner" /> : "लॉगिन करें / Login"}
        </button>
      </form>
    </main>
  );
}

function Dashboard({ onAdd, onEdit, onQr, onLogout, onAuthError }) {
  const [stats, setStats] = useState(null);
  const [workers, setWorkers] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, category });
      const [s, list] = await Promise.all([api("/api/admin/stats"), api(`/api/admin/workers?${q}`)]);
      setStats(s);
      setWorkers(list);
      setError("");
    } catch (e) {
      onAuthError(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, category]);

  const filtered = search || category;

  return (
    <main className="page wide has-fab">
      <header className="topbar">
        <div>
          <h1>👷 वर्कर्स</h1>
          <p className="muted">
            कुल <b>{stats?.total ?? "–"}</b> · आज <b>{stats?.today ?? "–"}</b>
          </p>
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={onQr}><span>▦</span>QR</button>
          <a className="icon-btn" href="/api/admin/export.csv"><span>⬇</span>CSV</a>
          <button className="icon-btn" onClick={onLogout}><span>⏻</span>Logout</button>
        </div>
      </header>

      <div className="sticky-search">
        <div className="search">
          <span aria-hidden>🔍</span>
          <input type="search" placeholder="नाम या मोबाइल खोजें" value={search} onChange={(e) => setSearch(e.target.value)} enterKeyHint="search" />
          {loading && <span className="spinner dark small" />}
        </div>
        <div className="chips" role="tablist">
          <button className={!category ? "chip on" : "chip"} onClick={() => setCategory("")}>सभी</button>
          {CATEGORIES.map(([v, hi, icon]) => (
            <button key={v} className={category === v ? "chip on" : "chip"} onClick={() => setCategory(category === v ? "" : v)}>
              {icon} {hi}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {filtered && workers && <p className="muted result-count">{workers.length} मिले / found</p>}

      {workers === null ? (
        <ul className="cards">{[0, 1, 2].map((i) => <li key={i} className="card skeleton" />)}</ul>
      ) : workers.length === 0 ? (
        <div className="empty-state">
          <div>📋</div>
          {filtered ? <p>कोई वर्कर नहीं मिला<br /><small>No workers found</small></p> : <p>अभी कोई वर्कर नहीं है<br /><small>Tap “Add worker” below or share the QR code</small></p>}
        </div>
      ) : (
        <ul className="cards">
          {workers.map((w) => (
            <li key={w.id} className="card">
              <button className="card-main" onClick={() => onEdit(w)}>
                {w.photo_path ? (
                  <img src={`/api/admin/photos/${w.photo_path}`} alt="" loading="lazy" />
                ) : (
                  <div className="noimg">{w.name.trim()[0]?.toUpperCase()}</div>
                )}
                <div className="info">
                  <strong>{w.name}</strong>
                  <span className="sub">{w.mobile}{w.area ? ` · 📍 ${w.area}` : ""}</span>
                  <span className="tag">{categoryLabel(w.work_category)}</span>
                  {w.work_description && <span className="desc">{w.work_description}</span>}
                </div>
              </button>
              <a className="call" href={`tel:+91${w.mobile}`} aria-label={`Call ${w.name}`}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#fff" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>
              </a>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={onAdd}>➕ वर्कर जोड़ें <small>Add</small></button>
    </main>
  );
}

function QrView({ onBack }) {
  const canvas = useRef(null);
  const url = window.location.origin + "/";

  useEffect(() => {
    QRCode.toCanvas(canvas.current, url, { width: 280, margin: 2 });
  }, [url]);

  async function download() {
    const png = await QRCode.toDataURL(url, { width: 1024, margin: 3 });
    const a = document.createElement("a");
    a.href = png;
    a.download = "worker-registration-qr.png";
    a.click();
  }

  return (
    <Screen title="QR कोड" sub="Workers scan this to register" onBack={onBack}>
      <div className="qr">
        <canvas ref={canvas} />
        <p className="qr-text">स्कैन करें और रजिस्टर करें</p>
        <code>{url}</code>
      </div>
      <button className="btn primary full" onClick={download}>⬇ QR डाउनलोड करें / Download</button>
    </Screen>
  );
}
