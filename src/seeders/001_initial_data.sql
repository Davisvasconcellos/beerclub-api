-- Seeders: Initial Data
-- Description: Inserts initial data for the BeerClub system

-- Insert Plans
INSERT INTO plans (name, description, price) VALUES
('Basic', 'Plano básico com desconto de 5%', 29.90),
('Premium', 'Plano premium com desconto de 10%', 49.90),
('Gold', 'Plano gold com desconto de 15%', 79.90);

-- Insert Stores
INSERT INTO stores (name, legal_responsible, email, cnpj, logo_url, instagram_handle, facebook_handle) VALUES
('Bar do João', 'João Silva', 'joao@bardojoao.com', '12.345.678/0001-90', 'https://example.com/logo1.jpg', '@bardojoao', 'bardojoao'),
('Cervejaria Artesanal', 'Maria Santos', 'maria@cervejaria.com', '98.765.432/0001-10', 'https://example.com/logo2.jpg', '@cervejariaartesanal', 'cervejariaartesanal'),
('Pub Irlandês', 'Pedro O\'Connor', 'pedro@pubirlandes.com', '11.222.333/0001-44', 'https://example.com/logo3.jpg', '@pubirlandes', 'pubirlandes');

-- Insert Users (password: 123456)
INSERT INTO users (name, email, phone, password_hash, role, plan_id, plan_start, plan_end) VALUES
('Admin Master', 'admin@beerclub.com', '(11) 99999-9999', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'admin', 3, '2024-01-01', '2024-12-31'),
('João Silva', 'joao@bardojoao.com', '(11) 88888-8888', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'manager', 2, '2024-01-01', '2024-12-31'),
('Maria Santos', 'maria@cervejaria.com', '(11) 77777-7777', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'manager', 2, '2024-01-01', '2024-12-31'),
('Pedro O\'Connor', 'pedro@pubirlandes.com', '(11) 66666-6666', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'manager', 1, '2024-01-01', '2024-12-31'),
('Garçom 1', 'garcom1@bardojoao.com', '(11) 55555-5555', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'waiter', NULL, NULL, NULL),
('Garçom 2', 'garcom2@cervejaria.com', '(11) 44444-4444', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'waiter', NULL, NULL, NULL),
('Cliente 1', 'cliente1@email.com', '(11) 33333-3333', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'customer', 2, '2024-01-01', '2024-12-31'),
('Cliente 2', 'cliente2@email.com', '(11) 22222-2222', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', 'customer', 1, '2024-01-01', '2024-12-31');

-- Insert Store Users
INSERT INTO store_users (user_id, store_id, role) VALUES
(2, 1, 'admin'),    -- João é admin do Bar do João
(3, 2, 'admin'),    -- Maria é admin da Cervejaria
(4, 3, 'admin'),    -- Pedro é admin do Pub Irlandês
(5, 1, 'waiter'),   -- Garçom 1 trabalha no Bar do João
(6, 2, 'waiter');   -- Garçom 2 trabalha na Cervejaria

-- Insert Products
INSERT INTO products (store_id, name, description, image_url, normal_price, price_plan_1, price_plan_2, price_plan_3, stock) VALUES
-- Bar do João
(1, 'Chopp Brahma', 'Chopp Brahma 300ml', 'https://example.com/chopp-brahma.jpg', 8.00, 7.60, 7.20, 6.80, 50),
(1, 'Chopp Heineken', 'Chopp Heineken 300ml', 'https://example.com/chopp-heineken.jpg', 12.00, 11.40, 10.80, 10.20, 30),
(1, 'Porção de Fritas', 'Porção de batatas fritas', 'https://example.com/fritas.jpg', 22.00, 20.90, 19.80, 18.70, 20),
(1, 'Porção de Calabresa', 'Porção de calabresa acebolada', 'https://example.com/calabresa.jpg', 28.00, 26.60, 25.20, 23.80, 15),

-- Cervejaria Artesanal
(2, 'IPA Artesanal', 'India Pale Ale artesanal', 'https://example.com/ipa.jpg', 18.00, 17.10, 16.20, 15.30, 25),
(2, 'Stout Artesanal', 'Stout artesanal', 'https://example.com/stout.jpg', 20.00, 19.00, 18.00, 17.00, 20),
(2, 'Pilsen Artesanal', 'Pilsen artesanal', 'https://example.com/pilsen.jpg', 16.00, 15.20, 14.40, 13.60, 30),
(2, 'Combo Petisco', 'Combo com porção + cerveja', 'https://example.com/combo.jpg', 35.00, 33.25, 31.50, 29.75, 10),

-- Pub Irlandês
(3, 'Guinness', 'Guinness 500ml', 'https://example.com/guinness.jpg', 25.00, 23.75, 22.50, 21.25, 20),
(3, 'Whisky Jameson', 'Jameson Irish Whisky', 'https://example.com/jameson.jpg', 35.00, 33.25, 31.50, 29.75, 15),
(3, 'Fish & Chips', 'Fish & Chips tradicional', 'https://example.com/fish-chips.jpg', 45.00, 42.75, 40.50, 38.25, 8),
(3, 'Shepherd\'s Pie', 'Shepherd\'s Pie caseiro', 'https://example.com/shepherds-pie.jpg', 38.00, 36.10, 34.20, 32.30, 12); 