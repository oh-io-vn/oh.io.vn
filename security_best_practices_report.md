# Báo cáo bảo mật oh.io.vn

Ngày kiểm tra: **18/10/2026**. Nhánh `main`, nền `ac4aa3a`.
Phạm vi là working tree hiện tại, gồm thay đổi SEO đã có trước lượt audit.
Không commit, push, deploy, đổi credential hoặc kiểm thử khai thác production.

## Kết quả

**Hai lỗ hổng MEDIUM được tái hiện và sửa**, cùng **hai nhóm hardening LOW**.
Không xác minh được lỗ hổng CRITICAL/HIGH trong phạm vi đã kiểm tra. Đây không
phải chứng nhận ASVS, kết quả pentest production hoặc bảo đảm không còn lỗ hổng.

| ID | Phân loại | Mức độ | Vấn đề | Trạng thái |
| --- | --- | --- | --- | --- |
| SEC-001 | Confirmed vulnerability | MEDIUM | Fragment vượt qua chặn URL | Sửa và kiểm thử local |
| SEC-002 | Confirmed vulnerability | MEDIUM | Hostname có dấu chấm cuối vượt qua kiểm tra đích/chặn host | Sửa và kiểm thử local |
| SEC-003 | Security hardening | LOW | API đọc chưa có throttle, API ghi truy vấn D1 trước throttle | Thêm bảo vệ, chưa đo tải production |
| SEC-004 | Security hardening | LOW | CI chưa có secret/dependency gate, Actions chưa ghim SHA | Bổ sung và xác thực local, CI remote chưa chạy |

## Phương pháp và skills

Đã kiểm tra nguồn chính thức `openai/skills`, commit
`49f948faa9258a0c61caceaf225e179651397431`, đọc hai SKILL.md rồi cài project-local
`security-best-practices` và `security-threat-model` bằng Skills CLI 1.7.2 đã xác
minh. Lifecycle scripts và telemetry tắt. Hash SKILL.md sau cài khớp bản đã đọc.
Đã dùng `skill-installer` để kiểm tra quy trình cài. Không cài lại các skill khác.
Không có reference Hono/Workers riêng trong bộ skill, nên review backend dựa
trên code thực tế và tài liệu nền tảng, không áp quy tắc Express vào Hono.

Đối chiếu [OWASP Top 10:2025](https://top10.owasp.org/2025/) và
[OWASP ASVS 5.0](https://owasp.org/projects/asvs) theo các bề mặt hiện có:
auth/session, quyền đối tượng, input/query, API, DOM, cấu hình, dependency và CI.
Không có password/reset password, upload file, NoSQL, template server hoặc
server-side fetch URL đích trong ứng dụng này.

Tools: Gitleaks 8.30.1 local với redact 100%, npm audit, Actionlint 1.7.12,
Vitest/Miniflare D1, Node test, TypeScript, Vite/Wrangler dry-run và Chrome/Playwright.
Gitleaks và Actionlint tải từ release repository chính thức, kiểm tra SHA-256
trước chạy. Semgrep/CodeQL/OSV-Scanner không có sẵn, không cài thêm cả bộ SAST.
Đã review source-to-sink thủ công. Không gửi source hoặc secret tới scanner ngoài.
Npm audit chỉ gửi metadata dependency theo giao thức npm.

## SEC-001 - Vượt qua chặn URL bằng fragment

**Ảnh hưởng:** người tạo link có thể tiếp tục dẫn người dùng tới tài nguyên đã
bị admin chặn bằng cách thêm hoặc thay phần `#...`. Cần vượt qua Turnstile và
quota tạo link để tạo mới, hoặc có link thuộc quyền để sửa. Không cho phép đọc
dữ liệu người khác hay chiếm quyền quản trị.

- Điểm vào: target của `POST /api/links`, PATCH sửa link và target đã lưu khi mở slug.
- Nguyên nhân: `blocked()` so sánh toàn bộ `URL.toString()`, bao gồm fragment.
  Fragment được xử lý phía trình duyệt và không gửi tới HTTP server đích.
  [MDN URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment).
- Bằng chứng trước sửa: local fixture chặn `https://example.com/blocked`, biến
  thể `#different` vẫn tạo được (201), sửa admin được (200) và redirect được (302).
- File sửa: `src/shared/rules.ts:47` (`blockTargetValue`),
  `src/worker/service.ts:22` (`blocked`), `src/worker/index.ts:349` (thêm/gỡ block).
- Bản vá: bỏ fragment chỉ khi so sánh/lưu block mới. Đọc được block legacy chứa
  fragment, hỗ trợ gỡ entry cũ, giữ scheme/path/query và fragment của link hợp lệ.
  Lookup dùng index `(kind,value)` với point/prefix lookup, escape ký tự GLOB,
  không normalize/quét từng hàng cho mỗi redirect. Danh sách host dùng một JSON
  parameter để tránh vượt giới hạn bind khi hostname có nhiều nhãn.
- UI `src/web/main.ts:1388` nói rõ block áp dụng cả khi phần sau `#` khác nhau.
- Xác minh: `tests/security.test.ts`, create/edit owner/edit admin trả 400,
  redirect cũ trả 403 không có Location. Các query/path khác vẫn phân biệt,
  literal glob không biến thành wildcard, fragment hợp lệ vẫn được giữ.

## SEC-002 - Chuẩn hóa hostname thiếu nhất quán

**Ảnh hưởng:** vượt qua chặn tên miền, hạn chế quay lại dịch vụ và hạn chế địa
chỉ nội bộ bằng biến thể nhiều dấu chấm cuối. Đây là bypass chính sách redirect,
**không phải SSRF**, vì Worker không fetch trang đích.

- Nguyên nhân: `targetValue()` chỉ xóa một dấu chấm cuối trước kiểm tra. Đầu vào
  `example.com..` thành `example.com.`, nhưng blocklist chứa `example.com`.
  Dấu chấm còn lại là cách viết root dot của cùng hostname đích.
- Bằng chứng trước sửa: bốn ca own/internal destination không bị từ chối.
  Host block variant vẫn tạo được và redirect 302 trong môi trường local.
- File sửa: `src/shared/rules.ts:42,66` và `src/worker/service.ts:22`.
- Bản vá: một hàm canonicalHostname cho cả validation và block lookup. So sánh
  cả các entry legacy có root dot. Luồng tạo, sửa và redirect dùng cùng quy tắc.
- Xác minh: own domain, subdomain dịch vụ, localhost và `.internal` bị từ chối.
  Block domain/subdomain có hiệu lực với biến thể root dot. Domain không liên
  quan vẫn được phép. Không truy cập thật các đích để chứng minh lỗi.

## SEC-003 - Chặn yêu cầu quá mức trước đọc database

**Phân loại hardening, không tuyên bố đã tái hiện DoS.** Source cho thấy GET/HEAD
API chưa có throttle và API ghi đọc session/policy trước kiểm tra BURST.

- File: `src/worker/index.ts:67`, `src/worker/types.ts:5`, `wrangler.jsonc:25`.
- Thêm `API_READ_BURST` 120/60 giây, tách khỏi budget ghi 15/60 giây. Cả hai
  kiểm tra trước D1 và trả 429 + Retry-After 60. Giữ bearer gate riêng cho backup,
  auth budget riêng và quota tạo nguyên tử. Không giới hạn đường redirect/static
  theo budget của API.
- Bốn ca test mới trước sửa đi vào DB và nhận 503 khi DB spy từ chối. Sau sửa
  cùng test nhận 429 và xác nhận không gọi `DB.prepare`.
- Giới hạn Cloudflare là theo location, permissive/eventually consistent, không
  thể dùng làm bộ đếm toàn cầu chính xác. IP dùng chung có thể bị ảnh hưởng.
  [Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
- Cần quan sát 429 và lưu lượng thực sau một lần phát hành được cho phép. Chưa
  đo khả năng chịu tải hoặc xác minh WAF/account setting production.

## SEC-004 - Bảo vệ chuỗi cung ứng và ngăn tái diễn

**Phân loại hardening:** không phát hiện action/package đang bị chiếm quyền.

- `.github/workflows/ci.yml`: audit dependency và Gitleaks trước job deploy,
  full Git history, checkout không lưu credential, Actions ghim SHA của đúng
  tag đang dùng (không nâng cấp version). Tool archive kiểm tra checksum trước chạy.
- `scripts/backup-workflow.yml`: cùng cách ghim SHA, không lưu Git credential.
  Đây chỉ là template, chưa thay đổi workflow trong repository backup riêng.
- `scripts/security-scan.mjs`: scan history, snapshot source tracked/untracked
  không bị ignore, và `dist`, luôn redact 100%. Không upload báo cáo scanner.
- `package.json`: thêm lệnh audit, secret scan và security regression tests.
- `vitest.config.ts`: override credential provider, bootstrap và backup trong
  Worker test bằng giá trị rỗng/giả. Không dùng `.dev.vars` để gọi dịch vụ thật.
- Quyền `contents: read`, điều kiện push/main, needs:verify, environment production,
  concurrency và secret scope deploy được giữ nguyên. Không thêm secret CI.
- Actionlint kiểm tra hai YAML đạt. Shellcheck/Pyflakes không có sẵn nên không
  chạy hai analyzer phụ đó. Workflow mới chưa chạy trên GitHub vì không push.

## Kiểm chứng và tái quét

| Kiểm tra | Kết quả |
| --- | --- |
| Tái hiện trước bản vá blocklist | 7 ca thất bại như dự kiến, gồm HTTP 201/200/302 vượt block |
| Bộ security regression | 41 ca đạt: 31 API/blocklist + 10 OAuth |
| Toàn bộ `npm test` | 134 Vitest + 12 Node = **146 ca đạt** |
| Typecheck | Đạt qua build |
| Build | Vite và Wrangler dry-run đạt, nhận binding đọc mới |
| Dependency trước/sau | npm audit: **0 known vulnerabilities** |
| Secret trước/sau | Gitleaks: **0 phát hiện** trong 28 Git commits, source snapshot và frontend build |
| Kiểm tra scanner có hoạt động | Một token giả tạo riêng trong .local được phát hiện, exit 1, giá trị redact hoàn toàn. Không phải secret thật bị lộ |
| HTTP trên Worker local | 11 kiểm tra đạt. File cấu hình/source nhạy cảm trả 404, API riêng tư trả 401/403, response no-store và không mở CORS |
| Query plan blocklist | EXPLAIN QUERY PLAN SQLite dùng covering index cho cả host, URL và legacy fragment, không scan bảng blocked_targets |
| CI syntax/static checks | Actionlint 1.7.12 đạt cho CI và backup template |
| Formatting | Prettier kiểm tra các file code/CI mới sửa |
| CSP trình duyệt | First-party, Turnstile, beacon hợp lệ chạy. Inline/eval/script lạ/kết nối lạ bị chặn |
| UI dữ liệu không tin cậy | 12 tình huống ở 1440/768/390px đạt, không tạo element/handler độc hại, không overflow hoặc lỗi JS |
| UI quản trị hiện có | 36 screenshots, không lỗi JS, bốn response lỗi giả có chủ đích |

Test OAuth dùng khóa ký tạm và endpoint Google giả, nhưng kiểm tra bằng JOSE
thật: state, PKCE, nonce, issuer, audience, expiry, chữ ký sai, email chưa xác
minh và tài khoản khóa. Test thành công xác nhận session cookie production và
hash lưu D1. Không đăng nhập tài khoản Google thật.

Đã kiểm tra auth/ownership hiện có, CSRF/Origin, user bị khóa, session hết hạn/
giả, JSON sai loại, streamed body quá cỡ, mass assignment, backup credential,
loại session/network hash khỏi backup và lỗi nội bộ không lộ diagnostic.
Browser XSS test cố ý bypass CSP trong context giả để kiểm tra escaping riêng.
CSP enforcement được kiểm tra độc lập bằng `scripts/test-csp.mjs`.

Bằng chứng local: `.local/security/regression-before.log`, `rate-before.log`,
`full-test-final.log`, `build.log`, `gitleaks-*.json`, `browser/results.json`,
`browser/*.png`, `admin-ui/results.json`. Bản diff ban đầu lưu ở
`.local/security/preexisting.patch`. Các file này không được commit.
`gitleaks-canary.json` là positive control với token giả, tách khỏi kết quả scan
repository. File canary đã được xóa sau khi xác minh.

## Phạm vi và rủi ro còn lại

- Các bản vá chưa có trên production. Không có migration D1 mới. Lần phát hành
  được cho phép cần đưa cả code và binding `API_READ_BURST` lên cùng nhau.
- Không còn lỗ hổng đã xác minh ở trên chưa được sửa trong source. Không đồng
  nghĩa mọi đường tấn công đã được loại trừ. Không có SAST Semgrep/CodeQL full
  scan, pentest production, stress test hoặc fuzzing diện rộng.
- Không xác minh quyền token Cloudflare/GitHub, branch protection, WAF, OAuth
  console, secret rotation, quyền repo backup riêng hoặc retention thực tế.
  Đây là phần môi trường vận hành cần người phụ trách kiểm tra khi phù hợp.
- Không có secret thật được scanner phát hiện trong phạm vi Git/source/build.
  Không có bằng chứng từ lượt kiểm tra này buộc rotate một credential cụ thể.
  Những file credential riêng bị Git ignore không nằm trong kết luận này.
- Link ngắn là công khai, không phải URL bí mật. Đích có thể chứa thông tin nhạy
  cảm do người tạo đưa vào. Rate limit không bảo vệ tuyệt đối trước mạng bot
  phân tán hoặc mọi hình thức phishing. Giữ quy trình tiếp nhận và xử lý vi phạm.
- `ARCHITECTURE.md` là đề xuất ban đầu có chi tiết đã cũ. Threat model dùng
  source, migrations và config hiện hành làm căn cứ, không suy ra từ đề xuất.

## File sửa trong lượt security

Runtime: `src/shared/rules.ts`, `src/worker/service.ts`, `src/worker/index.ts`,
`src/worker/types.ts`, `wrangler.jsonc`, `src/web/main.ts`.

CI/tooling/tests: `.github/workflows/ci.yml`, `scripts/backup-workflow.yml`,
`package.json`, `vitest.config.ts`, `scripts/security-scan.mjs`,
`scripts/test-security-ui.mjs`, `tests/security.test.ts`, `tests/oauth-security.test.ts`.

Tài liệu: `AGENTS.md`, `SECURITY.md`, báo cáo này, `oh.io.vn-threat-model.md`.
Skill metadata: `skills-lock.json`, nguồn cài trong `.agents/skills/SOURCES.md`
(thư mục .agents bị ignore). Các thay đổi SEO khác đã có trước và được giữ lại.
