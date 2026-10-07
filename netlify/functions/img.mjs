// รูปสินค้า/QR/โลโก้: POST (ต้องมีรหัสผ่าน) เก็บรูป, GET ?id=... แสดงรูป
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, randomBytes } from "node:crypto";

export const config = { path: "/api/img" };

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function checkPw(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want) return null;
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const store = getStore("bozo");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-f0-9]{16,40}$/.test(id)) return new Response("not found", { status: 404 });
    const hit = await store.getWithMetadata("img-" + id, { type: "arrayBuffer" });
    if (!hit || !hit.data) return new Response("not found", { status: 404 });
    return new Response(hit.data, {
      headers: {
        "content-type": (hit.metadata && hit.metadata.type) || "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "POST") {
    const ok = checkPw(req.headers.get("x-admin-password"));
    if (ok === null) return json({ error: "not_configured" }, 503);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 900));
      return json({ error: "unauthorized" }, 401);
    }
    const text = await req.text();
    if (text.length > 900_000) return json({ error: "too_large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec((body && body.data) || "");
    if (!m) return json({ error: "bad_image" }, 400);
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 600_000) return json({ error: "too_large" }, 413);
    const id = randomBytes(12).toString("hex");
    await store.set("img-" + id, bytes, { metadata: { type: m[1] } });
    return json({ ok: true, url: "/api/img?id=" + id });
  }

  return json({ error: "method_not_allowed" }, 405);
};
