import { Pool } from "pg";
import { afterEach } from "vitest";

afterEach(async () => {
  const operatorURL = process.env.AUTH_PROVIDER_SPIKE_OPERATOR_DATABASE_URL;
  if (!operatorURL) return;
  const pool = new Pool({ connectionString: operatorURL, max: 1 });
  try {
    await pool.query('DELETE FROM better_auth."rateLimit"');
  } catch {
    // Schema tests intentionally keep the candidate schema transactional.
  } finally {
    await pool.end();
  }
});
