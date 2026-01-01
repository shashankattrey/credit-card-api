const { Pool } = require("pg");

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const {
    user_id,
    full_name,
    dob,
    employment_type,
    pincode,
    pan_number,
    bank_name,
    ifsc_code,
    account_number,
    account_type,
  } = body;

  if (!user_id) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "user_id required" }),
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      `
      UPDATE user_profiles 
      SET 
        full_name = $2, dob = $3, employment_type = $4, pincode = $5,
        pan_number = $6, bank_name = $7, ifsc_code = $8,
        account_number = $9, account_type = $10,
        kyc_status = CASE 
          WHEN $6 IS NOT NULL AND $7 IS NOT NULL AND $8 IS NOT NULL 
          AND $9 IS NOT NULL AND $10 IS NOT NULL 
          THEN 'completed' ELSE 'pending' 
        END,
        kyc_completed = CASE 
          WHEN $6 IS NOT NULL AND $7 IS NOT NULL AND $8 IS NOT NULL 
          AND $9 IS NOT NULL AND $10 IS NOT NULL 
          THEN 't' ELSE 'f' 
        END,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING user_id, full_name, kyc_status, kyc_completed, 
                pan_number, bank_name, account_number, account_type, pincode
    `,
      [
        user_id,
        full_name || null,
        dob || null,
        employment_type || null,
        pincode || null,
        pan_number || null,
        bank_name || null,
        ifsc_code || null,
        account_number || null,
        account_type || null,
      ]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        profile: result.rows[0] || {},
        kyc_complete: result.rows[0]?.kyc_status === "completed",
      }),
    };
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await pool.end();
  }
};
