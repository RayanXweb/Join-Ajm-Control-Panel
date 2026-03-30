export const config = {
  api: { bodyParser: false },
};

import fetch from "node-fetch";
import FormData from "form-data";
import Busboy from "busboy";

// 🛡️ RATE LIMIT (simple)
const rateLimit = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 LIMIT IP
  const ip = req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const user = rateLimit.get(ip) || { count: 0, time: now };

  if (now - user.time < 60000) {
    user.count++;
    if (user.count > 3) {
      return res.status(429).json({ error: "Terlalu banyak request" });
    }
  } else {
    user.count = 1;
    user.time = now;
  }
  rateLimit.set(ip, user);

  // 📦 PARSE FORM DATA
  const busboy = Busboy({ headers: req.headers });

  let nama = "", paket = "", telegram = "";
  let fileBuffer = null, fileName = "";

  await new Promise((resolve, reject) => {
    busboy.on("field", (field, val) => {
      if (field === "nama") nama = val;
      if (field === "paket") paket = val;
      if (field === "telegram") telegram = val;
    });

    busboy.on("file", (field, file, filename) => {
      fileName = filename;
      const chunks = [];

      file.on("data", (data) => chunks.push(data));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("finish", resolve);
    busboy.on("error", reject);

    req.pipe(busboy);
  });

  // ❌ VALIDASI
  if (!nama || !paket || !fileBuffer) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
  const FIREBASE_DB = process.env.FIREBASE_DB;

  const idOrder = "INV-" + Math.floor(Math.random() * 999999);
  const waktu = new Date().toLocaleString("id-ID");

  const textAdmin = `📥 ORDER MASUK
━━━━━━━━━━━━━━
👤 Nama: ${nama}
📦 Paket: ${paket}
🆔 ID: ${idOrder}
🕒 ${waktu}
━━━━━━━━━━━━━━`;

  try {
    // 🔥 SIMPAN KE FIREBASE
    await fetch(`${FIREBASE_DB}/orders/${idOrder}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        paket,
        idOrder,
        waktu,
        status: "pending"
      })
    });

    // 📩 KIRIM TEXT KE ADMIN
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: textAdmin
      })
    });

    // 📸 KIRIM FOTO
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("photo", fileBuffer, fileName);
    formData.append("caption", `${idOrder} - ${nama}`);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: formData
    });

    // 🤖 AUTO INVOICE KE USER
    if (telegram) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram,
          text: `🧾 INVOICE PEMBELIAN
━━━━━━━━━━━━━━
🆔 ID: ${idOrder}
📦 Paket: ${paket}
👤 Nama: ${nama}
🕒 ${waktu}

⏳ Status: Menunggu verifikasi admin
━━━━━━━━━━━━━━`
        })
      });
    }

    // ✅ RESPONSE
    res.status(200).json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
}
