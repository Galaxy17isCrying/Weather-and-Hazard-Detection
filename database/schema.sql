CREATE DATABASE IF NOT EXISTS weather_disaster CHARACTER SET utf8mb4;
USE weather_disaster;
CREATE TABLE IF NOT EXISTS saved_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  country VARCHAR(80), latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_loc (latitude, longitude)
);
CREATE TABLE IF NOT EXISTS preferences (
  id TINYINT PRIMARY KEY DEFAULT 1,
  units ENUM('metric','imperial') DEFAULT 'metric',
  default_location_id INT NULL,
  FOREIGN KEY (default_location_id) REFERENCES saved_locations(id) ON DELETE SET NULL
);
INSERT IGNORE INTO preferences (id) VALUES (1);
CREATE TABLE IF NOT EXISTS hazard_layers (
  slug VARCHAR(40) PRIMARY KEY, label VARCHAR(80) NOT NULL, color VARCHAR(9) NOT NULL,
  source_name VARCHAR(160), source_url VARCHAR(255), kind ENUM('susceptibility','live') NOT NULL, description TEXT
);
CREATE TABLE IF NOT EXISTS disaster_records (
  id INT AUTO_INCREMENT PRIMARY KEY, hazard_slug VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL,
  latitude DOUBLE, longitude DOUBLE, severity VARCHAR(40), occurred_at DATETIME,
  source_name VARCHAR(160) NOT NULL, source_url VARCHAR(255),
  FOREIGN KEY (hazard_slug) REFERENCES hazard_layers(slug)
);
CREATE TABLE IF NOT EXISTS weather_cache (
  cache_key VARCHAR(80) PRIMARY KEY, payload JSON NOT NULL, fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT IGNORE INTO hazard_layers VALUES
('flood','Flood susceptibility','#2b7de9','UP NOAH / MGB','https://noah.up.edu.ph','susceptibility','Static susceptibility map, not live flood monitoring.'),
('landslide','Landslide susceptibility','#a0522d','Mines and Geosciences Bureau','https://www.mgb.gov.ph','susceptibility','Static susceptibility map.'),
('faults','Active faults','#d62828','PHIVOLCS FaultFinder','https://faultfinder.phivolcs.dost.gov.ph','susceptibility','Fault lines. Load GeoJSON from PHIVOLCS.'),
('earthquake','Recent earthquakes','#f77f00','USGS Earthquake Feed','https://earthquake.usgs.gov','live','Live feed. Official local reports: PHIVOLCS.');
