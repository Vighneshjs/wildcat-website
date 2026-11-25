CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  opens TEXT NOT NULL,
  closes TEXT NOT NULL,
  stations INTEGER NOT NULL,
  hourly_paise INTEGER NOT NULL,
  online INTEGER NOT NULL,
  two_hour_paise INTEGER NOT NULL DEFAULT 35000,
  three_hour_paise INTEGER NOT NULL DEFAULT 50000
);
INSERT OR IGNORE INTO settings (id, opens, closes, stations, hourly_paise, online) VALUES (1, '10:00', '19:30', 1, 20000, 0);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  starts INTEGER NOT NULL,
  ends INTEGER NOT NULL,
  station INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  expires INTEGER,
  status TEXT NOT NULL,
  order_id TEXT UNIQUE,
  payment_id TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS blocks (
  station INTEGER NOT NULL,
  starts INTEGER NOT NULL,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  PRIMARY KEY (station, starts)
);
CREATE INDEX IF NOT EXISTS blocks_booking ON blocks(booking_id);
CREATE INDEX IF NOT EXISTS bookings_expiry ON bookings(status, expires);
