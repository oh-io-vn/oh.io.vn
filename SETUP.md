# Trạng thái thiết lập oh.io.vn

Cập nhật: 17/10/2026, giờ Việt Nam. Tài liệu chỉ chứa thông tin cấu hình cần thiết, không chứa token, mật khẩu hoặc dữ liệu hộp thư.

## Repository

- Repository công khai: <https://github.com/oh-io-vn/oh.io.vn>.
- Chủ sở hữu: tổ chức `oh-io-vn`.
- Giấy phép mã nguồn: MIT.
- Giai đoạn hiện tại: mở thử tại <https://oh.io.vn> trên Cloudflare Free; mã nguồn, migration, giao diện, kiểm thử và công cụ sao lưu đã triển khai.

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
- Worker `oh-io-vn` và custom domain đã triển khai, TLS hợp lệ. Always Use HTTPS bật; HTTP được chuyển 301 sang HTTPS. Tắt Workers.dev và preview URL trong cấu hình.

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

## Vận hành tiếp theo

1. Theo dõi lần backup theo lịch lúc 01:41 giờ Việt Nam và các lần cron 10 phút; workflow production chạy thủ công và restore bản có dữ liệu thật đã đạt.
2. Theo dõi tài nguyên và phản hồi trong giai đoạn mở thử; chưa tăng các mức 3/20/100/200 khi chưa có số liệu.
3. Tiếp nhận báo cáo tại hi@oh.io.vn, kiểm tra bằng chứng trước khi khóa link/tài khoản.
4. Gia hạn domain trước ngày 17/10/2027; hạ tầng Free không gia hạn tên miền thay chủ dự án.

## Các tài nguyên đã tạo ngày 17/10/2026

- Wrangler đã xác minh đúng tài khoản Cloudflare. OAuth credential được mã hóa và khóa lưu trong Windows Credential Manager; không nằm trong repository.
- D1 `oh-io-vn`, vùng APAC, migration 0001 và 0002 đã áp dụng remote. Có dữ liệu production; đã bật tạo link, tạo khách và thống kê, tắt hoãn hết hạn sau khi heartbeat/backup/monitor khỏe. Hạn mức 3/20/100/200.
- Turnstile Managed `oh-io-vn`, hostname duy nhất `oh.io.vn`; public sitekey trong cấu hình, secret đã upload Cloudflare Secrets. Luồng tạo link tài khoản đã qua xác minh thật; kiểm tra có thể cần tải lại khi Cloudflare chưa xác minh được trình duyệt.
- Google project riêng: tên `oh-io-vn`, ID `inspired-gift-511910-f7`. Web OAuth client `oh.io.vn Web`, callback duy nhất `https://oh.io.vn/auth/callback`, branding đã gắn trang chủ/privacy/terms. Google xác nhận `In production`; đăng nhập đầu cuối thành công. Admin được chốt theo Google sub trong D1; secret bootstrap đã đặt rỗng sau lần chốt đầu.
- Kho `oh-io-vn/backups` đã kiểm tra `PRIVATE`, `BACKUP_ENABLED=true`; secrets mã hóa/endpoint đã đặt. Workflow production `39029887755` thành công, bản có 1 tài khoản và 1 link đã phục hồi sang D1 local tách biệt, đúng target, không phiên và không lỗi khóa ngoại.
- Token giám sát chỉ đọc Account Analytics:Read + D1:Read, giới hạn đúng tài khoản dự án, đã lưu Cloudflare Secrets. Cron thật 18:40 ngày 17/10/2026 ghi số liệu vào admin và mức giảm tải bình thường.
- Rule Cloudflare `oh.io.vn API and login burst guard` đã bật: 20 yêu cầu/IP/10 giây với `/api/` hoặc `/auth/`, chặn 10 giây, không áp cho chuyển hướng link.
- Bộ kiểm thử có 29 ca đạt, gồm giới hạn đồng thời, lịch tháng, redirect, quyền sở hữu, CSRF, cookie đăng xuất production, cờ sự cố độc lập và mã hóa backup. Build/typecheck đạt. Đã thao tác Google login, tạo/sửa link tài khoản, thống kê và xuất XLSX production trên Chrome; workbook tải về có hai sheet, đúng mã link/nhóm nguồn và không có ô công thức. Các lượt bấm thử là dữ liệu kiểm chứng, không phải người dùng thật.
- Đăng xuất production đã kiểm chứng trả 200 sau khi sửa xóa cookie `__Host-` với thuộc tính Secure. Mẫu thống kê sau khi giảm truy vấn trùng: 5 ms CPU; callback Google có mẫu 14 ms nhưng outcome vẫn `ok`. Chưa thử tải lớn.
- Luồng tạo khách đã qua kiểm thử Worker local với Turnstile giả lập; thử cuối trên trình duyệt tự động production gặp Turnstile 300030 nên chưa có bằng chứng tạo khách đầu cuối production. Giữ nguyên xác minh thật và không đưa đường bỏ qua vào ứng dụng; cần một lượt thử từ trình duyệt người dùng thông thường. Tạo khách vẫn được bật theo chính sách đã chốt.

Chi tiết lệnh và giới hạn vận hành tại [OPERATIONS.md](OPERATIONS.md). Không bật gói trả phí.

## Bằng chứng local

Ảnh kiểm chứng được giữ trong `.local/verification/`, đã được loại khỏi Git để tránh công khai ảnh giao diện quản trị. Không coi các ảnh này là dữ liệu ứng dụng hoặc bản sao lưu hạ tầng.
