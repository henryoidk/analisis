-- Stored procedure para obtener dashboard del vendedor
USE ModuloAnalisis;
GO

IF OBJECT_ID('ventas.sp_GetVendorDashboard', 'P') IS NOT NULL
    DROP PROCEDURE ventas.sp_GetVendorDashboard;
GO

CREATE PROCEDURE ventas.sp_GetVendorDashboard
    @UserID INT,
    @YearMonth CHAR(7) = NULL  -- Formato: 'YYYY-MM'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SellerId INT;
    DECLARE @Year INT;
    DECLARE @Month INT;

    -- Si no se proporciona YearMonth, usar mes actual
    IF @YearMonth IS NULL
        SET @YearMonth = FORMAT(GETDATE(), 'yyyy-MM');

    -- Extraer año y mes
    SET @Year = CAST(LEFT(@YearMonth, 4) AS INT);
    SET @Month = CAST(RIGHT(@YearMonth, 2) AS INT);

    -- Obtener el SellerId del usuario
    SELECT @SellerId = SellerId
    FROM ventas.Vendedores
    WHERE UserId = @UserID;

    IF @SellerId IS NULL
    BEGIN
        RAISERROR('Usuario no es un vendedor', 16, 1);
        RETURN;
    END;

    -- 1. Total mensual del vendedor
    SELECT ISNULL(SUM(TotalUSD), 0) AS TotalPersonalUSD
    FROM ventas.VentasSemanales
    WHERE SellerId = @SellerId
      AND YEAR(FromDate) = @Year
      AND MONTH(FromDate) = @Month
      AND FromDate <= CAST(GETDATE() AS DATE);

    -- 2. Semana actual
    SELECT TOP 1 WeekNo
    FROM ventas.VentasSemanales
    WHERE SellerId = @SellerId
      AND YEAR(FromDate) = @Year
      AND MONTH(FromDate) = @Month
      AND FromDate <= CAST(GETDATE() AS DATE)
    ORDER BY FromDate DESC;

    -- 3. Detalle semanal del vendedor (solo semanas que ya ocurrieron)
    SELECT 
        WeekNo,
        FromDate,
        ToDate,
        TotalUSD
    FROM ventas.VentasSemanales
    WHERE SellerId = @SellerId
      AND YEAR(FromDate) = @Year
      AND MONTH(FromDate) = @Month
      AND FromDate <= CAST(GETDATE() AS DATE)
    ORDER BY WeekNo;
END;
GO

PRINT 'Stored procedure ventas.sp_GetVendorDashboard creado exitosamente';
