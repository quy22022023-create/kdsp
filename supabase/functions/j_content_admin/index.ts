import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const OWNER = Deno.env.get('GITHUB_OWNER') || 'quy22022023-create';
const REPO = Deno.env.get('GITHUB_REPO') || 'kdsp';
const BRANCH = Deno.env.get('GITHUB_BRANCH') || 'main';
const API = 'https://api.github.com';
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const LEVELS = new Set(['N5', 'N4', 'N3', 'N2', 'N1', 'OTHER']);
const BANK_TYPES = ['vocabulary', 'grammar', 'exercises'] as const;
const ACTIVITY_TYPES = new Set([
  'explanation', 'vocabulary', 'kanji', 'grammar', 'tap_translate', 'matching',
  'multiple_choice', 'fill_blank', 'sentence_order', 'listening', 'speaking',
  'dictation', 'quiz'
]);

type BankType = typeof BANK_TYPES[number];
type Workspace = {
  baseContentVersion: number;
  manifest: Record<string, any>;
  courses: any[];
  banks: Record<BankType, any[]>;
  currentPaths: string[];
  versions: Record<string, number>;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    mismatch |= (a[i] || 0) ^ (b[i] || 0);
  }
  return mismatch === 0;
}

function assertId(value: unknown, label: string) {
  const id = String(value || '');
  if (!ID_PATTERN.test(id)) {
    throw new Error(label + ' phải là ID chữ thường, không dấu, dài 2–64 ký tự.');
  }
  return id;
}

function safeRelativePath(value: unknown) {
  const path = String(value || '');
  if (!/^[a-z0-9_./-]+\.json$/.test(path) || path.includes('..') || path.startsWith('/')) {
    throw new Error('Đường dẫn học liệu không hợp lệ.');
  }
  return path;
}

function slug(value: unknown) {
  const result = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
  return result || 'general';
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('GITHUB_TOKEN') || '';
  if (!token) throw new Error('Thiếu secret GITHUB_TOKEN trong Supabase Edge Functions.');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', 'Bearer ' + token);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  if (init.body) headers.set('Content-Type', 'application/json');

  const result = await fetch(API + '/repos/' + OWNER + '/' + REPO + path, { ...init, headers });
  const text = await result.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { message: text };
  }

  if (!result.ok) {
    const error = new Error(String(data.message || 'GitHub API trả về lỗi HTTP ' + result.status));
    (error as any).status = result.status;
    throw error;
  }
  return data;
}

async function readJson(path: string, fallback: any = null) {
  try {
    const data = await githubRequest('/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(BRANCH));
    if (data.encoding === 'base64' && data.content) return JSON.parse(decodeBase64Utf8(data.content));
    if (data.download_url) {
      const raw = await fetch(data.download_url, { cache: 'no-store' });
      if (!raw.ok) throw new Error('Không tải được ' + path);
      return await raw.json();
    }
    throw new Error('GitHub không trả nội dung cho ' + path);
  } catch (error) {
    if ((error as any).status === 404 && fallback !== null) return fallback;
    throw error;
  }
}

function addRefVersion(versions: Record<string, number>, ref: any) {
  if (ref && typeof ref.path === 'string') {
    const relative = safeRelativePath(ref.path);
    versions['content/' + relative] = Math.max(0, Number(ref.version) || 0);
  }
}

async function loadWorkspace(): Promise<Workspace> {
  const manifest = await readJson('content/manifest.json', {
    schema_version: 1,
    content_version: 1,
    catalog: { path: 'catalog.json', version: 1 },
    banks_index: { path: 'banks/index.json', version: 1 }
  });

  const catalogPath = safeRelativePath(manifest.catalog?.path || 'catalog.json');
  const banksPath = safeRelativePath(manifest.banks_index?.path || 'banks/index.json');
  const catalog = await readJson('content/' + catalogPath, { schema_version: 1, courses: [] });
  const banksIndex = await readJson('content/' + banksPath, {
    schema_version: 1,
    vocabulary: { shards: [] },
    grammar: { shards: [] },
    exercises: { shards: [] }
  });

  const versions: Record<string, number> = {
    'content/manifest.json': Number(manifest.content_version) || 1,
    ['content/' + catalogPath]: Number(manifest.catalog?.version) || 1,
    ['content/' + banksPath]: Number(manifest.banks_index?.version) || 1
  };
  const currentPaths = new Set([
    'content/manifest.json',
    'content/' + catalogPath,
    'content/' + banksPath
  ]);
  const courses: any[] = [];

  for (const courseRef of Array.isArray(catalog.courses) ? catalog.courses : []) {
    addRefVersion(versions, courseRef);
    const coursePath = 'content/' + safeRelativePath(courseRef.path);
    currentPaths.add(coursePath);
    const course = await readJson(coursePath);
    const modules: any[] = [];

    for (const moduleRef of Array.isArray(course.module_refs) ? course.module_refs : []) {
      addRefVersion(versions, moduleRef);
      const modulePath = 'content/' + safeRelativePath(moduleRef.path);
      currentPaths.add(modulePath);
      const module = await readJson(modulePath);
      const lessons: any[] = [];

      for (const lessonRef of Array.isArray(module.lesson_refs) ? module.lesson_refs : []) {
        addRefVersion(versions, lessonRef);
        const lessonPath = 'content/' + safeRelativePath(lessonRef.path);
        currentPaths.add(lessonPath);
        lessons.push(await readJson(lessonPath));
      }
      modules.push({ module, lessons });
    }
    courses.push({ course, modules });
  }

  const banks: Record<BankType, any[]> = { vocabulary: [], grammar: [], exercises: [] };
  for (const type of BANK_TYPES) {
    const refs = Array.isArray(banksIndex[type]?.shards) ? banksIndex[type].shards : [];
    for (const ref of refs) {
      addRefVersion(versions, ref);
      const path = 'content/' + safeRelativePath(ref.path);
      currentPaths.add(path);
      const shard = await readJson(path);
      if (Array.isArray(shard.items)) banks[type].push(...shard.items);
    }
  }

  return {
    baseContentVersion: Number(manifest.content_version) || 1,
    manifest,
    courses,
    banks,
    currentPaths: Array.from(currentPaths),
    versions
  };
}

function validateWorkspace(bundle: any, current: Workspace) {
  const errors: string[] = [];
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('Gói học liệu không hợp lệ.');
  }
  if (!Array.isArray(bundle.courses)) errors.push('courses phải là mảng.');
  if (!bundle.banks || typeof bundle.banks !== 'object' || Array.isArray(bundle.banks)) {
    errors.push('banks phải là object.');
  }
  for (const type of BANK_TYPES) {
    if (bundle.banks && !Array.isArray(bundle.banks[type])) errors.push('banks.' + type + ' phải là mảng.');
  }
  if (errors.length) throw new Error('Dữ liệu chưa hợp lệ: ' + errors.join(' '));

  const courses = bundle.courses as any[];
  const banks = bundle.banks as Record<BankType, any[]>;
  const courseIds = new Set<string>();
  const slugs = new Set<string>();
  const moduleIds = new Set<string>();
  const lessonIds = new Set<string>();
  const itemIds: Record<BankType, Set<string>> = {
    vocabulary: new Set(),
    grammar: new Set(),
    exercises: new Set()
  };

  for (const type of BANK_TYPES) {
    for (const item of banks[type]) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(type + ': có mục không phải object.');
        continue;
      }
      try {
        assertId(item.id, type + '.id');
      } catch (error) {
        errors.push((error as Error).message);
        continue;
      }
      if (itemIds[type].has(item.id)) errors.push(type + ': ID trùng ' + item.id);
      itemIds[type].add(item.id);
      const level = String(item.level || 'N5').toUpperCase();
      if (!LEVELS.has(level)) errors.push(type + ': cấp độ không hợp lệ ở ' + item.id);
      if (type === 'vocabulary' && (!String(item.jp || '').trim() || !String(item.vi || '').trim())) {
        errors.push('Từ vựng ' + item.id + ' cần có jp và vi.');
      }
      if (type === 'grammar' && !String(item.pattern || '').trim()) {
        errors.push('Ngữ pháp ' + item.id + ' cần có pattern.');
      }
      if (type === 'exercises' && (!String(item.prompt_jp || item.jp || '').trim() || !String(item.answer || '').trim())) {
        errors.push('Bài tập ' + item.id + ' cần có prompt_jp và answer.');
      }
    }
  }

  for (const entry of courses) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push('Mỗi mục courses phải là object.');
      continue;
    }
    const course = entry.course && typeof entry.course === 'object' && !Array.isArray(entry.course)
      ? entry.course
      : {};
    try {
      assertId(course.id, 'course.id');
    } catch (error) {
      errors.push((error as Error).message);
    }
    if (courseIds.has(course.id)) errors.push('ID khóa học bị trùng: ' + course.id);
    courseIds.add(course.id);
    if (!/^[a-z0-9-]+$/.test(String(course.slug || ''))) errors.push('Slug khóa học không hợp lệ: ' + course.id);
    if (slugs.has(course.slug)) errors.push('Slug khóa học bị trùng: ' + course.slug);
    slugs.add(course.slug);
    if (!String(course.title || '').trim()) errors.push('Khóa học ' + course.id + ' chưa có tên.');
    if (!LEVELS.has(String(course.level || '').toUpperCase())) {
      errors.push('Khóa học ' + course.id + ' có cấp độ không hợp lệ.');
    }
    if (!Array.isArray(entry.modules)) errors.push('modules của khóa học ' + course.id + ' phải là mảng.');

    for (const moduleEntry of Array.isArray(entry.modules) ? entry.modules : []) {
      if (!moduleEntry || typeof moduleEntry !== 'object' || Array.isArray(moduleEntry)) {
        errors.push('Mỗi mục modules của khóa học ' + course.id + ' phải là object.');
        continue;
      }
      const module = moduleEntry.module && typeof moduleEntry.module === 'object' && !Array.isArray(moduleEntry.module)
        ? moduleEntry.module
        : {};
      try {
        assertId(module.id, 'module.id');
      } catch (error) {
        errors.push((error as Error).message);
      }
      if (moduleIds.has(module.id)) errors.push('ID chương bị trùng: ' + module.id);
      moduleIds.add(module.id);
      if (!String(module.title || '').trim()) errors.push('Chương ' + module.id + ' chưa có tên.');
      if (!Array.isArray(moduleEntry.lessons)) errors.push('lessons của chương ' + module.id + ' phải là mảng.');

      for (const lesson of Array.isArray(moduleEntry.lessons) ? moduleEntry.lessons : []) {
        if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
          errors.push('Mỗi mục lessons của chương ' + module.id + ' phải là object.');
          continue;
        }
        try {
          assertId(lesson.id, 'lesson.id');
        } catch (error) {
          errors.push((error as Error).message);
        }
        if (lessonIds.has(lesson.id)) errors.push('ID bài học bị trùng: ' + lesson.id);
        lessonIds.add(lesson.id);
        if (!String(lesson.title || '').trim()) errors.push('Bài học ' + lesson.id + ' chưa có tên.');
        if (!Array.isArray(lesson.activities)) errors.push('Bài học ' + lesson.id + ' phải có activities là mảng.');

        const activityIds = new Set<string>();
        for (const activity of Array.isArray(lesson.activities) ? lesson.activities : []) {
          if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
            errors.push('Mỗi activity trong bài ' + lesson.id + ' phải là object.');
            continue;
          }
          try {
            assertId(activity.id, 'activity.id');
          } catch (error) {
            errors.push((error as Error).message);
          }
          if (activityIds.has(activity.id)) {
            errors.push('ID hoạt động bị trùng trong bài ' + lesson.id + ': ' + activity.id);
          }
          activityIds.add(activity.id);
          if (!ACTIVITY_TYPES.has(String(activity.type || ''))) {
            errors.push('Dạng hoạt động chưa được hỗ trợ: ' + String(activity.type || '(trống)'));
          }
          if (!String(activity.title || '').trim()) errors.push('Hoạt động ' + activity.id + ' chưa có tiêu đề.');
          if (!activity.data || typeof activity.data !== 'object' || Array.isArray(activity.data)) {
            errors.push('data của hoạt động ' + activity.id + ' phải là object.');
          }
          for (const ref of Array.isArray(activity.item_refs) ? activity.item_refs : []) {
            if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
              errors.push('item_refs của hoạt động ' + activity.id + ' phải chứa object hợp lệ.');
              continue;
            }
            const key = ref.type === 'exercise' ? 'exercises' : ref.type;
            if (!itemIds[key as BankType] || !itemIds[key as BankType].has(ref.id)) {
              errors.push('Hoạt động ' + activity.id + ' tham chiếu học liệu không tồn tại: ' + ref.type + '/' + ref.id);
            }
          }
        }
      }
    }
  }

  const hasAnyNewContent = courses.length > 0 || BANK_TYPES.some((type) => banks[type].length > 0);
  const hasExistingContent = current.courses.length > 0 || BANK_TYPES.some((type) => current.banks[type].length > 0);
  if (!hasAnyNewContent && hasExistingContent) {
    errors.push('Từ chối xuất bản gói rỗng vì có thể xóa toàn bộ học liệu hiện tại.');
  }

  if (errors.length) {
    const error = new Error('Dữ liệu chưa hợp lệ: ' + errors.slice(0, 12).join(' '));
    (error as any).details = errors;
    throw error;
  }
}

function cleanCourse(source: any) {
  return {
    schema_version: 1,
    id: String(source.id),
    slug: String(source.slug),
    title: String(source.title).trim(),
    description: String(source.description || ''),
    level: String(source.level || 'N5').toUpperCase(),
    language: 'ja',
    target_language: 'vi',
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : 0,
    estimated_minutes: Math.max(0, Number(source.estimated_minutes) || 0),
    tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
    objectives: Array.isArray(source.objectives) ? source.objectives.map(String) : [],
    cover_image: source.cover_image || null,
    module_refs: [],
    updated_at: new Date().toISOString()
  };
}

function cleanModule(source: any, courseId: string) {
  return {
    schema_version: 1,
    id: String(source.id),
    course_id: courseId,
    title: String(source.title).trim(),
    description: String(source.description || ''),
    order: Math.max(0, Number(source.order) || 0),
    lesson_refs: [],
    updated_at: new Date().toISOString()
  };
}

function cleanLesson(source: any, courseId: string, moduleId: string) {
  const activities = (Array.isArray(source.activities) ? source.activities : []).map((activity: any, index: number) => ({
    id: String(activity.id),
    type: String(activity.type),
    title: String(activity.title).trim(),
    order: Number.isFinite(Number(activity.order)) ? Number(activity.order) : index + 1,
    instructions: String(activity.instructions || ''),
    data: activity.data && typeof activity.data === 'object' && !Array.isArray(activity.data) ? activity.data : {},
    ...(Array.isArray(activity.item_refs) ? { item_refs: activity.item_refs } : {})
  }));

  return {
    schema_version: 1,
    id: String(source.id),
    course_id: courseId,
    module_id: moduleId,
    title: String(source.title).trim(),
    description: String(source.description || ''),
    order: Math.max(0, Number(source.order) || 0),
    estimated_minutes: Math.max(0, Number(source.estimated_minutes) || 0),
    objectives: Array.isArray(source.objectives) ? source.objectives.map(String) : [],
    activities,
    updated_at: new Date().toISOString()
  };
}

async function publishWorkspace(bundle: any, current: Workspace) {
  validateWorkspace(bundle, current);
  const files = new Map<string, any>();
  const versions = current.versions || {};
  const nextVersion = (path: string) => (Number(versions[path]) || 0) + 1;
  const courseRefs: any[] = [];
  const sortedCourses = [...bundle.courses].sort(
    (a: any, b: any) => (Number(a.course?.order) || 0) - (Number(b.course?.order) || 0)
  );

  for (const entry of sortedCourses) {
    const course = cleanCourse(entry.course);
    const base = 'courses/' + course.slug;
    const moduleRefs: any[] = [];
    const sortedModules = [...(entry.modules || [])].sort(
      (a: any, b: any) => (Number(a.module?.order) || 0) - (Number(b.module?.order) || 0)
    );

    for (const moduleEntry of sortedModules) {
      const module = cleanModule(moduleEntry.module, course.id);
      const modulePath = base + '/modules/' + module.id + '.json';
      const moduleFilePath = 'content/' + modulePath;
      const lessonRefs: any[] = [];
      const sortedLessons = [...(moduleEntry.lessons || [])].sort(
        (a: any, b: any) => (Number(a.order) || 0) - (Number(b.order) || 0)
      );

      for (const lessonSource of sortedLessons) {
        const lesson = cleanLesson(lessonSource, course.id, module.id);
        const lessonPath = base + '/lessons/' + lesson.id + '.json';
        const lessonFilePath = 'content/' + lessonPath;
        const lessonVersion = nextVersion(lessonFilePath);
        lessonRefs.push({ id: lesson.id, path: lessonPath, version: lessonVersion });
        files.set(lessonFilePath, lesson);
      }

      const moduleVersion = nextVersion(moduleFilePath);
      module.lesson_refs = lessonRefs;
      moduleRefs.push({ id: module.id, path: modulePath, version: moduleVersion });
      files.set(moduleFilePath, module);
    }

    const coursePath = base + '/course.json';
    const courseFilePath = 'content/' + coursePath;
    const courseVersion = nextVersion(courseFilePath);
    course.module_refs = moduleRefs;
    courseRefs.push({ id: course.id, path: coursePath, version: courseVersion });
    files.set(courseFilePath, course);
  }

  const banksIndex: any = {
    schema_version: 1,
    vocabulary: { shards: [] },
    grammar: { shards: [] },
    exercises: { shards: [] }
  };

  for (const type of BANK_TYPES) {
    const groups = new Map<string, any[]>();
    for (const raw of Array.isArray(bundle.banks[type]) ? bundle.banks[type] : []) {
      const item = { ...raw, level: String(raw.level || 'N5').toUpperCase() };
      const key = item.level + '|' + String(item.topic || 'Tổng hợp');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const [key, items] of groups.entries()) {
      const parts = key.split('|');
      const level = parts[0];
      const topic = parts.slice(1).join('|');
      const shardId = (type + '-' + level.toLowerCase() + '-' + slug(topic)).slice(0, 64);
      const shardPath = 'banks/' + type + '/' + shardId + '.json';
      const filePath = 'content/' + shardPath;
      const version = nextVersion(filePath);
      files.set(filePath, { schema_version: 1, bank_type: type, level, items });
      banksIndex[type].shards.push({ id: shardId, level, path: shardPath, version, item_count: items.length });
    }

    banksIndex[type].shards.sort(
      (a: any, b: any) => a.level.localeCompare(b.level) || a.id.localeCompare(b.id)
    );
  }

  const nextContentVersion = (Number(current.baseContentVersion) || 1) + 1;
  const catalog = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    courses: courseRefs
  };
  const manifest = {
    ...current.manifest,
    schema_version: 1,
    content_version: nextContentVersion,
    published_at: new Date().toISOString(),
    catalog: { path: 'catalog.json', version: nextVersion('content/catalog.json') },
    banks_index: { path: 'banks/index.json', version: nextVersion('content/banks/index.json') }
  };

  files.set('content/catalog.json', catalog);
  files.set('content/banks/index.json', banksIndex);
  files.set('content/manifest.json', manifest);

  const newPaths = new Set(files.keys());
  const deletions = (current.currentPaths || []).filter((path) => !newPaths.has(path));
  const entries: any[] = [];

  for (const [path, value] of files.entries()) {
    const blob = await githubRequest('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: JSON.stringify(value, null, 2) + '\n', encoding: 'utf-8' })
    });
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  for (const path of deletions) {
    entries.push({ path, mode: '100644', type: 'blob', sha: null });
  }

  const ref = await githubRequest('/git/ref/heads/' + encodeURIComponent(BRANCH));
  const parentSha = ref.object?.sha;
  if (!parentSha) throw new Error('Không đọc được commit hiện tại của nhánh GitHub.');
  const parent = await githubRequest('/git/commits/' + parentSha);
  const tree = await githubRequest('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries })
  });
  const commit = await githubRequest('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: 'Publish learning content v' + nextContentVersion,
      tree: tree.sha,
      parents: [parentSha]
    })
  });

  // force=false prevents overwriting a newer commit pushed after the initial read.
  await githubRequest('/git/refs/heads/' + encodeURIComponent(BRANCH), {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return {
    content_version: nextContentVersion,
    commit_sha: commit.sha,
    commit_url: commit.html_url || ('https://github.com/' + OWNER + '/' + REPO + '/commit/' + commit.sha),
    course_count: courseRefs.length,
    vocabulary_count: bundle.banks.vocabulary.length,
    grammar_count: bundle.banks.grammar.length,
    exercise_count: bundle.banks.exercises.length
  };
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
      return response(503, { error: 'Edge Function thiếu cấu hình Supabase.' });
    }
    if (!gateSecret) return response(503, { error: 'Chưa đặt secret J_ADMIN_GATE_PASSWORD.' });

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
      .from('j_admins').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRecord) return response(403, { error: 'Tài khoản này không có quyền quản trị.' });

    const body = await request.json().catch(() => ({}));
    const bodyBytes = new TextEncoder().encode(JSON.stringify(body)).length;
    if (bodyBytes > 4 * 1024 * 1024) {
      return response(413, { error: 'Gói học liệu vượt quá giới hạn 4 MB.' });
    }
    if (!constantTimeEqual(String(body.gatePassword || ''), gateSecret)) {
      return response(403, { error: 'Mật khẩu quản trị không chính xác.' });
    }

    const action = String(body.action || '');
    if (action === 'load_workspace') {
      const workspace = await loadWorkspace();
      return response(200, { ok: true, workspace });
    }

    if (action === 'list_drafts') {
      const { data, error } = await adminClient.from('j_content_drafts')
        .select('id,title,status,updated_at,published_at')
        .eq('user_id', caller.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return response(200, { ok: true, drafts: data || [] });
    }

    if (action === 'get_draft') {
      const { data, error } = await adminClient.from('j_content_drafts')
        .select('id,title,payload,status,updated_at')
        .eq('id', String(body.draftId || ''))
        .eq('user_id', caller.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return response(404, { error: 'Không tìm thấy bản nháp.' });
      return response(200, { ok: true, draft: data });
    }

    if (action === 'save_draft') {
      const title = String(body.title || 'Bản nháp').trim().slice(0, 120) || 'Bản nháp';
      const payload = body.workspace;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Nội dung bản nháp không hợp lệ.');
      }

      if (body.draftId) {
        const { data: existing, error: lookupError } = await adminClient.from('j_content_drafts')
          .select('id')
          .eq('id', String(body.draftId))
          .eq('user_id', caller.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existing) {
          const { error } = await adminClient.from('j_content_drafts')
            .update({ title, payload, status: 'draft', updated_at: new Date().toISOString(), published_at: null })
            .eq('id', existing.id)
            .eq('user_id', caller.id);
          if (error) throw error;
          return response(200, { ok: true, draftId: existing.id });
        }
      }

      const { data, error } = await adminClient.from('j_content_drafts')
        .insert({ user_id: caller.id, title, payload, status: 'draft' })
        .select('id')
        .single();
      if (error) throw error;
      return response(200, { ok: true, draftId: data.id });
    }

    if (action === 'delete_draft') {
      const { error } = await adminClient.from('j_content_drafts')
        .delete()
        .eq('id', String(body.draftId || ''))
        .eq('user_id', caller.id);
      if (error) throw error;
      return response(200, { ok: true });
    }

    if (action === 'publish') {
      const bundle = body.workspace;
      const current = await loadWorkspace();
      if (Number(bundle?.baseContentVersion) !== Number(current.baseContentVersion)) {
        return response(409, {
          error: 'Kho học liệu đã thay đổi sau lần tải gần nhất. Hãy tải lại dữ liệu GitHub, kiểm tra và áp dụng lại thay đổi trước khi xuất bản.',
          currentContentVersion: current.baseContentVersion
        });
      }
      const result = await publishWorkspace(bundle, current);

      if (body.draftId) {
        const { error } = await adminClient.from('j_content_drafts')
          .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', String(body.draftId))
          .eq('user_id', caller.id);
        if (error) {
          console.error('Đã xuất bản GitHub nhưng không cập nhật được trạng thái bản nháp:', error);
        }
      }
      return response(200, { ok: true, result });
    }

    return response(400, { error: 'Thao tác CMS không hợp lệ.' });
  } catch (error) {
    console.error('j_content_admin:', error);
    const status = Number((error as any)?.status) || 400;
    return response(status, { error: error instanceof Error ? error.message : 'Đã xảy ra lỗi máy chủ.' });
  }
});
