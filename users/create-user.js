const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };

  const { phone } = JSON.parse(event.body);

  try {
    const existing = await pool.query("SELECT id FROM users WHERE phone = $1", [
      phone,
    ]);
    if (existing.rows[0]) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          user_id: existing.rows[0].id,
          phone,
          status: "existing_user",
        }),
      };
    }

    const { rows } = await pool.query(
      "INSERT INTO users (phone) VALUES ($1) RETURNING id",
      [phone]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        user_id: rows[0].id,
        phone,
        status: "new_user_created",
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
