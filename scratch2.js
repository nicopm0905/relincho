const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.hgstktixwugaowmohvsh:NGibalbin34%40@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true' });
client.connect()
  .then(() => Promise.all([
    client.query('SELECT id, slug FROM "Tenant";'),
    client.query('SELECT id, name, sex, "tenantId" FROM "Horse";')
  ]))
  .then(([tenants, horses]) => {
    console.log("Tenants:", tenants.rows);
    console.log("Horses:", horses.rows);
  })
  .catch(console.error)
  .finally(() => client.end());
