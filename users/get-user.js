exports.handler = async (event) => {
  const user_id = event.path.match(/\/users\/(\d+)/)[1];

  try {
    const {
      rows: [user],
    } = await pool.query("SELECT id, phone FROM users WHERE id = $1", [
      user_id,
    ]);
    if (!user) return { statusCode: 404, body: "User not found" };

    const {
      rows: [profile],
    } = await pool.query(
      "SELECT full_name, pincode FROM user_profiles WHERE user_id = $1",
      [user_id]
    );

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        user_id: user.id,
        phone: user.phone,
        full_name: profile?.full_name || null,
        pincode: profile?.pincode || null,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
