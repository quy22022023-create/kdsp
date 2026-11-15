# KDSP — Giai đoạn 4: vận hành học liệu, ngoại tuyến và đồng bộ tiến độ

**Ngày:** 15/11/2026. **Trạng thái:** hoàn thiện mã và kiểm thử giả lập, chưa triển khai production.

Bộ mã này là bản tích hợp cục bộ cho Giai đoạn 1–4. Không sử dụng GitHub API hay Supabase production để kiểm thử trong giai đoạn này. Không yêu cầu upload hoặc chạy SQL đến khi bàn giao cuối.

## Điểm cốt lõi

- Củng cố hệ thống tải `content/manifest.json` theo kiểu network-first, chỉ chấp nhận schema_version=1, dùng phiên bản trong `catalog`, `banks/index`, `course`, `module`, `lesson`, `shard` để đánh khóa lưu trữ `path@version` trong IndexedDB. Không trả HTML thay JSON. Nếu bản phát hành mới chưa sẵn sàng hoặc sai định dạng, giữ lại manifest hợp lệ trước đó.
- Nạp nội dung theo yêu cầu. Ngân hàng học liệu được tải giới hạn 4 shard đồng thời để giảm áp lực bộ nhớ trên iPhone. Nút **Lưu khóa học để học offline** tải các chương/bài học cùng các bank cần thiết; không tuyên bố thành công nếu IndexedDB không hoạt động.
- Tiến độ bài học dùng IndexedDB độc lập `jp_course_progress_v2`, tách `guest` và `user UUID`. Tự lưu mỗi hoạt động theo transaction `readwrite`. Trạng thái bài được tính lại theo ID hoạt động hiện hành, không tự đánh dấu hoàn thành nếu khóa học được bổ sung hoạt động mới.
- Hợp nhất các ID hoạt động đã hoàn thành khi có tiến độ trên Supabase; đồng bộ bằng các RPC `j_get_user_progress` / `j_sync_user_progress` cũ, không tạo bảng tiến độ mới. Không tự ý chuyển tiến độ guest vào một tài khoản: phải chọn thao tác nhập guest rõ ràng.
- Thêm xuất/nhập JSON tiến độ, không yêu cầu token bí mật. Nhập bản sao là thao tác hợp nhất không tự ghi đè toàn bộ dữ liệu.
- Khôi phục các tệp `js/course-content.js`, `js/course-player.js`, `course-learning.css` còn thiếu trong thư mục làm việc sau Giai đoạn 3, bảo đảm `courses.html` có các phụ thuộc tương ứng.
- Có 13 renderer hoạt động và tiến độ chỉ được ghi nhận khi hoàn tất/đã xác nhận; bỏ qua không được đánh dấu hoàn thành. TTS chỉ hoạt động khi thiết bị có hỗ trợ giọng Nhật.
- Service Worker `v12`: shell bắt buộc đầy đủ; ảnh icon là tùy chọn; chỉ xóa các cache có tiền tố ứng dụng, giữ nguyên cache khác; JSON `content/` không đi qua HTML fallback.
- Màn học cũ đọc ngân hàng GitHub độc lập với đăng nhập Supabase, không tiếp tục chép toàn bộ bank vào localStorage. Nội dung và tiến độ cũ được giữ cho đến khi có học liệu chính thức xuất bản. Cấp độ N2/N1 không bị ép về N5 trong flashcard cũ.

## Những tệp thay đổi trực tiếp ở Giai đoạn 4

- Thêm/hoàn thiện `js/course-content.js`, `js/course-progress.js`, `js/course-player.js`, `course-learning.css`.
- Sửa `courses.html`, `course-admin.html`, `js/app.js`, `sw.js`.
- Khôi phục nguyên vẹn `content/schemas/schema.json`, `content/README.md` từ bản CMS Giai đoạn 2 (không ghi đè về schema khởi tạo Giai đoạn 1).
- `config.js` trong bộ tích hợp cục bộ chứa URL và anon/public key (không phải service_role), theo cấu hình đã biết trước đó. Cần đối chiếu cấu hình thực khi đóng gói cuối.

## Không thay đổi

- Không xóa bảng Supabase hoặc dữ liệu/tiến độ.
- Không thay đổi `js/db.js`, `js/store.js` hay RPC cũ.
- Không đưa secrets GitHub hoặc Supabase service_role vào trình duyệt/repository.
- Không cập nhật dữ liệu production của `content/`.

## Công việc cho Giai đoạn 5

1. Kiểm thử tích hợp toàn bộ CMS → publish → content reader trên môi trường staging có quyền thật (nếu có); kiểm tra response và CDN eventual consistency.
2. Kiểm thử iPhone Safari thật: tồn tại IndexedDB sau reload, PWA cài đặt, quota, safe area, bàn phím, TTS.
3. Rà soát phân biệt tiến độ guest và tiến độ người dùng trong màn flashcard cũ để tránh trộn tài khoản; màn khóa học mới đã tách.
4. Kiểm thử bảo vệ dữ liệu Admin/Supabase và triển khai SQL/Edge Functions theo hướng dẫn Giai đoạn 2 khi người dùng bắt đầu cập nhật hệ thống.
5. Đóng gói đầy đủ repository thành **một ZIP cuối duy nhất**, không gửi những bản trung gian.
