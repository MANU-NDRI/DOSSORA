import { createClient } from 'npm:@supabase/supabase-js@2';
import { splitWhatsappMessage } from './format.ts';

type ClaimedNotification = { notification_id: string; order_id: string; message: string };
type ClaimedPart = { part_id: string; attempt_id: string; part_number: number; message: string; attempt_number: number };
type GraphResponse = { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number; error_subcode?: number } };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function getConfiguration() {
  const config = {
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    dispatchSecret: Deno.env.get('WHATSAPP_DISPATCH_SECRET') ?? '',
    accessToken: Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '',
    phoneNumberId: Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    adminPhone: (Deno.env.get('WHATSAPP_ADMIN_PHONE') ?? '').replace(/\D/g, ''),
    graphVersion: Deno.env.get('WHATSAPP_GRAPH_API_VERSION') ?? '',
    templateName: Deno.env.get('WHATSAPP_ORDER_TEMPLATE_NAME') ?? '',
    templateLanguage: Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE') ?? '',
  };
  const complete = Object.values(config).every(Boolean);
  const valid = /^\+?[1-9]\d{7,14}$/.test(Deno.env.get('WHATSAPP_ADMIN_PHONE') ?? '')
    && /^v\d+\.\d+$/.test(config.graphVersion)
    && /^[a-z0-9_]{1,128}$/.test(config.templateName)
    && /^[a-z]{2,3}_[A-Z]{2}$/.test(config.templateLanguage);
  return { ...config, ready: complete && valid };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const config = getConfiguration();
  if (!config.dispatchSecret || !secureEqual(request.headers.get('authorization') ?? '', `Bearer ${config.dispatchSecret}`)) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }
  if (!config.ready) return json({ error: 'WHATSAPP_CONFIGURATION_INCOMPLETE' }, 503);

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: notifications, error: claimError } = await supabase.rpc('claim_whatsapp_order_notifications', {
    p_admin_phone: config.adminPhone,
    p_limit: 2,
  });
  if (claimError) return json({ error: 'QUEUE_CLAIM_FAILED' }, 500);

  let acceptedParts = 0;
  for (const notification of (notifications ?? []) as ClaimedNotification[]) {
    try {
      const content = splitWhatsappMessage(notification.message);
      const numberedParts = content.map((part, index) => content.length === 1
        ? part
        : `📦 DOSSORA — commande (suite ${index + 1}/${content.length})\n${part}`);
      const { error: registerError } = await supabase.rpc('register_whatsapp_order_parts', {
        p_notification: notification.notification_id,
        p_parts: numberedParts,
      });
      if (registerError) throw new Error('PARTS_REGISTRATION_FAILED');

      const { data: parts, error: partsError } = await supabase.rpc('claim_whatsapp_order_parts', {
        p_notification: notification.notification_id,
        p_limit: 8,
      });
      if (partsError) throw new Error('PARTS_CLAIM_FAILED');

      for (const part of (parts ?? []) as ClaimedPart[]) {
        if (await sendPart(supabase, config, part)) acceptedParts += 1;
      }

      const { error: finalizeError } = await supabase.rpc('finalize_whatsapp_order_notification', {
        p_notification: notification.notification_id,
      });
      if (finalizeError) throw new Error('NOTIFICATION_FINALIZE_FAILED');
    } catch (error) {
      const safeError = error instanceof Error ? error.message : 'WHATSAPP_DISPATCH_FAILED';
      await supabase.rpc('release_whatsapp_order_notification', {
        p_notification: notification.notification_id,
        p_error: safeError.slice(0, 2000),
      });
    }
  }

  return json({ processed: (notifications ?? []).length, acceptedParts });
});

async function sendPart(
  supabase: ReturnType<typeof createClient>,
  config: ReturnType<typeof getConfiguration>,
  part: ClaimedPart,
): Promise<boolean> {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  let response: Response;
  let result: GraphResponse = {};
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.accessToken}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: config.adminPhone,
        type: 'template',
        template: {
          name: config.templateName,
          language: { code: config.templateLanguage },
          components: [{ type: 'body', parameters: [{ type: 'text', text: part.message }] }],
        },
      }),
    });
    result = await response.json().catch(() => ({})) as GraphResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'NETWORK_ERROR';
    const { error: finishError } = await supabase.rpc('finish_whatsapp_order_attempt', {
      p_attempt: part.attempt_id, p_success: false, p_error: message.slice(0, 2000), p_retryable: true,
    });
    if (finishError) throw new Error('ATTEMPT_LOG_FAILED');
    return false;
  }

  const messageId = result.messages?.[0]?.id ?? null;
  const errorMessage = result.error?.message ?? `WHATSAPP_HTTP_${response.status}`;
  const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
  const { error: finishError } = await supabase.rpc('finish_whatsapp_order_attempt', {
    p_attempt: part.attempt_id,
    p_success: response.ok && !!messageId,
    p_message_id: messageId,
    p_http_status: response.status,
    p_error: response.ok ? null : errorMessage.slice(0, 2000),
    p_retryable: retryable,
  });
  if (finishError) throw new Error('ATTEMPT_LOG_FAILED');
  return response.ok && !!messageId;
}
