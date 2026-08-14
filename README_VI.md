# WEB APP BUILDER GENERIC v1.1

Web app chạy hoàn toàn trong trình duyệt để import, chạy thử, chỉnh giao diện, cấu hình và xuất lại source của nhiều web app khác nhau mà không cần server.

## Mục tiêu

- Hỗ trợ tốt app tối thiểu chỉ có `index.html`, `script.js`, `style.css`.
- Đọc nhiều file, thư mục hoặc ZIP và giữ nguyên file ảnh/icon/binary.
- Mở app ngay trong Builder bằng **Live Preview Runtime**.
- Có **Run mode** để thao tác app và **Edit mode** để click trực tiếp vào thành phần trên màn hình.
- Chỉnh text, màu, font, bo góc, căn lề, margin, padding và dịch chuyển tinh chỉnh.
- Tự phát hiện tên app, tên ngắn, version, build ID, Supabase Project URL và publishable/anon key.
- Manual Mapping, Adapter/Profile, Validator, Diff và ZIP Export vẫn được giữ.
- Chạy local, ZIP reader/writer không phụ thuộc CDN.

## Cách dùng nhanh

1. Mở `index.html` của Builder bằng Chrome/Edge/Safari mới.
2. Bấm **Chọn file / ZIP** và nạp source app.
3. Ở mục **Mở app & chỉnh trực quan**, chọn file HTML entry rồi bấm **Mở app**.
4. Dùng **Chạy** để thao tác app như bình thường.
5. Chuyển sang **Chỉnh sửa**, bấm vào thành phần muốn sửa.
6. Dùng bảng bên phải để sửa chữ, màu, font, căn lề, margin/padding hoặc dịch chuyển.
7. Bấm **Xem Diff** để xem Builder sẽ thay đổi gì.
8. Bấm **Kiểm tra**.
9. Bấm **Xuất ZIP mới**.

## Visual Editor

### Chỉnh chữ

Builder ưu tiên an toàn:

- Nếu text hiển thị được xác định là một text node HTML duy nhất trong source, Builder sửa đúng nguồn đó.
- Nếu text xuất hiện nhiều nơi hoặc được tạo động từ JavaScript/API/database, Builder không replace mù.
- Có tùy chọn nâng cao **Runtime text override** cho trường hợp không xác định được nguồn duy nhất. Tùy chọn này tắt mặc định vì app có thể render lại và ghi đè text.

### Chỉnh màu và style

Các style trực quan được lưu dưới dạng CSS override có selector cụ thể và được đưa vào file HTML entry khi build. Không replace toàn project theo màu hoặc tên class.

Hỗ trợ v1.1:

- Màu chữ
- Màu nền
- Màu viền
- Cỡ chữ
- Font weight
- Border radius
- Căn trái / giữa / phải / đều
- Căn khối ngang bằng margin auto
- Margin 4 cạnh
- Padding 4 cạnh
- Dịch chuyển tinh chỉnh 1 px
- Phím mũi tên để dịch chuyển; giữ Shift để dịch 10 px
- Undo / reset từng element / xóa toàn bộ visual edits
- Desktop / Tablet / Mobile viewport

### Nguyên tắc dịch chuyển

Để hạn chế phá layout, nudge chỉ tự động hoạt động tốt với element `position: static` hoặc `relative`. Nếu element đang dùng `absolute`, `fixed` hoặc `sticky`, Builder không tự đổi cơ chế position.

## Live Preview Runtime

Preview hỗ trợ tốt static HTML/CSS/JS và app 3-file. Builder tạo Blob URL local cho asset và rewrite các đường dẫn tài nguyên phổ biến trong preview.

Các trường hợp sau có thể khác môi trường production:

- Service Worker / PWA cache
- OAuth redirect dựa vào domain/origin
- ES module có chuỗi import tương đối lồng sâu
- route/backend đặc biệt
- chức năng phụ thuộc server headers hoặc CORS production

Validator sẽ cảnh báo khi phát hiện một số trường hợp trên. ZIP xuất ra vẫn giữ source và cấu trúc app; Live Preview không thay thế bước test production đối với app phức tạp.

## Auto Detect

- `<title>...</title>`
- meta `application-name`
- JS constants thường gặp: `APP_NAME`, `APP_TITLE`, `SHORT_NAME`, `APP_SHORT_NAME`, `APP_VERSION`, `VERSION`, `APP_BUILD`, `BUILD_ID`, `BUILD`
- URL `https://xxxx.supabase.co`
- `sb_publishable_...`
- legacy Supabase anon JWT khi gán cho `SUPABASE_KEY`, `SB_KEY`, `ANON_KEY`, `SUPABASE_ANON_KEY`
- `manifest.json` / `.webmanifest`: `name`, `short_name`, `version`

## Manual Mapping

Nếu Builder không phát hiện một giá trị:

- Chọn file chứa giá trị.
- Nhập đúng chuỗi hiện tại cần thay.
- Chọn trường sẽ thay vào hoặc **Giá trị tùy chỉnh**.

Manual Mapping v1.1 vẫn dùng exact replacement để giữ tương thích ngược.

## Adapter / Profile

- Adapter JSON v1 cũ vẫn import được.
- Adapter/Profile v1.1 có thể lưu thêm visual edits.
- Profile mới dùng fingerprint có cả path, size và CRC32 của file để giảm nguy cơ nhận nhầm hai app có cùng `index.html + script.js + style.css`.
- Loader vẫn thử key profile kiểu v1 cũ để giữ tương thích.

## An toàn build

- **Legacy Global Name Sync** đã chuyển vào Nâng cao và tắt mặc định.
- File text không thay đổi không bị decode/encode lại khi export; Builder giữ nguyên bytes gốc.
- Build ID tự động được freeze khi chuẩn bị Validate/Diff/Export để Diff và ZIP không tự đổi build theo phút.
- JSON được kiểm tra lại sau replacement.
- Validator cảnh báo visual text không có source an toàn.

## Bảo mật

Builder được thiết kế cho public frontend config. Supabase Project URL và publishable/anon key là dữ liệu phía client.

Scanner v1.1 cảnh báo các mẫu nguy hiểm phổ biến như:

- `sb_secret_...`
- `SUPABASE_SERVICE_ROLE` / `SERVICE_ROLE` đi cùng JWT
- PEM private key
- `VAPID_PRIVATE_KEY`
- `PRIVATE_KEY`
- `CRON_SECRET` / `*_CRON_SECRET`
- `SECRET_KEY` / `*_SECRET_KEY`

Không hard-code scanner riêng cho OT Pro.

## ZIP

ZIP reader/writer tích hợp, không cần CDN.

- Export dùng STORE để tối đa tương thích và chạy offline.
- Import hỗ trợ STORE và DEFLATE nếu trình duyệt có `DecompressionStream('deflate-raw')`.
- Nếu trình duyệt không giải nén được một ZIP cụ thể, có thể chọn file/thư mục trực tiếp.

## Phạm vi v1.1

Builder không phải IDE và không tự sửa business logic, database table, Edge Function, storage, auth logic hoặc tên function nội bộ. Visual Editor tập trung vào những gì người dùng nhìn thấy và tạo thay đổi có target rõ ràng.
