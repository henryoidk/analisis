-- SQL Server setup for ModuloAnalisis with weekly sales per seller
-- Includes auth (roles/usuarios), vendedores, ventas semanales, funciones auxiliares,
-- trigger de validación/autorrelleno, procedimientos de carga/consulta, índices y datos seed.
-- Ejecútalo en SQL Server Management Studio o sqlcmd.

/* 1) Base de datos */
IF DB_ID('ModuloAnalisis') IS NULL
    CREATE DATABASE ModuloAnalisis;
GO
USE ModuloAnalisis;
GO

/* 2) Esquemas */
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'auth')
    EXEC ('CREATE SCHEMA auth');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ventas')
    EXEC ('CREATE SCHEMA ventas');
GO

/* 3) Auth: Roles/Usuarios y hashing con salt */
IF OBJECT_ID('auth.Roles') IS NULL
BEGIN
    CREATE TABLE auth.Roles(
        RoleId  TINYINT IDENTITY(1,1) PRIMARY KEY,
        Name    NVARCHAR(50) NOT NULL UNIQUE
    );
END
GO

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

CREATE OR ALTER PROCEDURE auth.sp_CreateUser
    @Username NVARCHAR(50),
    @Password NVARCHAR(128),
    @RoleName NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = @Username)
        THROW 50001, N'El usuario ya existe.', 1;

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
        RAISERROR(N'Usuario o contraseña inválidos.', 16, 1);
        RETURN;
    END

    DECLARE @Hash VARBINARY(64) = auth.fn_ComputePasswordHash(@Password, @Salt);

    IF @Hash <> @ExpectedHash
    BEGIN
        RAISERROR(N'Usuario o contraseña inválidos.', 16, 1);
        RETURN;
    END

    UPDATE auth.Usuarios SET LastLoginAt = SYSUTCDATETIME() WHERE UserId = @UserId;

    SELECT u.UserId, u.Username, r.Name AS Rol, u.LastLoginAt
    FROM auth.Usuarios u
    JOIN auth.Roles r ON r.RoleId = u.RoleId
    WHERE u.UserId = @UserId;
END
GO

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
        THROW 50002, N'Usuario no existe.', 1;

    IF auth.fn_ComputePasswordHash(@OldPassword, @Salt) <> @Expected
        THROW 50003, N'Contraseña actual incorrecta.', 1;

    DECLARE @NewSalt VARBINARY(32) = CRYPT_GEN_RANDOM(32);
    DECLARE @NewHash VARBINARY(64) = auth.fn_ComputePasswordHash(@NewPassword, @NewSalt);

    UPDATE auth.Usuarios SET Salt = @NewSalt, PasswordHash = @NewHash WHERE Username = @Username;
END
GO

/* 4) Esquema ventas: Vendedores y VentasSemanales */
IF OBJECT_ID('ventas.Vendedores') IS NULL
BEGIN
    CREATE TABLE ventas.Vendedores(
        SellerId   INT IDENTITY(1,1) PRIMARY KEY,
        UserId     INT NOT NULL UNIQUE
            CONSTRAINT FK_Vendedores_Usuarios REFERENCES auth.Usuarios(UserId),
        Nombre     NVARCHAR(120) NOT NULL,
        Activo     BIT NOT NULL CONSTRAINT DF_Vendedores_Activo DEFAULT(1),
        CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_Vendedores_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_Vendedores_Activo ON ventas.Vendedores(Activo) INCLUDE(Nombre);
END
GO

IF OBJECT_ID('ventas.VentasSemanales') IS NULL
BEGIN
    CREATE TABLE ventas.VentasSemanales(
        VentaId    INT IDENTITY(1,1) PRIMARY KEY,
        SellerId   INT NOT NULL CONSTRAINT FK_VentasSemanales_Vendedores REFERENCES ventas.Vendedores(SellerId),
        YearMonth  CHAR(7) NOT NULL,   -- 'YYYY-MM'
        WeekNo     TINYINT NOT NULL CHECK (WeekNo BETWEEN 1 AND 5),
        FromDate   DATE NOT NULL,
        ToDate     DATE NOT NULL,
        TotalUSD   DECIMAL(12,2) NOT NULL CHECK (TotalUSD >= 0),
        CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_VentasSemanales_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_Seller_Period UNIQUE (SellerId, YearMonth, WeekNo)
    );

    CREATE INDEX IX_Ventas_Seller_Period ON ventas.VentasSemanales(SellerId, YearMonth) INCLUDE(WeekNo, TotalUSD);
    CREATE INDEX IX_Ventas_Period ON ventas.VentasSemanales(YearMonth, SellerId) INCLUDE(WeekNo, TotalUSD);
END
GO

/* 5) Funciones auxiliares de semanas (por mes) */
-- Partición simple: S1=1-7, S2=8-14, S3=15-21, S4=22-28, S5=29-fin
CREATE OR ALTER FUNCTION ventas.fn_WeekRangesForMonth
(
    @Year  INT,
    @Month INT
)
RETURNS @Weeks TABLE
(
    WeekNo   TINYINT NOT NULL,
    FromDate DATE    NOT NULL,
    ToDate   DATE    NOT NULL
)
AS
BEGIN
    DECLARE @Start DATE = DATEFROMPARTS(@Year, @Month, 1);
    DECLARE @End   DATE = EOMONTH(@Start);

    INSERT INTO @Weeks(WeekNo, FromDate, ToDate)
    VALUES
        (1, @Start, DATEFROMPARTS(@Year, @Month, 7)),
        (2, DATEFROMPARTS(@Year, @Month, 8),  DATEFROMPARTS(@Year, @Month, 14)),
        (3, DATEFROMPARTS(@Year, @Month, 15), DATEFROMPARTS(@Year, @Month, 21)),
        (4, DATEFROMPARTS(@Year, @Month, 22), DATEFROMPARTS(@Year, @Month, 28));

    IF DAY(@End) > 28
        INSERT INTO @Weeks(WeekNo, FromDate, ToDate)
        VALUES (5, DATEFROMPARTS(@Year, @Month, 29), @End);

    RETURN;
END
GO

CREATE OR ALTER FUNCTION ventas.fn_WeekDateRange
(
    @YearMonth CHAR(7),  -- 'YYYY-MM'
    @WeekNo    TINYINT
)
RETURNS TABLE
AS
RETURN
WITH ym AS (
    SELECT
        TRY_CONVERT(INT, LEFT(@YearMonth,4)) AS Y,
        TRY_CONVERT(INT, RIGHT(@YearMonth,2)) AS M
)
SELECT w.WeekNo, w.FromDate, w.ToDate
FROM ym
CROSS APPLY ventas.fn_WeekRangesForMonth(ym.Y, ym.M) w
WHERE w.WeekNo = @WeekNo;
GO

/* 6) Trigger: valida y autocompleta rangos */
CREATE OR ALTER TRIGGER ventas.tr_VentasSemanales_ValidateAndFill
ON ventas.VentasSemanales
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO ventas.VentasSemanales (SellerId, YearMonth, WeekNo, FromDate, ToDate, TotalUSD)
    SELECT
        i.SellerId,
        i.YearMonth,
        i.WeekNo,
        r.FromDate,
        r.ToDate,
        i.TotalUSD
    FROM inserted i
    CROSS APPLY ventas.fn_WeekDateRange(i.YearMonth, i.WeekNo) r
    WHERE i.TotalUSD >= 0
      AND r.FromDate IS NOT NULL AND r.ToDate IS NOT NULL;

    -- Validación de rango
    IF EXISTS (
        SELECT 1 FROM ventas.VentasSemanales v WHERE v.FromDate > v.ToDate
    )
    BEGIN
        ROLLBACK;
        THROW 50020, N'Rango de fechas inválido (FromDate > ToDate).', 1;
    END
END
GO

/* 7) SP: alta de vendedor ligado a usuario */
CREATE OR ALTER PROCEDURE ventas.sp_CreateVendedor
    @Username NVARCHAR(50),
    @Password NVARCHAR(128),
    @Nombre   NVARCHAR(120)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=@Username)
    BEGIN
        -- Si ya existe usuario pero sin vendedor, lo vincula; si ya hay vendedor, error
        DECLARE @UserId INT = (SELECT UserId FROM auth.Usuarios WHERE Username=@Username);
        IF EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@UserId)
            THROW 50010, N'El vendedor ya existe para ese usuario.', 1;
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@UserId, @Nombre);
        RETURN;
    END

    EXEC auth.sp_CreateUser @Username=@Username, @Password=@Password, @RoleName=N'Vendedor';
    DECLARE @NewUserId INT = (SELECT UserId FROM auth.Usuarios WHERE Username=@Username);
    INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@NewUserId, @Nombre);
END
GO

/* 8) SP: upsert de venta semanal por vendedor */
CREATE OR ALTER PROCEDURE ventas.sp_RegistrarVentaSemanal
    @Username  NVARCHAR(50) = NULL,
    @SellerId  INT = NULL,
    @YearMonth CHAR(7),
    @WeekNo    TINYINT,
    @TotalUSD  DECIMAL(12,2)
AS
BEGIN
    SET NOCOUNT ON;

    IF @SellerId IS NULL
    BEGIN
        IF @Username IS NULL THROW 50030, N'Debe indicar @Username o @SellerId.', 1;
        SET @SellerId = (
            SELECT v.SellerId
            FROM ventas.Vendedores v
            JOIN auth.Usuarios u ON u.UserId = v.UserId
            WHERE u.Username = @Username
        );
        IF @SellerId IS NULL THROW 50031, N'Vendedor no encontrado para ese usuario.', 1;
    END

    DECLARE @Y INT = TRY_CONVERT(INT, LEFT(@YearMonth,4));
    DECLARE @M INT = TRY_CONVERT(INT, RIGHT(@YearMonth,2));
    IF @Y IS NULL OR @M IS NULL OR @M NOT BETWEEN 1 AND 12
        THROW 50032, N'YearMonth inválido. Use formato YYYY-MM.', 1;

    IF @WeekNo NOT BETWEEN 1 AND 5
        THROW 50033, N'WeekNo inválido. Debe ser 1..5.', 1;

    DECLARE @From DATE, @To DATE;
    SELECT @From = r.FromDate, @To = r.ToDate
    FROM ventas.fn_WeekDateRange(@YearMonth, @WeekNo) r;

    IF @From IS NULL OR @To IS NULL
        THROW 50034, N'Rango semanal no determinado para ese periodo.', 1;

    -- Primero intentar actualizar (no dispara el INSTEAD OF INSERT)
    UPDATE v
    SET v.TotalUSD = @TotalUSD,
        v.FromDate = @From,
        v.ToDate   = @To
    FROM ventas.VentasSemanales v
    WHERE v.SellerId=@SellerId AND v.YearMonth=@YearMonth AND v.WeekNo=@WeekNo;

    IF @@ROWCOUNT = 0
    BEGIN
        -- Si no existía, insertar sin fechas (trigger las completa y valida)
        INSERT INTO ventas.VentasSemanales (SellerId, YearMonth, WeekNo, TotalUSD)
        VALUES (@SellerId, @YearMonth, @WeekNo, @TotalUSD);
    END
END
GO

/* 9) SP: Generar ventas semanales desde enero del año actual hasta hoy */
CREATE OR ALTER PROCEDURE ventas.sp_BulkGenerarVentasDesdeEnero
    @BaseMin DECIMAL(12,2) = 8000,
    @BaseMax DECIMAL(12,2) = 15000,
    @Hasta   DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Hasta IS NULL SET @Hasta = CAST(GETDATE() AS DATE);
    DECLARE @Y INT = YEAR(@Hasta);

    DECLARE curS CURSOR LOCAL FAST_FORWARD FOR
        SELECT SellerId FROM ventas.Vendedores WHERE Activo = 1;

    DECLARE @SellerId INT;
    OPEN curS;
    FETCH NEXT FROM curS INTO @SellerId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @m INT = 1;
        WHILE @m <= MONTH(@Hasta)
        BEGIN
            DECLARE @ym CHAR(7) = CONCAT(@Y, '-', RIGHT('0'+CONVERT(VARCHAR(2),@m),2));

            INSERT INTO ventas.VentasSemanales (SellerId, YearMonth, WeekNo, FromDate, ToDate, TotalUSD)
            SELECT
                @SellerId,
                @ym,
                w.WeekNo,
                w.FromDate,
                w.ToDate,
                CAST(@BaseMin + (ABS(CHECKSUM(NEWID())) % (1 + (@BaseMax - @BaseMin))) AS DECIMAL(12,2))
            FROM ventas.fn_WeekRangesForMonth(@Y, @m) w
            WHERE w.ToDate <= @Hasta
              AND NOT EXISTS (
                  SELECT 1 FROM ventas.VentasSemanales t
                  WHERE t.SellerId=@SellerId AND t.YearMonth=@ym AND t.WeekNo=w.WeekNo
              );

            SET @m += 1;
        END

        FETCH NEXT FROM curS INTO @SellerId;
    END
    CLOSE curS; DEALLOCATE curS;
END
GO

/* 10) Métricas: Promedio semanal por vendedor y Totales mensuales */
CREATE OR ALTER PROCEDURE ventas.sp_GetPromedioSemanalPorVendedor
    @FromYM CHAR(7) = NULL,
    @ToYM   CHAR(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        v.SellerId,
        ven.Nombre,
        u.Username,
        AVG(CAST(v.TotalUSD AS DECIMAL(18,2))) AS PromedioSemanalUSD
    FROM ventas.VentasSemanales v
    JOIN ventas.Vendedores ven ON ven.SellerId = v.SellerId
    JOIN auth.Usuarios u ON u.UserId = ven.UserId
    WHERE (@FromYM IS NULL OR v.YearMonth >= @FromYM)
      AND (@ToYM   IS NULL OR v.YearMonth <= @ToYM)
    GROUP BY v.SellerId, ven.Nombre, u.Username
    ORDER BY ven.Nombre;
END
GO

CREATE OR ALTER PROCEDURE ventas.sp_GetTotalesMensuales
    @FromYM CHAR(7) = NULL,
    @ToYM   CHAR(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.YearMonth,
        SUM(v.TotalUSD) AS TotalMensualUSD
    FROM ventas.VentasSemanales v
    WHERE (@FromYM IS NULL OR v.YearMonth >= @FromYM)
      AND (@ToYM   IS NULL OR v.YearMonth <= @ToYM)
    GROUP BY v.YearMonth
    ORDER BY v.YearMonth;
END
GO

CREATE OR ALTER PROCEDURE ventas.sp_GetTotalesMensualesPorVendedor
    @FromYM CHAR(7) = NULL,
    @ToYM   CHAR(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        v.SellerId,
        ven.Nombre,
        u.Username,
        v.YearMonth,
        SUM(v.TotalUSD) AS TotalMensualUSD
    FROM ventas.VentasSemanales v
    JOIN ventas.Vendedores ven ON ven.SellerId = v.SellerId
    JOIN auth.Usuarios u ON u.UserId = ven.UserId
    WHERE (@FromYM IS NULL OR v.YearMonth >= @FromYM)
      AND (@ToYM   IS NULL OR v.YearMonth <= @ToYM)
    GROUP BY v.SellerId, ven.Nombre, u.Username, v.YearMonth
    ORDER BY ven.Nombre, v.YearMonth;
END
GO

/* 11) Seed: roles, usuarios base y 4 vendedores */
IF NOT EXISTS (SELECT 1 FROM auth.Roles WHERE Name=N'Administrador')
    INSERT INTO auth.Roles(Name) VALUES (N'Administrador');
IF NOT EXISTS (SELECT 1 FROM auth.Roles WHERE Name=N'Vendedor')
    INSERT INTO auth.Roles(Name) VALUES (N'Vendedor');
GO

-- Usuarios iniciales del proyecto original (si no existen)
DECLARE @AdminPwd NVARCHAR(128) = N'Admin*2025!';
DECLARE @VendPwd  NVARCHAR(128) = N'Venta*2025!';

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = N'henryoo')
    EXEC auth.sp_CreateUser @Username = N'henryoo', @Password = @AdminPwd, @RoleName = N'Administrador';
IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username = N'harold')
    EXEC auth.sp_CreateUser @Username = N'harold',  @Password = @VendPwd,  @RoleName = N'Vendedor';
GO

-- Vendedores (4 nuevos) + vincular 'harold' si existe
IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=N'ana')
    EXEC ventas.sp_CreateVendedor  @Username=N'ana',  @Password=N'Ana*2025!',  @Nombre=N'Ana Pérez';
ELSE
BEGIN
    DECLARE @u1 INT = (SELECT UserId FROM auth.Usuarios WHERE Username=N'ana');
    IF NOT EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@u1)
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@u1, N'Ana Pérez');
END

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=N'juan')
    EXEC ventas.sp_CreateVendedor  @Username=N'juan', @Password=N'Juan*2025!', @Nombre=N'Juan Gómez';
ELSE
BEGIN
    DECLARE @u2 INT = (SELECT UserId FROM auth.Usuarios WHERE Username=N'juan');
    IF NOT EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@u2)
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@u2, N'Juan Gómez');
END

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=N'luis')
    EXEC ventas.sp_CreateVendedor  @Username=N'luis', @Password=N'Luis*2025!', @Nombre=N'Luis Soto';
ELSE
BEGIN
    DECLARE @u3 INT = (SELECT UserId FROM auth.Usuarios WHERE Username=N'luis');
    IF NOT EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@u3)
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@u3, N'Luis Soto');
END

IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=N'maria')
    EXEC ventas.sp_CreateVendedor  @Username=N'maria',@Password=N'Maria*2025!',@Nombre=N'María Rojas';
ELSE
BEGIN
    DECLARE @u4 INT = (SELECT UserId FROM auth.Usuarios WHERE Username=N'maria');
    IF NOT EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@u4)
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@u4, N'María Rojas');
END

-- Vincular vendedor para 'harold' si no existe
IF EXISTS (SELECT 1 FROM auth.Usuarios WHERE Username=N'harold')
BEGIN
    DECLARE @u5 INT = (SELECT UserId FROM auth.Usuarios WHERE Username=N'harold');
    IF NOT EXISTS (SELECT 1 FROM ventas.Vendedores WHERE UserId=@u5)
        INSERT INTO ventas.Vendedores(UserId, Nombre) VALUES(@u5, N'Harold');
END
GO

/* 12) Generar ventas semanales desde enero hasta hoy */
EXEC ventas.sp_BulkGenerarVentasDesdeEnero @BaseMin = 8000, @BaseMax = 15000;
GO
