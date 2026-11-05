# Bozo Music Studio — คู่มือสำหรับ Claude Code

ร้านขายอุปกรณ์ดนตรี (สายกีตาร์/เบส คาโป ปิ๊ก ฯลฯ) ของครูสอนดนตรีที่ ท่าบ่อ หนองคาย  ภาษาหน้าเว็บ/ข้อความทั้งหมดเป็นภาษาไทย  โดเมนปลายทาง bozomusic.com (Netlify, deploy จาก branch main ของ repo นี้)

## โครงสร้าง
- `public/index.html` หน้าร้านลูกค้า (JS ล้วน ไม่มี build) — โหลดข้อมูลจาก `/api/shop` ถ้าไม่ได้ใช้ `public/data.js` เป็นข้อมูลตั้งต้น
- `public/admin.html` หน้าหลังบ้าน (ล็อกอินด้วยรหัสผ่าน) แก้สินค้า/สต็อก/เซ็ต/ค่าส่งรายอำเภอ/ข้อความ/รูป/COMING SOON แล้วกด "บันทึกและเผยแพร่"
- `public/report.html` รายงานยอดขาย รายวัน/สัปดาห์/เดือน + จัดการสถานะออเดอร์
- `netlify/functions/shop.mjs` `/api/shop` GET สาธารณะ (ตัดต้นทุน `c` ออก) / POST แอดมิน
- `netlify/functions/orders.mjs` `/api/orders` ลูกค้า POST action=create (คำนวณราคา ต้นทุน ค่าส่งฝั่งเซิร์ฟเวอร์) ส่วน list/status/delete ต้องเป็นแอดมิน
- `netlify/functions/img.mjs` `/api/img` อัปโหลด/เสิร์ฟรูป (Netlify Blobs)
- ข้อมูลเก็บใน Netlify Blobs store ชื่อ `bozo` (key `shop`, `order-<ts>-<hex>`, `img-<hex>`)
- แอดมินส่งรหัสผ่านทาง header `x-admin-password` เทียบกับ env `ADMIN_PASSWORD` (ต้องตั้งใน Netlify scope ที่รวม Functions)

## โมเดลข้อมูล (window.SHOP)
`lineOA, promptpay, studioUrl, text{shopName,headline,checkinText,mapQuery,soonTitle,soonText,soonOff}, soon[{id,n,img}], qrImg, logoImg, delivery{areas,rules{อำเภอ:{fee,free}}}, products[{id,n,p,s,c,img,set:[{id,q}]}]`
- `free: 0` = ส่งฟรีเสมอ, `free: 1e9` = ไม่มียอดส่งฟรี  ·  `c` = ราคาต้นทุน (ห้ามหลุดไปหน้าร้าน)  ·  สต็อกของเซ็ต = min(floor(comp.s/q))
- สต็อก 0 = เปิดพรีออเดอร์  ·  ชำระด้วยพร้อมเพย์เท่านั้น  ·  สั่งซื้อผ่าน LINE OA (@313dgcyl)

## รันในเครื่อง
```
npm i -g netlify-cli && npm install
ADMIN_PASSWORD=ตั้งเอง netlify dev     # เปิด http://localhost:8888 และ /admin.html
```
(`netlify dev` จำลอง Functions + Blobs ในเครื่อง ข้อมูลแยกจากเว็บจริง)

## ข้อควรระวัง
- ไม่มี build step; แก้ไฟล์ใน `public/` แล้ว push ขึ้น main ก็ deploy เอง
- ทุกครั้งที่แก้ inline `<script>` ให้รัน `node --check` กับสคริปต์นั้น และทดสอบด้วย Playwright (route `/api/*`)
- LINE `oaMessage` เด้งได้เฉพาะมือถือ/เครื่องที่มีแอป LINE — บนคอมใช้กล่องคัดลอกข้อความแทน
- ยังไม่ทำ: ตัดสต็อกอัตโนมัติเมื่อสถานะ "ชำระแล้ว", แจ้งเตือนออเดอร์เข้า LINE ผ่าน Messaging API, ย้ายโดเมน bozomusic.com, ใส่ studioUrl (เว็บรับทำเพลง)
