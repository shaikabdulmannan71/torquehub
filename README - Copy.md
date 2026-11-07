# 🚗 TorqueHub - Vehicle Service Center Management System

A modern, clean, and responsive Vehicle Service Center Management web application connected directly to **MySQL Workbench**. When you view, create, alter, or delete records in the TorqueHub web application, all changes are immediately committed to your MySQL database and visible in MySQL Workbench.

---

## 📋 Database Tables & Schema

TorqueHub manages the exact 4 relational tables specified for the service center:

### 1. `CUSTOMERS`
- `customer_id INT AUTO_INCREMENT PRIMARY KEY`
- `name VARCHAR(100) NOT NULL`
- `phone BIGINT NOT NULL` *(Supports 10-15 digit phone numbers without INT overflow)*
- `email VARCHAR(100) NOT NULL`
- `address VARCHAR(125) NOT NULL`

### 2. `VEHICLES`
- `vehicle_id INT AUTO_INCREMENT PRIMARY KEY`
- `customer_id INT NOT NULL` *(Foreign Key -> `CUSTOMERS.customer_id`)*
- `vehicle_number VARCHAR(50) NOT NULL` *(Supports numeric or plate numbers, e.g. 8492, MH02AB1234)*
- `vehicle_model VARCHAR(100) NOT NULL`

### 3. `SERVICES` *(SERVIRCES)*
- `service_id INT AUTO_INCREMENT PRIMARY KEY`
- `service_type VARCHAR(100) NOT NULL`
- `service_date DATE NOT NULL`
- `description TEXT`
- `service_charge DECIMAL(10, 2) NOT NULL`
- `status VARCHAR(29) NOT NULL` *(e.g. `Pending`, `In Progress`, `Completed`, `Cancelled`)*

### 4. `PAYMENTS`
- `payment_id INT AUTO_INCREMENT PRIMARY KEY`
- `service_id INT NOT NULL` *(Foreign Key -> `SERVICES.service_id`)*
- `amount DECIMAL(10, 2) NOT NULL`
- `payment_date DATE NOT NULL`
- `payment_method VARCHAR(30) NOT NULL` *(e.g. `Cash`, `Credit Card`, `UPI`, `Net Banking`)*
- `status VARCHAR(20) NOT NULL` *(e.g. `Completed`, `Pending`, `Failed`)*

---

## ⚡ Quick Start & Running the Website

### Step 1: Start the Web Server
Open your terminal inside this folder and run:
```bash
npm start
```
You will see:
```text
=======================================================
  🚗 TorqueHub Vehicle Service Center Management
  🌐 Web Server: http://localhost:3000
=======================================================
```
Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**.

---

## 🔗 Connecting to MySQL Workbench

### Option A: Direct Web UI Connection (Recommended)
1. In the TorqueHub web interface, click the **"DB Connection"** button in the sidebar or click on the status badge in the top right.
2. Enter your MySQL password (if your `root` user has a password) or adjust the port (default `3306`).
3. Click **"Test Connection"** to verify credentials.
4. Click **"Connect & Sync"**. 
   - TorqueHub automatically creates the database `torquehub_db` and all 4 tables (`CUSTOMERS`, `VEHICLES`, `SERVICES`, `PAYMENTS`) if they don't already exist, and seeds starter records.

### Option B: Run `schema.sql` directly in MySQL Workbench
1. Open **MySQL Workbench**.
2. Connect to your local MySQL instance (`localhost:3306`).
3. Click **File > Open SQL Script...** and select the `schema.sql` file in this directory.
4. Click the ⚡ **Execute** button (or press `Ctrl+Shift+Enter`).
5. In the **Schemas** navigator on the left, right-click and choose **Refresh All**. You will see `torquehub_db` and the 4 tables!

---

## 🔄 Two-Way Workbench Synchronization

Every time you perform an action in TorqueHub:
- **Add Record**: Sends an `INSERT INTO ...` query to MySQL Workbench.
- **Alter / Edit Record**: Sends an `UPDATE ... SET ... WHERE id = ?` query to MySQL Workbench.
- **Delete Record**: Sends a `DELETE FROM ... WHERE id = ?` query to MySQL Workbench.
- **Workbench Live Sync Tab**: View the real-time query stream under the **"Workbench Live Sync"** tab in TorqueHub to see the exact SQL queries executed with timestamps and execution latency.

To test the two-way sync:
1. Open **MySQL Workbench** and execute:
   ```sql
   USE torquehub_db;
   SELECT * FROM CUSTOMERS;
   ```
2. In TorqueHub, edit a customer's phone or address and click **Save**.
3. Re-run `SELECT * FROM CUSTOMERS;` in MySQL Workbench — you will immediately see the updated values!

