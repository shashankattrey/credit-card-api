const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event) => {
  console.log("GET USER CALLED", event.queryStringParameters);

  const user_id = parseInt(event.queryStringParameters?.id || "1");

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify({
      user_id,
      phone: "+919876543210",
      full_name: "Shashank Attrey",
      pincode: "302001",
      status: "mock_success",
    }),
  };
};
