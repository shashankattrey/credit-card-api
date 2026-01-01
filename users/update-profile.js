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
        full_name = COALESCE($2, full_name),
        dob = COALESCE($3, dob),
        employment_type = COALESCE($4, employment_type),
        pincode = COALESCE($5, pincode),
        pan_number = COALESCE($6, pan_number),
        bank_name = COALESCE($7, bank_name),
        ifsc_code = COALESCE($8, ifsc_code),
        account_number = COALESCE($9, account_number),
        account_type = COALESCE($10, account_type),
        annual_income = COALESCE($11, annual_income),
        kyc_status = CASE 
          WHEN COALESCE($6, '') != '' 
           AND COALESCE($7, '') != '' 
           AND COALESCE($8, '') != '' 
           AND COALESCE($9, '') != '' 
           AND COALESCE($10, '') != '' 
          THEN 'completed' ELSE 'pending' 
        END,
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING user_id, full_name, kyc_status, pan_number, 
                bank_name, account_number, account_type, pincode
      `,
      [
        user_id, // $1 - bigint (PK)
        full_name || null, // $2 - varchar
        dob || null, // $3 - date
        employment_type || null, // $4 - varchar
        pincode || null, // $5 - varchar
        pan_number || null, // $6 - varchar (FIXED!)
        bank_name || null, // $7 - varchar
        ifsc_code || null, // $8 - varchar
        account_number || null, // $9 - varchar
        account_type || null, // $10 - varchar
        parseInt(body.annual_income) || null, // $11 - integer
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
