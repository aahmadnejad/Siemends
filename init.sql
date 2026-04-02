CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'analyst',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS detected_alerts (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ DEFAULT NOW(),
    alert_type TEXT,
    source_ip TEXT,
    victim_ip TEXT,
    details TEXT,
    severity TEXT DEFAULT 'MEDIUM',
    ai_check TEXT DEFAULT 'PENDING',
    ai_label BOOLEAN DEFAULT FALSE,
    ai_analysis JSONB,
    status TEXT DEFAULT 'OPEN',
    notified BOOLEAN DEFAULT FALSE,
    assigned_to INTEGER REFERENCES users(id),
    assigned_from INTEGER REFERENCES users(id),
    assigned_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS alert_comments (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES detected_alerts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packets (
    id SERIAL, 
    time TIMESTAMPTZ NOT NULL, 
    sensor_id TEXT,
    src_mac TEXT,
    dst_mac TEXT,
    src_ip TEXT,
    dst_ip TEXT,
    src_port INTEGER,
    dst_port INTEGER,
    proto INTEGER,
    flags TEXT,
    size INTEGER,
    raw_hex TEXT,
    PRIMARY KEY (id, time) 
);

SELECT create_hypertable('packets', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('packets', INTERVAL '1 hour', if_not_exists => TRUE);

INSERT INTO users (username, password_hash, full_name, role) 
VALUES ('admin', '$2b$12$HlK0s/cxx0kaoqUrmV0AL.ojklVp3Inuoiyfkb5ZwIAa400iGUW3e', 'System Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, password_hash, full_name, role) 
VALUES ('amir', '$2b$12$HlK0s/cxx0kaoqUrmV0AL.ojklVp3Inuoiyfkb5ZwIAa400iGUW3e', 'AmirHossein', 'analyst')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, password_hash, full_name, role) 
VALUES ('nima', '$2b$12$HlK0s/cxx0kaoqUrmV0AL.ojklVp3Inuoiyfkb5ZwIAa400iGUW3e', 'Nima', 'analyst')
ON CONFLICT (username) DO NOTHING;