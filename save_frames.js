import http from 'http';
import fs from 'fs';
import path from 'path';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const name = url.searchParams.get('name');
    if (!name) {
      res.writeHead(400);
      res.end('Missing name');
      return;
    }

    const filePath = path.join('public/webp', name);
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    req.on('end', () => {
      console.log(`Saved: ${name}`);
      res.writeHead(200);
      res.end('OK');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(9999, () => {
  console.log('Server listening on port 9999');
});
