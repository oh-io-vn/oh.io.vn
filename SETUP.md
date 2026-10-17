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
- Đã kiểm chứng DNS công khai qua resolver `1.1.1.1` trả hai nameserver Cloudflare mới; giao diện Cloudflare xác nhận domain đã kích hoạt với thông báo `Your domain is now protected by Cloudflare`.
- Chưa có Worker, website hoặc bản ghi trỏ web được triển khai.

## Email báo cáo lạm dụng

- Địa chỉ nguồn yêu cầu: `hi@oh.io.vn`.
- Địa chỉ đích: `oh.io.vn@proton.me`.
- Địa chỉ đích đã được thêm trong Cloudflare Email Routing và giao diện hiển thị `Verified`.
- Email Routing hiện chỉ có một quy tắc `hi@oh.io.vn` → `oh.io.vn@proton.me`; đã sửa trực tiếp quy tắc hiện có theo yêu cầu đổi địa chỉ của chủ dự án, giao diện hiển thị `Active`.
- Catch-all ở trạng thái `Disabled`.
- DNS công khai đã có ba MX của Cloudflare, TXT SPF và TXT DKIM `cf2024-1._domainkey`. Ưu tiên MX được Cloudflare cấp trong lần thiết lập này: route3 = 55, route1 = 79, route2 = 99; không hard-code các giá trị này làm mặc định cho domain khác.
- Đã tải lại trang tổng quan và kiểm chứng `Routing status: Enabled`, `DNS records: Locked`, một quy tắc và một địa chỉ đích.
- Không bật catch-all. Không cấu hình mailbox gửi thư mang địa chỉ `hi@` trong bước này.
- Đã kiểm chứng lại giao thư đầu cuối sau khi đổi địa chỉ: thư thử gửi tới `hi@oh.io.vn` đã được nhận trong Inbox của `oh.io.vn@proton.me` lúc 17:29 ngày 17/10/2026, người nhận gốc vẫn là `hi@oh.io.vn`. Giao diện hiển thị riêng bản `Sent` và bản `Inbox` trong cùng cuộc hội thoại.
- Lượt thử đầu ngay sau khi sửa quy tắc bị Cloudflare trả SMTP `550 5.1.1 Address does not exist`; lượt thử lại sau đó đã nhận thành công. Trạng thái giao diện `Active` cần được kiểm chứng bằng nhận thư thực tế sau mỗi lần thay đổi.

## Đóng góp

- Ngân hàng: TPBank.
- Chủ tài khoản: NGUYỄN THÀNH NHÂN.
- Số tài khoản: `0802 8329 999`.
- Alias: `thanhnhanaz`.
- Ảnh gốc: [assets/donate/tpbank-vietqr.png](assets/donate/tpbank-vietqr.png).
- SHA-256 ảnh: `6718c6a7430125f04c05550eac8ffc78df5cc150de41c00e7bc4d74f8331d28f`.
- Ảnh đã được sao chép nguyên bản từ tệp chủ dự án cung cấp; không chỉnh sửa QR và không thực hiện giao dịch.

## Công việc còn lại

1. Theo dõi báo cáo lạm dụng tại địa chỉ đã cấu hình khi ứng dụng được mở công khai.
2. Triển khai ứng dụng theo các chặng trong [ARCHITECTURE.md](ARCHITECTURE.md) khi bắt đầu phần code.
3. Cấu hình Google OAuth, Turnstile, D1, backup, secrets và quy trình phát hành ở chặng triển khai tương ứng. Chưa tạo các khóa hoặc quyền truy cập mới trong bước chuẩn bị này.

## Bằng chứng local

Ảnh kiểm chứng được giữ trong `.local/verification/`, đã được loại khỏi Git để tránh công khai ảnh giao diện quản trị. Không coi các ảnh này là dữ liệu ứng dụng hoặc bản sao lưu hạ tầng.
