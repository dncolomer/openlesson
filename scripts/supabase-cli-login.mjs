import crypto from "crypto";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, ".supabase-login-state.json");

function generateLoginState() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey("hex", "uncompressed");
  const privateKey = ecdh.getPrivateKey("hex");
  const sessionId = crypto.randomUUID();
  const tokenName = `cli_${os.userInfo().username}@${os.hostname()}_${Math.floor(Date.now() / 1000)}`;
  const url = `https://supabase.com/dashboard/cli/login?session_id=${sessionId}&token_name=${encodeURIComponent(tokenName)}&public_key=${publicKey}`;
  const state = { sessionId, publicKey, privateKey, tokenName, url };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error("No login state found. Run: node scripts/supabase-cli-login.mjs start");
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function decryptToken(state, apiResponse) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(state.privateKey, "hex"));
  const remotePublic = Buffer.from(apiResponse.public_key, "hex");
  const secret = ecdh.computeSecret(remotePublic);

  const ciphertext = Buffer.from(apiResponse.access_token, "hex");
  const nonce = Buffer.from(apiResponse.nonce, "hex");
  const tagLength = 16;
  const authTag = ciphertext.subarray(ciphertext.length - tagLength);
  const encrypted = ciphertext.subarray(0, ciphertext.length - tagLength);

  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function completeLogin(code) {
  const state = loadState();
  const pollUrl = `https://api.supabase.com/platform/cli/login/${state.sessionId}?device_code=${encodeURIComponent(code)}`;
  const res = await fetch(pollUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login poll failed (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json();
  const token = decryptToken(state, data);
  if (!/^sbp_(oauth_)?[a-f0-9]{40}$/.test(token)) {
    throw new Error(`Unexpected token format after decrypt: ${token.slice(0, 12)}...`);
  }
  execSync(`npx supabase@latest login --token ${token}`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });
  fs.unlinkSync(STATE_FILE);
  return token;
}

const [command, code] = process.argv.slice(2);

if (command === "start") {
  const state = generateLoginState();
  console.log(state.url);
  process.exit(0);
}

if (command === "complete") {
  if (!code) {
    console.error("Usage: node scripts/supabase-cli-login.mjs complete <verification-code>");
    process.exit(1);
  }
  const token = await completeLogin(code);
  console.log("Logged in successfully.");
  process.exit(0);
}

console.error("Usage:\n  node scripts/supabase-cli-login.mjs start\n  node scripts/supabase-cli-login.mjs complete <code>");
process.exit(1);