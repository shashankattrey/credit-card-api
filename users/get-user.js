exports.handler = async (event) => {
  const user_id = parseInt(event.queryStringParameters?.id || "1");
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      user_id,
      phone: "+919876543210",
      full_name: "Shashank Attrey",
      pincode: "302001",
    }),
  };
};
