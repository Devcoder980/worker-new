// All SQL lives here, so moving to MySQL later means changing only this file.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const DATA_DIR = process.env.DATA_DIR || "./data";
export const PHOTO_DIR = join(DATA_DIR, "photos");
mkdirSync(PHOTO_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, "workers.db"), { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
db.exec(`
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  photo_path TEXT,
  work_category TEXT NOT NULL,
  work_description TEXT,
  area TEXT,
  consent_at TEXT NOT NULL,
  registration_source TEXT NOT NULL CHECK (registration_source IN ('admin','qr')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workers_category ON workers(work_category);
CREATE INDEX IF NOT EXISTS idx_workers_created ON workers(created_at);
`);

export type Worker = {
  id: number;
  name: string;
  mobile: string;
  photo_path: string | null;
  work_category: string;
  work_description: string | null;
  area: string | null;
  consent_at: string;
  registration_source: "admin" | "qr";
  created_at: string;
  updated_at: string;
};

export type WorkerInput = {
  name: string;
  mobile: string;
  photo_path: string | null;
  work_category: string;
  work_description: string | null;
  area: string | null;
};

const now = () => new Date().toISOString();

export function findByMobile(mobile: string): Worker | null {
  return db.query("SELECT * FROM workers WHERE mobile = ?").get(mobile) as Worker | null;
}

export function getWorker(id: number): Worker | null {
  return db.query("SELECT * FROM workers WHERE id = ?").get(id) as Worker | null;
}

export function createWorker(w: WorkerInput, source: "admin" | "qr"): Worker {
  const t = now();
  return db
    .query(
      `INSERT INTO workers (name, mobile, photo_path, work_category, work_description, area, consent_at, registration_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
    .get(w.name, w.mobile, w.photo_path, w.work_category, w.work_description, w.area, t, source, t, t) as Worker;
}

export function updateWorker(id: number, w: WorkerInput): Worker | null {
  return db
    .query(
      `UPDATE workers SET name = ?, mobile = ?, photo_path = ?, work_category = ?, work_description = ?, area = ?, updated_at = ?
       WHERE id = ? RETURNING *`
    )
    .get(w.name, w.mobile, w.photo_path, w.work_category, w.work_description, w.area, now(), id) as Worker | null;
}

export function deleteWorker(id: number): Worker | null {
  return db.query("DELETE FROM workers WHERE id = ? RETURNING *").get(id) as Worker | null;
}

export function listWorkers(search = "", category = ""): Worker[] {
  const where: string[] = [];
  const params: string[] = [];
  if (search) {
    where.push("(name LIKE ? OR mobile LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push("work_category = ?");
    params.push(category);
  }
  const sql = `SELECT * FROM workers ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  return db.query(sql).all(...params) as Worker[];
}

// "Today" is counted in India time (UTC+5:30).
export function stats() {
  const total = (db.query("SELECT COUNT(*) AS n FROM workers").get() as { n: number }).n;
  const today = (
    db
      .query("SELECT COUNT(*) AS n FROM workers WHERE date(created_at, '+330 minutes') = date('now', '+330 minutes')")
      .get() as { n: number }
  ).n;
  return { total, today };
}
