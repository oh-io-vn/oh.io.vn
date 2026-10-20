# SEO, AEO và GEO của oh.io.vn

## Phạm vi và nguồn nội dung

oh.io.vn là công cụ rút gọn link bằng tiếng Việt. Người dùng có thể tạo link
không cần tài khoản. Đăng nhập Google trước khi tạo cho phép quản lý, chỉnh sửa
và xem thống kê của link. Không suy ra nhân khẩu học, khách hàng hoặc thành tích
từ những chức năng này.

Website dùng Vite nhiều trang, sinh HTML tĩnh bằng `scripts/generate-pages.mjs`.
Cloudflare Workers xử lý API, xác thực và chuyển hướng link. Nội dung công khai
đã có trong response HTML, không cần chuyển sang SSR hoặc đổi framework.

| Trang                    | Mục đích                                       | Chính sách                     |
| ------------------------ | ---------------------------------------------- | ------------------------------ |
| `/`                      | Tạo link ngắn miễn phí                         | Có thể index                   |
| `/about/`                | Cách dùng, quyền quản lý, thời hạn và giới hạn | Có thể index                   |
| `/privacy/`              | Giải thích dữ liệu được xử lý                  | Có thể index                   |
| `/terms/`                | Quy định sử dụng                               | Có thể index                   |
| `/report/`               | Hướng dẫn báo cáo link vi phạm                 | Có thể index                   |
| `/dashboard/`, `/admin/` | Giao diện tài khoản và quản trị                | Noindex, API kiểm tra quyền    |
| `/api/*`, `/auth/*`      | Dữ liệu và xác thực                            | Noindex, no-store              |
| `/:slug`                 | Chuyển hướng link do người dùng tạo            | Không đưa vào sitemap, noindex |

## Hợp đồng kỹ thuật

- `scripts/seo.mjs` quản lý domain chuẩn `https://oh.io.vn`, metadata, JSON-LD
  và sitemap. Trang chỉ được đưa vào sitemap khi có `indexable: true`.
  `private: true` luôn loại trang khỏi phạm vi index.
- Title, description, canonical, Open Graph và Twitter Card có trong HTML ban
  đầu. Trang riêng tư không có canonical, schema hoặc metadata chia sẻ công khai.
- `/sitemap.xml` được sinh cùng các trang, không chứa ngày cập nhật giả.
  `/robots.txt` giữ nguyên các quy tắc đã có. Không dùng robots làm cơ chế bảo mật.
- Các trang tĩnh dùng trailing slash. Cloudflare chuẩn hóa `/about` và
  `/about.html` về `/about/`, `/index.html` về `/`. Không đổi mã link người dùng.
- `X-Robots-Tag` của Worker áp dụng cho API, auth, chuyển hướng và lỗi. Các trang
  công khai do assets binding phục vụ trước Worker vẫn có thể index.
- Chỉ `/assets/*` có tên chứa content hash được cache lâu với `immutable`.
  HTML tiếp tục revalidate. API và dữ liệu tài khoản giữ `no-store`.
- Ảnh chia sẻ `public/social-card.png` là PNG 1200 × 630. Favicon SVG, PNG 48 × 48
  và ICO dùng cùng logo. Sinh lại bằng `scripts/generate-social-card.mjs` khi cần.

## Nội dung và dữ liệu có cấu trúc

Trang giới thiệu trả lời trực tiếp cách tạo link, có cần đăng nhập không, sửa mã
thế nào, khi nào link hết hạn và hạn mức nào đang được công bố. Các bước, mục lục
và liên kết nội bộ phục vụ người đọc. Nội dung phải tiếp tục khớp với API và quy
tắc sản phẩm, đặc biệt việc mã cũ ngừng hoạt động sau khi đổi mã.

JSON-LD gồm WebSite và WebApplication tại trang chủ, WebPage cho trang thông tin,
AboutPage cho giới thiệu và ContactPage cho báo cáo. `@id` ổn định kết nối trang
với website và ứng dụng. Giá 0 phản ánh dịch vụ miễn phí đang công bố, không phải
một gói trả phí hoặc cam kết vĩnh viễn. Không khai báo đánh giá, xếp hạng, người
sáng lập hoặc tổ chức chưa được xác minh.

Schema.org hợp lệ và Google Rich Results Test nhận diện được mục ứng dụng không
chứng minh website đã được index hay được hiển thị rich result. Khi kiểm tra ngày
18/10/2026, tài liệu SoftwareApplication của Google yêu cầu thông tin đánh giá
để đủ điều kiện hiển thị, trong khi công cụ có thể chỉ đánh dấu thiếu thông tin
này là cảnh báo không nghiêm trọng. Không tạo đánh giá giả để xóa cảnh báo.

Lần kiểm tra cuối nhận diện 1 mục hợp lệ, với 2 cảnh báo không nghiêm trọng:
thiếu `aggregateRating` và `offers.priceCurrency`. Dịch vụ đang miễn phí, đã khai
báo giá 0 và không có giá giao dịch theo một đồng tiền cụ thể. Không thêm dữ liệu
đánh giá hoặc cam kết thanh toán chỉ để làm sạch báo cáo công cụ.

Không thêm FAQ rich-result schema, `llms.txt`, blog hàng loạt hoặc quy tắc riêng
cho AI crawler. Chưa có bằng chứng cần các thay đổi đó. Google công bố không cần
file AI hay schema đặc biệt để được xem xét cho các tính năng AI trong Search.

## Kiểm chứng

Chạy từ thư mục gốc:

```powershell
npm run build
npm test
npx wrangler dev --port 8794 --local --var ENVIRONMENT:development --log-level error
```

`npm run build` gồm typecheck, build Vite và Wrangler dry-run, không deploy.
Trong terminal khác, dùng Playwright đã cài của môi trường:

```powershell
# Trỏ tới package.json của Playwright đã có nếu project không resolve được nó.
$env:PLAYWRIGHT_PACKAGE = '<duong-dan-tuyet-doi>/playwright/package.json'
$env:UI_ORIGIN = 'http://localhost:8794'
node scripts/check-seo.mjs
```

Script chỉ chấp nhận localhost, kiểm tra response và DOM, canonical, sitemap,
internal links, JSON-LD, noindex, status/redirect, favicon, cache, nội dung không
JS và bàn phím ở mục lục. Chụp 5 trang ở 1440, 768 và 390 px. API tài khoản/cấu
hình và Turnstile trong lượt chụp dùng fixture browser, không truy cập tài khoản
hoặc ghi production. HTTP checks riêng gọi Worker local thật.

`tests/seo.node.test.mjs` chạy trong `npm test`. Test gồm metadata riêng từng
trang, sitemap chỉ chứa trang công khai, default noindex, JSON-LD escaping,
kích thước ảnh, cache và robots. Vitest chỉ khám phá test trong `tests/`.

Chạy thêm `scripts/test-ui.mjs` và `scripts/test-admin-ui.mjs` khi thay đổi ảnh
hưởng các component dùng chung. Xem screenshot thực tế, không chỉ đếm file ảnh.
Khởi động lại Wrangler sau mỗi build để tránh manifest assets cũ.

Bằng chứng audit và ảnh trước/sau nằm trong `.local/seo/`, không theo dõi bằng
Git. Chúng có thể chứa số liệu nội bộ nên không đưa vào public assets.

## Đo lường sau khi được phép phát hành

1. Xác nhận bản deploy đúng commit, public pages trả 200 và metadata mới nằm
   trong response production. Kiểm tra lại sitemap và header noindex.
2. Chọn đúng property oh.io.vn trong Search Console. Nếu chưa có quyền/property,
   cần chủ sở hữu thiết lập hoặc cấp quyền trước. Không dùng số liệu domain khác.
3. Gửi sitemap production và dùng URL Inspection cho trang chủ, giới thiệu.
   Ghi nhận trạng thái Google trả về, không suy ra đã index từ test local.
4. Theo dõi impressions, clicks, CTR, vị trí, truy vấn và trang được index theo
   cửa sổ thời gian đủ dài. Lưu ngày thay đổi và so sánh cùng khoảng thời gian.
5. Đo Core Web Vitals bằng dữ liệu người dùng thật khi có. Lighthouse localhost
   là dữ liệu lab. TBT không thay thế INP và một lần đo không chứng minh CWV đạt.
6. Chỉ báo cáo AI citation/mention khi có URL nguồn, câu hỏi, công cụ và ngày kiểm
   chứng. AI referral cần nguồn dữ liệu hợp lệ, không suy ra từ crawler requests.

Việc gửi sitemap, yêu cầu crawl, thiết lập property, bật analytics hoặc thay đổi
Cloudflare/DNS phải được xét theo quyền và yêu cầu của chủ website tại thời điểm
thực hiện. Audit source không đồng nghĩa được phép thay đổi production.

## Nguồn chính thức

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: Site names](https://developers.google.com/search/docs/appearance/site-names)
- [Google: Robots meta tags và X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google: SoftwareApplication structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- [Schema.org Validator](https://validator.schema.org/)
- [Google Rich Results Test](https://search.google.com/test/rich-results)

## Search Console và lịch sử Wikipedia - kiểm tra ngày 18/10/2026

Đã kiểm tra trực tiếp property Domain `sc-domain:oh.io.vn` bằng phiên Chrome
được chủ website cho phép. Báo cáo Lập chỉ mục trang và Hiệu suất còn hiển thị
đang xử lý dữ liệu, yêu cầu kiểm tra lại sau khoảng một ngày. Không thể suy
ra toàn domain có 0 trang được index hoặc đã dọn sạch toàn bộ URL lịch sử.

URL Inspection riêng cho sáu URL cũ đều trả `URL không nằm trên Google`,
nguyên nhân `Google không xác định được URL`:

- `/en/1944–45_Substitute_Gold_Cup`
- `/nl/National_Association_for_the_Advancement_of_Colored_People`
- `/fr/Anny_Duperey`
- `/de/Golden_Globe_Award/Bester_Hauptdarsteller_–_Drama`
- `/cs/2._česká_fotbalová_liga_2009/10`
- `/en/List_of_flag_bearers_for_Bahrain_at_the_Olympics`

Hai URL cuối vẫn xuất hiện ở mục trang giới thiệu trong dữ liệu khám phá
trang chủ. Đây là dấu vết khám phá lịch sử, không chứng minh chúng còn được
index. Trang chủ và `/about/` trước yêu cầu mới được báo đã phát hiện nhưng
chưa lập chỉ mục. Không có nội dung Wikipedia cũ trong HTML hiện tại.

### Các bước đã thực hiện và kiểm chứng

- Sitemap `https://oh.io.vn/sitemap.xml` đang có trạng thái Thành công,
  lần đọc 18/10/2026, 5 URL được khám phá. Năm URL đều là trang công khai
  hiện tại, không có URL bài viết, admin, dashboard hoặc link người dùng.
  Không gửi lại sitemap không thay đổi chỉ để tăng số thao tác.
- Hình phạt thủ công và Vấn đề bảo mật đều báo không phát hiện vấn đề.
  Mục yêu cầu xóa tạm thời không hiển thị yêu cầu đã gửi trong 6 tháng.
- Production: năm trang công khai trả 200, title/description/H1 riêng,
  canonical HTTPS đúng, không có noindex. JSON-LD parse được và trang chủ
  có WebSite `oh.io.vn` cùng WebApplication `UtilitiesApplication`.
- Google live test trang chủ lúc 10:59 báo có thể lập chỉ mục. Đã mở HTML
  Google vừa tải, xác nhận title rút gọn link miễn phí, mô tả dịch vụ,
  canonical `https://oh.io.vn/` và WebSite/WebApplication hiện tại.
- Google live test `/about/` lúc 11:02 cũng báo có thể lập chỉ mục.
- Google đã xác nhận nhận yêu cầu lập chỉ mục trang chủ và `/about/`, thêm
  cả hai URL vào hàng đợi ưu tiên. Đây là yêu cầu crawl, chưa phải xác nhận
  đã index.
- reCAPTCHA ban đầu lỗi kết nối. Tải lại trang, chạy live test và gửi lại
  một lần cho mỗi URL đã giải quyết được lỗi, không giải CAPTCHA thủ công
  hoặc thay đổi bảo vệ trình duyệt để vượt qua xác minh.

### Chính sách xử lý URL cũ

Không tạo yêu cầu xóa hàng loạt chỉ vì URL xuất hiện trong log hoặc Wayback.
Sáu URL mẫu không đang được index và chưa có nhu cầu xóa khẩn được xác minh.
Google khuyến cáo không dùng Removals chỉ để dọn URL cũ đã ngừng phục vụ.

Các URL bài viết đã kiểm tra dưới prefix WAF hiện trả 403 có meta noindex,
không trả 200 hoặc chuyển về trang chủ. Route không tồn tại ngoài WAF tiếp
tục trả 404/noindex của Worker. Theo tài liệu Google, các lỗi 4xx ngoại trừ
429 khiến nội dung không được dùng cho index và URL đã index bị loại khi
Google xử lý lại. Không thêm robots Disallow cho các prefix cũ, vì cần để
crawler nhận được trạng thái lỗi. Không nới WAF hoặc đổi chính sách AI trong
lượt kiểm tra này.

Cần kiểm tra lại báo cáo khi Google xử lý xong dữ liệu property để xác định
có URL lịch sử khác còn được index hay không. Thời gian Google chọn index,
cập nhật tên website và kết quả tìm kiếm không do ứng dụng kiểm soát.

Bằng chứng và ảnh thực tế nằm trong `.local/search-console-cleanup/`, gồm
URL Inspection, sitemap, manual actions, security issues, removals, HTML do
Google tải, yêu cầu index và audit production. Không đưa dữ liệu nội bộ này
vào public assets. Lượt kiểm tra này chỉ cần cập nhật tài liệu, không có lỗi
source metadata được xác minh cần sửa và không phát hành code ứng dụng.

Nguồn bổ sung:

- [Google: HTTP status codes](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes)
- [Google: Removals, phạm vi và giới hạn](https://support.google.com/webmasters/answer/9689846)
