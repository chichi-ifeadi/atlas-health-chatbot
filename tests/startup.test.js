const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  buildListenFailureResult,
  probeAtlasHealth,
} = require('../startup-utils');

test('buildListenFailureResult treats an occupied Atlas port as a clean outcome', () => {
  const result = buildListenFailureResult({ code: 'EADDRINUSE' }, 3000, true);

  assert.deepEqual(result, {
    exitCode: 0,
    level: 'log',
    message: 'Atlas is already running at http://localhost:3000',
  });
});

test('probeAtlasHealth returns true when a local health endpoint identifies Atlas', async (t) => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'atlas' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const result = await probeAtlasHealth(port);
  assert.equal(result, true);
});
