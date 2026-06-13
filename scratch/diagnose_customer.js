import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function main() {
  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'admin123'
  });

  if (authError) {
    console.error('Login failed:', authError.message);
    return;
  }

  // Find customer with contract 1185
  const { data: contract, error: err1 } = await supabase
    .from('Contract')
    .select('customer_id, Customer Name')
    .eq('Contract_Number', 1185)
    .maybeSingle();

  if (!contract) {
    console.log('Contract 1185 not found.');
    return;
  }

  const customerId = contract.customer_id;
  const customerName = contract['Customer Name'];
  console.log(`Customer Found: ID=${customerId}, Name=${customerName}`);

  // Fetch all contracts for this customer
  const { data: contracts } = await supabase
    .from('Contract')
    .select('*')
    .eq('customer_id', customerId);

  console.log(`\nTotal Contracts: ${contracts.length}`);
  const totalRent = contracts.reduce((sum, c) => sum + (Number(c.Total) || 0), 0);
  console.log(`Total Rent from Contracts: ${totalRent}`);

  // Fetch all payments for this customer
  const { data: payments } = await supabase
    .from('customer_payments')
    .select('*')
    .eq('customer_id', customerId);

  console.log(`\nTotal Payments records: ${payments.length}`);
  const totalPaid = payments
    .filter(p => p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  console.log(`Total Paid (receipt/account_payment/payment): ${totalPaid}`);

  // Fetch all sales invoices for this customer
  const { data: salesInvoices } = await supabase
    .from('sales_invoices')
    .select('*')
    .eq('customer_id', customerId);
  console.log(`Total Sales Invoices: ${salesInvoices?.length || 0}`);
  const totalSales = salesInvoices?.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0) || 0;
  console.log(`Total Sales Amount: ${totalSales}`);

  // Fetch all printed invoices for this customer
  const { data: printedInvoices } = await supabase
    .from('printed_invoices')
    .select('*')
    .eq('customer_id', customerId);
  console.log(`Total Printed Invoices: ${printedInvoices?.length || 0}`);
  const totalPrinted = printedInvoices?.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0) || 0;
  console.log(`Total Printed Amount: ${totalPrinted}`);

  // Fetch composite tasks
  const { data: compositeTasks } = await supabase
    .from('composite_tasks')
    .select('*')
    .eq('customer_id', customerId);
  console.log(`Total Composite Tasks: ${compositeTasks?.length || 0}`);
  const totalComposite = compositeTasks?.reduce((sum, t) => sum + (Number(t.customer_total) || 0), 0) || 0;
  console.log(`Total Composite Tasks Amount: ${totalComposite}`);

  // Fetch customer details to check linked friend company
  const { data: customer } = await supabase
    .from('customers')
    .select('linked_friend_company_id')
    .eq('id', customerId)
    .single();

  console.log(`Linked Friend Company ID: ${customer.linked_friend_company_id}`);

  // Fetch friend rentals
  if (customer.linked_friend_company_id) {
    const { data: rentals } = await supabase
      .from('friend_billboard_rentals')
      .select('*')
      .eq('friend_company_id', customer.linked_friend_company_id);

    console.log(`Total Friend Rentals in table: ${rentals?.length || 0}`);
    let rentalsSum = 0;
    rentals.forEach(r => {
      const cost = Number(r.friend_rental_cost) || Number(r.customer_rental_price) || 0;
      const used = Number(r.used_as_payment) || 0;
      const rem = cost - used;
      console.log(`Rental id=${r.id}, contract=${r.contract_number}, cost=${cost}, used=${used}, rem=${rem}`);
      if (rem > 0) rentalsSum += rem;
    });
    console.log(`Friend Rentals Sum (remaining > 0): ${rentalsSum}`);
  }
}

main();
