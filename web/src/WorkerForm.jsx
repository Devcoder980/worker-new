import { useEffect, useRef, useState } from "react";
import { CATEGORIES, api, shrinkPhoto } from "./api.js";
import CameraCapture from "./CameraCapture.jsx";

const empty = { name: "", mobile: "", work_category: "", work_description: "", area: "", consent: false };

// One form used for public QR sign-up, admin add, and admin edit.
// mode: "public" | "add" | "edit"
export default function WorkerForm({ mode, worker, onSaved, onCancel, onDelete }) {
  const [f, setF] = useState(
    worker
      ? { ...empty, ...worker, work_description: worker.work_description || "", area: worker.area || "", consent: true }
      : empty
  );
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(worker?.photo_path ? `/api/admin/photos/${worker.photo_path}` : null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const nameRef = useRef(null);
  const nativeCam = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (mode === "add") nameRef.current?.focus();
  }, [mode]);

  const update = (k, v) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (errors[k] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  function takePhoto(file) {
    setPhoto(file);
    setRemovePhoto(false);
    setPreview(URL.createObjectURL(file));
    setCameraOpen(false);
    setErrors((e) => ({ ...e, photo: undefined }));
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErrors((x) => ({ ...x, photo: "कृपया फोटो चुनें / Please choose a photo" }));
    takePhoto(await shrinkPhoto(file));
  }

  function validate() {
    const e = {};
    if (f.name.trim().length < 2) e.name = "नाम लिखें / Enter name";
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = "सही 10 अंकों का नंबर डालें / Enter a valid 10-digit number";
    if (!f.work_category) e.work_category = "काम चुनें / Choose work type";
    if (!f.consent) e.consent = "सहमति पर टिक करें / Please tick to agree";
    return e;
  }

  function showErrors(e) {
    setErrors(e);
    // Bring the first wrong field into view so the user sees what to fix.
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector("[data-invalid=true]");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector("input")?.focus({ preventScroll: true });
    });
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate();
    if (Object.keys(found).length) return showErrors(found);

    const body = new FormData();
    body.set("name", f.name);
    body.set("mobile", f.mobile);
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
      if (err.status === 409) showErrors({ mobile: err.message });
      else setErrors({ form: err.message });
    } finally {
      setBusy(false);
    }
  }

  const hasPhoto = preview && !removePhoto;

  return (
    <form ref={formRef} className="form" onSubmit={submit} noValidate>
      <div className="field" data-invalid={!!errors.name}>
        <label htmlFor="f-name">पूरा नाम <small>Full name</small></label>
        <input
          id="f-name"
          ref={nameRef}
          value={f.name}
          onChange={(e) => update("name", e.target.value)}
          maxLength={80}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="जैसे: रमेश कुमार"
        />
        {errors.name && <p className="field-error">{errors.name}</p>}
      </div>

      <div className="field" data-invalid={!!errors.mobile}>
        <label htmlFor="f-mobile">मोबाइल नंबर <small>Mobile number</small></label>
        <div className="phone-input">
          <span>+91</span>
          <input
            id="f-mobile"
            value={f.mobile}
            onChange={(e) => {
              // Drop a typed/pasted +91 or leading 0 once the number grows past 10 digits.
              let d = e.target.value.replace(/\D/g, "");
              if (d.length > 10) d = d.replace(/^(91|0)/, "");
              update("mobile", d.slice(0, 10));
            }}
            inputMode="numeric"
            type="tel"
            autoComplete="tel-national"
            enterKeyHint="next"
            placeholder="98765 43210"
          />
          <em className={f.mobile.length === 10 ? "ok" : ""}>{f.mobile.length}/10</em>
        </div>
        {errors.mobile && <p className="field-error">{errors.mobile}</p>}
      </div>

      <div className="field" data-invalid={!!errors.photo}>
        <span className="label">फोटो <small>Photo</small></span>
        <div className="photo-row">
          <button type="button" className={`photo-preview ${hasPhoto ? "" : "empty"}`} onClick={() => setCameraOpen(true)} aria-label="Take photo">
            {hasPhoto ? <img src={preview} alt="Worker" /> : <span>📷<small>फोटो लें</small></span>}
          </button>
          <div className="photo-buttons">
            <button type="button" className="btn secondary" onClick={() => setCameraOpen(true)}>
              📷 {hasPhoto ? "दोबारा लें" : "कैमरा"}
            </button>
            <label className="btn secondary">
              🖼️ गैलरी
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} hidden />
            </label>
            {mode === "edit" && hasPhoto && (
              <button type="button" className="link danger" onClick={() => { setRemovePhoto(true); setPhoto(null); }}>
                फोटो हटाएँ
              </button>
            )}
          </div>
          <input ref={nativeCam} type="file" accept="image/*" capture={mode === "public" ? "user" : "environment"} onChange={pickPhoto} hidden />
        </div>
        {errors.photo && <p className="field-error">{errors.photo}</p>}
      </div>

      <fieldset className="field" data-invalid={!!errors.work_category}>
        <legend className="label">काम क्या करते हैं? <small>Work type</small></legend>
        <div className="cat-grid">
          {CATEGORIES.map(([v, hi, icon]) => (
            <label key={v} className={`cat ${f.work_category === v ? "on" : ""}`}>
              <input type="radio" name="work_category" value={v} checked={f.work_category === v} onChange={() => update("work_category", v)} />
              <span className="cat-icon">{icon}</span>
              <span className="cat-text">
                {hi}
                {hi !== v && <small>{v}</small>}
              </span>
            </label>
          ))}
        </div>
        {errors.work_category && <p className="field-error">{errors.work_category}</p>}
      </fieldset>

      <div className="field">
        <label htmlFor="f-desc">और क्या काम आता है <small>Work details · optional</small></label>
        <textarea id="f-desc" value={f.work_description} onChange={(e) => update("work_description", e.target.value)} maxLength={500} rows={2} placeholder="जैसे: टाइल्स, प्लास्टर, वायरिंग…" />
      </div>

      <div className="field">
        <label htmlFor="f-area">इलाका <small>Area · optional</small></label>
        <input id="f-area" value={f.area} onChange={(e) => update("area", e.target.value)} maxLength={100} enterKeyHint="done" placeholder="जैसे: नरोल, वटवा…" />
      </div>

      {mode !== "edit" && (
        <div className="field" data-invalid={!!errors.consent}>
          <label className={`consent ${f.consent ? "on" : ""}`}>
            <input type="checkbox" checked={f.consent} onChange={(e) => update("consent", e.target.checked)} />
            <span>
              मैं सहमत हूँ कि मेरी जानकारी सेव की जाए और काम के लिए मुझसे संपर्क किया जाए।
              <small>I agree to store my details and be contacted for work.</small>
            </span>
          </label>
          {errors.consent && <p className="field-error">{errors.consent}</p>}
        </div>
      )}

      {mode === "edit" && onDelete && (
        <button type="button" className="btn delete" onClick={onDelete} disabled={busy}>
          🗑️ वर्कर हटाएँ / Delete worker
        </button>
      )}

      <div className="submit-bar">
        {errors.form && <p className="error" role="alert">{errors.form}</p>}
        <div className="actions">
          {onCancel && (
            <button type="button" className="btn secondary" onClick={onCancel} disabled={busy}>
              रद्द करें
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? <><span className="spinner" /> सेव हो रहा है…</> : mode === "edit" ? "✓ सेव करें" : "✓ रजिस्टर करें"}
          </button>
        </div>
      </div>

      {cameraOpen && (
        <CameraCapture
          initialFacing={mode === "public" ? "user" : "environment"}
          onCapture={takePhoto}
          onClose={() => setCameraOpen(false)}
          onFallback={() => { setCameraOpen(false); nativeCam.current?.click(); }}
        />
      )}
    </form>
  );
}
