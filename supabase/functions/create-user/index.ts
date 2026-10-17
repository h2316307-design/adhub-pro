// This endpoint is intentionally disabled (2026-10-17).
//
// Reason: it was deployed without JWT verification, is not called by the app
// (web, Android or desktop), and had no source in the repository. Account and
// password management goes through admin-set-password / auth-username-login.
// Do NOT re-enable without authentication and an admin-role check.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "تم تعطيل هذه النقطة لأسباب أمنية.", disabled: true, function: "create-user" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
