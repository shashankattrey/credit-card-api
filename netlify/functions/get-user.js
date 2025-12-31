const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event) => {
  // Fix path parsing - get user_id from /api/get-user/123
  const pathMatch = event.path.match(/get-user\/(\d+)/);
  if (!pathMatch) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid user ID in path" }),
    };
  }

  const user_id = parseInt(pathMatch[1]);

  try {
    const userRes = await pool.query(
      "SELECT id, phone FROM users WHERE id = $1",
      [user_id]
    );
    if (userRes.rows.length === 0) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    const user = userRes.rows[0];
    const profileRes = await pool.query(
      "SELECT full_name, pincode FROM user_profiles WHERE user_id = $1",
      [user_id]
    );
    const profile = profileRes.rows[0] || { full_name: null, pincode: null };

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        user_id: user.id,
        phone: user.phone,
        full_name: profile.full_name,
        pincode: profile.pincode,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
