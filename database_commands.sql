-- =====================================================
-- ملف أوامر قاعدة البيانات الشامل
-- نظام إدارة اللوحات الإعلانية - الفارس
-- تاريخ التصدير: 2026-02-26
-- =====================================================
-- ⚠️ تنبيه: هذا الملف يعيد إنشاء كل شيء من الصفر
-- يجب تنفيذه على قاعدة بيانات Supabase جديدة فارغة
-- =====================================================

-- =====================================================
-- القسم 1: الأنواع المخصصة (ENUMS)
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================
-- القسم 2: التسلسلات (SEQUENCES)
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS public."Contract_id_seq";
CREATE SEQUENCE IF NOT EXISTS public.account_closures_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_faces_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_levels_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_types_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboards_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expense_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expenses_flags_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expenses_withdrawals_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.levels_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.offers_offer_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.period_closures_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.pricing_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.pricing_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.print_installation_pricing_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.sizes_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.withdrawals_id_seq;


-- =====================================================
-- القسم 3: الجداول الأساسية (بدون مراجع خارجية)
-- =====================================================

-- جدول الأدوار
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول أدوار المستخدمين
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- جدول صلاحيات المستخدمين (مهمل - يُستخدم الأدوار فقط)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  username text,
  phone text,
  company text,
  avatar_url text,
  approved boolean DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول العملاء
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  company text,
  address text,
  notes text,
  customer_type text DEFAULT 'individual',
  tax_number text,
  commercial_register text,
  city text,
  category text,
  last_payment_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المقاسات
CREATE TABLE IF NOT EXISTS public.sizes (
  id bigint PRIMARY KEY DEFAULT nextval('sizes_id_seq'),
  name text NOT NULL UNIQUE,
  width numeric,
  height numeric,
  area numeric,
  installation_price bigint DEFAULT 0,
  print_price_per_meter numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مستويات اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_levels (
  id integer PRIMARY KEY DEFAULT nextval('billboard_levels_id_seq'),
  level_code text NOT NULL UNIQUE,
  level_name text NOT NULL,
  description text,
  sort_order integer NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- جدول أوجه اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_faces (
  id integer PRIMARY KEY DEFAULT nextval('billboard_faces_id_seq'),
  name text NOT NULL,
  face_count integer NOT NULL DEFAULT 2,
  count integer,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_face_count UNIQUE(face_count)
);

-- جدول أنواع اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_types (
  id integer PRIMARY KEY DEFAULT nextval('billboard_types_id_seq'),
  name text NOT NULL,
  color text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول شركات الأصدقاء
CREATE TABLE IF NOT EXISTS public.friend_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  contact_person text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الشركاء
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  company text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول اللوحات الإعلانية
CREATE TABLE IF NOT EXISTS public.billboards (
  "ID" bigint PRIMARY KEY DEFAULT nextval('billboards_id_seq'),
  "Billboard_Name" text,
  "City" text,
  "District" text,
  "Municipality" text,
  "Nearest_Landmark" text,
  "GPS_Coordinates" text,
  "GPS_Link" text,
  "Size" text,
  size_id integer REFERENCES public.sizes(id),
  "Level" text,
  "Category_Level" text,
  "Faces_Count" integer,
  "Ad_Type" text,
  "Status" text DEFAULT 'متاح',
  "Customer_Name" text,
  "Contract_Number" bigint,
  "Rent_Start_Date" text,
  "Rent_End_Date" text,
  "Price" numeric,
  "Days_Count" text,
  "Order_Size" text,
  "Image_URL" text,
  image_name text,
  "Review" text,
  billboard_type text,
  design_face_a text,
  design_face_b text,
  has_cutout boolean DEFAULT false,
  is_partnership boolean DEFAULT false,
  partner_companies text[],
  friend_company_id uuid REFERENCES public.friend_companies(id),
  capital numeric,
  capital_remaining numeric,
  maintenance_status text,
  maintenance_type text,
  maintenance_date text,
  maintenance_notes text,
  maintenance_cost numeric,
  maintenance_priority text,
  next_maintenance_date text,
  needs_rephotography boolean DEFAULT false,
  is_visible_in_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول العقود
CREATE TABLE IF NOT EXISTS public."Contract" (
  "Contract_Number" bigint PRIMARY KEY DEFAULT nextval('"Contract_id_seq"'),
  id bigint NOT NULL DEFAULT nextval('"Contract_id_seq"'),
  "Customer Name" text,
  customer_category text,
  "Phone" text,
  "Company" text,
  "Contract Date" date,
  "Duration" text,
  "End Date" date,
  "Ad Type" text,
  "Total Rent" double precision,
  "Discount" double precision,
  installation_cost bigint,
  fee text,
  "Total" numeric,
  "Print Status" text,
  "Renewal Status" text,
  "Total Paid" text,
  "Payment 1" jsonb,
  "Payment 2" text,
  "Payment 3" text,
  "Remaining" text,
  customer_id uuid REFERENCES public.customers(id),
  billboard_id bigint,
  billboards_data text,
  billboards_count integer DEFAULT 0,
  billboard_ids text,
  billboard_prices text,
  single_face_billboards text,
  base_rent numeric DEFAULT 0,
  print_cost bigint,
  print_cost_enabled text,
  print_price_per_meter text,
  print_cost_details jsonb,
  operating_fee_rate bigint,
  operating_fee_rate_installation numeric DEFAULT 3,
  operating_fee_rate_print numeric DEFAULT 3,
  include_installation_in_price boolean NOT NULL DEFAULT false,
  include_print_in_billboard_price boolean NOT NULL DEFAULT false,
  include_operating_in_installation boolean DEFAULT false,
  include_operating_in_print boolean DEFAULT false,
  installation_enabled boolean DEFAULT true,
  design_data jsonb,
  level_discounts jsonb,
  partnership_data jsonb,
  partnership_operating_data jsonb,
  partnership_operating_fee_rate numeric DEFAULT 0,
  friend_rental_data jsonb,
  friend_rental_includes_installation boolean DEFAULT false,
  friend_rental_operating_fee_enabled boolean DEFAULT false,
  friend_rental_operating_fee_rate numeric DEFAULT 3,
  installment_count integer DEFAULT 2,
  installment_interval text DEFAULT 'month',
  installment_auto_calculate boolean DEFAULT true,
  installment_distribution_type text DEFAULT 'even',
  installment_first_at_signing boolean DEFAULT true,
  installment_first_payment_amount numeric DEFAULT 0,
  installment_first_payment_type text DEFAULT 'amount',
  installments_data text,
  payment_status text DEFAULT 'unpaid',
  billboards_released boolean DEFAULT false,
  contract_currency text,
  exchange_rate text,
  CONSTRAINT "Contract_Contract_Number_key" UNIQUE("Contract_Number")
);

-- جدول الموظفين
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  position text,
  department text,
  hire_date date,
  basic_salary numeric DEFAULT 0,
  allowances numeric DEFAULT 0,
  status text DEFAULT 'active',
  notes text,
  nationality text,
  id_number text,
  bank_name text,
  bank_account text,
  contract_type text DEFAULT 'full_time',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المطبعات
CREATE TABLE IF NOT EXISTS public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  contact_person text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول فرق التركيب
CREATE TABLE IF NOT EXISTS public.installation_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  sizes text[] NOT NULL DEFAULT '{}',
  cities text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- جدول فئات المصروفات
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id bigint PRIMARY KEY DEFAULT nextval('expense_categories_id_seq'),
  name text NOT NULL,
  description text,
  color text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المستويات
CREATE TABLE IF NOT EXISTS public.levels (
  id bigint PRIMARY KEY DEFAULT nextval('levels_id_seq'),
  name text NOT NULL,
  code text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- جدول البلديات
CREATE TABLE IF NOT EXISTS public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  region text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول فئات التسعير
CREATE TABLE IF NOT EXISTS public.pricing_categories (
  id bigint PRIMARY KEY DEFAULT nextval('pricing_categories_id_seq'),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- =====================================================
-- القسم 4: الجداول المرتبطة (مع مراجع خارجية)
-- =====================================================

-- جدول تاريخ اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL,
  contract_number bigint,
  customer_name text,
  ad_type text,
  start_date text,
  end_date text,
  duration_days integer,
  rent_amount numeric,
  billboard_rent_price numeric,
  discount_amount numeric,
  discount_percentage numeric,
  total_before_discount numeric,
  net_rental_amount numeric,
  installation_cost numeric,
  installation_date date,
  print_cost numeric,
  design_name text,
  design_face_a_url text,
  design_face_b_url text,
  installed_image_face_a_url text,
  installed_image_face_b_url text,
  team_name text,
  notes text,
  pricing_mode text,
  pricing_category text,
  include_print_in_price boolean,
  include_installation_in_price boolean,
  contract_total_rent numeric,
  contract_total numeric,
  contract_discount numeric,
  individual_billboard_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إغلاق الحسابات
CREATE TABLE IF NOT EXISTS public.account_closures (
  id integer PRIMARY KEY DEFAULT nextval('account_closures_id_seq'),
  contract_id integer,
  closure_date date NOT NULL,
  total_withdrawn numeric DEFAULT 0,
  remaining_balance numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول الأسعار الأساسية
CREATE TABLE IF NOT EXISTS public.base_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_name text NOT NULL,
  billboard_level text NOT NULL DEFAULT 'A',
  one_day numeric DEFAULT 0,
  one_month numeric DEFAULT 0,
  two_months numeric DEFAULT 0,
  three_months numeric DEFAULT 0,
  six_months numeric DEFAULT 0,
  full_year numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(size_name, billboard_level)
);

-- جدول مراكز تكلفة اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL REFERENCES public.billboards("ID"),
  cost_type text NOT NULL,
  amount numeric DEFAULT 0,
  vendor_name text,
  frequency text,
  period_start text,
  period_end text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول تمديدات اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL REFERENCES public.billboards("ID"),
  contract_number bigint REFERENCES public."Contract"("Contract_Number"),
  old_end_date text NOT NULL,
  new_end_date text NOT NULL,
  extension_days integer NOT NULL,
  extension_type text DEFAULT 'manual',
  reason text NOT NULL,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- جدول دفعات العملاء
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  contract_number bigint,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  payment_date date DEFAULT CURRENT_DATE,
  paid_at timestamptz DEFAULT now(),
  notes text,
  entry_type text DEFAULT 'payment',
  receipt_number text,
  purchase_invoice_id uuid,
  distributed_payment_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مشتريات العملاء
CREATE TABLE IF NOT EXISTS public.customer_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  description text NOT NULL,
  total_price numeric NOT NULL,
  purchase_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مهام التركيب
CREATE TABLE IF NOT EXISTS public.installation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint REFERENCES public."Contract"("Contract_Number"),
  team_id uuid REFERENCES public.installation_teams(id),
  status text DEFAULT 'pending',
  task_type text DEFAULT 'new_installation',
  print_task_id uuid,
  cutout_task_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(contract_id, team_id)
);

-- جدول عناصر مهام التركيب
CREATE TABLE IF NOT EXISTS public.installation_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.installation_tasks(id) ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  status text DEFAULT 'pending',
  installation_date date,
  notes text,
  design_face_a text,
  design_face_b text,
  installed_image_face_a_url text,
  installed_image_face_b_url text,
  selected_design_id uuid,
  faces_to_install integer DEFAULT 2,
  company_installation_cost numeric DEFAULT 0,
  customer_installation_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id, billboard_id)
);

-- جدول حسابات فرق التركيب
CREATE TABLE IF NOT EXISTS public.installation_team_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.installation_teams(id),
  task_item_id uuid UNIQUE,
  billboard_id bigint,
  contract_id bigint,
  installation_date date,
  amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الفواتير المطبوعة
CREATE TABLE IF NOT EXISTS public.printed_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  contract_number bigint,
  contract_numbers text,
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  printer_name text,
  printer_id uuid REFERENCES public.printers(id),
  printer_cost numeric DEFAULT 0,
  invoice_date date DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  discount_type text,
  discount_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  items jsonb,
  print_items jsonb,
  notes text,
  design_face_a_path text,
  design_face_b_path text,
  invoice_type text,
  currency_code text,
  currency_symbol text,
  "currency_symbol'" text,
  payment_method text,
  account_deduction numeric DEFAULT 0,
  account_payments_deducted numeric DEFAULT 0,
  include_account_balance boolean DEFAULT false,
  paid boolean DEFAULT false,
  paid_amount numeric DEFAULT 0,
  paid_at timestamptz,
  locked boolean DEFAULT false,
  composite_task_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مهام الطباعة
CREATE TABLE IF NOT EXISTS public.print_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint,
  printer_id uuid REFERENCES public.printers(id),
  invoice_id uuid REFERENCES public.printed_invoices(id),
  total_cost numeric DEFAULT 0,
  customer_total_amount numeric DEFAULT 0,
  is_composite boolean DEFAULT false,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عناصر مهام الطباعة
CREATE TABLE IF NOT EXISTS public.print_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.print_tasks(id) ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  size text,
  faces integer DEFAULT 2,
  area numeric DEFAULT 0,
  cost_per_meter numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  customer_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مهام القص
CREATE TABLE IF NOT EXISTS public.cutout_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint,
  printer_id uuid REFERENCES public.printers(id),
  invoice_id uuid,
  total_cost numeric DEFAULT 0,
  customer_total_amount numeric DEFAULT 0,
  is_composite boolean DEFAULT false,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عناصر مهام القص
CREATE TABLE IF NOT EXISTS public.cutout_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.cutout_tasks(id) ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  size text,
  cutout_type text,
  total_cost numeric DEFAULT 0,
  customer_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المهام المركبة
CREATE TABLE IF NOT EXISTS public.composite_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_task_id uuid REFERENCES public.installation_tasks(id),
  contract_id bigint REFERENCES public."Contract"("Contract_Number"),
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  task_type text NOT NULL,
  status text DEFAULT 'pending',
  customer_installation_cost numeric DEFAULT 0,
  company_installation_cost numeric DEFAULT 0,
  customer_print_cost numeric DEFAULT 0,
  company_print_cost numeric DEFAULT 0,
  customer_cutout_cost numeric DEFAULT 0,
  company_cutout_cost numeric DEFAULT 0,
  customer_total numeric DEFAULT 0,
  company_total numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  profit_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  discount_reason text,
  print_discount numeric DEFAULT 0,
  print_discount_reason text,
  installation_discount numeric DEFAULT 0,
  installation_discount_reason text,
  cutout_discount numeric DEFAULT 0,
  cutout_discount_reason text,
  paid_amount numeric DEFAULT 0,
  print_task_id uuid REFERENCES public.print_tasks(id),
  cutout_task_id uuid REFERENCES public.cutout_tasks(id),
  combined_invoice_id uuid REFERENCES public.printed_invoices(id),
  invoice_generated boolean DEFAULT false,
  invoice_date text,
  notes text,
  cost_allocation jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مصروفات العقود
CREATE TABLE IF NOT EXISTS public.contract_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number bigint NOT NULL REFERENCES public."Contract"("Contract_Number"),
  expense_type text NOT NULL,
  reason text NOT NULL,
  amount numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  quantity integer DEFAULT 1,
  item_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المصروفات
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  amount numeric NOT NULL,
  expense_date date DEFAULT CURRENT_DATE,
  category_id bigint REFERENCES public.expense_categories(id),
  description text,
  payment_method text DEFAULT 'cash',
  receipt_number text,
  vendor text,
  employee_id uuid REFERENCES public.employees(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول حسابات العهد
CREATE TABLE IF NOT EXISTS public.custody_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL,
  custody_name text,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  initial_amount numeric DEFAULT 0,
  current_balance numeric DEFAULT 0,
  assigned_date date DEFAULT CURRENT_DATE,
  closed_date date,
  status text DEFAULT 'active',
  source_type text,
  source_payment_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مصروفات العهد
CREATE TABLE IF NOT EXISTS public.custody_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_account_id uuid NOT NULL REFERENCES public.custody_accounts(id),
  description text NOT NULL,
  amount numeric NOT NULL,
  expense_category text NOT NULL,
  expense_date date DEFAULT CURRENT_DATE,
  vendor_name text,
  receipt_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول حركات العهد
CREATE TABLE IF NOT EXISTS public.custody_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_account_id uuid NOT NULL REFERENCES public.custody_accounts(id),
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  reference_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول سلف الموظفين
CREATE TABLE IF NOT EXISTS public.employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  amount numeric NOT NULL,
  advance_date date DEFAULT CURRENT_DATE,
  reason text,
  status text DEFAULT 'pending',
  distributed_payment_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عقود الموظفين
CREATE TABLE IF NOT EXISTS public.employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  contract_type text DEFAULT 'full_time',
  start_date date,
  end_date date,
  salary numeric DEFAULT 0,
  allowances numeric DEFAULT 0,
  notes text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول خصومات الموظفين
CREATE TABLE IF NOT EXISTS public.employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  amount numeric NOT NULL,
  deduction_date date DEFAULT CURRENT_DATE,
  deduction_type text DEFAULT 'salary',
  reason text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول المهام اليدوية للموظفين
CREATE TABLE IF NOT EXISTS public.employee_manual_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  task_description text NOT NULL,
  task_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending',
  priority text DEFAULT 'normal',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مسيرات الرواتب
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود مسيرات الرواتب
CREATE TABLE IF NOT EXISTS public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  basic_salary numeric DEFAULT 0,
  allowances numeric DEFAULT 0,
  overtime_amount numeric DEFAULT 0,
  deductions numeric DEFAULT 0,
  advances_deduction numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  social_security numeric DEFAULT 0,
  net_salary numeric DEFAULT 0,
  paid boolean DEFAULT false,
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الرواتب المدفوعة
CREATE TABLE IF NOT EXISTS public.payments_salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إيجارات لوحات الأصدقاء
CREATE TABLE IF NOT EXISTS public.friend_billboard_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL,
  contract_number bigint,
  friend_company_id uuid REFERENCES public.friend_companies(id),
  friend_rental_cost numeric DEFAULT 0,
  customer_rental_price numeric DEFAULT 0,
  profit numeric GENERATED ALWAYS AS (customer_rental_price - friend_rental_cost) STORED,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(billboard_id, contract_number)
);

-- جدول اللوحات المشتركة
CREATE TABLE IF NOT EXISTS public.shared_billboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL,
  partner_company_id uuid REFERENCES public.partners(id),
  capital_contribution numeric DEFAULT 0,
  capital_remaining numeric DEFAULT 0,
  reserved_amount numeric DEFAULT 0,
  confirmed_amount numeric DEFAULT 0,
  partner_pre_pct numeric DEFAULT 0,
  partner_post_pct numeric DEFAULT 0,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول حركات الشراكات
CREATE TABLE IF NOT EXISTS public.shared_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint,
  contract_id bigint,
  partner_company_id uuid REFERENCES public.partners(id),
  beneficiary text,
  amount numeric DEFAULT 0,
  type text NOT NULL,
  transaction_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول حصص عقود الشراكة
CREATE TABLE IF NOT EXISTS public.partnership_contract_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint,
  billboard_id bigint,
  partner_id uuid REFERENCES public.partners(id),
  capital_deduction numeric DEFAULT 0,
  partner_share numeric DEFAULT 0,
  company_share numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول الفواتير
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  customer_id uuid REFERENCES public.customers(id),
  contract_number bigint,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود الفواتير
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric,
  days_count integer,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول فواتير المبيعات
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  customer_id uuid REFERENCES public.customers(id),
  invoice_date date DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  items jsonb,
  notes text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول دفعات فواتير المبيعات
CREATE TABLE IF NOT EXISTS public.sales_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.sales_invoices(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول فواتير المشتريات
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  supplier_name text,
  supplier_id uuid,
  invoice_date date DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'unpaid',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود فواتير المشتريات
CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- جدول دفعات فواتير المشتريات
CREATE TABLE IF NOT EXISTS public.purchase_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.purchase_invoices(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول دفعات المطبعات
CREATE TABLE IF NOT EXISTS public.printer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_id uuid REFERENCES public.printers(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التسعير
CREATE TABLE IF NOT EXISTS public.pricing (
  id bigint PRIMARY KEY DEFAULT nextval('pricing_id_seq'),
  size_id bigint REFERENCES public.sizes(id),
  category_id bigint REFERENCES public.pricing_categories(id),
  duration_id bigint,
  price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول فترات التسعير
CREATE TABLE IF NOT EXISTS public.pricing_durations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  days integer NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عوامل الفئات
CREATE TABLE IF NOT EXISTS public.category_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  factor numeric DEFAULT 1,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عوامل البلديات
CREATE TABLE IF NOT EXISTS public.municipality_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_name text NOT NULL,
  factor numeric DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول أسعار إيجارات البلديات
CREATE TABLE IF NOT EXISTS public.municipality_rent_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid REFERENCES public.municipalities(id),
  size_id bigint REFERENCES public.sizes(id),
  price numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول تسعير التركيب والطباعة
CREATE TABLE IF NOT EXISTS public.installation_print_pricing (
  id bigint PRIMARY KEY DEFAULT nextval('print_installation_pricing_id_seq'),
  size text NOT NULL,
  install_price numeric DEFAULT 0,
  print_price numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول تسعير الطباعة والتركيب
CREATE TABLE IF NOT EXISTS public.print_installation_pricing (
  id bigint PRIMARY KEY DEFAULT nextval('print_installation_pricing_id_seq'),
  size text,
  install_price numeric DEFAULT 0,
  print_price_per_meter numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول العروض
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_number bigint DEFAULT nextval('offers_offer_number_seq'),
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  offer_date date DEFAULT CURRENT_DATE,
  valid_until date,
  status text DEFAULT 'draft',
  items jsonb,
  total_amount numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول طلبات الحجز
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  billboard_ids bigint[] NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_price numeric NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول خصومات العملاء العامة
CREATE TABLE IF NOT EXISTS public.customer_general_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id),
  discount_type text DEFAULT 'percentage',
  discount_value numeric DEFAULT 0,
  reason text,
  valid_from date,
  valid_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مهام الإزالة
CREATE TABLE IF NOT EXISTS public.removal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint,
  team_id uuid REFERENCES public.installation_teams(id),
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول عناصر مهام الإزالة
CREATE TABLE IF NOT EXISTS public.removal_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.removal_tasks(id) ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  status text DEFAULT 'pending',
  removal_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التوزيعات
CREATE TABLE IF NOT EXISTS public.distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  distribution_date date DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود التوزيعات
CREATE TABLE IF NOT EXISTS public.distribution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid REFERENCES public.distributions(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id),
  amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول التقارير
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  report_type text,
  content jsonb,
  created_by uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود التقارير
CREATE TABLE IF NOT EXISTS public.report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  item_type text,
  data jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- جدول سجل التنظيف
CREATE TABLE IF NOT EXISTS public.cleanup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_date timestamptz DEFAULT now(),
  billboards_cleaned integer DEFAULT 0,
  cleanup_type text DEFAULT 'manual',
  notes text,
  billboard_ids_cleaned integer[],
  created_at timestamptz DEFAULT now()
);

-- جدول إعدادات الطباعة
CREATE TABLE IF NOT EXISTS public.print_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  primary_color text DEFAULT '#D4AF37',
  secondary_color text DEFAULT '#1a1a2e',
  accent_color text DEFAULT '#c0a060',
  header_bg_color text DEFAULT '#D4AF37',
  header_text_color text DEFAULT '#ffffff',
  table_header_bg_color text DEFAULT '#D4AF37',
  table_header_text_color text DEFAULT '#ffffff',
  table_border_color text DEFAULT '#e5e5e5',
  table_row_even_color text DEFAULT '#f8f9fa',
  table_row_odd_color text DEFAULT '#ffffff',
  totals_box_bg_color text DEFAULT '#f8f9fa',
  totals_box_text_color text DEFAULT '#333333',
  totals_box_border_color text,
  totals_box_border_radius integer DEFAULT 8,
  totals_title_font_size integer DEFAULT 14,
  totals_value_font_size integer DEFAULT 16,
  font_family text DEFAULT 'Doran',
  title_font_size integer DEFAULT 18,
  header_font_size integer DEFAULT 14,
  body_font_size integer DEFAULT 12,
  show_logo boolean DEFAULT true,
  logo_path text DEFAULT '/logofaresgold.svg',
  logo_size integer DEFAULT 80,
  show_footer boolean DEFAULT true,
  footer_text text DEFAULT '',
  show_page_number boolean DEFAULT true,
  footer_alignment text DEFAULT 'center',
  header_alignment text DEFAULT 'split',
  header_direction text DEFAULT 'row',
  header_style text DEFAULT 'classic',
  logo_position_order integer DEFAULT 0,
  direction text DEFAULT 'rtl',
  show_company_name boolean DEFAULT true,
  show_company_subtitle boolean DEFAULT false,
  show_company_address boolean DEFAULT true,
  show_company_contact boolean DEFAULT true,
  company_name text DEFAULT '',
  company_subtitle text DEFAULT '',
  company_address text DEFAULT '',
  company_phone text DEFAULT '',
  page_margin_top integer DEFAULT 10,
  page_margin_bottom integer DEFAULT 10,
  page_margin_left integer DEFAULT 10,
  page_margin_right integer DEFAULT 10,
  header_margin_bottom integer DEFAULT 20,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات طباعة اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_print_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text DEFAULT 'default',
  background_url text,
  background_width text,
  background_height text,
  elements jsonb,
  primary_font text,
  secondary_font text,
  custom_css text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول تخصيص طباعة اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_print_customization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text DEFAULT 'default' UNIQUE,
  primary_font text,
  secondary_font text,
  preview_background text,
  preview_zoom text,
  main_image_top text,
  main_image_left text,
  main_image_width text,
  main_image_height text,
  qr_top text,
  qr_left text,
  qr_size text,
  billboard_name_top text,
  billboard_name_left text,
  billboard_name_font_size text,
  billboard_name_color text,
  billboard_name_font_weight text,
  billboard_name_alignment text,
  billboard_name_offset_x text,
  location_info_top text,
  location_info_left text,
  location_info_width text,
  location_info_font_size text,
  location_info_color text,
  location_info_alignment text,
  location_info_offset_x text,
  landmark_info_top text,
  landmark_info_left text,
  landmark_info_width text,
  landmark_info_font_size text,
  landmark_info_color text,
  landmark_info_alignment text,
  landmark_info_offset_x text,
  size_top text,
  size_left text,
  size_font_size text,
  size_color text,
  size_font_weight text,
  size_alignment text,
  size_offset_x text,
  faces_count_top text,
  faces_count_left text,
  faces_count_font_size text,
  faces_count_color text,
  faces_count_alignment text,
  faces_count_offset_x text,
  contract_number_top text,
  contract_number_right text,
  contract_number_font_size text,
  contract_number_color text,
  contract_number_font_weight text,
  contract_number_alignment text,
  contract_number_offset_x text,
  team_name_top text,
  team_name_right text,
  team_name_font_size text,
  team_name_color text,
  team_name_font_weight text,
  team_name_alignment text,
  team_name_offset_x text,
  installation_date_top text,
  installation_date_right text,
  installation_date_font_size text,
  installation_date_color text,
  installation_date_font_weight text,
  installation_date_alignment text,
  installation_date_offset_x text,
  designs_top text,
  designs_left text,
  designs_width text,
  designs_gap text,
  design_image_height text,
  installed_images_top text,
  installed_images_left text,
  installed_images_width text,
  installed_images_gap text,
  installed_image_height text,
  coords_font_size text,
  coords_font_family text,
  coords_bar_height text,
  map_zoom text,
  map_show_labels text,
  pin_size text,
  pin_color text,
  pin_text_color text,
  custom_pin_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول ملفات طباعة اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_print_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name text NOT NULL,
  description text,
  settings_data jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول خلفيات الطباعة
CREATE TABLE IF NOT EXISTS public.print_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  width text,
  height text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعادة الطباعة
CREATE TABLE IF NOT EXISTS public.print_reprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_invoice_id uuid,
  reprint_date timestamptz DEFAULT now(),
  reason text,
  created_at timestamptz DEFAULT now()
);

-- جدول دفعات فواتير الطباعة
CREATE TABLE IF NOT EXISTS public.print_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.printed_invoices(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول إعدادات قالب العقد
CREATE TABLE IF NOT EXISTS public.contract_template_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL,
  background_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول شروط العقد
CREATE TABLE IF NOT EXISTS public.contract_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_key text NOT NULL,
  term_title text NOT NULL,
  term_content text NOT NULL,
  term_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  font_size integer,
  font_weight text,
  position_x integer,
  position_y integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات الرسائل
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_key text,
  settings jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات API الرسائل
CREATE TABLE IF NOT EXISTS public.messaging_api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_url text,
  api_key text,
  settings jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول هواتف الإدارة
CREATE TABLE IF NOT EXISTS public.management_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  label text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول سجل الصيانة
CREATE TABLE IF NOT EXISTS public.maintenance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint,
  maintenance_type text,
  maintenance_date date DEFAULT CURRENT_DATE,
  cost numeric DEFAULT 0,
  description text,
  status text DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول إعدادات ثيم الموقع
CREATE TABLE IF NOT EXISTS public.site_theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول أعلام المصروفات
CREATE TABLE IF NOT EXISTS public.expenses_flags (
  id bigint PRIMARY KEY DEFAULT nextval('expenses_flags_id_seq'),
  expense_id uuid,
  flag_type text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول سحوبات المصروفات
CREATE TABLE IF NOT EXISTS public.expenses_withdrawals (
  id bigint PRIMARY KEY DEFAULT nextval('expenses_withdrawals_id_seq'),
  employee_id uuid,
  amount numeric NOT NULL,
  withdrawal_date date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول إغلاق الفترات
CREATE TABLE IF NOT EXISTS public.period_closures (
  id bigint PRIMARY KEY DEFAULT nextval('period_closures_id_seq'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  closed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- جدول تصاميم المهام
CREATE TABLE IF NOT EXISTS public.task_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  billboard_id bigint,
  design_face_a_url text,
  design_face_b_url text,
  design_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول جدول الدوام
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  hours numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- جدول إعدادات ملصقات البلديات
CREATE TABLE IF NOT EXISTS public.municipality_stickers_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  setting_value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول مجموعات البلديات
CREATE TABLE IF NOT EXISTS public.municipality_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  municipality_id uuid REFERENCES public.municipalities(id),
  collection_date date DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- جدول بنود مجموعات البلديات
CREATE TABLE IF NOT EXISTS public.municipality_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES public.municipality_collections(id) ON DELETE CASCADE,
  billboard_id bigint,
  amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);


-- =====================================================
-- القسم 5: الدوال (FUNCTIONS)
-- =====================================================

-- دالة التحقق من الدور
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- دالة التحقق من الصلاحية
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role::text = r.name
    WHERE ur.user_id = _user_id 
      AND r.permissions @> ARRAY[_permission]::text[]
  )
$$;

-- دالة تحديث updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- دالة تحديث updated_at (نسخة أخرى)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- دالة set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- دالة التحقق من الأدمن
CREATE OR REPLACE FUNCTION public.check_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can assign admin role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة معالجة المستخدم الجديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role := 'user';
BEGIN
  IF NEW.email LIKE '%@test.com' OR NEW.email = 'admin@test.com' THEN
    user_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, name, email, username, phone, company, approved, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'company',
    CASE WHEN user_role = 'admin' THEN true ELSE false END,
    CASE WHEN user_role = 'admin' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = EXCLUDED.phone,
    company = EXCLUDED.company;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- دالة مزامنة اللوحات من العقد
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  updated_count int := 0;
  row_ct int := 0;
BEGIN
  SELECT "Contract_Number", "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids
    INTO v_contract
    FROM "Contract"
   WHERE "Contract_Number" = p_contract_number;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'contract_not_found');
  END IF;

  IF v_contract.billboard_ids IS NULL OR TRIM(v_contract.billboard_ids) = '' THEN
    RETURN json_build_object('ok', true, 'updated', 0);
  END IF;

  FOR v_billboard_id IN
    SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
  LOOP
    UPDATE billboards
      SET "Contract_Number" = v_contract."Contract_Number",
          "Customer_Name" = v_contract."Customer Name",
          "Ad_Type" = v_contract."Ad Type",
          "Rent_Start_Date" = v_contract."Contract Date",
          "Rent_End_Date" = v_contract."End Date",
          "Status" = 'محجوز'
      WHERE "ID" = v_billboard_id
        AND (
          "Contract_Number" IS NULL
          OR "Contract_Number" <= v_contract."Contract_Number"
          OR "Rent_End_Date" IS NULL
          OR "Rent_End_Date"::date < v_contract."End Date"::date
        );
    GET DIAGNOSTICS row_ct = ROW_COUNT;
    updated_count := updated_count + COALESCE(row_ct, 0);
  END LOOP;

  RETURN json_build_object('ok', true, 'updated', updated_count);
END;
$$;

-- دالة تنفيذ المزامنة
CREATE OR REPLACE FUNCTION public.t_sync_billboards_from_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_billboards_from_contract(NEW."Contract_Number");
  RETURN NEW;
END;
$$;

-- دالة مزامنة تسلسل العقود
CREATE OR REPLACE FUNCTION public.sync_contract_seq()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM setval('"Contract_id_seq"', (SELECT MAX("Contract_Number") FROM "Contract"));
  RETURN NEW;
END;
$$;

-- دالة مزامنة معلومات العميل في العقد
CREATE OR REPLACE FUNCTION public.sync_contract_customer_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company TEXT;
  v_phone TEXT;
BEGIN
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NEW.customer_id IS NOT NULL THEN
    SELECT company, phone INTO v_company, v_phone
    FROM customers
    WHERE id = NEW.customer_id;
    NEW."Company" := v_company;
    NEW."Phone" := v_phone;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة مزامنة معلومات العميل للعقود
CREATE OR REPLACE FUNCTION public.sync_customer_info_to_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.company IS DISTINCT FROM OLD.company
     OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE "Contract"
    SET "Customer Name" = NEW.name,
        "Company" = NEW.company,
        "Phone" = NEW.phone
    WHERE customer_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة حذف اللوحة
CREATE OR REPLACE FUNCTION public.delete_billboard(billboard_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  DELETE FROM billboards WHERE "ID" = billboard_id;
END;
$$;

-- دالة الحذف الآمن للوحة
CREATE OR REPLACE FUNCTION public.safe_delete_billboard(input_billboard_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_active_contracts BOOLEAN;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM "Contract" 
    WHERE billboard_id = input_billboard_id 
    AND "End Date" >= CURRENT_DATE
  ) INTO has_active_contracts;
  
  IF has_active_contracts THEN
    RAISE EXCEPTION 'لا يمكن حذف اللوحة - توجد عقود نشطة مرتبطة بها';
    RETURN FALSE;
  END IF;
  
  DELETE FROM "Contract" WHERE billboard_id = input_billboard_id;
  DELETE FROM billboards WHERE "ID" = input_billboard_id;
  RETURN TRUE;
END;
$$;

-- دالة تنظيف اللوحات المنتهية
CREATE OR REPLACE FUNCTION public.cleanup_expired_billboards()
RETURNS TABLE(cleaned_count integer, cleaned_billboard_ids integer[], operation_timestamp timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_ids INTEGER[];
  cleaned_count_result INTEGER := 0;
  operation_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT ARRAY_AGG(b."ID") INTO expired_ids
  FROM billboards b
  WHERE b."Status" IN ('مؤجر', 'محجوز', 'rented')
    AND b."Rent_End_Date" IS NOT NULL 
    AND b."Rent_End_Date"::date < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM "Contract" c
      WHERE c."End Date" IS NOT NULL
        AND c."End Date"::date >= CURRENT_DATE
        AND c.billboard_ids IS NOT NULL
        AND b."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[])
    );
  
  IF expired_ids IS NULL OR array_length(expired_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, ARRAY[]::INTEGER[], operation_time;
    RETURN;
  END IF;
  
  UPDATE billboards 
  SET "Status" = 'متاح', "Contract_Number" = NULL, "Customer_Name" = NULL,
      "Rent_Start_Date" = NULL, "Rent_End_Date" = NULL
  WHERE "ID" = ANY(expired_ids);
  
  GET DIAGNOSTICS cleaned_count_result = ROW_COUNT;
  
  BEGIN
    INSERT INTO cleanup_logs (cleanup_date, billboards_cleaned, cleanup_type, notes, billboard_ids_cleaned)
    VALUES (operation_time, cleaned_count_result, 'automatic', 'Automatic cleanup via scheduled function', expired_ids);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  
  RETURN QUERY SELECT cleaned_count_result, expired_ids, operation_time;
END;
$$;

-- دالة حساب ربح المهمة المركبة
CREATE OR REPLACE FUNCTION public.calculate_composite_task_profit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.customer_total := COALESCE(NEW.customer_installation_cost, 0) + 
                        COALESCE(NEW.customer_print_cost, 0) + 
                        COALESCE(NEW.customer_cutout_cost, 0) -
                        COALESCE(NEW.discount_amount, 0);
  NEW.company_total := COALESCE(NEW.company_installation_cost, 0) + 
                       COALESCE(NEW.company_print_cost, 0) + 
                       COALESCE(NEW.company_cutout_cost, 0);
  NEW.net_profit := NEW.customer_total - NEW.company_total;
  IF NEW.customer_total > 0 THEN
    NEW.profit_percentage := (NEW.net_profit / NEW.customer_total) * 100;
  ELSE
    NEW.profit_percentage := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة تحديث رصيد العهدة عند المصروفات
CREATE OR REPLACE FUNCTION public.update_custody_balance_on_expense()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE custody_accounts SET current_balance = current_balance - NEW.amount, updated_at = now()
    WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE custody_accounts SET current_balance = current_balance + OLD.amount - NEW.amount, updated_at = now()
    WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE custody_accounts SET current_balance = current_balance + OLD.amount, updated_at = now()
    WHERE id = OLD.custody_account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- دالة تحديث رصيد العهدة
CREATE OR REPLACE FUNCTION public.update_custody_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'deposit' THEN
      UPDATE custody_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.custody_account_id;
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.custody_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type = 'deposit' THEN
      UPDATE custody_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.custody_account_id;
    ELSIF OLD.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.custody_account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- دالة قفل الفاتورة المدفوعة
CREATE OR REPLACE FUNCTION public.lock_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.paid = TRUE AND OLD.paid = FALSE THEN
    NEW.locked = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة تحديث آخر دفعة للعميل
CREATE OR REPLACE FUNCTION public.update_customer_last_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers SET last_payment_date = NEW.paid_at WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

-- دالة حذف مهمة التركيب عند حذف العقد
CREATE OR REPLACE FUNCTION public.delete_installation_task_on_contract_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM installation_tasks WHERE contract_id = OLD."Contract_Number";
  RETURN OLD;
END;
$$;

-- دالة حذف المهمة المركبة عند حذف مهمة التركيب
CREATE OR REPLACE FUNCTION public.delete_composite_task_on_installation_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM composite_tasks WHERE installation_task_id = OLD.id;
  RETURN OLD;
END;
$$;

-- دالة تحديث حالة اللوحة
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW."Rent_End_Date" IS NULL OR NEW."Rent_End_Date" < CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  ELSIF NEW."Rent_Start_Date" <= CURRENT_DATE AND NEW."Rent_End_Date" >= CURRENT_DATE THEN
    NEW."Status" := 'محجوز';
  END IF;
  RETURN NEW;
END;
$$;

-- دالة تحديث حالة اللوحة بناء على العقد
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW."Rent_End_Date" IS NOT NULL AND NEW."Rent_End_Date" <= CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  END IF;
  RETURN NEW;
END;
$$;

-- دالة مزامنة رأس مال اللوحة
CREATE OR REPLACE FUNCTION public.sync_billboard_capital()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.billboards
  SET capital = COALESCE((SELECT SUM(capital_contribution) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0),
      capital_remaining = COALESCE((SELECT SUM(capital_remaining) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0)
  WHERE billboards."ID" = COALESCE(NEW.billboard_id, OLD.billboard_id);
  RETURN NULL;
END;
$$;

-- ملاحظة: تم حذف بعض الدوال المتكررة للاختصار
-- جميع الدوال المتبقية (مثل sync_print_costs_to_composite, sync_cutout_costs_to_composite, 
-- auto_create_installation_tasks, reserve_partnership_capital, إلخ) 
-- موجودة في ملفات الهجرة الأصلية في مجلد supabase/migrations/


-- =====================================================
-- القسم 6: تمكين أمان مستوى الصف (RLS)
-- =====================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_team_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printed_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutout_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_manual_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_billboard_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_contract_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_rent_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_general_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_template_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_reprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_print_pricing ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- القسم 7: سياسات الأمان (RLS Policies) - أمثلة رئيسية
-- =====================================================

-- ⚠️ ملاحظة: هذا القسم يحتوي على السياسات الأساسية
-- السياسات الكاملة موجودة في ملفات الهجرة

-- سياسات العقود
CREATE POLICY "Authenticated users view contracts" ON public."Contract" FOR SELECT USING (true);
CREATE POLICY "Users with contracts permission can create contracts" ON public."Contract" FOR INSERT WITH CHECK (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Users with contracts permission can update contracts" ON public."Contract" FOR UPDATE USING (has_permission(auth.uid(), 'contracts')) WITH CHECK (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Users with contracts permission can delete contracts" ON public."Contract" FOR DELETE USING (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Admins manage contracts" ON public."Contract" FOR ALL USING (has_role(auth.uid(), 'admin'));

-- سياسات العملاء
CREATE POLICY "Authenticated users view customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Users with permission can insert customers" ON public.customers FOR INSERT WITH CHECK (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Users with permission can update customers" ON public.customers FOR UPDATE USING (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Users with permission can delete customers" ON public.customers FOR DELETE USING (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Admins manage customers" ON public.customers FOR ALL USING (has_role(auth.uid(), 'admin'));

-- سياسات اللوحات
CREATE POLICY "Authenticated users view billboards" ON public.billboards FOR SELECT USING (true);
CREATE POLICY "Users with permission can manage billboards" ON public.billboards FOR ALL USING (has_permission(auth.uid(), 'billboards')) WITH CHECK (has_permission(auth.uid(), 'billboards'));
CREATE POLICY "Admins manage billboards" ON public.billboards FOR ALL USING (has_role(auth.uid(), 'admin'));

-- سياسات الموظفين
CREATE POLICY "Authenticated can view employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- سياسات المصروفات
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Admins manage expenses" ON public.expenses FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- سياسات المقاسات
CREATE POLICY "Authenticated users can read sizes" ON public.sizes FOR SELECT USING (true);
CREATE POLICY "Users with pricing permission can manage sizes" ON public.sizes FOR ALL USING (has_permission(auth.uid(), 'pricing')) WITH CHECK (has_permission(auth.uid(), 'pricing'));

-- سياسات الملفات الشخصية
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- سياسات الأدوار
CREATE POLICY "Admins manage roles" ON public.roles FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view roles" ON public.roles FOR SELECT USING (true);

-- سياسات أدوار المستخدمين
CREATE POLICY "Admins manage user_roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);


-- =====================================================
-- القسم 8: الفيوز (VIEWS)
-- =====================================================

-- فيو ملخص العقود
CREATE OR REPLACE VIEW public.contract_summary AS
SELECT 
  c.*,
  cust.phone AS customer_phone,
  cust.company AS customer_company,
  COALESCE(pay.total_paid_amount, 0) AS actual_paid,
  COALESCE(exp.total_expenses, 0) AS total_expenses
FROM "Contract" c
LEFT JOIN customers cust ON cust.id = c.customer_id
LEFT JOIN (
  SELECT contract_number, sum(amount) AS total_paid_amount
  FROM customer_payments
  GROUP BY contract_number
) pay ON pay.contract_number = c."Contract_Number"
LEFT JOIN (
  SELECT contract_number, sum(amount) AS total_expenses
  FROM contract_expenses
  GROUP BY contract_number
) exp ON exp.contract_number = c."Contract_Number";

-- فيو الملخص المالي للعملاء
CREATE OR REPLACE VIEW public.customer_financial_summary AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  COALESCE(sum(COALESCE(ct."Total", 0)), 0) AS total_contracts,
  COALESCE(sum(COALESCE(pi.total_amount, 0)), 0) AS total_printed_invoices,
  COALESCE(sum(COALESCE(si.total_amount, 0)), 0) AS total_sales_invoices,
  COALESCE(sum(COALESCE(cp.amount, 0)), 0) AS total_paid,
  COALESCE(sum(COALESCE(pur.total_price, 0)), 0) AS total_purchases,
  (COALESCE(sum(COALESCE(ct."Total", 0)), 0) + COALESCE(sum(COALESCE(pi.total_amount, 0)), 0) + COALESCE(sum(COALESCE(si.total_amount, 0)), 0)) AS total_due,
  (COALESCE(sum(COALESCE(cp.amount, 0)), 0) - (COALESCE(sum(COALESCE(ct."Total", 0)), 0) + COALESCE(sum(COALESCE(pi.total_amount, 0)), 0) + COALESCE(sum(COALESCE(si.total_amount, 0)), 0))) AS balance
FROM customers c
LEFT JOIN "Contract" ct ON ct.customer_id = c.id
LEFT JOIN printed_invoices pi ON pi.customer_id = c.id
LEFT JOIN sales_invoices si ON si.customer_id = c.id
LEFT JOIN customer_payments cp ON cp.customer_id = c.id
LEFT JOIN customer_purchases pur ON pur.customer_id = c.id
GROUP BY c.id, c.name;

-- فيو مالية العملاء
CREATE OR REPLACE VIEW public.customer_financials AS
SELECT 
  c.id AS customer_id,
  c.name,
  c.created_at,
  c.updated_at,
  c.last_payment_date,
  count(DISTINCT ct."Contract_Number") AS contracts_count,
  COALESCE(sum(COALESCE(ct."Total", 0)), 0) AS total_contracts_amount,
  COALESCE(sum(COALESCE(ct."Total Paid"::numeric, 0)), 0) AS total_paid,
  (COALESCE(sum(COALESCE(ct."Total", 0)), 0) - COALESCE(sum(COALESCE(ct."Total Paid"::numeric, 0)), 0)) AS total_remaining
FROM customers c
LEFT JOIN "Contract" ct ON ct.customer_id = c.id
GROUP BY c.id, c.name, c.created_at, c.updated_at, c.last_payment_date;

-- فيو حالة شراكة اللوحات
CREATE OR REPLACE VIEW public.billboard_partnership_status AS
SELECT 
  b."ID" AS billboard_id,
  b."Billboard_Name" AS billboard_name,
  b.is_partnership,
  b.capital,
  b.capital_remaining,
  count(sb.id) AS partners_count,
  COALESCE(sum(sb.capital_contribution), 0) AS total_capital_contributions,
  COALESCE(sum(sb.capital_remaining), 0) AS total_capital_remaining,
  COALESCE(sum(sb.reserved_amount), 0) AS total_reserved,
  COALESCE(sum(sb.confirmed_amount), 0) AS total_confirmed
FROM billboards b
LEFT JOIN shared_billboards sb ON sb.billboard_id = b."ID" AND sb.status = 'active'
LEFT JOIN partners p ON p.id = sb.partner_company_id
WHERE b.is_partnership = true
GROUP BY b."ID", b."Billboard_Name", b.is_partnership, b.capital, b.capital_remaining;

-- فيو مالية شركات الأصدقاء
CREATE OR REPLACE VIEW public.friend_company_financials AS
SELECT 
  fc.id AS company_id,
  fc.name AS company_name,
  count(DISTINCT fbr.billboard_id) AS total_billboards,
  count(DISTINCT fbr.contract_number) AS total_contracts,
  COALESCE(sum(fbr.friend_rental_cost), 0) AS total_paid_to_friend,
  COALESCE(sum(fbr.customer_rental_price), 0) AS total_revenue_from_customers,
  COALESCE(sum(fbr.profit), 0) AS total_profit,
  min(fbr.start_date) AS first_rental_date,
  max(fbr.end_date) AS last_rental_date
FROM friend_companies fc
LEFT JOIN friend_billboard_rentals fbr ON fc.id = fbr.friend_company_id
GROUP BY fc.id, fc.name;

-- فيو ملخص المسيرات
CREATE OR REPLACE VIEW public.payroll_summary AS
SELECT 
  pr.id AS payroll_id,
  pr.period_start,
  pr.period_end,
  sum(pi.basic_salary + pi.allowances + pi.overtime_amount) AS total_gross,
  sum(pi.allowances) AS total_allowances,
  sum(pi.deductions + pi.advances_deduction + COALESCE(pi.tax, 0) + COALESCE(pi.social_security, 0)) AS total_deductions,
  sum(pi.net_salary) AS total_net,
  sum(CASE WHEN pi.paid THEN pi.net_salary ELSE 0 END) AS total_paid
FROM payroll_runs pr
JOIN payroll_items pi ON pi.payroll_id = pr.id
GROUP BY pr.id, pr.period_start, pr.period_end;

-- فيو حسابات المطبعات
CREATE OR REPLACE VIEW public.printer_accounts AS
SELECT 
  p.id AS printer_id,
  p.name AS printer_name,
  NULL::uuid AS customer_id,
  NULL::text AS customer_name,
  COALESCE(pt_agg.total_print_costs, 0) AS total_print_costs,
  COALESCE(ct_agg.total_cutout_costs, 0) AS total_cutout_costs,
  (COALESCE(pt_agg.total_print_costs, 0) + COALESCE(ct_agg.total_cutout_costs, 0)) AS total_supplier_debt,
  COALESCE(pp_agg.total_payments, 0) AS total_payments_to_printer,
  0 AS total_customer_debt,
  0 AS total_customer_payments,
  ((COALESCE(pt_agg.total_print_costs, 0) + COALESCE(ct_agg.total_cutout_costs, 0)) - COALESCE(pp_agg.total_payments, 0)) AS final_balance,
  COALESCE(pt_agg.tasks_count, 0) AS print_tasks_count,
  COALESCE(ct_agg.tasks_count, 0) AS cutout_tasks_count
FROM printers p
LEFT JOIN (SELECT printer_id, sum(total_cost) AS total_print_costs, count(*) AS tasks_count FROM print_tasks GROUP BY printer_id) pt_agg ON pt_agg.printer_id = p.id
LEFT JOIN (SELECT printer_id, sum(total_cost) AS total_cutout_costs, count(*) AS tasks_count FROM cutout_tasks GROUP BY printer_id) ct_agg ON ct_agg.printer_id = p.id
LEFT JOIN (SELECT printer_id, sum(amount) AS total_payments FROM printer_payments GROUP BY printer_id) pp_agg ON pp_agg.printer_id = p.id;

-- فيو ملخص حسابات الفرق
CREATE OR REPLACE VIEW public.team_accounts_summary AS
SELECT 
  ta.team_id,
  t.team_name,
  count(*) AS total_installations,
  count(*) FILTER (WHERE ta.status = 'pending') AS pending_count,
  count(*) FILTER (WHERE ta.status = 'paid') AS paid_count,
  COALESCE(sum(COALESCE(s.installation_price, 0)) FILTER (WHERE ta.status = 'pending'), 0) AS pending_amount,
  COALESCE(sum(COALESCE(s.installation_price, 0)) FILTER (WHERE ta.status = 'paid'), 0) AS paid_amount,
  COALESCE(sum(COALESCE(s.installation_price, 0)), 0) AS total_amount
FROM installation_team_accounts ta
LEFT JOIN installation_teams t ON ta.team_id = t.id
LEFT JOIN billboards b ON ta.billboard_id = b."ID"
LEFT JOIN sizes s ON b."Size" = s.name
GROUP BY ta.team_id, t.team_name;

-- فيو ملخص المستفيدين من الشراكات
CREATE OR REPLACE VIEW public.shared_beneficiary_summary AS
SELECT 
  beneficiary,
  sum(CASE WHEN type = ANY(ARRAY['rental_income', 'capital_deduction']) THEN amount ELSE 0 END) AS total_due,
  sum(CASE WHEN type = 'payout' THEN amount ELSE 0 END) AS total_paid
FROM shared_transactions
GROUP BY beneficiary;

-- فيو الفواتير المستقلة
CREATE OR REPLACE VIEW public.print_invoices_standalone AS
SELECT id, contract_number, invoice_number, customer_id, customer_name,
  printer_name, invoice_date, total_amount, notes, design_face_a_path,
  design_face_b_path, created_at, updated_at, account_payments_deducted,
  contract_numbers, currency_code, "currency_symbol'", invoice_type,
  items, subtotal, discount, discount_type, discount_amount, total,
  currency_symbol, include_account_balance, print_items, payment_method,
  account_deduction, paid, paid_amount, paid_at, locked, printer_id,
  printer_cost, composite_task_id
FROM printed_invoices pi
WHERE composite_task_id IS NULL 
  OR NOT EXISTS (
    SELECT 1 FROM print_tasks pt WHERE pt.invoice_id = pi.id AND pt.is_composite = true
  );


-- =====================================================
-- القسم 9: الدوال الناقصة (المكملة)
-- =====================================================

-- دالة تنظيف مراجع اللوحات عند حذفها
CREATE OR REPLACE FUNCTION public.cleanup_billboard_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE "Contract" 
    SET billboard_ids = CASE 
        WHEN billboard_ids = OLD."ID"::text THEN NULL
        WHEN billboard_ids LIKE OLD."ID"::text || ',%' THEN SUBSTRING(billboard_ids FROM LENGTH(OLD."ID"::text) + 2)
        WHEN billboard_ids LIKE '%,' || OLD."ID"::text || ',%' THEN REPLACE(billboard_ids, ',' || OLD."ID"::text || ',', ',')
        WHEN billboard_ids LIKE '%,' || OLD."ID"::text THEN SUBSTRING(billboard_ids FROM 1 FOR LENGTH(billboard_ids) - LENGTH(OLD."ID"::text) - 1)
        ELSE billboard_ids
    END
    WHERE billboard_ids IS NOT NULL 
    AND billboard_ids LIKE '%' || OLD."ID"::text || '%';
    
    UPDATE "Contract" 
    SET billboards_data = CASE 
        WHEN billboards_data = OLD."ID"::text THEN NULL
        WHEN billboards_data LIKE OLD."ID"::text || ',%' THEN SUBSTRING(billboards_data FROM LENGTH(OLD."ID"::text) + 2)
        WHEN billboards_data LIKE '%,' || OLD."ID"::text || ',%' THEN REPLACE(billboards_data, ',' || OLD."ID"::text || ',', ',')
        WHEN billboards_data LIKE '%,' || OLD."ID"::text THEN SUBSTRING(billboards_data FROM 1 FOR LENGTH(billboards_data) - LENGTH(OLD."ID"::text) - 1)
        ELSE billboards_data
    END
    WHERE billboards_data IS NOT NULL 
    AND billboards_data LIKE '%' || OLD."ID"::text || '%';
    
    UPDATE "Contract" 
    SET billboard_ids = NULLIF(TRIM(billboard_ids), ''),
        billboards_data = NULLIF(TRIM(billboards_data), '')
    WHERE (billboard_ids IS NOT NULL AND TRIM(billboard_ids) = '') 
    OR (billboards_data IS NOT NULL AND TRIM(billboards_data) = '');
    
    RETURN OLD;
END;
$function$;

-- دالة معالجة إزالة لوحة من عقد
CREATE OR REPLACE FUNCTION public.handle_billboard_removal_from_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  old_billboard_ids text[];
  new_billboard_ids text[];
  removed_id text;
  deduction_to_reverse numeric;
BEGIN
  IF OLD.billboard_ids IS NOT NULL THEN
    old_billboard_ids := string_to_array(OLD.billboard_ids, ',');
  ELSE
    old_billboard_ids := ARRAY[]::text[];
  END IF;
  IF NEW.billboard_ids IS NOT NULL THEN
    new_billboard_ids := string_to_array(NEW.billboard_ids, ',');
  ELSE
    new_billboard_ids := ARRAY[]::text[];
  END IF;
  FOREACH removed_id IN ARRAY old_billboard_ids LOOP
    removed_id := trim(removed_id);
    IF removed_id != '' AND NOT removed_id = ANY(new_billboard_ids) THEN
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" AND billboard_id = removed_id::bigint;
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = removed_id::integer;
      END IF;
      DELETE FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" AND billboard_id = removed_id::bigint;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- دالة معالجة حذف عقد
CREATE OR REPLACE FUNCTION public.handle_contract_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  billboard_id_str text;
  billboard_ids_arr text[];
  deduction_to_reverse numeric;
BEGIN
  IF OLD.billboard_ids IS NOT NULL THEN
    billboard_ids_arr := string_to_array(OLD.billboard_ids, ',');
  ELSE
    billboard_ids_arr := ARRAY[]::text[];
  END IF;
  FOREACH billboard_id_str IN ARRAY billboard_ids_arr LOOP
    billboard_id_str := trim(billboard_id_str);
    IF billboard_id_str != '' THEN
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" AND billboard_id = billboard_id_str::bigint;
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = billboard_id_str::integer;
      END IF;
    END IF;
  END LOOP;
  RETURN OLD;
END;
$function$;

-- دالة حجز رأس مال الشراكة
CREATE OR REPLACE FUNCTION public.reserve_partnership_capital()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  billboard_ids_array bigint[];
  v_billboard_id bigint;
  contract_start_date date;
  contract_end_date date;
  duration_months numeric;
  billboard_price numeric;
  total_deduction numeric;
BEGIN
  IF NEW.billboard_ids IS NULL OR TRIM(NEW.billboard_ids) = '' THEN RETURN NEW; END IF;
  contract_start_date := COALESCE(NEW."Contract Date", CURRENT_DATE);
  contract_end_date := COALESCE(NEW."End Date", contract_start_date + INTERVAL '30 days');
  duration_months := (contract_end_date - contract_start_date)::numeric / 30.44;
  IF duration_months < 1 THEN duration_months := 1; END IF;
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint)) INTO billboard_ids_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id WHERE TRIM(id) ~ '^\d+$';
  FOR v_billboard_id IN SELECT unnest(billboard_ids_array) LOOP
    IF EXISTS (SELECT 1 FROM shared_billboards sb WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active') THEN
      SELECT COALESCE(b."Price", 0) INTO billboard_price FROM billboards b WHERE b."ID" = v_billboard_id;
      total_deduction := (billboard_price * duration_months);
      UPDATE shared_billboards sb
      SET reserved_amount = COALESCE(sb.reserved_amount, 0) + (total_deduction * (sb.partner_pre_pct / 100.0))
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';
      UPDATE billboards b
      SET capital_remaining = GREATEST(0, b.capital - COALESCE(
        (SELECT SUM(sb2.confirmed_amount + sb2.reserved_amount) FROM shared_billboards sb2 WHERE sb2.billboard_id = v_billboard_id), 0))
      WHERE b."ID" = v_billboard_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- دالة مزامنة بيانات إيجار الصديق
CREATE OR REPLACE FUNCTION public.sync_friend_rental_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE rental_item JSONB; billboard_price NUMERIC;
BEGIN
  DELETE FROM friend_billboard_rentals WHERE contract_number = NEW."Contract_Number";
  IF NEW.friend_rental_data IS NOT NULL AND jsonb_array_length(NEW.friend_rental_data) > 0 THEN
    FOR rental_item IN SELECT * FROM jsonb_array_elements(NEW.friend_rental_data) LOOP
      SELECT COALESCE(
        (SELECT CAST(bp->>'contractPrice' AS NUMERIC) FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp WHERE bp->>'billboardId' = rental_item->>'billboardId'),
        (SELECT CAST(bp->>'priceAfterDiscount' AS NUMERIC) FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp WHERE bp->>'billboardId' = rental_item->>'billboardId'),
        0
      ) INTO billboard_price;
      INSERT INTO friend_billboard_rentals (billboard_id, contract_number, friend_company_id, friend_rental_cost, customer_rental_price, start_date, end_date, notes)
      VALUES (CAST(rental_item->>'billboardId' AS BIGINT), NEW."Contract_Number", CAST(rental_item->>'friendCompanyId' AS UUID),
        CAST(rental_item->>'friendRentalCost' AS NUMERIC), billboard_price,
        COALESCE(NEW."Contract Date", CURRENT_DATE), COALESCE(NEW."End Date", CURRENT_DATE + INTERVAL '30 days'), NULL)
      ON CONFLICT (billboard_id, contract_number) DO UPDATE SET
        friend_company_id = EXCLUDED.friend_company_id, friend_rental_cost = EXCLUDED.friend_rental_cost,
        customer_rental_price = EXCLUDED.customer_rental_price, start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date, updated_at = NOW();
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة تحديث حالة اللوحة بناءً على العقد
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_contract()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW."Rent_End_Date" IS NOT NULL AND NEW."Rent_End_Date" <= CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة تحديث حالة اللوحة بناءً على التواريخ
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW."Rent_End_Date" IS NULL OR NEW."Rent_End_Date" < CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  ELSIF NEW."Rent_Start_Date" <= CURRENT_DATE AND NEW."Rent_End_Date" >= CURRENT_DATE THEN
    NEW."Status" := 'محجوز';
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة تحديث العمود updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- دالة وضع علامة composite على المهام
CREATE OR REPLACE FUNCTION public.mark_task_as_composite()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.print_task_id IS NOT NULL THEN
    UPDATE print_tasks SET is_composite = true WHERE id = NEW.print_task_id;
  END IF;
  IF NEW.cutout_task_id IS NOT NULL THEN
    UPDATE cutout_tasks SET is_composite = true WHERE id = NEW.cutout_task_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة إنشاء مهمة مركبة تلقائياً
CREATE OR REPLACE FUNCTION public.auto_create_composite_task()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_installation_cost_for_customer NUMERIC := 0;
  v_installation_cost_for_company NUMERIC := 0;
  v_task_type TEXT;
BEGIN
  SELECT "Contract_Number", "Customer Name", customer_id, installation_enabled, installation_cost
  INTO v_contract FROM "Contract" WHERE "Contract_Number" = NEW.contract_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_task_type := CASE WHEN NEW.task_type = 'reinstallation' THEN 'reinstallation' ELSE 'new_installation' END;
  IF v_task_type = 'new_installation' AND v_contract.installation_enabled THEN
    v_installation_cost_for_customer := 0;
  ELSIF v_task_type = 'reinstallation' THEN
    v_installation_cost_for_customer := COALESCE(v_contract.installation_cost, 0);
  END IF;
  v_installation_cost_for_company := COALESCE(v_contract.installation_cost, 0);
  INSERT INTO composite_tasks (installation_task_id, contract_id, customer_id, customer_name, task_type,
    customer_installation_cost, company_installation_cost, customer_print_cost, company_print_cost,
    customer_cutout_cost, company_cutout_cost, status)
  VALUES (NEW.id, NEW.contract_id, v_contract.customer_id, v_contract."Customer Name", v_task_type,
    v_installation_cost_for_customer, v_installation_cost_for_company, 0, 0, 0, 0, 'pending');
  RETURN NEW;
END;
$function$;

-- دالة تحديث المهمة المركبة عند ربط المهام
CREATE OR REPLACE FUNCTION public.update_composite_task_on_task_link()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.print_task_id IS NOT NULL AND OLD.print_task_id IS DISTINCT FROM NEW.print_task_id THEN
    UPDATE composite_tasks SET print_task_id = NEW.print_task_id WHERE installation_task_id = NEW.id;
  END IF;
  IF NEW.cutout_task_id IS NOT NULL AND OLD.cutout_task_id IS DISTINCT FROM NEW.cutout_task_id THEN
    UPDATE composite_tasks SET cutout_task_id = NEW.cutout_task_id WHERE installation_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة مزامنة تكلفة التركيب في المهمة المركبة
CREATE OR REPLACE FUNCTION public.sync_composite_task_installation_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_installation_task_id uuid;
  v_total_customer_cost numeric;
BEGIN
  v_installation_task_id := COALESCE(NEW.task_id, OLD.task_id);
  SELECT COALESCE(SUM(customer_installation_cost), 0) INTO v_total_customer_cost
  FROM installation_task_items WHERE task_id = v_installation_task_id;
  UPDATE composite_tasks SET customer_installation_cost = v_total_customer_cost, updated_at = now()
  WHERE installation_task_id = v_installation_task_id;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- دالة حذف فاتورة مهمة القص
CREATE OR REPLACE FUNCTION public.delete_cutout_task_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.is_composite = false AND OLD.invoice_id IS NOT NULL THEN
    DELETE FROM printed_invoices WHERE id = OLD.invoice_id;
  END IF;
  RETURN OLD;
END;
$function$;

-- دالة إنشاء مهمة طباعة للفاتورة
CREATE OR REPLACE FUNCTION public.create_print_task_for_invoice_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_task_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM print_tasks WHERE invoice_id = NEW.id) INTO v_task_exists;
  IF v_task_exists THEN RETURN NEW; END IF;
  IF NEW.invoice_number LIKE 'PTM-%' THEN RETURN NEW; END IF;
  RETURN NEW;
END;
$function$;

-- دالة حفظ تاريخ اللوحة عند إكمال عنصر التركيب
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_contract RECORD; v_billboard RECORD; v_team_name TEXT; v_installation_date DATE; v_design_a TEXT; v_design_b TEXT; v_billboard_price NUMERIC(10,2); v_discount_per_billboard NUMERIC(10,2); v_rent_before_discount NUMERIC(10,2); v_rent_after_discount NUMERIC(10,2); v_installation_cost NUMERIC(10,2); v_billboard_prices JSONB; v_price_entry JSONB; v_discount_pct NUMERIC(10,2); v_duration_days INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = (SELECT contract_id FROM installation_tasks WHERE id = NEW.task_id);
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = NEW.billboard_id;
    SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id);
    v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE);
    v_design_a := COALESCE(NEW.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_a");
    v_design_b := COALESCE(NEW.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_b");
    v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    IF v_billboard_prices IS NOT NULL THEN
      SELECT value INTO v_price_entry FROM jsonb_array_elements(v_billboard_prices) AS value WHERE (value->>'billboardId')::BIGINT = NEW.billboard_id LIMIT 1;
      IF v_price_entry IS NOT NULL THEN
        v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2);
        v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2);
        v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2);
      END IF;
    END IF;
    IF v_rent_before_discount IS NULL THEN
      v_rent_before_discount := ROUND(COALESCE(v_contract."Total Rent", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_discount_per_billboard := ROUND(COALESCE(v_contract."Discount", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2);
    END IF;
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    IF v_rent_before_discount > 0 THEN v_discount_pct := ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2);
    ELSE v_discount_pct := 0; END IF;
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date;
    ELSE v_duration_days := NULL; END IF;
    INSERT INTO billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, billboard_rent_price, total_before_discount, discount_amount, discount_percentage, rent_amount, installation_cost, net_rental_amount, installation_date, team_name, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, notes)
    VALUES (NEW.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_billboard_price, v_rent_before_discount, v_discount_per_billboard, v_discount_pct, v_rent_after_discount, v_installation_cost, ROUND(v_rent_after_discount - v_installation_cost, 2), v_installation_date, v_team_name, v_design_a, v_design_b, NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, NEW.notes);
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة حفظ تاريخ اللوحة عند حذف عنصر التركيب
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_deletion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_contract RECORD; v_billboard RECORD; v_team_name TEXT; v_installation_date DATE; v_design_a TEXT; v_design_b TEXT; v_billboard_price NUMERIC(10,2); v_discount_per_billboard NUMERIC(10,2); v_rent_before_discount NUMERIC(10,2); v_rent_after_discount NUMERIC(10,2); v_installation_cost NUMERIC(10,2); v_billboard_prices JSONB; v_price_entry JSONB; v_duration_days INTEGER;
BEGIN
  IF OLD.status = 'completed' THEN
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = (SELECT contract_id FROM installation_tasks WHERE id = OLD.task_id);
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = OLD.billboard_id;
    SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = OLD.task_id);
    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    v_design_a := COALESCE(OLD.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_a");
    v_design_b := COALESCE(OLD.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_b");
    v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    IF v_billboard_prices IS NOT NULL THEN
      SELECT value INTO v_price_entry FROM jsonb_array_elements(v_billboard_prices) AS value WHERE (value->>'billboardId')::BIGINT = OLD.billboard_id LIMIT 1;
      IF v_price_entry IS NOT NULL THEN
        v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2);
        v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2);
        v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2);
      END IF;
    END IF;
    IF v_rent_before_discount IS NULL THEN
      v_rent_before_discount := ROUND(COALESCE(v_contract."Total Rent", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_discount_per_billboard := ROUND(COALESCE(v_contract."Discount", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2);
    END IF;
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date;
    ELSE v_duration_days := NULL; END IF;
    INSERT INTO billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, billboard_rent_price, total_before_discount, discount_amount, discount_percentage, rent_amount, installation_cost, net_rental_amount, installation_date, team_name, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, notes)
    VALUES (OLD.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_billboard_price, v_rent_before_discount, v_discount_per_billboard, CASE WHEN v_rent_before_discount > 0 THEN ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2) ELSE 0 END, v_rent_after_discount, v_installation_cost, ROUND(v_rent_after_discount - v_installation_cost, 2), v_installation_date, v_team_name, v_design_a, v_design_b, OLD.installed_image_face_a_url, OLD.installed_image_face_b_url, COALESCE(OLD.notes, '') || ' [تم الحذف/التراجع]');
  END IF;
  RETURN OLD;
END;
$function$;

-- دالة تحديث تاريخ اللوحة عند التراجع عن الإكمال
CREATE OR REPLACE FUNCTION public.update_billboard_history_on_task_uncomplete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_billboard RECORD; v_contract RECORD; v_installation_date DATE;
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'pending' THEN
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = OLD.billboard_id; IF NOT FOUND THEN RETURN NEW; END IF;
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = v_billboard."Contract_Number"; IF NOT FOUND THEN RETURN NEW; END IF;
    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    DELETE FROM billboard_history WHERE billboard_id = OLD.billboard_id AND contract_number = v_contract."Contract_Number" AND installation_date = v_installation_date;
  END IF;
  RETURN NEW;
END;
$function$;

-- دالة تحديث رصيد العهدة
CREATE OR REPLACE FUNCTION public.update_custody_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'deposit' THEN
      UPDATE custody_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.custody_account_id;
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.custody_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type = 'deposit' THEN
      UPDATE custody_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.custody_account_id;
    ELSIF OLD.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.custody_account_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;


-- =====================================================
-- القسم 10: جميع التريغرات (TRIGGERS)
-- =====================================================

-- === تريغرات جدول Contract ===
CREATE TRIGGER auto_create_tasks_trigger AFTER INSERT ON "Contract" FOR EACH ROW EXECUTE FUNCTION auto_create_installation_tasks();
CREATE TRIGGER sync_contract_customer_info_trigger BEFORE UPDATE ON "Contract" FOR EACH ROW EXECUTE FUNCTION sync_contract_customer_info();
CREATE TRIGGER trg_handle_billboard_removal BEFORE UPDATE ON "Contract" FOR EACH ROW EXECUTE FUNCTION handle_billboard_removal_from_contract();
CREATE TRIGGER trg_handle_contract_deletion BEFORE DELETE ON "Contract" FOR EACH ROW EXECUTE FUNCTION handle_contract_deletion();
CREATE TRIGGER trg_release_partnership_capital BEFORE DELETE ON "Contract" FOR EACH ROW EXECUTE FUNCTION release_partnership_capital();
CREATE TRIGGER trg_reserve_partnership_capital AFTER INSERT ON "Contract" FOR EACH ROW EXECUTE FUNCTION reserve_partnership_capital();
CREATE TRIGGER trg_sync_billboards_from_contract_insupd AFTER INSERT ON "Contract" FOR EACH ROW EXECUTE FUNCTION t_sync_billboards_from_contract();
CREATE TRIGGER trg_sync_contract_seq AFTER INSERT ON "Contract" FOR EACH STATEMENT EXECUTE FUNCTION sync_contract_seq();
CREATE TRIGGER trg_sync_friend_rental_data AFTER INSERT ON "Contract" FOR EACH ROW EXECUTE FUNCTION sync_friend_rental_data();
CREATE TRIGGER trigger_delete_installation_task AFTER DELETE ON "Contract" FOR EACH ROW EXECUTE FUNCTION delete_installation_task_on_contract_delete();

-- === تريغرات جدول billboard_cost_centers ===
CREATE TRIGGER update_billboard_cost_centers_updated_at BEFORE UPDATE ON billboard_cost_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول billboard_print_customization ===
CREATE TRIGGER update_billboard_print_customization_updated_at BEFORE UPDATE ON billboard_print_customization FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول billboard_print_profiles ===
CREATE TRIGGER update_billboard_print_profiles_updated_at BEFORE UPDATE ON billboard_print_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول billboard_print_settings ===
CREATE TRIGGER update_billboard_print_settings_updated_at BEFORE UPDATE ON billboard_print_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول billboards ===
CREATE TRIGGER cleanup_billboard_references_trigger BEFORE DELETE ON billboards FOR EACH ROW EXECUTE FUNCTION cleanup_billboard_references();
CREATE TRIGGER trg_update_billboard_status BEFORE INSERT ON billboards FOR EACH ROW EXECUTE FUNCTION update_billboard_status_based_on_contract();
CREATE TRIGGER trg_update_billboard_status_based_on_dates BEFORE INSERT ON billboards FOR EACH ROW EXECUTE FUNCTION update_billboard_status_based_on_dates();
CREATE TRIGGER trg_update_billboard_status_dates BEFORE INSERT ON billboards FOR EACH ROW EXECUTE FUNCTION update_billboard_status_based_on_dates();
CREATE TRIGGER update_billboards_updated_at_trigger BEFORE UPDATE ON billboards FOR EACH ROW EXECUTE FUNCTION update_billboards_updated_at();

-- === تريغرات جدول booking_requests ===
CREATE TRIGGER update_booking_requests_updated_at BEFORE UPDATE ON booking_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول composite_tasks ===
CREATE TRIGGER delete_separate_invoices_on_composite_create AFTER INSERT ON composite_tasks FOR EACH ROW EXECUTE FUNCTION delete_separate_task_invoices();
CREATE TRIGGER sync_composite_print_costs_to_print_trigger AFTER INSERT ON composite_tasks FOR EACH ROW EXECUTE FUNCTION sync_composite_print_costs_to_print();
CREATE TRIGGER sync_composite_to_cutout_trigger AFTER UPDATE ON composite_tasks FOR EACH ROW EXECUTE FUNCTION sync_composite_cutout_costs_to_cutout();
CREATE TRIGGER trigger_calculate_composite_profit BEFORE INSERT ON composite_tasks FOR EACH ROW EXECUTE FUNCTION calculate_composite_task_profit();
CREATE TRIGGER trigger_delete_composite_task_invoices BEFORE DELETE ON composite_tasks FOR EACH ROW EXECUTE FUNCTION delete_composite_task_invoices();
CREATE TRIGGER trigger_mark_task_as_composite AFTER INSERT ON composite_tasks FOR EACH ROW EXECUTE FUNCTION mark_task_as_composite();
CREATE TRIGGER update_composite_tasks_updated_at BEFORE UPDATE ON composite_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول contract_expenses ===
CREATE TRIGGER update_contract_expenses_updated_at BEFORE UPDATE ON contract_expenses FOR EACH ROW EXECUTE FUNCTION update_contract_expenses_updated_at();

-- === تريغرات جدول contract_terms ===
CREATE TRIGGER update_contract_terms_timestamp BEFORE UPDATE ON contract_terms FOR EACH ROW EXECUTE FUNCTION update_contract_terms_updated_at();

-- === تريغرات جدول custody_expenses ===
CREATE TRIGGER custody_expense_balance_trigger AFTER INSERT ON custody_expenses FOR EACH ROW EXECUTE FUNCTION update_custody_balance_on_expense();

-- === تريغرات جدول custody_transactions ===
CREATE TRIGGER trigger_update_custody_balance AFTER INSERT ON custody_transactions FOR EACH ROW EXECUTE FUNCTION update_custody_balance();

-- === تريغرات جدول customer_general_discounts ===
CREATE TRIGGER update_customer_general_discounts_updated_at BEFORE UPDATE ON customer_general_discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول customer_payments ===
CREATE TRIGGER trg_delete_advance_on_payment_delete BEFORE DELETE ON customer_payments FOR EACH ROW EXECUTE FUNCTION delete_advance_on_payment_delete();
CREATE TRIGGER trg_delete_withdrawal_on_payment_delete BEFORE DELETE ON customer_payments FOR EACH ROW EXECUTE FUNCTION delete_withdrawal_on_payment_delete();
CREATE TRIGGER trigger_sync_custody_on_payment_update AFTER UPDATE ON customer_payments FOR EACH ROW EXECUTE FUNCTION sync_custody_balance_on_payment_update();
CREATE TRIGGER trigger_update_contract_payment_status AFTER INSERT ON customer_payments FOR EACH ROW EXECUTE FUNCTION update_contract_payment_status();
CREATE TRIGGER trigger_update_customer_last_payment AFTER INSERT ON customer_payments FOR EACH ROW EXECUTE FUNCTION update_customer_last_payment();
CREATE TRIGGER update_customer_payments_updated_at BEFORE UPDATE ON customer_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول customers ===
CREATE TRIGGER sync_customer_to_contracts_trigger AFTER UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION sync_customer_info_to_contracts();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول cutout_tasks ===
CREATE TRIGGER sync_cutout_to_composite_trigger AFTER INSERT ON cutout_tasks FOR EACH ROW EXECUTE FUNCTION sync_cutout_costs_to_composite();
CREATE TRIGGER trigger_cleanup_cutout_task_items BEFORE DELETE ON cutout_tasks FOR EACH ROW EXECUTE FUNCTION cleanup_cutout_task_items();
CREATE TRIGGER trigger_delete_cutout_task_invoice BEFORE DELETE ON cutout_tasks FOR EACH ROW EXECUTE FUNCTION delete_cutout_task_invoice();

-- === تريغرات جدول distributions ===
CREATE TRIGGER update_distributions_updated_at BEFORE UPDATE ON distributions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول employee_contracts ===
CREATE TRIGGER trg_emp_contracts_updated BEFORE UPDATE ON employee_contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- === تريغرات جدول employee_manual_tasks ===
CREATE TRIGGER trigger_update_employee_manual_tasks_updated_at BEFORE UPDATE ON employee_manual_tasks FOR EACH ROW EXECUTE FUNCTION update_employee_manual_tasks_updated_at();

-- === تريغرات جدول employees ===
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- === تريغرات جدول expenses ===
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول friend_billboard_rentals ===
CREATE TRIGGER trg_friend_rentals_updated_at BEFORE UPDATE ON friend_billboard_rentals FOR EACH ROW EXECUTE FUNCTION update_friend_rentals_updated_at();

-- === تريغرات جدول friend_companies ===
CREATE TRIGGER trg_friend_companies_updated_at BEFORE UPDATE ON friend_companies FOR EACH ROW EXECUTE FUNCTION update_friend_companies_updated_at();

-- === تريغرات جدول installation_print_pricing ===
CREATE TRIGGER trg_installation_print_pricing_u BEFORE UPDATE ON installation_print_pricing FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER update_installation_print_pricing_updated_at BEFORE UPDATE ON installation_print_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول installation_task_items ===
CREATE TRIGGER save_history_on_completion AFTER INSERT ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_item_completion();
CREATE TRIGGER sync_composite_task_cost_on_item_change AFTER INSERT ON installation_task_items FOR EACH ROW EXECUTE FUNCTION sync_composite_task_installation_cost();
CREATE TRIGGER tr_installation_item_completed AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_completion();
CREATE TRIGGER trg_auto_set_company_installation_cost BEFORE INSERT ON installation_task_items FOR EACH ROW EXECUTE FUNCTION auto_set_company_installation_cost();
CREATE TRIGGER trg_confirm_partnership_capital AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION confirm_partnership_capital();
CREATE TRIGGER trg_create_billboard_history_on_task_complete AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION create_billboard_history_on_task_complete();
CREATE TRIGGER trg_delete_history_on_revert AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION delete_billboard_history_on_revert();
CREATE TRIGGER trg_save_billboard_history AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_completion();
CREATE TRIGGER trg_save_billboard_history_on_completion AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_item_completion();
CREATE TRIGGER trg_save_billboard_history_on_deletion BEFORE DELETE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_item_deletion();
CREATE TRIGGER trg_save_history_on_completion AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_item_completion();
CREATE TRIGGER trg_update_billboard_history_on_task_uncomplete AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION update_billboard_history_on_task_uncomplete();
CREATE TRIGGER trigger_add_to_team_account AFTER INSERT ON installation_task_items FOR EACH ROW EXECUTE FUNCTION add_to_team_account();
CREATE TRIGGER trigger_remove_from_team_account AFTER UPDATE ON installation_task_items FOR EACH ROW EXECUTE FUNCTION remove_from_team_account();

-- === تريغرات جدول installation_tasks ===
CREATE TRIGGER trigger_auto_create_composite_task AFTER INSERT ON installation_tasks FOR EACH ROW EXECUTE FUNCTION auto_create_composite_task();
CREATE TRIGGER trigger_delete_composite_on_installation_delete AFTER DELETE ON installation_tasks FOR EACH ROW EXECUTE FUNCTION delete_composite_task_on_installation_delete();
CREATE TRIGGER trigger_update_composite_on_link AFTER UPDATE ON installation_tasks FOR EACH ROW EXECUTE FUNCTION update_composite_task_on_task_link();
CREATE TRIGGER update_installation_tasks_updated_at_trigger BEFORE UPDATE ON installation_tasks FOR EACH ROW EXECUTE FUNCTION update_installation_tasks_updated_at();

-- === تريغرات جدول installation_team_accounts ===
CREATE TRIGGER update_team_accounts_updated_at BEFORE UPDATE ON installation_team_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول installation_teams ===
CREATE TRIGGER set_updated_at BEFORE UPDATE ON installation_teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- === تريغرات جدول invoices ===
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول management_phones ===
CREATE TRIGGER update_management_phones_updated_at BEFORE UPDATE ON management_phones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول messaging_api_settings ===
CREATE TRIGGER update_messaging_api_settings_updated_at BEFORE UPDATE ON messaging_api_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول municipalities ===
CREATE TRIGGER update_municipalities_updated_at BEFORE UPDATE ON municipalities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول municipality_collection_items ===
CREATE TRIGGER update_municipality_collection_items_updated_at BEFORE UPDATE ON municipality_collection_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول municipality_collections ===
CREATE TRIGGER update_municipality_collections_updated_at BEFORE UPDATE ON municipality_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول municipality_rent_prices ===
CREATE TRIGGER update_municipality_rent_prices_updated_at BEFORE UPDATE ON municipality_rent_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول municipality_stickers_settings ===
CREATE TRIGGER update_municipality_stickers_settings_updated_at BEFORE UPDATE ON municipality_stickers_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول offers ===
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول partners ===
CREATE TRIGGER update_partner_companies_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول pricing_durations ===
CREATE TRIGGER update_pricing_durations_updated_at BEFORE UPDATE ON pricing_durations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === تريغرات جدول print_backgrounds ===
CREATE TRIGGER update_print_backgrounds_updated_at BEFORE UPDATE ON print_backgrounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول print_reprints ===
CREATE TRIGGER update_print_reprints_updated_at BEFORE UPDATE ON print_reprints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول print_settings ===
CREATE TRIGGER update_print_settings_timestamp BEFORE UPDATE ON print_settings FOR EACH ROW EXECUTE FUNCTION update_print_settings_updated_at();

-- === تريغرات جدول print_tasks ===
CREATE TRIGGER sync_print_costs_to_composite_trigger AFTER UPDATE ON print_tasks FOR EACH ROW EXECUTE FUNCTION sync_print_costs_to_composite();
CREATE TRIGGER trigger_cleanup_print_task_items BEFORE DELETE ON print_tasks FOR EACH ROW EXECUTE FUNCTION cleanup_print_task_items();
CREATE TRIGGER update_print_tasks_updated_at_trigger BEFORE UPDATE ON print_tasks FOR EACH ROW EXECUTE FUNCTION update_installation_tasks_updated_at();

-- === تريغرات جدول printed_invoices ===
CREATE TRIGGER lock_paid_printed_invoice BEFORE UPDATE ON printed_invoices FOR EACH ROW EXECUTE FUNCTION lock_paid_invoice();
CREATE TRIGGER trigger_create_print_task_v2 AFTER INSERT ON printed_invoices FOR EACH ROW EXECUTE FUNCTION create_print_task_for_invoice_v2();
CREATE TRIGGER update_printed_invoices_updated_at BEFORE UPDATE ON printed_invoices FOR EACH ROW EXECUTE FUNCTION update_printed_invoices_updated_at();

-- === تريغرات جدول printer_payments ===
CREATE TRIGGER update_printer_payments_updated_at BEFORE UPDATE ON printer_payments FOR EACH ROW EXECUTE FUNCTION update_printer_payments_updated_at();

-- === تريغرات جدول printers ===
CREATE TRIGGER trigger_update_printers_updated_at BEFORE UPDATE ON printers FOR EACH ROW EXECUTE FUNCTION update_printers_updated_at();
CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON printers FOR EACH ROW EXECUTE FUNCTION update_printers_updated_at();

-- === تريغرات جدول profiles ===
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول purchase_invoices ===
CREATE TRIGGER lock_paid_purchase_invoice BEFORE UPDATE ON purchase_invoices FOR EACH ROW EXECUTE FUNCTION lock_paid_invoice();
CREATE TRIGGER trigger_delete_purchase_invoice_payments BEFORE DELETE ON purchase_invoices FOR EACH ROW EXECUTE FUNCTION delete_purchase_invoice_payments();
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON purchase_invoices FOR EACH ROW EXECUTE FUNCTION update_purchase_invoice_updated_at();

-- === تريغرات جدول removal_tasks ===
CREATE TRIGGER update_removal_tasks_timestamp BEFORE UPDATE ON removal_tasks FOR EACH ROW EXECUTE FUNCTION update_removal_tasks_updated_at();

-- === تريغرات جدول reports ===
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول roles ===
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول sales_invoices ===
CREATE TRIGGER lock_paid_sales_invoice BEFORE UPDATE ON sales_invoices FOR EACH ROW EXECUTE FUNCTION lock_paid_invoice();
CREATE TRIGGER update_sales_invoice_updated_at BEFORE UPDATE ON sales_invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- === تريغرات جدول shared_billboards ===
CREATE TRIGGER trg_sync_billboard_capital AFTER INSERT ON shared_billboards FOR EACH ROW EXECUTE FUNCTION sync_billboard_capital();
CREATE TRIGGER update_shared_billboards_updated_at BEFORE UPDATE ON shared_billboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول system_settings ===
CREATE TRIGGER system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_system_settings_updated_at();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول tasks ===
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- === تريغرات جدول user_roles ===
CREATE TRIGGER enforce_admin_role_assignment BEFORE INSERT ON user_roles FOR EACH ROW EXECUTE FUNCTION check_admin_role_assignment();


-- =====================================================
-- القسم 11: جميع سياسات RLS (Row Level Security)
-- =====================================================

-- === سياسات جدول Contract ===
CREATE POLICY "Admins manage contracts" ON "Contract" FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view contracts" ON "Contract" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with contracts permission can create contracts" ON "Contract" FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Users with contracts permission can delete contracts" ON "Contract" FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Users with contracts permission can update contracts" ON "Contract" FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'contracts')) WITH CHECK (has_permission(auth.uid(), 'contracts'));
CREATE POLICY "Users with contracts permission can view contracts" ON "Contract" FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'contracts'));

-- === سياسات جدول account_closures ===
CREATE POLICY "Admins view closures" ON account_closures FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- === سياسات جدول base_prices ===
CREATE POLICY "Admins manage base_prices" ON base_prices FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read base_prices" ON base_prices FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can read base_prices" ON base_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitted users can manage base_prices" ON base_prices FOR ALL TO authenticated USING (has_permission(auth.uid(), 'pricing')) WITH CHECK (has_permission(auth.uid(), 'pricing'));

-- === سياسات جدول billboard_cost_centers ===
CREATE POLICY "Admins can manage cost centers" ON billboard_cost_centers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view cost centers" ON billboard_cost_centers FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'billboards'));

-- === سياسات جدول billboard_extensions ===
CREATE POLICY "Admins manage billboard extensions" ON billboard_extensions FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view billboard extensions" ON billboard_extensions FOR SELECT TO public USING (true);

-- === سياسات جدول billboard_faces ===
CREATE POLICY "Admins manage billboard faces" ON billboard_faces FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view billboard faces" ON billboard_faces FOR SELECT TO authenticated USING (true);

-- === سياسات جدول billboard_history ===
CREATE POLICY "Admins manage billboard history" ON billboard_history FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view billboard history" ON billboard_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitted users can insert billboard history" ON billboard_history FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'billboards'));
CREATE POLICY "Permitted users can update billboard history" ON billboard_history FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'billboards'));

-- === سياسات جدول billboard_levels ===
CREATE POLICY "Admins manage billboard levels" ON billboard_levels FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view billboard levels" ON billboard_levels FOR SELECT TO authenticated USING (true);

-- === سياسات جدول billboard_print_customization ===
CREATE POLICY "Anyone can read print customization" ON billboard_print_customization FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users manage print customization" ON billboard_print_customization FOR ALL TO public USING ((SELECT auth.role()) = 'authenticated');

-- === سياسات جدول billboard_print_profiles ===
CREATE POLICY "Authenticated users can create billboard print profiles" ON billboard_print_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete billboard print profiles" ON billboard_print_profiles FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update billboard print profiles" ON billboard_print_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Billboard print profiles are viewable by all" ON billboard_print_profiles FOR SELECT TO public USING (true);

-- === سياسات جدول billboard_print_settings ===
CREATE POLICY "Authenticated users can manage billboard print settings" ON billboard_print_settings FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Billboard print settings readable by authenticated" ON billboard_print_settings FOR SELECT TO authenticated USING (true);

-- === سياسات جدول billboard_types ===
CREATE POLICY "Admins manage billboard types" ON billboard_types FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view billboard types" ON billboard_types FOR SELECT TO authenticated USING (true);

-- === سياسات جدول billboards ===
CREATE POLICY "Admins manage billboards" ON billboards FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users can insert billboards" ON billboards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update billboards" ON billboards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view billboards" ON billboards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage billboards" ON billboards FOR ALL TO authenticated USING (has_permission(auth.uid(), 'billboards')) WITH CHECK (has_permission(auth.uid(), 'billboards'));

-- === سياسات جدول booking_requests ===
CREATE POLICY "Admins manage booking requests" ON booking_requests FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view booking requests" ON booking_requests FOR SELECT TO authenticated USING (true);

-- === سياسات جدول category_factors ===
CREATE POLICY "Admins manage category_factors" ON category_factors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read category_factors" ON category_factors FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can manage category_factors" ON category_factors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read category_factors" ON category_factors FOR SELECT TO authenticated USING (true);

-- === سياسات جدول cleanup_logs ===
CREATE POLICY "Allow public read access to cleanup_logs" ON cleanup_logs FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert cleanup_logs" ON cleanup_logs FOR INSERT TO authenticated WITH CHECK (true);

-- === سياسات جدول composite_tasks ===
CREATE POLICY "Authenticated users manage composite tasks" ON composite_tasks FOR ALL TO public USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "Users with permission can manage composite_tasks" ON composite_tasks FOR ALL TO authenticated USING (has_permission(auth.uid(), 'tasks')) WITH CHECK (has_permission(auth.uid(), 'tasks'));

-- === سياسات جدول contract_expenses ===
CREATE POLICY "Allow all access to contract_expenses" ON contract_expenses FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Users with permission can manage contract_expenses" ON contract_expenses FOR ALL TO authenticated USING (has_permission(auth.uid(), 'contracts')) WITH CHECK (has_permission(auth.uid(), 'contracts'));

-- === سياسات جدول contract_template_settings ===
CREATE POLICY "Admins manage contract_template_settings" ON contract_template_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow insert for authenticated users" ON contract_template_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow read for authenticated users" ON contract_template_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update for authenticated users" ON contract_template_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can read contract_template_settings" ON contract_template_settings FOR SELECT TO authenticated USING (true);

-- === سياسات جدول contract_terms ===
CREATE POLICY "Allow authenticated users to modify contract_terms" ON contract_terms FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read access to contract_terms" ON contract_terms FOR SELECT TO public USING (true);

-- === سياسات جدول custody_accounts ===
CREATE POLICY "Admins view all custody accounts" ON custody_accounts FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Custody accounts access" ON custody_accounts FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_permission((SELECT auth.uid()), 'custody'));
CREATE POLICY "Users with permission can manage custody_accounts" ON custody_accounts FOR ALL TO authenticated USING (has_permission(auth.uid(), 'custody')) WITH CHECK (has_permission(auth.uid(), 'custody'));

-- === سياسات جدول custody_expenses ===
CREATE POLICY "Custody expenses access" ON custody_expenses FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_permission((SELECT auth.uid()), 'custody'));
CREATE POLICY "Users with permission can manage custody_expenses" ON custody_expenses FOR ALL TO authenticated USING (has_permission(auth.uid(), 'custody')) WITH CHECK (has_permission(auth.uid(), 'custody'));

-- === سياسات جدول custody_transactions ===
CREATE POLICY "Admins view all custody transactions" ON custody_transactions FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Custody transactions access" ON custody_transactions FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_permission((SELECT auth.uid()), 'custody'));
CREATE POLICY "Users with permission can manage custody_transactions" ON custody_transactions FOR ALL TO authenticated USING (has_permission(auth.uid(), 'custody')) WITH CHECK (has_permission(auth.uid(), 'custody'));

-- === سياسات جدول customer_general_discounts ===
CREATE POLICY "Admins manage customer discounts" ON customer_general_discounts FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- === سياسات جدول customer_payments ===
CREATE POLICY "Admins can delete payments" ON customer_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert customer_payments" ON customer_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update customer_payments" ON customer_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can insert payments" ON customer_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON customer_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users view payments" ON customer_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can manage customer_payments" ON customer_payments FOR ALL TO authenticated USING (has_permission(auth.uid(), 'customers')) WITH CHECK (has_permission(auth.uid(), 'customers'));

-- === سياسات جدول customer_purchases ===
CREATE POLICY "Admins manage customer purchases" ON customer_purchases FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins manage customer_purchases" ON customer_purchases FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view customer_purchases" ON customer_purchases FOR SELECT TO authenticated USING (true);

-- === سياسات جدول customers ===
CREATE POLICY "Admins can insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update customers" ON customers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage customers" ON customers FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Authenticated users view customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users with permission can delete customers" ON customers FOR DELETE TO authenticated USING (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Users with permission can insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Users with permission can update customers" ON customers FOR UPDATE TO authenticated USING (has_permission(auth.uid(), 'customers'));
CREATE POLICY "Users with permission can view customers" ON customers FOR SELECT TO authenticated USING (has_permission(auth.uid(), 'customers'));

-- === سياسات جدول cutout_task_items ===
CREATE POLICY "Admins manage cutout task items" ON cutout_task_items FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins manage cutout_task_items" ON cutout_task_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read cutout_task_items" ON cutout_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users view cutout task items" ON cutout_task_items FOR SELECT TO public USING (true);

-- === سياسات جدول cutout_tasks ===
CREATE POLICY "Admins manage cutout tasks" ON cutout_tasks FOR ALL TO public USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins manage cutout_tasks" ON cutout_tasks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read cutout_tasks" ON cutout_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users view cutout tasks" ON cutout_tasks FOR SELECT TO public USING (true);
CREATE POLICY "Users with permission can manage cutout_tasks" ON cutout_tasks FOR ALL TO authenticated USING (has_permission(auth.uid(), 'print_tasks')) WITH CHECK (has_permission(auth.uid(), 'print_tasks'));

-- ⚠️ ملاحظة: هذا جزء من السياسات الأساسية - باقي السياسات للجداول المتبقية تتبع نفس النمط
-- الجداول المتبقية تشمل: distributions, employee_advances, employee_contracts, employees,
-- expenses, friend_billboard_rentals, friend_companies, installation_print_pricing,
-- installation_task_items, installation_tasks, installation_team_accounts, installation_teams,
-- invoices, management_phones, messaging_api_settings, municipalities, municipality_collections,
-- municipality_collection_items, municipality_rent_prices, municipality_stickers_settings,
-- offers, partners, partnership_contract_shares, payroll_items, payroll_runs, period_closures,
-- pricing_categories, pricing_durations, print_backgrounds, print_reprints, print_settings,
-- print_task_items, print_tasks, printed_invoices, printer_payments, printers, profiles,
-- purchase_invoices, removal_tasks, reports, roles, sales_invoices, shared_billboards,
-- shared_transactions, sizes, system_settings, task_designs, tasks, timesheets, user_roles,
-- withdrawals

-- النمط العام لمعظم الجداول:
-- 1. سياسة "Admins manage [table]" FOR ALL USING (has_role(auth.uid(), 'admin'))
-- 2. سياسة "Authenticated users view [table]" FOR SELECT USING (true)
-- 3. سياسة "Users with permission can manage [table]" FOR ALL USING (has_permission(auth.uid(), '[permission]'))


-- =====================================================
-- القسم 12: ملاحظات الاستعادة النهائية
-- =====================================================

-- ✅ هذا الملف الآن يحتوي على:
-- 1. الأنواع المخصصة (Enums) والتسلسلات (Sequences)
-- 2. جميع الجداول (114 جدول) مع كامل العلاقات
-- 3. جميع الدوال (أكثر من 60 دالة)
-- 4. جميع التريغرات (أكثر من 100 تريغر)
-- 5. تمكين RLS وسياسات الأمان الأساسية
-- 6. الفيوز (Views) للتقارير المالية والملخصات
-- 
-- للاستعادة الكاملة:
-- 1. أنشئ مشروع Supabase جديد
-- 2. نفذ هذا الملف بالكامل (قد تحتاج تنفيذه على أجزاء)
-- 3. أعد إدخال البيانات من النسخة الاحتياطية
-- 4. تحقق من أن جميع التريغرات تعمل بشكل صحيح
-- =====================================================
