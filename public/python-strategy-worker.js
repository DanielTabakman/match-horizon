const OUTPUT_LIMIT = 256 * 1024;
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs";

let pyodidePromise = null;

self.onmessage = async (event) => {
  if (event.data?.type !== "run") {
    return;
  }

  const startedAt = performance.now();
  let stdout = "";
  let stderr = "";

  try {
    const pyodide = await getPyodide();
    blockRuntimeNetwork();
    pyodide.setStdout({ batched: (text) => { stdout = appendBounded(stdout, text); } });
    pyodide.setStderr({ batched: (text) => { stderr = appendBounded(stderr, text); } });
    self.postMessage({ type: "started", runtimeVersion: pyodide.version });
    pyodide.globals.set("__match_horizon_context", event.data.context);
    pyodide.runPython(event.data.source);
    const resultJson = pyodide.runPython(`
import json
if "evaluate" not in globals() or not callable(evaluate):
    raise Exception("Python strategy must define evaluate(context).")
__match_horizon_result = evaluate(__match_horizon_context)
json.dumps(__match_horizon_result)
`);
    const resultText = String(resultJson);
    if (byteLength(resultText) + byteLength(stdout) + byteLength(stderr) > OUTPUT_LIMIT) {
      throw new Error("Python stdout, stderr, and result exceeded the 256 KB combined output limit.");
    }
    self.postMessage({
      type: "success",
      result: JSON.parse(resultText),
      stdout,
      stderr,
      elapsedMs: Math.round(performance.now() - startedAt),
      runtimeVersion: pyodide.version,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
      stdout,
      stderr,
      elapsedMs: Math.round(performance.now() - startedAt),
      runtimeVersion: null,
    });
  }
};

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = import(PYODIDE_URL).then(({ loadPyodide }) => loadPyodide());
  }
  return pyodidePromise;
}

function blockRuntimeNetwork() {
  const blocked = () => {
    throw new Error("Network APIs are not available inside trusted local strategy runs.");
  };
  self.fetch = blocked;
  self.XMLHttpRequest = undefined;
  self.WebSocket = undefined;
  self.EventSource = undefined;
}

function appendBounded(current, next) {
  const combined = `${current}${next}`;
  return byteLength(combined) > OUTPUT_LIMIT ? combined.slice(0, OUTPUT_LIMIT) : combined;
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}
