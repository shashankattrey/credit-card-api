const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "POST only" };

  try {
    const user_id = parseInt(event.queryStringParameters?.id || "0");
    const { full_name, pincode } = JSON.parse(event.body || "{}");

    await pool.query(
      `
      INSERT INTO user_profiles (user_id, full_name, pincode) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = $2, pincode = $3
    `,
      [user_id, full_name, pincode]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "profile_saved", user_id }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
