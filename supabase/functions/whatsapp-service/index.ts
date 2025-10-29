import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }

    const action = body.action as string | undefined;
    
    // Try to get bridge URL from database first, then fall back to env
    let bridgeBase: string | null = null;
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from('messaging_settings')
          .select('whatsapp_bridge_url')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        if (data?.whatsapp_bridge_url) {
          bridgeBase = data.whatsapp_bridge_url;
        }
      }
    } catch (err) {
      console.log('Failed to fetch bridge URL from database:', err);
    }
    
    // Fallback to environment variable
    if (!bridgeBase) {
      bridgeBase = Deno.env.get("WHATSAPP_BRIDGE_URL") ?? null;
    }

    // Helper for JSON responses
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: corsHeaders });

    // If no bridge configured, return safe fallbacks (avoids CORS failures)
    if (!bridgeBase) {
      switch (action) {
        case "status":
          return json({ connected: false, bridgeConfigured: false });
        case "start":
          return json({
            requiresBridge: true,
            message:
              "لم يتم ضبط WHATSAPP_BRIDGE_URL. الرجاء إضافة الرابط العام للخادم المحلي.",
          });
        case "disconnect":
          return json({ success: true, message: "تمت المحاولة (بدون جسر)" });
        default:
          return json({
            success: false,
            message:
              "الخدمة قيد الإعداد. يرجى تهيئة WHATSAPP_BRIDGE_URL لاكتمال التكامل.",
          });
      }
    }

    // Normalize base URL (remove trailing slash)
    const base = bridgeBase.replace(/\/$/, "");
    console.log('Bridge URL configured:', base);

    // Map actions to local bridge endpoints
    const routes: Record<string, { method: string; path: string }> = {
      status: { method: "GET", path: "/status" },
start: { method: "POST", path: "/start" },
      disconnect: { method: "POST", path: "/disconnect" },
      send: { method: "POST", path: "/send" },
    };

    const target = (action && routes[action]) || { method: "POST", path: "/proxy" };
    const targetUrl = `${base}${target.path}`;
    
    console.log(`Calling ${target.method} ${targetUrl}`);
    console.log('Request body:', JSON.stringify(body));

    const init: RequestInit = {
      method: target.method,
      headers: { "Content-Type": "application/json" },
    };

    if (target.method !== "GET") {
      // Forward body but remove the action field
      const { action: _a, ...rest } = body || {};
      init.body = JSON.stringify(rest);
      console.log('Forwarding body:', init.body);
    }

    let bridgeResp: Response;
    try {
      console.log('Attempting to connect to bridge...');
      bridgeResp = await fetch(targetUrl, init);
      console.log('Bridge response status:', bridgeResp.status);
    } catch (fetchError) {
      console.error('Failed to connect to bridge:', fetchError);
      console.error('Error details:', {
        name: (fetchError as Error).name,
        message: (fetchError as Error).message,
        stack: (fetchError as Error).stack
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'فشل الاتصال بخادم واتساب',
          message: 'تأكد من تشغيل خادم WhatsApp المحلي وأن رابط الجسر صحيح',
          details: (fetchError as Error).message,
          bridgeUrl: base
        }),
        { status: 503, headers: corsHeaders }
      );
    }

    const text = await bridgeResp.text();
    console.log('Bridge response text:', text);

    // Try to parse JSON; if not JSON, wrap raw text
    let data: unknown;
    try {
      data = JSON.parse(text);
      console.log('Parsed response data:', data);
    } catch (parseError) {
      console.log('Could not parse as JSON, returning raw text');
      data = { raw: text };
    }

    // إذا كانت الـ response غير ناجحة، أضف معلومات مفيدة
    if (!bridgeResp.ok) {
      console.error('Bridge returned error:', {
        status: bridgeResp.status,
        data: data
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'خطأ من خادم واتساب',
          status: bridgeResp.status,
          data: data,
          bridgeUrl: base
        }),
        { status: bridgeResp.status, headers: corsHeaders }
      );
    }

    console.log('Successfully processed request');
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("whatsapp-service error:", error);
    console.error('Error stack:', (error as Error).stack);
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || "Unknown error",
        stack: (error as Error).stack,
        name: (error as Error).name
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});