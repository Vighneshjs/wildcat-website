CREATE TABLE IF NOT EXISTS booking_checkins (
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id),
  device TEXT NOT NULL,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
