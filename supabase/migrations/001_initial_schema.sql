-- PMP Seminar Flow MVP Schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Advisors (clients who log into portal)
CREATE TABLE public.advisors (
  advisor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  advisor_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  territory TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advisor defaults (admin-managed)
CREATE TABLE public.advisor_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID UNIQUE REFERENCES advisors(advisor_id) ON DELETE CASCADE,
  mail_piece TEXT DEFAULT 'Standard Postcard',
  digital_budget TEXT DEFAULT '$1000',
  disclaimer TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE public.orders (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,
  advisor_id UUID REFERENCES advisors(advisor_id) NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  first_event_date DATE NOT NULL,
  first_event_time TIME,
  first_event_end_time TIME,
  second_event_date DATE,
  second_event_time TIME,
  second_event_end_time TIME,
  
  -- Location
  venue_name TEXT,
  address TEXT,
  
  -- Marketing
  mail_piece TEXT,
  mailing_quantity INTEGER DEFAULT 8000,
  digital_budget TEXT,
  
  -- Registration
  registration_phone TEXT,
  registration_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending_orders' CHECK (status IN (
    'pending_orders', 'in_design', 'in_revision', 'approval_requested',
    'approved', 'order_sent', 'digital', 'campaign_running', 'complete'
  )),
  
  -- Proofs
  proof_url TEXT,
  proof_feedback TEXT,
  
  -- Notes
  admin_notes TEXT,
  client_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order comments
CREATE TABLE public.order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_type TEXT CHECK (user_type IN ('admin', 'client')),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order attachments
CREATE TABLE public.order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to get client-visible status
CREATE OR REPLACE FUNCTION get_client_status(admin_status TEXT) RETURNS TEXT AS $$
BEGIN
  CASE admin_status
    WHEN 'pending_orders' THEN RETURN 'Processing';
    WHEN 'in_design' THEN RETURN 'Processing';
    WHEN 'in_revision' THEN RETURN 'In Revision';
    WHEN 'approval_requested' THEN RETURN 'Needs Approval';
    WHEN 'approved' THEN RETURN 'Approved';
    WHEN 'order_sent' THEN RETURN 'In Production';
    WHEN 'digital' THEN RETURN 'Setting Up';
    WHEN 'campaign_running' THEN RETURN 'Campaign Live';
    WHEN 'complete' THEN RETURN 'Completed';
    ELSE RETURN admin_status;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- View for client portal
CREATE VIEW client_orders AS
SELECT 
  o.*,
  get_client_status(o.status) as client_status,
  a.advisor_name,
  a.company_name
FROM orders o
JOIN advisors a ON o.advisor_id = a.advisor_id;

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER advisors_updated_at BEFORE UPDATE ON advisors
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_attachments ENABLE ROW LEVEL SECURITY;

-- Allow all for now (adjust for production)
CREATE POLICY "Allow all" ON advisors FOR ALL USING (true);
CREATE POLICY "Allow all" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_comments FOR ALL USING (true);
CREATE POLICY "Allow all" ON order_attachments FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_orders_advisor ON orders(advisor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(first_event_date);

-- Sample data
INSERT INTO advisors (email, advisor_name, company_name, phone, territory) VALUES
  ('demo@example.com', 'John Demo', 'Demo Financial Group', '555-0100', 'Dallas'),
  ('fta@example.com', 'Mike Johnson', 'FTA Dallas', '555-0101', 'Dallas'),
  ('sam@example.com', 'Will Warner', 'SAM RIA', '555-0102', 'Connecticut')
ON CONFLICT (email) DO NOTHING;
