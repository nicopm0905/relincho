const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.hgstktixwugaowmohvsh:NGibalbin34%40@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true' });
client.connect()
  .then(() => client.query('SELECT id, name, sex FROM "Horse";'))
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => client.end());
