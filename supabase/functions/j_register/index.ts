import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const VIRTUAL_EMAIL_DOMAIN = 'accounts.japanese-learning.invalid';
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/;
const MIN_PASSWORD_BYTES = 8;
const MAX_PASSWORD_BYTES = 72;

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeUsername(value: unknown) {
  const username = String(value || '').trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Tên đăng nhập phải có 3–24 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  }
  return username;
}

function virtualEmail(username: string) {
  return `${username}@${VIRTUAL_EMAIL_DOMAIN}`;
}

async function hashIp(ip: string, secret: string) {
  const bytes = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const forwardedParts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
  const proxyObservedIp = forwardedParts.length ? forwardedParts[forwardedParts.length - 1] : '';
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || proxyObservedIp || '';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Phương thức không được hỗ trợ.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response(503, { error: 'Edge Function chưa được cấu hình đủ biến môi trường Supabase.' });
    }

    // Supabase client gửi anon key trong header apikey. Đây là kiểm tra cấu hình,
    // không thay thế xác thực người dùng; đăng ký là thao tác công khai có chủ đích.
    const apiKey = request.headers.get('apikey') || '';
    if (!apiKey || apiKey !== anonKey) {
      return response(401, { error: 'Yêu cầu đăng ký không hợp lệ.' });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4096) return response(413, { error: 'Dữ liệu đăng ký vượt quá kích thước cho phép.' });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return response(400, { error: 'Dữ liệu đăng ký không hợp lệ.' });

    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes < MIN_PASSWORD_BYTES || passwordBytes > MAX_PASSWORD_BYTES) {
      throw new Error('Mật khẩu cần dài ít nhất 8 byte và không vượt quá 72 byte.');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    // Giới hạn tốc độ tạo tài khoản theo IP, không giới hạn tổng số học viên.
    // Nếu proxy không cung cấp IP, không dùng một bucket chung gây khóa nhầm mọi người.
    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = await hashIp(clientIp, serviceRoleKey);
      const { data: allowed, error: rateLimitError } = await adminClient.rpc('j_consume_registration_attempt', {
        p_ip_hash: ipHash
      });
      if (rateLimitError) {
        console.error('j_register rate limit:', rateLimitError);
        return response(503, { error: 'Chưa cài SQL hỗ trợ đăng ký username. Hãy chạy supabase/username_registration.sql trong SQL Editor.' });
      }
      if (allowed !== true) {
        return response(429, { error: 'Bạn đã thử tạo nhiều tài khoản trong thời gian ngắn. Vui lòng đợi 15 phút rồi thử lại.' });
      }
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: virtualEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username, account_type: 'learner' }
    });

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (error.code === 'email_exists' || message.includes('already registered') || message.includes('already exists')) {
        return response(409, { error: 'Tên đăng nhập này đã được sử dụng. Hãy chọn tên khác.' });
      }
      console.error('j_register create user:', error);
      return response(400, { error: 'Không thể tạo tài khoản. Hãy kiểm tra thông tin và thử lại.' });
    }

    return response(201, {
      ok: true,
      user: {
        id: data.user.id,
        username,
        created_at: data.user.created_at
      }
    });
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : 'Thông tin đăng ký không hợp lệ.' });
  }
});
