import Papa from "papaparse";
import { runPipeline } from "../firmsClusterEngine.js";

self.onmessage = (ev) => {
  try {
    const { csvText } = ev.data;
    const t0 = performance.now();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    const clusters = runPipeline(parsed.data || []);
    const ms = performance.now() - t0;
    postMessage({ ok: true, clusters, ms });
  } catch (err) {
    postMessage({ ok: false, error: String(err?.message || err) });
  }
};
