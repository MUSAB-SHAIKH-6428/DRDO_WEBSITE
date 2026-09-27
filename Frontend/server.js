/**
 * RAC Defence Tech Frontend Proxy
 * Transparent reverse proxy forwarding all /api requests to the real Python RAG Backend at http://127.0.0.1:5000.
 * All mock data, simulated questions, fake scoring, and fake candidate profiles have been removed.
 */

import http from 'http';

const PROXY_PORT = process.env.PORT || 5001;
const PYTHON_BACKEND_PORT = 5000;

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: PYTHON_BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${PYTHON_BACKEND_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      error: 'Python RAG backend is not running on port 5000. Please start it using: python server.py',
      details: err.message,
    }));
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, () => {
  console.log(`[DRDO RAC PROXY] Forwarding requests from port ${PROXY_PORT} -> Python RAG backend (http://127.0.0.1:${PYTHON_BACKEND_PORT})`);
});
