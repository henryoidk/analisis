// Simple Node server to serve static files from ./web
// and expose a stubbed /api/login endpoint.
//
// Optional MSSQL integration:
//  - Set `USE_MSSQL=true` and provide either `SQLSERVER_CONN_STRING`
//    or discrete vars: `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`.
//  - Requires the `mssql` package: `npm i mssql`.
//  - Stored procedure expected: auth.sp_Login(@Username, @Password)

// Cargar variables de entorno
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
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
      console.log('🔐 Intento de login recibido');
      console.log('👤 Usuario:', username);
      
      try {
        console.log('🔌 Intentando conectar a SQL Server...');
        
        // Determinar qué driver usar
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          // Configuración para msnodesqlv8 (Windows Authentication nativa)
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          // Configuración para tedious (driver predeterminado)
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            // SQL Server Authentication
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            // Windows Authentication (NTLM)
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '', // Dejar vacío para autenticación local
                  userName: '', // Usuario actual de Windows
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }
        
        console.log('📝 Configuración:', JSON.stringify({...config, password: config.password ? '***' : undefined}, null, 2));
        
        const pool = await sql.connect(config);
        console.log('✅ Conexión exitosa');
        
        const result = await pool.request()
          .input('Username', sql.NVarChar(50), username)
          .input('Password', sql.NVarChar(128), password)
          .execute('auth.sp_Login');

        await pool.close();
        console.log('🔒 Pool cerrado');

        const record = result && result.recordset && result.recordset[0];
        if (!record) {
          console.log('❌ Credenciales inválidas');
          return send(res, 401, { ok: false, error: 'Credenciales inválidas' });
        }

        console.log('✅ Login exitoso para:', record.Username);
        const user = {
          userId: record.UserId,
          username: record.Username,
          role: record.Rol,
          lastLoginAt: record.LastLoginAt,
        };
        return send(res, 200, { ok: true, user });
      } catch (err) {
        console.error('❌ Error de base de datos:');
        console.error('   Mensaje:', err.message);
        console.error('   Código:', err.code);
        console.error('   Estado SQL:', err.state);
        console.error('   Tipo:', err.name);
        console.error('   Stack:', err.stack);
        
        return send(res, 500, { 
          ok: false, 
          error: 'Error de base de datos', 
          details: err.message || String(err),
          code: err.code,
          sqlState: err.state
        });
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
      try {
        console.log('📊 Solicitando datos del dashboard...');
        
        // Obtener mes del query string (ej: ?month=2025-11)
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const monthParam = urlObj.searchParams.get('month');
        
        // Determinar qué driver usar
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        console.log('🔌 Conectando a SQL Server para dashboard...');
        const pool = await sql.connect(config);
        console.log('✅ Conexión exitosa');

        // Usar mes del parámetro o mes actual
        const now = new Date();
        const yearMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        console.log('📅 Consultando datos para:', yearMonth);

        // Ejecutar SP de dashboard
        const result = await pool.request()
          .input('YearMonth', sql.Char(7), yearMonth)
          .execute('ventas.sp_GetDashboardMetrics');

        console.log('📈 Resultados obtenidos:', {
          totalMensual: result.recordsets[0][0]?.TotalMensualUSD,
          promedio: result.recordsets[1][0]?.PromedioPorVendedorUSD,
          semana: result.recordsets[2][0]?.WeekNo,
          vendedores: result.recordsets[3]?.length
        });

        // Extraer datos de los resultados
        const totalMensual = result.recordsets[0][0]?.TotalMensualUSD || 0;
        const promedioVendedor = result.recordsets[1][0]?.PromedioPorVendedorUSD || 0;
        const weekNo = result.recordsets[2][0]?.WeekNo || 1;
        const performance = result.recordsets[3] || [];

        const payload = {
          period: { 
            month: new Intl.DateTimeFormat('es', { month: 'long' }).format(now).toUpperCase(),
            year: now.getFullYear(),
            week: `S${weekNo}`
          },
          totals: { 
            monthly: totalMensual,
            perSellerAvg: Math.round(promedioVendedor * 100) / 100
          },
          performance: performance.map(p => ({
            name: p.Vendedor,
            s1: p.S1 || 0,
            s2: p.S2 || 0,
            s3: p.S3 || 0,
            s4: p.S4 || 0,
            s5: p.S5 || 0,
            total: p.Total || 0
          }))
        };

        await pool.close();
        console.log('✅ Dashboard data enviado correctamente');
        return send(res, 200, payload);
      } catch (err) {
        console.error('❌ Error en /api/dashboard:', err);
        return send(res, 500, { 
          error: 'Error al obtener datos del dashboard',
          details: err.message || String(err)
        });
      }
    }

    if (req.method === 'GET' && pathname === '/api/vendor-dashboard') {
      try {
        console.log('👤 Solicitando datos del vendedor...');
        
        // Obtener userId y month de query params
        const userId = url.searchParams.get('userId');
        const monthParam = url.searchParams.get('month');
        
        if (!userId) {
          return send(res, 400, { error: 'userId es requerido' });
        }

        // Determinar qué driver usar
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        console.log('🔌 Conectando a SQL Server...');
        const pool = await sql.connect(config);
        console.log('✅ Conexión exitosa');

        // Usar mes del parámetro o mes actual
        const now = new Date();
        const yearMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        console.log('📅 Consultando datos del vendedor userId:', userId, 'para mes:', yearMonth);

        // Ejecutar SP del vendedor
        const result = await pool.request()
          .input('UserID', sql.Int, parseInt(userId))
          .input('YearMonth', sql.Char(7), yearMonth)
          .execute('ventas.sp_GetVendorDashboard');

        // Obtener permiso del usuario
        const permissionResult = await pool.request()
          .input('UserId', sql.Int, parseInt(userId))
          .execute('auth.sp_GetUserPermission');

        console.log('📈 Resultados obtenidos:', {
          totalPersonal: result.recordsets[0][0]?.TotalPersonalUSD,
          semana: result.recordsets[1][0]?.WeekNo,
          semanas: result.recordsets[2]?.length,
          permission: permissionResult.recordset[0]?.Permission
        });

        // Extraer datos
        const totalPersonal = result.recordsets[0][0]?.TotalPersonalUSD || 0;
        const weekNo = result.recordsets[1][0]?.WeekNo || 1;
        const weeksDetail = result.recordsets[2] || [];
        const permission = permissionResult.recordset[0]?.Permission || 'datos_personales';

        const payload = {
          period: { 
            month: new Intl.DateTimeFormat('es', { month: 'long' }).format(now).toUpperCase(),
            year: now.getFullYear(),
            week: `S${weekNo}`
          },
          totals: { 
            personal: totalPersonal
          },
          weeks: weeksDetail.map(w => ({
            week: w.WeekNo,
            amount: w.TotalUSD || 0
          })),
          permission: permission
        };

        await pool.close();
        console.log('✅ Vendor dashboard data enviado correctamente');
        return send(res, 200, payload);
      } catch (err) {
        console.error('❌ Error en /api/vendor-dashboard:', err);
        return send(res, 500, { 
          error: 'Error al obtener datos del vendedor',
          details: err.message || String(err)
        });
      }
    }

    if (req.method === 'GET' && pathname === '/api/vendors-permissions') {
      try {
        console.log('👥 Solicitando lista de vendedores con permisos...');
        
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        const pool = await sql.connect(config);
        const result = await pool.request().execute('auth.sp_GetVendorsWithPermissions');
        
        const vendors = result.recordset.map(v => ({
          userId: v.UserId,
          username: v.Username,
          role: v.Rol,
          permission: v.Permission
        }));

        await pool.close();
        console.log('✅ Vendedores con permisos obtenidos:', vendors.length);
        return send(res, 200, vendors);
      } catch (err) {
        console.error('❌ Error en /api/vendors-permissions:', err);
        return send(res, 500, { 
          error: 'Error al obtener vendedores',
          details: err.message || String(err)
        });
      }
    }

    if (req.method === 'POST' && pathname === '/api/update-permission') {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        
        const { userId, permission } = body;
        if (!userId || !permission) {
          return send(res, 400, { error: 'userId y permission son requeridos' });
        }

        console.log('🔐 Actualizando permiso:', { userId, permission });
        
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        const pool = await sql.connect(config);
        await pool.request()
          .input('UserId', sql.Int, userId)
          .input('PermissionType', sql.NVarChar(50), permission)
          .execute('auth.sp_UpdateUserPermission');

        await pool.close();
        console.log('✅ Permiso actualizado correctamente');
        return send(res, 200, { ok: true });
      } catch (err) {
        console.error('❌ Error en /api/update-permission:', err);
        return send(res, 500, { 
          error: 'Error al actualizar permiso',
          details: err.message || String(err)
        });
      }
    }

    if (req.method === 'GET' && pathname === '/api/months-status') {
      try {
        console.log('📅 Obteniendo estado de todos los meses...');
        
        const year = url.searchParams.get('year') || new Date().getFullYear();
        
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        const pool = await sql.connect(config);
        const result = await pool.request()
          .input('Year', sql.Int, parseInt(year))
          .execute('auth.sp_GetAllMonthsStatus');
        
        const months = result.recordset.map(m => ({
          yearMonth: m.YearMonth,
          isVisible: m.IsVisible
        }));

        await pool.close();
        console.log('✅ Estado de meses obtenido');
        return send(res, 200, months);
      } catch (err) {
        console.error('❌ Error en /api/months-status:', err);
        return send(res, 500, { 
          error: 'Error al obtener estado de meses',
          details: err.message || String(err)
        });
      }
    }

    if (req.method === 'POST' && pathname === '/api/update-month-visibility') {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        
        const { yearMonth, isVisible } = body;
        if (!yearMonth || isVisible === undefined) {
          return send(res, 400, { error: 'yearMonth e isVisible son requeridos' });
        }

        console.log('📅 Actualizando visibilidad de mes:', { yearMonth, isVisible });
        
        const useNativeDriver = String(process.env.SQLSERVER_DRIVER || '').toLowerCase() === 'msnodesqlv8';
        const sql = useNativeDriver ? require('mssql/msnodesqlv8') : require('mssql');
        
        let config;
        if (useNativeDriver) {
          config = {
            server: process.env.DB_SERVER,
            database: process.env.DB_DATABASE,
            driver: 'msnodesqlv8',
            options: {
              trustedConnection: true,
              trustServerCertificate: true,
              encrypt: false
            }
          };
        } else {
          if (process.env.DB_USER && process.env.DB_PASSWORD) {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          } else {
            config = {
              server: process.env.DB_SERVER,
              database: process.env.DB_DATABASE,
              authentication: {
                type: 'ntlm',
                options: {
                  domain: '',
                  userName: '',
                  password: ''
                }
              },
              options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
              }
            };
          }
        }

        const pool = await sql.connect(config);
        await pool.request()
          .input('YearMonth', sql.Char(7), yearMonth)
          .input('IsVisible', sql.Bit, isVisible)
          .execute('auth.sp_UpdateMonthVisibility');

        await pool.close();
        console.log('✅ Visibilidad de mes actualizada correctamente');
        return send(res, 200, { ok: true });
      } catch (err) {
        console.error('❌ Error en /api/update-month-visibility:', err);
        return send(res, 500, { 
          error: 'Error al actualizar visibilidad del mes',
          details: err.message || String(err)
        });
      }
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
  console.log('');
  console.log('🚀 Servidor escuchando en http://localhost:' + PORT);
  console.log('📁 Sirviendo archivos desde:', STATIC_DIR);
  console.log('');
  console.log('🔧 Configuración:');
  console.log('   USE_MSSQL:', process.env.USE_MSSQL);
  console.log('   SQLSERVER_DRIVER:', process.env.SQLSERVER_DRIVER);
  console.log('   DB_SERVER:', process.env.DB_SERVER);
  console.log('   DB_DATABASE:', process.env.DB_DATABASE);
  console.log('');
  
  // Verificar si el driver de SQL Server está disponible
  if (String(process.env.USE_MSSQL || '').toLowerCase() === 'true') {
    try {
      require('mssql/msnodesqlv8');
      console.log('✅ Driver msnodesqlv8 disponible');
    } catch (e) {
      console.error('❌ Driver msnodesqlv8 NO disponible');
      console.error('   Ejecuta: npm install mssql msnodesqlv8');
    }
  }
  console.log('');
});
