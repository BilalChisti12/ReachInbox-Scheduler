const { Client } = require('pg');

async function clearLocks() {
  const client = new Client({
    connectionString: 'postgresql://reachinbox-db_owner:npg_f2jmTUyoz0cd@ep-noisy-wind-azs02rv8.c-3.ap-southeast-1.aws.neon.tech/reachinbox-db?sslmode=require'
  });
  await client.connect();
  console.log('Connected to direct DB url.');
  
  const query = `
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE (wait_event_type = 'Lock' OR wait_event = 'advisory' OR query ILIKE '%advisory_lock%') 
    AND pid <> pg_backend_pid();
  `;
  const res = await client.query(query);
  console.log('Terminated backends:', res.rows);
  
  await client.end();
}
clearLocks().catch(console.error);
