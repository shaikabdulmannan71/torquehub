const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// In-memory query log for live workbench inspector
const queryLogs = [];
function logQuery(sql, params, durationMs, success, error = null) {
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    sql: formatSqlWithParams(sql, params),
    rawSql: sql,
    params,
    durationMs,
    success,
    error: error ? error.message : null
  };
  queryLogs.unshift(logEntry);
  if (queryLogs.length > 80) queryLogs.pop();
  return logEntry;
}

function formatSqlWithParams(sql, params) {
  if (!params || !params.length) return sql;
  let formatted = sql;
  params.forEach(p => {
    const val = typeof p === 'string' ? `'${p.replace(/'/g, "\\'")}'` : (p === null ? 'NULL' : p);
    formatted = formatted.replace('?', val);
  });
  return formatted;
}

let currentConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'torquehub_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

let pool = null;
let isConnected = false;
let lastConnectionError = null;

async function ensureConnected() {
  if (isConnected && pool) return true;
  try {
    const res = await initDatabase();
    return res.success;
  } catch (e) {
    return false;
  }
}

// Fallback in-memory data store for when MySQL is offline
const memoryStore = {
  customers: [
    { customer_id: 1, name: 'John Anderson', phone: '9876543210', email: 'john.anderson@example.com', address: '742 Evergreen Terrace, Springfield' },
    { customer_id: 2, name: 'Sarah Jenkins', phone: '9823456781', email: 'sarah.j@example.com', address: '124 Conch Street, Pacific Bay' },
    { customer_id: 3, name: 'Michael Chang', phone: '9845123987', email: 'm.chang@example.com', address: '456 Elmwood Ave, Metro City' },
    { customer_id: 4, name: 'Emily Watson', phone: '9765432109', email: 'emily.w@example.com', address: '89 Park Lane, Oakville' }
  ],
  vehicles: [
    { vehicle_id: 1, customer_id: 1, vehicle_number: '8492', vehicle_model: 'Honda Civic 2021' },
    { vehicle_id: 2, customer_id: 2, vehicle_number: '2301', vehicle_model: 'Toyota RAV4 2022' },
    { vehicle_id: 3, customer_id: 3, vehicle_number: '5719', vehicle_model: 'Ford Mustang GT 2020' },
    { vehicle_id: 4, customer_id: 4, vehicle_number: '9140', vehicle_model: 'Hyundai Elantra 2023' }
  ],
  services: [
    { service_id: 1, service_type: 'Full Engine Tune-Up', service_date: '2026-11-01', description: 'Replaced spark plugs, synthetic oil change, filter replacements and ECU diagnostics.', service_charge: 249.50, status: 'Completed' },
    { service_id: 2, service_type: 'Brake Pad Replacement', service_date: '2026-11-03', description: 'Front and rear ceramic brake pads replacement with rotor resurfacing.', service_charge: 180.00, status: 'Completed' },
    { service_id: 3, service_type: 'Transmission Fluid Flush', service_date: '2026-11-05', description: 'Complete automated fluid exchange and pressure test check.', service_charge: 145.00, status: 'In Progress' },
    { service_id: 4, service_type: 'Air Conditioning Servicing', service_date: '2026-11-07', description: 'AC refrigerant leak test, condenser cleaning and cabin air filter renewal.', service_charge: 95.00, status: 'Pending' }
  ],
  payments: [
    { payment_id: 1, service_id: 1, amount: 249.50, payment_date: '2026-11-01', payment_method: 'Credit Card', status: 'Completed' },
    { payment_id: 2, service_id: 2, amount: 180.00, payment_date: '2026-11-03', payment_method: 'UPI', status: 'Completed' },
    { payment_id: 3, service_id: 3, amount: 145.00, payment_date: '2026-11-05', payment_method: 'Cash', status: 'Pending' },
    { payment_id: 4, service_id: 4, amount: 95.00, payment_date: '2026-11-07', payment_method: 'Net Banking', status: 'Pending' }
  ]
};

async function executeQuery(sql, params = []) {
  const start = Date.now();
  if (pool) {
    try {
      const [rows, fields] = await pool.query(sql, params);
      const duration = Date.now() - start;
      logQuery(sql, params, duration, true);
      return rows;
    } catch (err) {
      const duration = Date.now() - start;
      logQuery(sql, params, duration, false, err);
      console.error('MySQL Query Execution Error:', err.message);
      throw err;
    }
  } else {
    // If MySQL is offline, record the simulated SQL for user visibility
    const duration = Date.now() - start;
    logQuery(`[OFFLINE SIMULATION] ${sql}`, params, duration, true);
    return null;
  }
}

async function initDatabase(customConfig = null) {
  if (customConfig) {
    currentConfig = { ...currentConfig, ...customConfig };
  }

  // First connect to MySQL server without selecting specific DB to ensure database exists
  let rootConn;
  try {
    rootConn = await mysql.createConnection({
      host: currentConfig.host,
      port: currentConfig.port,
      user: currentConfig.user,
      password: currentConfig.password,
      connectTimeout: 4000
    });

    // Create database if not exists
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${currentConfig.database}\`;`);
    await rootConn.end();

    // Now initialize pool for the database
    if (pool) {
      try { await pool.end(); } catch (e) {}
    }

    pool = mysql.createPool(currentConfig);

    // Verify connection
    const testConn = await pool.getConnection();
    testConn.release();

    isConnected = true;
    lastConnectionError = null;

    // Run table creation scripts
    await createTables();

    console.log(`[TorqueHub] Successfully connected to MySQL Workbench database: ${currentConfig.database}`);
    return { success: true, message: `Connected to database '${currentConfig.database}' on ${currentConfig.host}:${currentConfig.port}` };
  } catch (err) {
    if (rootConn) {
      try { await rootConn.end(); } catch (e) {}
    }
    isConnected = false;
    lastConnectionError = err.message;
    console.warn(`[TorqueHub] MySQL connection attempt failed: ${err.message}. Operating in fallback mode until credentials are provided.`);
    return { success: false, error: err.message };
  }
}

async function createTables() {
  if (!pool) return;

  const queries = [
    // 1. CUSTOMERS TABLE
    `CREATE TABLE IF NOT EXISTS CUSTOMERS (
      customer_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone BIGINT NOT NULL,
      email VARCHAR(100) NOT NULL,
      address VARCHAR(125) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 2. VEHICLES TABLE
    `CREATE TABLE IF NOT EXISTS VEHICLES (
      vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      vehicle_number VARCHAR(50) NOT NULL,
      vehicle_model VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_vehicle_customer 
        FOREIGN KEY (customer_id) REFERENCES CUSTOMERS(customer_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 3. SERVICES TABLE
    `CREATE TABLE IF NOT EXISTS SERVICES (
      service_id INT AUTO_INCREMENT PRIMARY KEY,
      service_type VARCHAR(100) NOT NULL,
      service_date DATE NOT NULL,
      description TEXT,
      service_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      status VARCHAR(29) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    // 4. PAYMENTS TABLE
    `CREATE TABLE IF NOT EXISTS PAYMENTS (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  for (const q of queries) {
    await executeQuery(q);
  }

  // Check if CUSTOMERS is empty; if so, seed demo records
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM CUSTOMERS');
  if (rows[0].count === 0) {
    console.log('[TorqueHub] Seeding initial starter records into MySQL Workbench database...');
    await seedInitialData();
  }
}

async function seedInitialData() {
  const insertCustomers = `
    INSERT INTO CUSTOMERS (customer_id, name, phone, email, address) VALUES
    (1, 'John Anderson', 9876543210, 'john.anderson@example.com', '742 Evergreen Terrace, Springfield'),
    (2, 'Sarah Jenkins', 9823456781, 'sarah.j@example.com', '124 Conch Street, Pacific Bay'),
    (3, 'Michael Chang', 9845123987, 'm.chang@example.com', '456 Elmwood Ave, Metro City'),
    (4, 'Emily Watson', 9765432109, 'emily.w@example.com', '89 Park Lane, Oakville')
    ON DUPLICATE KEY UPDATE name=VALUES(name);
  `;
  await executeQuery(insertCustomers);

  const insertVehicles = `
    INSERT INTO VEHICLES (vehicle_id, customer_id, vehicle_number, vehicle_model) VALUES
    (1, 1, '8492', 'Honda Civic 2021'),
    (2, 2, '2301', 'Toyota RAV4 2022'),
    (3, 3, '5719', 'Ford Mustang GT 2020'),
    (4, 4, '9140', 'Hyundai Elantra 2023')
    ON DUPLICATE KEY UPDATE vehicle_model=VALUES(vehicle_model);
  `;
  await executeQuery(insertVehicles);

  const insertServices = `
    INSERT INTO SERVICES (service_id, service_type, service_date, description, service_charge, status) VALUES
    (1, 'Full Engine Tune-Up', '2026-11-01', 'Replaced spark plugs, synthetic oil change, filter replacements and ECU diagnostics.', 249.50, 'Completed'),
    (2, 'Brake Pad Replacement', '2026-11-03', 'Front and rear ceramic brake pads replacement with rotor resurfacing.', 180.00, 'Completed'),
    (3, 'Transmission Fluid Flush', '2026-11-05', 'Complete automated fluid exchange and pressure test check.', 145.00, 'In Progress'),
    (4, 'Air Conditioning Servicing', '2026-11-07', 'AC refrigerant leak test, condenser cleaning and cabin air filter renewal.', 95.00, 'Pending')
    ON DUPLICATE KEY UPDATE service_type=VALUES(service_type);
  `;
  await executeQuery(insertServices);

  const insertPayments = `
    INSERT INTO PAYMENTS (payment_id, service_id, amount, payment_date, payment_method, status) VALUES
    (1, 1, 249.50, '2026-11-01', 'Credit Card', 'Completed'),
    (2, 2, 180.00, '2026-11-03', 'UPI', 'Completed'),
    (3, 3, 145.00, '2026-11-05', 'Cash', 'Pending'),
    (4, 4, 95.00, '2026-11-07', 'Net Banking', 'Pending')
    ON DUPLICATE KEY UPDATE amount=VALUES(amount);
  `;
  await executeQuery(insertPayments);
}

// Helper to save credentials to .env file
function saveEnvConfig(newConfig) {
  const envPath = path.join(__dirname, '.env');
  const envContent = `# TorqueHub Database Configuration
DB_HOST=${newConfig.host || '127.0.0.1'}
DB_PORT=${newConfig.port || 3306}
DB_USER=${newConfig.user || 'root'}
DB_PASSWORD=${newConfig.password || ''}
DB_NAME=${newConfig.database || 'torquehub_db'}
PORT=${process.env.PORT || 3000}
`;
  fs.writeFileSync(envPath, envContent, 'utf8');
}

module.exports = {
  get isConnected() { return isConnected; },
  get lastConnectionError() { return lastConnectionError; },
  get currentConfig() {
    return {
      host: currentConfig.host,
      port: currentConfig.port,
      user: currentConfig.user,
      database: currentConfig.database
    };
  },
  queryLogs,
  memoryStore,
  executeQuery,
  initDatabase,
  ensureConnected,
  seedInitialData,
  saveEnvConfig
};
