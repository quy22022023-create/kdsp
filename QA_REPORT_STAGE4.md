# QA — KDSP Giai đoạn 4 (15/11/2026)

## Các phép thử đã chạy

| Hạng mục | Phương pháp | Kết quả |
| --- | --- | --- |
| Cú pháp JavaScript | `node --check` toàn bộ JS và Service Worker | PASS |
| Cú pháp CSS | `tinycss2` trên toàn bộ 3 CSS | PASS |
| Cú pháp JSON | Python JSON parser trên toàn bộ content JSON | PASS |
| HTML | BeautifulSoup kiểm tra ID trùng và đường dẫn local asset | PASS |
| Luồng khóa → chương → bài | Chromium Playwright, HTML inline + fetch giả lập | PASS |
| 13 hoạt động | Chromium click/tap giả lập từng loại | PASS |
| Ghi tiến độ khi hoàn thành | Giả lập trong Chromium, guest memory | PASS |
| Tách tiến độ guest/user A/user B | Mô phỏng scope | PASS |
| Xuất bản sao tiến độ | Mô phỏng in-memory | PASS |
| Hợp nhất và đồng bộ tiến độ Supabase | RPC mock; kiểm tra ID union và payload | PASS |
| Offline sau khi tải trong phiên | Mô phỏng mất mạng, cache trong memory | PASS |
| Manifest bản mới bị lỗi | Mô phỏng HTML thay JSON, fallback manifest trước | PASS |
| Path traversal | Thử 6 đường dẫn không an toàn | PASS |
| Làm mới content_version | Test manifest/catalog version mới | PASS |
| Tích hợp màn từ vựng cũ | Chromium HTML inline + bank N5 | PASS |
| Nội dung đã xuất bản rỗng | Bank index mới rỗng, màn cũ reset nội dung | PASS |
| SW optional icons / required shell / JSON bypass | Node VM với cache/fetch giả lập | PASS |
| Responsive | Chromium viewport 320/360/390/768/1024px | PASS |

## Chưa kiểm thử trong môi trường này

- Không thể chạy điều hướng `http://`, `https://`, `file://` trực tiếp trong Chromium do chính sách môi trường; Playwright dùng `page.set_content` (nguồn `about:blank`, origin opaque). Do đó **IndexedDB bền vững qua reload chưa kiểm chứng**; bài test offline chỉ kiểm tra cache nhớ trong một phiên.
- Service Worker được kiểm thử bằng Node VM, **chưa kiểm thử đăng ký/hoạt động thực tế trong trình duyệt khi offline**.
- Không gọi GitHub/GitHub Pages thật, không chạy SQL, không deploy/test Edge Function CMS hoặc Supabase production theo yêu cầu người dùng.
- Không kiểm thử trên thiết bị iPhone/Android thật; Safari private mode/quota và giọng Nhật chỉ phân tích/giả lập.
- Chưa xác nhận trạng thái xung đột nhiều tab/tài khoản thật khi RPC Supabase đồng bộ đồng thời.

## Lưu ý

Đây là kết quả kiểm thử cục bộ và mô phỏng, không phải chứng nhận production. Không đưa test data vào `content/catalog.json` thật. Giai đoạn 5 sẽ rà soát toàn bộ bộ mã, bảo toàn config và đóng gói cuối một lần.
