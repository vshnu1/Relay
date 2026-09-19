// Runs the Health export scan off the main thread so a 300 MB file cannot freeze the app.
import { importHealthFile } from "./healthImport.js";

self.onmessage = async (e) => {
  try {
    const result = await importHealthFile(e.data.file, (p) =>
      self.postMessage({ type: "progress", value: p }),
    );
    self.postMessage({ type: "done", ...result });
  } catch (err) {
    self.postMessage({ type: "error", message: err.message || String(err) });
  }
};
