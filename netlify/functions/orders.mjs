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
const STATUS = ["new", "paid", "done", "cancel"];
const ID_RE = /^order-\d{13}-[0-9a-f]{6,16}$/;
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

export default async (req) => {
  const store = getStore("bozo");

  // ลูกค้าดูสถานะออเดอร์ของตัวเอง: ต้องรู้รหัสออเดอร์ (เก็บในเครื่องลูกค้า) และคืนเฉพาะข้อมูลไม่ส่วนตัว
  if (req.method === "GET") {
    const ids = String(new URL(req.url).searchParams.get("ids") || "")
      .split(",").filter((i) => ID_RE.test(i)).slice(0, 20);
    const got = await Promise.all(ids.map((i) => store.get(i, { type: "json" })));
    return json({
      orders: got.filter(Boolean).map((o) => ({
        id: o.id, t: o.t, status: o.status, sub: o.sub, del: o.del, tot: o.tot,
        items: (o.items || []).map((x) => ({ n: x.n, q: x.q })),
      })),
    });
  }

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
      const id = "order-" + String(t).padStart(13, "0") + "-" + randomBytes(6).toString("hex");
      const order = {
        id, t, name: clip(b.name, 80), phone: clip(b.phone, 20), area, place: clip(b.place, 300),
        items, sub, del, tot: sub + del, cost, status: "new",
      };
      // หมุดที่อยู่ของลูกค้า (ไม่บังคับ) เห็นเฉพาะแอดมิน: GET ?ids= ไม่คืนค่านี้
      const lat = b.pin && b.pin.lat, lng = b.pin && b.pin.lng;
      if (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        order.pin = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
      }
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
    if (typeof b.id !== "string" || !ID_RE.test(b.id)) return json({ error: "bad_id" }, 400);
    if (b.action === "status" && STATUS.includes(b.status)) {
      const o = await store.get(b.id, { type: "json", consistency: "strong" });
      if (!o) return json({ error: "not_found" }, 404);
      // ตัด/คืนสต็อกอัตโนมัติ: ตัดครั้งเดียวเมื่อออเดอร์เข้าสถานะ paid/done, คืนเมื่อยกเลิก
      const wantCut = b.status === "paid" || b.status === "done";
      let stock = null;
      if (wantCut !== !!o.stockCut && (wantCut || b.status === "cancel" || b.status === "new")) {
        const shop = await store.get("shop", { type: "json", consistency: "strong" });
        if (shop && Array.isArray(shop.products)) {
          const byId = new Map(shop.products.map((p) => [p.id, p]));
          const sign = wantCut ? -1 : 1;
          const move = (id, q) => {
            const p = byId.get(id);
            if (p && !p.set) p.s = Math.max(0, (+p.s || 0) + sign * q);
          };
          for (const it of o.items || []) {
            const p = byId.get(it.id);
            if (!p) continue;
            if (p.set) (p.set || []).forEach((c) => move(c.id, (c.q || 1) * it.q));
            else move(p.id, it.q);
          }
          await store.setJSON("shop", shop);
          o.stockCut = wantCut;
          stock = true;
        }
      }
      o.status = b.status;
      await store.setJSON(b.id, o);
      return json({ ok: true, stock });
    }
    if (b.action === "delete") {
      await store.delete(b.id);
      return json({ ok: true });
    }
    return json({ error: "bad_action" }, 400);
  }
  return json({ error: "method_not_allowed" }, 405);
};
