-- =====================================================================================
-- SOFTWORK SOLUTIONS S.A.S. — BASE DE DATOS EMPRESARIAL
-- Sistema de Inventario, Facturación POS y Gestión Comercial
-- =====================================================================================
-- Motor:        PostgreSQL 16+
-- Codificación: UTF-8
-- Zona horaria: America/Bogota (UTC-5)
-- Moneda:       COP (Peso Colombiano)
-- Creado:       2026-08-12
-- Autor:        SoftWork Solutions — Equipo de Desarrollo
-- =====================================================================================

-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  0. CONFIGURACIÓN INICIAL, EXTENSIONES Y LIMPIEZA                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Generación de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Hashing seguro de contraseñas (bcrypt)
CREATE EXTENSION IF NOT EXISTS "citext";          -- Texto case-insensitive para emails

-- Zona horaria por defecto para la sesión
SET timezone = 'America/Bogota';

-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  1. ESQUEMAS (SCHEMAS) — Separación lógica de módulos                             ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

CREATE SCHEMA IF NOT EXISTS auth;           -- Autenticación, usuarios, sesiones, permisos
CREATE SCHEMA IF NOT EXISTS inventory;      -- Productos, categorías, stock
CREATE SCHEMA IF NOT EXISTS sales;          -- Facturas de venta, items, métodos de pago
CREATE SCHEMA IF NOT EXISTS purchasing;     -- Proveedores, facturas de compra, restock
CREATE SCHEMA IF NOT EXISTS finance;        -- Gastos, créditos, cierre de caja, nómina
CREATE SCHEMA IF NOT EXISTS audit;          -- Trazabilidad, logs de seguridad, diagnósticos

-- Asegurar que el search_path incluya todos los esquemas
SET search_path TO public, auth, inventory, sales, purchasing, finance, audit;

-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  2. TIPOS ENUMERADOS (ENUMS)                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- Roles del sistema
CREATE TYPE auth.user_role AS ENUM ('ADMIN', 'WORKER');

-- Métodos de pago para ventas
CREATE TYPE sales.payment_method AS ENUM ('CASH', 'CARD', 'NEQUI_DAVIPLATA', 'CREDIT');

-- Estado de factura de venta
CREATE TYPE sales.invoice_status AS ENUM ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- Métodos de pago para gastos
CREATE TYPE finance.expense_payment_method AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- Categorías de gastos
CREATE TYPE finance.expense_category AS ENUM (
    'Arriendo',
    'Servicios Públicos',
    'Nómina',
    'Papelería',
    'Mantenimiento',
    'Otros'
);

-- Categorías de auditoría
CREATE TYPE audit.audit_category AS ENUM (
    'SALES_VOID',
    'INVENTORY_MODIFY',
    'ENTRY_DELETE',
    'PRICE_CHANGE',
    'CREDIT_ACTION',
    'USER_MANAGEMENT',
    'SYSTEM_SECURITY'
);

-- Severidad de auditoría
CREATE TYPE audit.audit_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'INFO');

-- Acciones de diagnóstico
CREATE TYPE audit.diagnostic_action AS ENUM (
    'ROLE_SWITCH',
    'PERMISSION_CHECK',
    'INHERITANCE_VERIFY',
    'SESSION_INIT',
    'PERMISSIONS_UPDATED'
);

-- Tipo de log de diagnóstico
CREATE TYPE audit.diagnostic_type AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- Estado de cierre de caja
CREATE TYPE finance.closure_status AS ENUM ('COMPLETED');

-- Estado de pagos de nómina
CREATE TYPE finance.payroll_status AS ENUM ('PENDING', 'PAID', 'PARTIAL');


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  3. ESQUEMA: auth — USUARIOS, PERMISOS, SESIONES                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 3.1 Permisos del sistema (catálogo maestro) ────────────────────────────────────
CREATE TABLE auth.permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(64) NOT NULL UNIQUE,          -- e.g. 'view_inventory'
    category        VARCHAR(64) NOT NULL,                 -- e.g. 'INVENTORY', 'POS'
    label           VARCHAR(128) NOT NULL,                -- e.g. 'Ver catálogo de productos'
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_code ON auth.permissions (code);
CREATE INDEX idx_permissions_category ON auth.permissions (category);

-- ─── 3.2 Usuarios del sistema ───────────────────────────────────────────────────────
CREATE TABLE auth.users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    email           CITEXT NOT NULL UNIQUE,                -- Case-insensitive, único
    password_hash   TEXT NOT NULL,                          -- Hash bcrypt via pgcrypto
    role            auth.user_role NOT NULL DEFAULT 'WORKER',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    phone           VARCHAR(20),
    base_salary     NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Salario base mensual COP
    commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,      -- e.g. 0.0200 para 2%
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones de negocio
    CONSTRAINT chk_users_salary_positive CHECK (base_salary >= 0),
    CONSTRAINT chk_users_commission_range CHECK (commission_rate >= 0 AND commission_rate <= 1),
    CONSTRAINT chk_users_email_format CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
);

CREATE INDEX idx_users_email ON auth.users (email);
CREATE INDEX idx_users_role ON auth.users (role);
CREATE INDEX idx_users_active ON auth.users (active) WHERE active = TRUE;

-- ─── 3.3 Relación N:M de permisos por usuario ──────────────────────────────────────
CREATE TABLE auth.user_permissions (
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    PRIMARY KEY (user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user ON auth.user_permissions (user_id);

-- ─── 3.4 Sesiones activas (para invalidar tokens) ──────────────────────────────────
CREATE TABLE auth.sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,                         -- SHA-256 del JWT/token
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON auth.sessions (user_id);
CREATE INDEX idx_sessions_token ON auth.sessions (token_hash);
CREATE INDEX idx_sessions_active ON auth.sessions (user_id) WHERE revoked = FALSE;


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  4. ESQUEMA: inventory — PRODUCTOS, CATEGORÍAS, MOVIMIENTOS DE STOCK              ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 4.1 Categorías de productos ────────────────────────────────────────────────────
CREATE TABLE inventory.categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4.2 Productos ─────────────────────────────────────────────────────────────────
CREATE TABLE inventory.products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode         VARCHAR(50) UNIQUE,                    -- Código de barras EAN/UPC
    name            VARCHAR(200) NOT NULL,
    category_id     UUID REFERENCES inventory.categories(id) ON DELETE SET NULL,
    purchase_price  NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Precio de compra
    sale_price      NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Precio de venta al público
    tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 19,     -- % IVA (0, 5, 19 en Colombia)
    stock           INTEGER NOT NULL DEFAULT 0,
    min_stock       INTEGER NOT NULL DEFAULT 0,            -- Alerta de stock mínimo
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones de integridad comercial
    CONSTRAINT chk_products_purchase_price CHECK (purchase_price >= 0),
    CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0),
    CONSTRAINT chk_products_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 100),
    CONSTRAINT chk_products_stock CHECK (stock >= 0),
    CONSTRAINT chk_products_min_stock CHECK (min_stock >= 0),
    CONSTRAINT chk_products_margin CHECK (sale_price >= purchase_price)
);

CREATE INDEX idx_products_barcode ON inventory.products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category ON inventory.products (category_id);
CREATE INDEX idx_products_name_search ON inventory.products USING gin (to_tsvector('spanish', name));
CREATE INDEX idx_products_active ON inventory.products (active) WHERE active = TRUE;
CREATE INDEX idx_products_low_stock ON inventory.products (stock) WHERE stock <= min_stock AND active = TRUE;

-- ─── 4.3 Historial de movimientos de stock (trazabilidad) ──────────────────────────
CREATE TABLE inventory.stock_movements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES inventory.products(id) ON DELETE RESTRICT,
    movement_type   VARCHAR(30) NOT NULL,                  -- 'SALE', 'PURCHASE', 'RETURN', 'ADJUSTMENT'
    quantity         INTEGER NOT NULL,                      -- Positivo = entrada, Negativo = salida
    previous_stock  INTEGER NOT NULL,
    new_stock       INTEGER NOT NULL,
    reference_type  VARCHAR(30),                           -- 'INVOICE', 'PURCHASE_INVOICE', 'REFUND', 'MANUAL'
    reference_id    UUID,                                  -- FK polimórfica al documento origen
    performed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_stock_movement_qty CHECK (quantity <> 0),
    CONSTRAINT chk_stock_movement_consistency CHECK (new_stock = previous_stock + quantity)
);

CREATE INDEX idx_stock_movements_product ON inventory.stock_movements (product_id);
CREATE INDEX idx_stock_movements_type ON inventory.stock_movements (movement_type);
CREATE INDEX idx_stock_movements_date ON inventory.stock_movements (created_at DESC);
CREATE INDEX idx_stock_movements_reference ON inventory.stock_movements (reference_type, reference_id);


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  5. ESQUEMA: sales — CLIENTES, FACTURAS DE VENTA, DEVOLUCIONES                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 5.1 Clientes ──────────────────────────────────────────────────────────────────
CREATE TABLE sales.clients (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    nit_or_cc       VARCHAR(30) NOT NULL,                  -- Cédula o NIT colombiano
    phone           VARCHAR(20),
    email           CITEXT,
    address         TEXT,
    credit_limit    NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Límite máximo de crédito
    credit_balance  NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Saldo actual de deuda
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,        -- Consumidor Final (no borrable)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_clients_credit_limit CHECK (credit_limit >= 0),
    CONSTRAINT chk_clients_credit_balance CHECK (credit_balance >= 0),
    CONSTRAINT chk_clients_credit_overflow CHECK (credit_balance <= credit_limit OR credit_limit = 0)
);

CREATE INDEX idx_clients_nit ON sales.clients (nit_or_cc);
CREATE INDEX idx_clients_name ON sales.clients USING gin (to_tsvector('spanish', name));
CREATE INDEX idx_clients_active ON sales.clients (active) WHERE active = TRUE;

-- ─── 5.2 Facturas de venta (cabecera) ──────────────────────────────────────────────
CREATE TABLE sales.invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number  VARCHAR(20) NOT NULL UNIQUE,           -- FV-1001, FV-1002, etc.
    client_id       UUID NOT NULL REFERENCES sales.clients(id) ON DELETE RESTRICT,
    subtotal        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method  sales.payment_method NOT NULL,
    status          sales.invoice_status NOT NULL DEFAULT 'PAID',
    seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    received_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Efectivo recibido del cliente
    change_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,     -- Cambio devuelto
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_invoices_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_invoices_tax CHECK (tax_amount >= 0),
    CONSTRAINT chk_invoices_total CHECK (total >= 0),
    CONSTRAINT chk_invoices_total_consistency CHECK (total = subtotal + tax_amount),
    CONSTRAINT chk_invoices_received CHECK (received_amount >= 0),
    CONSTRAINT chk_invoices_change CHECK (change_amount >= 0)
);

CREATE INDEX idx_invoices_number ON sales.invoices (invoice_number);
CREATE INDEX idx_invoices_client ON sales.invoices (client_id);
CREATE INDEX idx_invoices_seller ON sales.invoices (seller_id);
CREATE INDEX idx_invoices_status ON sales.invoices (status);
CREATE INDEX idx_invoices_date ON sales.invoices (created_at DESC);
CREATE INDEX idx_invoices_payment ON sales.invoices (payment_method);

-- ─── 5.3 Ítems de factura (detalle) ────────────────────────────────────────────────
CREATE TABLE sales.invoice_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id      UUID NOT NULL REFERENCES sales.invoices(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES inventory.products(id) ON DELETE RESTRICT,
    product_name    VARCHAR(200) NOT NULL,                 -- Snapshot del nombre al momento de venta
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(15, 2) NOT NULL,               -- Precio unitario al momento de venta
    tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,      -- % IVA aplicado
    line_total      NUMERIC(15, 2) NOT NULL,               -- qty × price

    CONSTRAINT chk_inv_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_inv_items_price CHECK (unit_price >= 0),
    CONSTRAINT chk_inv_items_total CHECK (line_total >= 0)
);

CREATE INDEX idx_invoice_items_invoice ON sales.invoice_items (invoice_id);
CREATE INDEX idx_invoice_items_product ON sales.invoice_items (product_id);

-- ─── 5.4 Devoluciones / Reembolsos ─────────────────────────────────────────────────
CREATE TABLE sales.refunds (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_number   VARCHAR(20) NOT NULL UNIQUE,           -- REF-1001, REF-1002, etc.
    invoice_id      UUID NOT NULL REFERENCES sales.invoices(id) ON DELETE RESTRICT,
    total_refunded  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    restocked       BOOLEAN NOT NULL DEFAULT FALSE,        -- ¿Se reingresó la mercancía?
    processed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_refunds_total CHECK (total_refunded >= 0)
);

CREATE INDEX idx_refunds_invoice ON sales.refunds (invoice_id);
CREATE INDEX idx_refunds_date ON sales.refunds (created_at DESC);

-- ─── 5.5 Ítems de devolución (detalle) ─────────────────────────────────────────────
CREATE TABLE sales.refund_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id       UUID NOT NULL REFERENCES sales.refunds(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES inventory.products(id) ON DELETE RESTRICT,
    product_name    VARCHAR(200) NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(15, 2) NOT NULL,
    reason          TEXT NOT NULL,

    CONSTRAINT chk_refund_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_refund_items_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_refund_items_refund ON sales.refund_items (refund_id);


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  6. ESQUEMA: purchasing — PROVEEDORES Y FACTURAS DE COMPRA                        ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 6.1 Proveedores ───────────────────────────────────────────────────────────────
CREATE TABLE purchasing.suppliers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    nit             VARCHAR(30) NOT NULL,                   -- NIT del proveedor
    phone           VARCHAR(20),
    email           CITEXT,
    address         TEXT,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_nit ON purchasing.suppliers (nit);
CREATE INDEX idx_suppliers_name ON purchasing.suppliers USING gin (to_tsvector('spanish', name));
CREATE INDEX idx_suppliers_active ON purchasing.suppliers (active) WHERE active = TRUE;

-- ─── 6.2 Facturas de compra (cabecera) ─────────────────────────────────────────────
CREATE TABLE purchasing.purchase_invoices (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number     VARCHAR(20) NOT NULL UNIQUE,       -- FC-1001, etc. (interno)
    supplier_invoice    VARCHAR(50),                        -- Número de factura del proveedor
    supplier_id         UUID NOT NULL REFERENCES purchasing.suppliers(id) ON DELETE RESTRICT,
    total               NUMERIC(15, 2) NOT NULL DEFAULT 0,
    received_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_purchase_total CHECK (total >= 0)
);

CREATE INDEX idx_purchase_invoices_supplier ON purchasing.purchase_invoices (supplier_id);
CREATE INDEX idx_purchase_invoices_date ON purchasing.purchase_invoices (created_at DESC);

-- ─── 6.3 Ítems de factura de compra (detalle) ──────────────────────────────────────
CREATE TABLE purchasing.purchase_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_invoice_id UUID NOT NULL REFERENCES purchasing.purchase_invoices(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES inventory.products(id) ON DELETE RESTRICT,
    product_name        VARCHAR(200) NOT NULL,
    quantity            INTEGER NOT NULL,
    purchase_price      NUMERIC(15, 2) NOT NULL,
    line_total          NUMERIC(15, 2) NOT NULL,

    CONSTRAINT chk_purchase_items_qty CHECK (quantity > 0),
    CONSTRAINT chk_purchase_items_price CHECK (purchase_price >= 0),
    CONSTRAINT chk_purchase_items_total CHECK (line_total >= 0)
);

CREATE INDEX idx_purchase_items_invoice ON purchasing.purchase_items (purchase_invoice_id);
CREATE INDEX idx_purchase_items_product ON purchasing.purchase_items (product_id);


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  7. ESQUEMA: finance — GASTOS, CRÉDITOS, CIERRE DE CAJA, NÓMINA                  ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 7.1 Gastos / Egresos ──────────────────────────────────────────────────────────
CREATE TABLE finance.expenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_number  VARCHAR(20) NOT NULL UNIQUE,           -- G-1001, etc.
    category        finance.expense_category NOT NULL,
    description     TEXT NOT NULL,
    amount          NUMERIC(15, 2) NOT NULL,
    payment_method  finance.expense_payment_method NOT NULL,
    registered_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_expenses_amount CHECK (amount > 0)
);

CREATE INDEX idx_expenses_category ON finance.expenses (category);
CREATE INDEX idx_expenses_date ON finance.expenses (created_at DESC);
CREATE INDEX idx_expenses_payment ON finance.expenses (payment_method);

-- ─── 7.2 Pagos de crédito (abonos de clientes) ────────────────────────────────────
CREATE TABLE finance.credit_payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id       UUID NOT NULL REFERENCES sales.clients(id) ON DELETE RESTRICT,
    amount          NUMERIC(15, 2) NOT NULL,
    payment_method  sales.payment_method NOT NULL,
    previous_balance NUMERIC(15, 2) NOT NULL,
    new_balance     NUMERIC(15, 2) NOT NULL,
    received_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_credit_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_credit_payment_balance CHECK (new_balance >= 0),
    CONSTRAINT chk_credit_payment_consistency CHECK (new_balance = previous_balance - amount)
);

CREATE INDEX idx_credit_payments_client ON finance.credit_payments (client_id);
CREATE INDEX idx_credit_payments_date ON finance.credit_payments (created_at DESC);

-- ─── 7.3 Cierre de caja (arqueo) ───────────────────────────────────────────────────
CREATE TABLE finance.cash_register_closures (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    closure_number      VARCHAR(20) NOT NULL UNIQUE,       -- CLO-XXXXXXXXXX
    closed_by           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    opened_at           TIMESTAMPTZ NOT NULL,
    closed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Valores calculados por el sistema
    opening_balance     NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cash_sales          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    card_sales          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    electronic_sales    NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- Nequi / Daviplata
    credit_sales        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_sales         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cash_expenses       NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expected_cash       NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- Efectivo esperado en caja

    -- Valores contados manualmente
    counted_cash        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    counted_card        NUMERIC(15, 2) NOT NULL DEFAULT 0,
    counted_electronic  NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Discrepancia (positivo = sobrante, negativo = faltante)
    cash_discrepancy    NUMERIC(15, 2) NOT NULL DEFAULT 0,
    observations        TEXT,
    status              finance.closure_status NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT chk_closure_dates CHECK (closed_at >= opened_at),
    CONSTRAINT chk_closure_discrepancy CHECK (cash_discrepancy = counted_cash - expected_cash)
);

CREATE INDEX idx_closures_user ON finance.cash_register_closures (closed_by);
CREATE INDEX idx_closures_date ON finance.cash_register_closures (closed_at DESC);

-- ─── 7.4 Nómina — Periodos de pago ────────────────────────────────────────────────
CREATE TABLE finance.payroll_periods (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    description     VARCHAR(100),                          -- e.g. "Quincena 1 - Agosto 2026"
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payroll_dates CHECK (period_end >= period_start)
);

CREATE INDEX idx_payroll_periods_dates ON finance.payroll_periods (period_start, period_end);

-- ─── 7.5 Nómina — Detalle por empleado ────────────────────────────────────────────
CREATE TABLE finance.payroll_entries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_period_id   UUID NOT NULL REFERENCES finance.payroll_periods(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    base_salary         NUMERIC(15, 2) NOT NULL DEFAULT 0,
    sales_total         NUMERIC(15, 2) NOT NULL DEFAULT 0, -- Ventas realizadas en el periodo
    commission_rate     NUMERIC(5, 4) NOT NULL DEFAULT 0,
    commission_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0, -- sales_total × commission_rate
    deductions          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    bonuses             NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_pay             NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status              finance.payroll_status NOT NULL DEFAULT 'PENDING',
    paid_at             TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payroll_salary CHECK (base_salary >= 0),
    CONSTRAINT chk_payroll_net CHECK (net_pay >= 0),
    CONSTRAINT uq_payroll_period_user UNIQUE (payroll_period_id, user_id)
);

CREATE INDEX idx_payroll_entries_period ON finance.payroll_entries (payroll_period_id);
CREATE INDEX idx_payroll_entries_user ON finance.payroll_entries (user_id);
CREATE INDEX idx_payroll_entries_status ON finance.payroll_entries (status);


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  8. ESQUEMA: audit — TRAZABILIDAD Y SEGURIDAD                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 8.1 Audit Trail — Registro de operaciones críticas ───────────────────────────
CREATE TABLE audit.audit_trail (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_code      VARCHAR(30) NOT NULL UNIQUE,           -- AUD-2026-XXXX
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name       VARCHAR(150) NOT NULL,
    user_role       VARCHAR(20) NOT NULL,
    category        audit.audit_category NOT NULL,
    severity        audit.audit_severity NOT NULL,
    action          VARCHAR(100) NOT NULL,                  -- e.g. 'ANULAR_FACTURA'
    entity_id       VARCHAR(100),                           -- ID de la entidad afectada
    entity_name     VARCHAR(200),                           -- Nombre descriptivo
    details         TEXT NOT NULL,                          -- Descripción completa
    ip_address      INET,
    previous_state  TEXT,                                   -- Estado anterior (snapshot)
    new_state       TEXT,                                   -- Estado nuevo (snapshot)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_trail_user ON audit.audit_trail (user_id);
CREATE INDEX idx_audit_trail_category ON audit.audit_trail (category);
CREATE INDEX idx_audit_trail_severity ON audit.audit_trail (severity);
CREATE INDEX idx_audit_trail_action ON audit.audit_trail (action);
CREATE INDEX idx_audit_trail_date ON audit.audit_trail (created_at DESC);
CREATE INDEX idx_audit_trail_entity ON audit.audit_trail (entity_id);

-- ─── 8.2 Diagnostic Logs — Logs de sesión y verificación de permisos ──────────────
CREATE TABLE audit.diagnostic_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         VARCHAR(150) NOT NULL,                  -- Puede ser email
    user_name       VARCHAR(150) NOT NULL,
    role            VARCHAR(20) NOT NULL,
    action          audit.diagnostic_action NOT NULL,
    permission      VARCHAR(64),                            -- Permiso evaluado (si aplica)
    result          BOOLEAN NOT NULL,
    message         TEXT NOT NULL,
    log_type        audit.diagnostic_type NOT NULL DEFAULT 'INFO',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnostic_user ON audit.diagnostic_logs (user_id);
CREATE INDEX idx_diagnostic_action ON audit.diagnostic_logs (action);
CREATE INDEX idx_diagnostic_date ON audit.diagnostic_logs (created_at DESC);

-- Política de retención: los logs diagnósticos antiguos se pueden purgar
COMMENT ON TABLE audit.diagnostic_logs IS 
    'Logs de diagnóstico del sistema de autenticación. Retención recomendada: 30 días.';


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  9. TRIGGERS — ACTUALIZACIÓN AUTOMÁTICA DE updated_at                             ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas que tienen updated_at
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON inventory.categories
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON inventory.products
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON purchasing.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON sales.clients
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  10. TRIGGER — PROTECCIÓN DE ELIMINACIÓN DEL CLIENTE POR DEFECTO                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION sales.fn_protect_default_client()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_default = TRUE THEN
        RAISE EXCEPTION 'No se puede eliminar el cliente "Consumidor Final". Es un registro protegido del sistema.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_default_client
    BEFORE DELETE ON sales.clients
    FOR EACH ROW EXECUTE FUNCTION sales.fn_protect_default_client();


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  11. TRIGGER — GENERACIÓN AUTOMÁTICA DE NÚMEROS SECUENCIALES                     ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- Secuencia para facturas de venta
CREATE SEQUENCE IF NOT EXISTS sales.seq_invoice_number START WITH 1001 INCREMENT BY 1;

-- Secuencia para devoluciones
CREATE SEQUENCE IF NOT EXISTS sales.seq_refund_number START WITH 1001 INCREMENT BY 1;

-- Secuencia para facturas de compra
CREATE SEQUENCE IF NOT EXISTS purchasing.seq_purchase_number START WITH 1001 INCREMENT BY 1;

-- Secuencia para gastos
CREATE SEQUENCE IF NOT EXISTS finance.seq_expense_number START WITH 1001 INCREMENT BY 1;


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  12. DATOS SEMILLA (SEED DATA)                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 12.1 Permisos del sistema ─────────────────────────────────────────────────────
INSERT INTO auth.permissions (code, category, label) VALUES
    -- Inventario
    ('view_inventory',          'INVENTORY',    'Ver catálogo de productos'),
    ('create_product',          'INVENTORY',    'Crear nuevos productos'),
    ('edit_product',            'INVENTORY',    'Editar productos'),
    ('delete_product',          'INVENTORY',    'Eliminar productos'),
    ('manage_categories',       'INVENTORY',    'Gestionar categorías'),
    -- Clientes
    ('view_clients',            'CLIENTS',      'Ver base de clientes'),
    ('create_client',           'CLIENTS',      'Registrar nuevos clientes'),
    ('edit_client',             'CLIENTS',      'Editar información de clientes'),
    ('delete_client',           'CLIENTS',      'Eliminar clientes'),
    -- Créditos
    ('view_credits',            'CREDITS',      'Ver créditos vigentes'),
    ('process_credit_payment',  'CREDITS',      'Registrar abonos / pagos'),
    ('create_credit',           'CREDITS',      'Asignar nuevos cupos de crédito'),
    ('delete_credit',           'CREDITS',      'Eliminar historiales de crédito'),
    -- Gastos
    ('view_expenses',           'EXPENSES',     'Ver registro de gastos'),
    ('create_expense',          'EXPENSES',     'Registrar nuevos gastos'),
    ('edit_expense',            'EXPENSES',     'Modificar registros de gastos'),
    ('delete_expense',          'EXPENSES',     'Eliminar comprobantes de gastos'),
    -- Proveedores
    ('view_suppliers',          'SUPPLIERS',    'Ver listado de proveedores'),
    ('create_supplier',         'SUPPLIERS',    'Crear proveedores'),
    ('edit_supplier',           'SUPPLIERS',    'Editar proveedores'),
    ('delete_supplier',         'SUPPLIERS',    'Eliminar proveedores'),
    ('record_purchase_invoice', 'SUPPLIERS',    'Ingresar facturas de compra (Stock)'),
    -- Nómina
    ('view_payroll',            'PAYROLL',      'Ver nómina y registros de pago'),
    ('manage_workers',          'PAYROLL',      'Crear/Editar trabajadores'),
    ('calculate_payroll',       'PAYROLL',      'Calcular salarios y comisiones'),
    ('record_payment',          'PAYROLL',      'Registrar pagos y anticipos'),
    -- Usuarios
    ('view_users',              'USERS',        'Ver lista de usuarios'),
    ('create_user',             'USERS',        'Crear cuentas de usuario'),
    ('edit_user',               'USERS',        'Modificar cuentas y permisos'),
    ('delete_user',             'USERS',        'Eliminar cuentas de usuario'),
    -- POS
    ('access_pos',              'POS',          'Ingresar al módulo de facturación'),
    ('close_cash_register',     'POS',          'Realizar arqueo y cierre de caja'),
    ('manage_returns',          'POS',          'Procesar devoluciones y reembolsos'),
    ('view_sales_history',      'POS',          'Ver historial de facturas emitidas'),
    ('delete_invoice',          'POS',          'Eliminar facturas del registro')
ON CONFLICT (code) DO NOTHING;

-- ─── 12.2 Usuarios por defecto ─────────────────────────────────────────────────────
-- Contraseña hasheada con pgcrypto (bcrypt). 
-- admin → hash de 'admin', cajero → hash de 'cajero'
INSERT INTO auth.users (id, name, email, password_hash, role, active, phone, base_salary, commission_rate) VALUES
    (
        uuid_generate_v4(),
        'Administrador General',
        'admin@softwork.co',
        crypt('admin', gen_salt('bf', 12)),
        'ADMIN',
        TRUE,
        '3001234567',
        2500000.00,
        0.0000
    ),
    (
        uuid_generate_v4(),
        'Carlos Cajero (Vendedor)',
        'cajero@softwork.co',
        crypt('cajero', gen_salt('bf', 12)),
        'WORKER',
        TRUE,
        '3119876543',
        1300000.00,
        0.0200
    );

-- Asignar TODOS los permisos al admin
INSERT INTO auth.user_permissions (user_id, permission_id)
SELECT u.id, p.id
FROM auth.users u
CROSS JOIN auth.permissions p
WHERE u.email = 'admin@softwork.co';

-- Asignar permisos específicos al cajero
INSERT INTO auth.user_permissions (user_id, permission_id)
SELECT u.id, p.id
FROM auth.users u
JOIN auth.permissions p ON p.code IN (
    'view_inventory',
    'view_clients',
    'create_client',
    'edit_client',
    'view_credits',
    'process_credit_payment',
    'access_pos',
    'close_cash_register',
    'view_sales_history'
)
WHERE u.email = 'cajero@softwork.co';

-- ─── 12.3 Categorías de productos ──────────────────────────────────────────────────
INSERT INTO inventory.categories (name, description) VALUES
    ('Alimentos y Abarrotes',   'Productos de consumo diario, granos, aceites y víveres'),
    ('Tecnología',              'Periféricos, cables, accesorios de cómputo y oficina'),
    ('Ferretería y Eléctricos', 'Herramientas, bombillos, cables eléctricos y repuestos'),
    ('Bebidas',                 'Gaseosas, refrescos, aguas y jugos embotellados')
ON CONFLICT (name) DO NOTHING;

-- ─── 12.4 Cliente por defecto (Consumidor Final) ───────────────────────────────────
INSERT INTO sales.clients (name, nit_or_cc, phone, email, address, credit_limit, credit_balance, is_default) VALUES
    ('Consumidor Final (Público General)', '222222222222', 'N/A', 'consumidor@softwork.co', 'Ventas de Mostrador', 0, 0, TRUE);

-- ─── 12.5 Proveedores por defecto ──────────────────────────────────────────────────
INSERT INTO purchasing.suppliers (name, nit, phone, email, address) VALUES
    ('Alquería de Colombia S.A.',           '860.005.432-1',    '3104561234',   'ventas@alqueria.co',       'Km 5 Vía Chía, Cundinamarca'),
    ('Distribuidora Nacional de Granos',    '900.222.111-9',    '3185559876',   'pedidos@gricol.com',       'Carrera 30 # 12 - 45, Bogotá'),
    ('Insumos y Accesorios del Caribe',     '890.333.555-4',    '3158882244',   'contacto@iacaribe.co',     'Vía 40 # 70 - 12, Barranquilla');


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  13. VISTAS — CONSULTAS PRECONSTRUIDAS PARA EL DASHBOARD                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- ─── 13.1 Vista: Productos con stock bajo ──────────────────────────────────────────
CREATE OR REPLACE VIEW inventory.vw_low_stock_products AS
SELECT
    p.id,
    p.barcode,
    p.name,
    c.name AS category_name,
    p.stock,
    p.min_stock,
    p.sale_price,
    (p.min_stock - p.stock) AS units_deficit
FROM inventory.products p
LEFT JOIN inventory.categories c ON c.id = p.category_id
WHERE p.active = TRUE
  AND p.stock <= p.min_stock
ORDER BY units_deficit DESC;

-- ─── 13.2 Vista: Resumen financiero de ventas diarias ──────────────────────────────
CREATE OR REPLACE VIEW sales.vw_daily_sales_summary AS
SELECT
    DATE(i.created_at AT TIME ZONE 'America/Bogota') AS sale_date,
    COUNT(*) AS total_invoices,
    SUM(i.subtotal) AS subtotal,
    SUM(i.tax_amount) AS tax_collected,
    SUM(i.total) AS gross_total,
    SUM(CASE WHEN i.payment_method = 'CASH' THEN i.total ELSE 0 END) AS cash_total,
    SUM(CASE WHEN i.payment_method = 'CARD' THEN i.total ELSE 0 END) AS card_total,
    SUM(CASE WHEN i.payment_method = 'NEQUI_DAVIPLATA' THEN i.total ELSE 0 END) AS electronic_total,
    SUM(CASE WHEN i.payment_method = 'CREDIT' THEN i.total ELSE 0 END) AS credit_total
FROM sales.invoices i
WHERE i.status = 'PAID'
GROUP BY DATE(i.created_at AT TIME ZONE 'America/Bogota')
ORDER BY sale_date DESC;

-- ─── 13.3 Vista: Top vendedores por ventas ─────────────────────────────────────────
CREATE OR REPLACE VIEW sales.vw_top_sellers AS
SELECT
    u.id AS seller_id,
    u.name AS seller_name,
    u.commission_rate,
    COUNT(i.id) AS total_invoices,
    COALESCE(SUM(i.total), 0) AS total_sales,
    COALESCE(SUM(i.total) * u.commission_rate, 0) AS estimated_commission
FROM auth.users u
LEFT JOIN sales.invoices i ON i.seller_id = u.id AND i.status = 'PAID'
WHERE u.active = TRUE
GROUP BY u.id, u.name, u.commission_rate
ORDER BY total_sales DESC;

-- ─── 13.4 Vista: Clientes con crédito activo ──────────────────────────────────────
CREATE OR REPLACE VIEW sales.vw_clients_with_credit AS
SELECT
    c.id,
    c.name,
    c.nit_or_cc,
    c.phone,
    c.credit_limit,
    c.credit_balance,
    (c.credit_limit - c.credit_balance) AS available_credit,
    ROUND((c.credit_balance / NULLIF(c.credit_limit, 0)) * 100, 1) AS utilization_pct
FROM sales.clients c
WHERE c.active = TRUE
  AND c.credit_limit > 0
ORDER BY c.credit_balance DESC;

-- ─── 13.5 Vista: Resumen de auditoría reciente ────────────────────────────────────
CREATE OR REPLACE VIEW audit.vw_recent_critical_events AS
SELECT
    a.audit_code,
    a.created_at,
    a.user_name,
    a.user_role,
    a.category,
    a.severity,
    a.action,
    a.entity_name,
    a.details
FROM audit.audit_trail a
WHERE a.severity IN ('CRITICAL', 'HIGH')
ORDER BY a.created_at DESC
LIMIT 50;


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  14. PRIVILEGIOS Y SEGURIDAD — ROW LEVEL SECURITY (RLS)                          ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- Crear roles de aplicación (para futura conexión desde backend NestJS/Express)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'softwork_app') THEN
        CREATE ROLE softwork_app WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'softwork_readonly') THEN
        CREATE ROLE softwork_readonly WITH LOGIN PASSWORD 'CHANGE_ME_READONLY';
    END IF;
END $$;

-- Permisos de esquema
GRANT USAGE ON SCHEMA auth, inventory, sales, purchasing, finance, audit TO softwork_app;
GRANT USAGE ON SCHEMA auth, inventory, sales, purchasing, finance, audit TO softwork_readonly;

-- softwork_app: CRUD completo
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO softwork_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inventory TO softwork_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales TO softwork_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA purchasing TO softwork_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance TO softwork_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA audit TO softwork_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sales TO softwork_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA purchasing TO softwork_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA finance TO softwork_app;

-- softwork_readonly: Solo lectura
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO softwork_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA inventory TO softwork_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO softwork_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA purchasing TO softwork_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA finance TO softwork_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA audit TO softwork_readonly;

-- Actualizar permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA sales GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA purchasing GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO softwork_app;

-- Habilitar RLS en tablas sensibles
ALTER TABLE audit.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.diagnostic_logs ENABLE ROW LEVEL SECURITY;

-- Política: softwork_app puede ver todos los registros de auditoría
CREATE POLICY audit_trail_full_access ON audit.audit_trail
    FOR ALL TO softwork_app USING (TRUE);

CREATE POLICY diagnostic_logs_full_access ON audit.diagnostic_logs
    FOR ALL TO softwork_app USING (TRUE);

-- Política: readonly solo puede ver registros de su propio usuario (futuro)
-- Esta se refinará cuando se implemente JWT con current_setting('app.current_user_id')


-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  FIN DEL SCRIPT DE CREACIÓN — SoftWork Solutions S.A.S.                           ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝

-- Verificación rápida:
-- SELECT schemaname, tablename FROM pg_tables 
-- WHERE schemaname IN ('auth', 'inventory', 'sales', 'purchasing', 'finance', 'audit')
-- ORDER BY schemaname, tablename;
