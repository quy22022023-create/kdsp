# Kho học liệu KDSP

Đây là nguồn học liệu công khai chính thức của ứng dụng. Repository đang Public nên mọi file tại đây, kể cả đáp án và lời giải, đều có thể được đọc và tải xuống. Không đưa mật khẩu, token hoặc dữ liệu cá nhân vào thư mục này.

## Trạng thái ban đầu
- Chưa có khóa học hay học liệu thật; catalog và các ngân hàng đều trống.
- `manifest.json`: điểm vào kiểm tra phiên bản.
- `catalog.json`: danh mục khóa học đã xuất bản.
- `banks/index.json`: danh sách các file phân mảnh từ vựng, ngữ pháp, bài tập.
- `schemas/schema.json`: chuẩn JSON Schema.
- `templates/templates.json`: mẫu trống, không phải nội dung khóa học.

## Quy tắc
1. Mọi đường dẫn là tương đối với thư mục `content/`.
2. ID ổn định, chữ thường không dấu, chỉ dùng chữ Latin, số, `-`, `_`.
3. Không đổi ID khi sửa nội dung. Không tự sinh ID từ câu chữ khi xuất bản.
4. Khi sửa file, tăng `version` của file đó; mỗi lần xuất bản tăng `content_version` trong manifest.
5. Chỉ đưa nội dung đã duyệt vào `content/`; bản nháp không nằm trong catalog.
6. Chia dữ liệu thành file nhỏ theo cấp độ/chủ đề, không gom toàn bộ vào một JSON lớn.

## Cấu trúc dự kiến
- `courses/<course-id>/course.json`
- `courses/<course-id>/modules/<module-id>.json`
- `courses/<course-id>/lessons/<lesson-id>.json`
- `banks/vocabulary/<shard>.json`
- `banks/grammar/<shard>.json`
- `banks/exercises/<shard>.json`

Mỗi shard được khai báo trong `banks/index.json` bằng `id`, `level`, `path`, `version`, `item_count`. Cấu trúc chỉ mục được định nghĩa tại `$defs.bank_index`; mỗi file shard dùng `$defs.bank_shard` và chứa `schema_version`, `bank_type`, `level`, `items[]`.

## Tương thích với app hiện tại
Schema giữ tên trường hiện được `normalizeContent()` trong `js/app.js` sử dụng:
- Từ vựng: `id`, `level`, `topic`, `jp`, `kanji`, `romaji`, `vi`, `tag`, `mnemonic`.
- Ngữ pháp: `id`, `level`, `topic`, `pattern`, `meaning`, `structure`, `usage`, `explanation`, `examples`, `commonMistakes`.
- Bài tập: `id`, `kind`, `level`, `topic`, `refs`, `prompt_jp`, `prompt_vi`, `options`, `answer`, `explanation`.

Bài học dùng `activities[]`. Mỗi activity có `id`, `type`, `title`, `order`, `data`. Các type dự kiến: `explanation`, `vocabulary`, `kanji`, `grammar`, `tap_translate`, `matching`, `multiple_choice`, `fill_blank`, `sentence_order`, `listening`, `speaking`, `dictation`, `quiz`. Dữ liệu riêng của từng dạng nằm trong `data`.

Ví dụ:
- `tap_translate.data`: `sentence_jp`, `translation_vi`, `tokens[]` với `text`, `reading`, `meaning_vi`, tùy chọn `vocabulary_id`.
- `matching.data`: `pairs[]` gồm `left`, `right`.
- `multiple_choice.data`: `questions[]` gồm `prompt`, `options`, `answer`, `explanation`.

## Xuất bản dự kiến
Admin tạo hoặc nhập JSON → kiểm tra schema/ID/tham chiếu → xem trước → Edge Function dùng GitHub token phía máy chủ để tạo commit → app kiểm tra manifest và tải file có version mới.

Không đặt GitHub token trong JavaScript trình duyệt. CMS quản lý nội dung qua `course-admin.html`. Bản nháp được lưu riêng trong Supabase; nội dung đã xuất bản được ghi vào GitHub bằng Edge Function. Ứng dụng học sẽ được kết nối đọc các khóa học từ GitHub ở giai đoạn tích hợp tiếp theo.
