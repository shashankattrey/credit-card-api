exports.handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "POST only" };
  const user_id = parseInt(event.queryStringParameters?.id || "1");
  const { full_name, pincode } = JSON.parse(event.body || "{}");
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      status: "profile_saved",
      user_id,
      full_name,
      pincode,
    }),
  };
};
