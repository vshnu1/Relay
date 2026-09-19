// Point the app at a different Relay server.
//
//   node scripts/set-host.mjs                     -> http://localhost:3001 (simulator)
//   node scripts/set-host.mjs 192.168.1.20:3001   -> a Mac on the same Wi-Fi (real iPhone)
//   node scripts/set-host.mjs https://relay.example.com
//
// The simulator shares the Mac's localhost; a real device does not, which is
// the only reason this exists. Run `npm run ios` afterwards: the URL is baked
// into the app at build time.
import { readFileSync, writeFileSync } from "node:fs";

const CONFIG = new URL("../capacitor.config.json", import.meta.url);
const input = process.argv[2] || "localhost:3001";
const origin = /^https?:\/\//.test(input) ? input : `http://${input}`;

const config = JSON.parse(readFileSync(CONFIG, "utf8"));
// The fragment is what makes a launch open the patient's own record rather than
// the landing page; chrome.js enforces it too, for a relaunch after a redirect.
config.server.url = `${origin.replace(/\/$/, "")}/#/patient`;
writeFileSync(CONFIG, JSON.stringify(config, null, 2) + "\n");

console.log(`server.url = ${config.server.url}`);
if (origin.startsWith("http://") && !/localhost|127\.0\.0\.1|\.local|^http:\/\/\d+\.\d+\.\d+\.\d+/.test(origin))
  console.warn(
    "Warning: plain HTTP to a non-local host is blocked by App Transport Security.\n" +
      "Info.plist allows local networking only. Use https for anything else.",
  );
