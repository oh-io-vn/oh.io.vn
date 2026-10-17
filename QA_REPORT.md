# Kiểm tra chức năng và giao diện oh.io.vn

Ngày kiểm tra: 17/10/2026. Bản sửa đã triển khai lên https://oh.io.vn. Báo cáo phân biệt production, Worker local với dữ liệu giả và phép đo bố cục trong khung trình duyệt.

## Những lỗi đã sửa

1. Mã link dài làm trang quản lý và thống kê tràn ngang. Mã 64 ký tự từng làm khung rộng 390 px có nội dung rộng 604 px; sau sửa các kích thước bên dưới không còn tràn.
2. Điều hướng tài khoản, nút dài và số thống kê lớn không phù hợp màn hình hẹp. Cho xuống dòng, xếp thống kê một cột, tăng vùng bấm, giữ chữ nút Đóng nguyên vẹn.
3. Hộp thoại trên màn hình thấp khó cuộn/đóng. Giới hạn theo viewport động, giữ đầu hộp có nút Đóng, cuộn nội dung và khóa cuộn trang nền. Khung 320 × 390 có hộp thống kê cao 357 px, nội dung cuộn được.
4. Sao chép thất bại ở dashboard ghi vào vùng thông báo không tồn tại; clipboard không phản hồi có thể làm thao tác treo. Đã sửa vị trí báo lỗi và thêm timeout.
5. Lỗi xóa/xuất Excel hiện phía sau hộp thoại. Đã thêm vùng báo lỗi trong từng hộp, ngăn gửi lưu/xóa lặp và ngăn đóng giữa lúc lưu.
6. Phản hồi thống kê cũ có thể đi kèm link khác khi thao tác nhanh; dữ liệu xuất có thể đổi trong lúc tải thư viện. Chỉ dùng phản hồi mới nhất và chụp dữ liệu/mã link trước khi xuất.
7. Tìm kiếm chậm có thể đè kết quả mới; không tìm thấy lại báo chưa có link nào. Đã phân biệt trạng thái và bỏ phản hồi cũ.
8. Lỗi mạng, phản hồi HTML từ hạ tầng và đăng xuất thất bại thiếu phản hồi rõ. Đã giới hạn thời gian yêu cầu, chuẩn hóa thông báo tiếng Việt và thêm vùng báo lỗi chung.
9. Link đang được bảo toàn do hoãn hết hạn vẫn bị ẩn nút sửa. Đã xét trạng thái hoạt động, hoãn hết hạn và hạn cố định khi hiển thị nút.
10. API thống kê báo ghi dữ liệu khi giảm tải tự động đã tắt ghi. Đã tính ngưỡng tự động trong trường enabled.
11. Mã index xung đột Static Assets: /index chuyển về trang chủ. Đã giữ mã này cho hệ thống, thêm kiểm thử; production chưa có link dùng mã đó.

## Ma trận responsive

Chrome chạy bản build thật trong iframe cùng origin; API qua Worker/D1 local, tài khoản và dữ liệu giả. Scrollbar cổ điển làm viewport nội dung nhỏ hơn khung 15 px trong một số trường hợp. Không coi đây là thiết bị di động thật hoặc Safari.

| Trang | 320 px | 360 px | 390 px | 768 px | 1280 px |
| --- | --- | --- | --- | --- | --- |
| Trang chủ có tài khoản | Đạt | Đạt | Đạt | Đạt | Đạt |
| Link của tôi, mã dài | Đạt | Đạt | Đạt | Đạt | Đạt |
| Quản trị | Đạt | Đạt | Đạt | Đạt | Đạt |
| Về dự án | Đạt | Đạt | Đạt | Đạt | Đạt |
| Quyền riêng tư | Đạt | Đạt | Đạt | Đạt | Đạt |
| Quy định | Đạt | Đạt | Đạt | Đạt | Đạt |
| Báo cáo link | Đạt | Đạt | Đạt | Đạt | Đạt |

Đạt nghĩa là scrollWidth không vượt clientWidth. Kiểm tra thêm hộp sửa, thống kê, xác nhận xóa/hủy và đóng góp ở 320 × 390; mã/tên dài, tổng 1.234.579 lượt, nút đóng, cuộn dọc và ảnh QR nằm trong khung. Trường nhập ở breakpoint mobile dùng 16 px; các nút điều hướng/thao tác cao tối thiểu 44 px.

## Chức năng và bằng chứng

| Luồng | Kết quả |
| --- | --- |
| Trang công khai/riêng | Production: 7 trang trả 200, dashboard/admin có noindex, nofollow; sitemap chỉ chứa trang công khai. |
| Google login/logout | Đã thao tác thành công trên production; đăng xuất về giao diện khách. |
| Link khách | Bản cuối production tạo eg9568us sau khi đăng xuất, không cần tài khoản; thời hạn 3 tháng. |
| Link tài khoản | Production: tạo huong-dan, sửa target sang repository#readme và tên ghi nhớ; 302 đúng đích, hạn không hoạt động 12 tháng. |
| Tìm và sao chép | Production: tìm đúng mã, tìm không thấy có thông báo riêng; nút sao chép phản hồi Đã sao chép. |
| Thống kê/Excel | Production: lượt thử Referer Zalo và User-Agent điện thoại vào đúng nhóm, xuất Excel. Local: workbook mã dài có đúng nguồn/số liệu và không ô công thức. Đây là lượt thử, không phải người dùng thật. |
| Sửa/hạn cố định | UI local khung thấp: URL nội bộ bị từ chối trong hộp; target/tên/hạn hợp lệ lưu được và hộp đóng. |
| Xóa/mã không cấp lại | API Worker local: xóa link thử, ngừng redirect, từ chối tạo lại cùng mã. UI kiểm tra mở xác nhận và hủy; không xóa link thật của chủ dự án. |
| Quản trị | API Worker local: thêm/gỡ domain chặn, từ chối đích bị chặn, tắt/khôi phục thống kê; redirect vẫn chạy khi thống kê tắt. |
| Quyền riêng tư | Production: API link/thống kê không đăng nhập trả 401, admin trả 403, no-store. Bộ kiểm thử kiểm tra quyền sở hữu, CSRF, quota và sự cố. |
| Đóng góp/liên hệ | Hộp QR mở/đóng/cuộn được, ảnh gốc giữ đúng SHA-256; email hi@oh.io.vn. Không giao dịch hoặc gửi email trong đợt QA này. |

## Kiểm tra mã và giới hạn

- 54 ca đạt: 53 Vitest và 1 kiểm tra mã hóa backup bằng Node; typecheck, build production và git diff --check đạt.
- Không thêm thư viện, icon hoặc emoji. Mã không chứa các giá trị secret đang cấu hình; dữ liệu thử và ảnh giao diện nằm trong .local/ được Git bỏ qua.
- Chưa thử trên Android/iPhone hoặc Safari thật, bàn phím ảo thật, trình đọc màn hình hoặc mạng di động yếu. Khung thấp kiểm tra co/cuộn, không chứng minh mọi hành vi bàn phím/thanh địa chỉ của iOS/Android.
- Không stress test production, không nới quota để phục vụ kiểm thử.
- Sau các lượt thử, mạng kiểm tra đã dùng 3/3 lượt tạo khách trong 24 giờ; một lượt khôi phục khoảng 19:07 ngày 18/10/2026 (giờ Việt Nam). Đây là giới hạn đã chốt, không phải lỗi Turnstile. Hạn mức tài khoản và toàn dịch vụ vẫn hoạt động độc lập.
