INSERT INTO technicians (id, name, role, phone, active, email) VALUES 
('TECH-001', 'Alex Mercer', 'Technician', '+15550199', 1, 'alex.mercer@gmail.com'),
('SALE-002', 'Sarah Connor', 'Sales', '+15550188', 1, 'sarah.connor@gmail.com');

INSERT INTO clients (id, company_name, contact_person, address, phone, amc_start, amc_end, amc_status) VALUES 
('CLI-101', 'Apex Tech Solutions', 'John Doe', '100 Main St, Suite 400', '+15559999', '2026-01-01', '2027-01-01', 'Active'),
('CLI-102', 'Omega Logistics Hub', 'Jane Smith', '750 Warehouse Blvd, Dock 4', '+15558888', '2025-06-01', '2026-06-01', 'Expired');

INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description, technician_notes, equipment_used) VALUES 
('JOB-201', 'CLI-101', 'TECH-001', 'NAS', 'In Progress', 'Migrate 4-bay Synology NAS array to RAID 6 and configure remote access.', 'Initial deployment complete. Data rebuilding is running smoothly.', '["HDD-8TB"]'),
('JOB-202', 'CLI-102', 'TECH-001', 'CCTV', 'Pending', 'Mount 4x external IP PoE cameras and update firmware on 16-channel NVR.', '', '[]');

INSERT INTO inventory_stock (item_code, item_name, category, stock_qty, unit_price) VALUES 
('HDD-8TB', '8TB Enterprise Hard Drive', 'Hard Drives', 14, 185.00),
('CAM-IP-DOME', 'Dome IP Security Camera 4K', 'Security IP Cams', 28, 120.00),
('CAB-CAT6-100', 'Cat6 Network Cable 100m Reel', 'Network Cables', 8, 45.00),
('SPARE-BOARD', 'Replacement DVR Mainboard V2', 'Spare Hardware Parts', 5, 65.00);

INSERT INTO inventory_items (serial_number, device_name, client_id, installed_date, warranty_months, status, job_id) VALUES 
('SN-881122', 'Dome IP Security Camera 4K', 'CLI-101', '2026-02-15', 12, 'Active', 'JOB-201'),
('SN-443300', '8TB Enterprise Hard Drive', 'CLI-102', '2025-08-10', 12, 'Defective', 'JOB-202');

INSERT OR REPLACE INTO cash_safes (id, usd_balance, mmk_balance) VALUES (1, 5000.00, 1000000.00);

INSERT INTO cash_transactions (job_id, transaction_type, primary_currency, amount, exchange_rate, equivalent_amount, notes) VALUES 
('JOB-201', 'Deposit', 'USD', 250.00, 3250.00, 812500.00, 'On-site service collection.');
