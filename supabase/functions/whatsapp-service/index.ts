import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from '../_shared/cors.ts';

// Helper for JSON responses
const json = (data: unknown, corsHeaders: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Verify user is authenticated and has admin role
async function verifyAdminAccess(req: Request): Promise<{ success: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: 'Authorization header required' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims) {
    console.error('JWT verification failed:', claimsError?.message);
    return { success: false, error: 'Invalid or expired token' };
  }

  const userId = claimsData.claims.sub;
  if (!userId) {
    return { success: false, error: 'User ID not found in token' };
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (roleError) {
    console.error('Role check failed:', roleError.message);
    return { success: false, error: 'Failed to verify user role' };
  }

  if (!roleData) {
    return { success: false, error: 'Admin access required' };
  }

  return { success: true, userId };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
      return json({ success: false, error: authResult.error || 'Unauthorized' }, corsHeaders, 401);
    }

    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch (_) { body = {}; }
    }

    const action = body?.action as string | undefined;
    
    // Get bridge URL and provider from database
    let bridgeBase: string | null = null;
    let provider: string = 'wppconnect';
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from('messaging_settings')
          .select('whatsapp_bridge_url, whatsapp_provider, wppconnect_bridge_url')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        if (data) {
          provider = data.whatsapp_provider || 'wppconnect';
          
          // Select bridge URL based on provider
          if (provider === 'wppconnect' && data.wppconnect_bridge_url) {
            bridgeBase = data.wppconnect_bridge_url;
          } else if (data.whatsapp_bridge_url) {
            bridgeBase = data.whatsapp_bridge_url;
          }
        }
      }
    } catch (err) {
      console.log('Failed to fetch settings from database:', err);
    }
    
    // Fallback to environment variable
    if (!bridgeBase) {
      bridgeBase = Deno.env.get("WHATSAPP_BRIDGE_URL") ?? null;
    }

    if (!bridgeBase) {
      switch (action) {
        case "status":
          return json({ connected: false, bridgeConfigured: false, provider }, corsHeaders);
        case "start":
          return json({
            requiresBridge: true,
            message: "لم يتم ضبط رابط الجسر. الرجاء إضافة الرابط العام للخادم المحلي.",
          }, corsHeaders);
        case "disconnect":
          return json({ success: true, message: "تمت المحاولة (بدون جسر)" }, corsHeaders);
        default:
          return json({
            success: false,
            message: "الخدمة قيد الإعداد. يرجى تهيئة رابط الجسر لاكتمال التكامل.",
          }, corsHeaders);
      }
    }

    const base = bridgeBase.replace(/\/$/, "");
    console.log(`Using provider: ${provider}, bridge configured`);

    const routes: Record<string, { method: string; path: string }> = {
      status: { method: "GET", path: "/status" },
      start: { method: "POST", path: "/start" },
      disconnect: { method: "POST", path: "/disconnect" },
      send: { method: "POST", path: "/send" },
    };

    const target = (action && routes[action]) || { method: "POST", path: "/proxy" };
    const targetUrl = `${base}${target.path}`;
    
    const sanitizedBody = body ? {
      action: body?.action,
      hasPhone: !!body?.phone,
      hasMessage: !!body?.message,
      phoneLastDigits: body?.phone ? `***${body.phone.slice(-4)}` : undefined,
      messageLength: body?.message?.length
    } : {};
    
    console.log(`Calling ${target.method} ${target.path}`, sanitizedBody);

    const init: RequestInit = {
      method: target.method,
      headers: { 
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true",
      },
    };

    if (target.method !== "GET") {
      const { action: _a, ...rest } = body || {};
      init.body = JSON.stringify(rest);
    }

    let bridgeResp: Response;
    try {
      bridgeResp = await fetch(targetUrl, init);
    } catch (fetchError) {
      console.error('Failed to connect to bridge');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'فشل الاتصال بخادم واتساب',
          message: 'تأكد من تشغيل خادم WhatsApp المحلي وأن رابط الجسر صحيح',
          provider,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await bridgeResp.text();
    
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      data = { raw: text };
    }

    if (!bridgeResp.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'خطأ من خادم واتساب', status: bridgeResp.status, data, provider }),
        { status: bridgeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("whatsapp-service error:", (error as Error).name);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
