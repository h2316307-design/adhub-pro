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

  // Verify the JWT token
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

  // Check if user has admin role using service role key
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
    console.log('User is not an admin:', userId);
    return { success: false, error: 'Admin access required' };
  }

  console.log('Admin access verified for user:', userId);
  return { success: true, userId };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ SECURITY: Verify authentication and admin role
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
      console.log('Access denied:', authResult.error);
      return json({ 
        success: false, 
        error: authResult.error || 'Unauthorized' 
      }, corsHeaders, 401);
    }

    console.log('Authenticated admin user:', authResult.userId);

    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }

    const action = body?.action as string | undefined;
    
    // Try to get bridge URL from database first, then fall back to env
    let bridgeBase: string | null = null;
    try {
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

    // If no bridge configured, return safe fallbacks (avoids CORS failures)
    if (!bridgeBase) {
      switch (action) {
        case "status":
          return json({ connected: false, bridgeConfigured: false }, corsHeaders);
        case "start":
          return json({
            requiresBridge: true,
            message:
              "لم يتم ضبط WHATSAPP_BRIDGE_URL. الرجاء إضافة الرابط العام للخادم المحلي.",
          }, corsHeaders);
        case "disconnect":
          return json({ success: true, message: "تمت المحاولة (بدون جسر)" }, corsHeaders);
        default:
          return json({
            success: false,
            message:
              "الخدمة قيد الإعداد. يرجى تهيئة WHATSAPP_BRIDGE_URL لاكتمال التكامل.",
          }, corsHeaders);
      }
    }

    // Normalize base URL (remove trailing slash)
    const base = bridgeBase.replace(/\/$/, "");
    console.log('Bridge URL configured');

    // Map actions to local bridge endpoints
    const routes: Record<string, { method: string; path: string }> = {
      status: { method: "GET", path: "/status" },
      start: { method: "POST", path: "/start" },
      disconnect: { method: "POST", path: "/disconnect" },
      send: { method: "POST", path: "/send" },
    };

    const target = (action && routes[action]) || { method: "POST", path: "/proxy" };
    const targetUrl = `${base}${target.path}`;
    
    // Sanitize logging - don't expose sensitive data
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
      headers: { "Content-Type": "application/json" },
    };

    if (target.method !== "GET") {
      // Forward body but remove the action field
      const { action: _a, ...rest } = body || {};
      init.body = JSON.stringify(rest);
    }

    let bridgeResp: Response;
    try {
      console.log('Attempting to connect to bridge');
      bridgeResp = await fetch(targetUrl, init);
      console.log('Bridge response status:', bridgeResp.status);
    } catch (fetchError) {
      console.error('Failed to connect to bridge');
      console.error('Error type:', (fetchError as Error).name);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'فشل الاتصال بخادم واتساب',
          message: 'تأكد من تشغيل خادم WhatsApp المحلي وأن رابط الجسر صحيح',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await bridgeResp.text();
    
    // Try to parse JSON; if not JSON, wrap raw text
    let data: unknown;
    try {
      data = JSON.parse(text);
      console.log('Response parsed successfully');
    } catch (parseError) {
      console.log('Could not parse as JSON');
      data = { raw: text };
    }

    // إذا كانت الـ response غير ناجحة، أضف معلومات مفيدة
    if (!bridgeResp.ok) {
      console.error('Bridge returned error - status:', bridgeResp.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'خطأ من خادم واتساب',
          status: bridgeResp.status,
          data: data,
        }),
        { status: bridgeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully processed request');
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("whatsapp-service error:", (error as Error).name);
    return new Response(
      JSON.stringify({ 
        error: "An internal error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
