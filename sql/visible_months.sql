-- Sistema de meses visibles
USE ModuloAnalisis;
GO

-- Tabla para almacenar qué meses son visibles
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VisibleMonths' AND schema_id = SCHEMA_ID('auth'))
BEGIN
    CREATE TABLE auth.VisibleMonths (
        MonthId INT IDENTITY(1,1) PRIMARY KEY,
        YearMonth CHAR(7) NOT NULL UNIQUE, -- 'YYYY-MM'
        IsVisible BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    PRINT 'Tabla auth.VisibleMonths creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla auth.VisibleMonths ya existe';
END
GO

-- Insertar mes actual como visible por defecto
DECLARE @CurrentMonth CHAR(7) = LEFT(CONVERT(VARCHAR(10), GETDATE(), 23), 7);

IF NOT EXISTS (SELECT 1 FROM auth.VisibleMonths WHERE YearMonth = @CurrentMonth)
BEGIN
    INSERT INTO auth.VisibleMonths (YearMonth, IsVisible)
    VALUES (@CurrentMonth, 1);
    PRINT 'Mes actual insertado como visible';
END
GO

-- SP para obtener meses visibles
IF OBJECT_ID('auth.sp_GetVisibleMonths', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_GetVisibleMonths;
GO

CREATE PROCEDURE auth.sp_GetVisibleMonths
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        YearMonth,
        IsVisible
    FROM auth.VisibleMonths
    WHERE IsVisible = 1
    ORDER BY YearMonth;
END;
GO

PRINT 'SP auth.sp_GetVisibleMonths creado exitosamente';
GO

-- SP para actualizar visibilidad de un mes
IF OBJECT_ID('auth.sp_UpdateMonthVisibility', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_UpdateMonthVisibility;
GO

CREATE PROCEDURE auth.sp_UpdateMonthVisibility
    @YearMonth CHAR(7),
    @IsVisible BIT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Verificar formato
    IF @YearMonth NOT LIKE '[0-9][0-9][0-9][0-9]-[0-1][0-9]'
    BEGIN
        RAISERROR('Formato de YearMonth inválido. Use YYYY-MM', 16, 1);
        RETURN;
    END;
    
    -- Actualizar o insertar
    IF EXISTS (SELECT 1 FROM auth.VisibleMonths WHERE YearMonth = @YearMonth)
    BEGIN
        UPDATE auth.VisibleMonths
        SET IsVisible = @IsVisible,
            UpdatedAt = GETDATE()
        WHERE YearMonth = @YearMonth;
    END
    ELSE
    BEGIN
        INSERT INTO auth.VisibleMonths (YearMonth, IsVisible)
        VALUES (@YearMonth, @IsVisible);
    END;
    
    SELECT 'OK' AS Status;
END;
GO

PRINT 'SP auth.sp_UpdateMonthVisibility creado exitosamente';
GO

-- SP para obtener todos los meses del año actual con su estado de visibilidad
IF OBJECT_ID('auth.sp_GetAllMonthsStatus', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_GetAllMonthsStatus;
GO

CREATE PROCEDURE auth.sp_GetAllMonthsStatus
    @Year INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @Year IS NULL
        SET @Year = YEAR(GETDATE());
    
    -- Generar todos los meses del año
    WITH Months AS (
        SELECT 1 AS MonthNum UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
        SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL
        SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
        SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
    )
    SELECT 
        CONCAT(@Year, '-', RIGHT('0' + CAST(m.MonthNum AS VARCHAR(2)), 2)) AS YearMonth,
        ISNULL(v.IsVisible, 0) AS IsVisible
    FROM Months m
    LEFT JOIN auth.VisibleMonths v 
        ON CONCAT(@Year, '-', RIGHT('0' + CAST(m.MonthNum AS VARCHAR(2)), 2)) = v.YearMonth
    ORDER BY m.MonthNum;
END;
GO

PRINT 'SP auth.sp_GetAllMonthsStatus creado exitosamente';
GO
