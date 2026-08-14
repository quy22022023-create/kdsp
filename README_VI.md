# WEB APP BUILDER GENERIC v1.0

Web app chạy hoàn toàn trong trình duyệt để cấu hình lại source của các app web khác mà không cần server.

## Mục tiêu

- Đọc app chỉ có 3 file `index.html`, `script.js`, `style.css`.
- Cũng đọc được nhiều file, cả thư mục hoặc ZIP.
- Tự phát hiện các giá trị phổ biến: tên app, tên ngắn, version, build ID, Supabase Project URL, Supabase publishable/anon key.
- Cho phép bật/tắt từng mapping trước khi sửa.
- Có Manual Mapping cho source viết khác chuẩn.
- Lưu Profile/Adapter để dùng lại lần sau.
- Xuất ZIP mới ngay trong trình duyệt.
- Giữ nguyên file ảnh/icon/binary.
- Quét một số secret nguy hiểm trước khi export.

## Cách dùng nhanh với app 3 file

1. Mở `index.html` của Builder bằng Chrome/Edge/Safari mới.
2. Bấm **Chọn file / ZIP** và chọn cùng lúc `index.html`, `script.js`, `style.css` của app cần sửa.
3. Builder tự quét.
4. Kiểm tra các mục trong **Phát hiện tự động**.
5. Nhập tên app/version/URL database/key mới.
6. Bấm **Xem thay đổi**.
7. Bấm **Kiểm tra**.
8. Bấm **Xuất ZIP mới**.

## Auto Detect hiện hỗ trợ

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
- Nhập **đúng chuỗi hiện tại** cần thay.
- Chọn trường sẽ thay vào (Tên app, Version, URL, Key...) hoặc **Giá trị tùy chỉnh**.

Builder dùng exact replacement, không tự đoán regex khi manual mapping.

## Adapter

Adapter là JSON mô tả mapping đã xác nhận. Có thể:

- Lưu profile trong `localStorage` của trình duyệt.
- Export adapter JSON để lưu cùng source.
- Import adapter về sau.

Adapter không phải code app và không cần đưa lên hosting.

## Bảo mật

Builder được thiết kế cho **public frontend config**. Supabase Project URL và publishable/anon key là dữ liệu phía client.

Không nên đưa vào web source:

- Supabase secret key / `sb_secret_...`
- `service_role`
- VAPID private key
- Cron secret
- private API tokens

Builder có scanner cơ bản để cảnh báo các trường hợp này, nhưng scanner không thay thế review bảo mật.

## ZIP

Builder có ZIP reader/writer tích hợp, không cần thư viện CDN.

- Export ZIP dùng phương thức STORE (không nén) để tối đa tương thích và không phụ thuộc thư viện ngoài. File ZIP sẽ lớn hơn source gốc nhưng dữ liệu không thay đổi.
- Import ZIP hỗ trợ STORE và DEFLATE nếu trình duyệt có `DecompressionStream('deflate-raw')`.
- Nếu trình duyệt không giải nén được ZIP, hãy chọn file hoặc cả thư mục trực tiếp.

## Phạm vi v1.0

Builder không tự hiểu logic nghiệp vụ của app. Nó chỉ cấu hình/mapping các giá trị được phát hiện hoặc do người dùng khai báo. Điều này cố ý để tránh vô tình sửa tên table, endpoint nội bộ hoặc logic JavaScript.
