// ข้อมูลร้าน: GET = ใครก็อ่านได้ (หน้าร้านใช้), POST = ต้องมีรหัสผ่านแอดมิน (หน้า /admin ใช้)
import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

export const config = { path: "/api/shop" };

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// คืน null = ยังไม่ได้ตั้ง ADMIN_PASSWORD, true/false = รหัสถูก/ผิด
function checkPw(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want) return null;
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req) => {
  const store = getStore("bozo");

  if (req.method === "GET") {
    const data = await store.get("shop", { type: "json", consistency: "strong" });
    return json(data || null);
  }

  if (req.method === "POST") {
    const ok = checkPw(req.headers.get("x-admin-password"));
    if (ok === null) return json({ error: "not_configured" }, 503);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 900)); // หน่วงเวลาเมื่อรหัสผิด กันเดารหัส
      return json({ error: "unauthorized" }, 401);
    }
    const text = await req.text();
    if (text.length > 1_500_000) return json({ error: "too_large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    if (body && body.action === "login") return json({ ok: true });
    const shop = body && body.shop;
    if (!shop || typeof shop !== "object" || !Array.isArray(shop.products)) return json({ error: "bad_shape" }, 400);
    if (shop.products.length > 500) return json({ error: "too_many" }, 400);
    shop.updatedAt = Date.now();
    await store.setJSON("shop", shop);
    return json({ ok: true, updatedAt: shop.updatedAt });
  }

  return json({ error: "method_not_allowed" }, 405);
};
