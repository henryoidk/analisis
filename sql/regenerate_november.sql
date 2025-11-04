-- Regenerar datos de la semana 1 de noviembre 2025
USE ModuloAnalisis;
GO

-- Insertar datos para la semana 1 (días 1-7 de noviembre)
INSERT INTO ventas.VentasSemanales (SellerId, YearMonth, WeekNo, FromDate, ToDate, TotalUSD)
SELECT 
    v.SellerId, 
    '2025-11', 
    1, 
    '2025-11-01', 
    '2025-11-07', 
    CAST(8000 + (ABS(CHECKSUM(NEWID())) % 7001) AS DECIMAL(12,2))
FROM ventas.Vendedores v 
WHERE v.Activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM ventas.VentasSemanales vs 
    WHERE vs.SellerId = v.SellerId 
      AND vs.YearMonth = '2025-11' 
      AND vs.WeekNo = 1
  );

-- Verificar los datos insertados
SELECT 
    v.Nombre,
    vs.WeekNo,
    vs.FromDate,
    vs.ToDate,
    vs.TotalUSD
FROM ventas.VentasSemanales vs
JOIN ventas.Vendedores v ON v.SellerId = vs.SellerId
WHERE vs.YearMonth = '2025-11'
ORDER BY vs.WeekNo, v.Nombre;

PRINT '';
PRINT 'Datos de noviembre regenerados exitosamente';
GO
