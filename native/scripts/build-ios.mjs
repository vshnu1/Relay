// Build the app for the booted simulator, install it, and launch it.
//
// `cap run ios` wants to pick a device interactively; this does the same three
// steps without asking, so a rebuild during a demo is one command.
import { execFileSync } from "node:child_process";

const DEVICE = process.env.RELAY_SIM || "iPhone 17 Pro";
const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: "inherit", cwd: new URL("../ios/App", import.meta.url).pathname });

run("xcodebuild", [
  "-project", "App.xcodeproj",
  "-scheme", "App",
  "-configuration", "Debug",
  "-sdk", "iphonesimulator",
  "-destination", `platform=iOS Simulator,name=${DEVICE}`,
  "-derivedDataPath", "build",
  "CODE_SIGNING_ALLOWED=NO",
  "-quiet",
]);

const app = "build/Build/Products/Debug-iphonesimulator/App.app";
try {
  run("xcrun", ["simctl", "terminate", "booted", "health.relay.patient"]);
} catch {
  // not running; nothing to terminate
}
run("xcrun", ["simctl", "install", "booted", app]);
run("xcrun", ["simctl", "launch", "booted", "health.relay.patient"]);
