-- Human-readable cutting order numbers (CUT-YYYY-NNNN) issued atomically by a
-- database sequence, so concurrent order creation can never produce duplicates.
-- Must run before the init migration: cutting_orders.order_no defaults to it.

CREATE SEQUENCE "cutting_order_no_seq" AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE OR REPLACE FUNCTION next_cutting_order_no() RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  n bigint := nextval('cutting_order_no_seq');
BEGIN
  -- lpad() truncates longer strings, so only pad numbers that fit in 4 digits.
  RETURN 'CUT-' || to_char(now(), 'YYYY') || '-' ||
         CASE WHEN n < 10000 THEN lpad(n::text, 4, '0') ELSE n::text END;
END;
$$;
