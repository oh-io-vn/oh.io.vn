# oh.io.vn

Dự án công cụ rút gọn link miễn phí dành cho cộng đồng Việt Nam. Ưu tiên chuyển hướng trực tiếp, giao diện tối giản và vận hành gọn nhẹ bằng hạ tầng miễn phí.

**Trạng thái:** mở thử trên [oh.io.vn](https://oh.io.vn) từ ngày 17/10/2026, dùng Cloudflare Free. Đã kiểm chứng đăng nhập Google, tạo/sửa link tài khoản, chuyển hướng và thống kê trên domain thật; sao lưu mã hóa vào GitHub private và khôi phục dữ liệu production vào D1 local tách biệt đã đạt. Các giới hạn khởi đầu và cơ chế tự giảm tải được mô tả trong [OPERATIONS.md](OPERATIONS.md).

## Tài liệu

- [Yêu cầu đã thống nhất](REQUIREMENTS.md).
- [Kiến trúc và kế hoạch triển khai đề xuất](ARCHITECTURE.md).
- [Thông tin thiết lập và vận hành](SETUP.md).
- [Chạy local, phát hành, sao lưu và xử lý sự cố](OPERATIONS.md).
- [Giấy phép thành phần bên thứ ba](THIRD_PARTY_NOTICES.md).
- [Kết quả kiểm tra chức năng và responsive](QA_REPORT.md).

## Chức năng

- Tạo link không cần đăng nhập; đăng nhập Google để quản lý và xem thống kê.
- Link khách hết hạn sau 3 tháng không hoạt động; link tài khoản sau 12 tháng. Lượt truy cập hợp lệ được ghi nhận sẽ đặt lại thời hạn.
- Thống kê 30 ngày, xuất Excel, giới hạn sử dụng và xử lý lạm dụng.
- Cloudflare Workers, Static Assets, D1 và Turnstile; mã nguồn mở trên GitHub.

## Phát triển

```powershell
npm ci --legacy-peer-deps
Copy-Item .dev.vars.example .dev.vars
# Điền secret local và khởi tạo theo OPERATIONS.md.
npm run db:local
npm run dev
```

```powershell
npm run typecheck
npm test
npm run build
```

Không dùng dữ liệu hoặc khóa production để thử local. Không có thông tin đăng nhập Google mặc định hay đường dẫn bỏ qua xác thực trong ứng dụng.

## Báo cáo lạm dụng

Email nhận báo cáo: [hi@oh.io.vn](mailto:hi@oh.io.vn). Đã cấu hình chuyển tiếp và kiểm chứng nhận thư thực tế; chi tiết được ghi trong [SETUP.md](SETUP.md).

Khi gửi báo cáo, vui lòng nêu link rút gọn, lý do và bằng chứng nếu có. Không gửi mật khẩu, mã đăng nhập hoặc dữ liệu nhạy cảm không cần thiết.

## Đóng góp duy trì

Đóng góp hoàn toàn tự nguyện và không phải điều kiện sử dụng dịch vụ.

- TPBank — NGUYỄN THÀNH NHÂN.
- Số tài khoản: `0802 8329 999`.
- Alias: `thanhnhanaz`.
- [Ảnh QR do chủ dự án cung cấp](assets/donate/tpbank-vietqr.png).

## Giấy phép

Mã nguồn của dự án được phát hành theo [MIT](LICENSE). Giữ giấy phép riêng của các thành phần bên thứ ba. Thông tin tài khoản, dữ liệu link và bản sao lưu không được công khai cùng mã nguồn. Ảnh QR đóng góp là thông tin nhận đóng góp của chủ dự án, không phải mẫu thanh toán để tái sử dụng với danh tính khác.
