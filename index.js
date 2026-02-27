/**
 * FCA Register API — Proxy Server for Render.com
 * =================================================
 * DEPLOY INSTRUCTIONS (free, ~5 minutes):
 * ----------------------------------------
 * 1. Go to https://github.com and create a free account if you don't have one
 * 2. Click the "+" icon top right → "New repository"
 * 3. Name it "fca-proxy", make it Public, click "Create repository"
 * 4. Click "Add file" → "Create new file"
 * 5. Name the file "index.js" and paste this entire file as the content
 * 6. Click "Commit changes"
 * 7. Create another file called "package.json" and paste the contents below:
 *    (see package.json file provided separately)
 * 8. Go to https://render.com and sign up with your GitHub account (free)
 * 9. Click "New" → "Web Service"
 * 10. Connect your GitHub repo "fca-proxy"
 * 11. Settings: Name = fca-proxy, Runtime = Node, Build = "npm install", Start = "node index.js"
 * 12. Click "Create Web Service" — it'll deploy in ~2 minutes
 * 13. Copy the URL shown (e.g. https://fca-proxy.onrender.com)
 * 14. Paste that into the FCA Monitor setup panel as your Proxy URL
 */

const https = require('https');
const http = require('http');
const url = require('url');

const FCA_BASE = 'register.fca.org.uk';
const PORT = process.env.PORT || 3000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Auth-Email, X-Auth-Key, Content-Type',
};

const server = http.createServer((req, res) => {

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Only GET requests supported' }));
    return;
  }

  const parsed = url.parse(req.url, true);
  const fcaPath = parsed.query.path;

  if (!fcaPath || !fcaPath.startsWith('/')) {
    res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Missing or invalid ?path= parameter. Example: ?path=/Firm/122702/Individuals' }));
    return;
  }

  const authEmail = req.headers['x-auth-email'] || '';
  const authKey   = req.headers['x-auth-key']   || '';

  if (!authEmail || !authKey) {
    res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Missing X-Auth-Email or X-Auth-Key headers' }));
    return;
  }

  const options = {
    hostname: FCA_BASE,
    path: '/services/V0.1' + fcaPath,
    method: 'GET',
    headers: {
      'X-Auth-Email':    authEmail,
      'X-Auth-Key':      authKey,
      'Accept':          'application/json',
      'Accept-Language': 'en-GB,en;q=0.9',
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  };

  const fcaReq = https.request(options, (fcaRes) => {
    let body = '';
    fcaRes.on('data', chunk => body += chunk);
    fcaRes.on('end', () => {
      if (body.includes('Just a moment') || body.trimStart().startsWith('<!DOCTYPE')) {
        res.writeHead(503, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ error: 'FCA API blocked the request. Please try again in a moment.' }));
        return;
      }
      res.writeHead(fcaRes.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(body);
    });
  });

  fcaReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ error: 'Failed to reach FCA API', detail: err.message }));
  });

  fcaReq.end();
});

server.listen(PORT, () => {
  console.log(`FCA Proxy running on port ${PORT}`);
});
