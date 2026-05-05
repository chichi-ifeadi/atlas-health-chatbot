const http = require('node:http');

function buildListenFailureResult(error, port, atlasAlreadyRunning) {
  if (error?.code === 'EADDRINUSE') {
    if (atlasAlreadyRunning) {
      return {
        exitCode: 0,
        level: 'log',
        message: `Atlas is already running at http://localhost:${port}`,
      };
    }

    return {
      exitCode: 1,
      level: 'error',
      message: `Port ${port} is already in use. Stop the existing process or set PORT to a different value.`,
    };
  }

  return {
    exitCode: 1,
    level: 'error',
    message: `Atlas failed to start: ${error?.message || String(error)}`,
  };
}

function probeAtlasHealth(port) {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        timeout: 1500,
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk.toString();
        });

        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve(false);
            return;
          }

          try {
            const payload = JSON.parse(body);
            resolve(payload?.status === 'ok' && payload?.app === 'atlas');
          } catch {
            resolve(false);
          }
        });
      }
    );

    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
}

module.exports = {
  buildListenFailureResult,
  probeAtlasHealth,
};
