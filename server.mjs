import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { handleAiInterventionRequest } from "./lib/ai-intervention.mjs";
import { handleOracleReferenceRequest } from "./lib/oracle-reference.mjs";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 8080);
const host = "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function loadLocalEnv() {
  const envPath = join(root, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

function resolvePath(url) {
  const requested = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const filePath = normalize(join(root, requested === "/" ? "index.html" : requested));
  return filePath.startsWith(root) ? filePath : null;
}

createServer((request, response) => {
  const pathname = new URL(request.url, `http://${host}:${port}`).pathname;

  if (pathname === "/api/oracle-reference") {
    handleOracleReferenceRequest(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      }
      response.end(JSON.stringify({ success: false, message: "Ralat tidak dijangka." }));
    });
    return;
  }

  if (pathname === "/api/ai-intervention-suggestion") {
    handleAiInterventionRequest(request, response).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      }
      response.end(JSON.stringify({ success: false, message: "Cadangan AI belum dapat dijana." }));
    });
    return;
  }

  const filePath = resolvePath(request.url);

  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`MySPMCare Serian running at http://${host}:${port}`);
});
