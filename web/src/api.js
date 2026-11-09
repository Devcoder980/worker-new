// [value saved in DB, Hindi label, icon]
export const CATEGORIES = [
  ["Helper", "हेल्पर", "🧰"],
  ["Mason", "मिस्त्री", "🧱"],
  ["Painter", "पेंटर", "🖌️"],
  ["Electrician", "इलेक्ट्रीशियन", "💡"],
  ["Plumber", "प्लंबर", "🔧"],
  ["Loading/Unloading", "लोडिंग / अनलोडिंग", "📦"],
  ["Factory Worker", "फैक्ट्री वर्कर", "🏭"],
  ["Other", "अन्य", "➕"],
];
export const categoryLabel = (v) => {
  const c = CATEGORIES.find(([k]) => k === v);
  return c ? `${c[2]} ${c[1]}` : v;
};

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: "same-origin", ...options });
  } catch {
    throw new Error("No internet connection. Please try again. / इंटरनेट नहीं है, फिर कोशिश करें।");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Shrinks the photo in the browser (max 1200px JPEG) so uploads are quick on mobile data.
// The server resizes again, so this is only a speed-up.
export async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
