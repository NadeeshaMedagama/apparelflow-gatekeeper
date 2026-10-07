-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUTTING_SUPERVISOR', 'CUTTING_VERIFIER', 'SEWING_SUPERVISOR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED', 'SEWING_IN_PROGRESS');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RejectionCategory" AS ENUM ('COMPONENT_SHORTAGE', 'FABRIC_DEFECT', 'CUTTING_DEFECT', 'COUNT_MISMATCH', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "recipe_code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "std_fabric_yards" DECIMAL(8,3) NOT NULL,
    "wastage_cap" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_components" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "component_name" VARCHAR(120) NOT NULL,
    "pieces_per_garment" INTEGER NOT NULL,
    "image_url" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_orders" (
    "id" UUID NOT NULL,
    "order_no" VARCHAR(32) NOT NULL DEFAULT next_cutting_order_no(),
    "recipe_id" UUID NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "fabric_roll_id" VARCHAR(40) NOT NULL,
    "actual_fabric_yds" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CUTTING_IN_PROGRESS',
    "verification_round" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "sewing_started_at" TIMESTAMPTZ(3),
    "sewing_started_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cutting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER,
    "status" "ComponentStatus",
    "counted_by" UUID,
    "counted_at" TIMESTAMPTZ(3),

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "verifier_id" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "round" INTEGER NOT NULL,
    "rejection_category" "RejectionCategory",
    "rejection_note" VARCHAR(1000),
    "approval_note" VARCHAR(500),
    "wastage_pct" DECIMAL(9,2) NOT NULL,
    "wastage_cap" DECIMAL(5,2) NOT NULL,
    "expected_fabric_yds" DECIMAL(14,3) NOT NULL,
    "actual_fabric_yds" DECIMAL(10,2) NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_log_items" (
    "id" UUID NOT NULL,
    "log_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "component_name" VARCHAR(120) NOT NULL,
    "pieces_per_garment" INTEGER NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER,
    "variance" INTEGER,
    "status" "ComponentStatus",

    CONSTRAINT "verification_log_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" SERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipe_code_key" ON "recipes"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_components_recipe_id_component_name_key" ON "recipe_components"("recipe_id", "component_name");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_orders_order_no_key" ON "cutting_orders"("order_no");

-- CreateIndex
CREATE INDEX "cutting_orders_status_submitted_at_idx" ON "cutting_orders"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "cutting_orders_status_verified_at_idx" ON "cutting_orders"("status", "verified_at");

-- CreateIndex
CREATE INDEX "cutting_orders_created_by_idx" ON "cutting_orders"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_order_id_component_id_key" ON "verification_items"("order_id", "component_id");

-- CreateIndex
CREATE INDEX "verification_logs_timestamp_idx" ON "verification_logs"("timestamp");

-- CreateIndex
CREATE INDEX "verification_logs_verifier_id_idx" ON "verification_logs"("verifier_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_logs_order_id_round_key" ON "verification_logs"("order_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "verification_log_items_log_id_component_id_key" ON "verification_log_items"("log_id", "component_id");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_id_idx" ON "order_status_events"("order_id", "id");

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_started_by_fkey" FOREIGN KEY ("sewing_started_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "recipe_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_log_items" ADD CONSTRAINT "verification_log_items_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "verification_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_log_items" ADD CONSTRAINT "verification_log_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "recipe_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

