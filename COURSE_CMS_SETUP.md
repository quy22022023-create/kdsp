# KDSP — Course CMS (Giai đoạn 2)

Trang quản trị khóa học được bổ sung tại `course-admin.html`. Trang Admin hiện tại vẫn được giữ nguyên chức năng quản lý học viên và nhập dữ liệu cũ.

## Phân chia nơi lưu dữ liệu

- GitHub `content/`: dữ liệu khóa học, chương, bài học, hoạt động, từ vựng, ngữ pháp và bài tập đã xuất bản.
- Supabase Storage private `kdsp-cms-drafts`: nội dung bản nháp; bảng `j_content_drafts` chỉ lưu ID, chủ sở hữu và trạng thái.
- Supabase Auth + `j_admins`: xác thực và quyền quản trị.
- GitHub token và Supabase service-role key: chỉ nằm trong secrets của Edge Function, tuyệt đối không đưa vào trình duyệt hoặc repository.

Theo chính sách đã chọn, toàn bộ nội dung trong `content/` là công khai. Đáp án và lời giải cũng công khai; không lưu thông tin riêng tư ở đây.

## Tệp được thêm hoặc thay đổi

- `course-admin.html`: giao diện CMS độc lập.
- `course-admin.css`: giao diện mobile-first cho CMS.
- `js/course-admin.js`: đăng nhập Admin, quản lý khóa/chương/bài/hoạt động, import/export JSON, lưu nháp, kiểm tra và xuất bản.
- `index.html`: thêm liên kết đến CMS.
- `admin.html`: thêm liên kết đến CMS, không thay thế chức năng quản trị tài khoản cũ.
- `sw.js`: tăng cache version và thêm các tệp CMS vào app shell.
- `supabase/functions/j_content_admin/index.ts`: Edge Function đọc workspace, quản lý bản nháp và commit nội dung lên GitHub.
- `supabase/content_cms.sql`: tạo bucket Storage riêng tư và bảng metadata bản nháp.
- `supabase/config.toml`: bật xác thực JWT cho Edge Function CMS.

## Triển khai sau khi hoàn tất toàn bộ dự án

1. Upload các tệp trong gói ZIP vào đúng đường dẫn tại repository, ghi đè chỉ những tệp được liệt kê trong gói.
2. Chạy `supabase/content_cms.sql` một lần trong SQL Editor để tạo bucket Storage private và bảng metadata. Không chạy lại `supabase/schema.sql` nếu schema hiện tại đã được cài đặt.
3. Trong Supabase Edge Function Secrets, cấu hình:
   - `GITHUB_TOKEN`: token chỉ có quyền đọc/ghi Contents trên repository `quy22022023-create/kdsp`.
   - `GITHUB_OWNER=quy22022023-create`
   - `GITHUB_REPO=kdsp`
   - `GITHUB_BRANCH=main`
   - `J_ADMIN_GATE_PASSWORD`: mật khẩu quản trị riêng đã dùng cho lớp bảo vệ Admin.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role key của đúng Supabase project.
4. `SUPABASE_URL` và `SUPABASE_ANON_KEY` được cung cấp trong môi trường Edge Functions của Supabase. Nếu project không tự cung cấp, cấu hình chúng trong secrets.
5. Deploy `j_content_admin` bằng Supabase CLI: `supabase functions deploy j_content_admin`.
6. Mở `course-admin.html`, đăng nhập bằng tài khoản có UUID trong `public.j_admins`, nhập mật khẩu quản trị riêng.

Không dán GitHub token, service-role key hoặc mật khẩu quản trị vào chat, HTML, JavaScript hay GitHub.

## Cách dùng CMS

1. Tạo khóa học, chọn cấp độ và nhập mô tả.
2. Chọn khóa học rồi thêm chương.
3. Chọn chương rồi thêm bài học.
4. Chọn bài học rồi thêm hoạt động. Chọn một trong các dạng: lý thuyết, từ vựng, Kanji, ngữ pháp, chạm từ để dịch, ghép đôi, trắc nghiệm, điền chỗ trống, sắp xếp câu, nghe, nói, nghe-chép hoặc quiz.
5. Dùng nút **Chèn mẫu theo dạng bài** để lấy khung JSON tương ứng, sau đó thay bằng nội dung thật.
6. Có thể nhập hàng loạt từ vựng/ngữ pháp/bài tập bằng JSON; chọn giữ hoặc cập nhật ID trùng.
7. Chạy kiểm tra toàn bộ kho, lưu bản nháp, xuất JSON dự phòng.
8. Chỉ bấm **Xuất bản lên GitHub** khi đã duyệt nội dung. CMS hiển thị xác nhận vì xuất bản sẽ công khai nội dung và xóa các file học liệu không còn được tham chiếu do thao tác xóa trong workspace.

## Dạng dữ liệu hoạt động

- `explanation`: `data.body_markdown` hoặc `data.content`.
- `vocabulary`, `kanji`, `grammar`: `data.items[]` hoặc `item_refs[]`.
- `tap_translate`: `data.sentence_jp`, `data.tokens[]` (mỗi token có `text`, `reading`, `meaning_vi`).
- `matching`: `data.pairs[]` với `left` và `right`.
- `multiple_choice`, `fill_blank`, `sentence_order`, `quiz`: `data.questions[]`.
- `listening`, `speaking`, `dictation`: `data.prompts[]`.

Các ví dụ trong nút mẫu chỉ là cấu trúc minh họa, không phải nội dung khóa học đã được biên soạn.

## Bảo vệ dữ liệu và xung đột

- Khi tải workspace, Edge Function chụp commit SHA hiện tại và đọc toàn bộ file từ cùng một commit.
- Trước khi xuất bản, function so sánh cả `content_version` và commit SHA. Nếu repository đã thay đổi trong lúc soạn, trả lỗi xung đột và không di chuyển branch.
- Commit mới dựa trên đúng commit đã tải; cập nhật ref không dùng force.
- Xóa khóa/chương/bài chỉ tác động đến bản làm việc; GitHub chỉ thay đổi sau khi xuất bản.
- Bản nháp được lọc theo `user_id`; chỉ Edge Function dùng service-role mới đọc/ghi metadata trong `j_content_drafts` và nội dung trong bucket `kdsp-cms-drafts`.

## Phạm vi chưa có trong giai đoạn này

Giai đoạn 3 đã bổ sung `courses.html`, `js/course-content.js` và `js/course-player.js` để học từ kho GitHub, đồng thời chuyển các màn học cũ N5–N3 sang ngân hàng JSON công khai. Bản CMS/Edge Function vẫn cần được deploy và cấu hình trước khi thử xuất bản thật; chi tiết xem `COURSE_STAGE3_INTEGRATION.md` và `QA_REPORT_STAGE3.md`.
