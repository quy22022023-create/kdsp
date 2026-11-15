# Nhật Ngữ — Lộ trình JLPT N5–N3

Ứng dụng web học tiếng Nhật độc lập, mobile-first, có thể chạy tĩnh trên GitHub Pages hoặc hosting HTTPS thông thường.

## 1. Thành phần

- `index.html`: ứng dụng dành cho người học.
- `admin.html`: trang quản trị tài khoản và nạp dữ liệu cũ.
- `course-admin.html`: CMS tạo khóa học, chương, bài học, hoạt động; nhập/xuất JSON, lưu nháp và xuất bản.
- `courses.html`: trình học theo khóa học, chương và bài.
- `styles.css`: giao diện responsive, ưu tiên điện thoại và iOS Safari.
- `js/app.js`: lộ trình, từ vựng, ngữ pháp, Hiragana/Katakana mở rộng, luyện tập, flashcard vuốt để đánh giá và lịch ôn.
- Bảng chữ cái gồm 46 âm cơ bản, dakuten, handakuten, âm ghép, âm ngắt và trường âm; có quiz nhìn chữ/nghe âm.
- Cài đặt giọng đọc tiếng Nhật theo thiết bị, tự ưu tiên giọng ja-JP chất lượng tốt, có thể chọn voice, tốc độ và cao độ; bảng chữ cái tự đọc khi chạm và tự phát âm trong bài nghe.
- `js/store.js`: lưu tiến độ bằng IndexedDB, có fallback localStorage.
- `js/db.js`: lớp kết nối Supabase Auth, tài khoản username không cần email thật, RPC `j_...` và Edge Function quản trị.
- `js/course-content.js`, `js/course-player.js`, `js/course-progress.js`: đọc học liệu GitHub theo version, hiển thị 13 dạng hoạt động, lưu/đồng bộ tiến độ riêng theo guest và tài khoản.
- `js/course-admin.js`: giao diện CMS gọi Edge Function `j_content_admin`.
- `content/`: kho học liệu công khai; hiện danh mục và các ngân hàng được khởi tạo trống.
- `config.js`: cấu hình Supabase phía trình duyệt.
- `supabase/schema.sql`: bảng, RLS và các RPC cần triển khai.
- `supabase/config.toml`: cấu hình Supabase CLI; mở endpoint `j_register` cho đăng ký chưa đăng nhập và bắt buộc JWT với `j_admin_users`.
- `supabase/functions/j_admin_users/index.ts`: Edge Function bảo vệ trang Admin, quản lý tài khoản học viên và mật khẩu quản trị.
- `supabase/functions/j_register/index.ts`: Edge Function đăng ký công khai bằng username/password; tạo Auth user đã xác nhận bằng service role phía máy chủ.
- `supabase/functions/j_content_admin/index.ts`: CMS backend; kiểm tra Admin + mật khẩu quản trị, lưu nháp vào Supabase Storage private và commit nội dung công khai lên GitHub.
- `supabase/content_cms.sql`: tạo bucket bản nháp riêng tư và bảng metadata.
- `supabase/username_registration.sql`: bảng và RPC `j_consume_registration_attempt` để giới hạn tốc độ đăng ký theo IP, không giới hạn tổng số học viên.
- `sw.js`, `manifest.webmanifest`, `icons/`: cache app shell, icon iOS và cài ứng dụng dạng PWA.

## 2. Cách dùng bảng chữ cái, giọng đọc và flashcard

- Trong **Bảng chữ**, chọn Hiragana hoặc Katakana, sau đó chuyển nhóm: cơ bản, dakuten, handakuten, âm ghép, âm ngắt/trường âm.
- Chạm một ô chữ để xem Romaji và ghi chú; nút **Nghe** phát âm bằng Speech Synthesis của thiết bị.
- Dùng **Nhìn chữ → chọn âm** hoặc **Nghe âm → chọn chữ** để làm 10 câu luyện tập. Ở chế độ nghe, mỗi câu tự đọc âm cần nhận diện; có nút nghe lại.
- Mở **Cài đặt giọng đọc** để chọn voice ja-JP được gợi ý, điều chỉnh tốc độ và cao độ. App ưu tiên voice Nhật có tên gợi ý giọng nữ/tự nhiên nếu thiết bị cung cấp; thiết lập được lưu trên thiết bị. Chất lượng thực tế phụ thuộc voice cài trên iPhone/Android.
- Trong phiên flashcard, chạm thẻ để lật; **vuốt phải** để ghi nhận đã nhớ và sang thẻ tiếp theo; **vuốt trái** để ghi nhận cần ôn và sang thẻ tiếp theo. Các nút Chưa nhớ/Đã nhớ vẫn được giữ để thao tác thay thế.

## 3. Chạy thử ngoại tuyến

1. Giải nén thư mục dự án.
2. Mở terminal tại thư mục này và chạy một static server, ví dụ:

   ```bash
   python -m http.server 8080
   ```

3. Mở `http://localhost:8080`.
4. Chọn **Dùng dữ liệu minh họa** để thử từ vựng, lộ trình, flashcard, luyện tập và ôn tập.

Dữ liệu minh họa chỉ nằm trong bộ nhớ phiên hiện tại, không được gửi lên Supabase và không ghi đè dữ liệu học liệu đã xuất bản.

## 4. Cấu hình Supabase

1. Tạo một Supabase project.
2. Mở SQL Editor, chạy toàn bộ `supabase/schema.sql`.
3. Mở `config.js` và thay:
   - `SUPABASE_URL` bằng Project URL.
   - `SUPABASE_ANON_KEY` bằng anon/public key.
4. Không đưa `service_role` key hoặc secret key vào `config.js`, HTML hay JavaScript trình duyệt.
5. Triển khai ứng dụng trên HTTPS hoặc localhost.

Ứng dụng chỉ tải thư viện Supabase khi có cấu hình hợp lệ; nếu chưa cấu hình hoặc mất mạng, app học vẫn chạy từ dữ liệu cache và tiến độ cục bộ. Ứng dụng dùng Supabase Auth để đăng nhập/đăng ký và các RPC sau:

- `j_get_published_content`: đọc nội dung đã xuất bản; cho phép anon và authenticated.
- `j_is_admin`: kiểm tra quyền quản trị.
- `j_import_batch`: nạp và xuất bản một đợt dữ liệu trong một giao dịch.
- `j_get_batch_history`: xem lịch sử các đợt nhập.
- `j_get_content_versions`: xem bản lưu nội dung cũ trước khi cập nhật.
- `j_restore_content_version`: khôi phục bản lưu; phiên bản hiện tại cũng được lưu trước khi phục hồi.
- `j_get_user_progress`: tải tiến độ của tài khoản hiện tại.
- `j_sync_user_progress`: đồng bộ tiến độ của tài khoản hiện tại.

Các bảng dữ liệu được bật RLS và không cấp quyền truy cập trực tiếp cho `anon`/`authenticated`; người dùng thao tác qua RPC có kiểm tra quyền.

## 5. Tài khoản học viên không cần email thật

- Người học chỉ nhìn thấy hai trường: username và mật khẩu. Username dài 3–24 ký tự, gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.
- App ánh xạ username thành địa chỉ định danh nội bộ dạng `username@accounts.japanese-learning.invalid`; địa chỉ này không phải email liên hệ và người học không cần sở hữu hộp thư.
- Đăng ký được thực hiện qua Edge Function `j_register`. Function dùng `SUPABASE_SERVICE_ROLE_KEY` ở máy chủ để tạo Supabase Auth user với `email_confirm: true`, sau đó ứng dụng tự đăng nhập bằng username và mật khẩu.
- **Không cần tắt Confirm email** trong Supabase Dashboard. Có thể giữ nguyên cấu hình Auth hiện tại.
- Không giới hạn tổng số học viên. Để chống bot tạo tài khoản hàng loạt, hệ thống chỉ giới hạn tốc độ tối đa 20 lần đăng ký trong 15 phút trên cùng một IP; đây không phải giới hạn số người học.
- Tài khoản cũ đăng ký bằng email thật vẫn có thể đăng nhập bằng email. Tài khoản username mới đăng nhập bằng username.
- Tài khoản username cũ từng được tạo trực tiếp qua `auth.signUp()` nhưng chưa xác nhận email có thể cần Admin đặt lại/xử lý riêng; function mới không tự chiếm quyền tài khoản chưa xác nhận.

### Kích hoạt đăng ký username

1. Mở Supabase → SQL Editor và chạy toàn bộ `supabase/username_registration.sql` một lần.
2. Đảm bảo `config.js` có Project URL và anon/public key chính xác.
3. Cài Supabase CLI, đăng nhập và liên kết thư mục dự án với Supabase project:

   ```bash
   supabase login
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```

4. Kiểm tra `supabase/config.toml`: `j_register` phải có `verify_jwt = false` để người chưa đăng nhập có thể đăng ký; `j_admin_users` giữ `verify_jwt = true`.
5. Deploy Edge Function đăng ký:

   ```bash
   supabase functions deploy j_register
   ```

6. Không cần đặt `service_role` key trong trình duyệt và không cần tắt Confirm email.

## 6. Cấp quyền Admin và bật lớp mật khẩu riêng

1. Sau khi deploy `j_register`, tạo tài khoản Admin bằng form đăng ký trong ứng dụng (username/password), hoặc dùng tài khoản Supabase hiện có.
2. Trong Supabase Dashboard → Authentication → Users, sao chép UUID tài khoản đó.
3. Chạy trong SQL Editor, thay UUID thật:

   ```sql
   insert into public.j_admins(user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

4. Đặt secret `J_ADMIN_GATE_PASSWORD` ở Edge Function Secrets (hoặc chạy `supabase secrets set J_ADMIN_GATE_PASSWORD="<mật-khẩu-quản-trị>"`). Dùng mật khẩu quản trị dài và khó đoán; không ghi mật khẩu thật vào `config.js`, HTML, JavaScript hoặc GitHub.
5. Deploy Edge Function quản trị:

   ```bash
   supabase functions deploy j_admin_users
   ```

   `j_register` cho phép người học tự tạo tài khoản bằng username/password. `j_admin_users` chỉ dành cho tài khoản quản trị đã được cấp UUID trong `j_admins` và có mật khẩu gate riêng.

6. Mở `admin.html`, đăng nhập bằng tài khoản đã có UUID trong `j_admins`, sau đó nhập mật khẩu quản trị riêng.

Edge Function dùng `SUPABASE_SERVICE_ROLE_KEY` ở phía máy chủ để liệt kê, tạo, khóa/mở, đặt lại mật khẩu và xóa tài khoản. Không đưa service-role key lên trình duyệt. Nếu xóa người dùng, bản ghi `j_user_progress` của người đó sẽ bị xóa theo khóa ngoại `ON DELETE CASCADE`; Admin phải xác nhận trước khi xóa.

## 7. Nạp dữ liệu nhỏ giọt

`admin.html` nhận các dạng sau:

### Mảng từ vựng

```json
[
  {
    "level": "N5",
    "topic": "Gia đình",
    "jp": "かぞく",
    "kanji": "家族",
    "romaji": "kazoku",
    "vi": "Gia đình",
    "mnemonic": "Ghi chú ghi nhớ"
  }
]
```

### Object nhiều kho

```json
{
  "vocabulary": [],
  "grammar": [],
  "exercises": []
}
```

### Tương thích dữ liệu cũ

Trang quản trị có thể đọc tệp JS xuất theo biến `VOCAB_DATA`, `GRAMMAR_DATA`, `EXERCISE_DATA`; nội dung phải là JSON hợp lệ. Không thực thi JavaScript tùy ý.

Mặc định, bản ghi trùng được bỏ qua. Chỉ bật **Cho phép cập nhật nội dung trùng** khi muốn chủ động sửa dữ liệu cũ. Trước khi ghi đè, phiên bản cũ được lưu vào `j_content_versions`; trang quản trị cho phép xem và khôi phục bản lưu. Mỗi đợt được xuất bản ngay sau khi RPC hoàn tất; nếu có lỗi SQL, toàn bộ giao dịch nhập bị rollback.

## 8. Đồng bộ tiến độ

- Tiến độ khóa học mới lưu trong IndexedDB `jp_course_progress_v2`; tiến độ từ vựng/ngữ pháp/bài tập của giao diện cũ lưu trong kho `jp_learning_app_v1`.
- Cả hai kho đều tách phạm vi `guest` và từng UUID tài khoản. Đăng nhập tài khoản A không tự đọc hoặc gửi tiến độ của khách hay tài khoản B.
- Tiến độ khóa học và tiến độ giao diện cũ đồng bộ lên Supabase qua `j_get_user_progress` / `j_sync_user_progress` khi người dùng đăng nhập và có mạng.
- Tiến độ khách cũ trong khóa `jp_app_progress_v1` được giữ nguyên và xem là dữ liệu khách. Nếu muốn chuyển vào tài khoản, mở **Tài khoản** trong ứng dụng và chủ động chọn **Nhập tiến độ khách vào tài khoản**. Thao tác này hợp nhất bản mới hơn và không xóa bản khách.
- Khi đăng xuất, ứng dụng nạp lại tiến độ khách; dữ liệu của tài khoản vừa dùng vẫn được lưu ở khóa riêng trên thiết bị và trên Supabase.
- Có thể xuất/nhập JSON dự phòng tiến độ khóa học từ trang `courses.html`. Nhập bản sao là thao tác hợp nhất, không xóa toàn bộ tiến độ hiện tại.
- Học liệu GitHub được cache theo `path@version` trong IndexedDB. Người học có thể dùng nút **Lưu khóa học để học offline** để tải trước các bài và ngân hàng được tham chiếu.

Lưu ý: xóa dữ liệu trang web/trình duyệt có thể làm mất tiến độ khách và bản cục bộ chưa đồng bộ. Nên đăng nhập để có bản đồng bộ trên Supabase và thỉnh thoảng xuất JSON dự phòng.

## 9. Triển khai GitHub Pages

Đưa toàn bộ nội dung thư mục lên repository, bật GitHub Pages cho nhánh/thư mục mong muốn và đảm bảo `index.html`, `admin.html`, `config.js`, `styles.css`, `js/`, `supabase/` nằm cùng cấp như cấu trúc này. Cấu hình Supabase Auth URL Configuration với Site URL và Redirect URLs tương ứng.

## 10. Quản lý khóa học và xuất bản GitHub

- Toàn bộ nội dung trong `content/` là công khai theo chính sách đã chọn; đáp án và lời giải cũng có thể được tải xuống.
- CMS lưu bản nháp trong bucket Supabase Storage private `kdsp-cms-drafts`; Database chỉ lưu metadata trong `j_content_drafts`.
- GitHub là nguồn học liệu đã xuất bản. Edge Function `j_content_admin` đọc snapshot commit, kiểm tra phiên bản và chỉ xuất bản khi branch chưa thay đổi kể từ lúc tải workspace.
- GitHub token, Supabase service-role key và mật khẩu quản trị chỉ đặt trong Supabase Edge Function Secrets; không đưa vào `config.js`, HTML hoặc JavaScript trình duyệt.
- `content/manifest.json` là điểm vào. Mỗi file có `version`; sau mỗi lần xuất bản, `content_version` tăng. Không sửa ID đã xuất bản nếu chỉ thay đổi nội dung.
- CMS và trình học được nối với nhau qua `manifest.json`, `catalog.json`, `banks/index.json`, `courses/` và `banks/`.

## 11. Ghi chú dữ liệu và bảo mật

- `anon/public key` được thiết kế để xuất hiện ở client; quyền thực tế được giới hạn bởi RLS và RPC.
- Không dùng service-role key ở frontend.
- Chỉ tài khoản có UUID trong `j_admins` mới gọi được RPC nhập dữ liệu, xem lịch sử và khôi phục phiên bản. CMS còn yêu cầu Edge Function `j_content_admin` và mật khẩu quản trị riêng.
- `j_sync_user_progress` chỉ ghi dữ liệu với `auth.uid()` của phiên hiện tại.
- Không chạy lại `supabase/schema.sql` nếu các bảng/RPC cơ sở đã được cài đặt. `supabase/content_cms.sql` là phần bổ sung riêng cho CMS; chỉ chạy một lần.
- Dữ liệu mẫu và fixture QA không được xuất bản vào `content/`; biên tập và kiểm chứng học liệu trước khi phát hành chính thức.
