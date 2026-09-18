import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFlowYAML } from "../parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CODEX_FLOW_STUDIO_PORT) || 3210;

export function startStudio(options?: { port?: number; initialFile?: string }) {
  const port = options?.port ?? PORT;
  let currentFile = options?.initialFile ?? "";
  let currentYAML = "";
  if (currentFile && existsSync(currentFile)) {
    currentYAML = readFileSync(currentFile, "utf-8");
  }

  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      const htmlPath = resolve(__dirname, "studio.html");
      const html = readFileSync(htmlPath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else if (req.method === "GET" && req.url === "/api/flow") {
      res.writeHead(200, { "Content-Type": "application/json" });
      if (currentYAML) {
        try {
          const { flow } = parseFlowYAML(currentYAML);
          res.end(JSON.stringify({ file: currentFile, yaml: currentYAML, flow }));
        } catch (err) {
          res.end(JSON.stringify({ file: currentFile, yaml: currentYAML, error: (err as Error).message }));
        }
      } else {
        res.end(JSON.stringify({ file: "", yaml: "", flow: null }));
      }
    } else if (req.method === "POST" && req.url === "/api/flow") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.yaml) currentYAML = data.yaml;
          if (data.file) currentFile = data.file;
          if (data.save && currentFile && currentYAML) {
            writeFileSync(resolve(currentFile), currentYAML);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, saved: data.save && !!currentFile }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
        }
      });
    } else if (req.method === "POST" && req.url === "/api/load") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          const filePath = resolve(data.path);
          if (!existsSync(filePath)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "File not found" }));
            return;
          }
          currentYAML = readFileSync(filePath, "utf-8");
          currentFile = filePath;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, file: currentFile }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise<number>((resolveP) => {
    server.listen(port, () => {
      console.log(`\n🎨 Codex Flow Studio`);
      console.log(`   ➜  Local:   http://localhost:${port}`);
      console.log(`   ➜  API:     http://localhost:${port}/api/flow`);
      console.log(`\n   Press Ctrl+C to stop.\n`);
      resolveP(port);
    });
  });
}
