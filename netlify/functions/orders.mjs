// ออเดอร์: POST create = ลูกค้า (ไม่ต้องใช้รหัส), ที่เหลือ = แอดมิน (ต้องมีรหัสผ่าน)
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, randomBytes } from "node:crypto";

export const config = { path: "/api/orders" };

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
const STATUS = ["new", "paid", "cancel"];
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

export default async (req) => {
  const store = getStore("bozo");

  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > 20000) return json({ error: "too_large" }, 413);
    let b;
    try { b = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }

    // --- ลูกค้าส่งออเดอร์: ราคา/ต้นทุน/ค่าส่ง คำนวณฝั่งเซิร์ฟเวอร์จากข้อมูลร้านจริง ---
    if (b && b.action === "create") {
      const shop = await store.get("shop", { type: "json", consistency: "strong" });
      if (!shop || !Array.isArray(shop.products)) return json({ error: "no_shop" }, 400);
      const byId = new Map(shop.products.map((p) => [p.id, p]));
      const items = [];
      let sub = 0, cost = 0;
      for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 60)) {
        const p = byId.get(it && it.id);
        const q = Math.floor(+it.q);
        if (!p || !(q >= 1 && q <= 99)) continue;
        const c = p.set
          ? (p.set || []).reduce((t, x) => t + ((byId.get(x.id) || {}).c || 0) * (x.q || 1), 0)
          : +p.c || 0;
        items.push({ id: p.id, n: clip(p.n, 120), q, p: +p.p || 0, c, set: !!p.set });
        sub += (+p.p || 0) * q;
        cost += c * q;
      }
      if (!items.length) return json({ error: "empty" }, 400);
      const area = clip(b.area, 60);
      const r = (shop.delivery && shop.delivery.rules && shop.delivery.rules[area]) || { fee: 0, free: 1e9 };
      const free = r.free <= 0 || (r.fee <= 0 && r.free >= 1e9) || sub >= r.free;
      const del = free ? 0 : +r.fee || 0;
      const t = Date.now();
      const id = "order-" + String(t).padStart(13, "0") + "-" + randomBytes(3).toString("hex");
      const order = {
        id, t, name: clip(b.name, 80), phone: clip(b.phone, 20), area, place: clip(b.place, 300),
        items, sub, del, tot: sub + del, cost, status: "new",
      };
      await store.setJSON(id, order);
      return json({ ok: true, id });
    }

    // --- ต่อไปนี้ต้องเป็นแอดมิน ---
    const ok = checkPw(req.headers.get("x-admin-password"));
    if (ok === null) return json({ error: "not_configured" }, 503);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 900));
      return json({ error: "unauthorized" }, 401);
    }
    if (b.action === "list") {
      const { blobs } = await store.list({ prefix: "order-" });
      const keys = blobs.map((x) => x.key).sort().reverse().slice(0, 1500);
      const out = [];
      for (let i = 0; i < keys.length; i += 40) {
        const part = await Promise.all(keys.slice(i, i + 40).map((k) => store.get(k, { type: "json" })));
        part.forEach((o) => o && out.push(o));
      }
      return json({ orders: out });
    }
    if (typeof b.id !== "string" || !/^order-\d{13}-[0-9a-f]{6}$/.test(b.id)) return json({ error: "bad_id" }, 400);
    if (b.action === "status" && STATUS.includes(b.status)) {
      const o = await store.get(b.id, { type: "json", consistency: "strong" });
      if (!o) return json({ error: "not_found" }, 404);
      o.status = b.status;
      await store.setJSON(b.id, o);
      return json({ ok: true });
    }
    if (b.action === "delete") {
      await store.delete(b.id);
      return json({ ok: true });
    }
    return json({ error: "bad_action" }, 400);
  }
  return json({ error: "method_not_allowed" }, 405);
};
