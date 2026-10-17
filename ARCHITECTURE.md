# Kiến trúc và kế hoạch triển khai đề xuất

Ngày lập: 17/10/2026. Trạng thái: đề xuất trước khi viết mã; chưa tạo ứng dụng, tài nguyên cloud hoặc triển khai.

[REQUIREMENTS.md](REQUIREMENTS.md) là yêu cầu sản phẩm đã chốt. Những lựa chọn kỹ thuật bổ sung dưới đây là đề xuất để đáp ứng yêu cầu đó, chưa phải thay đổi sản phẩm được ngầm phê duyệt.

## 1. Kiến trúc tổng thể

Một repository, một ứng dụng Cloudflare Workers cùng Static Assets và một D1 ở giai đoạn đầu. Giữ giao diện và API cùng origin `oh.io.vn` để đơn giản hóa cookie, điều hướng và cấu hình bảo vệ.

```text
Người dùng
    |
    v
Cloudflare: DNS/TLS và các quy tắc bảo vệ khả dụng
    |
    +-- /, /assets/*, trang giới thiệu/hướng dẫn
    |       -> Static Assets: HTML, CSS, JavaScript, font
    |
    +-- /auth/*, /api/*
    |       -> Worker: Hono + TypeScript
    |              +-- Google OpenID Connect
    |              +-- Turnstile Siteverify
    |              +-- D1
    |
    +-- /<ma-link>
            -> Worker: kiểm tra link -> gia hạn -> HTTP 302
                                      +-> thống kê khi được phép

Tác vụ định kỳ -> giám sát, dọn dữ liệu theo lô nhỏ
Luồng sao lưu riêng -> kho riêng tư ngoài Cloudflare đang chạy
GitHub -> kiểm tra và phát hành mã nguồn, không xử lý từng lượt bấm
```

Không cần Vercel, Redis, KV, Queues hoặc Durable Objects ngay ở bản đầu. Chỉ bổ sung một thành phần khi phép đo hoặc yêu cầu chứng minh là cần.

## 2. Công nghệ đề xuất

| Phần | Lựa chọn | Lý do |
| --- | --- | --- |
| Ngôn ngữ | TypeScript | Dùng chung kiểu dữ liệu và kiểm tra hợp đồng frontend/backend |
| Frontend | Vite, HTML nhiều trang, TypeScript và CSS thuần | HTML có nội dung sẵn, ít mã trình duyệt, không cần SSR cho mỗi lượt mở trang |
| Backend | Hono trên Workers | Router/middleware gọn, có tài liệu tích hợp Workers chính thức |
| Dữ liệu | D1, SQL và migration có phiên bản | Kiểm soát truy vấn, chỉ mục và chi phí đọc/ghi; chưa cần ORM |
| Google | OpenID Connect Authorization Code, thư viện xác minh JWT phù hợp Workers | Tránh tự viết kiểm tra chữ ký và thuật toán xác thực |
| Phiên | Cookie opaque, bản ghi phiên trong D1 | Thu hồi được phiên khi khóa tài khoản |
| Chống bot | Turnstile Managed và xác minh phía máy chủ | Giảm tương tác thủ công, không chỉ dựa vào widget phía client |
| Xuất Excel | Thư viện XLSX chạy trình duyệt, tải khi bấm xuất | Không chạy tác vụ tạo workbook trên Worker; thư viện cụ thể được đánh giá trước khi chọn |
| Kiểm thử | Vitest với môi trường Workers/D1; kiểm tra trình duyệt cho luồng chính | Kiểm chứng quy tắc và hành vi runtime, không chỉ mock SQL |
| Phát triển/phát hành | Wrangler, lockfile, GitHub Actions | Kiểm tra trước triển khai; token giới hạn quyền |

Phiên bản thư viện sẽ được chọn ở lúc khởi tạo, không coi phiên bản mới nhất là mặc định an toàn. Kiểm tra khả năng tương thích và giấy phép.

Space Grotesk được phục vụ từ Static Assets với subset tiếng Việt phù hợp. Chỉ tải các icon Lucide được dùng. Trang chủ có nội dung giới thiệu/hướng dẫn sẵn trong HTML; không cần dùng một SPA lớn.

## 3. Giới hạn nền tảng ảnh hưởng trực tiếp đến thiết kế

Thông tin kiểm tra từ tài liệu chính thức ngày 17/10/2026; cần kiểm tra lại trước khi mở công khai:

| Tài nguyên | Mốc Free liên quan |
| --- | --- |
| Workers | 100.000 yêu cầu/ngày cấp tài khoản, 10 ms CPU cho HTTP request |
| D1 | 5 triệu hàng đọc/ngày, 100.000 hàng ghi/ngày |
| D1 dung lượng | 500 MB mỗi database, 5 GB tổng tài khoản |
| D1 Time Travel | 7 ngày trên Free; không thay thế bản sao ngoài nơi chạy chính |
| Static Assets | Yêu cầu được phục vụ trực tiếp dưới dạng tài nguyên tĩnh miễn phí; chạy Worker vẫn tính riêng |

Không quy đổi 100.000 yêu cầu thành 100.000 người dùng hoặc 100.000 lượt bấm có đầy đủ thống kê. Một lượt bấm có thể gây nhiều hàng ghi, kể cả cập nhật chỉ mục. Tách nhiều database không nhân hạn mức đọc/ghi của tài khoản.

Nguồn: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## 4. Route và giao diện

- `/`: giới thiệu ngắn, ô tạo link, sao chép, đăng nhập, thời hạn và liên kết đóng góp.
- `/dashboard`: giao diện quản lý; dữ liệu chỉ lấy sau kiểm tra phiên ở API.
- `/admin`: giao diện quản trị; mọi dữ liệu/thao tác đều kiểm tra quyền ở máy chủ.
- `/privacy`, `/terms`, `/report`, `/about`: trang tĩnh tiếng Việt.
- `/auth/google`, `/auth/callback`, `/auth/logout`: đăng nhập và đăng xuất.
- `/api/*`: API phục vụ giao diện của dự án, không phải API công khai cho bên thứ ba.
- `/<slug>`: chuyển hướng; một đoạn đường dẫn, không được lấn các route dành riêng.
- Tránh SPA fallback nuốt link không tồn tại. Không để file tĩnh trùng mã link hoặc che đường chuyển hướng.
- Đảm bảo asset được phục vụ trực tiếp; chỉ các đường cần xử lý mới chạy Worker. Kiểm thử cấu hình route thực tế.

Đề xuất quy tắc slug: mã ngẫu nhiên 8 ký tự chữ thường/số, sinh bằng nguồn ngẫu nhiên mật mã; mã tự chọn 3–64 ký tự ASCII chữ thường, số và dấu gạch ngang. Chuẩn hóa khi tạo, từ chối xung đột tên dành riêng; chi tiết này cần chốt trước khi công khai. Giới hạn độ dài URL đầu vào đề xuất 4.096 ký tự và giới hạn body nhỏ, có kiểm tra URL parser.

Chỉ hỗ trợ địa chỉ HTTP/HTTPS trong bản đầu. Từ chối URL có userinfo, scheme khác, link quay về vòng lặp dịch vụ và địa chỉ đích bị chặn. Không fetch trang đích để lấy tiêu đề, ảnh preview hoặc quét nội dung trong đường tạo/chuyển hướng.

## 5. Mô hình dữ liệu dự kiến

| Bảng | Vai trò |
| --- | --- |
| `users` | Google `sub` duy nhất, email, tên, trạng thái khóa |
| `sessions` | Hash token phiên, chủ phiên, thời hạn, trạng thái thu hồi |
| `links` | ID nội bộ, slug duy nhất, owner nullable, target, label, thời hạn, lần dùng gần nhất, trạng thái |
| `analytics_buckets` | Số lượt theo link/ngày/nhóm nguồn/nhóm thiết bị, không lưu từng sự kiện |
| `analytics_gaps` | Khoảng thời gian không thu đủ dữ liệu, cấp dịch vụ hoặc link khi cần |
| `creation_events` | Dấu tạo thành công tối thiểu để thực thi cửa sổ 24 giờ, dọn sau cửa sổ cần thiết |
| `runtime_state` | Chế độ giảm tải, cờ hoãn hết hạn, tình trạng giám sát và lần cập nhật |
| `blocked_targets` | Domain hoặc URL đã xác nhận cần chặn, lý do tối thiểu |
| `admin_audit` | Thao tác quản trị tối thiểu, xoay vòng tối đa 7 ngày |

- `links` giữ một bản ghi thu gọn khi bị xóa/hết hạn: slug và trạng thái cần thiết; dọn target và dữ liệu cá nhân không còn cần. Unique slug ngăn cấp lại mã.
- Lưu timestamp thống nhất; phép cộng tháng theo lịch Việt Nam dùng chung một hàm đã kiểm thử, không dùng cách cộng số ngày cố định.
- `last_access_at`, `idle_expires_at`, `fixed_expires_at` tách biệt; hạn có hiệu lực là giá trị nhỏ hơn nếu có hạn cố định.
- Chỉ mục theo slug, owner/trạng thái, ngày thống kê và cửa sổ tạo mới. Cân nhắc chi phí index trên cột thay đổi mỗi lượt bấm.
- Phân trang danh sách và giới hạn kết quả; tránh truy vấn quét toàn bảng trong đường phục vụ thường xuyên.
- Tránh cột đếm tổng link tài khoản dễ lệch nếu chưa chứng minh tính nhất quán; có thể đếm qua chỉ mục trong giao dịch tạo ở quy mô ban đầu.

## 6. Chuyển hướng, gia hạn và thống kê

### 6.1. Chuyển hướng

1. Từ chối sớm path không hợp lệ và yêu cầu bị chặn.
2. Đọc link bằng unique slug; kiểm tra trạng thái, hạn cố định và hạn không hoạt động.
3. Nếu hợp lệ, cập nhật gia hạn với thời điểm truy cập ở máy chủ; cập nhật phải an toàn khi có nhiều yêu cầu đồng thời và không ghi đè thời điểm mới bằng thời điểm cũ.
4. Trả HTTP 302 với `Cache-Control: no-store` ở bản đầu để việc sửa/xóa/khóa có hiệu lực qua các lần truy cập mới.
5. Nếu còn ngân sách thống kê và link có chủ, tăng bucket tương ứng ngoài phần quyết định chuyển hướng; lỗi thống kê không lật kết quả chuyển hướng.

Không cache lâu phản hồi chuyển hướng ở trình duyệt/CDN. Chưa thêm cache metadata ở bản đầu; chỉ tối ưu sau khi có thiết kế vô hiệu hóa cache và phép đo cần thiết. Cache D1 không được coi là cách xóa hạn mức Worker.

### 6.2. Chi phí gia hạn

Yêu cầu gia hạn theo mỗi lượt bấm làm phát sinh ghi dữ liệu ngay cả khi tắt thống kê. Thiết kế ban đầu giữ chính xác quy tắc thời hạn, không âm thầm gom gia hạn theo ngày hoặc dùng lấy mẫu.

Mỗi đường chuyển hướng cần đo số hàng đọc/ghi thực tế, kể cả index. Gia hạn là công việc thiết yếu, được ưu tiên hơn thống kê. Nếu phép đo cho thấy không đáp ứng mục tiêu, cần trình bày đánh đổi trước khi đổi độ chính xác hoặc cơ chế lưu, không hứa tải vượt số đo.

### 6.3. Sự cố ghi nhận truy cập

Khi không ghi được gia hạn nhưng vẫn có thể phục vụ địa chỉ đích, cho chuyển hướng và bật trạng thái sự cố qua kênh khả dụng. Giám sát phải phát hiện cả trường hợp Worker không ghi được cờ vào D1.

Tạm dừng dọn link chưa đủ: kiểm tra hết hạn lúc chuyển hướng cũng phải tôn trọng khoảng sự cố có liên quan. Cần định nghĩa một cơ chế gia hạn an toàn sau sự cố hoặc trạng thái hoãn áp dụng hạn không hoạt động, trong khi hạn cố định và khóa lạm dụng vẫn có hiệu lực. Nếu không thể xác định khoảng mất dữ liệu đáng tin cậy, giữ hoãn có kiểm soát để quản trị xử lý trước khi bật lại. Phải kiểm thử mất ghi, mất giám sát và phục hồi trước khi công khai.

### 6.4. Thống kê

- Chỉ ghi cho link có chủ; link khách vẫn được gia hạn nhưng không cần ghi các chiều thống kê.
- Một bucket cho mỗi tổ hợp link/ngày Việt Nam/nhóm nguồn/nhóm thiết bị; upsert đếm thay vì lưu raw event.
- Đề xuất phân nhóm nguồn hữu hạn cho các nguồn phổ biến; phần còn lại là `Khác`, thiếu referrer là `Không xác định`. Ghi rõ nhóm trên giao diện để tránh tạo kỳ vọng theo dõi từng domain tùy ý. Khả năng cần tên domain chi tiết được xác nhận trước khi code phần này.
- Giới hạn số bucket và thời gian truy vấn; không cho hostname giả tạo số chiều vô hạn.
- Tác vụ dọn chỉ xóa bucket ngoài cửa sổ 30 ngày, không chạm thông tin gia hạn.
- `waitUntil` có thể tách công việc phụ khỏi phản hồi nhưng không làm công việc đó miễn phí hoặc bảo đảm đã ghi thành công.
- Excel tải dữ liệu có phân trang/giới hạn, tạo file cục bộ; ghi URL và nhãn dưới dạng text để tránh công thức không mong muốn trong workbook.

## 7. Đăng nhập, phiên và bảo vệ dữ liệu

- Authorization Code với `state`, `nonce` và PKCE khi thư viện/flow hỗ trợ; redirect URI cố định trong cấu hình.
- Kiểm tra chữ ký ID token, issuer, audience, hạn và nonce; dùng Google `sub` làm định danh ổn định, không lấy email làm khóa danh tính.
- Chỉ xin scope cần thiết cho đăng nhập; không xin quyền Drive, Gmail hoặc lưu refresh token Google nếu không có nhu cầu.
- Cookie phiên có `HttpOnly`, `Secure`, `SameSite` phù hợp; lưu hash token phía máy chủ, thu hồi khi khóa tài khoản.
- API ghi dữ liệu kiểm tra origin/CSRF và quyền sở hữu từ phiên, không tin `owner_id` client gửi.
- Quyền admin kiểm tra theo Google `sub` được cấu hình; không cho người dùng tự nâng quyền bằng thông tin profile.
- Dùng SQL tham số hóa, giới hạn body/kết quả và render nội dung người dùng dưới dạng text.
- Quản lý bí mật qua Cloudflare secrets và môi trường local không được commit.

Khóa tài khoản cần hai thao tác quản trị rõ: ngăn đăng nhập/tạo/sửa; và vô hiệu hóa link liên quan khi cần xử lý lạm dụng. Không âm thầm làm hỏng mọi link chỉ vì chủ tài khoản bị hạn chế đăng nhập.

## 8. Giới hạn và giảm tải

### 8.1. Hai lớp bộ đếm

- Bộ giới hạn tốc độ Workers dùng để chặn dồn dập trong cửa sổ ngắn. Nó hoạt động theo vị trí Cloudflare và có tính nhất quán cuối cùng, không đủ làm bộ đếm chính xác toàn cầu.
- Hạn mức tạo 24 giờ và 100 link hoạt động dùng D1, truy vấn có chỉ mục và thao tác nguyên tử. Giữ dấu tạo thành công 24 giờ để thực thi đúng cửa sổ trượt, không gọi một ngày lịch là 24 giờ trượt.
- Thiết kế SQL/batch phải bảo đảm mọi kiểm tra và ghi nhận tạo mới cùng thành công hoặc cùng không thành công. Không dùng kiểm tra `COUNT` rồi `INSERT` ở hai yêu cầu độc lập. Chứng minh bằng kiểm thử cạnh tranh; xác nhận khả năng giao dịch thực tế của D1 trước khi chốt migration.
- IP dùng từ thông tin Cloudflare tin cậy, không tin header client tùy ý; lưu khóa HMAC phục vụ hạn mức thay cho raw IP lâu dài. Vòng đời khóa không được tạo khe hở vượt cửa sổ 24 giờ.
- Turnstile kiểm tra ở server, hostname/action đúng, token dùng một lần. Không tin token giả hoặc chỉ widget đã hiển thị.

Nguồn: [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

### 8.2. Giám sát và chế độ phục vụ

- Dùng số liệu tài khoản/nền tảng, kết hợp `meta.rows_read/rows_written` trong phép đo; không thêm một lần ghi D1 chỉ để đếm mọi request.
- Tác vụ giám sát định kỳ cập nhật snapshot và chế độ. Số liệu trễ được thể hiện bằng thời điểm cập nhật; có cảnh báo khi snapshot cũ.
- Ngưỡng 70/80/90% là cấu hình thử nghiệm theo từng tài nguyên. Dự trù riêng ngân sách gia hạn, truy vấn quản lý, dọn dữ liệu và vận hành.
- Giảm thống kê trước khi giảm gia hạn. Khi hạn mức ghi căng, giữ vùng dự trữ cho gia hạn và bảo trì thay vì đợi đến 100%.
- UI biết chế độ qua một API trạng thái nhỏ; không polling liên tục và không phát sinh ghi dữ liệu theo lần mở trang.
- Cờ thủ công gồm tắt tạo khách, tắt tạo toàn bộ, tắt analytics, hoãn hết hạn do sự cố. Có cách dùng Cloudflare dashboard khi trang admin không hoạt động.
- Không chặn chuyển hướng chỉ vì hết hạn mức tạo mới. Không tự từ chối link khách chỉ để ưu tiên thành viên nếu việc đó vẫn tốn cùng một lượt Worker mà không tiết kiệm được tài nguyên cần thiết.
- Triển khai kiểm soát trước Worker theo tính năng Free thực tế; xác nhận tài khoản có tính năng gì trước khi hứa cấu hình. Không coi chống DDoS là bảo đảm quota không bị tiêu hao.

## 9. Tác vụ dọn và sao lưu

- Tác vụ định kỳ chia lô nhỏ, có điểm tiếp tục, giới hạn số hàng mỗi lần; tính chi phí DELETE và index.
- Hoãn dọn link khi ghi nhận truy cập không đáng tin; vẫn có thể dọn dữ liệu khác an toàn nếu còn ngân sách.
- Sao lưu dự kiến một lần/ngày, mã hóa trước khi lưu ngoài Cloudflare chạy chính.
- Đề xuất ban đầu giữ 7 bản ngày xoay vòng; phải tính tổng dung lượng và hạn mức lưu trước khi chọn kho.
- Có thể dùng một repository GitHub private riêng với workflow backup và artifact riêng tư có retention giới hạn, chỉ sau khi kiểm tra dung lượng miễn phí của tài khoản. Không dùng repository public hoặc public artifact cho dữ liệu thật.
- Không hard-code phương án GitHub artifact nếu ngân sách không đủ; cần chọn kho riêng tư khác hoặc lịch/retention phù hợp và được chủ dự án biết. Không bật dịch vụ trả phí để lấp thiếu hụt.
- Trước khi mở công khai phải chốt nơi lưu, chạy tự động thành công và restore sang D1 thử nghiệm; mục tiêu mất dữ liệu tối đa giữa hai backup thành công ban đầu khoảng 24 giờ, không coi là SLA.
- Cách yêu cầu xóa tài khoản đề xuất: liên hệ email, xác minh quyền sở hữu; vô hiệu hóa các link liên quan, xóa dữ liệu cá nhân phù hợp và giữ dấu slug tối thiểu. Cần chốt cách giải thích với người dùng và thời hạn xử lý.

## 10. Cấu trúc mã nguồn dự kiến

```text
REQUIREMENTS.md
ARCHITECTURE.md
src/
  web/                 # HTML, CSS, TypeScript; trang công khai và quản lý
  worker/
    routes/            # auth, links, analytics, admin, redirect
    services/          # vòng đời, quyền, hạn mức, thống kê, giảm tải
    db/                # truy vấn có tham số
    jobs/              # dọn dữ liệu, giám sát
  shared/              # kiểu dữ liệu, kiểm tra đầu vào và lịch tháng
migrations/
tests/
scripts/               # công cụ vận hành/backup khi được triển khai
wrangler.jsonc
```

Không cần chia thành nhiều repository hoặc nhiều ứng dụng backend. Giữ API interface rõ để có thể tối ưu tầng lưu sau này mà không đổi quy tắc sản phẩm.

## 11. Kế hoạch triển khai theo chặng

### Chặng 0: đặc tả và kiểm chứng ngân sách

- Chốt các chi tiết còn mở trong mục 12; kiểm tra công cụ local và phiên bản thư viện.
- Lập bảng ngân sách: tạo khách/thành viên, đăng nhập, chuyển hướng kèm gia hạn, analytics, admin, dọn dữ liệu và yêu cầu bị chặn.
- Khi bắt đầu code, làm thí nghiệm tối thiểu trên môi trường local/test để kiểm chứng D1 nguyên tử và đo đường quan trọng; kiểm tra CPU trên Workers test trước khi kết luận đủ Free.
- Chọn kho backup và retention phù hợp hạn mức thật của chủ dự án.
- Điều kiện qua chặng: không có giả định ngầm rằng mỗi click chỉ tốn một hàng ghi hoặc các bộ đếm ngắn là quota toàn cầu.

### Chặng 1: nền tảng và vòng đời link

- Khởi tạo build, Worker, migration, kiểm tra cấu hình; không dùng dữ liệu thật.
- Viết và kiểm thử lịch tháng, hết hạn, unique slug, tombstone, URL validation.
- Hoàn thành tạo khách, sao chép, chuyển hướng 302 và hạn mức nguyên tử.
- Điều kiện qua chặng: kiểm thử hết hạn, không hồi sinh, không cấp lại mã và yêu cầu đồng thời đều đạt.

### Chặng 2: Google và quản lý link

- Tích hợp Google, phiên, quyền sở hữu và đăng xuất.
- Danh sách/tìm kiếm có phân trang, mã tùy chỉnh, nhãn, sửa target, xóa và hạn cố định.
- Áp dụng 20 link/24 giờ và 100 link hoạt động; không nhận lại link khách.
- Điều kiện qua chặng: không truy cập chéo dữ liệu; không vượt quota khi tạo đồng thời.

### Chặng 3: thống kê và Excel

- Ghi bucket, hiển thị 30 ngày, thiết bị/nguồn, khoảng thiếu dữ liệu.
- Xuất XLSX tại client, thư viện chỉ tải khi dùng; kiểm tra dữ liệu mở được và chuỗi không thành công thức.
- Đo lại chi phí khi có analytics và khi tắt analytics; kiểm chứng gia hạn vẫn chạy.
- Điều kiện qua chặng: số liệu có giới hạn rõ, không giữ raw event không cần thiết và không che khoảng mất dữ liệu.

### Chặng 4: bảo vệ, quản trị và sự cố

- Turnstile thật ở môi trường test, kiểm tra token và giới hạn ngắn.
- Admin, khóa link/tài khoản, danh sách chặn, cờ giảm tải và giám sát.
- Mô phỏng lỗi D1 ghi/đọc, snapshot cũ, burst, link lừa đảo được báo cáo và phục hồi.
- Điều kiện qua chặng: thao tác khẩn cấp dùng được; hoãn hết hạn và dọn không xóa nhầm link.

### Chặng 5: giao diện, nội dung và sẵn sàng vận hành

- Hoàn thiện giao diện tối giản, font tiếng Việt, Lucide, điện thoại, bàn phím và trạng thái lỗi.
- Nội dung công khai, SEO cơ bản, sitemap trang nội dung, privacy/terms/report/about, đóng góp nếu cấu hình.
- Không index dữ liệu riêng tư; crawler không được dùng làm lý do bỏ kiểm tra quyền.
- Backup tự động và restore thử; kiểm tra secrets, log retention và hướng dẫn vận hành.
- Điều kiện qua chặng: toàn bộ checklist trong REQUIREMENTS.md có bằng chứng kiểm chứng.

### Chặng 6: mở thử có kiểm soát

- Cấu hình tài khoản thật, DNS, OAuth, Turnstile, D1 và workflow phát hành khi đến bước triển khai.
- Chạy kiểm tra trên domain thật với lượng truy cập nhỏ; kiểm tra có số đo usage/CPU/rows thay vì chỉ suy luận từ local.
- Giữ giới hạn khởi đầu 3/20/100/200, điều chỉnh khi có bằng chứng và ghi lý do.
- Theo dõi gián đoạn thống kê, lỗi chuyển hướng, tốc độ tăng dung lượng và hiệu quả giảm tải; có cách rollback mã và phục hồi dữ liệu.

## 12. Những điểm cần chốt kỹ thuật trước phần code tương ứng

Yêu cầu sản phẩm cốt lõi đã đủ để bắt đầu sau khi chủ dự án xem đề xuất. Các điểm sau là lựa chọn thực thi chưa có trong phần đã chốt:

1. Quy tắc slug/độ dài URL đề xuất ở mục 4.
2. Nhóm nguồn thống kê hữu hạn hay cần tên từng domain; đề xuất nhóm hữu hạn ở bản đầu.
3. Thời hạn phiên và cách xử lý xóa tài khoản; đề xuất phiên 7 ngày và tiếp nhận yêu cầu xóa qua email ở bản đầu.
4. Thao tác khóa tài khoản và phạm vi link bị vô hiệu hóa; đề xuất hai thao tác rõ ở mục 7.
5. Thuật toán hoãn hết hạn sau mất ghi nhận truy cập, cơ chế giám sát thật và tính nguyên tử của giới hạn; phải kiểm chứng bằng thử nghiệm.
6. Nơi lưu backup ngoài Cloudflare, dung lượng và retention; chỉ chốt khi kiểm tra tài khoản, không tự phát sinh chi phí.

Không cần chủ dự án tự lựa chọn SQL, thư viện hoặc cấu trúc code. Mọi thay đổi ảnh hưởng thời hạn, quyền, độ chi tiết thống kê hoặc cam kết phí phải được trình bày rõ.

## 13. Tài liệu tham khảo chính

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- [Cloudflare Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
- [Cloudflare D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).
- [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
- [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers).
