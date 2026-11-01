async function verifySupabaseUser(accessToken) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    accessToken.length > 8192 ||
    !supabaseUrl ||
    !anonKey
  ) {
    return null;
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
      {
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) return null;
    const user = await response.json();
    if (typeof user?.id !== "string") return null;
    return { id: user.id };
  } catch {
    return null;
  }
}

module.exports = { verifySupabaseUser };
