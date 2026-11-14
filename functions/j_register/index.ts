import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const VIRTUAL_EMAIL_DOMAIN = 'accounts.japanese-learning.invalid';
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/;
const MIN_PASSWORD_LENGTH = 8;

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

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

async function requireLearnerTarget(adminClient: ReturnType<typeof createClient>, targetId: string, callerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) throw new Error('Mã tài khoản không hợp lệ.');
  if (targetId === callerId) throw new Error('Không thể thay đổi hoặc xóa chính tài khoản quản trị đang đăng nhập.');
  const { data, error } = await adminClient
    .from('j_admins')
    .select('user_id')
    .eq('user_id', targetId)
    .maybeSingle();
  if (error) throw error;
  if (data) throw new Error('Tài khoản quản trị được bảo vệ, không thể thao tác từ danh sách học viên.');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Phương thức không được hỗ trợ.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const gateSecret = Deno.env.get('J_ADMIN_GATE_PASSWORD') || '';
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response(503, { error: 'Edge Function chưa được cấu hình đủ biến môi trường Supabase.' });
    }
    if (!gateSecret) return response(503, { error: 'Chưa đặt secret J_ADMIN_GATE_PASSWORD cho Edge Function.' });

    const authorization = request.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) return response(401, { error: 'Bạn cần đăng nhập tài khoản quản trị.' });

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    const caller = authData?.user;
    if (authError || !caller) return response(401, { error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data: adminRecord, error: adminError } = await adminClient
      .from('j_admins')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!adminRecord) return response(403, { error: 'Tài khoản này không có quyền quản trị.' });

    const body = await request.json().catch(() => ({}));
    const gatePassword = String(body.gatePassword || '');
    if (!constantTimeEqual(gatePassword, gateSecret)) {
      return response(403, { error: 'Mật khẩu quản trị không chính xác.' });
    }

    const action = String(body.action || '');
    if (action === 'verify_gate') return response(200, { ok: true });

    if (action === 'list') {
      const allUsers: any[] = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const pageUsers = data?.users || [];
        allUsers.push(...pageUsers);
        if (pageUsers.length < 1000) break;
      }
      const { data: adminRows, error: adminsError } = await adminClient.from('j_admins').select('user_id');
      if (adminsError) throw adminsError;
      const adminIds = new Set((adminRows || []).map((row: { user_id: string }) => row.user_id));
      const users = allUsers.map((user) => {
        const email = String(user.email || '');
        const isVirtual = email.toLowerCase().endsWith(`@${VIRTUAL_EMAIL_DOMAIN}`);
        const fallbackName = isVirtual ? email.slice(0, -(VIRTUAL_EMAIL_DOMAIN.length + 1)) : email;
        return {
          id: user.id,
          username: String(user.user_metadata?.username || fallbackName || 'Tài khoản'),
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          banned_until: user.banned_until || null,
          is_admin: adminIds.has(user.id),
          is_virtual: isVirtual
        };
      }).sort((a, b) => String(a.username).localeCompare(String(b.username), 'vi'));
      return response(200, { ok: true, users, total: users.length });
    }

    if (action === 'create') {
      const username = normalizeUsername(body.username);
      const password = String(body.password || '');
      if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
        throw new Error('Mật khẩu cần từ 8 đến 72 ký tự.');
      }
      const { data, error } = await adminClient.auth.admin.createUser({
        email: virtualEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, account_type: 'learner' }
      });
      if (error) throw error;
      return response(200, { ok: true, user: { id: data.user.id, username, created_at: data.user.created_at } });
    }

    const targetId = String(body.userId || '');
    await requireLearnerTarget(adminClient, targetId, caller.id);

    if (action === 'reset_password') {
      const password = String(body.password || '');
      if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
        throw new Error('Mật khẩu mới cần từ 8 đến 72 ký tự.');
      }
      const { error } = await adminClient.auth.admin.updateUserById(targetId, { password });
      if (error) throw error;
      return response(200, { ok: true });
    }

    if (action === 'set_status') {
      const disabled = Boolean(body.disabled);
      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: disabled ? '876000h' : 'none'
      });
      if (error) throw error;
      return response(200, { ok: true, disabled });
    }

    if (action === 'delete') {
      const { error } = await adminClient.auth.admin.deleteUser(targetId, false);
      if (error) throw error;
      return response(200, { ok: true, deleted: true });
    }

    return response(400, { error: 'Thao tác quản trị không hợp lệ.' });
  } catch (error) {
    console.error('j_admin_users:', error);
    return response(400, { error: error instanceof Error ? error.message : 'Đã xảy ra lỗi máy chủ.' });
  }
});
