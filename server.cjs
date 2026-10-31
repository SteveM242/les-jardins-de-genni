const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    filePath = path.join(distDir, "index.html");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(distDir, "index.html"), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(500);
          res.end("Internal server error");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Les Jardins de Genni — server listening on port ${port}`);
});
