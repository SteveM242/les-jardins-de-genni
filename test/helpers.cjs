const http = require("node:http");

// Remplace db.cjs par un faux : permet de tester les routes sans Postgres.
// À appeler AVANT de require app.cjs / les routes.
function installFakeDb(handler) {
  const dbPath = require.resolve("../db.cjs");
  const client = { query: async (text, params) => handler(text, params) };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      pool: {},
      query: async (text, params) => handler(text, params),
      withTransaction: async (fn) => fn(client)
    }
  };
}

async function startApp() {
  const { createApp } = require("../app.cjs");
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, cookie, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        // FormData : fetch pose lui-même le Content-Type multipart avec sa frontière.
        ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers
      },
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* réponse non JSON */
    }
    return { status: res.status, headers: res.headers, json, text };
  }

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { installFakeDb, startApp };
