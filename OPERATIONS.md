# Vận hành oh.io.vn

## Trạng thái mở thử

Mã ứng dụng đã được triển khai và kiểm thử local. Việc đưa lên Cloudflare còn chờ xác minh email tài khoản; chưa coi các bài kiểm thử local là bằng chứng chạy trên domain thật. Xem trạng thái thực tế trong [SETUP.md](SETUP.md).

Stack: TypeScript, Hono, Vite, Workers Static Assets, D1, Turnstile Managed. Một Durable Object SQLite nhỏ giữ cờ sự cố độc lập với D1. Không bật gói trả phí.

## Chạy và kiểm tra local

Yêu cầu Node 24 và npm. Lệnh dưới đây chạy từ thư mục repository.

```powershell
npm ci --legacy-peer-deps
Copy-Item .dev.vars.example .dev.vars
# Điền HMAC_SECRET ngẫu nhiên chỉ dùng local trong .dev.vars.
npm run db:local
npm run dev
```

`npm run dev` dùng `--local-upstream localhost:8787 --upstream-protocol http` để Wrangler không đổi Origin sang domain production. Không giảm kiểm tra Origin/CSRF để làm local chạy được.

Migration mặc định khóa tạo link đến khi có giám sát và sao lưu. Chỉ với database local chứa dữ liệu giả, có thể đánh dấu các điều kiện vận hành thử bằng:

```powershell
npx wrangler d1 execute oh-io-vn --local --command "UPDATE policy SET automatic_level=0,metrics_at=unixepoch()*1000,last_backup_at=unixepoch()*1000,heartbeat=unixepoch()*1000,expiry_hold=0;"
```

Không chạy lệnh mô phỏng trên database thật. Test keys Turnstile chỉ dành cho development; production từ chối test secret. Không có tài khoản hay đường dẫn bỏ qua Google trong mã được phát hành.

```powershell
npm run typecheck
npm test
npm run build
git diff --check
```

Các trang HTML được tạo từ `scripts/generate-pages.mjs`; sửa nội dung ở file đó. CSS và TypeScript giao diện ở `src/web/`. Build tự tạo lại HTML và sao chép nguyên bản QR.

## Bí mật và quyền

Cloudflare Secrets: `HMAC_SECRET`, `GOOGLE_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`, `BACKUP_TOKEN`, `CF_METRICS_TOKEN`, và định danh quản trị khi đã xác minh.

- HMAC_SECRET: 32 byte ngẫu nhiên trở lên. Xoay khóa sẽ làm mất hiệu lực CSRF/luồng OAuth đang chờ và thay khóa hạn mức mạng; lên lịch có kiểm soát.
- Google OAuth chỉ dùng `openid email profile`, callback duy nhất `https://oh.io.vn/auth/callback`. Không lưu access/refresh token Google.
- ADMIN_BOOTSTRAP_EMAIL: email Google của chủ dự án, lưu secret; chỉ chốt `sub` đầu tiên có đúng email và `email_verified=true` khi `policy.admin_sub` chưa có. Sau đăng nhập thật, bỏ bootstrap và dùng `ADMIN_GOOGLE_SUBS` hoặc `policy.admin_sub` đã ghi. Không cấp admin cho người đăng nhập đầu tiên bất kỳ.
- CF_METRICS_TOKEN: Account Analytics:Read và D1:Read trên đúng tài khoản dự án. D1:Read là quyền đọc D1; giữ kín token như dữ liệu ứng dụng. Không dùng token Wrangler có quyền triển khai làm token giám sát trong Worker.
- BACKUP_TOKEN: chỉ có thể tải bản dữ liệu ưu tiên và xác nhận upload; không cấp quyền thay target, tài khoản hay xóa dữ liệu.
- GitHub private Actions secrets có BACKUP_TOKEN và BACKUP_ENCRYPTION_KEY riêng. Giữ bản khóa giải mã an toàn ngoài GitHub để phục hồi nếu mất quyền truy cập.
- `.local/`, `.dev.vars`, dữ liệu D1, khóa và ảnh quản trị không được commit. Không gửi nguyên file debug hoặc biến môi trường lên issue công khai.

## Phát hành

Áp migration trước khi mở tính năng tạo; lần đầu giữ `policy.create_enabled=0`.

```powershell
npm run db:remote
npx wrangler secret bulk .local/production-secrets.json
npm run deploy
```

Custom domain được khai báo trong `wrangler.jsonc`. Giữ nguyên MX/TXT Email Routing. Kiểm tra TLS, `/api/config`, đăng nhập Google, guest/member creation, 302 và thao tác quản lý trên domain thật. Chỉ mở `create_enabled=1` sau khi backup riêng tư và giám sát đã chạy thành công; bỏ hoãn hết hạn ban đầu theo quy trình khôi phục bên dưới.

Không tự triển khai từ pull request không tin cậy. Workflow công khai chạy kiểm tra, không có deploy credentials. Triển khai thủ công bằng Wrangler của chủ dự án.

## Giám sát và giới hạn

Các hạn mức 3/20/100/200 nằm trong D1 policy, trigger kiểm tra ngay trong INSERT. Dữ liệu cửa sổ 24 giờ được dọn nhưng trigger vẫn lọc thời gian chính xác; không reset lúc nửa đêm. Burst 15 thao tác/60 giây là lớp hạn chế gần người dùng, không phải quota toàn cầu chính xác.

Cron mỗi 10 phút lấy số liệu Workers và D1 cấp tài khoản qua GraphQL, cùng dung lượng database của dự án. Ngưỡng theo tài nguyên có tỷ lệ cao nhất: 70 cảnh báo trong admin, 80 tắt ghi thống kê và dừng khách, 90 dừng tạo toàn dịch vụ. Không tự bật lại công tắc mà quản trị đã tắt thủ công. Snapshot giám sát cũ quá 2 giờ hoặc backup thành công cũ quá 36 giờ sẽ dừng tạo, vẫn cho chuyển hướng khi còn khả năng phục vụ.

Số liệu ngày theo UTC, có thể trễ/lấy mẫu. Không cam kết ngăn được mọi đợt tăng lưu lượng hoặc không chạm quota. Durable Object chỉ giữ một cờ nhỏ, được gọi khi kiểm tra sự cố/hết hạn; theo dõi thêm usage của nó tại dashboard. CPU và quota thật phải được kiểm chứng trên Cloudflare trước khi coi dịch vụ sẵn sàng.

Không có cảnh báo email tùy biến. Admin hiển thị trạng thái; GitHub gửi thông báo workflow thất bại theo cài đặt tài khoản của chủ dự án.

## Ghi truy cập gặp sự cố

Nếu cập nhật D1 thất bại, Worker vẫn trả 302 nếu đã đọc được target hợp lệ, đồng thời đặt cờ ở Durable Object và cố ghi cờ vào D1. Redirect tới link đã chạm hạn không hoạt động phải đọc cờ độc lập; không đọc được cờ thì giữ link. Cron đọc cờ trước khi dọn. Heartbeat quá 2 giờ cũng chốt hoãn trong D1. Hạn cố định và khóa vi phạm vẫn áp dụng.

Sau khi nguồn dữ liệu ổn định, quản trị tắt “Hoãn hết hạn do sự cố”. Hệ thống cấp lại trọn 3/12 tháng cho mọi link còn active, giữ nguyên hạn cố định; đây là cách ưu tiên bảo toàn link khi không thể khôi phục chính xác lượt bấm đã mất. Không tự hồi sinh tombstone. Nếu D1 và kho cờ đều gặp lỗi cùng lúc, không có bảo đảm ghi nhận được sự cố; kiểm tra dashboard và giữ hoãn thủ công khi nguồn dữ liệu không đáng tin.

## Sao lưu ngoài Cloudflare

Kho riêng tư: `oh-io-vn/backups`. Workflow mẫu trong `scripts/backup-workflow.yml`, chạy mỗi ngày 18:41 UTC (01:41 giờ Việt Nam), mã hóa AES-256-GCM trước khi upload, giữ artifact 7 ngày. Biến repository `BACKUP_ENABLED` đang là `false` trong lúc endpoint thật chưa được triển khai; đặt `true` sau deploy rồi chạy thủ công lúc mở thử. Snapshot D1 dùng một batch đọc chung giao dịch; gồm users, links/tombstones, blocklist và policy. Không gồm phiên, raw IP, logs hay thống kê có ưu tiên thấp hơn.

Giới hạn pilot: tối đa 2.000 hàng mỗi bảng, 2 MiB JSON trước nén/mã hóa. Tối đa khoảng 14 MiB dữ liệu artifact ngày trong 7 ngày, cộng overhead và lượt chạy thủ công. Workflow tối đa 5 phút; Linux chạy hằng ngày dự kiến nằm trong ngân sách private Actions Free đã kiểm tra, nhưng phải theo dõi usage thật. Không bật chi tiêu vượt gói miễn phí. Bản lớn hơn giới hạn sẽ báo lỗi thay vì upload không giới hạn; đánh giá lại streaming/export và dung lượng trước khi tăng. Khi backup cũ 36 giờ, tạo link mới tự đóng cho đến khi sửa xong.

Khóa giải mã nằm trong secret của kho private và một bản local bị Git bỏ qua. Upload thành công mới gọi endpoint xác nhận để cập nhật `last_backup_at`. Mã nguồn công khai không chứa bản sao lưu. Các lần chạy thủ công cũng tiêu tốn storage/phút và có thể tạo thêm artifact trong 7 ngày; không dùng workflow để stress test.

### Khôi phục thử hoặc khôi phục sau sự cố

1. Tải artifact mã hóa từ kho private. Kiểm tra nguồn và dùng đúng khóa.
2. Dùng `scripts/backup.mjs decrypt <file.ohbk> <.local/restore.json>` với biến môi trường BACKUP_ENCRYPTION_KEY; giải mã có xác thực, kiểm tra schema/quan hệ. Không đưa khóa vào command arguments hay log.
3. Tạo database D1 tách biệt và áp **đủ migration**. Chưa chạy vào database production có dữ liệu.
4. `node scripts/restore.mjs .local/restore.json .local/restore.sql` rồi dùng Wrangler import vào database trống đó.
5. Kiểm tra count, target mẫu, khóa ngoại, tombstone và trigger giới hạn; kiểm tra đọc/302 trên cấu hình test. Phiên và thống kê không được phục hồi. Policy sau restore tự khóa tạo và hoãn hết hạn, cần giám sát và backup mới trước khi mở lại.
6. Đối chiếu các yêu cầu xóa dữ liệu đã được xử lý sau thời điểm backup, áp dụng lại trước khi phục vụ công khai. Không dùng thao tác import ghi đè dữ liệu thật mà chưa kiểm tra.

Đã chạy thử vòng snapshot → mã hóa → giải mã → SQL → D1 local tách biệt với dữ liệu giả; kiểm tra target và `PRAGMA foreign_key_check` đạt. Đây chưa phải bằng chứng backup tự động hoặc khôi phục từ dữ liệu production.

## Xử lý báo cáo và xóa tài khoản

Tiếp nhận qua hi@oh.io.vn. Xác minh link/bằng chứng trước khi khóa; khóa đăng nhập tài khoản và khóa các link của tài khoản là hai nút riêng. Danh sách chặn hostname bao gồm tên miền con. Chỉ chặn URL chính xác khi thực sự cần phạm vi hẹp.

Yêu cầu xóa tài khoản: xác minh qua email Google đã dùng, vô hiệu hóa link, xóa analytics/phiên và dữ liệu tài khoản liên quan; giữ dấu slug tối thiểu. Ghi sổ yêu cầu riêng tư trong 7 ngày hoặc lâu hơn khi cần đối chiếu với backup còn hiệu lực, tránh khôi phục lại dữ liệu đã xóa. Mục tiêu phản hồi trong 7 ngày, có thể cần thêm thời gian để xác minh.

## Rollback

Giữ lại version Worker gần nhất; dùng `wrangler rollback <version-id>` khi cần rollback code, rồi kiểm tra domain. Rollback code không rollback migration hay dữ liệu. Với dữ liệu, dùng quy trình restore tách biệt ở trên. Khi lỗi diện rộng, tắt creates/analytics, bật expiry hold; cố giữ redirect nếu nền tảng còn phục vụ.
