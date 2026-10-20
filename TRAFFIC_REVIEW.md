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

## Bổ sung prefix đã quan sát - 18/10/2026, khoảng 10:34-10:36

Theo yêu cầu của chủ website, đã cập nhật rule
`oh.io.vn - Block unsupported article paths`, ID
`41750543f2f447a9b746b4f3aded49a7` trực tiếp trên Cloudflare. Rule vẫn
giới hạn host `oh.io.vn`, action Block, status Active và đứng sau rule dò file.

- Giữ các prefix cũ: `/en/`, `/fr/`, `/es/`, `/ru/`, `/ko/`.
- Bổ sung: `/pt/`, `/eu/`, `/ca/`, `/sr/`, `/it/`. `/it/` đã xuất hiện
  trong mẫu log trước đó. Không chặn hàng loạt mọi mã ngôn ngữ chưa quan sát.
- Tất cả dùng `starts_with(lower(http.request.uri.path), "/xx/")`.
  Dấu `/` cuối prefix là ranh giới, không khớp mã như `/pt-link` hoặc
  chuỗi `/pt/` chỉ nằm trong query của trang chủ.

Đã đối chiếu bảy trang HTML, route Worker, `/auth/login`, `/auth/callback`,
API quản trị và static assets. Link rút gọn chỉ có một đoạn `/:slug`, mã
3-64 ký tự chữ, số, `_`, `-`, không chứa `/`. Hiện không có route hợp lệ
dưới năm prefix mới. Nếu sau này bổ sung route dưới các prefix bị chặn,
phải chỉnh WAF trước khi mở route.

Xác minh production bằng HEAD, không gửi cookie, không theo redirect:

- Năm prefix mới: từ 404 trước thay đổi thành 403 sau thay đổi.
- `/PT/...` và `/en/...`: 403, xác nhận chữ hoa và prefix cũ.
- Bảy trang chính, robots, sitemap, favicon, CSS/JS/font, `/api/config`,
  `/api/me` và trang chủ có query chứa `/pt/`: 200.
- `/ma-nguon`: 302. HEAD không gia hạn hoặc ghi thống kê link.
- `/pt-link`: 404 của ứng dụng. API quản trị chưa đăng nhập: 403 đúng
  middleware, không có thay đổi quyền truy cập.
- Bộ kiểm tra sau thay đổi: 26/26 đúng trạng thái dự kiến. Bộ trước thay
  đổi ban đầu dự kiến nhầm 401 cho API quản trị, đã đối chiếu source xác
  nhận hành vi đúng là 403. Không coi đây là lỗi ứng dụng hoặc WAF.

Security Events ghi nhận GET bên ngoài lúc 10:34:17 tới
`/pt/Jaime_V_da_Esc%C3%B3cia`, action Block, đúng rule ID ở trên.
Request này khác User-Agent và đường dẫn HEAD của bộ kiểm tra, nên không
nhầm với lưu lượng tự tạo. Các HEAD kiểm tra có tên
`codex-prefix-check-20261018`, User-Agent `Codex-Authorized-Edge-Smoke/1.0`.

Worker Metrics lần đọc sau thay đổi hiển thị 119 invocations, 0 errors
trong cửa sổ 30 phút. Cửa sổ còn chứa thời gian trước khi lưu và lượt kiểm
tra của agent. Chưa dùng số này để kết luận phần trăm giảm invocations
hoặc mọi bot đã bị chặn. Tổng HTTP request vẫn bao gồm request bị WAF chặn.

Bằng chứng cục bộ: `.local/cloudflare-prefix-update/`, gồm biểu thức trước/
sau, trạng thái HTTP, ảnh cấu hình, event và Worker Metrics. Không xuất
địa chỉ IP trong tài liệu này. Không đổi DNS, chính sách AI, rate limit,
database hoặc code ứng dụng trong lần cập nhật prefix.

Hoàn tác riêng thay đổi này: mở đúng rule và xóa năm điều kiện `/pt/`,
`/eu/`, `/ca/`, `/sr/`, `/it/`, giữ năm điều kiện cũ, host và action.
Không cần tắt toàn bộ rule hoặc deploy Worker.

## Bổ sung tiếp /nl/, /de/, /ce/ - 18/10/2026, khoảng 10:47

Sau khi các mẫu mới xuất hiện và chủ website yêu cầu chặn tiếp, đã bổ sung
`/nl/`, `/de/`, `/ce/` vào cùng rule `41750543f2f447a9b746b4f3aded49a7`.
Đã xác minh biểu thức lưu đủ 13 prefix, action Block, status Active.
Không có route hoặc asset hiện tại dùng ba prefix mới, mã link vẫn chỉ
có một đoạn và không khớp điều kiện có dấu `/` cuối prefix.

14 HEAD kiểm tra sau lưu đều đúng kết quả: ba prefix mới, `/NL/` và `/pt/`
trả 403. Trang chủ, about, dashboard, admin, config, robots, sitemap trả 200.
`/ma-nguon` vẫn 302, `/nl-link` vẫn 404 của ứng dụng. Bằng chứng trong
`.local/cloudflare-prefix-update/extra-http-after.json`,
`extra-rule-saved.txt`, `cloudflare-extra-prefixes-active.png`.
Các HEAD có User-Agent kiểm tra như trên, không tính chúng là bot bên ngoài.
Đây là xác minh cấu hình và HTTP, chưa phải phép đo mức giảm traffic.

## Xác minh lịch sử domain qua Wayback Machine - 18/10/2026

Đã đọc trực tiếp HTML bản lưu Internet Archive, không thực thi script cũ:

- [20/03/2024](https://web.archive.org/web/20240320141520/https://oh.io.vn/):
  website WordPress tên `ohiovn`, có bài mặc định `Hello world!`.
- [29/07/2024](https://web.archive.org/web/20240729141034/https://oh.io.vn/)
  và [08/09/2024](https://web.archive.org/web/20240908120112/https://oh.io.vn/):
  trang chủ hiển thị tiêu đề Wikipedia và danh sách bài viết, dạng bản sao
  nội dung bách khoa. Không suy ra quan hệ chính thức với Wikimedia.
- [Bài lưu ngày 08/09/2024](https://web.archive.org/web/20240908115723/https://oh.io.vn/en/1944%E2%80%9345_Substitute_Gold_Cup):
  có nội dung đầy đủ, bảng giải đấu và tài liệu tham khảo. Đây là bằng chứng
  đường dẫn bài viết `/en/...` từng phục vụ nội dung thật trên domain.
- [07/12/2024](https://web.archive.org/web/20241207001152/https://oh.io.vn/):
  trang hiển thị thông báo tên miền hết hạn và yêu cầu liên hệ nhà đăng ký.

Vì vậy không còn chỉ là giả thuyết domain bị ghép nhầm với các URL bách khoa:
domain thực sự từng phục vụ loại nội dung này. Crawler quay lại URL cũ là
lời giải thích có cơ sở cho mẫu lưu lượng, chưa chứng minh nguyên nhân từng
request, hãng AI hay danh tính người vận hành. Bản lưu không xác định chủ
thể đăng ký cũ, ngày đăng ký đầu tiên hoặc thời điểm chuyển chủ.

Không xác minh được bản lưu chính xác của cả ba URL `/nl/...`, `/de/...`,
`/fr/Anny_Duperey` trong lượt này. Hai truy vấn chính xác nl/fr không có bản
ghi 200, truy vấn de hết thời gian. Không suy ra chúng chưa từng tồn tại.
CDX toàn site ban đầu giới hạn 100 dòng và gom theo tháng, không phải kiểm
kê toàn bộ lịch sử domain. HTML gốc và kết quả CDX lưu ở `.local/domain-history/`.

## Rà 404 và bổ sung các prefix còn lọt - 18/10/2026, khoảng 22:28-22:44

Theo yêu cầu chủ website, đã lọc `Status code equals 404` trên Cloudflare
Requests trong cửa sổ 24 giờ. Tổng lúc đọc là khoảng 5,58k, khác số 5,68k của
lần đọc trước vì đây là cửa sổ trượt. Không coi toàn bộ 404 lịch sử là request
đang vượt qua các rule hiện tại.

Đã đọc 150 URL đứng đầu, sau đó loại 13 prefix đã có trong rule để đọc tiếp
150 URL thuộc nhóm còn lại (khoảng 1,3k request). Loại tiếp 14 prefix mới phát
hiện thì còn 245 request trên 70 đường dẫn, đã đọc đủ 70 dòng và đối chiếu
tổng 245. Các lần đọc diễn ra ở thời điểm gần nhau, không trừ các tổng giữa
những cửa sổ trượt để tuyên bố số request đã giảm. Bảng top paths không phải
log đầy đủ của từng request, các URL đồng hạng có thể đổi thứ tự.

Đã bổ sung 18 prefix thực tế quan sát vào rule bài viết
`41750543f2f447a9b746b4f3aded49a7`:

`/ja/`, `/id/`, `/vi/`, `/pl/`, `/uk/`, `/cs/`, `/tr/`, `/ro/`, `/hu/`,
`/zh/`, `/sv/`, `/ms/`, `/fi/`, `/sh/`, `/no/`, `/ar/`, `/wiki/`, `/blog/`.

Rule có tổng 31 prefix, tiếp tục dùng host `oh.io.vn`,
`starts_with(lower(http.request.uri.path), "/prefix/")`, action Block,
status Active, giữ vị trí sau rule dò file. Không chặn các mã chỉ có một
đoạn như `/wiki`, `/blog`, `/env`, `/ja-link` hoặc `/_ignition`.

Rule dò file `3c03584b2c9742cdb134603251453646` giữ toàn bộ điều kiện cũ,
bổ sung prefix `/.hg/`, `/_ignition/` và sáu đường dẫn chính xác, so khớp
không phân biệt hoa thường: `/AGENTS.md`, `/CLAUDE.md`, `/README.md`,
`/config.json`, `/config.js`, `/js/env.js`. Không chặn cả `/api/` hoặc `/js/`.
Các đường dẫn này đã được quan sát trả 404, không phải bằng chứng file bí
mật đang bị lộ. Các request `/.env` hoặc `/wp-content/` trong cửa sổ lịch sử
đã được rule cũ xử lý, không thêm điều kiện trùng.

Đối chiếu source xác nhận link rút gọn chỉ có một đoạn `/:slug`, mã 3-64
ký tự chữ, số, `_`, `-`. Các điều kiện bổ sung có dấu `/` cuối prefix hoặc
chứa dấu chấm trong tên file, nên không khớp mã link hợp lệ. Không có route
hoặc asset hiện tại nằm dưới 18 prefix nội dung mới. Nếu mở route mới ở các
nhánh này sau này, phải cập nhật WAF tương ứng trước khi phát hành.

Đã mở lại cả hai rule sau Save, đối chiếu chính xác biểu thức và trạng thái
Active. Kiểm tra production bằng HEAD không cookie, không theo redirect:

- Trước thay đổi: 51/51 kiểm tra đạt. 18 prefix và tám đường dẫn dò file mới
  trả 404. Một số lượt kiểm tra gặp timeout mạng, đã chạy lại với retry.
- Sau thay đổi: 54/54 kiểm tra đạt. Các đường dẫn mới, chữ hoa `/JA/`,
  `/BLOG/`, `/CONFIG.JSON` trả 403.
- Bảy trang chính, robots, sitemap, favicon SVG, CSS/JS, `/api/config`,
  `/api/me` và query chứa `/wiki/` trả 200. `/ma-nguon` vẫn 302.
- Các mã một đoạn kiểm tra giữ nguyên 404 của ứng dụng. API quản trị chưa
  đăng nhập vẫn 403. Không tạo hoặc xóa dữ liệu production để thử nghiệm.

Các request kiểm tra có User-Agent
`Codex-Authorized-Prefix-Verification/20261018`. Cửa sổ traffic sau thay đổi
còn chứa thời gian trước khi lưu và lượt kiểm tra của agent, nên không dùng
nó làm phép đo mức giảm traffic bên ngoài. `favicon.ico`, `favicon.png`,
`ads.txt` và mã không tồn tại vẫn được phép nhận 404 bình thường.

Bằng chứng ở `.local/404-prefix-followup/`, gồm ba lượt đọc đường dẫn, kế
hoạch và biểu thức trước/sau, `http-before-definitive.json`, `http-after.json`,
ảnh `rules-active.png`. Không thay DNS, chính sách quốc gia, Search/Agent/
Training, rate limit, Worker, database hoặc source ứng dụng.

Hoàn tác riêng lần này: xóa đúng 18 điều kiện prefix mới khỏi rule bài viết;
xóa hai prefix và nhóm sáu đường dẫn chính xác mới khỏi rule dò file. Giữ
13 prefix và toàn bộ điều kiện cũ, host, action, thứ tự và trạng thái Active.

## Bổ sung chặn dò WordPress và credentials - 19/10/2026

Theo yêu cầu chủ website, đã cập nhật trực tiếp rule dò file
`3c03584b2c9742cdb134603251453646` trên Cloudflare. Giữ host `oh.io.vn`,
action Block, vị trí First và trạng thái Active. Biểu thức tăng từ 635 lên
1.108 ký tự, giữ nguyên toàn bộ điều kiện cũ và rule bài viết/rate limit.

Điều kiện mới so khớp không phân biệt hoa thường:

- Prefix có dấu `/` cuối: `/wp-includes/`, `/.config/gcloud/`, `/_profiler/`.
- Đường dẫn chính xác: `/google-credentials.json`, `/google-key.json`,
  `/application_default_credentials.json`, `/credentials.json`,
  `/firebase-key.json`, `/gcp-credentials.json`, `/gcp-key.json`,
  `/gcp-sa.json`, `/key.json`, `/phpinfo.php.old`, `/info.php.bak`,
  `/phpinfo.php.save`.

Nguồn là 44 đường dẫn với tổng 46 request 404 trong cửa sổ 12 giờ đọc khoảng
18:45 cùng ngày. Các request này trước đó trả 404, không phải bằng chứng đã
lộ credentials. Không chặn `/info` hoặc `/phpinfo`: đây là mã một đoạn hợp lệ.
Cũng giữ `/wp-includes`, `/_profiler`, `/credentials`, `/google-key`, `/gcp-key`,
`/key` và các mã có hậu tố `-link`. Mọi prefix mới đều chứa đoạn con, mọi tên
file chính xác mới đều có dấu chấm, không khớp cú pháp mã `[a-zA-Z0-9_-]{3,64}`.

Đã kiểm tra 20 mẫu route trong Worker không khớp điều kiện bổ sung. Kiểm tra
HTTP production có kiểm soát đạt 46/46 trước và 46/46 sau thay đổi:

- 19 trường hợp dò file/prefix, gồm chữ hoa, chuyển 404 sang 403.
- 11 mã một đoạn giữ nguyên 404, không bị WAF mới chặn.
- Bảy trang chính, CSS/JS, robots, sitemap, favicon, config/me vẫn 200.
  Link `/ma-nguon` giữ 302, API admin chưa đăng nhập giữ 403.
- Chỉ HEAD không cookie, không theo redirect, cùng một GET trang chủ mỗi lượt
  để lấy tên CSS/JS. Không tạo, sửa hay đọc dữ liệu tài khoản production.

Đã mở lại editor và đối chiếu expression đã lưu khớp chính xác, xác nhận
Block/First/Active. Bằng chứng và script ở `.local/probe-rule-2026-10-19/`.
Các request kiểm tra có User-Agent `Codex-Authorized-Probe-Rule-Check/20261019`.
Không dùng cửa sổ traffic ngay sau sửa để kết luận mức giảm bên ngoài vì còn
request kiểm tra và dữ liệu trước thời điểm lưu. Không thay Worker, database,
DNS, chính sách AI/quốc gia hay deploy ứng dụng.

Hoàn tác riêng lần này: xóa ba điều kiện prefix và nhóm 12 tên file vừa thêm,
hoặc dùng trường `old` trong `plan.json` tại thư mục bằng chứng. Giữ toàn bộ
điều kiện có trước lần sửa, host, action, vị trí và trạng thái Active.
