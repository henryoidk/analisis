-- Tabla de permisos de usuario
USE ModuloAnalisis;
GO

-- Crear tabla de permisos si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserPermissions' AND schema_id = SCHEMA_ID('auth'))
BEGIN
    CREATE TABLE auth.UserPermissions (
        PermissionId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        PermissionType NVARCHAR(50) NOT NULL DEFAULT 'datos_personales', -- 'datos_personales' o 'todos_vendedores'
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_UserPermissions_Users FOREIGN KEY (UserId) REFERENCES auth.Usuarios(UserId),
        CONSTRAINT CHK_PermissionType CHECK (PermissionType IN ('datos_personales', 'todos_vendedores'))
    );
    
    PRINT 'Tabla auth.UserPermissions creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla auth.UserPermissions ya existe';
END
GO

-- Insertar permisos por defecto para los vendedores existentes (datos personales)
INSERT INTO auth.UserPermissions (UserId, PermissionType)
SELECT u.UserId, 'datos_personales'
FROM auth.Usuarios u
WHERE u.RoleId = 2 -- Solo vendedores
  AND NOT EXISTS (
    SELECT 1 FROM auth.UserPermissions p WHERE p.UserId = u.UserId
  );
GO

PRINT 'Permisos por defecto insertados';
GO

-- SP para obtener todos los usuarios vendedores con sus permisos
IF OBJECT_ID('auth.sp_GetVendorsWithPermissions', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_GetVendorsWithPermissions;
GO

CREATE PROCEDURE auth.sp_GetVendorsWithPermissions
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        u.UserId,
        u.Username,
        r.Name AS Rol,
        ISNULL(p.PermissionType, 'datos_personales') AS Permission
    FROM auth.Usuarios u
    INNER JOIN auth.Roles r ON u.RoleId = r.RoleId
    LEFT JOIN auth.UserPermissions p ON u.UserId = p.UserId
    WHERE u.RoleId = 2 -- Solo vendedores
      AND u.IsActive = 1
    ORDER BY u.Username;
END;
GO

PRINT 'SP auth.sp_GetVendorsWithPermissions creado exitosamente';
GO

-- SP para actualizar permisos de un usuario
IF OBJECT_ID('auth.sp_UpdateUserPermission', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_UpdateUserPermission;
GO

CREATE PROCEDURE auth.sp_UpdateUserPermission
    @UserId INT,
    @PermissionType NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Verificar que el usuario sea un vendedor
    IF NOT EXISTS (SELECT 1 FROM auth.Usuarios WHERE UserId = @UserId AND RoleId = 2)
    BEGIN
        RAISERROR('Solo se pueden cambiar permisos de vendedores', 16, 1);
        RETURN;
    END;
    
    -- Verificar que el tipo de permiso sea válido
    IF @PermissionType NOT IN ('datos_personales', 'todos_vendedores')
    BEGIN
        RAISERROR('Tipo de permiso inválido', 16, 1);
        RETURN;
    END;
    
    -- Actualizar o insertar el permiso
    IF EXISTS (SELECT 1 FROM auth.UserPermissions WHERE UserId = @UserId)
    BEGIN
        UPDATE auth.UserPermissions
        SET PermissionType = @PermissionType,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId;
    END
    ELSE
    BEGIN
        INSERT INTO auth.UserPermissions (UserId, PermissionType)
        VALUES (@UserId, @PermissionType);
    END;
    
    SELECT 'OK' AS Status;
END;
GO

PRINT 'SP auth.sp_UpdateUserPermission creado exitosamente';
GO

-- SP para obtener el permiso de un usuario específico
IF OBJECT_ID('auth.sp_GetUserPermission', 'P') IS NOT NULL
    DROP PROCEDURE auth.sp_GetUserPermission;
GO

CREATE PROCEDURE auth.sp_GetUserPermission
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        ISNULL(p.PermissionType, 'datos_personales') AS Permission
    FROM auth.Usuarios u
    LEFT JOIN auth.UserPermissions p ON u.UserId = p.UserId
    WHERE u.UserId = @UserId;
END;
GO

PRINT 'SP auth.sp_GetUserPermission creado exitosamente';
GO
