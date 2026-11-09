import { useEffect, useRef, useState } from "react";
import { CATEGORIES, api, shrinkPhoto } from "./api.js";

const empty = { name: "", mobile: "", work_category: "", work_description: "", area: "", consent: false };

// One form used for public QR sign-up, admin add, and admin edit.
// mode: "public" | "add" | "edit"
export default function WorkerForm({ mode, worker, onSaved, onCancel }) {
  const [f, setF] = useState(
    worker
      ? { ...empty, ...worker, work_description: worker.work_description || "", area: worker.area || "", consent: true }
      : empty
  );
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(
    worker?.photo_path ? `/api/admin/photos/${worker.photo_path}` : null
  );
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (mode !== "public") nameRef.current?.focus();
  }, [mode]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose a photo / कृपया फोटो चुनें");
    const small = await shrinkPhoto(file);
    setPhoto(small);
    setRemovePhoto(false);
    setPreview(URL.createObjectURL(small));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const mobile = f.mobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("सही 10 अंकों का मोबाइल नंबर डालें / Enter a valid 10-digit mobile number");
    if (!f.work_category) return setError("काम का प्रकार चुनें / Choose work category");
    if (!f.consent) return setError("सहमति पर टिक करें / Please tick the consent box");

    const body = new FormData();
    body.set("name", f.name);
    body.set("mobile", mobile);
    body.set("work_category", f.work_category);
    body.set("work_description", f.work_description);
    body.set("area", f.area);
    body.set("consent", String(f.consent));
    if (photo) body.set("photo", photo);
    if (removePhoto) body.set("remove_photo", "true");

    const url = mode === "public" ? "/api/register" : mode === "add" ? "/api/admin/workers" : `/api/admin/workers/${worker.id}`;
    setBusy(true);
    try {
      const saved = await api(url, { method: mode === "edit" ? "PUT" : "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label>
        <span>पूरा नाम / Full Name *</span>
        <input ref={nameRef} value={f.name} onChange={set("name")} required maxLength={80} autoComplete="name" placeholder="जैसे: रमेश कुमार" />
      </label>

      <label>
        <span>मोबाइल नंबर / Mobile Number *</span>
        <input
          value={f.mobile}
          onChange={set("mobile")}
          required
          inputMode="numeric"
          type="tel"
          maxLength={14}
          autoComplete="tel"
          placeholder="10 अंक / 10 digits"
        />
      </label>

      <div className="field">
        <span>फोटो / Photo</span>
        <div className="photo-row">
          {preview && !removePhoto ? (
            <img className="photo-preview" src={preview} alt="Worker" />
          ) : (
            <div className="photo-preview empty">👤</div>
          )}
          <div className="photo-buttons">
            <label className="btn secondary">
              📷 कैमरा / Camera
              <input type="file" accept="image/*" capture={mode === "public" ? "user" : "environment"} onChange={pickPhoto} hidden />
            </label>
            <label className="btn secondary">
              🖼️ गैलरी / Gallery
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} hidden />
            </label>
            {mode === "edit" && preview && !removePhoto && (
              <button type="button" className="link danger" onClick={() => { setRemovePhoto(true); setPhoto(null); }}>
                फोटो हटाएँ / Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <label>
        <span>काम का प्रकार / Work Category *</span>
        <select value={f.work_category} onChange={set("work_category")} required>
          <option value="">— चुनें / Select —</option>
          {CATEGORIES.map(([v, hi]) => (
            <option key={v} value={v}>
              {hi} / {v}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>क्या काम आता है / Work Description</span>
        <textarea value={f.work_description} onChange={set("work_description")} maxLength={500} rows={2} placeholder="जैसे: टाइल्स, प्लास्टर, वायरिंग…" />
      </label>

      <label>
        <span>इलाका / Area</span>
        <input value={f.area} onChange={set("area")} maxLength={100} placeholder="जैसे: नरोल, वटवा…" />
      </label>

      {mode !== "edit" && (
        <label className="consent">
          <input type="checkbox" checked={f.consent} onChange={set("consent")} />
          <span>
            मैं सहमत हूँ कि मेरी जानकारी सेव की जाए और काम के लिए मुझसे संपर्क किया जाए।
            <small>I agree to store my details and be contacted for work.</small>
          </span>
        </label>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="actions">
        {onCancel && (
          <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>
            रद्द / Cancel
          </button>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? "सेव हो रहा है… / Saving…" : mode === "edit" ? "सेव करें / Save" : "रजिस्टर करें / Register"}
        </button>
      </div>
    </form>
  );
}
