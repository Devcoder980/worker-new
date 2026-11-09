import { useEffect, useRef, useState } from "react";

// Full-screen in-browser camera: asks permission, shows live preview, captures a JPEG.
// Calls onCapture(file) or onClose(). If the camera can't open, offers the phone's own camera instead.
export default function CameraCapture({ initialFacing = "environment", onCapture, onClose, onFallback }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [facing, setFacing] = useState(initialFacing);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setReady(false);
      setError("");
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("यह ब्राउज़र कैमरा नहीं खोल सकता। / This browser can't open the camera here.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(
          e?.name === "NotAllowedError"
            ? "कैमरा की अनुमति नहीं मिली। ब्राउज़र सेटिंग में Camera → Allow करें। / Camera permission denied. Allow it in browser settings."
            : "कैमरा नहीं खुला। / Could not open the camera."
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing]);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  function capture() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const scale = Math.min(1, 1200 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (facing === "user") {
      // Front camera preview is mirrored; save the photo the same way the person saw it.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.85
    );
  }

  return (
    <div className="camera" role="dialog" aria-label="Camera">
      <video ref={video} playsInline muted autoPlay className={facing === "user" ? "mirror" : ""} />
      {!ready && !error && <p className="camera-msg">कैमरा खुल रहा है… / Opening camera…</p>}
      {error && (
        <div className="camera-msg">
          <p>{error}</p>
          <button type="button" className="btn primary" onClick={onFallback}>
            📷 फोन का कैमरा खोलें / Use phone camera
          </button>
        </div>
      )}
      <div className="camera-bar">
        <button type="button" className="cam-side" onClick={() => { stop(); onClose(); }}>
          ✕<small>बंद</small>
        </button>
        <button type="button" className="shutter" onClick={capture} disabled={!ready} aria-label="Capture photo" />
        <button type="button" className="cam-side" onClick={() => setFacing(facing === "user" ? "environment" : "user")}>
          🔄<small>पलटें</small>
        </button>
      </div>
    </div>
  );
}
