# KDSP — Hướng dẫn bàn giao và triển khai bản hoàn chỉnh

## 1. Nội dung gói

Gói bàn giao chứa toàn bộ mã nguồn tĩnh và cấu hình triển khai của KDSP: trang học, trang quản trị tài khoản, CMS khóa học, trình học theo khóa, CSS/JS, PWA, kho `content/`, SQL và ba Supabase Edge Functions.

Giải nén ZIP. Bên trong phải thấy trực tiếp `index.html`, `admin.html`, `courses.html`, `course-admin.html`, `styles.css`, `config.js`, `js/`, `content/` và `supabase/`. Không upload thư mục bọc bên ngoài nếu ZIP được giải nén thành một thư mục có tên riêng.

## 2. Cập nhật GitHub một lần

1. Sao lưu repository hiện tại hoặc tạo một nhánh dự phòng trước khi thay thế.
2. Giải nén ZIP trên máy/thiết bị có thể chọn nhiều tệp.
3. Đưa toàn bộ nội dung bên trong ZIP vào thư mục gốc repository `quy22022023-create/kdsp`, giữ nguyên cấu trúc thư mục và ghi đè các tệp trùng tên.
4. Commit lên nhánh `main`.
5. Kiểm tra GitHub Pages đang phục vụ từ nhánh `main` và thư mục gốc `/`.

Không xóa repository hoặc tạo repository mới. Kho `content/` hiện để trống có chủ ý; không thêm dữ liệu mẫu/fixture QA vào `content/catalog.json`.

## 3. Kiểm tra cấu hình Supabase phía trình duyệt

Mở `config.js`. Hai giá trị được phép đặt ở đây:

- `SUPABASE_URL`: Project URL của đúng Supabase project.
- `SUPABASE_ANON_KEY`: anon/public key của cùng project.

Bản bàn giao có sẵn cấu hình công khai đã được kiểm tra khớp project. Nếu bạn đang dùng một Supabase project khác, thay hai giá trị bằng URL và anon/public key của project đó. Không dán service-role key, secret key hoặc GitHub token vào file này.

## 4. SQL — chỉ chạy phần còn thiếu

Nếu `supabase/schema.sql` và `supabase/username_registration.sql` đã được chạy thành công trên đúng Supabase project, không cần chạy lại.

CMS khóa học bổ sung bucket Storage riêng tư và bảng metadata bản nháp. Chạy `supabase/content_cms.sql` một lần trong Supabase SQL Editor. File có `IF NOT EXISTS`/upsert để tránh tạo trùng; vẫn nên kiểm tra kết quả trong Dashboard sau khi chạy.

Không xóa bảng, không reset database và không chạy migration trên một project khác với project URL trong `config.js`.

## 5. Secrets và Edge Functions

Trong Supabase Edge Function Secrets, cấu hình:

- `GITHUB_TOKEN`: Fine-grained token chỉ cấp quyền Contents Read and write cho repository `quy22022023-create/kdsp`.
- `GITHUB_OWNER=quy22022023-create`
- `GITHUB_REPO=kdsp`
- `GITHUB_BRANCH=main`
- `J_ADMIN_GATE_PASSWORD`: mật khẩu quản trị riêng đang sử dụng.

Supabase cung cấp các biến môi trường của project như `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` cho Edge Functions. Nếu project không tự cung cấp, cấu hình các giá trị tương ứng trong secrets. Tuyệt đối không đưa service-role key vào frontend.

Liên kết thư mục với project bằng Supabase CLI rồi deploy:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy j_register
supabase functions deploy j_admin_users
supabase functions deploy j_content_admin
```

`j_register` cho phép đăng ký username trước khi đăng nhập (`verify_jwt = false`) và tự xác nhận tài khoản ở phía máy chủ. `j_admin_users` và `j_content_admin` yêu cầu JWT, UUID trong `public.j_admins` và mật khẩu gate riêng.

## 6. Quyền Admin

Giữ nguyên tài khoản Admin hiện tại. Nếu dùng project Supabase mới và chưa cấp quyền, thêm UUID tài khoản Admin vào `public.j_admins` theo hướng dẫn trong README. Không tạo tài khoản Admin mới nếu tài khoản cũ đã có quyền.

## 7. Kiểm tra sau khi triển khai

1. Mở `index.html`: đăng nhập/đăng xuất, bảng chữ, từ vựng và ngữ pháp.
2. Mở `courses.html`: hiện danh mục trống là đúng cho đến khi có khóa học được xuất bản.
3. Mở `course-admin.html`: đăng nhập Admin, nhập mật khẩu gate, kiểm tra kho trống, tạo một khóa học thử trong bản nháp, xem trước, lưu nháp. Chỉ xuất bản khi đã sẵn sàng vì nội dung sẽ công khai.
4. Mở `admin.html`: xác nhận quản trị tài khoản cũ vẫn hoạt động.
5. Kiểm tra trên HTTPS. Service Worker/PWA không hoạt động đầy đủ khi mở trực tiếp bằng `file://`.

## 8. Lưu ý dữ liệu

- Các bảng Supabase cũ, tài khoản và tiến độ hiện tại không bị xóa bởi bản mã này.
- Tiến độ flashcard cũ trong khóa local `jp_app_progress_v1` được giữ là tiến độ khách. Khi đăng nhập, nó không tự động được gửi vào tài khoản. Người dùng có thể chọn **Tài khoản → Nhập tiến độ khách vào tài khoản**; bản khách gốc vẫn được giữ.
- Tiến độ khóa học có IndexedDB riêng và được phân tách theo guest/UUID tài khoản.
- Nội dung trong GitHub `content/` công khai, bao gồm đáp án/lời giải. Không lưu dữ liệu cá nhân hoặc bí mật trong đó.
- Nếu thay Supabase project, cần đồng bộ `config.js`, secrets, SQL và các Edge Functions về cùng một project trước khi kiểm tra.
