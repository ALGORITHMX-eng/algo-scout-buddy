import fs from "fs";
import https from "https";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createClient } from "@supabase/supabase-js";

const [,, EMAIL, PASSWORD, PDF_PATH] = process.argv;

if (!EMAIL || !PASSWORD || !PDF_PATH) {
  console.error("Usage: node test-resume.mjs <email> <password> <pdf_path>");
  process.exit(1);
}

const SUPABASE_URL = "https://ijmtttfdhzwjigeedgxd.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbXR0dGZkaHp3amlnZWVkZ3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTEyMDMsImV4cCI6MjA4OTQ2NzIwM30.m-_rhbvkxJUCaaD7r5yVdW9dGWrHDRMoWftq8FS1qwc";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error) { console.error("Auth error:", error.message); process.exit(1); }
console.log("Logged in as:", user.id);

const pdfBuffer = new Uint8Array(fs.readFileSync(PDF_PATH));
const pdf = await getDocument({ data: pdfBuffer }).promise;
let fullText = "";
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  fullText += content.items.map((item) => item.str).join(" ") + "\n";
}
console.log("Extracted text length:", fullText.length);

const base64 = Buffer.from(fullText, "utf-8").toString("base64");
const body = JSON.stringify({ user_id: user.id, mimeType: "text/plain", resumeBase64: base64 });

const options = {
  hostname: "ijmtttfdhzwjigeedgxd.supabase.co",
  path: "/functions/v1/parse-resume",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${ANON_KEY}`,
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => console.log("\nResponse:", data));
});
req.write(body);
req.end();