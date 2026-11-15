# KDSP — Giai đoạn 3: Kết nối kho học liệu và trình học

Tài liệu nội bộ phục vụ bản bàn giao tích hợp cuối cùng. Không cần upload riêng ở giai đoạn này.

## Kiến trúc đã triển khai

- GitHub Pages `content/`: nguồn phát hành khóa học, chương, bài, từ vựng, ngữ pháp, bài tập công khai.
- `js/course-content.js`: đọc `manifest.json` trước, kiểm tra `schema_version`, dùng `version` của từng tham chiếu để tải file JSON; lưu từng tệp theo `path@version` trong IndexedDB riêng `jp_course_assets_v1`, có dự phòng CacheStorage và bộ nhớ phiên.
- `courses.html` + `js/course-player.js` + `course-learning.css`: trình học độc lập, không can thiệp luồng học flashcard cũ. Chỉ tải chương/bài khi người học mở; hỗ trợ 13 kiểu hoạt động.
- `js/app.js`: chuyển từ lấy nội dung Supabase RPC sang kho JSON công khai cho các màn từ vựng, ngữ pháp và luyện tập N5–N3; Supabase chỉ phụ trách tài khoản và tiến độ. Không ghi thêm bản sao toàn bộ ngân hàng vào localStorage.
- `sw.js`: cache v10, bao gồm trình học mới; không cache file JSON `content/` trùng với IndexedDB. Chỉ dọn cache shell thuộc ứng dụng và không trả HTML fallback khi yêu cầu JSON.
- Tiến độ: dùng khóa cũ `jp_app_progress_v1` với record `itemType: 'lesson'` và `itemId` cố định, metadata `completedActivities`; khi đăng nhập, hợp nhất và gọi `j_sync_user_progress` hiện có qua `AppDB`.

## Hoạt động hỗ trợ

1. `explanation`: lý thuyết và văn bản định dạng đơn giản (không thực thi HTML).
2. `vocabulary`: từ vựng inline hoặc tham chiếu bank.
3. `kanji`: thẻ Kanji và cách đọc.
4. `grammar`: mẫu câu, giải thích và ví dụ.
5. `tap_translate`: chạm thành phần câu để xem nghĩa, cách đọc và nghe TTS.
6. `matching`: ghép cặp từ và nghĩa.
7. `multiple_choice`: câu hỏi trắc nghiệm.
8. `fill_blank`: chọn hoặc nhập từ còn thiếu.
9. `sentence_order`: sắp xếp các mảnh câu.
10. `listening`: nghe TTS, chọn hoặc nhập câu trả lời.
11. `speaking`: xem câu mẫu, luyện nói thủ công và tự xác nhận (không chấm phát âm tự động).
12. `dictation`: nghe rồi gõ lại.
13. `quiz`: bộ câu hỏi, hỗ trợ tham chiếu ngân hàng bài tập.

## Liên kết giao diện

`index.html` có lối vào khóa học ở trang chủ, sidebar và lộ trình. Mở `courses.html` để xem danh mục. Đường dẫn hash cho phép mở khóa/chương/bài/hoạt động và dùng Back/Forward; tên trường và ID từ CMS không bị đổi.

## Quy tắc dữ liệu và bảo toàn

- Không tạo học liệu giả trong bản triển khai chính thức. `content/catalog.json` tiếp tục trống cho đến khi quản trị viên xuất bản khóa học thật.
- ID và tiến độ cũ không thay đổi. Bản phát hành rỗng có `published_at` hợp lệ có thể loại học liệu công khai đã xóa khỏi các màn học cũ, nhưng **không xóa tiến độ người học**.
- Các cấp độ N2/N1/OTHER được đọc trong trang khóa học, nhưng không đẩy vào giao diện flashcard N5–N3 cũ để tránh bị phân loại nhầm là N5.
- Tệp JSON trong repo Public không bảo mật đáp án. Không đưa thông tin người dùng vào học liệu.
- Offline: nội dung đã tải được lưu theo phiên bản. Lần mở đầu tiên cần Internet; chưa tải bài nào thì không thể đọc bài đó khi ngoại tuyến.
- `content_version` có thể thay đổi mà không buộc tải lại các shard không đổi. Cơ chế version trong CMS phải tiếp tục tăng khi sửa file.

## Chức năng chưa xác nhận trong môi trường thực

- Không chạy thử với repository/GitHub Pages thật theo yêu cầu hiện tại.
- Không deploy Supabase Edge Function hoặc chạy SQL trong quá trình phát triển.
- Không có thiết bị iPhone/Android thật trong môi trường kiểm thử; mới thử tương tác và breakpoint trong Chromium.
- Khi bàn giao cuối cùng, cần kiểm tra cấu hình backend, quyền GitHub token, phản hồi GitHub Pages, lỗi quota iOS Safari và đồng bộ đa thiết bị.

## Tệp Giai đoạn 3

Tệp mới: `courses.html`, `course-learning.css`, `js/course-content.js`, `js/course-player.js`.
Tệp cập nhật: `index.html`, `js/app.js`, `sw.js`, `content/README.md`, `COURSE_CMS_SETUP.md`.
Không sửa các tệp xác thực `config.js`, `js/db.js`, `js/store.js`; không sửa schema tiến độ hay xóa các bảng cũ.

## Kết quả

Xem `QA_REPORT_STAGE3.md` để biết kiểm thử đã thực hiện và các hạn chế. Đây là bản mã Giai đoạn 3 lưu cục bộ để tích hợp trong ZIP bàn giao cuối, không phải một bản đã triển khai trực tuyến.
