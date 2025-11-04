-- Crear usuario SQL Server para la aplicación
-- Ejecutar esto en SSMS o sqlcmd

USE master;
GO

-- Crear login SQL Server
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = 'appuser')
BEGIN
    CREATE LOGIN appuser WITH PASSWORD = 'App*2025!Strong';
END
GO

USE ModuloAnalisis;
GO

-- Crear usuario en la base de datos
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = 'appuser')
BEGIN
    CREATE USER appuser FOR LOGIN appuser;
END
GO

-- Dar permisos
ALTER ROLE db_datareader ADD MEMBER appuser;
ALTER ROLE db_datawriter ADD MEMBER appuser;
GRANT EXECUTE ON SCHEMA::auth TO appuser;
GRANT EXECUTE ON SCHEMA::ventas TO appuser;
GO

PRINT 'Usuario SQL Server creado exitosamente';
PRINT 'Login: appuser';
PRINT 'Password: App*2025!Strong';
GO
