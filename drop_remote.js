import { execSync } from 'child_process';

const tables = [
  'inventory_items',
  'inventory_batches',
  'inventory_stock',
  'inv_sub_categories',
  'inv_brands',
  'inv_categories',
  'inv_stock_units',
  'service_records',
  'cash_transactions',
  'cash_safes',
  'clients',
  'technicians',
  'service_fees',
  'roles',
  'system_config',
  'distributors',
  'messages',
  'landing_page'
];

let remaining = [...tables];
let lastLength = remaining.length + 1;

console.log('Starting drop loop...');

while (remaining.length > 0 && remaining.length < lastLength) {
  lastLength = remaining.length;
  const nextAttempt = [];

  for (const table of remaining) {
    try {
      console.log(`Trying to drop table: ${table}`);
      execSync(`npx wrangler d1 execute cctv-fsm-db --remote --command="DROP TABLE IF EXISTS ${table};"`, { stdio: 'ignore' });
      console.log(`✅ Dropped ${table}`);
    } catch (err) {
      console.log(`❌ Failed to drop ${table} (probably FK constraint), will retry`);
      nextAttempt.push(table);
    }
  }

  remaining = nextAttempt;
}

if (remaining.length === 0) {
  console.log('✅ All tables dropped successfully!');
} else {
  console.log('❌ Could not drop some tables:', remaining);
}
