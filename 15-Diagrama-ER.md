# 15. Diagrama Entidad-Relación (ER)
## Sistema de Análisis de Ventas - ModuloAnalisis

---

## 15.1 Diagrama Entidad-Relación

```
┌─────────────────────┐
│    auth.Roles       │
├─────────────────────┤
│ PK RoleId (TINYINT) │
│    Name (NVARCHAR)  │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────┴──────────────────────┐
│      auth.Usuarios              │
├─────────────────────────────────┤
│ PK UserId (INT)                 │
│ UK Username (NVARCHAR)          │
│ FK RoleId → Roles.RoleId        │
│    PasswordHash (VARBINARY)     │
│    Salt (VARBINARY)             │
│    IsActive (BIT)               │
│    CreatedAt (DATETIME2)        │
│    LastLoginAt (DATETIME2)      │
└─────┬─────────┬─────────────────┘
      │ 1       │ 1
      │         │
      │ 1       │ N
┌─────┴──────┐  │   ┌───────────────────────────┐
│   ventas.  │  │   │  auth.UserPermissions     │
│ Vendedores │  │   ├───────────────────────────┤
├────────────┤  │   │ PK PermissionId (INT)     │
│ PK SellerId│  └───│ FK UserId → Usuarios      │
│ FK UserId  │      │    PermissionType (NV50)  │
│    Nombre  │      │    CreatedAt (DATETIME2)  │
│    Activo  │      │    UpdatedAt (DATETIME2)  │
│  CreatedAt │      └───────────────────────────┘
└─────┬──────┘      │ 1
      │ 1           │
      │             │ N
      │ N       ┌───┴───────────────────────┐
┌─────┴──────┐  │  auth.VisibleMonths       │
│   ventas.  │  ├───────────────────────────┤
│VentasSeman.│  │ PK MonthId (INT)          │
├────────────┤  │ UK YearMonth (CHAR(7))    │
│ PK VentaId │  │    IsVisible (BIT)        │
│ FK SellerId│  │    CreatedAt (DATETIME2)  │
│  YearMonth │  │    UpdatedAt (DATETIME2)  │
│    WeekNo  │  └───────────────────────────┘
│  FromDate  │
│   ToDate   │
│  TotalUSD  │
│ CreatedAt  │
└────────────┘
```

### Diagrama Visual Simplificado

```
                    ┌──────────┐
                    │  Roles   │
                    └────┬─────┘
                         │
                         ▼
              ┌──────────────────┐
              │    Usuarios      │◄──────────┐
              └──────┬───────────┘           │
                     │                       │
        ┌────────────┼───────────┐           │
        ▼            ▼           ▼           │
   ┌─────────┐  ┌─────────┐  ┌──────────────┴──┐
   │Vendedores│  │UserPerm.│  │VisibleMonths    │
   └────┬────┘  └─────────┘  └─────────────────┘
        │
        ▼
   ┌─────────────┐
   │VentasSeman. │
   └─────────────┘
```

---

## 15.2 Descripción de Entidades y Relaciones

### 🔹 ENTIDAD 1: auth.Roles

**Propósito**: Almacena los diferentes roles de usuario del sistema (Administrador, Vendedor).

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **RoleId** | TINYINT | PRIMARY KEY, IDENTITY(1,1) | Identificador único del rol |
| **Name** | NVARCHAR(50) | NOT NULL, UNIQUE | Nombre del rol (ej: "Administrador", "Vendedor") |

#### Restricciones:
- **PK_Roles**: Clave primaria en RoleId
- **UQ_Roles_Name**: Unicidad en el nombre del rol
- **NOT NULL**: El nombre es obligatorio

#### Valores Típicos:
- RoleId = 1: "Administrador"
- RoleId = 2: "Vendedor"

---

### 🔹 ENTIDAD 2: auth.Usuarios

**Propósito**: Almacena la información de autenticación y perfil de todos los usuarios del sistema.

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **UserId** | INT | PRIMARY KEY, IDENTITY(1,1) | Identificador único del usuario |
| **Username** | NVARCHAR(50) | NOT NULL, UNIQUE | Nombre de usuario para login |
| **RoleId** | TINYINT | NOT NULL, FK → Roles.RoleId | Rol asignado al usuario |
| **PasswordHash** | VARBINARY(64) | NOT NULL | Hash SHA2-512 de la contraseña |
| **Salt** | VARBINARY(32) | NOT NULL | Salt único generado aleatoriamente |
| **IsActive** | BIT | NOT NULL, DEFAULT(1) | Estado activo/inactivo del usuario |
| **CreatedAt** | DATETIME2(0) | NOT NULL, DEFAULT(SYSUTCDATETIME()) | Fecha de creación del registro |
| **LastLoginAt** | DATETIME2(0) | NULL | Fecha del último inicio de sesión |

#### Restricciones:
- **PK_Usuarios**: Clave primaria en UserId
- **FK_Usuarios_Roles**: Clave foránea hacia auth.Roles(RoleId)
- **IX_Usuarios_Username**: Índice único en Username
- **DF_Usuarios_IsActive**: Valor por defecto 1 (activo)
- **DF_Usuarios_CreatedAt**: Timestamp UTC automático

#### Reglas de Negocio:
1. Las contraseñas se almacenan con hash SHA2-512 usando salt aleatorio
2. Cada usuario debe tener un rol asignado
3. El Username debe ser único en todo el sistema
4. Los usuarios inactivos no pueden iniciar sesión

---

### 🔹 ENTIDAD 3: ventas.Vendedores

**Propósito**: Extiende la información de usuarios que tienen el rol de Vendedor, vinculándolos con sus ventas.

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **SellerId** | INT | PRIMARY KEY, IDENTITY(1,1) | Identificador único del vendedor |
| **UserId** | INT | NOT NULL, UNIQUE, FK → Usuarios.UserId | Usuario asociado al vendedor |
| **Nombre** | NVARCHAR(120) | NOT NULL | Nombre completo del vendedor |
| **Activo** | BIT | NOT NULL, DEFAULT(1) | Estado activo/inactivo |
| **CreatedAt** | DATETIME2(0) | NOT NULL, DEFAULT(SYSUTCDATETIME()) | Fecha de registro |

#### Restricciones:
- **PK_Vendedores**: Clave primaria en SellerId
- **FK_Vendedores_Usuarios**: Clave foránea hacia auth.Usuarios(UserId)
- **UQ_Vendedores_UserId**: Un usuario solo puede tener un registro de vendedor
- **IX_Vendedores_Activo**: Índice en Activo con INCLUDE(Nombre)
- **DF_Vendedores_Activo**: Valor por defecto 1

#### Reglas de Negocio:
1. Solo usuarios con RoleId = 2 (Vendedor) deberían tener registro en esta tabla
2. La relación UserId es 1:1 (un usuario = un vendedor)
3. El nombre se utiliza para reportes y visualización

---

### 🔹 ENTIDAD 4: ventas.VentasSemanales

**Propósito**: Registra las ventas de cada vendedor organizadas por semanas dentro de cada mes.

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **VentaId** | INT | PRIMARY KEY, IDENTITY(1,1) | Identificador único de la venta |
| **SellerId** | INT | NOT NULL, FK → Vendedores.SellerId | Vendedor que realizó la venta |
| **YearMonth** | CHAR(7) | NOT NULL | Período en formato 'YYYY-MM' |
| **WeekNo** | TINYINT | NOT NULL, CHECK(1-5) | Número de semana (1-5) |
| **FromDate** | DATE | NOT NULL | Fecha inicio de la semana |
| **ToDate** | DATE | NOT NULL | Fecha fin de la semana |
| **TotalUSD** | DECIMAL(12,2) | NOT NULL, CHECK(≥0) | Total vendido en USD |
| **CreatedAt** | DATETIME2(0) | NOT NULL, DEFAULT(SYSUTCDATETIME()) | Timestamp de registro |

#### Restricciones:
- **PK_VentasSemanales**: Clave primaria en VentaId
- **FK_VentasSemanales_Vendedores**: Clave foránea hacia ventas.Vendedores(SellerId)
- **UQ_Seller_Period**: (SellerId, YearMonth, WeekNo) único
- **CHK_WeekNo**: WeekNo entre 1 y 5
- **CHK_TotalUSD**: TotalUSD >= 0
- **IX_Ventas_Seller_Period**: Índice compuesto (SellerId, YearMonth)
- **IX_Ventas_Period**: Índice compuesto (YearMonth, SellerId)

#### Partición de Semanas:
- **Semana 1**: Días 1-7
- **Semana 2**: Días 8-14
- **Semana 3**: Días 15-21
- **Semana 4**: Días 22-28
- **Semana 5**: Días 29-fin de mes (opcional, solo si el mes tiene >28 días)

#### Reglas de Negocio:
1. No puede haber duplicados de (Vendedor, Mes, Semana)
2. Las fechas se autocompletan mediante trigger si no se proporcionan
3. El YearMonth debe coincidir con FromDate y ToDate
4. TotalUSD siempre debe ser positivo o cero

---

### 🔹 ENTIDAD 5: auth.UserPermissions

**Propósito**: Define los permisos de visualización de datos para cada vendedor.

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **PermissionId** | INT | PRIMARY KEY, IDENTITY(1,1) | Identificador único del permiso |
| **UserId** | INT | NOT NULL, FK → Usuarios.UserId | Usuario al que se asigna el permiso |
| **PermissionType** | NVARCHAR(50) | NOT NULL, DEFAULT('datos_personales'), CHECK | Tipo de permiso |
| **CreatedAt** | DATETIME2 | DEFAULT(GETDATE()) | Fecha de creación |
| **UpdatedAt** | DATETIME2 | DEFAULT(GETDATE()) | Fecha de última actualización |

#### Restricciones:
- **PK_UserPermissions**: Clave primaria en PermissionId
- **FK_UserPermissions_Users**: Clave foránea hacia auth.Usuarios(UserId)
- **CHK_PermissionType**: PermissionType IN ('datos_personales', 'todos_vendedores')
- **DF_UserPermissions_PermissionType**: Valor por defecto 'datos_personales'

#### Tipos de Permisos:
1. **'datos_personales'**: El vendedor solo ve sus propias ventas
2. **'todos_vendedores'**: El vendedor ve las ventas de todos (vista de administrador sin edición)

#### Reglas de Negocio:
1. Solo usuarios con RoleId = 2 (Vendedor) pueden tener permisos
2. Por defecto, todos los vendedores tienen 'datos_personales'
3. El administrador gestiona estos permisos desde la sección "Ajustes"

---

### 🔹 ENTIDAD 6: auth.VisibleMonths

**Propósito**: Controla qué meses son visibles para los vendedores en el sistema.

#### Atributos:

| Atributo | Tipo de Dato | Restricciones | Descripción |
|----------|--------------|---------------|-------------|
| **MonthId** | INT | PRIMARY KEY, IDENTITY(1,1) | Identificador único del registro |
| **YearMonth** | CHAR(7) | NOT NULL, UNIQUE | Mes en formato 'YYYY-MM' |
| **IsVisible** | BIT | NOT NULL, DEFAULT(1) | Visibilidad del mes |
| **CreatedAt** | DATETIME2 | DEFAULT(GETDATE()) | Fecha de creación |
| **UpdatedAt** | DATETIME2 | DEFAULT(GETDATE()) | Fecha de actualización |

#### Restricciones:
- **PK_VisibleMonths**: Clave primaria en MonthId
- **UQ_VisibleMonths_YearMonth**: YearMonth único
- **CHK_YearMonth_Format**: Formato 'YYYY-MM' validado por SP
- **DF_VisibleMonths_IsVisible**: Valor por defecto 1

#### Reglas de Negocio:
1. Solo el administrador puede cambiar la visibilidad de meses
2. Los meses invisibles no aparecen en el selector de fechas
3. El mes actual siempre se inserta como visible por defecto
4. Los vendedores solo pueden consultar meses marcados como visibles

---

## 15.3 Relaciones entre Entidades

### Relación 1: Roles → Usuarios (1:N)

**Tipo**: Uno a Muchos  
**Cardinalidad**: 1:N  
**Participación**: Total (Usuario) / Parcial (Rol)

**Descripción**:
- Un **Rol** puede estar asignado a muchos **Usuarios**
- Un **Usuario** tiene exactamente un **Rol**

**Implementación**:
```sql
FK_Usuarios_Roles: auth.Usuarios(RoleId) → auth.Roles(RoleId)
```

**Reglas**:
- DELETE CASCADE: No permitido (se debe cambiar el rol antes de eliminar)
- UPDATE CASCADE: Sí permitido

---

### Relación 2: Usuarios → Vendedores (1:1)

**Tipo**: Uno a Uno  
**Cardinalidad**: 1:1  
**Participación**: Parcial (Usuario) / Total (Vendedor)

**Descripción**:
- Un **Usuario** puede tener máximo un registro de **Vendedor**
- Un **Vendedor** está asociado a exactamente un **Usuario**

**Implementación**:
```sql
FK_Vendedores_Usuarios: ventas.Vendedores(UserId) → auth.Usuarios(UserId)
UNIQUE CONSTRAINT en UserId
```

**Reglas**:
- Solo usuarios con RoleId = 2 (Vendedor) deberían tener registro
- La relación es opcional desde Usuarios (no todos son vendedores)
- La relación es total desde Vendedores (todos deben tener usuario)

---

### Relación 3: Vendedores → VentasSemanales (1:N)

**Tipo**: Uno a Muchos  
**Cardinalidad**: 1:N  
**Participación**: Total (VentasSemanales) / Parcial (Vendedores)

**Descripción**:
- Un **Vendedor** puede tener muchos registros de **VentasSemanales**
- Una **VentaSemanal** pertenece a exactamente un **Vendedor**

**Implementación**:
```sql
FK_VentasSemanales_Vendedores: ventas.VentasSemanales(SellerId) → ventas.Vendedores(SellerId)
```

**Reglas**:
- Un vendedor puede tener hasta 5 ventas por mes (una por semana)
- DELETE CASCADE: No permitido (preservar histórico)
- UPDATE CASCADE: Sí permitido

---

### Relación 4: Usuarios → UserPermissions (1:N)

**Tipo**: Uno a Muchos  
**Cardinalidad**: 1:N  
**Participación**: Parcial (Usuarios) / Total (UserPermissions)

**Descripción**:
- Un **Usuario** puede tener uno o más **Permisos**
- Un **Permiso** pertenece a exactamente un **Usuario**

**Implementación**:
```sql
FK_UserPermissions_Users: auth.UserPermissions(UserId) → auth.Usuarios(UserId)
```

**Reglas**:
- En la práctica, cada usuario tiene máximo un permiso activo
- Solo aplica para usuarios con RoleId = 2 (Vendedores)
- Los administradores no necesitan permisos en esta tabla

---

### Relación 5: VisibleMonths (Entidad Independiente)

**Tipo**: Entidad Independiente  
**Cardinalidad**: N/A  
**Participación**: N/A

**Descripción**:
- **VisibleMonths** no tiene relaciones directas con otras entidades
- Se relaciona conceptualmente con VentasSemanales a través de YearMonth
- Es una tabla de configuración del sistema

**Uso**:
- Filtra qué meses aparecen en los selectores del frontend
- Controla el acceso temporal a datos históricos
- Gestiona la visibilidad de períodos para vendedores

---

## 15.4 Diagrama de Relaciones Detallado

### Matriz de Relaciones

| Entidad Origen | Entidad Destino | Tipo | Cardinalidad | Clave Foránea |
|----------------|-----------------|------|--------------|---------------|
| Roles | Usuarios | 1:N | 1..* | RoleId |
| Usuarios | Vendedores | 1:1 | 0..1 | UserId |
| Usuarios | UserPermissions | 1:N | 0..* | UserId |
| Vendedores | VentasSemanales | 1:N | 0..* | SellerId |

---

## 15.5 Funciones y Triggers Relacionados

### Función: auth.fn_ComputePasswordHash

**Propósito**: Calcular el hash SHA2-512 de una contraseña con salt.

**Parámetros**:
- `@Password` NVARCHAR(4000): Contraseña en texto plano
- `@Salt` VARBINARY(32): Salt aleatorio

**Retorna**: VARBINARY(64) - Hash de la contraseña

**Relación**: Utilizada en auth.Usuarios para almacenar contraseñas seguras

---

### Función: ventas.fn_WeekRangesForMonth

**Propósito**: Calcular los rangos de fechas para las semanas de un mes.

**Parámetros**:
- `@Year` INT: Año
- `@Month` INT: Mes (1-12)

**Retorna**: Tabla con (WeekNo, FromDate, ToDate)

**Relación**: Utilizada para validar y autocompletar ventas.VentasSemanales

---

### Trigger: ventas.tr_VentasSemanales_ValidateAndFill

**Propósito**: Validar y autocompletar campos de VentasSemanales antes de insertar.

**Tipo**: INSTEAD OF INSERT

**Funciones**:
1. Autocompleta FromDate y ToDate basándose en YearMonth y WeekNo
2. Valida que las fechas sean correctas
3. Previene inserciones duplicadas

**Relación**: Protege la integridad de ventas.VentasSemanales

---

## 15.6 Índices Principales

### Índices en auth.Usuarios
```sql
IX_Usuarios_Username (UNIQUE) - Para búsquedas rápidas por username
```

### Índices en ventas.Vendedores
```sql
IX_Vendedores_Activo (INCLUDE Nombre) - Para filtrar vendedores activos
```

### Índices en ventas.VentasSemanales
```sql
IX_Ventas_Seller_Period (SellerId, YearMonth) INCLUDE(WeekNo, TotalUSD)
IX_Ventas_Period (YearMonth, SellerId) INCLUDE(WeekNo, TotalUSD)
```

**Propósito**: Optimizar consultas de dashboard que filtran por vendedor y/o período

---

## 15.7 Resumen de Cardinalidades

```
Roles (1) ──────── (N) Usuarios (1) ──────── (1) Vendedores (1) ──────── (N) VentasSemanales
                        │
                        └── (1) ──────── (N) UserPermissions

                   VisibleMonths (Independiente)
```

### Leyenda:
- **(1)**: Uno
- **(N)**: Muchos
- **(0..1)**: Cero o Uno (opcional)
- **(1..*)**: Uno o Muchos (obligatorio)
- **(0..*)**: Cero o Muchos (opcional)

---

## 15.8 Dependencias Funcionales

### auth.Usuarios
```
UserId → Username, RoleId, PasswordHash, Salt, IsActive, CreatedAt, LastLoginAt
Username → UserId
```

### ventas.Vendedores
```
SellerId → UserId, Nombre, Activo, CreatedAt
UserId → SellerId (relación 1:1)
```

### ventas.VentasSemanales
```
VentaId → SellerId, YearMonth, WeekNo, FromDate, ToDate, TotalUSD, CreatedAt
(SellerId, YearMonth, WeekNo) → VentaId (clave candidata)
```

### auth.UserPermissions
```
PermissionId → UserId, PermissionType, CreatedAt, UpdatedAt
UserId → PermissionType (en la práctica, 1:1)
```

### auth.VisibleMonths
```
MonthId → YearMonth, IsVisible, CreatedAt, UpdatedAt
YearMonth → MonthId (clave candidata)
```

---

## 15.9 Normalización

### Estado de Normalización: **3FN (Tercera Forma Normal)**

#### Justificación:

**1FN (Primera Forma Normal)**: ✅
- Todos los atributos contienen valores atómicos
- No hay grupos repetitivos
- Cada columna tiene un nombre único

**2FN (Segunda Forma Normal)**: ✅
- Todas las tablas están en 1FN
- No hay dependencias parciales
- Todos los atributos no clave dependen completamente de la clave primaria

**3FN (Tercera Forma Normal)**: ✅
- Todas las tablas están en 2FN
- No hay dependencias transitivas
- Todos los atributos no clave dependen solo de la clave primaria

#### Decisiones de Diseño:

1. **Separación de Roles y Usuarios**: Evita redundancia de nombres de roles
2. **Tabla Vendedores separada**: Permite extensibilidad sin modificar auth.Usuarios
3. **UserPermissions separada**: Facilita cambios de permisos sin afectar usuarios
4. **VisibleMonths independiente**: Configuración desacoplada del resto del sistema

---

## 15.10 Restricciones de Integridad Referencial

| Relación | Acción ON DELETE | Acción ON UPDATE |
|----------|------------------|------------------|
| Usuarios → Roles | NO ACTION | CASCADE |
| Vendedores → Usuarios | NO ACTION | CASCADE |
| VentasSemanales → Vendedores | NO ACTION | CASCADE |
| UserPermissions → Usuarios | CASCADE | CASCADE |

### Justificación:

- **NO ACTION en DELETE**: Preserva integridad histórica (no se pueden eliminar vendedores con ventas)
- **CASCADE en UPDATE**: Permite cambios de IDs si es necesario (raramente usado)
- **CASCADE en UserPermissions**: Si se elimina un usuario, se eliminan sus permisos automáticamente

---

**Documento generado**: 4 de noviembre de 2025  
**Versión del Sistema**: 1.0  
**Base de Datos**: ModuloAnalisis - SQL Server 2022 Express
