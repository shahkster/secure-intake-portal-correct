import crypto from "node:crypto";
import fs from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });
const ask = async (label, fallback = "") => {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || fallback;
};

console.log("\nSecure Intake Portal setup\n");
const supabaseUrl = await ask("Supabase project URL", "https://YOUR_PROJECT.supabase.co");
const supabaseKey = await ask("Supabase secret key", "sb_secret_REPLACE_ME");
const email = await ask("Agent login email", "you@example.com");
const password = await ask("Agent login password", "CHANGE-ME-NOW");
rl.close();

const secret = () => crypto.randomBytes(32).toString("base64");
const content = `SUPABASE_URL=${supabaseUrl}\nSUPABASE_SECRET_KEY=${supabaseKey}\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${secret()}\nDATA_ENCRYPTION_KEY=${secret()}\nVERIFY_PEPPER=${secret()}\nREQUEST_EXPIRY_HOURS=48\nNEXT_PUBLIC_TEST_MODE=true\n`;

await fs.writeFile(".env.local", content, { mode: 0o600 });
console.log("\nCreated .env.local. Keep this file private and never upload it to GitHub.\n");
console.log("For Vercel, add the same variables in Project Settings > Environment Variables.\n");
