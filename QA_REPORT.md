# Kiểm tra chức năng và giao diện oh.io.vn

## Audit và cải thiện UI/UX tiếp theo, local ngày 17/10/2026

Lượt này đã sửa source, build, chạy Worker local tách biệt tại cổng 8791, chụp ảnh,
xem ảnh và kiểm tra lại sau chỉnh sửa. **Chưa triển khai các thay đổi trong lượt này.**
Các mục production ở phía dưới là hồ sơ của các lượt trước, không phải kết quả
phát hành của thay đổi hiện tại.

### Audit và thay đổi đã xác minh

Không phát hiện P0 trong phạm vi kiểm tra. Giao diện ban đầu đã có bảng màu,
font, navigation và bố cục responsive nhất quán. Giữ những phần này, không thay
framework hoặc thêm các khối marketing. Sau 5 giây nhìn trang chủ, người xem
nhận ra công cụ rút gọn link; vấn đề chính là thứ tự và phản hồi khi thao tác.

| Mức | Bằng chứng trước sửa                                                             | Kết quả sau sửa                                                                   |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P1  | Mẫu HTML của mã link không hợp lệ trong Chrome; mã `ab` không được chặn ở client | Sửa `pattern`, kiểm tra rõ định dạng, mở phần tùy chỉnh và focus trường lỗi       |
| P1  | Thao tác khóa tài khoản gửi API ngay, chưa có dialog xác nhận                    | Xác nhận có đối tượng, hậu quả, nút Hủy và trạng thái đang lưu                    |
| P1  | Form quản trị hiện trước khi tải xong giá trị cấu hình                           | Chỉ hiện khi tải thành công, lỗi có cách thử lại                                  |
| P1  | Gửi tìm kiếm trong lúc tải danh sách đầu tiên chưa có handler                    | Gắn handler trước khi tải, giữ query trong URL và chống kết quả cũ ghi đè         |
| P2  | Mobile có đoạn hướng dẫn dài chen giữa URL và nút rút gọn                        | Đưa nút sát trường nhập; hướng dẫn nằm sau hành động chính                        |
| P2  | Thiếu phản hồi rõ khi tìm kiếm, lưu, xóa hoặc thao tác quản trị ở cuối trang     | Có trạng thái gần thao tác, xác nhận kết quả và phân biệt lỗi ghi với lỗi tải lại |
| P2  | Hộp xóa thiếu đối tượng; focus bị mất khi render lại danh sách                   | Hiện URL/tên link, trả focus tới thao tác còn tồn tại                             |
| P2  | URL dùng dấu chấm giữa; nhãn nút và ngày thống kê chưa nhất quán                 | Hiện `oh.io.vn/mã`, dùng nhãn cụ thể và ngày tiếng Việt                           |

Nội dung được chỉnh gồm mô tả trang chủ, hướng dẫn tài khoản, nhãn “Rút gọn link”,
“Tìm link”, “Lưu thay đổi”, hướng dẫn mã tùy chỉnh, lỗi theo trường, thông báo
đang xử lý/kết quả và nội dung xác nhận quản trị. Có favicon từ logo hiện có.
Nút mở đóng góp dùng phần tử button. Sao chép nhiều lần liên tiếp vẫn khôi phục
đúng nhãn hiển thị và accessible name.

### Kiểm thử

- `npm run typecheck`: đạt.
- `npm test`: 53 kiểm thử Vitest và 1 kiểm thử Node về backup đạt, tổng 54.
- `npm run build`: đạt TypeScript, Vite và Wrangler dry-run, không phát hành.
- Prettier kiểm tra source thay đổi: đạt. Repo chưa có ESLint hoặc script lint;
  kết quả Prettier chỉ xác nhận định dạng, không phải kiểm tra lint ngữ nghĩa.
- `node scripts/test-ui.mjs`: đạt 129 phép đo bố cục và các assertion chức năng.
  Chạy Chrome headless với Playwright có sẵn, không cài dependency mới.
- Bảy trang, cả phiên khách và tài khoản giả, tại 320, 390, 768, 1280, 1440px;
  thêm chiều cao 390px và chữ tăng 200%. Không phát hiện tràn ngang.
- Tạo link khách/tài khoản, tùy chỉnh mã, validation, clipboard, tìm kiếm bằng
  Enter, xóa tìm kiếm, trạng thái rỗng, sửa/lưu, xóa/hủy, thống kê, tải Excel,
  điều hướng bằng link, sao chép email báo cáo và đóng góp đều được thao tác.
- Các regression gồm tìm khi tải chậm, giữ kết quả cũ khi tìm lỗi, focus sau lưu,
  cấu hình quản trị tải chậm/lỗi/thử lại, xác nhận khóa/hủy/mở khóa, ngăn đóng
  dialog đang ghi, và ghi thành công nhưng tải lại thất bại.
- Skip link, Escape, focus trở về nút mở, reduced motion, và các cặp màu token
  chữ chính/nền/action/error đạt kiểm tra. Đây không phải chứng nhận WCAG đầy đủ.
- Không có JavaScript exception hoặc lỗi console ngoài dự kiến. Năm thông báo
  HTTP 503 trong log là các lỗi được cố ý tạo để thử phản hồi và khả năng thử lại.
- Smoke test không mock: cả bảy trang trên Worker local trả HTTP 200. Không ghi
  dữ liệu trong lượt smoke test này.
- Đối chiếu source: giữ toàn bộ ID DOM và tên trường cũ. Nội dung body của privacy
  và terms giống nguyên bản. Worker, shared rules, migration, dependency và lockfile
  không đổi.

### Visual review và bằng chứng

Đã chụp 42 ảnh mốc cho bảy trang × ba kích thước × hai trạng thái tài khoản.
Sau sửa, đã xem ảnh của các nhóm trang tạo link, quản lý, quản trị, thông tin/pháp
lý và hộp thoại. Vòng xem tiếp theo phát hiện thông báo loading còn sót sau lỗi
quản trị và dòng mã link lặp trong thống kê; đã sửa, chụp và xem lại.

- Mốc trước sửa: `.local/ui-ux/before/`.
- Ảnh sau vòng đầu: `.local/ui-ux/after-v1/`.
- Ảnh và kết quả cuối: `.local/ui-ux/after/`, `results.json`.
- So sánh trang chủ: `guest-home-1440.png`, `guest-home-768.png`,
  `guest-home-390.png` trong thư mục before/after.
- Ví dụ trạng thái mới: `invalid-slug-mobile.png`, `admin-confirm-mobile.png`,
  `admin-load-error-mobile.png`, `search-error-mobile.png`, `stats-desktop.png`.
- Runner được lưu trong Git scope: `scripts/test-ui.mjs`. Hướng dẫn chạy nằm
  trong `AGENTS.md`. Ảnh, cấu hình và dữ liệu local được Git bỏ qua.
- Skills được cài vào `.agents/skills/`; nguồn và commit ghi trong
  `.agents/skills/SOURCES.md`. `AGENTS.md` và `DESIGN_SYSTEM.md` lưu quy tắc lâu dài.

Các thao tác ghi trong browser dùng API và Turnstile giả, không thay đổi dữ liệu
production. Lượt này chưa kiểm tra lại Google OAuth/Turnstile production, Safari,
thiết bị iOS/Android thật hoặc screen reader. Không phát hiện P0/P1 còn lại trong
phạm vi các ca đã chạy; các giới hạn này vẫn cần được tính đến khi phát hành.

## Triển khai và kiểm tra production ngày 17/10/2026

- Commit giao diện: `6112ca9f3a3660c1e8d7036dfeeabb2102224529`, đã push lên
  `origin/main`. [GitHub Actions của commit](https://github.com/oh-io-vn/oh.io.vn/actions/runs/39040247130)
  chạy thành công với typecheck, 54 kiểm thử và build.
- Triển khai bằng `npm run deploy` lên custom domain `https://oh.io.vn`.
  Cloudflare Worker version: `88986d73-04c8-420e-8e36-00e90ee1ecd7`.
- Kiểm tra bằng Chrome trên domain thật, không mock API. Cả bảy trang trả
  HTTP 200. Font tải được, không có exception JavaScript của ứng dụng hoặc
  thông báo lỗi kết nối chung.
- Đo bảy trang ở 1440, 768, 390 và 320 px. Kiểm tra thêm hộp đóng góp ở ba
  kích thước, gồm 320 × 390, và chữ tăng 200%. Tổng cộng 32 phép đo đạt,
  không tràn ngang. Đã mở và xem ảnh desktop/mobile thực tế sau triển khai.
- Kiểm tra mở/đóng hộp đóng góp bằng Escape và trả focus về nút mở. Trường URL
  nhận nhập liệu, nút rút gọn được bật. `/api/config` trả 200, vẫn cho tạo link
  khách và có site key. Lượt này không gửi biểu mẫu tạo link hoặc sửa dữ liệu thật.
- SHA-256 của `/assets/main-CSLnvFwe.js` và `/assets/main-DpAGVwpm.css` trên domain
  thật khớp hoàn toàn với file trong `dist/` của bản build đã phát hành.
- Console có cảnh báo CSP chặn `static.cloudflareinsights.com/beacon.min.js` do
  Cloudflare chèn vào HTML. CSP của ứng dụng chỉ cho script cùng origin và
  Turnstile. Không phát hiện lỗi hiển thị liên quan trong lượt kiểm tra này.
  Đợt thiết kế không thay CSP hoặc cấu hình beacon thống kê.
- Dashboard/admin production được kiểm tra ở trạng thái chưa đăng nhập, hiển
  thị yêu cầu đăng nhập/quyền truy cập đúng. Các luồng tài khoản có dữ liệu vẫn
  là bằng chứng local ở phần tiếp theo, chưa được thử lại bằng OAuth production.
- Runner: `.local/design-production-qa.mjs`. Ảnh và kết quả đo/hash nằm trong
  `.local/design-production-qa/`, gồm `home-1440.png`, `home-390.png` và
  `results.json`. Đây là dữ liệu local được Git bỏ qua.

## Thiết kế giao diện SaaS, kiểm tra local ngày 17/10/2026

Bản thiết kế mới đã chạy bằng `npm run dev` trên Worker local tại
`http://localhost:8787` trước khi triển khai. Kết quả production nằm ở phần trên.
Phần "Hồ sơ kiểm tra giao diện trước khi thiết kế lại" là hồ sơ của giao diện cũ.

### Phạm vi và kết quả

- Kiểm tra giao diện cũ bằng ảnh trình duyệt trước khi sửa. Thiết lập token màu,
  chữ, khoảng cách và thành phần trong [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
- Sửa generator chung, stylesheet và phần trình bày trạng thái rỗng. Giữ API,
  luồng xác thực, xác minh, hạn mức, thời hạn và mã Worker. Không thêm dependency.
- Chạy Chrome headless trên bản build thật. Kiểm tra bảy trang với cả phiên khách
  và tài khoản giả tại 320, 390, 768, 1280 và 1440 px, tổng cộng 70 tổ hợp.
- Kiểm tra thêm bảy trang ở 320 × 390, 390 × 390 và 844 × 390. Kiểm tra cả bảy
  trang với chữ tăng 200% tại 320 và 390 px, cho cả khách và tài khoản giả.
- Tổng cộng 128 phép đo bố cục đều không tràn ngang. Hộp sửa, thống kê và đóng
  góp nằm trong khung hẹp, cuộn được khi chiều cao chỉ 390 px.
- Đã mở và xem ảnh desktop/mobile của trang chủ, dashboard, admin, nội dung
  thông tin/quy định và hộp thoại. Sau lần xem đầu, sửa điều hướng mobile xuống
  dòng thiếu cân đối, trạng thái trang hiện tại, skip link lọt vào ảnh toàn trang,
  nhãn tra cứu, mô tả và trạng thái danh sách chặn rỗng. Sau khi tăng chữ 200%,
  phát hiện thêm tài khoản đè lên logo và chuyển header mobile sang CSS grid.
  Đã chụp, đo và xem lại sau sửa.
- Kiểm tra bằng thao tác trình duyệt với API và Turnstile giả: tạo link khách,
  tạo link có mã/tên tùy chỉnh, sao chép vào clipboard, tìm kiếm có/không có kết
  quả, trạng thái chưa có link, sửa/lưu, thống kê, tải Excel, hủy/xác nhận xóa,
  cấu hình và danh sách chặn admin, tra cứu rỗng, đóng góp và lỗi kết nối.
- Skip link hoạt động bằng bàn phím. Escape đóng hộp thoại và trả focus về nút
  mở. Tôn trọng reduced motion. Không có exception JavaScript trong lượt QA.
- Không mock trong lượt smoke test riêng: cả bảy trang trên Worker local trả
  HTTP 200, chụp thêm trang chủ desktop và mobile từ Worker thật.

### Bằng chứng local

- Runner: `.local/design-qa.mjs`.
- Ảnh và kết quả đo: `.local/design-qa/` và `.local/design-qa/results.json`.
- Trang chủ Worker thật: `local-worker-home-desktop.png` và
  `local-worker-home-mobile.png` trong thư mục ảnh.
- Dashboard có dữ liệu giả: `member-dashboard-1440.png` và
  `member-dashboard-390.png`. Các ảnh `member-*` chứa dữ liệu kiểm thử.
- Excel tải qua UI: `.local/design-qa/oh-tai-lieu-2026-09-18.xlsx`.
- 54 kiểm thử hiện có, typecheck, build kèm Wrangler dry-run, Prettier và
  `git diff --check` đều đạt. Kiểm tra đối chiếu xác nhận mọi ID DOM và tên trường
  form cũ còn nguyên. Worker, shared rules, migration và manifest dependency
  không thay đổi. Các file `.local/` được Git bỏ qua.

Đây là kiểm tra Chrome desktop mô phỏng viewport mobile. Đợt thiết kế này không
thử lại Google OAuth thật, Turnstile production, thiết bị iOS/Android hoặc Safari.
Các thao tác ghi trong QA trình duyệt dùng fixture cô lập, không sửa dữ liệu thật.

## Hồ sơ kiểm tra giao diện trước khi thiết kế lại

Ngày kiểm tra trước: 17/10/2026. Bản sửa giao diện cũ đã triển khai lên
https://oh.io.vn. Nội dung sau phân biệt production, Worker local với dữ liệu giả
và phép đo bố cục trong khung trình duyệt.

## Lần tối giản giao diện tiếp theo

Bổ sung theo yêu cầu bỏ ảnh đóng góp: hộp thoại chỉ còn thông tin chuyển khoản bằng chữ và có chiều rộng tối đa 440 px. Ảnh gốc giữ trong tài liệu dự án, không còn được sao chép vào bản website. Thanh cuộn của trang và hộp thoại dùng dạng mảnh, vẫn cuộn được khi nội dung dài. Kiểm tra hộp đóng góp ở khung 320 × 390, 390 × 844 và 1280 × 700 đều không tràn, không chứa ảnh và không cần cuộn. Kiểm tra kiểu và bản build thành công.

- Bỏ khẩu hiệu, các khối giới thiệu trên trang chủ, tên tài khoản trên thanh điều hướng và câu lặp trong trang quản lý. Giữ thông tin thời hạn, lỗi và xác nhận xóa.
- Chữ giao diện dùng chung cỡ 16 px. Nội dung do ứng dụng viết không dùng chữ hoa toàn bộ, dấu chấm phẩy, gạch chéo hoặc gạch ngang dài làm dấu câu. Ngày được viết bằng chữ. Địa chỉ và dữ liệu người dùng giữ nguyên.
- Đo lại bảy trang tại khung rộng 320, 390, 768 và 1280 px. Cả 28 trường hợp có chiều rộng nội dung không vượt viewport và chữ hiển thị đều là 16 px. Không phát hiện dấu chấm phẩy hoặc hai loại gạch ngang dài trong chữ đang hiển thị.
- Kiểm tra thêm trang chủ khách và hộp sửa, thống kê, đóng góp trong khung 320 px. Hộp sửa có lỗi lưới làm trường nhập tràn ngang sau khi tăng cỡ chữ. Đã sửa kích thước cột và nhãn, đo lại hộp rộng 271 px có nội dung rộng 271 px. Hộp thống kê cuộn được trong khung thấp 390 px.
- Kiểm tra trên Chrome với iframe cùng origin và Worker local dùng dữ liệu giả. Đây là kiểm tra bố cục responsive, chưa phải kiểm tra trên thiết bị di động thật.
- 54 kiểm thử tự động đều đạt. Kiểm tra kiểu và bản build production thành công. Ảnh mã đóng góp giữ nguyên mã băm.

## Những lỗi đã sửa

1. Mã link dài làm trang quản lý và thống kê tràn ngang. Mã 64 ký tự từng làm khung rộng 390 px có nội dung rộng 604 px; sau sửa các kích thước bên dưới không còn tràn.
2. Điều hướng tài khoản, nút dài và số thống kê lớn không phù hợp màn hình hẹp. Cho xuống dòng, xếp thống kê một cột, tăng vùng bấm, giữ chữ nút Đóng nguyên vẹn.
3. Hộp thoại trên màn hình thấp khó cuộn/đóng. Giới hạn theo viewport động, giữ đầu hộp có nút Đóng, cuộn nội dung và khóa cuộn trang nền. Khung 320 × 390 có hộp thống kê cao 357 px, nội dung cuộn được.
4. Sao chép thất bại ở dashboard ghi vào vùng thông báo không tồn tại; clipboard không phản hồi có thể làm thao tác treo. Đã sửa vị trí báo lỗi và thêm timeout.
5. Lỗi xóa/xuất Excel hiện phía sau hộp thoại. Đã thêm vùng báo lỗi trong từng hộp, ngăn gửi lưu/xóa lặp và ngăn đóng giữa lúc lưu.
6. Phản hồi thống kê cũ có thể đi kèm link khác khi thao tác nhanh; dữ liệu xuất có thể đổi trong lúc tải thư viện. Chỉ dùng phản hồi mới nhất và chụp dữ liệu/mã link trước khi xuất.
7. Tìm kiếm chậm có thể đè kết quả mới; không tìm thấy lại báo chưa có link nào. Đã phân biệt trạng thái và bỏ phản hồi cũ.
8. Lỗi mạng, phản hồi HTML từ hạ tầng và đăng xuất thất bại thiếu phản hồi rõ. Đã giới hạn thời gian yêu cầu, chuẩn hóa thông báo tiếng Việt và thêm vùng báo lỗi chung.
9. Link đang được bảo toàn do hoãn hết hạn vẫn bị ẩn nút sửa. Đã xét trạng thái hoạt động, hoãn hết hạn và hạn cố định khi hiển thị nút.
10. API thống kê báo ghi dữ liệu khi giảm tải tự động đã tắt ghi. Đã tính ngưỡng tự động trong trường enabled.
11. Mã index xung đột Static Assets: /index chuyển về trang chủ. Đã giữ mã này cho hệ thống, thêm kiểm thử; production chưa có link dùng mã đó.

## Ma trận responsive

Chrome chạy bản build thật trong iframe cùng origin; API qua Worker/D1 local, tài khoản và dữ liệu giả. Scrollbar cổ điển làm viewport nội dung nhỏ hơn khung 15 px trong một số trường hợp. Không coi đây là thiết bị di động thật hoặc Safari.

| Trang                  | 320 px | 360 px | 390 px | 768 px | 1280 px |
| ---------------------- | ------ | ------ | ------ | ------ | ------- |
| Trang chủ có tài khoản | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Link của tôi, mã dài   | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Quản trị               | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Về dự án               | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Quyền riêng tư         | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Quy định               | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |
| Báo cáo link           | Đạt    | Đạt    | Đạt    | Đạt    | Đạt     |

Đạt nghĩa là scrollWidth không vượt clientWidth. Kiểm tra thêm hộp sửa, thống kê, xác nhận xóa/hủy và đóng góp ở 320 × 390; mã/tên dài, tổng 1.234.579 lượt, nút đóng, cuộn dọc và ảnh QR nằm trong khung. Trường nhập ở breakpoint mobile dùng 16 px; các nút điều hướng/thao tác cao tối thiểu 44 px.

## Chức năng và bằng chứng

| Luồng                 | Kết quả                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trang công khai/riêng | Production: 7 trang trả 200, dashboard/admin có noindex, nofollow; sitemap chỉ chứa trang công khai.                                                                                                  |
| Google login/logout   | Đã thao tác thành công trên production; đăng xuất về giao diện khách.                                                                                                                                 |
| Link khách            | Bản cuối production tạo eg9568us sau khi đăng xuất, không cần tài khoản; thời hạn 3 tháng.                                                                                                            |
| Link tài khoản        | Production: tạo huong-dan, sửa target sang repository#readme và tên ghi nhớ; 302 đúng đích, hạn không hoạt động 12 tháng.                                                                             |
| Tìm và sao chép       | Production: tìm đúng mã, tìm không thấy có thông báo riêng; nút sao chép phản hồi Đã sao chép.                                                                                                        |
| Thống kê/Excel        | Production: lượt thử Referer Zalo và User-Agent điện thoại vào đúng nhóm, xuất Excel. Local: workbook mã dài có đúng nguồn/số liệu và không ô công thức. Đây là lượt thử, không phải người dùng thật. |
| Sửa/hạn cố định       | UI local khung thấp: URL nội bộ bị từ chối trong hộp; target/tên/hạn hợp lệ lưu được và hộp đóng.                                                                                                     |
| Xóa/mã không cấp lại  | API Worker local: xóa link thử, ngừng redirect, từ chối tạo lại cùng mã. UI kiểm tra mở xác nhận và hủy; không xóa link thật của chủ dự án.                                                           |
| Quản trị              | API Worker local: thêm/gỡ domain chặn, từ chối đích bị chặn, tắt/khôi phục thống kê; redirect vẫn chạy khi thống kê tắt.                                                                              |
| Quyền riêng tư        | Production: API link/thống kê không đăng nhập trả 401, admin trả 403, no-store. Bộ kiểm thử kiểm tra quyền sở hữu, CSRF, quota và sự cố.                                                              |
| Đóng góp/liên hệ      | Hộp QR mở/đóng/cuộn được, ảnh gốc giữ đúng SHA-256; email hi@oh.io.vn. Không giao dịch hoặc gửi email trong đợt QA này.                                                                               |

## Kiểm tra mã và giới hạn

- 54 ca đạt: 53 Vitest và 1 kiểm tra mã hóa backup bằng Node; typecheck, build production và git diff --check đạt.
- Không thêm thư viện, icon hoặc emoji. Mã không chứa các giá trị secret đang cấu hình; dữ liệu thử và ảnh giao diện nằm trong .local/ được Git bỏ qua.
- Chưa thử trên Android/iPhone hoặc Safari thật, bàn phím ảo thật, trình đọc màn hình hoặc mạng di động yếu. Khung thấp kiểm tra co/cuộn, không chứng minh mọi hành vi bàn phím/thanh địa chỉ của iOS/Android.
- Không stress test production, không nới quota để phục vụ kiểm thử.
- Sau các lượt thử, mạng kiểm tra đã dùng 3/3 lượt tạo khách trong 24 giờ; một lượt khôi phục khoảng 19:07 ngày 18/10/2026 (giờ Việt Nam). Đây là giới hạn đã chốt, không phải lỗi Turnstile. Hạn mức tài khoản và toàn dịch vụ vẫn hoạt động độc lập.
