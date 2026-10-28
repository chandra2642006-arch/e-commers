-- =============================================================================
-- Order Exception Control Tower
-- Database: order_exception_control_tower
-- Idempotent — safe to run multiple times (uses IF NOT EXISTS + ON DUPLICATE KEY)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS order_exception_control_tower
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE order_exception_control_tower;

-- -----------------------------------------------------------------------------
-- 1. products
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150)   NOT NULL UNIQUE,
    description  TEXT,
    price        DECIMAL(10,2)  NOT NULL,
    stock_qty    INT            NOT NULL DEFAULT 0,
    is_active    TINYINT(1)     NOT NULL DEFAULT 1,
    created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_price      CHECK (price    >= 0),
    CONSTRAINT chk_stock_qty  CHECK (stock_qty >= 0)
);

-- -----------------------------------------------------------------------------
-- 2. orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    order_id        VARCHAR(40)    PRIMARY KEY,
    customer_name   VARCHAR(150)   NOT NULL,
    customer_email  VARCHAR(200)   NOT NULL,
    customer_phone  VARCHAR(20)    NOT NULL,
    address_line    VARCHAR(300)   NOT NULL,
    city            VARCHAR(100)   NOT NULL,
    pincode         VARCHAR(20)    NOT NULL,
    total_amount    DECIMAL(10,2)  NOT NULL,
    payment_method  ENUM('ONLINE','COD')  NOT NULL,
    payment_status  ENUM('PENDING','PAID','FAILED','PAY_ON_DELIVERY','REFUNDED')
                    NOT NULL DEFAULT 'PENDING',
    order_status    ENUM(
                        'ORDER_PLACED','CONFIRMED','EXCEPTION',
                        'READY_TO_SHIP','DISPATCHED','DELIVERED','CANCELLED'
                    ) NOT NULL DEFAULT 'ORDER_PLACED',
    notes           TEXT,
    estimated_delivery_time VARCHAR(100) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_total CHECK (total_amount >= 0)
);

-- -----------------------------------------------------------------------------
-- 3. order_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    item_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id    VARCHAR(40)   NOT NULL,
    product_id  INT           NOT NULL,
    quantity    INT           NOT NULL,
    unit_price  DECIMAL(10,2) NOT NULL,
    subtotal    DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    CONSTRAINT chk_item_qty  CHECK (quantity  > 0),
    CONSTRAINT chk_subtotal  CHECK (subtotal >= 0)
);

-- -----------------------------------------------------------------------------
-- 4. order_exceptions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_exceptions (
    exception_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        VARCHAR(40)  NOT NULL,
    exception_type  VARCHAR(100) NOT NULL,
    severity        ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
    owner_team      VARCHAR(100) NOT NULL,
    description     TEXT         NOT NULL,
    exception_status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_exc_order  (order_id),
    INDEX idx_exc_status (exception_status),
    INDEX idx_exc_severity (severity)
);

-- -----------------------------------------------------------------------------
-- 5. workflow_events  (idempotency key: event_uid)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_events (
    event_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id        VARCHAR(40)   NULL,
    event_uid       VARCHAR(120)  NOT NULL UNIQUE,   -- dedup key
    event_type      VARCHAR(80)   NOT NULL,
    processing_status ENUM('RECEIVED','PROCESSED','FAILED','DEAD_LETTER')
                      NOT NULL DEFAULT 'RECEIVED',
    payload_summary TEXT,
    received_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP NULL,
    INDEX idx_we_order (order_id),
    INDEX idx_we_uid   (event_uid)
);

-- -----------------------------------------------------------------------------
-- 6. audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor       VARCHAR(100) NOT NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80)  NOT NULL,
    entity_id   VARCHAR(80)  NOT NULL,
    summary     TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_al_entity (entity_type, entity_id),
    INDEX idx_al_actor  (actor)
);

-- -----------------------------------------------------------------------------
-- Seed data — idempotent
-- -----------------------------------------------------------------------------
INSERT INTO products (name, description, price, stock_qty, is_active) VALUES
    ('Wireless Headphones',
     'Bluetooth 5.3, 40-hour battery, active noise cancellation, foldable design.',
     2499.00, 10, 1),
    ('Mechanical Keyboard',
     'TKL layout, tactile blue switches, RGB backlight, USB-C detachable cable.',
     3999.00, 8, 1),
    ('Ergonomic Mouse',
     'Vertical grip, 6 programmable buttons, 4000 DPI, silent click.',
     1299.00, 15, 1),
    ('Smart Watch',
     'Health tracking, GPS, 7-day battery, IP68 waterproof, AMOLED display.',
     7999.00, 5, 1),
    ('USB-C Hub 7-in-1',
     'HDMI 4K, 3x USB-A, SD card, 100W PD charging, aluminium shell.',
     1599.00, 20, 1),
    ('Laptop Stand',
     'Adjustable aluminium stand, 10–15 inch, ergonomic angle, portable.',
     799.00, 25, 1)
ON DUPLICATE KEY UPDATE
    price     = VALUES(price),
    stock_qty = IF(stock_qty = 0, VALUES(stock_qty), stock_qty),
    is_active = VALUES(is_active);
