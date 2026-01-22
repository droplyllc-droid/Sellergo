-- =============================================================================
-- ROW LEVEL SECURITY (RLS) MIGRATION
-- This migration enables RLS on all tenant-scoped tables
-- =============================================================================

-- Enable RLS extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CREATE APP ROLE FOR RLS
-- =============================================================================

-- Create application role if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user;
  END IF;
END
$$;

-- =============================================================================
-- ENABLE RLS ON TENANT-SCOPED TABLES
-- =============================================================================

-- Stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_tenant_isolation ON stores
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY stores_tenant_insert ON stores
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Store Members
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_members_tenant_isolation ON store_members
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY store_members_tenant_insert ON store_members
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Team Invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_invitations_tenant_isolation ON team_invitations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY team_invitations_tenant_insert ON team_invitations
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Store Domains
ALTER TABLE store_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_domains_tenant_isolation ON store_domains
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY store_domains_tenant_insert ON store_domains
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Navigation Menus
ALTER TABLE navigation_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY navigation_menus_tenant_isolation ON navigation_menus
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY navigation_menus_tenant_insert ON navigation_menus
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY products_tenant_insert ON products
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Product Images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_images_tenant_isolation ON product_images
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY product_images_tenant_insert ON product_images
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Product Variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_tenant_isolation ON product_variants
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY product_variants_tenant_insert ON product_variants
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_tenant_isolation ON categories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY categories_tenant_insert ON categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Product Reviews
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_reviews_tenant_isolation ON product_reviews
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY product_reviews_tenant_insert ON product_reviews
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY orders_tenant_insert ON orders
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_tenant_isolation ON order_items
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY order_items_tenant_insert ON order_items
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Order Timeline Events
ALTER TABLE order_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_timeline_events_tenant_isolation ON order_timeline_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY order_timeline_events_tenant_insert ON order_timeline_events
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Abandoned Carts
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY abandoned_carts_tenant_isolation ON abandoned_carts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY abandoned_carts_tenant_insert ON abandoned_carts
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_isolation ON customers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY customers_tenant_insert ON customers
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Customer Blocks
ALTER TABLE customer_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_blocks_tenant_isolation ON customer_blocks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY customer_blocks_tenant_insert ON customer_blocks
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_tenant_isolation ON transactions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY transactions_tenant_insert ON transactions
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY invoices_tenant_insert ON invoices
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Ad Pixels
ALTER TABLE ad_pixels ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_pixels_tenant_isolation ON ad_pixels
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY ad_pixels_tenant_insert ON ad_pixels
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Analytics Integrations
ALTER TABLE analytics_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_integrations_tenant_isolation ON analytics_integrations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY analytics_integrations_tenant_insert ON analytics_integrations
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhooks_tenant_isolation ON webhooks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY webhooks_tenant_insert ON webhooks
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Webhook Deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY webhook_deliveries_tenant_insert ON webhook_deliveries
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Installed Apps
ALTER TABLE installed_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY installed_apps_tenant_isolation ON installed_apps
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY installed_apps_tenant_insert ON installed_apps
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Carrier Connections
ALTER TABLE carrier_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY carrier_connections_tenant_isolation ON carrier_connections
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY carrier_connections_tenant_insert ON carrier_connections
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Analytics Events
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_events_tenant_isolation ON analytics_events
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY analytics_events_tenant_insert ON analytics_events
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Activity Logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_logs_tenant_isolation ON activity_logs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY activity_logs_tenant_insert ON activity_logs
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current tenant
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.tenant_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- AUDIT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = COALESCE(NEW.created_at, now());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GRANT PERMISSIONS TO APP USER
-- =============================================================================

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
