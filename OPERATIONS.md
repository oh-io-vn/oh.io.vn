# Vận hành oh.io.vn

## Trạng thái mở thử

Dịch vụ đang mở thử tại https://oh.io.vn trên Cloudflare Free. Xem các mốc
thiết lập và kiểm chứng production trong [SETUP.md](SETUP.md).

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

### Turnstile và biểu mẫu tạo link

Widget Managed dùng duy nhất hostname `oh.io.vn` và action `create`; máy chủ phải kiểm tra cả hai khi Siteverify thành công. Người dùng không cần đăng nhập để được xác minh và tạo link khách. Dùng `execution: execute` và `appearance: execute`: nạp SDK trước, bắt đầu xác minh khi bấm tạo link hoặc thử lại, không chạy thử thách liên tục khi chỉ đọc trang.

Biểu mẫu chờ callback trong tối đa 60 giây, khóa nút gửi để không tạo trùng, và chỉ dùng token một lần. Token cũ hơn 290 giây không được gửi. SDK tự làm mới khi hết hạn; token đã dùng được reset ở lần tạo tiếp theo, tránh hiển thị lỗi xác minh mới ngay trên kết quả vừa tạo thành công. Khi lỗi tạm thời thuộc nhóm 300/600/200500, thử reset tự động một lần sau 2 giây; sau đó hiển thị nút thử lại tại chỗ, giữ nguyên URL. Không lặp vô hạn hoặc bỏ qua Siteverify.

Khi không tải được SDK trong 15 giây hoặc tải lỗi, cho thử tải lại ngay trên trang. Không đặt ID phần tử là `turnstile` và không chỉ kiểm tra biến global có tồn tại: phải có API `render`, tránh nhầm phần tử HTML với SDK do named access của trình duyệt. Lỗi mạng/HTTP/phản hồi không hợp lệ từ Siteverify và lỗi nhà cung cấp/cấu hình trả 503; token không hợp lệ trả 400. Log chỉ có mã lỗi hoặc nhóm nguyên nhân, không token/secret/IP.

Nếu tiếp tục gặp 300030, kiểm tra bằng [công cụ chẩn đoán Cloudflare](https://debug.challenges.cloudflare.com/) và đối chiếu [mã lỗi chính thức](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/). Kiểm tra sitekey, hostname và CSP trước khi quy nguyên nhân cho trình duyệt. Không thay sitekey test, tắt xác minh hoặc cấp đường bỏ qua ở production.

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

### Tự động deploy từ GitHub Actions

#### Phát hành tính năng đổi mã link

Áp dụng `migrations/0003_rename_link_codes.sql` bằng `npm run db:remote` trước
khi phát hành Worker có tính năng đổi mã. Migration giữ nguyên dữ liệu thống kê,
thêm cập nhật khóa ngoại theo mã mới và giữ mã cũ dưới dạng tombstone trong cùng
giao dịch. Đổi mã không tạo sự kiện hạn mức mới. Không cần đổi định dạng backup:
mã cũ vẫn ở bảng `links` và không còn thông tin chủ sở hữu/địa chỉ đích.

Workflow deploy hiện chỉ có quyền trên Worker và không tự chạy migration D1.
Không tự tăng quyền token deploy. Khi chưa áp migration, API từ chối riêng thao
tác đổi mã với 503 để tránh cấp lại mã cũ. Sửa thông tin với mã không đổi vẫn
hoạt động. Migration tương thích Worker cũ, vì thế có thể áp trước khi push.
Kiểm tra backup hiện tại và chạy migration với quyền D1 khi phát hành được cho phép.

Chủ link phải xác nhận địa chỉ cũ ngừng hoạt động. Link mới giữ chủ sở hữu,
thống kê, ngày tạo và thời hạn. Không cho đổi sang mã đã từng dùng, mã hệ thống,
link của người khác hoặc link đã ngừng hoạt động.

Workflow `.github/workflows/ci.yml` chạy kiểm tra cho push và pull request.
Khi push vào `main`, job `deploy` chỉ chạy sau khi job `verify` đạt typecheck,
test và build. Pull request, nhánh khác hoặc CI thất bại không được deploy.

Frontend được chuyển từ job kiểm tra sang job deploy bằng artifact gắn với
commit SHA; Worker được đóng gói từ chính commit đó. Các lượt deploy chạy tuần
tự, không hủy lượt đang phát hành. Trước deploy, workflow bỏ qua commit đã bị
commit mới hơn trên `main` thay thế để tránh phát hành bản cũ sau bản mới.

GitHub environment `production` chỉ cho phép branch `main`, gồm:

- Secret `CLOUDFLARE_API_TOKEN`: token riêng cho triển khai Worker hiện có.
- Variable `CLOUDFLARE_ACCOUNT_ID`: tài khoản Cloudflare của dự án.

Token chỉ có quyền Editor trên Worker `oh-io-vn` và chỉ được đưa vào bước triển
khai, không cấp cho job kiểm tra hay bước cài dependency. Không lưu token trong
mã nguồn, artifact hoặc log. Khi xoay token, cập nhật secret trong environment
này trước khi thu hồi token cũ.

Workflow dùng `wrangler versions upload` rồi `wrangler versions deploy` để đưa
đúng version vừa tải lên phục vụ 100% lưu lượng. Tag gồm commit SHA, run ID và
lần chạy, tránh chọn nhầm version khi chạy lại CI. Cách này giữ nguyên tên miền,
routes, lịch cron và các thiết lập không thuộc version; không cần cấp quyền
truy cập zone cho token. Khi cần đổi các thiết lập đó hoặc migration Durable
Objects, thực hiện riêng bằng tài khoản đủ quyền và kiểm tra sau thay đổi.

Sau deploy, `scripts/verify-deployment.mjs` đối chiếu `/deployment.json` với commit
SHA, kiểm tra bảy trang, CSP, SHA-256 của assets trang chủ và `/api/config`.
Nếu edge chưa cập nhật, thử lại tối đa sáu lần. Lỗi kiểm tra làm job deploy báo
thất bại; không tự rollback hoặc sửa dữ liệu. Xem version có message chứa SHA
trong Cloudflare và mục Rollback bên dưới khi cần xử lý.

Luồng này không tự áp migration D1 hoặc thay secrets ứng dụng. Khi đổi schema,
chuẩn bị migration tương thích trước khi push vào `main`. Lệnh deploy thủ công
ở trên chỉ dùng khi cần xử lý riêng; tránh chạy đồng thời với GitHub Actions.

### CSP và Cloudflare Web Analytics

Cloudflare tự chèn beacon vào HTML trên domain thật. `script-src` trong
`public/_headers` cho phép đúng `https://static.cloudflareinsights.com/beacon.min.js`
và đường dẫn con `https://static.cloudflareinsights.com/beacon.min.js/` để tải URL
có hậu tố phiên bản. Dấu `/` cuối là quy tắc khớp tiền tố đường dẫn của CSP,
không phải quyền tải mọi script trên tên miền này.

Với cách chèn tự động, beacon gửi về `/cdn-cgi/rum` cùng domain; `connect-src 'self'`
đã cho phép. Giữ các giới hạn hiện tại cho script inline, eval và kết nối ngoài.
Tham khảo [hướng dẫn CSP của Cloudflare](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp).

Chạy `node scripts/test-csp.mjs` bằng Playwright và Chrome có sẵn, dùng biến
`PLAYWRIGHT_PACKAGE` như hướng dẫn kiểm thử UI trong `AGENTS.md`. Kiểm thử này
dùng phản hồi giả trong browser, không gửi analytics thật; kiểm tra cả beacon
được phép và các nguồn phải bị chặn. Sau deploy, xác nhận script tải thành công,
POST `/cdn-cgi/rum` nhận phản hồi thành công và console không còn lỗi CSP.

## Giám sát và giới hạn

Các hạn mức 3/20/100/200 nằm trong D1 policy, trigger kiểm tra ngay trong INSERT. Dữ liệu cửa sổ 24 giờ được dọn nhưng trigger vẫn lọc thời gian chính xác; không reset lúc nửa đêm. Burst 15 thao tác/60 giây là lớp hạn chế gần người dùng, không phải quota toàn cầu chính xác.

Cloudflare zone có một rate limiting rule đang hoạt động: đường dẫn bắt đầu `/api/` hoặc `/auth/`, theo IP, 20 yêu cầu trong 10 giây thì chặn 10 giây. Đường chuyển hướng slug thông thường không nằm trong rule này. Always Use HTTPS đã bật và HTTP trả 301 sang HTTPS. Workers.dev và preview URL được tắt để giữ một hostname phục vụ đã cấu hình.

Cron mỗi 10 phút lấy số liệu Workers và D1 cấp tài khoản qua GraphQL, cùng dung lượng database của dự án. Ngưỡng theo tài nguyên có tỷ lệ cao nhất: 70 cảnh báo trong admin, 80 tắt ghi thống kê và dừng khách, 90 dừng tạo toàn dịch vụ. Không tự bật lại công tắc mà quản trị đã tắt thủ công. Snapshot giám sát cũ quá 2 giờ hoặc backup thành công cũ quá 36 giờ sẽ dừng tạo, vẫn cho chuyển hướng khi còn khả năng phục vụ.

Số liệu ngày theo UTC, có thể trễ/lấy mẫu. Không cam kết ngăn được mọi đợt tăng lưu lượng hoặc không chạm quota. Durable Object chỉ giữ một cờ nhỏ, được gọi khi kiểm tra sự cố/hết hạn; theo dõi thêm usage của nó tại dashboard. CPU và quota thật phải được kiểm chứng trên Cloudflare trước khi coi dịch vụ sẵn sàng.

Không có cảnh báo email tùy biến. Admin hiển thị trạng thái; GitHub gửi thông báo workflow thất bại theo cài đặt tài khoản của chủ dự án.

## Ghi truy cập gặp sự cố

Nếu cập nhật D1 thất bại, Worker vẫn trả 302 nếu đã đọc được target hợp lệ, đồng thời đặt cờ ở Durable Object và cố ghi cờ vào D1. Redirect tới link đã chạm hạn không hoạt động phải đọc cờ độc lập; không đọc được cờ thì giữ link. Cron đọc cờ trước khi dọn. Heartbeat quá 2 giờ cũng chốt hoãn trong D1. Hạn cố định và khóa vi phạm vẫn áp dụng.

Sau khi nguồn dữ liệu ổn định, quản trị tắt “Hoãn hết hạn do sự cố”. Hệ thống cấp lại trọn 3/12 tháng cho mọi link còn active, giữ nguyên hạn cố định; đây là cách ưu tiên bảo toàn link khi không thể khôi phục chính xác lượt bấm đã mất. Không tự hồi sinh tombstone. Nếu D1 và kho cờ đều gặp lỗi cùng lúc, không có bảo đảm ghi nhận được sự cố; kiểm tra dashboard và giữ hoãn thủ công khi nguồn dữ liệu không đáng tin.

## Sao lưu ngoài Cloudflare

Kho riêng tư: `oh-io-vn/backups`. Workflow mẫu trong `scripts/backup-workflow.yml`, chạy mỗi ngày 18:41 UTC (01:41 giờ Việt Nam), mã hóa AES-256-GCM trước khi upload, giữ artifact 7 ngày. Biến repository `BACKUP_ENABLED` đã đặt `true`; chạy thủ công trên production thành công ngày 17/10/2026. Snapshot D1 dùng một batch đọc chung giao dịch; gồm users, links/tombstones, blocklist và policy. Không gồm phiên, raw IP, logs hay thống kê có ưu tiên thấp hơn.

Giới hạn pilot: tối đa 2.000 hàng mỗi bảng, 2 MiB JSON trước nén/mã hóa. Tối đa khoảng 14 MiB dữ liệu artifact ngày trong 7 ngày, cộng overhead và lượt chạy thủ công. Workflow tối đa 5 phút; Linux chạy hằng ngày dự kiến nằm trong ngân sách private Actions Free đã kiểm tra, nhưng phải theo dõi usage thật. Không bật chi tiêu vượt gói miễn phí. Bản lớn hơn giới hạn sẽ báo lỗi thay vì upload không giới hạn; đánh giá lại streaming/export và dung lượng trước khi tăng. Khi backup cũ 36 giờ, tạo link mới tự đóng cho đến khi sửa xong.

Khóa giải mã nằm trong secret của kho private và một bản local bị Git bỏ qua. Upload thành công mới gọi endpoint xác nhận để cập nhật `last_backup_at`. Mã nguồn công khai không chứa bản sao lưu. Các lần chạy thủ công cũng tiêu tốn storage/phút và có thể tạo thêm artifact trong 7 ngày; không dùng workflow để stress test.

### Khôi phục thử hoặc khôi phục sau sự cố

1. Tải artifact mã hóa từ kho private. Kiểm tra nguồn và dùng đúng khóa.
2. Dùng `scripts/backup.mjs decrypt <file.ohbk> <.local/restore.json>` với biến môi trường BACKUP_ENCRYPTION_KEY; giải mã có xác thực, kiểm tra schema/quan hệ. Không đưa khóa vào command arguments hay log.
3. Tạo database D1 tách biệt và áp **đủ migration**. Chưa chạy vào database production có dữ liệu.
4. `node scripts/restore.mjs .local/restore.json .local/restore.sql` rồi dùng Wrangler import vào database trống đó.
5. Kiểm tra count, target mẫu, khóa ngoại, tombstone và trigger giới hạn; kiểm tra đọc/302 trên cấu hình test. Phiên và thống kê không được phục hồi. Policy sau restore tự khóa tạo và hoãn hết hạn, cần giám sát và backup mới trước khi mở lại.
6. Đối chiếu các yêu cầu xóa dữ liệu đã được xử lý sau thời điểm backup, áp dụng lại trước khi phục vụ công khai. Không dùng thao tác import ghi đè dữ liệu thật mà chưa kiểm tra.

Đã chạy vòng snapshot → mã hóa → tải artifact → giải mã có xác thực → SQL → D1 local tách biệt bằng bản sao lưu production ngày 17/10/2026. Kiểm tra có tài khoản và link thật, đúng target/thời hạn, không phục hồi session, `PRAGMA foreign_key_check` không lỗi và đủ ba trigger. Policy phục hồi khóa tạo mới và hoãn hết hạn đúng thiết kế. Workflow chạy thủ công thành công, lịch hằng ngày đã bật; cần theo dõi lần chạy theo lịch tiếp theo trong kho private.

## Xử lý báo cáo và xóa tài khoản

Tiếp nhận qua hi@oh.io.vn. Xác minh link/bằng chứng trước khi khóa; khóa đăng nhập tài khoản và khóa các link của tài khoản là hai nút riêng. Danh sách chặn hostname bao gồm tên miền con. Chỉ chặn URL chính xác khi thực sự cần phạm vi hẹp.

Yêu cầu xóa tài khoản: xác minh qua email Google đã dùng, vô hiệu hóa link, xóa analytics/phiên và dữ liệu tài khoản liên quan; giữ dấu slug tối thiểu. Ghi sổ yêu cầu riêng tư trong 7 ngày hoặc lâu hơn khi cần đối chiếu với backup còn hiệu lực, tránh khôi phục lại dữ liệu đã xóa. Mục tiêu phản hồi trong 7 ngày, có thể cần thêm thời gian để xác minh.

## Rollback

Giữ lại version Worker gần nhất; dùng `wrangler rollback <version-id>` khi cần rollback code, rồi kiểm tra domain. Rollback code không rollback migration hay dữ liệu. Với dữ liệu, dùng quy trình restore tách biệt ở trên. Khi lỗi diện rộng, tắt creates/analytics, bật expiry hold; cố giữ redirect nếu nền tảng còn phục vụ.
