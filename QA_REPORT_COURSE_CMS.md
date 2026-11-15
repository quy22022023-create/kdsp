# QA Report — KDSP Course CMS (Giai đoạn 2)

## Kiểm tra đã thực hiện trong môi trường phát triển

- `node --check js/course-admin.js`: PASS.
- `tsc --project tsconfig.check.json` cho Edge Function với khai báo môi trường Deno tối thiểu: PASS.
- HTML audit: không có ID trùng trong `course-admin.html`.
- DOM wiring audit: tất cả ID được tham chiếu trực tiếp trong `js/course-admin.js` đều tồn tại trong `course-admin.html`.
- Cấu trúc JSON kho học liệu hiện có được giữ nguyên; CMS dùng `manifest.json`, `catalog.json`, `banks/index.json` đã tạo ở giai đoạn 1.
- `index.html` và `admin.html` dùng làm nền đã được đối chiếu SHA Git blob với repository `main` trước khi chỉnh sửa.
- Edge Function đã được sửa để đọc cùng một snapshot commit, kiểm tra `headSha` và `content_version`, và từ chối publish nếu repository đổi trong lúc soạn.
- Tạo shard ID có hash ổn định để tránh va chạm khi tên chủ đề khác nhau nhưng slug giống nhau.

## Chưa thể kiểm thử thực tế

- Chưa chạy SQL trên Supabase thật.
- Chưa deploy Edge Function lên project Supabase.
- Chưa gọi API GitHub bằng token thật từ Edge Function.
- Chưa kiểm thử luồng đăng nhập/gate/publish với tài khoản Admin thật.
- Chưa xác nhận cache PWA trên iOS Safari/Android thật.
- Chưa kết nối app học đọc nội dung khóa học từ GitHub; đây là giai đoạn kế tiếp.

## Rủi ro/giới hạn còn lại

- Các activity lưu `data` JSON theo mẫu; giao diện học cần renderer tương ứng ở giai đoạn tích hợp app.
- Nội dung xuất bản công khai theo lựa chọn của dự án, bao gồm đáp án/lời giải.
- Bản nháp lưu trong Supabase Storage private; Supabase Database chỉ lưu metadata. Vẫn nên xuất JSON dự phòng khi cần.
- Upload và deploy chưa thực hiện; đây là gói mã nguồn để cập nhật một lần sau khi hoàn tất toàn bộ các giai đoạn.

## Cập nhật kiến trúc sau rà soát

- Đưa payload bản nháp khỏi Database JSONB sang Supabase Storage private; chỉ giữ metadata trong bảng `j_content_drafts`.
- Edge Function bỏ ghi blob cho file học liệu không đổi: giữ nguyên version và timestamp; tránh tải lại nội dung khi chỉ một bài được sửa.

- Service Worker dùng network-first, tăng cache version lên v9; tệp icon không tồn tại không còn khiến việc cài bản mới thất bại.
- Mã ID nội dung mới có bộ đếm để giảm rủi ro trùng nếu thêm nhiều mục trong cùng mili giây.

## Offline Edge Function test

- Mô phỏng Supabase Auth, kiểm tra quyền Admin, Supabase Storage private và GitHub API: PASS.
- Xuất bản lần đầu: 7 Git blobs; sửa một bài: 5 Git blobs (không ghi lại bank không đổi).
- Từ chối phát hành không có thay đổi, token không hợp lệ, tài khoản không phải Admin và workspace lỗi phiên bản: PASS.
- Kiểm thử browser tự động bị môi trường chặn truy cập file/local HTTP; chưa tuyên bố đạt kiểm thử giao diện trên trình duyệt thật.

- Service Worker mô phỏng: PASS — icon thiếu không chặn install, network-first cho manifest, fallback offline, chỉ dọn cache mang tiền tố của ứng dụng.
