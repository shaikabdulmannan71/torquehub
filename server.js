const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure MySQL is connected for API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && !db.isConnected && req.path !== '/api/config/save' && req.path !== '/api/config/test') {
    try {
      await db.ensureConnected();
    } catch (e) {}
  }
  next();
});

// =====================================================================
// SYSTEM & DATABASE STATUS ENDPOINTS
// =====================================================================

app.get('/api/status', async (req, res) => {
  let stats = { customers: 0, vehicles: 0, services: 0, payments: 0 };
  
  if (db.isConnected) {
    try {
      const c = await db.executeQuery('SELECT COUNT(*) as count FROM CUSTOMERS');
      const v = await db.executeQuery('SELECT COUNT(*) as count FROM VEHICLES');
      const s = await db.executeQuery('SELECT COUNT(*) as count FROM SERVICES');
      const p = await db.executeQuery('SELECT COUNT(*) as count FROM PAYMENTS');
      stats = {
        customers: c && c[0] ? c[0].count : 0,
        vehicles: v && v[0] ? v[0].count : 0,
        services: s && s[0] ? s[0].count : 0,
        payments: p && p[0] ? p[0].count : 0
      };
    } catch (e) {
      console.error('Error fetching table counts:', e.message);
    }
  } else {
    stats = {
      customers: db.memoryStore.customers.length,
      vehicles: db.memoryStore.vehicles.length,
      services: db.memoryStore.services.length,
      payments: db.memoryStore.payments.length
    };
  }

  res.json({
    connected: db.isConnected,
    config: db.currentConfig,
    error: db.lastConnectionError,
    stats
  });
});

app.post('/api/config/test', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  const mysql = require('mysql2/promise');
  try {
    const conn = await mysql.createConnection({
      host: host || '127.0.0.1',
      port: parseInt(port || '3306', 10),
      user: user || 'root',
      password: password || '',
      connectTimeout: 5000
    });
    await conn.query('SELECT 1');
    await conn.end();
    res.json({ success: true, message: 'MySQL Server connection successful!' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/config/save', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  const newConfig = {
    host: host || '127.0.0.1',
    port: parseInt(port || '3306', 10),
    user: user || 'root',
    password: password || '',
    database: database || 'torquehub_db'
  };

  try {
    db.saveEnvConfig(newConfig);
    const result = await db.initDatabase(newConfig);
    if (result.success) {
      res.json({ success: true, message: 'Connected and synchronized with MySQL Workbench successfully!' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sql-logs', (req, res) => {
  res.json(db.queryLogs);
});

app.post('/api/reset-data', async (req, res) => {
  try {
    if (db.isConnected) {
      await db.executeQuery('SET FOREIGN_KEY_CHECKS = 0;');
      await db.executeQuery('TRUNCATE TABLE PAYMENTS;');
      await db.executeQuery('TRUNCATE TABLE SERVICES;');
      await db.executeQuery('TRUNCATE TABLE VEHICLES;');
      await db.executeQuery('TRUNCATE TABLE CUSTOMERS;');
      await db.executeQuery('SET FOREIGN_KEY_CHECKS = 1;');
      await db.seedInitialData();
    } else {
      // Reset memory store
      db.memoryStore.customers = [
        { customer_id: 1, name: 'John Anderson', phone: '9876543210', email: 'john.anderson@example.com', address: '742 Evergreen Terrace, Springfield' },
        { customer_id: 2, name: 'Sarah Jenkins', phone: '9823456781', email: 'sarah.j@example.com', address: '124 Conch Street, Pacific Bay' },
        { customer_id: 3, name: 'Michael Chang', phone: '9845123987', email: 'm.chang@example.com', address: '456 Elmwood Ave, Metro City' },
        { customer_id: 4, name: 'Emily Watson', phone: '9765432109', email: 'emily.w@example.com', address: '89 Park Lane, Oakville' }
      ];
      db.memoryStore.vehicles = [
        { vehicle_id: 1, customer_id: 1, vehicle_number: '8492', vehicle_model: 'Honda Civic 2021' },
        { vehicle_id: 2, customer_id: 2, vehicle_number: '2301', vehicle_model: 'Toyota RAV4 2022' },
        { vehicle_id: 3, customer_id: 3, vehicle_number: '5719', vehicle_model: 'Ford Mustang GT 2020' },
        { vehicle_id: 4, customer_id: 4, vehicle_number: '9140', vehicle_model: 'Hyundai Elantra 2023' }
      ];
      db.memoryStore.services = [
        { service_id: 1, service_type: 'Full Engine Tune-Up', service_date: '2026-11-01', description: 'Replaced spark plugs, synthetic oil change, filter replacements and ECU diagnostics.', service_charge: 249.50, status: 'Completed' },
        { service_id: 2, service_type: 'Brake Pad Replacement', service_date: '2026-11-03', description: 'Front and rear ceramic brake pads replacement with rotor resurfacing.', service_charge: 180.00, status: 'Completed' },
        { service_id: 3, service_type: 'Transmission Fluid Flush', service_date: '2026-11-05', description: 'Complete automated fluid exchange and pressure test check.', service_charge: 145.00, status: 'In Progress' },
        { service_id: 4, service_type: 'Air Conditioning Servicing', service_date: '2026-11-07', description: 'AC refrigerant leak test, condenser cleaning and cabin air filter renewal.', service_charge: 95.00, status: 'Pending' }
      ];
      db.memoryStore.payments = [
        { payment_id: 1, service_id: 1, amount: 249.50, payment_date: '2026-11-01', payment_method: 'Credit Card', status: 'Completed' },
        { payment_id: 2, service_id: 2, amount: 180.00, payment_date: '2026-11-03', payment_method: 'UPI', status: 'Completed' },
        { payment_id: 3, service_id: 3, amount: 145.00, payment_date: '2026-11-05', payment_method: 'Cash', status: 'Pending' },
        { payment_id: 4, service_id: 4, amount: 95.00, payment_date: '2026-11-07', payment_method: 'Net Banking', status: 'Pending' }
      ];
    }
    res.json({ success: true, message: 'Database reset to sample records successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================================
// 1. CUSTOMERS CRUD API
// (customer_id INT, name VARCHAR(100), phone BIGINT/INT, email VARCHAR(100), address VARCHAR(125))
// =====================================================================

app.get('/api/customers', async (req, res) => {
  try {
    if (db.isConnected) {
      const rows = await db.executeQuery(`
        SELECT c.*, COUNT(v.vehicle_id) as vehicle_count
        FROM CUSTOMERS c
        LEFT JOIN VEHICLES v ON c.customer_id = v.customer_id
        GROUP BY c.customer_id
        ORDER BY c.customer_id DESC
      `);
      res.json(rows);
    } else {
      const list = db.memoryStore.customers.map(c => {
        const vCount = db.memoryStore.vehicles.filter(v => v.customer_id == c.customer_id).length;
        return { ...c, vehicle_count: vCount };
      });
      res.json(list.reverse());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !phone || !email || !address) {
    return res.status(400).json({ error: 'All fields (name, phone, email, address) are required' });
  }

  // Sanitize numeric phone
  const cleanPhone = String(phone).replace(/\D/g, '');

  try {
    if (db.isConnected) {
      const result = await db.executeQuery(
        'INSERT INTO CUSTOMERS (name, phone, email, address) VALUES (?, ?, ?, ?)',
        [name.trim(), cleanPhone || 0, email.trim(), address.trim()]
      );
      res.status(201).json({
        customer_id: result.insertId,
        name, phone: cleanPhone, email, address,
        message: 'Customer saved successfully in MySQL Workbench!'
      });
    } else {
      const nextId = db.memoryStore.customers.length > 0 
        ? Math.max(...db.memoryStore.customers.map(c => c.customer_id)) + 1 
        : 1;
      const newCustomer = { customer_id: nextId, name: name.trim(), phone: cleanPhone, email: email.trim(), address: address.trim() };
      db.memoryStore.customers.push(newCustomer);
      res.status(201).json({ ...newCustomer, message: 'Customer saved in local buffer (connect MySQL to persist to Workbench)' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  const { name, phone, email, address } = req.body;

  if (!name || !phone || !email || !address) {
    return res.status(400).json({ error: 'All fields (name, phone, email, address) are required' });
  }

  const cleanPhone = String(phone).replace(/\D/g, '');

  try {
    if (db.isConnected) {
      await db.executeQuery(
        'UPDATE CUSTOMERS SET name = ?, phone = ?, email = ?, address = ? WHERE customer_id = ?',
        [name.trim(), cleanPhone || 0, email.trim(), address.trim(), customerId]
      );
      res.json({
        customer_id: customerId,
        name, phone: cleanPhone, email, address,
        message: 'Customer altered & updated successfully in MySQL Workbench!'
      });
    } else {
      const index = db.memoryStore.customers.findIndex(c => c.customer_id === customerId);
      if (index === -1) return res.status(404).json({ error: 'Customer not found' });
      db.memoryStore.customers[index] = { customer_id: customerId, name: name.trim(), phone: cleanPhone, email: email.trim(), address: address.trim() };
      res.json({ ...db.memoryStore.customers[index], message: 'Customer updated successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const customerId = parseInt(req.params.id, 10);
  try {
    if (db.isConnected) {
      await db.executeQuery('DELETE FROM CUSTOMERS WHERE customer_id = ?', [customerId]);
      res.json({ success: true, message: 'Customer and related records deleted from MySQL Workbench!' });
    } else {
      db.memoryStore.customers = db.memoryStore.customers.filter(c => c.customer_id !== customerId);
      db.memoryStore.vehicles = db.memoryStore.vehicles.filter(v => v.customer_id !== customerId);
      res.json({ success: true, message: 'Customer deleted successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 2. VEHICLES CRUD API
// (vehicle_id INT, customer_id INT, vehicle_number INT/VARCHAR, vehicle_model VARCHAR(100))
// =====================================================================

app.get('/api/vehicles', async (req, res) => {
  try {
    if (db.isConnected) {
      const rows = await db.executeQuery(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone
        FROM VEHICLES v
        LEFT JOIN CUSTOMERS c ON v.customer_id = c.customer_id
        ORDER BY v.vehicle_id DESC
      `);
      res.json(rows);
    } else {
      const list = db.memoryStore.vehicles.map(v => {
        const owner = db.memoryStore.customers.find(c => c.customer_id == v.customer_id);
        return {
          ...v,
          customer_name: owner ? owner.name : 'Unknown',
          customer_phone: owner ? owner.phone : 'N/A'
        };
      });
      res.json(list.reverse());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  const { customer_id, vehicle_number, vehicle_model } = req.body;
  if (!customer_id || !vehicle_number || !vehicle_model) {
    return res.status(400).json({ error: 'Customer, Vehicle Number, and Vehicle Model are required' });
  }

  try {
    if (db.isConnected) {
      const result = await db.executeQuery(
        'INSERT INTO VEHICLES (customer_id, vehicle_number, vehicle_model) VALUES (?, ?, ?)',
        [parseInt(customer_id, 10), String(vehicle_number).trim(), vehicle_model.trim()]
      );
      res.status(201).json({
        vehicle_id: result.insertId,
        customer_id, vehicle_number, vehicle_model,
        message: 'Vehicle saved successfully in MySQL Workbench!'
      });
    } else {
      const nextId = db.memoryStore.vehicles.length > 0 
        ? Math.max(...db.memoryStore.vehicles.map(v => v.vehicle_id)) + 1 
        : 1;
      const newVehicle = {
        vehicle_id: nextId,
        customer_id: parseInt(customer_id, 10),
        vehicle_number: String(vehicle_number).trim(),
        vehicle_model: vehicle_model.trim()
      };
      db.memoryStore.vehicles.push(newVehicle);
      res.status(201).json({ ...newVehicle, message: 'Vehicle saved successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  const vehicleId = parseInt(req.params.id, 10);
  const { customer_id, vehicle_number, vehicle_model } = req.body;

  if (!customer_id || !vehicle_number || !vehicle_model) {
    return res.status(400).json({ error: 'Customer, Vehicle Number, and Vehicle Model are required' });
  }

  try {
    if (db.isConnected) {
      await db.executeQuery(
        'UPDATE VEHICLES SET customer_id = ?, vehicle_number = ?, vehicle_model = ? WHERE vehicle_id = ?',
        [parseInt(customer_id, 10), String(vehicle_number).trim(), vehicle_model.trim(), vehicleId]
      );
      res.json({
        vehicle_id: vehicleId,
        customer_id, vehicle_number, vehicle_model,
        message: 'Vehicle details altered & updated in MySQL Workbench!'
      });
    } else {
      const index = db.memoryStore.vehicles.findIndex(v => v.vehicle_id === vehicleId);
      if (index === -1) return res.status(404).json({ error: 'Vehicle not found' });
      db.memoryStore.vehicles[index] = {
        vehicle_id: vehicleId,
        customer_id: parseInt(customer_id, 10),
        vehicle_number: String(vehicle_number).trim(),
        vehicle_model: vehicle_model.trim()
      };
      res.json({ ...db.memoryStore.vehicles[index], message: 'Vehicle updated successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  const vehicleId = parseInt(req.params.id, 10);
  try {
    if (db.isConnected) {
      await db.executeQuery('DELETE FROM VEHICLES WHERE vehicle_id = ?', [vehicleId]);
      res.json({ success: true, message: 'Vehicle deleted from MySQL Workbench!' });
    } else {
      db.memoryStore.vehicles = db.memoryStore.vehicles.filter(v => v.vehicle_id !== vehicleId);
      res.json({ success: true, message: 'Vehicle deleted successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 3. SERVICES (SERVIRCES) CRUD API
// (service_id INT, service_type VARCHAR(100), service_date DATE, description TEXT, service_charge DECIMAL(10,2), status VARCHAR(29))
// =====================================================================

app.get('/api/services', async (req, res) => {
  try {
    if (db.isConnected) {
      const rows = await db.executeQuery(`
        SELECT s.*, 
          COALESCE(p.amount, 0) as paid_amount,
          p.status as payment_status
        FROM SERVICES s
        LEFT JOIN PAYMENTS p ON s.service_id = p.service_id
        ORDER BY s.service_id DESC
      `);
      res.json(rows);
    } else {
      const list = db.memoryStore.services.map(s => {
        const payment = db.memoryStore.payments.find(p => p.service_id == s.service_id);
        return {
          ...s,
          paid_amount: payment ? payment.amount : 0,
          payment_status: payment ? payment.status : 'Unbilled'
        };
      });
      res.json(list.reverse());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', async (req, res) => {
  const { service_type, service_date, description, service_charge, status } = req.body;
  if (!service_type || !service_date) {
    return res.status(400).json({ error: 'Service Type and Service Date are required' });
  }

  const charge = parseFloat(service_charge) || 0.00;
  const currentStatus = status || 'Pending';

  try {
    if (db.isConnected) {
      const result = await db.executeQuery(
        'INSERT INTO SERVICES (service_type, service_date, description, service_charge, status) VALUES (?, ?, ?, ?, ?)',
        [service_type.trim(), service_date, description || '', charge, currentStatus]
      );
      res.status(201).json({
        service_id: result.insertId,
        service_type, service_date, description, service_charge: charge, status: currentStatus,
        message: 'Service recorded and saved in MySQL Workbench!'
      });
    } else {
      const nextId = db.memoryStore.services.length > 0 
        ? Math.max(...db.memoryStore.services.map(s => s.service_id)) + 1 
        : 1;
      const newService = {
        service_id: nextId,
        service_type: service_type.trim(),
        service_date,
        description: description || '',
        service_charge: charge,
        status: currentStatus
      };
      db.memoryStore.services.push(newService);
      res.status(201).json({ ...newService, message: 'Service recorded successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/services/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  const { service_type, service_date, description, service_charge, status } = req.body;

  if (!service_type || !service_date) {
    return res.status(400).json({ error: 'Service Type and Service Date are required' });
  }

  const charge = parseFloat(service_charge) || 0.00;
  const currentStatus = status || 'Pending';

  try {
    if (db.isConnected) {
      await db.executeQuery(
        'UPDATE SERVICES SET service_type = ?, service_date = ?, description = ?, service_charge = ?, status = ? WHERE service_id = ?',
        [service_type.trim(), service_date, description || '', charge, currentStatus, serviceId]
      );
      res.json({
        service_id: serviceId,
        service_type, service_date, description, service_charge: charge, status: currentStatus,
        message: 'Service details altered & updated in MySQL Workbench!'
      });
    } else {
      const index = db.memoryStore.services.findIndex(s => s.service_id === serviceId);
      if (index === -1) return res.status(404).json({ error: 'Service not found' });
      db.memoryStore.services[index] = {
        service_id: serviceId,
        service_type: service_type.trim(),
        service_date,
        description: description || '',
        service_charge: charge,
        status: currentStatus
      };
      res.json({ ...db.memoryStore.services[index], message: 'Service updated successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  const serviceId = parseInt(req.params.id, 10);
  try {
    if (db.isConnected) {
      await db.executeQuery('DELETE FROM SERVICES WHERE service_id = ?', [serviceId]);
      res.json({ success: true, message: 'Service and associated payments deleted from MySQL Workbench!' });
    } else {
      db.memoryStore.services = db.memoryStore.services.filter(s => s.service_id !== serviceId);
      db.memoryStore.payments = db.memoryStore.payments.filter(p => p.service_id !== serviceId);
      res.json({ success: true, message: 'Service deleted successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 4. PAYMENTS CRUD API
// (payment_id INT, service_id INT, amount DECIMAL(10,2), payment_date DATE, payment_method VARCHAR(30), status VARCHAR(20))
// =====================================================================

app.get('/api/payments', async (req, res) => {
  try {
    if (db.isConnected) {
      const rows = await db.executeQuery(`
        SELECT p.*, s.service_type, s.service_charge
        FROM PAYMENTS p
        LEFT JOIN SERVICES s ON p.service_id = s.service_id
        ORDER BY p.payment_id DESC
      `);
      res.json(rows);
    } else {
      const list = db.memoryStore.payments.map(p => {
        const s = db.memoryStore.services.find(srv => srv.service_id == p.service_id);
        return {
          ...p,
          service_type: s ? s.service_type : 'Unknown Service',
          service_charge: s ? s.service_charge : 0
        };
      });
      res.json(list.reverse());
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { service_id, amount, payment_date, payment_method, status } = req.body;
  if (!service_id || !payment_date) {
    return res.status(400).json({ error: 'Service ID and Payment Date are required' });
  }

  const amt = parseFloat(amount) || 0.00;
  const method = payment_method || 'Cash';
  const payStatus = status || 'Completed';

  try {
    if (db.isConnected) {
      const result = await db.executeQuery(
        'INSERT INTO PAYMENTS (service_id, amount, payment_date, payment_method, status) VALUES (?, ?, ?, ?, ?)',
        [parseInt(service_id, 10), amt, payment_date, method, payStatus]
      );
      res.status(201).json({
        payment_id: result.insertId,
        service_id, amount: amt, payment_date, payment_method: method, status: payStatus,
        message: 'Payment recorded and saved in MySQL Workbench!'
      });
    } else {
      const nextId = db.memoryStore.payments.length > 0 
        ? Math.max(...db.memoryStore.payments.map(p => p.payment_id)) + 1 
        : 1;
      const newPayment = {
        payment_id: nextId,
        service_id: parseInt(service_id, 10),
        amount: amt,
        payment_date,
        payment_method: method,
        status: payStatus
      };
      db.memoryStore.payments.push(newPayment);
      res.status(201).json({ ...newPayment, message: 'Payment recorded successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  const { service_id, amount, payment_date, payment_method, status } = req.body;

  if (!service_id || !payment_date) {
    return res.status(400).json({ error: 'Service ID and Payment Date are required' });
  }

  const amt = parseFloat(amount) || 0.00;
  const method = payment_method || 'Cash';
  const payStatus = status || 'Completed';

  try {
    if (db.isConnected) {
      await db.executeQuery(
        'UPDATE PAYMENTS SET service_id = ?, amount = ?, payment_date = ?, payment_method = ?, status = ? WHERE payment_id = ?',
        [parseInt(service_id, 10), amt, payment_date, method, payStatus, paymentId]
      );
      res.json({
        payment_id: paymentId,
        service_id, amount: amt, payment_date, payment_method: method, status: payStatus,
        message: 'Payment altered & updated in MySQL Workbench!'
      });
    } else {
      const index = db.memoryStore.payments.findIndex(p => p.payment_id === paymentId);
      if (index === -1) return res.status(404).json({ error: 'Payment not found' });
      db.memoryStore.payments[index] = {
        payment_id: paymentId,
        service_id: parseInt(service_id, 10),
        amount: amt,
        payment_date,
        payment_method: method,
        status: payStatus
      };
      res.json({ ...db.memoryStore.payments[index], message: 'Payment updated successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  try {
    if (db.isConnected) {
      await db.executeQuery('DELETE FROM PAYMENTS WHERE payment_id = ?', [paymentId]);
      res.json({ success: true, message: 'Payment deleted from MySQL Workbench!' });
    } else {
      db.memoryStore.payments = db.memoryStore.payments.filter(p => p.payment_id !== paymentId);
      res.json({ success: true, message: 'Payment deleted successfully!' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// DASHBOARD AGGREGATED STATS
// =====================================================================

app.get('/api/stats', async (req, res) => {
  try {
    let customerCount = 0;
    let vehicleCount = 0;
    let activeServices = 0;
    let completedServices = 0;
    let totalRevenue = 0;
    let recentServices = [];
    let recentPayments = [];

    if (db.isConnected) {
      const cRes = await db.executeQuery('SELECT COUNT(*) as c FROM CUSTOMERS');
      const vRes = await db.executeQuery('SELECT COUNT(*) as c FROM VEHICLES');
      const sRes = await db.executeQuery("SELECT COUNT(*) as c FROM SERVICES WHERE status != 'Completed' AND status != 'Cancelled'");
      const scRes = await db.executeQuery("SELECT COUNT(*) as c FROM SERVICES WHERE status = 'Completed'");
      const pRes = await db.executeQuery("SELECT COALESCE(SUM(amount), 0) as s FROM PAYMENTS WHERE status = 'Completed' OR status = 'Paid'");
      
      recentServices = await db.executeQuery('SELECT * FROM SERVICES ORDER BY service_id DESC LIMIT 5');
      recentPayments = await db.executeQuery(`
        SELECT p.*, s.service_type 
        FROM PAYMENTS p 
        LEFT JOIN SERVICES s ON p.service_id = s.service_id 
        ORDER BY p.payment_id DESC LIMIT 5
      `);

      customerCount = cRes && cRes[0] ? cRes[0].c : 0;
      vehicleCount = vRes && vRes[0] ? vRes[0].c : 0;
      activeServices = sRes && sRes[0] ? sRes[0].c : 0;
      completedServices = scRes && scRes[0] ? scRes[0].c : 0;
      totalRevenue = parseFloat((pRes && pRes[0] ? pRes[0].s : 0) || 0);
    } else {
      customerCount = db.memoryStore.customers.length;
      vehicleCount = db.memoryStore.vehicles.length;
      activeServices = db.memoryStore.services.filter(s => s.status !== 'Completed' && s.status !== 'Cancelled').length;
      completedServices = db.memoryStore.services.filter(s => s.status === 'Completed').length;
      totalRevenue = db.memoryStore.payments
        .filter(p => p.status === 'Completed' || p.status === 'Paid')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      recentServices = [...db.memoryStore.services].reverse().slice(0, 5);
      recentPayments = [...db.memoryStore.payments].reverse().slice(0, 5).map(p => {
        const s = db.memoryStore.services.find(srv => srv.service_id == p.service_id);
        return { ...p, service_type: s ? s.service_type : 'Unknown' };
      });
    }

    res.json({
      customerCount,
      vehicleCount,
      activeServices,
      completedServices,
      totalRevenue: totalRevenue.toFixed(2),
      recentServices,
      recentPayments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express server & attempt to connect to MySQL Workbench
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`  🚗 TorqueHub Vehicle Service Center Management`);
  console.log(`  🌐 Web Server: http://localhost:${PORT}`);
  console.log(`=======================================================`);
  await db.initDatabase();
});
