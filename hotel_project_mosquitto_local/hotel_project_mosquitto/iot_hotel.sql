-- ============================================================
--  IoT-BASED HOTEL MANAGEMENT SYSTEM
--  MySQL 8.0  |  Full Schema + Seed Data  (Clean Install)
--  Drop & recreate from scratch
-- ============================================================

DROP DATABASE IF EXISTS iot_hotel;
CREATE DATABASE iot_hotel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iot_hotel;

-- ============================================================
--  SECTION 1 — HOTEL STRUCTURE
-- ============================================================

CREATE TABLE hotel (
  hotel_id      TINYINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hotel_name    VARCHAR(120) NOT NULL,
  address       VARCHAR(255),
  city          VARCHAR(80),
  country       VARCHAR(60) DEFAULT 'Vietnam',
  phone         VARCHAR(20),
  email         VARCHAR(100),
  star_rating   TINYINT  UNSIGNED DEFAULT 5 CHECK (star_rating BETWEEN 1 AND 5),
  total_floors  TINYINT  UNSIGNED DEFAULT 10,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE floor (
  floor_id      SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hotel_id      TINYINT  UNSIGNED NOT NULL,
  floor_number  TINYINT  UNSIGNED NOT NULL,
  description   VARCHAR(100),
  UNIQUE KEY uq_hotel_floor (hotel_id, floor_number),
  CONSTRAINT fk_floor_hotel FOREIGN KEY (hotel_id)
    REFERENCES hotel(hotel_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE room_type (
  type_id       TINYINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_name     VARCHAR(60)   NOT NULL UNIQUE,
  base_price    DECIMAL(10,2) NOT NULL,
  max_occupancy TINYINT UNSIGNED DEFAULT 2,
  description   TEXT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE room (
  room_id       SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  floor_id      SMALLINT UNSIGNED NOT NULL,
  type_id       TINYINT  UNSIGNED NOT NULL,
  room_number   VARCHAR(10) NOT NULL,
  status        ENUM('available','occupied','maintenance','cleaning','reserved')
                DEFAULT 'available',
  is_smoking    BOOLEAN DEFAULT FALSE,
  notes         TEXT,
  UNIQUE KEY uq_room_number (room_number),
  CONSTRAINT fk_room_floor FOREIGN KEY (floor_id)
    REFERENCES floor(floor_id)     ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_room_type  FOREIGN KEY (type_id)
    REFERENCES room_type(type_id)  ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_room_status ON room(status);
CREATE INDEX idx_room_floor  ON room(floor_id);

-- ============================================================
--  SECTION 2 — GUESTS & BOOKINGS
-- ============================================================

CREATE TABLE guest (
  guest_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  nationality   VARCHAR(60),
  passport_no   VARCHAR(30),
  date_of_birth DATE,
  gender        ENUM('Male','Female','Other'),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_guest_email ON guest(email);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE booking (
  booking_id      INT     UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guest_id        INT     UNSIGNED NOT NULL,
  room_id         SMALLINT UNSIGNED NOT NULL,
  check_in_date   DATE    NOT NULL,
  check_out_date  DATE    NOT NULL,
  actual_check_in  DATETIME,
  actual_check_out DATETIME,
  num_guests      TINYINT UNSIGNED DEFAULT 1,
  total_price     DECIMAL(12,2),
  status          ENUM('pending','confirmed','checked_in','checked_out','cancelled','no_show')
                  DEFAULT 'pending',
  payment_status  ENUM('unpaid','partially_paid','paid','refunded') DEFAULT 'unpaid',
  special_requests TEXT,
  booked_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out_date > check_in_date),
  CONSTRAINT fk_booking_guest FOREIGN KEY (guest_id)
    REFERENCES guest(guest_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_booking_room  FOREIGN KEY (room_id)
    REFERENCES room(room_id)   ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_booking_guest  ON booking(guest_id);
CREATE INDEX idx_booking_room   ON booking(room_id);
CREATE INDEX idx_booking_dates  ON booking(check_in_date, check_out_date);
CREATE INDEX idx_booking_status ON booking(status);

-- ─────────────────────────────────────────────────────────────
-- Guest preferences auto-applied at check-in
-- ─────────────────────────────────────────────────────────────
CREATE TABLE guest_preference (
  pref_id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guest_id               INT UNSIGNED NOT NULL UNIQUE,
  preferred_temp_c       DECIMAL(4,1) DEFAULT 23.0,
  preferred_lighting     ENUM('bright','medium','dim','off') DEFAULT 'medium',
  preferred_curtain      ENUM('open','closed','half') DEFAULT 'half',
  do_not_disturb_default BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_pref_guest FOREIGN KEY (guest_id)
    REFERENCES guest(guest_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 3 — STAFF & ROLES
-- ============================================================

CREATE TABLE role (
  role_id     TINYINT  UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name   VARCHAR(40) NOT NULL UNIQUE,
  description TEXT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE staff (
  staff_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(60)  NOT NULL,
  last_name     VARCHAR(60)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  role_id       TINYINT UNSIGNED NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  hire_date     DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_role FOREIGN KEY (role_id)
    REFERENCES role(role_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_staff_role  ON staff(role_id);
CREATE INDEX idx_staff_email ON staff(email);

-- ─────────────────────────────────────────────────────────────
-- JWT refresh tokens
-- ─────────────────────────────────────────────────────────────
CREATE TABLE auth_token (
  token_id   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_id   INT UNSIGNED,
  guest_id   INT UNSIGNED,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  revoked    BOOLEAN      DEFAULT FALSE,
  issued_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (staff_id IS NOT NULL AND guest_id IS NULL) OR
    (staff_id IS NULL     AND guest_id IS NOT NULL)
  ),
  CONSTRAINT fk_token_staff FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id) ON DELETE CASCADE,
  CONSTRAINT fk_token_guest FOREIGN KEY (guest_id)
    REFERENCES guest(guest_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 4 — IoT DEVICES
-- ============================================================

CREATE TABLE device_category (
  category_id   TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(40)  NOT NULL UNIQUE,
  description   VARCHAR(120)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE device_type (
  type_id     SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id TINYINT  UNSIGNED NOT NULL,
  type_name   VARCHAR(80)  NOT NULL UNIQUE,
  unit        VARCHAR(20),
  min_value   DECIMAL(10,4),
  max_value   DECIMAL(10,4),
  protocol    ENUM('MQTT','HTTP','Modbus','Zigbee','Z-Wave','BLE','Simulated')
              DEFAULT 'MQTT',
  description TEXT,
  CONSTRAINT fk_dtype_cat FOREIGN KEY (category_id)
    REFERENCES device_category(category_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE device (
  device_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id       SMALLINT UNSIGNED NOT NULL,
  type_id       SMALLINT UNSIGNED NOT NULL,
  serial_number VARCHAR(60)  NOT NULL UNIQUE,
  firmware_ver  VARCHAR(20)  DEFAULT '1.0.0',
  mac_address   VARCHAR(17),
  ip_address    VARCHAR(45),
  topic         VARCHAR(150),
  is_active     BOOLEAN  DEFAULT TRUE,
  last_seen     DATETIME,
  installed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_device_room FOREIGN KEY (room_id)
    REFERENCES room(room_id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_device_type FOREIGN KEY (type_id)
    REFERENCES device_type(type_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_device_room   ON device(room_id);
CREATE INDEX idx_device_type   ON device(type_id);
CREATE INDEX idx_device_active ON device(is_active);
CREATE INDEX idx_device_serial ON device(serial_number);

-- ============================================================
--  SECTION 5 — SENSOR DATA  (time-series, partitioned)
--
--  FIX for MySQL 8.0:
--  PARTITION BY RANGE requires a plain integer column.
--  We add a STORED generated column `month_key` (YYYYMM)
--  and partition on that instead of an inline expression.
-- ============================================================

CREATE TABLE sensor_reading (
  reading_id  BIGINT UNSIGNED AUTO_INCREMENT,
  device_id   INT    UNSIGNED NOT NULL,
  room_id     SMALLINT UNSIGNED NOT NULL,
  value       DECIMAL(12,4) NOT NULL,
  raw_payload JSON,
  recorded_at DATETIME(3)   NOT NULL,
  -- Partition key: stored generated column (e.g. 202504)
  month_key   INT UNSIGNED GENERATED ALWAYS AS
              (YEAR(recorded_at) * 100 + MONTH(recorded_at)) STORED,
  PRIMARY KEY (reading_id, month_key),
  CONSTRAINT fk_reading_device FOREIGN KEY (device_id)
    REFERENCES device(device_id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
PARTITION BY RANGE (month_key) (
  PARTITION p2025_01 VALUES LESS THAN (202502),
  PARTITION p2025_02 VALUES LESS THAN (202503),
  PARTITION p2025_03 VALUES LESS THAN (202504),
  PARTITION p2025_04 VALUES LESS THAN (202505),
  PARTITION p2025_05 VALUES LESS THAN (202506),
  PARTITION p2025_06 VALUES LESS THAN (202507),
  PARTITION p2025_07 VALUES LESS THAN (202508),
  PARTITION p2025_08 VALUES LESS THAN (202509),
  PARTITION p2025_09 VALUES LESS THAN (202510),
  PARTITION p2025_10 VALUES LESS THAN (202511),
  PARTITION p2025_11 VALUES LESS THAN (202512),
  PARTITION p2025_12 VALUES LESS THAN (202601),
  PARTITION p2026_01 VALUES LESS THAN (202602),
  PARTITION p2026_02 VALUES LESS THAN (202603),
  PARTITION p2026_03 VALUES LESS THAN (202604),
  PARTITION p2026_04 VALUES LESS THAN (202605),
  PARTITION p2026_05 VALUES LESS THAN (202606),
  PARTITION p2026_06 VALUES LESS THAN (202607),
  PARTITION p2026_07 VALUES LESS THAN (202608),
  PARTITION p2026_08 VALUES LESS THAN (202609),
  PARTITION p2026_09 VALUES LESS THAN (202610),
  PARTITION p2026_10 VALUES LESS THAN (202611),
  PARTITION p2026_11 VALUES LESS THAN (202612),
  PARTITION p2026_12 VALUES LESS THAN (202701),
  PARTITION p_future  VALUES LESS THAN MAXVALUE
);

CREATE INDEX idx_sensor_device_time ON sensor_reading(device_id, recorded_at);
CREATE INDEX idx_sensor_room_time   ON sensor_reading(room_id,   recorded_at);

-- ─────────────────────────────────────────────────────────────
-- Hourly pre-aggregated averages (avoid scanning raw rows)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sensor_hourly_agg (
  agg_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id    INT    UNSIGNED NOT NULL,
  hour_bucket  DATETIME NOT NULL,
  avg_value    DECIMAL(12,4),
  min_value    DECIMAL(12,4),
  max_value    DECIMAL(12,4),
  sample_count INT UNSIGNED,
  UNIQUE KEY uq_agg (device_id, hour_bucket),
  CONSTRAINT fk_agg_device FOREIGN KEY (device_id)
    REFERENCES device(device_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 6 — ACTUATOR COMMANDS & STATE
-- ============================================================

CREATE TABLE actuator_command (
  cmd_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id    INT UNSIGNED NOT NULL,
  issued_by    ENUM('system','staff','guest','automation') DEFAULT 'system',
  staff_id     INT UNSIGNED,
  guest_id     INT UNSIGNED,
  booking_id   INT UNSIGNED,
  command_type VARCHAR(60)  NOT NULL,
  payload      JSON,
  status       ENUM('pending','sent','acknowledged','failed') DEFAULT 'pending',
  sent_at      DATETIME(3),
  acked_at     DATETIME(3),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cmd_device  FOREIGN KEY (device_id)
    REFERENCES device(device_id)    ON DELETE CASCADE,
  CONSTRAINT fk_cmd_staff   FOREIGN KEY (staff_id)
    REFERENCES staff(staff_id)      ON DELETE SET NULL,
  CONSTRAINT fk_cmd_guest   FOREIGN KEY (guest_id)
    REFERENCES guest(guest_id)      ON DELETE SET NULL,
  CONSTRAINT fk_cmd_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id)  ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_cmd_device ON actuator_command(device_id, created_at);
CREATE INDEX idx_cmd_status ON actuator_command(status);

-- ─────────────────────────────────────────────────────────────
-- Latest state snapshot — one row per actuator device
-- ─────────────────────────────────────────────────────────────
CREATE TABLE actuator_state (
  device_id   INT UNSIGNED PRIMARY KEY,
  state_value VARCHAR(100) NOT NULL,
  updated_at  DATETIME(3)  NOT NULL,
  CONSTRAINT fk_state_device FOREIGN KEY (device_id)
    REFERENCES device(device_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 7 — ALERTS & NOTIFICATIONS
-- ============================================================

CREATE TABLE alert_type (
  type_id     TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_name   VARCHAR(60) NOT NULL UNIQUE,
  severity    ENUM('info','warning','critical') DEFAULT 'warning',
  description TEXT
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE alert (
  alert_id        BIGINT   UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_id         TINYINT  UNSIGNED NOT NULL,
  device_id       INT      UNSIGNED,
  room_id         SMALLINT UNSIGNED,
  triggered_value DECIMAL(12,4),
  message         TEXT,
  status          ENUM('active','acknowledged','resolved','false_alarm')
                  DEFAULT 'active',
  acknowledged_by INT UNSIGNED,
  acknowledged_at DATETIME,
  resolved_at     DATETIME,
  triggered_at    DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_alert_type   FOREIGN KEY (type_id)
    REFERENCES alert_type(type_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alert_device FOREIGN KEY (device_id)
    REFERENCES device(device_id)   ON DELETE SET NULL,
  CONSTRAINT fk_alert_room   FOREIGN KEY (room_id)
    REFERENCES room(room_id)       ON DELETE SET NULL,
  CONSTRAINT fk_alert_ack    FOREIGN KEY (acknowledged_by)
    REFERENCES staff(staff_id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_alert_status ON alert(status);
CREATE INDEX idx_alert_room   ON alert(room_id, triggered_at);
CREATE INDEX idx_alert_time   ON alert(triggered_at);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE notification (
  notif_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_id        BIGINT UNSIGNED NOT NULL,
  channel         ENUM('email','push','sms','dashboard') NOT NULL,
  recipient_staff INT UNSIGNED,
  recipient_guest INT UNSIGNED,
  sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read         BOOLEAN  DEFAULT FALSE,
  CONSTRAINT fk_notif_alert FOREIGN KEY (alert_id)
    REFERENCES alert(alert_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 8 — AUTOMATION RULES
-- ============================================================

CREATE TABLE automation_rule (
  rule_id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_name              VARCHAR(100) NOT NULL,
  description            TEXT,
  trigger_type           ENUM('sensor_threshold','schedule','event','manual') NOT NULL,
  trigger_device_type_id SMALLINT UNSIGNED,
  trigger_operator       ENUM('>','<','>=','<=','=','!='),
  trigger_value          DECIMAL(12,4),
  action_device_type_id  SMALLINT UNSIGNED,
  action_command         VARCHAR(60),
  action_payload         JSON,
  applies_to             ENUM('all_rooms','occupied','empty','specific_room')
                         DEFAULT 'all_rooms',
  specific_room_id       SMALLINT UNSIGNED,
  is_active              BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rule_trig_dtype FOREIGN KEY (trigger_device_type_id)
    REFERENCES device_type(type_id) ON DELETE SET NULL,
  CONSTRAINT fk_rule_act_dtype  FOREIGN KEY (action_device_type_id)
    REFERENCES device_type(type_id) ON DELETE SET NULL,
  CONSTRAINT fk_rule_room       FOREIGN KEY (specific_room_id)
    REFERENCES room(room_id)        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
CREATE TABLE automation_log (
  log_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_id            INT    UNSIGNED NOT NULL,
  room_id            SMALLINT UNSIGNED,
  triggered_at       DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  trigger_reading_id BIGINT UNSIGNED,
  actions_taken      JSON,
  CONSTRAINT fk_autolog_rule FOREIGN KEY (rule_id)
    REFERENCES automation_rule(rule_id) ON DELETE CASCADE,
  CONSTRAINT fk_autolog_room FOREIGN KEY (room_id)
    REFERENCES room(room_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_autolog_rule ON automation_log(rule_id, triggered_at);
CREATE INDEX idx_autolog_room ON automation_log(room_id, triggered_at);

-- ============================================================
--  SECTION 9 — ACCESS CONTROL LOGS
-- ============================================================

CREATE TABLE access_log (
  log_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id       SMALLINT UNSIGNED NOT NULL,
  door_device_id INT UNSIGNED,
  actor_type    ENUM('guest','staff','unknown') NOT NULL,
  actor_id      INT UNSIGNED,
  booking_id    INT UNSIGNED,
  action        ENUM('unlock','lock','forced_open','denied','alarm_triggered') NOT NULL,
  method        ENUM('key_card','pin','mobile_app','manual','system') DEFAULT 'key_card',
  is_authorized BOOLEAN NOT NULL,
  ip_address    VARCHAR(45),
  logged_at     DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_acclog_room    FOREIGN KEY (room_id)
    REFERENCES room(room_id)       ON DELETE RESTRICT,
  CONSTRAINT fk_acclog_device  FOREIGN KEY (door_device_id)
    REFERENCES device(device_id)   ON DELETE SET NULL,
  CONSTRAINT fk_acclog_booking FOREIGN KEY (booking_id)
    REFERENCES booking(booking_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_acclog_room ON access_log(room_id, logged_at);
CREATE INDEX idx_acclog_auth ON access_log(is_authorized, logged_at);

-- ============================================================
--  SECTION 10 — ENERGY MANAGEMENT
--
--  FIX for MySQL 8.0: same RANGE partition issue.
--  Added stored generated column `year_key`.
-- ============================================================

CREATE TABLE energy_reading (
  reading_id  BIGINT UNSIGNED AUTO_INCREMENT,
  room_id     SMALLINT UNSIGNED NOT NULL,
  kwh         DECIMAL(10,4) NOT NULL,
  cost        DECIMAL(10,2),
  recorded_at DATETIME      NOT NULL,
  year_key    SMALLINT UNSIGNED GENERATED ALWAYS AS
              (YEAR(recorded_at)) STORED,
  PRIMARY KEY (reading_id, year_key),
  CONSTRAINT fk_energy_room FOREIGN KEY (room_id)
    REFERENCES room(room_id) ON DELETE RESTRICT
) ENGINE=InnoDB
PARTITION BY RANGE (year_key) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p2027 VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE INDEX idx_energy_room_time ON energy_reading(room_id, recorded_at);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE energy_monthly_report (
  report_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id       SMALLINT UNSIGNED NOT NULL,
  report_year   YEAR         NOT NULL,
  report_month  TINYINT UNSIGNED NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  total_kwh     DECIMAL(12,4),
  total_cost    DECIMAL(12,2),
  avg_daily_kwh DECIMAL(10,4),
  peak_kwh      DECIMAL(10,4),
  generated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_energy_report (room_id, report_year, report_month),
  CONSTRAINT fk_erep_room FOREIGN KEY (room_id)
    REFERENCES room(room_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 11 — MAINTENANCE
-- ============================================================

CREATE TABLE maintenance_task (
  task_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id          SMALLINT UNSIGNED,
  device_id        INT      UNSIGNED,
  task_type        ENUM('repair','inspection','cleaning','replacement','calibration') NOT NULL,
  priority         ENUM('low','medium','high','critical') DEFAULT 'medium',
  title            VARCHAR(120) NOT NULL,
  description      TEXT,
  assigned_to      INT UNSIGNED,
  status           ENUM('open','in_progress','completed','cancelled') DEFAULT 'open',
  trigger_alert_id BIGINT UNSIGNED,
  due_date         DATE,
  completed_at     DATETIME,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_room   FOREIGN KEY (room_id)
    REFERENCES room(room_id)      ON DELETE SET NULL,
  CONSTRAINT fk_task_device FOREIGN KEY (device_id)
    REFERENCES device(device_id)  ON DELETE SET NULL,
  CONSTRAINT fk_task_staff  FOREIGN KEY (assigned_to)
    REFERENCES staff(staff_id)    ON DELETE SET NULL,
  CONSTRAINT fk_task_alert  FOREIGN KEY (trigger_alert_id)
    REFERENCES alert(alert_id)    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_task_status   ON maintenance_task(status);
CREATE INDEX idx_task_priority ON maintenance_task(priority, due_date);
CREATE INDEX idx_task_staff    ON maintenance_task(assigned_to);

-- ─────────────────────────────────────────────────────────────
CREATE TABLE maintenance_schedule (
  schedule_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_type_id SMALLINT UNSIGNED,
  room_id        SMALLINT UNSIGNED,
  frequency      ENUM('daily','weekly','monthly','quarterly','annually') NOT NULL,
  task_title     VARCHAR(120) NOT NULL,
  last_run       DATE,
  next_run       DATE,
  is_active      BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_sched_dtype FOREIGN KEY (device_type_id)
    REFERENCES device_type(type_id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_room  FOREIGN KEY (room_id)
    REFERENCES room(room_id)        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
--  SECTION 12 — HOUSEKEEPING
-- ============================================================

CREATE TABLE housekeeping_task (
  task_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id      SMALLINT UNSIGNED NOT NULL,
  assigned_to  INT UNSIGNED,
  task_type    ENUM('checkout_clean','daily_refresh','deep_clean','turndown','inspection') NOT NULL,
  status       ENUM('pending','in_progress','completed','skipped') DEFAULT 'pending',
  triggered_by ENUM('checkout','auto_vacancy','manual','schedule') DEFAULT 'manual',
  notes        TEXT,
  scheduled_at DATETIME,
  started_at   DATETIME,
  completed_at DATETIME,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hk_room  FOREIGN KEY (room_id)
    REFERENCES room(room_id)   ON DELETE RESTRICT,
  CONSTRAINT fk_hk_staff FOREIGN KEY (assigned_to)
    REFERENCES staff(staff_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_hk_room  ON housekeeping_task(room_id,    status);
CREATE INDEX idx_hk_staff ON housekeeping_task(assigned_to, status);

-- ============================================================
--  SECTION 13 — AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  log_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type   ENUM('staff','guest','system') NOT NULL,
  actor_id     INT UNSIGNED,
  action       VARCHAR(100) NOT NULL,
  target_table VARCHAR(60),
  target_id    VARCHAR(40),
  old_value    JSON,
  new_value    JSON,
  ip_address   VARCHAR(45),
  user_agent   VARCHAR(255),
  logged_at    TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE INDEX idx_audit_actor  ON audit_log(actor_type, actor_id, logged_at);
CREATE INDEX idx_audit_target ON audit_log(target_table, target_id);

-- ============================================================
--  SECTION 14 — SEED DATA
-- ============================================================

INSERT INTO role (role_name, description) VALUES
  ('admin',         'Full system access'),
  ('receptionist',  'Bookings and guest management'),
  ('housekeeping',  'Room cleaning and preparation'),
  ('maintenance',   'Device and facility maintenance'),
  ('security',      'Access control and surveillance');

-- ─────────────────────────────────────────────────────────────
INSERT INTO room_type (type_name, base_price, max_occupancy, description) VALUES
  ('Standard',   800000,  2, 'Comfortable standard room'),
  ('Deluxe',    1200000,  2, 'Upgraded room with city view'),
  ('Suite',     2500000,  3, 'Luxury suite with lounge area'),
  ('Executive', 1800000,  2, 'Executive floor with club access'),
  ('Family',    1600000,  4, 'Spacious family room');

-- ─────────────────────────────────────────────────────────────
INSERT INTO alert_type (type_name, severity, description) VALUES
  ('smoke_detected',         'critical', 'Smoke sensor threshold exceeded'),
  ('high_temperature',       'warning',  'Temperature above safe threshold'),
  ('unauthorized_access',    'critical', 'Door opened without authorization'),
  ('device_offline',         'warning',  'IoT device not responding'),
  ('high_humidity',          'warning',  'Humidity above safe threshold'),
  ('motion_after_checkout',  'warning',  'Motion detected in vacant room'),
  ('device_fault',           'critical', 'Device reported hardware fault'),
  ('energy_spike',           'warning',  'Unusual energy consumption spike'),
  ('low_battery',            'info',     'Battery-powered device low battery'),
  ('door_forced',            'critical', 'Door opened without unlock command');

-- ─────────────────────────────────────────────────────────────
INSERT INTO device_category (category_name, description) VALUES
  ('sensor',   'Read-only IoT data input devices'),
  ('actuator', 'Controllable output devices');

-- Sensors (category_id = 1)
INSERT INTO device_type (category_id, type_name, unit, min_value, max_value, protocol, description) VALUES
  (1, 'Temperature Sensor',     '°C',     -10,   60,    'MQTT', 'Measures room air temperature'),
  (1, 'Humidity Sensor',        '%',        0,  100,    'MQTT', 'Measures relative humidity'),
  (1, 'Motion Sensor',          'boolean',  0,    1,    'MQTT', 'PIR occupancy detection'),
  (1, 'Smoke Sensor',           'ppm',      0, 1000,    'MQTT', 'Smoke / CO particle detection'),
  (1, 'Door Contact Sensor',    'boolean',  0,    1,    'MQTT', 'Open/closed door detection'),
  (1, 'Light Intensity Sensor', 'lux',      0, 100000,  'MQTT', 'Ambient light measurement'),
  (1, 'Energy Monitor',         'kWh',      0,  99999,  'MQTT', 'Real-time power consumption'),
  (1, 'CO2 Sensor',             'ppm',      0,  5000,   'MQTT', 'Carbon dioxide level'),
  (1, 'Water Leak Sensor',      'boolean',  0,    1,    'MQTT', 'Detects water on floor'),
  (1, 'Noise Level Sensor',     'dB',       0,  130,    'MQTT', 'Sound level monitoring');

-- Actuators (category_id = 2)
INSERT INTO device_type (category_id, type_name, unit, min_value, max_value, protocol, description) VALUES
  (2, 'Air Conditioner',    '°C',     16,  30,  'MQTT', 'Smart split AC unit'),
  (2, 'Smart Light',        '%',       0, 100,  'MQTT', 'Dimmable LED light strip'),
  (2, 'Smart Door Lock',    'boolean', 0,   1,  'MQTT', 'Electronic deadbolt'),
  (2, 'Motorised Curtain',  '%',       0, 100,  'MQTT', 'Blackout curtain motor'),
  (2, 'Alarm Siren',        'boolean', 0,   1,  'MQTT', 'Audio alert device'),
  (2, 'Smart Power Switch', 'boolean', 0,   1,  'MQTT', 'Master power relay'),
  (2, 'Ventilation Fan',    '%',       0, 100,  'MQTT', 'Exhaust / fresh air fan'),
  (2, 'TV Control',         'boolean', 0,   1,  'MQTT', 'Smart TV power control'),
  (2, 'Do Not Disturb Sign','boolean', 0,   1,  'MQTT', 'Electronic DND indicator'),
  (2, 'Sprinkler',          'boolean', 0,   1,  'MQTT', 'Fire suppression sprinkler');

-- ─────────────────────────────────────────────────────────────
INSERT INTO hotel (hotel_name, address, city, star_rating, total_floors, phone, email) VALUES
  ('Grand IoT Hotel', '123 Innovation Avenue', 'Ho Chi Minh City', 5, 10,
   '+84 28 9999 8888', 'info@iothotel.vn');

-- Floors 1–10
INSERT INTO floor (hotel_id, floor_number, description)
SELECT 1, n,
  CONCAT('Floor ', n, ' — ',
    CASE n
      WHEN 1  THEN 'Lobby & Reception'
      WHEN 2  THEN 'Standard Rooms'
      WHEN 3  THEN 'Standard Rooms'
      WHEN 4  THEN 'Deluxe Rooms'
      WHEN 5  THEN 'Deluxe Rooms'
      WHEN 6  THEN 'Executive Rooms'
      WHEN 7  THEN 'Executive Rooms'
      WHEN 8  THEN 'Family Rooms'
      WHEN 9  THEN 'Suites'
      WHEN 10 THEN 'Presidential Suites'
    END)
FROM (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) nums;

-- 200 Rooms (20 per floor)
INSERT INTO room (floor_id, type_id, room_number, status)
SELECT
  f.floor_id,
  CASE
    WHEN f.floor_number IN (2,3) THEN 1
    WHEN f.floor_number IN (4,5) THEN 2
    WHEN f.floor_number IN (6,7) THEN 4
    WHEN f.floor_number = 8      THEN 5
    ELSE                              3
  END AS type_id,
  CONCAT(LPAD(f.floor_number, 2, '0'), LPAD(r.room_num, 2, '0')),
  'available'
FROM floor f
CROSS JOIN (
  SELECT 1 AS room_num UNION SELECT 2  UNION SELECT 3  UNION SELECT 4  UNION SELECT 5
  UNION SELECT 6       UNION SELECT 7  UNION SELECT 8  UNION SELECT 9  UNION SELECT 10
  UNION SELECT 11      UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16      UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
) r
WHERE f.hotel_id = 1;

-- ─────────────────────────────────────────────────────────────
INSERT INTO staff (first_name, last_name, email, phone, role_id, password_hash, hire_date) VALUES
  ('Nguyen', 'Van Admin',     'admin@iothotel.vn',       '0901111111', 1, '$2b$12$PLACEHOLDER_HASH_ADMIN', '2020-01-01'),
  ('Tran',   'Thi Reception', 'reception@iothotel.vn',   '0902222222', 2, '$2b$12$PLACEHOLDER_HASH_RECEP', '2021-03-15'),
  ('Le',     'Van Housekeep', 'housekeep@iothotel.vn',   '0903333333', 3, '$2b$12$PLACEHOLDER_HASH_HK',    '2022-06-01'),
  ('Pham',   'Thi Maintain',  'maintenance@iothotel.vn', '0904444444', 4, '$2b$12$PLACEHOLDER_HASH_MAINT', '2021-11-20'),
  ('Hoang',  'Van Security',  'security@iothotel.vn',    '0905555555', 5, '$2b$12$PLACEHOLDER_HASH_SEC',   '2023-01-10');

-- ─────────────────────────────────────────────────────────────
INSERT INTO guest (first_name, last_name, email, phone, nationality, passport_no, gender) VALUES
  ('James',  'Wilson', 'james.wilson@email.com', '0911000001', 'American',   'A12345678', 'Male'),
  ('Sakura', 'Tanaka', 'sakura.t@email.jp',      '0911000002', 'Japanese',   'JP9876543', 'Female'),
  ('Ahmed',  'Hassan', 'ahmed.h@email.eg',       '0911000003', 'Egyptian',   'EG5551234', 'Male'),
  ('Maria',  'Santos', 'maria.s@email.ph',       '0911000004', 'Filipino',   'PH1112223', 'Female'),
  ('Minh',   'Nguyen', 'minh.nguyen@email.vn',   '0911000005', 'Vietnamese', 'VN7778889', 'Male');

-- Guest preferences for each guest
INSERT INTO guest_preference (guest_id, preferred_temp_c, preferred_lighting, preferred_curtain, do_not_disturb_default) VALUES
  (1, 22.0, 'bright',  'open',   FALSE),
  (2, 24.0, 'dim',     'closed', TRUE),
  (3, 23.0, 'medium',  'half',   FALSE),
  (4, 25.0, 'medium',  'open',   FALSE),
  (5, 23.5, 'bright',  'half',   TRUE);

-- Sample booking
INSERT INTO booking (guest_id, room_id, check_in_date, check_out_date, num_guests, total_price, status, payment_status) VALUES
  (1, 21, '2025-05-01', '2025-05-05', 1, 4800000, 'confirmed', 'paid'),
  (2, 41, '2025-05-02', '2025-05-04', 2, 2400000, 'confirmed', 'unpaid'),
  (3, 61, '2025-05-03', '2025-05-07', 1, 7200000, 'pending',   'unpaid');

-- ─────────────────────────────────────────────────────────────
INSERT INTO automation_rule
  (rule_name, description, trigger_type,
   trigger_device_type_id, trigger_operator, trigger_value,
   action_device_type_id, action_command, action_payload, applies_to) VALUES
  ('Auto AC on High Temp',    'Turn on AC when temp > 28°C',       'sensor_threshold', 1,  '>',  28.0, 11, 'TURN_ON',    '{"target_temp": 24}', 'occupied'),
  ('Lights Off No Motion',    'Turn off lights after 30 min idle', 'sensor_threshold', 3,  '=',   0.0, 12, 'TURN_OFF',   '{}',                  'occupied'),
  ('Smoke Alarm Trigger',     'Alarm when smoke > 200 ppm',        'sensor_threshold', 4,  '>',  200,  15, 'TURN_ON',    '{"duration": 60}',    'all_rooms'),
  ('Energy Save Empty Room',  'Power off when room empty',         'sensor_threshold', 3,  '=',   0.0, 16, 'POWER_SAVE', '{"mode": "eco"}',     'all_rooms'),
  ('Auto Lock on Checkout',   'Lock door after checkout',          'event',           NULL, NULL, NULL, 13, 'LOCK',       '{}',                  'all_rooms'),
  ('High Humidity Fan On',    'Fan on when humidity > 80%',        'sensor_threshold', 2,  '>',  80.0, 17, 'SET_SPEED',  '{"speed": 80}',       'all_rooms');

-- ============================================================
--  SECTION 15 — VIEWS
-- ============================================================

CREATE OR REPLACE VIEW vw_room_overview AS
SELECT
  r.room_id,
  r.room_number,
  r.status,
  f.floor_number,
  rt.type_name      AS room_type,
  rt.base_price,
  COUNT(d.device_id)  AS total_devices,
  SUM(d.is_active)    AS active_devices
FROM room r
JOIN floor      f  ON r.floor_id = f.floor_id
JOIN room_type  rt ON r.type_id  = rt.type_id
LEFT JOIN device d ON r.room_id  = d.room_id
GROUP BY r.room_id, r.room_number, r.status,
         f.floor_number, rt.type_name, rt.base_price;

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_active_booking AS
SELECT
  b.booking_id,
  b.status,
  CONCAT(g.first_name, ' ', g.last_name) AS guest_name,
  g.email,
  g.phone,
  r.room_number,
  f.floor_number,
  rt.type_name   AS room_type,
  b.check_in_date,
  b.check_out_date,
  DATEDIFF(b.check_out_date, b.check_in_date) AS nights,
  b.total_price,
  b.payment_status
FROM booking b
JOIN guest     g  ON b.guest_id = g.guest_id
JOIN room      r  ON b.room_id  = r.room_id
JOIN floor     f  ON r.floor_id = f.floor_id
JOIN room_type rt ON r.type_id  = rt.type_id
WHERE b.status IN ('confirmed','checked_in');

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_active_alerts AS
SELECT
  a.alert_id,
  at2.type_name,
  at2.severity,
  r.room_number,
  f.floor_number,
  d.serial_number  AS device_serial,
  dt.type_name     AS device_type,
  a.triggered_value,
  a.message,
  a.status,
  a.triggered_at
FROM alert a
JOIN alert_type  at2 ON a.type_id   = at2.type_id
LEFT JOIN room    r  ON a.room_id   = r.room_id
LEFT JOIN floor   f  ON r.floor_id  = f.floor_id
LEFT JOIN device  d  ON a.device_id = d.device_id
LEFT JOIN device_type dt ON d.type_id = dt.type_id
WHERE a.status = 'active'
ORDER BY at2.severity DESC, a.triggered_at DESC;

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_device_status AS
SELECT
  d.device_id,
  d.serial_number,
  dt.type_name,
  dc.category_name,
  r.room_number,
  f.floor_number,
  d.is_active,
  d.last_seen,
  COALESCE(ast.state_value, 'unknown') AS current_state,
  TIMESTAMPDIFF(MINUTE, d.last_seen, NOW()) AS minutes_since_seen
FROM device d
JOIN device_type     dt  ON d.type_id     = dt.type_id
JOIN device_category dc  ON dt.category_id = dc.category_id
JOIN room            r   ON d.room_id     = r.room_id
JOIN floor           f   ON r.floor_id    = f.floor_id
LEFT JOIN actuator_state ast ON d.device_id = ast.device_id;

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_energy_summary AS
SELECT
  r.room_number,
  f.floor_number,
  DATE(er.recorded_at)     AS day,
  ROUND(SUM(er.kwh), 3)    AS total_kwh,
  ROUND(SUM(er.cost), 2)   AS total_cost_vnd
FROM energy_reading er
JOIN room  r ON er.room_id = r.room_id
JOIN floor f ON r.floor_id = f.floor_id
GROUP BY r.room_number, f.floor_number, DATE(er.recorded_at);

-- ============================================================
--  SECTION 16 — STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- Auto-create housekeeping task on checkout
CREATE PROCEDURE sp_trigger_checkout_clean(IN p_booking_id INT UNSIGNED)
BEGIN
  DECLARE v_room_id SMALLINT UNSIGNED;
  SELECT room_id INTO v_room_id
  FROM booking WHERE booking_id = p_booking_id;

  INSERT INTO housekeeping_task (room_id, task_type, status, triggered_by, scheduled_at)
  VALUES (v_room_id, 'checkout_clean', 'pending', 'checkout', NOW());

  UPDATE room SET status = 'cleaning' WHERE room_id = v_room_id;
END$$

-- ─────────────────────────────────────────────────────────────
-- Raise an alert and notify all admin + maintenance staff
CREATE PROCEDURE sp_raise_alert(
  IN p_type_id   TINYINT  UNSIGNED,
  IN p_device_id INT      UNSIGNED,
  IN p_room_id   SMALLINT UNSIGNED,
  IN p_value     DECIMAL(12,4),
  IN p_message   TEXT
)
BEGIN
  DECLARE v_alert_id BIGINT UNSIGNED;

  INSERT INTO alert (type_id, device_id, room_id, triggered_value, message)
  VALUES (p_type_id, p_device_id, p_room_id, p_value, p_message);

  SET v_alert_id = LAST_INSERT_ID();

  INSERT INTO notification (alert_id, channel, recipient_staff)
  SELECT v_alert_id, 'dashboard', staff_id
  FROM staff
  WHERE role_id IN (1, 4) AND is_active = TRUE;
END$$

DELIMITER ;

-- ============================================================
--  SECTION 17 — TRIGGERS
-- ============================================================

DELIMITER $$

-- Sync room status with booking lifecycle
CREATE TRIGGER trg_booking_checkin
AFTER UPDATE ON booking
FOR EACH ROW
BEGIN
  IF NEW.status = 'checked_in' AND OLD.status != 'checked_in' THEN
    UPDATE room SET status = 'occupied' WHERE room_id = NEW.room_id;
  END IF;
  IF NEW.status = 'checked_out' AND OLD.status != 'checked_out' THEN
    CALL sp_trigger_checkout_clean(NEW.booking_id);
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IN ('confirmed','pending') THEN
    UPDATE room SET status = 'available' WHERE room_id = NEW.room_id;
  END IF;
END$$

-- ─────────────────────────────────────────────────────────────
-- Auto smoke alert on high sensor reading
CREATE TRIGGER trg_smoke_alert
AFTER INSERT ON sensor_reading
FOR EACH ROW
BEGIN
  DECLARE v_type_name VARCHAR(80);
  SELECT dt.type_name INTO v_type_name
  FROM device d
  JOIN device_type dt ON d.type_id = dt.type_id
  WHERE d.device_id = NEW.device_id;

  IF v_type_name = 'Smoke Sensor' AND NEW.value > 200 THEN
    CALL sp_raise_alert(
      1,
      NEW.device_id,
      NEW.room_id,
      NEW.value,
      CONCAT('Smoke level ', NEW.value, ' ppm detected in room ', NEW.room_id)
    );
  END IF;
END$$

-- ─────────────────────────────────────────────────────────────
-- Keep device.last_seen up to date on every reading
CREATE TRIGGER trg_device_heartbeat
AFTER INSERT ON sensor_reading
FOR EACH ROW
BEGIN
  UPDATE device
  SET last_seen = NEW.recorded_at
  WHERE device_id = NEW.device_id;
END$$

DELIMITER ;

-- ============================================================
--  DONE — verify
-- ============================================================
SELECT CONCAT('Tables   : ', COUNT(*)) AS summary
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'iot_hotel' AND TABLE_TYPE = 'BASE TABLE'
UNION ALL
SELECT CONCAT('Views    : ', COUNT(*))
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = 'iot_hotel'
UNION ALL
SELECT CONCAT('Triggers : ', COUNT(*))
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = 'iot_hotel'
UNION ALL
SELECT CONCAT('Routines : ', COUNT(*))
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = 'iot_hotel';
-- ============================================================
--  PATCH: Remove FK from partitioned tables (MySQL 8.0 rule)
--  Partitioned tables do NOT support FOREIGN KEY constraints.
--  Run this inside iot_hotel database.
-- ============================================================

USE iot_hotel;

-- Drop triggers that depend on sensor_reading first
DROP TRIGGER IF EXISTS trg_smoke_alert;
DROP TRIGGER IF EXISTS trg_device_heartbeat;

-- Drop dependents, then recreate without FK
DROP TABLE IF EXISTS sensor_hourly_agg;
DROP TABLE IF EXISTS sensor_reading;
DROP TABLE IF EXISTS energy_reading;

-- ─────────────────────────────────────────────────────────────
-- sensor_reading  — NO foreign key, partitioned by month_key
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sensor_reading (
  reading_id  BIGINT UNSIGNED AUTO_INCREMENT,
  device_id   INT    UNSIGNED NOT NULL,   -- intentionally no FK
  room_id     SMALLINT UNSIGNED NOT NULL, -- intentionally no FK
  value       DECIMAL(12,4) NOT NULL,
  raw_payload JSON,
  recorded_at DATETIME(3)   NOT NULL,
  month_key   INT UNSIGNED GENERATED ALWAYS AS
              (YEAR(recorded_at) * 100 + MONTH(recorded_at)) STORED,
  PRIMARY KEY (reading_id, month_key)
) ENGINE=InnoDB
PARTITION BY RANGE (month_key) (
  PARTITION p2025_01 VALUES LESS THAN (202502),
  PARTITION p2025_02 VALUES LESS THAN (202503),
  PARTITION p2025_03 VALUES LESS THAN (202504),
  PARTITION p2025_04 VALUES LESS THAN (202505),
  PARTITION p2025_05 VALUES LESS THAN (202506),
  PARTITION p2025_06 VALUES LESS THAN (202507),
  PARTITION p2025_07 VALUES LESS THAN (202508),
  PARTITION p2025_08 VALUES LESS THAN (202509),
  PARTITION p2025_09 VALUES LESS THAN (202510),
  PARTITION p2025_10 VALUES LESS THAN (202511),
  PARTITION p2025_11 VALUES LESS THAN (202512),
  PARTITION p2025_12 VALUES LESS THAN (202601),
  PARTITION p2026_01 VALUES LESS THAN (202602),
  PARTITION p2026_02 VALUES LESS THAN (202603),
  PARTITION p2026_03 VALUES LESS THAN (202604),
  PARTITION p2026_04 VALUES LESS THAN (202605),
  PARTITION p2026_05 VALUES LESS THAN (202606),
  PARTITION p2026_06 VALUES LESS THAN (202607),
  PARTITION p2026_07 VALUES LESS THAN (202608),
  PARTITION p2026_08 VALUES LESS THAN (202609),
  PARTITION p2026_09 VALUES LESS THAN (202610),
  PARTITION p2026_10 VALUES LESS THAN (202611),
  PARTITION p2026_11 VALUES LESS THAN (202612),
  PARTITION p2026_12 VALUES LESS THAN (202701),
  PARTITION p_future  VALUES LESS THAN MAXVALUE
);

CREATE INDEX idx_sensor_device_time ON sensor_reading(device_id, recorded_at);
CREATE INDEX idx_sensor_room_time   ON sensor_reading(room_id,   recorded_at);

-- ─────────────────────────────────────────────────────────────
-- sensor_hourly_agg  — NO foreign key (references partitioned table)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sensor_hourly_agg (
  agg_id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id    INT    UNSIGNED NOT NULL,  -- intentionally no FK
  hour_bucket  DATETIME NOT NULL,
  avg_value    DECIMAL(12,4),
  min_value    DECIMAL(12,4),
  max_value    DECIMAL(12,4),
  sample_count INT UNSIGNED,
  UNIQUE KEY uq_agg (device_id, hour_bucket)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
-- energy_reading  — NO foreign key, partitioned by year_key
-- ─────────────────────────────────────────────────────────────
CREATE TABLE energy_reading (
  reading_id  BIGINT UNSIGNED AUTO_INCREMENT,
  room_id     SMALLINT UNSIGNED NOT NULL,  -- intentionally no FK
  kwh         DECIMAL(10,4) NOT NULL,
  cost        DECIMAL(10,2),
  recorded_at DATETIME      NOT NULL,
  year_key    SMALLINT UNSIGNED GENERATED ALWAYS AS
              (YEAR(recorded_at)) STORED,
  PRIMARY KEY (reading_id, year_key)
) ENGINE=InnoDB
PARTITION BY RANGE (year_key) (
  PARTITION p2024   VALUES LESS THAN (2025),
  PARTITION p2025   VALUES LESS THAN (2026),
  PARTITION p2026   VALUES LESS THAN (2027),
  PARTITION p2027   VALUES LESS THAN (2028),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE INDEX idx_energy_room_time ON energy_reading(room_id, recorded_at);
- ─────────────────────────────────────────────────────────────
-- edge_gateway — heartbeat của từng Edge node (Raspberry Pi / simulator)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS edge_gateway (
    gateway_id     INT UNSIGNED PRIMARY KEY,
    node_name      VARCHAR(100),
    status         ENUM('online','offline') DEFAULT 'offline',
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
 
-- ─────────────────────────────────────────────────────────────
-- ai_prediction — kết quả occupancy prediction ghi lại mỗi cycle
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_prediction (
    prediction_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_number         VARCHAR(10) NOT NULL,
    model_name          VARCHAR(50),
    model_version       VARCHAR(20),
    features_used       JSON,
    predicted_occupied  BOOLEAN,
    probability         DECIMAL(5,4),
    predicted_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prediction_room FOREIGN KEY (room_number)
        REFERENCES room(room_number) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
 
CREATE INDEX idx_prediction_room_time ON ai_prediction(room_number, predicted_at);
 
-- ─────────────────────────────────────────────────────────────
-- perf_metric — log hiệu năng (latency, throughput...) của edge/AI
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perf_metric (
    metric_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    component     VARCHAR(50),
    gateway_id    INT UNSIGNED,
    metric_name   VARCHAR(50),
    metric_value  DECIMAL(12,4),
    unit          VARCHAR(20),
    recorded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_perf_gateway FOREIGN KEY (gateway_id)
        REFERENCES edge_gateway(gateway_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
 
CREATE INDEX idx_perf_component_time ON perf_metric(component, recorded_at);
 

-- ─────────────────────────────────────────────────────────────
-- Recreate triggers
-- ─────────────────────────────────────────────────────────────
DELIMITER $$

CREATE TRIGGER trg_smoke_alert
AFTER INSERT ON sensor_reading
FOR EACH ROW
BEGIN
  DECLARE v_type_name VARCHAR(80);
  SELECT dt.type_name INTO v_type_name
  FROM device d
  JOIN device_type dt ON d.type_id = dt.type_id
  WHERE d.device_id = NEW.device_id;

  IF v_type_name = 'Smoke Sensor' AND NEW.value > 200 THEN
    CALL sp_raise_alert(
      1,
      NEW.device_id,
      NEW.room_id,
      NEW.value,
      CONCAT('Smoke level ', NEW.value, ' ppm detected in room ', NEW.room_id)
    );
  END IF;
END$$

CREATE TRIGGER trg_device_heartbeat
AFTER INSERT ON sensor_reading
FOR EACH ROW
BEGIN
  UPDATE device
  SET last_seen = NEW.recorded_at
  WHERE device_id = NEW.device_id;
END$$

DELIMITER ;

-- Verify
SELECT TABLE_NAME, PARTITION_METHOD, PARTITION_COUNT
FROM (
  SELECT
    TABLE_NAME,
    PARTITION_METHOD,
    COUNT(PARTITION_NAME) AS PARTITION_COUNT
  FROM information_schema.PARTITIONS
  WHERE TABLE_SCHEMA = 'iot_hotel'
    AND PARTITION_NAME IS NOT NULL
  GROUP BY TABLE_NAME, PARTITION_METHOD
) t;
