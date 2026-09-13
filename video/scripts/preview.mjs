import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(import.meta.dirname, "../out");
const allowed = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/rectify-demo.mp4", ["rectify-demo.mp4", "video/mp4"]],
  ["/captions.vtt", ["captions.vtt", "text/vtt; charset=utf-8"]],
  ["/poster.jpg", ["poster.jpg", "image/jpeg"]],
]);
createServer((request, response) => {
  const entry = allowed.get(new URL(request.url || "/", "http://127.0.0.1").pathname);
  if (!entry) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const [name, type] = entry;
    const path = resolve(directory, name);
    const size = statSync(path).size;
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      response.writeHead(416);
      response.end();
      return;
    }
    response.writeHead(match ? 206 : 200, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-length": end - start + 1,
      ...(match ? { "content-range": `bytes ${start}-${end}/${size}` } : {}),
    });
    createReadStream(path, { start, end }).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not generated yet");
  }
}).listen(3490, "127.0.0.1", () => process.stdout.write("Preview: http://127.0.0.1:3490\n"));
