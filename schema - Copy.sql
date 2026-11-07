-- =====================================================================
-- TorqueHub - Vehicle Service Center Management System
-- MySQL Workbench Schema & Seed Data Script
-- =====================================================================

CREATE DATABASE IF NOT EXISTS torquehub_db;
USE torquehub_db;

-- 1. CUSTOMERS TABLE
-- Stores client contact information
CREATE TABLE IF NOT EXISTS CUSTOMERS (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone BIGINT NOT NULL,              -- BIGINT supports standard 10+ digit phone numbers without overflow
    email VARCHAR(100) NOT NULL,
    address VARCHAR(125) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. VEHICLES TABLE
-- Stores vehicle information linked to customers
CREATE TABLE IF NOT EXISTS VEHICLES (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    vehicle_number VARCHAR(50) NOT NULL, -- Supports numeric or registration plates (e.g., 5489, MH02AB1234)
    vehicle_model VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_customer 
        FOREIGN KEY (customer_id) REFERENCES CUSTOMERS(customer_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. SERVICES (SERVIRCES) TABLE
-- Stores vehicle repair, maintenance, and service records
CREATE TABLE IF NOT EXISTS SERVICES (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_type VARCHAR(100) NOT NULL,
    service_date DATE NOT NULL,
    description TEXT,
    service_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(29) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PAYMENTS TABLE
-- Stores billing and transaction history linked to services
CREATE TABLE IF NOT EXISTS PAYMENTS (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash',
    status VARCHAR(20) NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_service 
        FOREIGN KEY (service_id) REFERENCES SERVICES(service_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- =====================================================================
-- Sample Starter Data (for instant testing in MySQL Workbench & TorqueHub)
-- =====================================================================

INSERT INTO CUSTOMERS (customer_id, name, phone, email, address) VALUES
(1, 'John Anderson', 9876543210, 'john.anderson@example.com', '742 Evergreen Terrace, Springfield'),
(2, 'Sarah Jenkins', 9823456781, 'sarah.j@example.com', '124 Conch Street, Pacific Bay'),
(3, 'Michael Chang', 9845123987, 'm.chang@example.com', '456 Elmwood Ave, Metro City'),
(4, 'Emily Watson', 9765432109, 'emily.w@example.com', '89 Park Lane, Oakville')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO VEHICLES (vehicle_id, customer_id, vehicle_number, vehicle_model) VALUES
(1, 1, '8492', 'Honda Civic 2021'),
(2, 2, '2301', 'Toyota RAV4 2022'),
(3, 3, '5719', 'Ford Mustang GT 2020'),
(4, 4, '9140', 'Hyundai Elantra 2023')
ON DUPLICATE KEY UPDATE vehicle_model=VALUES(vehicle_model);

INSERT INTO SERVICES (service_id, service_type, service_date, description, service_charge, status) VALUES
(1, 'Full Engine Tune-Up', '2026-11-01', 'Replaced spark plugs, synthetic oil change, filter replacements and ECU diagnostics.', 249.50, 'Completed'),
(2, 'Brake Pad Replacement', '2026-11-03', 'Front and rear ceramic brake pads replacement with rotor resurfacing.', 180.00, 'Completed'),
(3, 'Transmission Fluid Flush', '2026-11-05', 'Complete automated fluid exchange and pressure test check.', 145.00, 'In Progress'),
(4, 'Air Conditioning Servicing', '2026-11-07', 'AC refrigerant leak test, condenser cleaning and cabin air filter renewal.', 95.00, 'Pending')
ON DUPLICATE KEY UPDATE service_type=VALUES(service_type);

INSERT INTO PAYMENTS (payment_id, service_id, amount, payment_date, payment_method, status) VALUES
(1, 1, 249.50, '2026-11-01', 'Credit Card', 'Completed'),
(2, 2, 180.00, '2026-11-03', 'UPI', 'Completed'),
(3, 3, 145.00, '2026-11-05', 'Cash', 'Pending'),
(4, 4, 95.00, '2026-11-07', 'Net Banking', 'Pending')
ON DUPLICATE KEY UPDATE amount=VALUES(amount);

