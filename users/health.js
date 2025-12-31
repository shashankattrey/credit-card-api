exports.handler = async () => ({
  statusCode: 200,
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify({ status: "healthy ✅", api: "PaisaDekho LIVE" }),
});
