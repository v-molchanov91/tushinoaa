// Хранилище текстов Ежедневника АА (Netlify Blobs).
// GET  /api/daily            — все сохранённые дни { "10-19": {...}, ... }
// POST /api/daily            — сохранить день   (нужен пароль)
// DELETE /api/daily?key=MM-DD — удалить день    (нужен пароль)
// Пароль задаётся в Netlify: Project configuration → Environment variables → ADMIN_PASSWORD
import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const KEY_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const LIMITS = { title: 300, quote: 3000, source: 500, text: 10000 };

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !given) return false;
  const a = Buffer.from(expected), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const store = getStore({ name: "daily", consistency: "strong" });
  const all = (await store.get("entries", { type: "json" })) || {};

  if (req.method === "GET") {
    return json(all, 200, { "cache-control": "public, max-age=60" });
  }

  if (!authorized(req)) return json({ error: "Неверный пароль" }, 401);

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Некорректные данные" }, 400); }
    if (body.check) return json({ ok: true }); // проверка пароля
    if (!KEY_RE.test(body.key || "")) return json({ error: "Дата должна быть в формате ММ-ДД" }, 400);
    const entry = {};
    for (const [field, max] of Object.entries(LIMITS)) {
      const v = String(body[field] || "").trim();
      if (v.length > max) return json({ error: `Поле «${field}» слишком длинное` }, 400);
      if (v) entry[field] = v;
    }
    if (!entry.title || !entry.text) return json({ error: "Нужны хотя бы заголовок и текст" }, 400);
    all[body.key] = entry;
    await store.setJSON("entries", all);
    return json({ ok: true, count: Object.keys(all).length });
  }

  if (req.method === "DELETE") {
    const key = new URL(req.url).searchParams.get("key") || "";
    if (!KEY_RE.test(key)) return json({ error: "Неверная дата" }, 400);
    delete all[key];
    await store.setJSON("entries", all);
    return json({ ok: true, count: Object.keys(all).length });
  }

  return json({ error: "Метод не поддерживается" }, 405);
};

export const config = { path: "/api/daily" };
