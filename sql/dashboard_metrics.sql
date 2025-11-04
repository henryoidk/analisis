-- Dashboard metrics SP
CREATE OR ALTER PROCEDURE ventas.sp_GetDashboardMetrics
    @YearMonth CHAR(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Si no se especifica el mes, usar el mes actual
    IF @YearMonth IS NULL
        SET @YearMonth = LEFT(CONVERT(VARCHAR(10), GETDATE(), 23), 7);
    
    -- 1. Obtener total mensual (solo semanas que ya iniciaron)
    SELECT
        @YearMonth AS YearMonth,
        SUM(v.TotalUSD) AS TotalMensualUSD
    FROM ventas.VentasSemanales v
    WHERE v.YearMonth = @YearMonth
      AND v.FromDate <= CAST(GETDATE() AS DATE);  -- Solo semanas que ya iniciaron
    
    -- 2. Obtener promedio por vendedor (solo semanas que ya iniciaron)
    SELECT
        CAST(SUM(v.TotalUSD) AS DECIMAL(18,2)) / 
        NULLIF(COUNT(DISTINCT v.SellerId), 0) AS PromedioPorVendedorUSD
    FROM ventas.VentasSemanales v
    WHERE v.YearMonth = @YearMonth
      AND v.FromDate <= CAST(GETDATE() AS DATE);  -- Solo semanas que ya iniciaron
    
    -- 3. Obtener semana actual
    SELECT 
        CASE 
            WHEN DAY(GETDATE()) <= 7 THEN 1
            WHEN DAY(GETDATE()) <= 14 THEN 2
            WHEN DAY(GETDATE()) <= 21 THEN 3
            WHEN DAY(GETDATE()) <= 28 THEN 4
            ELSE 5
        END AS WeekNo;
        
    -- 4. Obtener desempeño por vendedor y semana (solo semanas que ya iniciaron)
    SELECT
        v.Nombre AS Vendedor,
        MAX(CASE WHEN vs.WeekNo = 1 AND vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD END) AS S1,
        MAX(CASE WHEN vs.WeekNo = 2 AND vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD END) AS S2,
        MAX(CASE WHEN vs.WeekNo = 3 AND vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD END) AS S3,
        MAX(CASE WHEN vs.WeekNo = 4 AND vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD END) AS S4,
        MAX(CASE WHEN vs.WeekNo = 5 AND vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD END) AS S5,
        SUM(CASE WHEN vs.FromDate <= CAST(GETDATE() AS DATE) THEN vs.TotalUSD ELSE 0 END) AS Total
    FROM ventas.Vendedores v
    LEFT JOIN ventas.VentasSemanales vs 
        ON vs.SellerId = v.SellerId 
        AND vs.YearMonth = @YearMonth
    WHERE v.Activo = 1
    GROUP BY v.SellerId, v.Nombre
    ORDER BY SUM(CASE WHEN vs.FromDate <= CAST(GETDATE() AS DATE) THEN ISNULL(vs.TotalUSD, 0) ELSE 0 END) DESC;
END;
GO