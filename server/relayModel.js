import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const serverDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(serverDir, "..");

/**
 * Run the versioned Relay CLI without coupling the API to its Python
 * implementation. The caller can fall back to shared/engine.js when the
 * optional runtime is not installed or returns an invalid response.
 */
export function scoreWithRelay(
  {
    events,
    context = null,
    program = "post_abdominal_surgery",
    patientId,
    analyzedThrough,
  },
  { timeoutMs = 30_000 } = {},
) {
  const request = JSON.stringify({
    events,
    context,
    program,
    ...(patientId ? { patient_id: patientId } : {}),
    ...(analyzedThrough ? { analyzedThrough } : {}),
  });

  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.env.PYTHON_BIN || "python3",
      ["-m", "relay_ml", "score", "--compact"],
      {
        cwd: root,
        env: {
          ...process.env,
          PYTHONPATH: [resolve(root, "ml"), process.env.PYTHONPATH]
            .filter(Boolean)
            .join(":"),
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(reject, new Error("Relay scoring timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 5_000_000) {
        child.kill("SIGTERM");
        finish(reject, new Error("Relay scoring returned too much data."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });
    child.once("error", (error) => finish(reject, error));
    child.once("close", (code) => {
      if (code !== 0)
        return finish(
          reject,
          new Error(`Relay scoring exited with code ${code}: ${stderr.trim()}`),
        );
      try {
        const result = JSON.parse(stdout);
        if (
          !result ||
          typeof result !== "object" ||
          !Array.isArray(result.signals)
        )
          throw new Error("Relay response is missing signals.");
        finish(resolveResult, result);
      } catch (error) {
        finish(reject, new Error(`Invalid Relay response: ${error.message}`));
      }
    });
    child.stdin.end(request);
  });
}
