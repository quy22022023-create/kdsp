# QA — KDSP Giai đoạn 3 (tính đến 15/11/2026)

## Đã kiểm thử trong môi trường phát triển

- `node --check` cho `js/app.js`, `js/course-admin.js`, `js/course-content.js`, `js/course-player.js`, `sw.js`: PASS.
- `tsc --project tsconfig.check.json` cho Edge Function CMS kế thừa Giai đoạn 2: PASS.
- `tinycss2`: CSS trình học parse không lỗi; HTML kiểm tra không có ID trùng: PASS.
- Chromium chạy qua Playwright **bằng giao diện HTML inline và dữ liệu giả lập**, do môi trường chặn truy cập `http://localhost`, `https://` và `file://` trực tiếp: PASS.
- Danh mục → khóa học → chương → bài học → 13 kiểu hoạt động → tổng kết: PASS.
- Bank vocabulary theo `item_refs`: PASS.
- Bank exercise tham chiếu từ quiz: PASS.
- Ghi nhận hoàn thành 13 hoạt động bằng record `lesson:<id>`; giữ đúng ID, số lượng và trạng thái: PASS.
- Màn học cũ đọc ngân hàng công khai GitHub thay cho Supabase, không yêu cầu SDK đăng nhập: PASS.
- Giữ nguyên bản ghi tiến độ cũ khi tải học liệu: PASS.
- Thay `content_version` và `version` shard, học liệu mới hiển thị sau làm mới: PASS.
- Mất mạng **trong phiên thử nghiệm** sau khi đã tải nội dung, trình học lấy từ cache nhớ: PASS.
- Offline lần đầu không có cache: thông báo lỗi, không dựng dữ liệu giả: PASS.
- Kiểm tra HTML bị chèn trong tiêu đề/mô tả không được thực thi: PASS.
- Chặn `../` trong đường dẫn tham chiếu: PASS.
- Responsive không tràn ngang ở chiều rộng 320, 360, 390, 768, 1024 px trong Chromium: PASS.
- Mô phỏng xác thực Supabase: hợp nhất tiến độ từ xa, tiếp tục bài học và gọi đồng bộ khi hoàn thành hoạt động: PASS.
- Service Worker Node VM: cài đặt khi icon thiếu, cache shell ngoại tuyến, tách cache JSON, dọn đúng cache thuộc ứng dụng: PASS.

## Chưa được kiểm thử thực tế

- GitHub Pages thật và trạng thái publish/quyền GitHub token.
- Supabase Auth/Database/Edge Function thật với tài khoản dùng thực tế.
- IndexedDB bền vững sau tắt/mở lại Safari trên iPhone; Playwright ở đây sử dụng trang inline và cache giả lập.
- iOS Safari, bàn phím, giọng đọc TTS, ứng dụng đã cài PWA trên iPhone và Android thực tế.
- Tranh chấp ghi tiến độ khi hai tab cùng dùng đồng thời (đã giảm rủi ro bằng đọc tiến độ mới nhất trước khi ghi ở trình học mới, nhưng app flashcard cũ vẫn giữ state trong bộ nhớ).
- GitHub Pages CDN có thể chưa đồng bộ các đường dẫn ngay sau khi đổi manifest. CMS hiện xuất bản một commit và dùng query version; cần thử với CDN thực tế khi triển khai.

## Lưu ý về dữ liệu

Không chạy migration/xóa bảng. Kho `content/` chính thức vẫn chưa chứa khóa học thật. Test chỉ sử dụng dữ liệu mẫu trong thư mục kiểm thử nội bộ, không đưa vào bản đóng gói.
