// This endpoint is intentionally disabled (2026-10-17).
//
// Reason: it was deployed without JWT verification, is not called by the app
// (web, Android or desktop), and had no source in the repository. Login uses
// auth-username-login and the in-app AI chat uses ai-assistant.
// Do NOT re-enable without authentication.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "تم تعطيل هذه النقطة لأسباب أمنية.", disabled: true, function: "generate-billboard-tags" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
