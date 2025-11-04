// Simple Node server to serve static files from ./web
// and expose a stubbed /api/login endpoint.
//
// Optional MSSQL integration:
//  - Set `USE_MSSQL=true` and provide either `SQLSERVER_CONN_STRING`
//    or discrete vars: `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`.
//  - Requires the `mssql` package: `npm i mssql`.
//  - Stored procedure expected: auth.sp_Login(@Username, @Password)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const STATIC_DIR = path.join(ROOT, 'web');

// In-memory mock state for periods (initialize to current month)
const now = new Date();
const currentYM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2,'0')}`;
const periodsState = {
  allowed: [currentYM],
  default: currentYM,
  weeks: {}
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body)
    ? body
    : JSON.stringify(body);
  const baseHeaders = typeof body === 'string' || Buffer.isBuffer(body)
    ? { 'Content-Length': Buffer.byteLength(data) }
    : { 'Content-Type': 'application/json; charset=utf-8' };
  res.writeHead(status, { ...baseHeaders, ...headers });
  res.end(data);
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

async function handleLogin(req, res) {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    let payload;
    try {
      payload = JSON.parse(raw || '{}');
    } catch (e) {
      return send(res, 400, { ok: false, error: 'JSON inválido' });
    }

    const { username, password } = payload;
    if (!username || !password) {
      return send(res, 400, { ok: false, error: 'Faltan credenciales' });
    }

    const useMssql = String(process.env.USE_MSSQL || '').toLowerCase() === 'true';

    if (useMssql) {
      try {
        // Lazy require to keep server working without dependency
        const useMsV8 = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useMsV8 ? require('mssql/msnodesqlv8') : require('mssql');
        const connString = process.env.SQLSERVER_CONN_STRING;
        const config = connString
          ? connString
          : (useMsV8
              ? {
                  server: process.env.DB_SERVER,
                  database: process.env.DB_DATABASE,
                  driver: 'msnodesqlv8',
                  options: { trustedConnection: true },
                }
              : {
                  server: process.env.DB_SERVER,
                  user: process.env.DB_USER,
                  password: process.env.DB_PASSWORD,
                  database: process.env.DB_DATABASE,
                  options: { trustServerCertificate: true },
                }
            );

        const pool = await sql.connect(config);
        const result = await pool.request()
          .input('Username', sql.NVarChar(50), username)
          .input('Password', sql.NVarChar(128), password)
          .execute('auth.sp_Login');

        const record = result && result.recordset && result.recordset[0];
        if (!record) {
          return send(res, 401, { ok: false, error: 'Credenciales inválidas' });
        }

        const user = {
          id: record.UserId,
          username: record.Username,
          role: record.Rol,
          lastLoginAt: record.LastLoginAt,
        };
        return send(res, 200, { ok: true, user });
      } catch (err) {
        // If MSSQL fails, surface a clear error
        return send(res, 500, { ok: false, error: 'Error de base de datos', details: String(err && err.message || err) });
      }
    }

    // Fallback: in-memory mock for quick testing
    // Matches users created by sql/auth_setup.sql
    const MOCK_USERS = {
      henryoo: { password: 'Admin*2025!', role: 'Administrador' },
      harold: { password: 'Venta*2025!', role: 'Vendedor' },
    };
    const found = MOCK_USERS[username];
    if (!found || found.password !== password) {
      return send(res, 401, { ok: false, error: 'Credenciales inválidas (mock)' });
    }
    return send(res, 200, {
      ok: true,
      user: {
        username,
        role: found.role,
        lastLoginAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'Error interno', details: String(e && e.message || e) });
  }
}

function safeJoin(base, targetPath) {
  const resolvedPath = path.resolve(base, '.' + targetPath);
  if (!resolvedPath.startsWith(path.resolve(base))) return null; // prevent path traversal
  return resolvedPath;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      // Mock dashboard payload
      const payload = {
        period: { month: 'Octubre', year: 2025, week: 'S4' },
        totals: { monthly: 160000, perSellerAvg: 11200 },
        performance: [
          { seller: 'Ana Pérez',  s1: 12000, s2: 14000, s3: 10000, s4: 15000, total: 51000, meta: 1.02 },
          { seller: 'Juan Gómez', s1: 10000, s2: 11000, s3:  9000, s4: 12000, total: 42000, meta: 1.05 },
          { seller: 'Luis Soto',  s1:  8000, s2:  9000, s3:  8000, s4: 10000, total: 35000, meta: 0.95 },
        ],
      };
      return send(res, 200, payload);
    }

    if (req.method === 'GET' && pathname === '/api/periods') {
      return send(res, 200, periodsState);
    }
    if (req.method === 'POST' && pathname === '/api/periods') {
      const chunks=[]; for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
      periodsState.allowed = Array.isArray(body.allowed) ? body.allowed : periodsState.allowed;
      if (body.default) periodsState.default = body.default;
      return send(res, 200, { ok:true, state: periodsState });
    }
    if (req.method === 'POST' && pathname.match(/^\/api\/periods\/\d{4}-\d{2}\/weeks$/)) {
      const ym = pathname.split('/')[3];
      const chunks=[]; for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
      if (Array.isArray(body.weeks)) periodsState.weeks[ym] = body.weeks;
      return send(res, 200, { ok:true });
    }

    if (req.method === 'GET' && pathname === '/api/sellers') {
      const sellers = ['Ana Pérez','Juan Gómez','Luis Soto'];
      return send(res, 200, sellers);
    }

    if (req.method === 'GET' && pathname === '/api/users') {
      const users = [
        { id: 1, username: 'henryoo', role: 'Administrador', active: true,  visibility: 'todos' },
        { id: 2, username: 'harold',  role: 'Vendedor',      active: true,  visibility: 'personal' },
        { id: 3, username: 'luis',    role: 'Vendedor',      active: false, visibility: 'personal' },
      ];
      return send(res, 200, users);
    }

    if (req.method === 'POST' && pathname.match(/^\/api\/users\/(\d+)\/active$/)) {
      // Mock: accept and echo
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname.match(/^\/api\/users\/(\d+)\/visibility$/)) {
      // Mock: accept and echo
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      return handleLogin(req, res);
    }

    // Static files
    let filePath;
    if (pathname === '/' || pathname === '') {
      filePath = path.join(STATIC_DIR, 'login.html');
    } else {
      const joined = safeJoin(STATIC_DIR, pathname);
      filePath = joined || path.join(STATIC_DIR, 'login.html');
    }

    // If path resolves to a directory, try index.html or fallback to login.html
    let stat;
    try { stat = fs.statSync(filePath); } catch (_) {}
    if (stat && stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath)) filePath = indexPath; else filePath = path.join(STATIC_DIR, 'login.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (pathname !== '/' && pathname !== '/login.html') {
          // Try fallback to login.html for unknown routes
          fs.readFile(path.join(STATIC_DIR, 'login.html'), (err2, data2) => {
            if (err2) return send(res, 404, 'Not Found');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data2);
          });
        } else {
          return send(res, 404, 'Not Found');
        }
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: 'Error del servidor', details: String(e && e.message || e) });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
