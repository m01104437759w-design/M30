const http = require("http");
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5-5";

const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
};

async function analyze({ image, mediaType = "image/jpeg", yesList = [], lang = "ar" }) {
  const prompt = `أنت مساعد فرز صحي أولي. حلّل صورة الوش المرفقة بحثًا عن: الهالات الداكنة أسفل العين، شحوب البشرة، شحوب الشفاه، وشحوب الملتحمة لو ظاهر. خد في اعتبارك تأثير الإضاءة ولون البشرة الطبيعي.
لو الصورة مش وش واضح رجّع valid=false.
إجابات المستخدم بنعم: ${JSON.stringify(yesList)}
رجّع JSON فقط بدون أي نص إضافي وبدون backticks:
{"valid":true,"dark_circles":true|false,"skin_pallor":true|false,"lip_pallor":true|false,"anemia_signs":true|false,"confidence":"منخفضة|متوسطة|عالية","observations":["ملاحظة بالعربي"],"tests":["CBC","فيريتين وحديد المصل"],"other_conditions":[{"name":"اسم الحالة","linked_symptoms":["أعراض من إجابات نعم"],"why":"شرح قصير"}]}
anemia_signs=true بس لو علامتين على الأقل من الثلاثة. other_conditions تتكتب لو anemia_signs=false فقط (قصور الغدة الدرقية، نقص فيتامين D أو B12، إجهاد مزمن، انخفاض ضغط... واربط كل حالة بأعراض المستخدم)، ولو true سيبها [].`
    + (lang === "en" ? "\nIMPORTANT: write ALL text values (observations, tests, names, why, confidence as low/medium/high) in English." : "");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: prompt }
      ]}]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  const text = data.content.filter(c => c.type === "text").map(c => c.text).join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST,GET" });
    return res.end();
  }
  if (req.method === "GET") return send(res, 200, { ok: true, message: "Zamzam server is running" });
  if (req.method === "POST" && req.url === "/analyze") {
    let body = "", size = 0;
    req.on("data", c => { size += c.length; if (size > 8e6) { req.destroy(); } else body += c; });
    req.on("end", async () => {
      try {
        const input = JSON.parse(body);
        if (!input.image) return send(res, 400, { error: "no image" });
        send(res, 200, await analyze(input));
      } catch (e) { send(res, 500, { error: String(e) }); }
    });
    return;
  }
  send(res, 404, { error: "not found" });
}).listen(process.env.PORT || 3000, () => console.log("server up"));
