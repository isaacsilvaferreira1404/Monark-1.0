-- Execute primeiro, como administrador do PostgreSQL:
-- CREATE DATABASE monark_cafeteria;
-- Depois conecte-se ao banco monark_cafeteria e execute este arquivo.
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    image VARCHAR(500),
    category VARCHAR(30) NOT NULL CHECK (category IN ('cafes','bebidas','doces','salgados')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    notes VARCHAR(500),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','paid','payment_failed','cancelled','refunded','payment_error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(120) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'mercado_pago',
    preference_id VARCHAR(150),
    payment_id VARCHAR(150) UNIQUE,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

INSERT INTO products (name, description, price, image, category)
SELECT v.name, v.description, v.price, v.image, v.category
FROM (VALUES
    ('Espresso Monark', 'Café intenso, encorpado e com aroma marcante.', 8.00, 'Assets/cafe1.jpg', 'cafes'),
    ('Cappuccino', 'Café com leite cremoso e uma delicada camada de espuma.', 13.00, 'Assets/cafe2.jpg', 'cafes'),
    ('Bolo de chocolate', 'Massa macia com recheio de chocolate.', 12.00, 'Assets/doce1.jpg', 'doces'),
    ('Croissant doce', 'Massa folhada e crocante com recheio especial.', 11.00, 'Assets/doce2.jpg', 'doces'),
    ('Cold Coffee', 'Café gelado, refrescante e equilibrado.', 14.00, 'Assets/bebida1.jpg', 'bebidas'),
    ('Sanduíche artesanal', 'Pão macio com queijo e ingredientes selecionados.', 16.00, 'Assets/salgado1.jpg', 'salgados')
) AS v(name, description, price, image, category)
WHERE NOT EXISTS (SELECT 1 FROM products);
