CREATE TRIGGER IF NOT EXISTS protect_paid_booking_update
BEFORE UPDATE ON bookings
WHEN OLD.payment_id IS NOT NULL AND (
  OLD.id IS NOT NEW.id OR OLD.payment_id IS NOT NEW.payment_id OR
  OLD.order_id IS NOT NEW.order_id OR OLD.amount IS NOT NEW.amount OR
  OLD.starts IS NOT NEW.starts OR OLD.ends IS NOT NEW.ends OR
  OLD.station IS NOT NEW.station
)
BEGIN
  SELECT RAISE(ABORT, 'Paid booking details are locked');
END;

CREATE TRIGGER IF NOT EXISTS protect_paid_booking_delete
BEFORE DELETE ON bookings
WHEN OLD.payment_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'Paid bookings cannot be deleted');
END;
