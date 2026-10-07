# Bozo Music Studio — เว็บร้าน (GitHub + Netlify)

เว็บร้านอุปกรณ์ดนตรี มีหน้า **/admin** ให้เจ้าของร้านล็อกอินด้วยรหัสผ่านแล้วแก้ทุกอย่างได้
กด "บันทึกและเผยแพร่" เว็บจริงเปลี่ยนทันที ไม่ต้องอัปโหลดไฟล์ใหม่

## โครงสร้างไฟล์
- `public/` — หน้าเว็บ (`index.html` หน้าร้าน, `admin.html` หน้าแอดมิน, `assets/` โลโก้/QR, `data.js` ข้อมูลตั้งต้น)
- `netlify/functions/` — ระบบหลังบ้าน (`shop.mjs` เก็บข้อมูลร้าน, `img.mjs` เก็บรูป)
- `netlify.toml`, `package.json` — ตั้งค่าให้ Netlify (ไม่ต้องแก้)

ข้อมูลที่แก้ในหน้า admin เก็บไว้ที่ Netlify (Netlify Blobs) ไม่ได้อยู่ใน GitHub
`public/data.js` เป็นแค่ข้อมูลตั้งต้น (ใช้ตอนยังไม่เคยบันทึกจากหน้า admin หรือเมื่อระบบหลังบ้านใช้ไม่ได้)
อัปเดตโค้ดใน GitHub เมื่อไหร่ ข้อมูลร้านที่บันทึกไว้ไม่หาย

## ขั้นตอนติดตั้ง (ทำครั้งเดียว ใช้คอมพิวเตอร์)

### 1) สร้างที่เก็บโค้ดบน GitHub
1. สมัคร/ล็อกอิน https://github.com
2. กดปุ่ม **New** (สร้าง repository ใหม่) ตั้งชื่อ `bozomusic` เลือก **Private** แล้วกด **Create repository**
3. ในหน้า repo ที่ว่างอยู่ กด **uploading an existing file**
4. แตกไฟล์ zip นี้ แล้วลาก **ไฟล์และโฟลเดอร์ทั้งหมดที่อยู่ข้างใน** (`netlify`, `public`, `netlify.toml`, `package.json`, `README.md`, `.gitignore`) ไปวางในหน้าเว็บ รอจนอัปโหลดครบ แล้วกด **Commit changes**
   - ตรวจว่าใน repo มีโฟลเดอร์ `public` และ `netlify/functions` ครบ

### 2) เชื่อม Netlify กับ GitHub
1. เข้า https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub**
2. อนุญาตให้ Netlify เข้าถึง GitHub แล้วเลือก repo `bozomusic`
3. หน้าตั้งค่า build ปล่อยตามค่าที่ขึ้นมาได้เลย (อ่านจาก `netlify.toml`) แล้วกด **Deploy**

### 3) ตั้งรหัสผ่านแอดมิน (สำคัญ)
1. ในโปรเจกต์ Netlify ไปที่ **Project configuration → Environment variables → Add a variable**
2. Key: `ADMIN_PASSWORD`  Value: รหัสผ่านที่คุณตั้งเอง (ยาว 10 ตัวอักษรขึ้นไป ไม่ซ้ำกับที่อื่น) → **Create variable**
3. ไปที่ **Deploys → Trigger deploy → Clear cache and deploy site** เพื่อให้รหัสผ่านมีผล

### 4) ผูกโดเมน bozomusic.com
1. **Domain management → Add a domain** ใส่ `bozomusic.com`
2. ถ้าโดเมนนี้ผูกกับเว็บเดิม (ที่เคยลากโฟลเดอร์อัป) ให้ลบโดเมนออกจากเว็บเดิมก่อน
3. ทำตามที่ Netlify บอกเรื่อง DNS (ดูวิธีโดยละเอียดจากที่เคยทำ) รอ HTTPS ขึ้นอัตโนมัติ

### 5) เริ่มใช้งาน
เปิด `https://bozomusic.com/admin` ใส่รหัสผ่าน แก้สินค้า/ค่าส่ง/ข้อความ/รูป แล้วกด **บันทึกและเผยแพร่**

## หมายเหตุ
- สต็อกไม่ถูกหักอัตโนมัติเมื่อลูกค้าสั่ง (ออเดอร์ส่งผ่าน LINE) ให้เจ้าของร้านปรับสต็อกในหน้า admin หลังปิดการขาย
- ปุ่ม "ดาวน์โหลดไฟล์สำรองข้อมูล" ในหน้า admin ใช้เก็บสำรองข้อมูลร้านไว้ในเครื่อง
- ลืมรหัสผ่าน: เปลี่ยนค่า `ADMIN_PASSWORD` ใน Netlify แล้ว deploy ใหม่
- หน้า admin และ `/api/` ถูกกันไม่ให้ Google เก็บ
