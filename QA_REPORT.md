# KDSP — Báo cáo kiểm thử tổng thể trước bàn giao

**Bản mã:** Giai đoạn 1–5, kiểm tra cục bộ ngày 15/11/2026.  
**Trạng thái:** Đã hoàn thiện mã nguồn và kiểm thử mô phỏng; chưa triển khai GitHub/Supabase production.

## Các kiểm tra đạt

| Hạng mục | Phương pháp | Kết quả |
|---|---|---|
| JavaScript | `node --check` toàn bộ 8 module và Service Worker | PASS |
| Edge Functions | TypeScript `tsc --noEmit` với khai báo môi trường Deno/Supabase tối thiểu | PASS |
| CSS | Parse 3 stylesheet bằng `tinycss2` | PASS |
| JSON | Parse toàn bộ JSON trong `content/` | PASS |
| JSON Schema | JSON Schema Draft 2020-12 cho manifest, catalog, bank index và templates | PASS |
| HTML | Kiểm tra ID trùng và local asset references | PASS |
| Service Worker | Node VM mô phỏng install/activate/fetch/offline và cache version v13 | PASS |
| CMS Admin | Kiểm tra ID tham chiếu; Chromium mô phỏng đăng nhập/gate, tạo khóa/chương/bài/hoạt động, validation, lưu nháp và gửi yêu cầu publish | PASS |
| Trình học | Chromium Playwright inline với dữ liệu giả lập: catalog → course → module → lesson | PASS |
| Hoạt động | Tương tác mô phỏng cả 13 dạng hoạt động | PASS |
| Tiến độ khóa học | Guest/account separation, merge local/remote, backup export | PASS |
| Tiến độ ứng dụng cũ | Guest không tự động sync vào tài khoản; import guest có xác nhận; tài khoản B không bị chép sang C | PASS |
| Học liệu công khai | Đọc bank từ GitHub mock, xử lý bank rỗng và phiên bản mới | PASS |
| Dữ liệu không an toàn | Chặn path traversal; escape nội dung HTML; manifest mới lỗi giữ bản hợp lệ trước | PASS |
| Responsive | Chromium viewport 320, 360, 390, 768, 1024 px | PASS |
| Route lỗi | Hash URL mã hóa sai được đưa về catalog thay vì làm hỏng script | PASS |
| Cấu hình public | Kiểm tra JWT trong `config.js` là role `anon` và project ref khớp URL | PASS |
| App shell | 18 tài nguyên bắt buộc của Service Worker tồn tại | PASS |

## Các lỗi đã xử lý ở Giai đoạn 5

1. Tiến độ từ vựng/ngữ pháp/bài tập cũ trước đây dùng chung một local key; khi đăng nhập có thể bị trộn với tiến độ tài khoản. Đã chuyển sang khóa cục bộ theo UUID tài khoản. Khóa cũ được giữ là tiến độ khách.
2. Bổ sung thao tác nhập tiến độ khách vào tài khoản theo lựa chọn rõ ràng; không tự động chuyển và không xóa bản khách.
3. Bảo vệ luồng đồng bộ khỏi gửi tiến độ của scope đang chuyển tài khoản.
4. Bắt lỗi `decodeURIComponent` ở route hash không hợp lệ.
5. Tăng Service Worker cache version lên `v13` để nhận bản shell mới sau cập nhật.
6. Cập nhật README và hướng dẫn triển khai để phân biệt SQL cơ sở với SQL bổ sung CMS.

## Chưa thể xác nhận trong môi trường này

- Chưa gọi GitHub/GitHub Pages thật, không commit hoặc kiểm tra quyền token.
- Chưa chạy SQL trên Supabase thật và chưa deploy Edge Functions.
- Chưa thử tài khoản Admin thật, upload bản nháp thật lên Storage hoặc publish commit thật.
- Playwright dùng `page.set_content`/fixture và mock API; không xác nhận IndexedDB bền vững qua reload trong Safari thật.
- Chưa kiểm thử Service Worker thật trên iPhone/Android, PWA cài đặt, quota Safari, safe area, bàn phím ảo và TTS của từng thiết bị.
- Chưa kiểm tra GitHub Pages CDN eventual consistency trên production.

## Kết luận

Mã nguồn vượt qua các kiểm tra cú pháp, cấu trúc, mô phỏng luồng học, CMS, đồng bộ và xử lý lỗi đã nêu. Đây không phải chứng nhận production. Cần làm theo `FINAL_DEPLOYMENT_GUIDE.md`, sau đó kiểm tra các tích hợp thật trên đúng Supabase project và GitHub Pages trước khi sử dụng chính thức.
