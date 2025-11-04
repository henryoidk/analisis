-- SQL Server: Autenticación con hash + salt, roles y SPs
-- Base de datos: ModuloAnalisis

IF DB_ID('ModuloAnalisis') IS NULL
    CREATE DATABASE ModuloAnalisis;
GO
USE ModuloAnalisis;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'auth')
    EXEC ('CREATE SCHEMA auth');
GO

-- Tabla de Roles
IF OBJECT_ID('auth.Roles') IS NULL
BEGIN
    CREATE TABLE auth.Roles(
        RoleId      TINYINT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(50) NOT NULL UNIQUE
    );
END
GO

-- Usuarios con hash y salt
IF OBJECT_ID('auth.Usuarios') IS NULL
BEGIN
    CREATE TABLE auth.Usuarios(
        UserId        INT IDENTITY(1,1) PRIMARY KEY,
        Username      NVARCHAR(50) NOT NULL UNIQUE,
        RoleId        TINYINT NOT NULL FOREIGN KEY REFERENCES auth.Roles(RoleId),
        PasswordHash  VARBINARY(64) NOT NULL,
        Salt          VARBINARY(32) NOT NULL,
        IsActive      BIT NOT NULL CONSTRAINT DF_Usuarios_IsActive DEFAULT(1),
        CreatedAt     DATETIME2(0) NOT NULL CONSTRAINT DF_Usuarios_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastLoginAt   DATETIME2(0) NULL
    );
    CREATE UNIQUE INDEX IX_Usuarios_Username ON auth.Usuarios(Username);
END
GO

-- Función: calcular hash SHA2_512(salt + password)
CREATE OR ALTER FUNCTION auth.fn_ComputePasswordHash
(
    @Password NVARCHAR(4000),
    @Salt     VARBINARY(32)
)
RETURNS VARBINARY(64)
AS
BEGIN
    RETURN HASHBYTES('SHA2_512', @Salt + CONVERT(VARBINARY(4000), @Password));
END
GO

-- SP: crear usuario (genera salt aleatorio)
CREATE OR ALTER PROCEDURE auth.sp_CreateUser
    @Username NVARCHAR(50),
    @Password NVARCHAR(128),
    @RoleName NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = @Username)
        THROW 50001, 'El usuario ya existe.', 1;

    DECLARE @Salt VARBINARY(32) = CRYPT_GEN_RANDOM(32);
    DECLARE @Hash VARBINARY(64) = auth.fn_ComputePasswordHash(@Password, @Salt);

    DECLARE @RoleId TINYINT = (SELECT RoleId FROM auth.Roles WHERE Name = @RoleName);
    IF @RoleId IS NULL
    BEGIN
        INSERT INTO auth.Roles(Name) VALUES(@RoleName);
        SET @RoleId = SCOPE_IDENTITY();
    END

    INSERT INTO auth.Usuarios(Username, RoleId, PasswordHash, Salt)
    VALUES(@Username, @RoleId, @Hash, @Salt);
END
GO

-- SP: login (valida usuario y contraseña)
CREATE OR ALTER PROCEDURE auth.sp_Login
    @Username NVARCHAR(50),
    @Password NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE
        @UserId INT,
        @Salt VARBINARY(32),
        @ExpectedHash VARBINARY(64),
        @IsActive BIT,
        @RoleId TINYINT;

    SELECT
        @UserId = u.UserId,
        @Salt = u.Salt,
        @ExpectedHash = u.PasswordHash,
        @IsActive = u.IsActive,
        @RoleId = u.RoleId
    FROM auth.Usuarios u
    WHERE u.Username = @Username;

    IF @UserId IS NULL OR @IsActive = 0
    BEGIN
        RAISERROR('Usuario o contraseña inválidos.', 16, 1);
        RETURN;
    END

    DECLARE @Hash VARBINARY(64) = auth.fn_ComputePasswordHash(@Password, @Salt);

    IF @Hash <> @ExpectedHash
    BEGIN
        RAISERROR('Usuario o contraseña inválidos.', 16, 1);
        RETURN;
    END

    UPDATE auth.Usuarios SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @UserId;

    SELECT u.UserId, u.Username, r.Name AS Rol, u.LastLoginAt
    FROM auth.Usuarios u
    JOIN auth.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;
END
GO

-- SP: cambiar contraseña (re-salting)
CREATE OR ALTER PROCEDURE auth.sp_ChangePassword
    @Username NVARCHAR(50),
    @OldPassword NVARCHAR(128),
    @NewPassword NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Salt VARBINARY(32), @Expected VARBINARY(64);
    SELECT @Salt = Salt, @Expected = PasswordHash FROM auth.Usuarios WHERE Username = @Username;

    IF @Salt IS NULL
        THROW 50002, 'Usuario no existe.', 1;

    IF auth.fn_ComputePasswordHash(@OldPassword, @Salt) <> @Expected
        THROW 50003, 'Contraseña actual incorrecta.', 1;

    DECLARE @NewSalt VARBINARY(32) = CRYPT_GEN_RANDOM(32);
    DECLARE @NewHash VARBINARY(64) = auth.fn_ComputePasswordHash(@NewPassword, @NewSalt);

    UPDATE auth.Usuarios SET Salt = @NewSalt, PasswordHash = @NewHash WHERE Username = @Username;
END
GO

-- Crear usuarios solicitados
DECLARE @AdminPwd NVARCHAR(128) = N'Admin*2025!';
DECLARE @VendPwd  NVARCHAR(128) = N'Venta*2025!';

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = N'henryoo')
    EXEC auth.sp_CreateUser @Username = N'henryoo', @Password = @AdminPwd, @RoleName = N'Administrador';

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = N'harold')
    EXEC auth.sp_CreateUser @Username = N'harold',  @Password = @VendPwd,  @RoleName = N'Vendedor';

-- Pruebas (comentar o ejecutar manualmente)
-- EXEC auth.sp_Login N'henryoo', @AdminPwd;
-- EXEC auth.sp_Login N'harold',  @VendPwd;

