# Bảo mật oh.io.vn

Quy tắc bảo mật cho ứng dụng Workers/Hono, D1 và frontend Vite. Threat model và
kết quả kiểm tra ngày 18/10/2026 nằm trong
[oh.io.vn-threat-model.md](oh.io.vn-threat-model.md) và
[security_best_practices_report.md](security_best_practices_report.md).

## Ranh giới bảo vệ

- Các trang dashboard/admin là shell giao diện. Dữ liệu và thao tác cần xác thực,
  quyền chủ link hoặc quyền admin tại Worker. Cookie session production dùng
  `__Host-oh_session`, HttpOnly, Secure, SameSite=Lax, thời hạn bảy ngày.
- Google OAuth kiểm tra state, PKCE S256, nonce, chữ ký RS256, issuer, audience,
  thời hạn token và email_verified. Không có mật khẩu hoặc reset password nội bộ.
- API ghi yêu cầu Origin chính xác, JSON và CSRF khi có session. Body tối đa
  8.192 byte thực nhận. Turnstile phải được xác minh ở server khi tạo link.
- `BURST`: 15 thao tác ghi/phút. `API_READ_BURST`: 120 yêu cầu GET/HEAD API/phút.
  Kiểm tra trước D1, dùng network key HMAC, trả 429 với Retry-After khi vượt mức.
  Auth dùng nhóm key riêng. Backup có bearer secret riêng. Đường chuyển hướng
  và static assets không dùng ngân sách API đọc.
- Binding rate limit là biện pháp giảm lạm dụng theo vị trí Cloudflare, không
  phải bộ đếm toàn cầu chính xác. Mạng nhiều người dùng chung IP cần được theo
  dõi để điều chỉnh giới hạn sau khi có dữ liệu thật. Quota tạo link vẫn do
  transaction/trigger D1 quyết định.
- URL đích chỉ HTTP(S), không userinfo, loop dịch vụ hoặc địa chỉ nội bộ bị cấm.
  Worker không fetch trang đích. Đây là dịch vụ chuyển hướng có chủ đích.
- Hostname được chuẩn hóa trước so sánh. Chặn host gồm tên miền con. Chặn URL
  không phân biệt phần sau dấu `#`, vẫn phân biệt scheme, path và query. Fragment
  của link hợp lệ được giữ nguyên. Các block cũ có fragment/root dot vẫn có hiệu lực.
- Backup dùng credential riêng, loại session và network hash, mã hóa AES-256-GCM
  trước lưu artifact trong repository riêng. Không đặt dữ liệu backup vào Git này.

## Kiểm tra local

```powershell
npm run test:security
npm test
npm run build
npm run security:audit
npm run security:secrets -- C:/duong-dan/gitleaks.exe
```

`build` gồm typecheck, Vite và Wrangler **dry-run**, không deploy. Test dùng D1
Miniflare và fake identity. Không trỏ script kiểm thử vào production. Credential
provider/backup trong test Worker được override, không sử dụng `.dev.vars` để
gọi dịch vụ thật. Tests OAuth sử dụng khóa ký tạm và mock endpoint Google.

Gitleaks được chạy local, không upload source. Script quét tất cả Git refs đã có
trong checkout, snapshot các file tracked/untracked không bị ignore, rồi `dist`
nếu đã build. `.local`, `.agents`, `.dev.vars`, dependency và các file bị ignore
không thuộc snapshot source. Báo cáo JSON redact 100% lưu ở `.local/security/`.
Không suy ra các file credential riêng bị ignore đã được scanner đánh giá.

Phiên bản đã kiểm tra: Gitleaks **8.30.1**, từ
[release chính thức](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
Xác minh SHA-256 trước khi giải nén/chạy, không chạy installer tùy ý:

| Artifact | SHA-256 |
| --- | --- |
| `gitleaks_8.30.1_windows_x64.zip` | `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` |
| `gitleaks_8.30.1_linux_x64.tar.gz` | `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` |

Kiểm tra trình duyệt khi thay đổi UI/CSP, dùng Playwright đã cài và server local:

```powershell
$env:PLAYWRIGHT_PACKAGE = 'C:/duong-dan/node_modules/playwright/package.json'
$env:UI_ORIGIN = 'http://127.0.0.1:8797'
node scripts/test-security-ui.mjs
node scripts/test-csp.mjs
```

Test XSS render dữ liệu giả trong dashboard, danh sách link/tài khoản, audit và
blocklist ở 1440/768/390px. Nó chủ động bypass CSP **chỉ trong context kiểm thử**
để chứng minh escaping không phụ thuộc CSP. Script CSP riêng kiểm tra thực thi
chính sách bằng phản hồi giả, không gửi probe ra ngoài.

## CI và phát hành

Job verify chạy dependency audit (mức moderate trở lên chặn CI), unit/integration
tests, build và Gitleaks trên history/source/build. GitHub Actions được ghim bằng
commit SHA, Gitleaks bằng version/checksum. Quyền mặc định vẫn contents:read.
Secret deploy chỉ xuất hiện trong bước Cloudflare của job production sau verify,
chỉ với push/main. Không thêm secret cho pull request hoặc upload báo cáo scanner.

Sau khi được phép phát hành các bản vá này, cấu hình Worker cần có binding
`API_READ_BURST` trong `wrangler.jsonc`. Không cần migration D1 mới. Template
`scripts/backup-workflow.yml` cũng đã ghim SHA, nhưng repository backup riêng
không tự nhận thay đổi của template này.

## Xử lý phát hiện

Không gửi secret hay dữ liệu người dùng trong issue công khai. Địa chỉ liên hệ
đang dùng trên website là `hi@oh.io.vn`. Chỉ gửi mô tả tối thiểu, phạm vi ảnh hưởng
và cách tái hiện local. Không thử khai thác trên production.

Nếu phát hiện credential thật bị lộ: hạn chế chia sẻ, báo chủ dự án để revoke/
rotate, cập nhật secret store rồi xác minh. Không tự rewrite Git history hoặc
đổi credential production trong một lượt sửa code.
