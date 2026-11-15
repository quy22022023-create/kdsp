# QA — Giai đoạn 5: rà soát tích hợp và bảo toàn dữ liệu

## Phạm vi

- Rà soát toàn bộ bộ mã Giai đoạn 1–4.
- Tách tiến độ cũ của guest và từng tài khoản.
- Giữ nguyên kho tiến độ cũ và cung cấp thao tác nhập guest có xác nhận.
- Rà soát route, Service Worker, cấu hình Supabase public và các tham chiếu asset.
- Kiểm tra cú pháp, schema, UI giả lập và các luồng quan trọng.

## Kết quả

- `js/app.js`: cú pháp PASS; test đăng nhập/đăng xuất giả lập và phân tách tài khoản PASS.
- `index.html`: thêm nút nhập tiến độ khách, giữ bản gốc khách.
- `styles.css`: bổ sung kiểu cho ghi chú nhập tiến độ.
- `js/course-player.js`: route hash lỗi được xử lý an toàn.
- `sw.js`: cache shell nâng lên v13.
- `README.md`, `FINAL_DEPLOYMENT_GUIDE.md`, `QA_REPORT.md`: cập nhật tài liệu và hướng dẫn bàn giao.
- CMS browser simulation: đăng nhập/gate, tạo khóa/chương/bài/hoạt động, validation, save draft và publish request đều PASS, không có page error.

## Kiểm thử cụ thể tiến độ giao diện cũ

1. Seed tiến độ khách trong `jp_app_progress_v1`.
2. Đăng nhập user B; xác nhận dữ liệu khách không được ghi vào khóa user B và không xuất hiện trong payload sync.
3. Chủ động bấm nhập tiến độ khách; xác nhận bản khách vẫn còn, bản account B nhận dữ liệu và payload sync có mục được nhập.
4. Đăng xuất rồi đăng nhập user C; xác nhận dữ liệu guest/user B không tự động xuất hiện trong account C.
5. Không có lỗi JavaScript runtime trong test này.

## Giới hạn

Không có kết nối GitHub, Supabase production hoặc thiết bị iPhone/Android thật trong lượt kiểm thử. IndexedDB persistent, PWA install và hành vi Safari quota cần xác nhận sau khi triển khai.
