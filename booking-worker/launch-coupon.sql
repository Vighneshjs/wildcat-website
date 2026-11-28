ALTER TABLE bookings ADD COLUMN coupon_code TEXT;
CREATE INDEX IF NOT EXISTS bookings_coupon ON bookings(coupon_code);
CREATE TRIGGER IF NOT EXISTS launch_coupon_limit
BEFORE INSERT ON bookings
WHEN NEW.coupon_code = 'WILDCATFREE' AND
  (SELECT COUNT(*) FROM bookings WHERE coupon_code = 'WILDCATFREE') >= 5
BEGIN
  SELECT RAISE(ABORT, 'launch_coupon_exhausted');
END;
