# KDSP – Import Engine Vocabulary Master v1 / N2

## Phạm vi đã triển khai

- Admin importer nhận gói `vocabulary_master` phiên bản 1 (`schema_version`, `package_type`, `package_id`, `level`, `metadata`, `items`).
- Mỗi item kế thừa `level` từ package khi item không khai báo level riêng.
- Cho phép cấp độ N5, N4, N3, N2 ở bộ kiểm định importer.
- Giữ nguyên các trường mở rộng của Vocabulary Master trong payload JSONB (senses, examples, collocations, synonyms, antonyms, related IDs, nguồn và trạng thái duyệt).
- Thêm kiểm tra hình dạng `senses`, `examples`, `related_vocabulary_ids` và định dạng ID ở phía trình duyệt.
- Cập nhật giao diện học cũ để hiển thị/lọc N2 và không loại N2 khi nhận nội dung từ Supabase.
- Cập nhật schema JSON, templates và hướng dẫn nội dung.
- Thêm migration Supabase cho các CHECK constraint và RPC `j_import_batch` để chấp nhận N2.

## Tệp thay đổi

- `admin.html`
- `index.html`
- `js/admin.js`
- `js/app.js`
- `content/schemas/schema.json`
- `content/templates/templates.json`
- `content/README.md`
- `supabase/schema.sql`
- `supabase/migrations/20261116_enable_n2_import.sql` (mới)

## Kiểm thử thực hiện

- `node --check js/admin.js`: đạt.
- `node --check js/app.js`: đạt.
- Parse JSON `content/schemas/schema.json`: đạt.
- Parse JSON `content/templates/templates.json`: đạt.
- Kiểm tra tĩnh các điểm giới hạn cấp độ N5–N3 trong importer và giao diện học: đã chuyển sang N5–N2.
- Kiểm tra tĩnh migration: đủ 3 CHECK constraint và các kiểm tra level trong RPC cho N2.

## Chưa thể kiểm thử trong môi trường này

- Chưa kết nối Supabase thực tế, chưa chạy migration trên database của người dùng.
- Chưa kiểm thử đăng nhập/quyền admin, transaction RPC, xuất bản thực tế hoặc đồng bộ trên thiết bị.
- Chưa chạy kiểm thử UI trên iPhone/iOS Safari và Android.

## Hướng dẫn triển khai

1. Sao lưu database Supabase trước khi áp dụng migration.
2. Chạy `supabase/migrations/20261116_enable_n2_import.sql` trong Supabase SQL Editor.
3. Triển khai mã ứng dụng đã cập nhật.
4. Mở Admin, chọn gói JSON Vocabulary Master v1, kiểm tra preview và nhập một batch nhỏ thử nghiệm trước.
5. Xác nhận dữ liệu N2 xuất hiện đúng trong kho từ vựng và tiến độ cũ vẫn được giữ theo ID.

Migration không xóa bản ghi hiện có; nó thay các CHECK constraint cấp độ và cập nhật RPC import. Chỉ cho phép N5–N2 trong luồng legacy này; N1 vẫn chưa được bật trong importer legacy.
