# oh.io.vn

Dự án công cụ rút gọn link miễn phí dành cho cộng đồng Việt Nam. Ưu tiên chuyển hướng trực tiếp, giao diện tối giản và vận hành gọn nhẹ bằng hạ tầng miễn phí.

**Trạng thái:** đang chuẩn bị hạ tầng và đặc tả; chưa có ứng dụng rút gọn link được phát hành.

## Tài liệu

- [Yêu cầu đã thống nhất](REQUIREMENTS.md).
- [Kiến trúc và kế hoạch triển khai đề xuất](ARCHITECTURE.md).
- [Thông tin thiết lập và vận hành](SETUP.md).

## Phạm vi dự kiến

- Tạo link không cần đăng nhập; đăng nhập Google để quản lý và xem thống kê.
- Link khách hết hạn sau 3 tháng không hoạt động; link tài khoản sau 12 tháng. Lượt truy cập hợp lệ được ghi nhận sẽ đặt lại thời hạn.
- Thống kê 30 ngày, xuất Excel, giới hạn sử dụng và xử lý lạm dụng.
- Cloudflare Workers, Static Assets, D1 và Turnstile; mã nguồn mở trên GitHub.

## Báo cáo lạm dụng

Email dự kiến công khai: [abuse@oh.io.vn](mailto:abuse@oh.io.vn). Trạng thái kích hoạt email được ghi trong [SETUP.md](SETUP.md).

Khi gửi báo cáo, vui lòng nêu link rút gọn, lý do và bằng chứng nếu có. Không gửi mật khẩu, mã đăng nhập hoặc dữ liệu nhạy cảm không cần thiết.

## Đóng góp duy trì

Đóng góp hoàn toàn tự nguyện và không phải điều kiện sử dụng dịch vụ.

- TPBank — NGUYỄN THÀNH NHÂN.
- Số tài khoản: `0802 8329 999`.
- Alias: `thanhnhanaz`.
- [Ảnh QR do chủ dự án cung cấp](assets/donate/tpbank-vietqr.png).

## Giấy phép

Mã nguồn của dự án được phát hành theo [MIT](LICENSE). Giữ giấy phép riêng của các thành phần bên thứ ba. Thông tin tài khoản, dữ liệu link và bản sao lưu không được công khai cùng mã nguồn. Ảnh QR đóng góp là thông tin nhận đóng góp của chủ dự án, không phải mẫu thanh toán để tái sử dụng với danh tính khác.
