'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const projectRoot = __dirname;
const publicRoot = path.join(projectRoot, 'My_Map');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

loadEnv(path.join(projectRoot, '.env'));

const host = process.env.APP_HOST || '127.0.0.1';
const port = numberFromEnv('APP_PORT', 8000);
const browserConfig = {
  map: {
    centerLat: numberFromEnv('MAP_CENTER_LAT', 21.028),
    centerLon: numberFromEnv('MAP_CENTER_LON', 105.83),
    defaultZoom: numberFromEnv('MAP_DEFAULT_ZOOM', 12),
    maxZoom: numberFromEnv('MAP_MAX_ZOOM', 19),
    minLat: numberFromEnv('MAP_MIN_LAT', 20.98),
    maxLat: numberFromEnv('MAP_MAX_LAT', 21.075),
    minLon: numberFromEnv('MAP_MIN_LON', 105.77),
    maxLon: numberFromEnv('MAP_MAX_LON', 105.89),
    tileUrl: process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: process.env.MAP_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors',
    dataUrl: process.env.MAP_DATA_URL || 'map_data.json'
  },
  geocoding: {
    enabled: booleanFromEnv('GEOCODING_ENABLED', true),
    url: process.env.GEOCODING_URL || 'https://nominatim.openstreetmap.org/search',
    limit: numberFromEnv('GEOCODING_LIMIT', 5),
    language: process.env.GEOCODING_LANGUAGE || 'vi',
    debounceMs: numberFromEnv('GEOCODING_DEBOUNCE_MS', 1000)
  }
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function send(response, statusCode, contentType, body, method) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': statusCode === 200 ? 'no-cache' : 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(method === 'HEAD' ? undefined : body);
}

const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    send(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', request.method);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  } catch {
    send(response, 400, 'text/plain; charset=utf-8', 'Bad Request', request.method);
    return;
  }

  if (pathname === '/config.js') {
    const body = `window.APP_CONFIG = Object.freeze(${JSON.stringify(browserConfig)});`;
    send(response, 200, mimeTypes['.js'], body, request.method);
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(publicRoot, relativePath);
  const publicPrefix = `${path.resolve(publicRoot)}${path.sep}`;
  if (filePath !== path.join(publicRoot, 'index.html') && !filePath.startsWith(publicPrefix)) {
    send(response, 403, 'text/plain; charset=utf-8', 'Forbidden', request.method);
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, 'text/plain; charset=utf-8', 'Not Found', request.method);
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on('error', (error) => {
  console.error(`Không thể khởi động server: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`A* Map đang chạy tại http://${host}:${port}`);
});
