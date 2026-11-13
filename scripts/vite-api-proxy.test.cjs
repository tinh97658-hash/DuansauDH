const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('development API proxy forwards paths, session cookies and client origin for distinct hosts', async () => {
  const { createServer } = await import(pathToFileURL(path.resolve(__dirname, '../frontend/node_modules/vite/dist/node/index.js')));
  const upstream = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', 'pgsms.sid=test; HttpOnly; SameSite=Lax; Path=/');
    res.end(JSON.stringify({ path: req.url, cookie: req.headers.cookie, origin: req.headers.origin }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const previous = process.env.API_PROXY_TARGET;
  process.env.API_PROXY_TARGET = `http://127.0.0.1:${upstream.address().port}`;
  let vite;
  try {
    vite = await createServer({ root: path.resolve(__dirname, '../frontend'), server: { port: 0, host: '127.0.0.1' } });
    await vite.listen();
    for (const host of ['localhost', '192.0.2.10']) {
      const origin = `http://${host}:3100`;
      const result = await fetch(`http://127.0.0.1:${vite.httpServer.address().port}/api/notifications?page=2`, {
        headers: { Host: `${host}:3100`, Origin: origin, Cookie: 'pgsms.sid=existing' },
      });
      assert.equal(result.status, 200);
      assert.match(result.headers.get('set-cookie'), /pgsms.sid=test/);
      assert.deepEqual(await result.json(), { path: '/notifications?page=2', cookie: 'pgsms.sid=existing', origin });
    }
  } finally {
    await vite?.close();
    await new Promise(resolve => upstream.close(resolve));
    if (previous === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = previous;
  }
});
