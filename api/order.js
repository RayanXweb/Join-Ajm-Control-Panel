export const config = {
  api: {
    bodyParser: false,
  },
};

import fetch from "node-fetch";
import FormData from "form-data";
import Busboy from "busboy";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const busboy = Busboy({ headers: req.headers });

  let nama = "";
  let paket = "";
  let fileBuffer = null;
  let fileName = "";

  await new Promise((resolve, reject) => {
    busboy.on("field", (fieldname, val) => {
      if (fieldname === "nama") nama = val;
      if (fieldname === "paket") paket = val;
    });

    busboy.on("file", (fieldname, file, filename) => {
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

  if (!nama || !paket || !fileBuffer) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  const idOrder = "INV-" + Math.floor(Math.random() * 999999);
  const waktu = new Date().toLocaleString("id-ID");

  const text = `📥 ORDER MASUK
━━━━━━━━━━━━━━
👤 Nama: ${nama}
📦 Paket: ${paket}
🆔 ID: ${idOrder}
🕒 Waktu: ${waktu}
━━━━━━━━━━━━━━`;

  try {
    // SEND TEXT
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
      }),
    });

    // SEND PHOTO
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("photo", fileBuffer, fileName);
    formData.append("caption", `📸 ${idOrder} - ${nama}`);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: formData,
    });

    res.status(200).json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
      }
