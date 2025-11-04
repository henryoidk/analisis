/**
 * Script de diagnóstico mejorado para SQL Server
 * Ejecutar con: node test-connection-mejorado.js
 */

require('dotenv').config();

async function testConnection() {
  console.log('=== DIAGNÓSTICO DE CONEXIÓN SQL SERVER ===\n');

  // 1. Verificar variables de entorno
  console.log('1. Variables de entorno:');
  console.log('   PORT:', process.env.PORT || 'NO DEFINIDO');
  console.log('   USE_MSSQL:', process.env.USE_MSSQL || 'NO DEFINIDO');
  console.log('   SQLSERVER_DRIVER:', process.env.SQLSERVER_DRIVER || 'NO DEFINIDO');
  console.log('   SQLSERVER_CONN_STRING:', process.env.SQLSERVER_CONN_STRING || 'NO DEFINIDO');
  console.log('   DB_DATABASE:', process.env.DB_DATABASE || 'NO DEFINIDO');
  console.log('');

  // 2. Verificar módulos instalados
  console.log('2. Verificando módulos requeridos:');
  try {
    require('mssql');
    console.log('   ✓ mssql instalado');
  } catch (e) {
    console.log('   ✗ mssql NO instalado');
    console.log('   Ejecuta: npm install mssql');
  }

  try {
    require('mssql/msnodesqlv8');
    console.log('   ✓ msnodesqlv8 instalado');
  } catch (e) {
    console.log('   ✗ msnodesqlv8 NO instalado');
    console.log('   Ejecuta: npm install msnodesqlv8');
  }

  try {
    require('dotenv');
    console.log('   ✓ dotenv instalado');
  } catch (e) {
    console.log('   ✗ dotenv NO instalado');
  }
  console.log('');

  // 3. Probar conexión
  if (String(process.env.USE_MSSQL).toLowerCase() !== 'true') {
    console.log('❌ USE_MSSQL no está en "true". Actualiza tu .env');
    return;
  }

  console.log('3. Intentando conectar a SQL Server...');
  console.log('   Connection String:', process.env.SQLSERVER_CONN_STRING);
  console.log('');

  try {
    const sql = require('mssql/msnodesqlv8');
    const config = process.env.SQLSERVER_CONN_STRING;

    console.log('   Iniciando conexión...');
    const pool = await sql.connect(config);
    console.log('   ✓ CONEXIÓN EXITOSA');
    console.log('');

    // 4. Probar consulta simple
    console.log('4. Probando consulta simple...');
    const result = await pool.request().query('SELECT DB_NAME() AS DatabaseName, @@VERSION AS SQLVersion');
    console.log('   Base de datos:', result.recordset[0].DatabaseName);
    console.log('   Versión SQL Server:', result.recordset[0].SQLVersion.split('\n')[0]);
    console.log('');

    // 5. Verificar tablas
    console.log('5. Verificando estructura de base de datos...');
    const tables = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS table_name
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name IN ('auth', 'ventas')
      ORDER BY s.name, t.name
    `);
    
    if (tables.recordset.length > 0) {
      console.log('   Tablas encontradas:');
      tables.recordset.forEach(t => {
        console.log(`   - ${t.schema_name}.${t.table_name}`);
      });
    } else {
      console.log('   ⚠️ No se encontraron tablas en esquemas auth/ventas');
      console.log('   Ejecuta el script ModuloAnalisis.sql primero');
    }
    console.log('');

    // 6. Verificar procedimientos almacenados
    console.log('6. Verificando procedimientos almacenados...');
    const procs = await pool.request().query(`
      SELECT s.name + '.' + p.name AS procedure_name
      FROM sys.procedures p
      JOIN sys.schemas s ON p.schema_id = s.schema_id
      WHERE s.name IN ('auth', 'ventas')
      AND p.name IN ('sp_Login', 'sp_GetDashboardMetrics')
      ORDER BY s.name, p.name
    `);
    
    if (procs.recordset.length > 0) {
      console.log('   Procedimientos encontrados:');
      procs.recordset.forEach(p => {
        console.log(`   - ${p.procedure_name}`);
      });
    } else {
      console.log('   ⚠️ No se encontraron los procedimientos necesarios');
      console.log('   Ejecuta el script ModuloAnalisis.sql');
    }
    console.log('');

    // 7. Verificar usuarios
    console.log('7. Verificando usuarios en base de datos...');
    const users = await pool.request().query(`
      SELECT u.Username, r.Name AS Role, u.IsActive
      FROM auth.Usuarios u
      JOIN auth.Roles r ON u.RoleId = r.RoleId
    `);
    
    if (users.recordset.length > 0) {
      console.log('   Usuarios encontrados:');
      users.recordset.forEach(u => {
        console.log(`   - ${u.Username} (${u.Role}) - ${u.IsActive ? 'Activo' : 'Inactivo'}`);
      });
    } else {
      console.log('   ⚠️ No hay usuarios en la base de datos');
    }
    console.log('');

    // 8. Probar login con usuario de prueba
    console.log('8. Probando procedimiento de login...');
    console.log('   Usuario: henryoo');
    console.log('   Contraseña: Admin*2025!');
    
    try {
      const loginResult = await pool.request()
        .input('Username', sql.NVarChar(50), 'henryoo')
        .input('Password', sql.NVarChar(128), 'Admin*2025!')
        .execute('auth.sp_Login');

      if (loginResult.recordset && loginResult.recordset.length > 0) {
        console.log('   ✓ LOGIN EXITOSO');
        console.log('   Datos:', loginResult.recordset[0]);
      }
    } catch (err) {
      console.log('   ✗ ERROR EN LOGIN:');
      console.log('   Mensaje:', err.message);
      console.log('   Tipo:', err.name);
      if (err.originalError) {
        console.log('   Error original:', err.originalError.message);
      }
    }

    await pool.close();
    console.log('\n=== DIAGNÓSTICO COMPLETADO ===');

  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN DETALLADO:');
    console.error('   Tipo de error:', err.constructor.name);
    console.error('   Mensaje:', err.message);
    
    // Intentar obtener más detalles del error
    if (err.originalError) {
      console.error('   Error original:', err.originalError);
      console.error('   Mensaje original:', err.originalError.message);
    }
    
    console.error('   Código:', err.code || 'Sin código');
    console.error('   Estado SQL:', err.state || 'Sin estado');
    console.error('   Número:', err.number || 'Sin número');
    console.error('');
    console.error('Propiedades del error:', Object.keys(err));
    console.error('');
    console.error('Stack trace:', err.stack);
    console.error('');
    
    console.error('🔧 SOLUCIONES POSIBLES:\n');
    
    console.error('1. Verifica que SQL Server esté corriendo:');
    console.error('   Ejecuta en PowerShell (como Administrador):');
    console.error('   Get-Service -Name MSSQL*');
    console.error('');
    
    console.error('2. Verifica los protocolos de red de SQL Server:');
    console.error('   - Abre "SQL Server Configuration Manager"');
    console.error('   - Ve a "SQL Server Network Configuration" > "Protocols for SQLEXPRESS"');
    console.error('   - Asegúrate que "Named Pipes" y "Shared Memory" estén HABILITADOS');
    console.error('');
    
    console.error('3. Verifica el ODBC Driver:');
    console.error('   Ejecuta en PowerShell:');
    console.error('   Get-OdbcDriver | Where-Object {$_.Name -like "*SQL Server*"}');
    console.error('');
    
    console.error('4. Prueba con SQL Server Management Studio:');
    console.error('   Server name: WINH\\SQLEXPRESS');
    console.error('   Authentication: Windows Authentication');
    console.error('');
    
    console.error('5. Si SSMS funciona, prueba estas connection strings alternativas:');
    console.error('   Opción A (SQL Server Native Client):');
    console.error('   Driver={SQL Server Native Client 11.0};Server=WINH\\SQLEXPRESS;Database=ModuloAnalisis;Trusted_Connection=Yes;');
    console.error('');
    console.error('   Opción B (Sin especificar driver):');
    console.error('   Server=WINH\\SQLEXPRESS;Database=ModuloAnalisis;Trusted_Connection=true;');
    console.error('');
    console.error('   Opción C (Usando localhost):');
    console.error('   Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Database=ModuloAnalisis;Trusted_Connection=Yes;');
  }
}

testConnection().catch(err => {
  console.error('ERROR NO MANEJADO:', err);
  process.exit(1);
});