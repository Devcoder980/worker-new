import { Hono, type Context } from "hono";
import { serveStatic } from "hono/bun";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import sharp from "sharp";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { join } from "node:path";
import { unlink } from "node:fs/promises";
import * as db from "./db";

const PORT = Number(process.env.PORT || 3090);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
if (ADMIN_PASSWORD.length < 8 || JWT_SECRET.length < 16) {
  console.error("Set ADMIN_PASSWORD (8+ chars) and JWT_SECRET (16+ chars) in .env");
  process.exit(1);
}

export const CATEGORIES = [
  "Helper",
  "Mason",
  "Painter",
  "Electrician",
  "Plumber",
  "Loading/Unloading",
  "Factory Worker",
  "Other",
];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const COOKIE = "admin_token";

const app = new Hono();

// ---------- helpers ----------

class BadInput extends Error {}

function clientIp(c: Context) {
  return c.req.header("x-real-ip") || c.req.header("x-forwarded-for")?.split(",")[0].trim() || "local";
}

// Tiny in-memory rate limiter: `max` hits per `windowMs` per key.
const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string, max: number, windowMs: number) {
  const t = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < t) {
    hits.set(key, { n: 1, reset: t + windowMs });
    return false;
  }
  h.n++;
  return h.n > max;
}
setInterval(() => {
  const t = Date.now();
  for (const [k, h] of hits) if (h.reset < t) hits.delete(k);
}, 60_000);

function normalizeMobile(raw: string) {
  let m = raw.replace(/[\s-]/g, "");
  if (m.startsWith("+91")) m = m.slice(3);
  else if (m.length === 12 && m.startsWith("91")) m = m.slice(2);
  else if (m.length === 11 && m.startsWith("0")) m = m.slice(1);
  return m;
}

function text(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readWorker(form: FormData) {
  const name = text(form, "name").replace(/\s+/g, " ");
  const mobile = normalizeMobile(text(form, "mobile"));
  const work_category = text(form, "work_category");
  const work_description = text(form, "work_description");
  const area = text(form, "area");
  if (name.length < 2 || name.length > 80) throw new BadInput("Name must be 2–80 characters / नाम 2–80 अक्षर का हो");
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new BadInput("Enter a valid 10-digit mobile number / सही 10 अंकों का मोबाइल नंबर डालें");
  if (!CATEGORIES.includes(work_category)) throw new BadInput("Choose a work category / काम का प्रकार चुनें");
  if (work_description.length > 500) throw new BadInput("Work description is too long (max 500)");
  if (area.length > 100) throw new BadInput("Area is too long (max 100)");
  return { name, mobile, work_category, work_description: work_description || null, area: area || null };
}

// Validates the upload is a real image, auto-rotates, resizes to max 800px, re-encodes as JPEG
// (which also strips EXIF/GPS data). Returns the stored file name.
async function savePhoto(file: unknown): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) throw new BadInput("Photo is too large (max 8 MB)");
  const buf = Buffer.from(await file.arrayBuffer());
  let meta;
  try {
    meta = await sharp(buf, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new BadInput("Photo must be a JPG, PNG or WEBP image");
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format))
    throw new BadInput("Photo must be a JPG, PNG or WEBP image");
  const fileName = `${randomUUID()}.jpg`;
  await sharp(buf, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toFile(join(db.PHOTO_DIR, fileName));
  return fileName;
}

async function removePhoto(fileName: string | null) {
  if (fileName) await unlink(join(db.PHOTO_DIR, fileName)).catch(() => {});
}

function isUniqueError(e: unknown) {
  return e instanceof Error && /UNIQUE constraint failed/.test(e.message);
}

const DUPLICATE = "This mobile number is already registered / यह मोबाइल नंबर पहले से रजिस्टर है";

// Shared create logic for both admin and QR registration.
async function create(c: Context, source: "admin" | "qr") {
  const form = await c.req.formData();
  const consent = text(form, "consent");
  if (consent !== "true" && consent !== "on") throw new BadInput("Consent is required / सहमति ज़रूरी है");
  const input = readWorker(form);
  if (db.findByMobile(input.mobile)) return c.json({ error: DUPLICATE }, 409);
  const photo_path = await savePhoto(form.get("photo"));
  try {
    const w = db.createWorker({ ...input, photo_path }, source);
    return c.json(source === "admin" ? w : { ok: true, name: w.name }, 201);
  } catch (e) {
    await removePhoto(photo_path);
    if (isUniqueError(e)) return c.json({ error: DUPLICATE }, 409);
    throw e;
  }
}

app.onError((e, c) => {
  if (e instanceof BadInput) return c.json({ error: e.message }, 400);
  console.error(e);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

app.use("/api/*", bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.json({ error: "Upload too large" }, 413) }));

// ---------- public ----------

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/register", async (c) => {
  if (limited(`reg:${clientIp(c)}`, 60, 10 * 60_000))
    return c.json({ error: "Too many attempts. Please wait a few minutes." }, 429);
  return create(c, "qr");
});

// ---------- admin auth ----------

function samePassword(given: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

app.post("/api/login", async (c) => {
  if (limited(`login:${clientIp(c)}`, 10, 15 * 60_000))
    return c.json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.password !== "string" || !samePassword(body.password))
    return c.json({ error: "Wrong password / गलत पासवर्ड" }, 401);
  const token = await sign({ role: "admin", exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600 }, JWT_SECRET);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.use("/api/admin/*", async (c, next) => {
  const token = getCookie(c, COOKIE);
  try {
    if (!token) throw new Error();
    await verify(token, JWT_SECRET, "HS256");
  } catch {
    return c.json({ error: "Login required" }, 401);
  }
  await next();
});

// ---------- admin ----------

const idParam = (c: Context) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id < 1) throw new BadInput("Bad id");
  return id;
};

app.get("/api/admin/stats", (c) => c.json(db.stats()));

app.get("/api/admin/workers", (c) => {
  const search = (c.req.query("search") || "").trim().slice(0, 50);
  const category = c.req.query("category") || "";
  return c.json(db.listWorkers(search, CATEGORIES.includes(category) ? category : ""));
});

app.post("/api/admin/workers", (c) => create(c, "admin"));

app.put("/api/admin/workers/:id", async (c) => {
  const id = idParam(c);
  const existing = db.getWorker(id);
  if (!existing) return c.json({ error: "Worker not found" }, 404);
  const form = await c.req.formData();
  const input = readWorker(form);
  const other = db.findByMobile(input.mobile);
  if (other && other.id !== id) return c.json({ error: DUPLICATE }, 409);
  const newPhoto = await savePhoto(form.get("photo"));
  const removeOld = text(form, "remove_photo") === "true";
  const photo_path = newPhoto ?? (removeOld ? null : existing.photo_path);
  try {
    const w = db.updateWorker(id, { ...input, photo_path });
    if (photo_path !== existing.photo_path) await removePhoto(existing.photo_path);
    return c.json(w);
  } catch (e) {
    await removePhoto(newPhoto);
    if (isUniqueError(e)) return c.json({ error: DUPLICATE }, 409);
    throw e;
  }
});

app.delete("/api/admin/workers/:id", async (c) => {
  const w = db.deleteWorker(idParam(c));
  if (!w) return c.json({ error: "Worker not found" }, 404);
  await removePhoto(w.photo_path);
  return c.json({ ok: true });
});

app.get("/api/admin/photos/:file", async (c) => {
  const name = c.req.param("file");
  if (!/^[a-f0-9-]{36}\.jpg$/.test(name)) return c.notFound();
  const f = Bun.file(join(db.PHOTO_DIR, name));
  if (!(await f.exists())) return c.notFound();
  return new Response(f, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
});

app.get("/api/admin/export.csv", (c) => {
  // Prefix cells starting with = + - @ so spreadsheets don't run them as formulas.
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const cols = ["id", "name", "mobile", "work_category", "work_description", "area", "registration_source", "consent_at", "created_at", "updated_at", "photo_path"] as const;
  const rows = db.listWorkers().map((w) => cols.map((k) => cell(w[k])).join(","));
  const csv = "﻿" + [cols.join(","), ...rows].join("\r\n");
  const date = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workers-${date}.csv"`,
    },
  });
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// ---------- frontend (built React app) ----------

const DIST = "./web/dist";
app.use("/assets/*", serveStatic({ root: DIST }));
app.use("/*", serveStatic({ root: DIST }));
app.get("*", serveStatic({ path: `${DIST}/index.html` }));

console.log(`Worker registration running on http://localhost:${PORT}`);
export default { port: PORT, hostname: process.env.HOST || "0.0.0.0", fetch: app.fetch, maxRequestBodySize: 12 * 1024 * 1024 };
