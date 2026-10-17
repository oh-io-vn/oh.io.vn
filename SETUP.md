# Trạng thái thiết lập oh.io.vn

Cập nhật: 17/10/2026, giờ Việt Nam. Tài liệu chỉ chứa thông tin cấu hình cần thiết, không chứa token, mật khẩu hoặc dữ liệu hộp thư.

## Repository

- Repository công khai: <https://github.com/oh-io-vn/oh.io.vn>.
- Chủ sở hữu: tổ chức `oh-io-vn`.
- Giấy phép mã nguồn: MIT.
- Giai đoạn hiện tại: tài liệu yêu cầu, kiến trúc và chuẩn bị hạ tầng; chưa phát hành ứng dụng rút gọn link.

## Domain

- Domain: `oh.io.vn`.
- Nhà đăng ký: Nhân Hòa.
- Ngày hết hạn được cổng nhà đăng ký hiển thị: 17/10/2027.
- Cloudflare zone đã được thêm trên gói Free.
- Nameserver Cloudflare được cấp:
  - `emely.ns.cloudflare.com`.
  - `karl.ns.cloudflare.com`.
- Nameserver trước đó: `ns1.zonedns.vn`, `ns2.zonedns.vn`, `ns3.zonedns.vn`, `ns4.zonedns.vn`.
- Chủ dự án đã xác nhận chuyển DNS sang Cloudflare. Yêu cầu đổi nameserver đã được gửi tại Nhân Hòa; đã tải lại trang và kiểm chứng hai nameserver Cloudflare được lưu trong biểu mẫu, các ô nameserver thứ ba và thứ tư trống. Việc lưu tại nhà đăng ký chưa phải bằng chứng đã cập nhật xong tại registry/DNS công khai.
- Tại lần kiểm tra gần nhất, Cloudflare vẫn hiển thị chờ registrar cập nhật nameserver; DNS đệ quy công khai vẫn trả nameserver cũ. Không coi việc gửi yêu cầu là bằng chứng domain đã Active.
- Chưa có Worker, website hoặc bản ghi trỏ web được triển khai.

## Email báo cáo lạm dụng

- Địa chỉ nguồn yêu cầu: `abuse@oh.io.vn`.
- Địa chỉ đích: `oh.io.vn@proton.me`.
- Địa chỉ đích đã được thêm trong Cloudflare Email Routing và giao diện hiển thị `Verified`.
- **Chưa hoàn tất chuyển tiếp:** chưa tạo quy tắc `abuse@`, chưa thêm bản ghi MX/TXT của Email Routing. Cloudflare chặn onboarding khi zone chưa Active.
- Không bật catch-all. Không cấu hình mailbox gửi thư mang địa chỉ `abuse@` trong bước này.
- Sau khi được xác nhận và zone Active: bật Email Routing, kiểm tra/thêm đúng bản ghi cần thiết, tạo quy tắc chính xác rồi kiểm chứng trạng thái Enabled.
- Chỉ ghi đã kiểm chứng giao thư đầu cuối nếu thực sự thấy thư thử được nhận tại Proton. Hiện chưa gửi thư thử và chưa có bằng chứng giao thư đầu cuối.

## Đóng góp

- Ngân hàng: TPBank.
- Chủ tài khoản: NGUYỄN THÀNH NHÂN.
- Số tài khoản: `0802 8329 999`.
- Alias: `thanhnhanaz`.
- Ảnh gốc: [assets/donate/tpbank-vietqr.png](assets/donate/tpbank-vietqr.png).
- SHA-256 ảnh: `6718c6a7430125f04c05550eac8ffc78df5cc150de41c00e7bc4d74f8331d28f`.
- Ảnh đã được sao chép nguyên bản từ tệp chủ dự án cung cấp; không chỉnh sửa QR và không thực hiện giao dịch.

## Công việc còn lại

1. Kiểm chứng nameserver mới tại registry/DNS công khai và trạng thái Cloudflare Active.
2. Hoàn tất quy tắc `abuse@`, các bản ghi cần thiết và xác minh tình trạng nhận thư; thực hiện xác nhận tại thời điểm thao tác nếu công cụ yêu cầu.
3. Triển khai ứng dụng theo các chặng trong [ARCHITECTURE.md](ARCHITECTURE.md) khi bắt đầu phần code.
4. Cấu hình Google OAuth, Turnstile, D1, backup, secrets và quy trình phát hành ở chặng triển khai tương ứng. Chưa tạo các khóa hoặc quyền truy cập mới trong bước chuẩn bị này.

## Bằng chứng local

Ảnh kiểm chứng được giữ trong `.local/verification/`, đã được loại khỏi Git để tránh công khai ảnh giao diện quản trị. Không coi các ảnh này là dữ liệu ứng dụng hoặc bản sao lưu hạ tầng.
