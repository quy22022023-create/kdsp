# WEB APP BUILDER GENERIC v1.4

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
3. Bấm **Mở trình chỉnh sửa →** để chuyển sang trang con Visual Editor.
4. Chọn trang HTML entry và bấm **Mở app** nếu preview chưa tự mở.
5. Dùng **Chạy** để thao tác app như bình thường; chuyển sang **Chỉnh sửa** để chọn element.
6. Sửa chữ, màu, font, căn lề, margin/padding hoặc dịch chuyển trong Inspector.
7. Bấm nút quay lại để trở về trang chính.
8. Bấm **Kiểm tra**, sau đó **Xem Diff** và **Xuất ZIP mới**.

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

## PWA của Builder

Bản này có thêm `manifest.webmanifest` và `service-worker.js` cho chính Web App Builder.

- Cache offline chỉ áp dụng cho shell của Builder: HTML, CSS, JS, manifest và icon.
- Không cache API, Supabase hoặc source/app đang chạy trong Live Preview.
- Service Worker chỉ hoạt động khi Builder được mở qua `http://`, `https://` hoặc localhost. Nếu mở trực tiếp `index.html` bằng `file://`, Builder vẫn dùng bình thường nhưng PWA/offline cache sẽ không được kích hoạt.
- Khi cập nhật Service Worker, cần đổi `CACHE_NAME` để cache shell cũ được dọn trong lần activate kế tiếp.

---

## Bổ sung v1.2 – Mobile Visual Editor

Trên điện thoại, khu **Mở app & chỉnh trực quan** tự chuyển sang giao diện mobile:

- Toolbar gọn, không ép tất cả nút vào một hàng.
- Có **Toàn màn hình** để app preview chiếm gần toàn bộ màn hình.
- `Chạy`: sử dụng app như bình thường.
- `Chỉnh sửa`: chạm trực tiếp vào thành phần để chọn.
- Bảng thuộc tính hiện dạng **bottom sheet** với 4 tab: Nội dung, Kiểu, Bố cục, Nâng cao.
- Có Undo / Redo.
- Dịch chuyển tinh chỉnh 1 / 5 / 10 px.
- Margin và Padding có thể khóa 4 cạnh để chỉnh đồng thời.
- Căn dọc chỉ được Builder tự áp dụng khi parent là Flex/Grid, nhằm tránh phá layout.

Thanh dưới mobile có 5 lối tắt: **Nạp / Sửa / Cấu hình / Check / Xuất**.

### Preview toàn màn hình

Nút **⛶ Toàn màn hình** dùng overlay của Builder thay vì phụ thuộc hoàn toàn vào Fullscreen API của trình duyệt. Vì vậy thao tác ổn định hơn trên iPhone/iPad và vẫn giữ được toolbar chỉnh sửa.

---

## Bổ sung v1.2 – Tạo Manifest / Service Worker cho app được import

Sau khi import source, mở mục **PWA / Manifest / Service Worker**.

Builder sẽ kiểm tra app entry `index.html` và báo:

- Có/chưa có Manifest.
- Có/chưa có Service Worker.
- HTML đã link Manifest hay chưa.
- HTML đã đăng ký Service Worker hay chưa.

Nếu thiếu, có thể chọn:

- **Tạo Manifest**: tạo `manifest.webmanifest` và nối vào HTML.
- **Tạo Service Worker**: tạo `service-worker.js` và thêm đoạn đăng ký.
- **Tạo PWA cơ bản**: hoàn thiện các phần còn thiếu trong một lần.

Các trường có thể cấu hình trước khi build gồm tên app, short name, start URL, display, theme/background color và icon 192/512 nếu source đã có ảnh phù hợp.

Service Worker do Builder sinh sử dụng cache app-shell giới hạn. Nó không cache request external và không đưa API/Supabase/request động không thuộc app shell vào cache.

Mọi file/đoạn HTML được tạo đều đi qua **Validator + Diff** trước khi Export ZIP.

> Lưu ý: Service Worker chỉ hoạt động khi app được chạy qua HTTP(S), ví dụ localhost hoặc hosting HTTPS. Mở app trực tiếp bằng `file://` không kích hoạt Service Worker.

## Bổ sung v1.3 – Compact Mobile Visual Editor

- Trên điện thoại, Inspector dùng bottom sheet thấp mặc định để không che element đang sửa.
- Tab **Nội dung** giữ sheet gọn; **Kiểu / Bố cục / Nâng cao** tự mở rộng và vẫn có thể thu gọn bằng thanh kéo.
- Khi chọn element, Builder tự đưa element đó về vùng nhìn thấy an toàn trong Preview.
- Toolbar mobile rút gọn còn Chạy/Chỉnh sửa, chọn thiết bị và Toàn màn hình.
- Undo / Redo / Reset nằm ngay trên header Inspector.
- Bottom navigation tạm ẩn khi Inspector đang mở để tăng không gian chỉnh sửa.
- Selector và thông tin kỹ thuật vẫn còn ở tab Nâng cao nhưng không chiếm diện tích giao diện cơ bản.


## Bổ sung v1.4 – Bố cục mới / Editor trang con / chống zoom

- Trang chính được sắp xếp lại theo một cột, tránh tình trạng các panel Cấu hình và Phát hiện tự động bị chen ngang trên điện thoại.
- **Visual Editor được tách thành trang con nội bộ `#editor`**. Source đã import vẫn giữ nguyên trong bộ nhớ; không upload và không cần nạp lại khi chuyển trang.
- Trang chính chỉ giữ các nhóm: Nạp source, mở Editor, Cấu hình app, Mapping nâng cao, PWA, Kiểm tra và Xuất.
- Phát hiện tự động / Quy tắc thủ công / Adapter-Profile được gom vào **Mapping & công cụ nâng cao**, mặc định thu gọn.
- PWA vẫn giữ status ở trang chính; phần cấu hình chi tiết mặc định thu gọn.
- Giao diện Builder dùng viewport `maximum-scale=1, user-scalable=no`, chặn gesture pinch nhiều ngón và giữ input mobile ở kích thước phù hợp để hạn chế iOS tự zoom khi focus.
- Việc khóa zoom chỉ áp dụng cho **Builder UI**. App trong Preview có zoom riêng từ **50% đến 200%** bằng `− / % / +`; chạm phần trăm để về 100%.
- Preview bridge hỗ trợ pinch hai ngón bên trong app và chuyển mức zoom về Builder, nên vẫn có thể phóng to/thu nhỏ app dù giao diện Builder bị khóa zoom.
- Nút quay lại trong Editor đưa về trang chính nhưng giữ các Visual Edit, Undo/Redo và source đang import.
- Không thay đổi database, business logic, Adapter schema hay ZIP engine.
