# Kiểm tra lưu lượng oh.io.vn - 18/10/2026

Kiểm tra trực tiếp Cloudflare qua phiên Chrome được chủ website cho phép,
khoảng 02:45-03:05 giờ Việt Nam. Các bảng dùng cửa sổ 24 giờ và được đọc
ở những thời điểm khác nhau, nên không cộng hoặc trừ chúng như một snapshot.
Số liệu có thể được Cloudflare lấy mẫu và làm tròn.

## Kết luận theo bằng chứng

- Có lưu lượng tự động tới đường dẫn không tồn tại và dò tìm file cấu hình.
  Chưa có bằng chứng trong phạm vi kiểm tra này về việc lấy được dữ liệu,
  chiếm quyền hoặc gây gián đoạn dịch vụ.
- Bảng HTTP Requests ban đầu hiển thị khoảng 7.750 yêu cầu, 5.050 lỗi 4xx,
  1 lỗi 5xx. Khi lọc 4xx, khoảng 5.060 là 404. Các snapshot tăng nhẹ giữa
  các lần đọc.
- Đường dẫn dò quét gồm `/.env`, `/.env.staging`, `/config/.env`,
  `/functions/.env`, `/.git/HEAD`. Các đường dẫn bài viết như `/en/...`,
  `/fr/...`, `/es/...`, `/ru/...`, `/ko/...` không thuộc ứng dụng hiện tại.
- Một chuỗi User-Agent tự nhận Chrome 142 trên macOS xuất hiện trong khoảng
  4.480 yêu cầu 4xx. User-Agent có thể giả mạo. Không đủ căn cứ quy lưu lượng
  này cho một hãng AI hay xác định danh tính người gửi.
- Worker Metrics hiển thị khoảng 6.680 invocations, 1.770 asset requests,
  0 Worker errors trong 24 giờ. Active deployment hiển thị 0,4 req/s,
  error rate 0%, median CPU 0,91 ms tại thời điểm đọc. Đây không phải số liệu
  peak của cả ngày và không chứng minh hệ thống không thể bị tấn công sau này.
- Security Events ban đầu không có firewall event trong 24 giờ. Điều đó
  không có nghĩa mọi yêu cầu đều hợp lệ. DDoS protection đang luôn bật.

## Vì sao một người vẫn có nhiều yêu cầu

`src/worker/monitor.ts` lấy Workers invocations và D1 rows read/written cho
toàn tài khoản Cloudflare, không lọc riêng Worker hoặc database. Dung lượng
lại lấy riêng database oh.io.vn. Đây là bộ theo dõi hạn mức, không phải số
người dùng. Hạn mức dùng chung tài khoản nên giữ nguyên phép cộng này.

Ngày được tính từ 00:00 UTC, tương đương 07:00 Việt Nam. Ảnh lúc 01:50 ngày
18/10 vẫn nằm trong ngày sử dụng UTC 17/10. Không được suy ra đó là lượng
sử dụng chỉ trong 1 giờ 50 phút sau nửa đêm Việt Nam.

Một lần mở trang có thể tải HTML, CSS, JS, font, favicon, `/api/me`,
`/api/config` và analytics. Các asset được phục vụ trực tiếp không đồng nghĩa
với một lần chạy Worker có tính vào quota. Đường dẫn không có asset có thể
rơi xuống Worker để trả 404, dù không đọc D1.

Cron chạy mỗi 10 phút, gọi monitor, dọn dữ liệu và ghi heartbeat. D1 rows
read/written cũng đến từ đăng nhập, quản trị, link redirect và tác vụ định kỳ.
Không thể quy từng dòng đọc/ghi cho bot chỉ từ tổng số hiện có.

## Thay đổi đã áp dụng trên Cloudflare

Đã giữ rate limiting có sẵn: `/api/` hoặc `/auth/`, theo IP, 20 requests / 10
giây, Block 10 giây. Không tạo lại hoặc thay ngưỡng này.

Đã thêm hai custom rules, action Block, status Active, chỉ host `oh.io.vn`:

1. `oh.io.vn - Block sensitive file probes`
   - Rule ID: `3c03584b2c9742cdb134603251453646`.
   - Path sau `lower()` chứa `/.env`, `/.git`, `/.svn`, kết thúc `.php`,
     hoặc bắt đầu `/wp-admin/`, `/wp-content/`, `/cgi-bin/`.
2. `oh.io.vn - Block unsupported article paths`
   - Rule ID: `41750543f2f447a9b746b4f3aded49a7`.
   - Path sau `lower()` bắt đầu `/en/`, `/fr/`, `/es/`, `/ru/`, `/ko/`.
   - Chỉ các nhóm đã xuất hiện trong log và không được ứng dụng hỗ trợ.
     Nếu tương lai có trang hợp lệ dưới các prefix này, phải điều chỉnh rule
     trước khi mở route.

Rollback: vào Security > Security rules, mở đúng rule theo tên/ID và chuyển
Disabled. Không cần sửa DNS, database hay deploy Worker để thay hai rule.

Không bật Bot Fight Mode toàn domain vì có thể challenge cả API/backup và
không có ngoại lệ WAF ở chế độ Free. AI Labyrinth giữ tắt. Chính sách quốc gia
và AI crawler sau đó được chủ website chọn rõ, đã áp dụng như phần dưới.

## Xác minh sau khi áp dụng

- Tám HTTP HEAD requests có giới hạn, không theo redirect, không gửi cookie,
  không đọc hoặc sửa dữ liệu người dùng.
- `/`, `/about/`, `/robots.txt`, `/api/config`, `/api/me`: 200.
- `/ma-nguon`: 302 tới URL GitHub hiện có.
- `/en/codex-edge-check`, `/wp-content/codex-edge-check`: 403.
- Security Events ghi nhận thêm một GET thực tế lúc 02:57:43 từ Spain tới
  đường dẫn bài viết `/en/...`, bị rule thứ hai Block. Hai HEAD kiểm tra của
  agent được ghi riêng lúc 02:58:02, không tính chúng là bot ngoài hệ thống.
- Ở lần kiểm tra cuối, bảng Security rules hiển thị 1 event cho rule dò file
  và 10 events cho rule đường dẫn bài viết. Các số này có cả request kiểm tra.
- Chưa có đủ khoảng thời gian sau thay đổi để định lượng mức giảm tổng
  Worker invocations hoặc kết luận đã chặn mọi bot.

Ảnh và dữ liệu kiểm tra lưu tại `.local/traffic-review/`. Không đưa địa chỉ
IP người dùng vào báo cáo. Tổng HTTP requests trên zone vẫn có thể tăng khi
Cloudflare ghi nhận các yêu cầu đã bị chặn. Đánh giá hiệu quả bằng sự kiện
Block của đúng rule và tốc độ Worker invocations trong cùng cửa sổ thời gian.

## Thay đổi source cục bộ

`src/web/main.ts`: đổi nhãn thành “Yêu cầu chạy Worker”, giải thích phạm vi
toàn tài khoản, mốc đặt lại 07:00 Việt Nam, dung lượng của database riêng và
chu kỳ cập nhật 10 phút. Không thay cách tính hạn mức hoặc business logic.

- `npm run build`: typecheck, build web và Wrangler dry-run thành công.
- Browser local với dữ liệu giả: 1440, 768, 390px, không tràn ngang và không
  có JavaScript page error. Đã chụp ảnh giao diện.
- Source chưa commit, push hoặc deploy. Các thay đổi SEO/security có từ
  trước vẫn được giữ nguyên. Worker production vẫn ở commit `ac4aa3a` tại
  thời điểm kiểm tra, chưa có binding `API_READ_BURST` đang chuẩn bị cục bộ.

## Chính sách đã chọn và áp dụng

Chủ website xác nhận giữ tạo link toàn cầu, chặn bot theo hành vi và đường
dẫn. Không thêm giới hạn quốc gia. Hai custom rules và rate limit ở trên
được giữ nguyên.

Khoảng 09:03 giờ Việt Nam ngày 18/10/2026, đã lưu cấu hình tại Security >
Settings > Configure AI bot policies của zone `oh.io.vn`:

- Search: `Allow (do not block)`.
- Agent: `Allow (do not block)`.
- Training: đổi từ `Allow (do not block)` sang `Block`.
- Enable Bot Preference Sync: tiếp tục bật.

Đã mở lại bảng cấu hình sau khi Save và xác nhận các giá trị được lưu.
Ảnh bằng chứng: `.local/traffic-review/cloudflare-ai-policy.png`.
GET công khai tới `https://oh.io.vn/robots.txt` xác nhận phần Cloudflare
Managed Content có `Content-Signal: search=yes,ai-train=no,use=reference`
và các nhóm Training như GPTBot, ClaudeBot, Google-Extended bị `Disallow: /`.
Các quy tắc gốc cho `/api/`, `/auth/`, `/admin/`, `/dashboard/` cùng sitemap
vẫn có trong phản hồi. Không sửa file robots của ứng dụng.

Đây là xác minh cấu hình đã lưu và robots.txt đang phục vụ, chưa phải kiểm
chứng request từ từng crawler được Cloudflare nhận diện. Không giả User-Agent
để tuyên bố đã kiểm chứng toàn bộ cơ chế chặn. Chưa có bằng chứng AI Training
là nguồn tải chính, cũng chưa đủ số liệu để định lượng mức giảm sau thay đổi.
Cho phép Search/Agent không tạo ngoại lệ vượt qua WAF, rate limit hoặc quyền
truy cập riêng của ứng dụng.

Để hoàn tác riêng chính sách Training, mở cùng bảng, đặt Training về
`Allow (do not block)` và Save. Không cần deploy Worker hoặc thay DNS.

## Tài liệu đối chiếu

- [Workers limits và reset UTC](https://developers.cloudflare.com/workers/platform/limits/)
- [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [D1 rows và chu kỳ quota](https://developers.cloudflare.com/d1/platform/pricing/)
- [Bot Fight Mode và giới hạn ngoại lệ](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [Chính sách Search, Agent, Training](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/)
