-- =============================================================================
-- ApparelFlow integrity guards — defence in depth
--
-- The domain services enforce every rule below before they write, and return
-- clean 403/409/422 responses. These constraints and triggers make the same
-- rules hold even when application code is bypassed (direct SQL, a future bug,
-- a compromised handler): an unverified or short batch cannot become VERIFIED,
-- and the audit trail cannot be rewritten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Value constraints (mirror src/domain/limits.ts)
-- -----------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "users_full_name_present_chk" CHECK (char_length(btrim("full_name")) > 0);

ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_std_fabric_positive_chk" CHECK ("std_fabric_yards" > 0),
  ADD CONSTRAINT "recipes_wastage_cap_range_chk" CHECK ("wastage_cap" >= 0 AND "wastage_cap" <= 100);

ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_pieces_positive_chk" CHECK ("pieces_per_garment" > 0);

ALTER TABLE "cutting_orders"
  ADD CONSTRAINT "cutting_orders_target_qty_range_chk" CHECK ("target_qty" BETWEEN 1 AND 50000),
  ADD CONSTRAINT "cutting_orders_fabric_positive_chk" CHECK ("actual_fabric_yds" > 0),
  ADD CONSTRAINT "cutting_orders_fabric_roll_format_chk"
    CHECK ("fabric_roll_id" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND char_length("fabric_roll_id") BETWEEN 3 AND 40),
  ADD CONSTRAINT "cutting_orders_round_non_negative_chk" CHECK ("verification_round" >= 0),
  ADD CONSTRAINT "cutting_orders_verified_at_chk"
    CHECK ("status" NOT IN ('VERIFIED', 'SEWING_IN_PROGRESS') OR "verified_at" IS NOT NULL),
  ADD CONSTRAINT "cutting_orders_sewing_start_chk"
    CHECK ("status" <> 'SEWING_IN_PROGRESS' OR ("sewing_started_at" IS NOT NULL AND "sewing_started_by" IS NOT NULL));

ALTER TABLE "verification_items"
  ADD CONSTRAINT "verification_items_expected_positive_chk" CHECK ("expected_qty" > 0),
  ADD CONSTRAINT "verification_items_actual_non_negative_chk" CHECK ("actual_qty" IS NULL OR "actual_qty" >= 0),
  -- The stored traffic light can never disagree with the physical count.
  ADD CONSTRAINT "verification_items_status_matches_count_chk" CHECK (
       ("actual_qty" IS NULL AND "status" IS NULL)
    OR ("actual_qty" = "expected_qty" AND "status" = 'GREEN')
    OR ("actual_qty" > "expected_qty" AND "status" = 'YELLOW')
    OR ("actual_qty" < "expected_qty" AND "status" = 'RED')
  );

ALTER TABLE "verification_logs"
  ADD CONSTRAINT "verification_logs_round_positive_chk" CHECK ("round" >= 1),
  ADD CONSTRAINT "verification_logs_target_positive_chk" CHECK ("target_qty" > 0),
  ADD CONSTRAINT "verification_logs_expected_fabric_positive_chk" CHECK ("expected_fabric_yds" > 0),
  -- A rejection always carries a category and a meaningful reason note.
  ADD CONSTRAINT "verification_logs_rejection_reason_chk" CHECK (
       "decision" <> 'REJECTED'
    OR ("rejection_category" IS NOT NULL
        AND "rejection_note" IS NOT NULL
        AND char_length(btrim("rejection_note")) >= 10)
  ),
  ADD CONSTRAINT "verification_logs_approval_fields_chk" CHECK (
    "decision" <> 'APPROVED' OR ("rejection_category" IS NULL AND "rejection_note" IS NULL)
  );

ALTER TABLE "verification_log_items"
  ADD CONSTRAINT "verification_log_items_expected_positive_chk" CHECK ("expected_qty" > 0),
  ADD CONSTRAINT "verification_log_items_snapshot_consistent_chk" CHECK (
       ("actual_qty" IS NULL AND "variance" IS NULL AND "status" IS NULL)
    OR ("actual_qty" >= 0
        AND "variance" = "actual_qty" - "expected_qty"
        AND (   ("actual_qty" = "expected_qty" AND "status" = 'GREEN')
             OR ("actual_qty" > "expected_qty" AND "status" = 'YELLOW')
             OR ("actual_qty" < "expected_qty" AND "status" = 'RED')))
  );

-- -----------------------------------------------------------------------------
-- 2. Append-only audit trail
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apparelflow_forbid_audit_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit table % is append-only: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "verification_logs_append_only"
  BEFORE UPDATE OR DELETE ON "verification_logs"
  FOR EACH ROW EXECUTE FUNCTION apparelflow_forbid_audit_mutation();

CREATE TRIGGER "verification_log_items_append_only"
  BEFORE UPDATE OR DELETE ON "verification_log_items"
  FOR EACH ROW EXECUTE FUNCTION apparelflow_forbid_audit_mutation();

CREATE TRIGGER "order_status_events_append_only"
  BEFORE UPDATE OR DELETE ON "order_status_events"
  FOR EACH ROW EXECUTE FUNCTION apparelflow_forbid_audit_mutation();

-- -----------------------------------------------------------------------------
-- 3. Manufacturing state machine + gatekeeper hard stop
--    (mirrors src/domain/state-machine.ts and src/domain/gate.ts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apparelflow_enforce_order_state() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'CUTTING_IN_PROGRESS' OR NEW.verification_round <> 0 THEN
      RAISE EXCEPTION 'Illegal cutting order transition: new orders must start in CUTTING_IN_PROGRESS at round 0 (got % / %)',
        NEW.status, NEW.verification_round
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.order_no IS DISTINCT FROM OLD.order_no OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Order % is locked: order number and creator are immutable', OLD.order_no
      USING ERRCODE = 'check_violation';
  END IF;

  -- Batch details are frozen once the bundles leave the cutting table.
  IF OLD.status <> 'CUTTING_IN_PROGRESS' AND (
       NEW.recipe_id IS DISTINCT FROM OLD.recipe_id
    OR NEW.target_qty IS DISTINCT FROM OLD.target_qty
    OR NEW.fabric_roll_id IS DISTINCT FROM OLD.fabric_roll_id
    OR NEW.actual_fabric_yds IS DISTINCT FROM OLD.actual_fabric_yds
  ) THEN
    RAISE EXCEPTION 'Order % is locked: batch details cannot change while %', OLD.order_no, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- The QC round only advances on submission to the QC station.
  IF NEW.verification_round IS DISTINCT FROM OLD.verification_round AND NOT (
       OLD.status = 'CUTTING_IN_PROGRESS'
   AND NEW.status = 'PENDING_VERIFICATION'
   AND NEW.verification_round = OLD.verification_round + 1
  ) THEN
    RAISE EXCEPTION 'Illegal cutting order transition: QC round of % cannot change from % to %',
      OLD.order_no, OLD.verification_round, NEW.verification_round
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
       (OLD.status = 'CUTTING_IN_PROGRESS'  AND NEW.status = 'PENDING_VERIFICATION')
    OR (OLD.status = 'PENDING_VERIFICATION' AND NEW.status IN ('VERIFIED', 'REJECTED'))
    OR (OLD.status = 'REJECTED'             AND NEW.status = 'CUTTING_IN_PROGRESS')
    OR (OLD.status = 'VERIFIED'             AND NEW.status = 'SEWING_IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'Illegal cutting order transition: % -> % for %', OLD.status, NEW.status, OLD.order_no
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'PENDING_VERIFICATION' AND NEW.verification_round <> OLD.verification_round + 1 THEN
    RAISE EXCEPTION 'Illegal cutting order transition: submitting % must open a new QC round', OLD.order_no
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'VERIFIED' THEN
    -- Hard stop: every recipe component must be present, counted and not short,
    -- measured against the recipe itself rather than the stored expectation.
    IF EXISTS (
      SELECT 1
        FROM recipe_components rc
        LEFT JOIN verification_items vi
          ON vi.order_id = NEW.id AND vi.component_id = rc.id
       WHERE rc.recipe_id = NEW.recipe_id
         AND (   vi.id IS NULL
              OR vi.actual_qty IS NULL
              OR vi.actual_qty < NEW.target_qty * rc.pieces_per_garment)
    ) OR NOT EXISTS (SELECT 1 FROM recipe_components rc WHERE rc.recipe_id = NEW.recipe_id) THEN
      RAISE EXCEPTION 'Gatekeeper hard stop: % has missing, uncounted or short components', OLD.order_no
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM verification_logs vl
       WHERE vl.order_id = NEW.id
         AND vl.round = NEW.verification_round
         AND vl.decision = 'APPROVED'
    ) THEN
      RAISE EXCEPTION 'Gatekeeper hard stop: % has no APPROVED verification record for QC round %',
        OLD.order_no, NEW.verification_round
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status = 'REJECTED' AND NOT EXISTS (
    SELECT 1 FROM verification_logs vl
     WHERE vl.order_id = NEW.id
       AND vl.round = NEW.verification_round
       AND vl.decision = 'REJECTED'
  ) THEN
    RAISE EXCEPTION 'Gatekeeper hard stop: % cannot be rejected without a rejection record', OLD.order_no
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "cutting_orders_state_machine"
  BEFORE INSERT OR UPDATE ON "cutting_orders"
  FOR EACH ROW EXECUTE FUNCTION apparelflow_enforce_order_state();

-- -----------------------------------------------------------------------------
-- 4. Count sheet lock
--    Rows are issued only at the cutting table (submission) and counted only at
--    the QC station. After a decision the sheet is frozen.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apparelflow_guard_count_sheet() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order uuid;
  order_status "OrderStatus";
  order_ref text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_order := OLD.order_id;
  ELSE
    target_order := NEW.order_id;
  END IF;

  SELECT co.status, co.order_no INTO order_status, order_ref
    FROM cutting_orders co
   WHERE co.id = target_order;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.component_id IS DISTINCT FROM OLD.component_id
       OR NEW.expected_qty IS DISTINCT FROM OLD.expected_qty THEN
      RAISE EXCEPTION 'Count sheet for % is locked: only physical counts can change', order_ref
        USING ERRCODE = 'check_violation';
    END IF;
    IF order_status IS DISTINCT FROM 'PENDING_VERIFICATION' THEN
      RAISE EXCEPTION 'Count sheet for % is locked while the order is %', order_ref, order_status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF order_status IS DISTINCT FROM 'CUTTING_IN_PROGRESS' THEN
    RAISE EXCEPTION 'Count sheet for % is locked while the order is %', order_ref, order_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "verification_items_count_sheet_lock"
  BEFORE INSERT OR UPDATE OR DELETE ON "verification_items"
  FOR EACH ROW EXECUTE FUNCTION apparelflow_guard_count_sheet();
