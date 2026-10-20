# Hướng dẫn làm việc với oh.io.vn

## Cấu trúc và phạm vi

- Frontend dùng TypeScript, CSS và Vite. Backend dùng Cloudflare Workers/Hono,
  D1, Durable Objects và Turnstile. Giữ nguyên kiến trúc này.
- Đọc `DESIGN_SYSTEM.md` trước khi sửa giao diện.
- Sửa nội dung và HTML dùng chung trong `scripts/generate-pages.mjs`, sau đó
  chạy `npm run build:web` để sinh lại bảy file HTML trong `src/web/`.
  Không sửa riêng các file HTML được sinh tự động.
- Kiểm tra `git status` trước khi sửa và giữ nguyên thay đổi của người dùng.
  Không tự commit, push hoặc deploy.
- Push vào `main` sẽ tự deploy lên production sau khi GitHub Actions kiểm tra
  thành công. Chỉ push khi người dùng cho phép; không chạy deploy thủ công song
  song với workflow. Giữ điều kiện push/main, `needs: verify`, khóa concurrency
  và environment `production` khi sửa CI. Không cấp token deploy cho pull request.
- Giữ ID DOM, tên trường, API, quyền truy cập, xác thực, CSRF, quy tắc hạn mức
  và thời hạn link. Khi bổ sung validation phía client, backend vẫn là nơi
  quyết định tính hợp lệ.

## DESIGN RULES

- Dùng lại token và các lớp thành phần trong `src/web/styles.css`.
- Giữ font Space Grotesk tự lưu trữ, bảng màu hiện tại và logo liên kết.
- Ưu tiên ô URL và hành động rút gọn. Danh sách link dùng các hàng phân cách.
- Dùng khoảng cách, cỡ chữ và trọng lượng để phân cấp nội dung. Không thêm
  gradient, bóng, card hay animation nếu chúng không giúp người dùng thao tác.
- Dùng style hiện có trước khi thêm style mới. Các thành phần tương đương phải
  có cùng trạng thái hover, focus, disabled, loading và error.
- Dùng SVG cho icon, kể cả mũi tên, dấu chọn và dấu mở rộng. Không dùng ký tự
  đặc biệt thay icon. Không đẩy hành động xuống đáy bằng khoảng trống tự giãn.
- Kiểm tra 1440, 768 và 390px; thử thêm 320px và chữ phóng to 200% khi đổi layout.
- Giữ nhãn hiển thị, focus dễ thấy, thứ tự heading đúng, mục tiêu chạm tối thiểu
  44px và tương phản chữ thường tối thiểu 4.5:1. Tôn trọng reduced motion.

## ICON RULES

- Icon giao diện dùng Lucide qua registry `src/web/icons.js`. Import từng icon,
  không import cả bộ `icons`, không dùng emoji, ký tự đặc biệt hay icon font.
  Logo oh.io.vn là tài sản thương hiệu riêng, giữ nguyên.
- Dùng icon cho thao tác cần nhận biết nhanh (sao chép, sửa, thống kê, xóa,
  tìm kiếm), navigation, phản hồi và điều khiển mở/đóng. Không thêm vào mọi
  heading, label, số liệu, đoạn văn hoặc liên kết chỉ để trang trí.
- HTML sinh sẵn và TypeScript dùng chung `icon(name)`. SVG lấy nguyên hình từ
  Lucide. Không chép lại hoặc tự sửa đường path cho từng trang. CSS mask của
  select/details được sinh trong `src/web/icon-masks.css` bằng cùng registry.
- Cỡ mặc định 16px, navigation và nút rút gọn 18px, trạng thái trống 24px.
  Dùng token `--icon-sm`, `--icon-md`, `--icon-lg`. Các cỡ theo rem để phóng to
  cùng chữ. Nét 2.25 trên viewBox 24 ở cỡ 16px, nét 2 ở cỡ 18px (đều cho nét
  hiển thị 1.5px). Trạng thái trống dùng nét 1.75 ở cỡ 24px.
- Màu dùng `currentColor`. Khoảng icon–chữ 8px, nút danh sách gọn dùng 6px.
  Dùng flex/grid để căn, giữ icon không co. Không thêm transform để vá căn lề.
  Đánh giá độ nặng nét và cân bằng với chữ từ screenshot thực tế.
- Giữ nhãn chữ của thao tác. SVG trang trí có `aria-hidden="true"` và
  `focusable="false"`. Nếu cần nút chỉ có icon, bắt buộc accessible name rõ
  nghĩa và vùng bấm ít nhất 44×44px. SVG không tạo thêm điểm Tab.
- Thay nhãn khi loading bằng `setControlLabel`, giữ icon khi trở lại trạng
  thái bình thường. Chỉ vòng chờ quay và tôn trọng `prefers-reduced-motion`.
- Sau thay đổi, chụp và xem 1440/768/390px, thử 320px và chữ 200%. Kiểm tra
  icon không chạm mép, không làm vỡ hàng nút, đúng màu và tỷ lệ với chữ.
  Thử click vào chính SVG, bàn phím, loading/success/error và focus hộp thoại.

## UX RULES

- Nhãn nút phải nói rõ hành động. Hướng dẫn không chen giữa trường chính và nút
  gửi trên mobile.
- Gắn lỗi với trường tương ứng. Mở phần tùy chỉnh trước khi focus vào trường lỗi.
- Khi chờ API, báo đang xử lý và ngăn gửi trùng. Không cho sửa cấu hình quản trị
  trước khi tải thành công các giá trị hiện tại.
- Skeleton dùng chung từ `src/web/loading.js`, chỉ đặt ở vùng đang chờ dữ liệu
  (tài khoản, form kết nối, danh sách, thống kê, quản trị). Không che nội dung
  tĩnh bằng thời gian chờ giả. Skeleton không chứa input/nút và phải có trạng
  thái đọc được. Khi lỗi phải kết thúc skeleton và đưa ra cách thử lại.
- Kiểm tra giao diện ngay khi HTML vừa hiện, lúc API chậm và sau khi tải xong.
  Không dùng logo làm placeholder lớn. Hộp thống kê đang tải vẫn đóng được,
  phản hồi muộn không tự mở lại hộp. Khóa xuất file đến khi dữ liệu sẵn sàng.
- Animation chỉ chuyển nhẹ màu/độ hiện của nội dung trong 150–180ms. Khung hộp
  thoại luôn đục, không làm nền xuyên qua. Tắt mọi hiệu ứng khi reduced motion.
- Đăng xuất, xóa, khóa, vô hiệu hóa và thêm/gỡ chặn dùng lớp `danger` hoặc
  `danger-button`. Giữ nhãn hành động và xác nhận cho các thao tác rủi ro.
- Đặt phản hồi gần nơi thao tác. Phân biệt lỗi ghi dữ liệu với lỗi tải lại sau khi
  đã ghi thành công. Không thông báo thất bại cho thao tác đã được lưu.
- Hộp sửa, xóa, thống kê và xác nhận quản trị phải nêu link/tài khoản liên quan.
  Xác nhận trước thao tác khóa, xóa hoặc thay đổi danh sách chặn.
- Dùng native `dialog`, giữ Escape, focus trong hộp thoại và trả focus hợp lý khi
  đóng. Nếu danh sách được render lại, chuyển focus tới phần tử còn tồn tại.
- Hộp thoại có tiêu đề dùng `.scroll-dialog` và `.dialog-body`: tiêu đề nằm ngoài
  vùng cuộn. Không đặt tiêu đề sticky giữa nội dung để tránh chữ lọt phía trên.
- Căn đáy các ô nhập cùng hàng dù nhãn xuống dòng. Select giữ ngữ nghĩa native;
  style menu bằng `base-select` khi được hỗ trợ và giữ fallback cho trình duyệt cũ.
- Prefix và input trong `.slug-input` cùng cỡ chữ và cùng hàng. Quy tắc margin
  của `.fields` chỉ áp dụng input con trực tiếp của label, không lồng vào prefix.
- Hai panel quản trị cùng hàng phải cao bằng nhau. Giữ nội dung/nút Cloudflare
  theo luồng bình thường, phần trống còn lại nằm cuối panel. Chừa ít nhất 12px
  giữa đường kẻ và trợ giúp, 16px giữa thông báo tìm kiếm và kết quả.
- Đổi mã chỉ áp dụng link còn hoạt động thuộc tài khoản hiện tại. Cảnh báo và
  xác nhận địa chỉ cũ ngừng hoạt động. Giữ thống kê, chủ sở hữu, thời hạn và
  hạn mức. Mã cũ phải thành tombstone trong cùng giao dịch và không cấp lại.
  Migration `0003` phải có trước khi bật đổi mã trên production.
- Biểu đồ lượt truy cập dùng đủ 30 ngày từ `since` của API, giữ các ngày không có
  lượt ghi nhận và cảnh báo dữ liệu thiếu. Luôn thử trường hợp chỉ một ngày có số
  liệu; không để một cột giãn hết chiều ngang.
- Giữ navigation nhất quán. Tìm kiếm có nhãn, trạng thái kết quả và cách xóa lọc.
- Header chỉ có các thao tác chính. Liên kết “Về dự án” nằm ở footer.
- Kiểm tra trạng thái trống, lỗi, đang tải, URL dài và tên dài. Không thêm bước
  không cần thiết vào luồng tạo link.

## VIETNAMESE UX WRITING RULES

- Viết tiếng Việt tự nhiên, câu ngắn và rõ nghĩa. Ưu tiên sự rõ ràng hơn hoa mỹ.
- Tránh cách gọi mơ hồ như “tính hạn”. Nói rõ lúc nào link hết hạn và thao tác
  thay đổi điều đó ra sao. Các trang giới thiệu, riêng tư và quy định không dùng
  dấu chấm phẩy trong nội dung, tách thành câu rõ nghĩa.
- Dùng dấu gạch ngang (-) để phân tách tiêu đề và các thông tin trên giao diện.
- Nội dung giới thiệu và lời xưng hô dùng “oh.io.vn” hoặc cách viết trung tính;
  không dùng tên riêng của chủ dự án để tự giới thiệu dịch vụ.
- Giữ đúng tên chủ tài khoản trong thông tin chuyển khoản và tên chủ bản quyền
  trong giấy phép; đây là định danh, không thay bằng tên dịch vụ.
- Dùng nhất quán: “link”, “địa chỉ đích”, “mã link”, “tên ghi nhớ”, “lượt truy cập”.
- Nút dùng động từ cụ thể: “Rút gọn link”, “Lưu thay đổi”, “Xóa link”, “Tìm link”.
- Thông báo lỗi nói rõ vấn đề và bước xử lý. Trạng thái đang chờ kết thúc bằng “…”.
- Không dịch máy móc, viết hoa cả câu, bịa số liệu hoặc dùng khẩu hiệu AI như
  “trải nghiệm liền mạch”, “nâng tầm”, “mở khóa tiềm năng”.
- Giữ nguyên ý nghĩa nghiệp vụ. Không sửa nội dung pháp lý, thông tin đóng góp,
  hạn mức hoặc thời hạn nếu chưa có căn cứ và yêu cầu phù hợp.

## DEVELOPMENT RULES

- Trang quản trị có ba mục qua query `view`: `links` (mặc định), `users`,
  `operations`. Giữ URL cho bộ lọc và tài khoản được chọn. API danh sách chỉ
  dành cho admin, phân trang 25 bản ghi bằng ngày tạo + mã/ID ổn định.
- Danh sách phải hiển thị người tạo, trạng thái và thời hạn có tính expiry hold.
  Phân biệt link khách với tombstone đã xóa thông tin, không suy đoán người tạo.
  Tổng link của tài khoản là số link còn gắn tài khoản, không phải số từng tạo.
- Admin dùng chung validation và hộp sửa/thống kê với chủ link, nhưng qua route
  `/api/admin/links`. Không mở rộng quyền của `/api/links` cho người khác.
  Ghi audit cùng giao dịch sửa link. Không cho sửa/hồi sinh link đã ngừng hoạt động.
- Nút khóa link và khóa/mở khóa tài khoản nằm ngay trong danh sách, dùng API
  `/api/admin/action` và hộp xác nhận chung với Vận hành. Nêu đúng đối tượng,
  phân biệt khóa đăng nhập với khóa link. Dùng màu đỏ, ngăn gửi trùng và giữ
  bộ lọc/trang hiện tại khi tải lại. Nếu đã lưu nhưng tải lại lỗi, báo rõ đã lưu.
- Thử thêm `node scripts/test-admin-ui.mjs` khi sửa danh sách quản trị: phân trang,
  tìm kiếm, tài khoản không có link, lỗi/tải chậm, hộp chi tiết, sửa, thống kê,
  responsive và dữ liệu dài. Chỉ dùng API giả trên localhost.
- Xóa do admin dùng thùng rác 30 ngày qua `/api/admin/action`. Migration `0005`
  phải có trước khi deploy. Xóa link của chủ sở hữu vẫn theo luồng xóa vĩnh viễn.
  Tombstone cũ không thể hoàn tác. Không cấp lại mã sau khi dọn thùng rác.
- Xóa tài khoản phải thu hồi phiên, chặn OAuth/tạo link và đưa các link còn lưu
  vào thùng rác trong cùng giao dịch. Không cho xóa tài khoản quản trị. Khôi phục
  giữ trạng thái khóa, thời hạn và chỉ khôi phục link bị xóa cùng lần với tài khoản.
  Link xóa riêng giữ deadline riêng. Không cấp lại session khi hoàn tác.
- Worker quyết định hạn hoàn tác: trước `deleted_at + 30*86400000`, không kéo dài
  hạn khi gửi lặp. Cron dọn theo lô và kiểm tra lại deadline trong từng giao dịch.
  Không để thao tác của chủ link, cron hết hạn hoặc phiên cũ xóa dữ liệu thùng rác.
  Thống kê vẫn theo cửa sổ lưu 30 ngày hiện có. Backup/restore phải giữ metadata
  thùng rác. Không phục hồi nhầm tài khoản hoặc link đã xóa khi đọc bản sao lưu.
- Thùng rác có bộ lọc riêng, nút Hoàn tác và hạn cụ thể theo giờ Việt Nam. Xóa
  dùng màu đỏ và xác nhận nêu đối tượng, ảnh hưởng, hạn 30 ngày. Hoàn tác dùng
  màu hành động thường. Kiểm tra quyền, CSRF, rollback, hết hạn, xóa riêng rồi xóa
  tài khoản, phiên đăng nhập và không cấp lại mã trong `tests/admin-trash.test.ts`.
- Thùng rác cho phép admin Xóa vĩnh viễn ngay qua `purge_link` / `purge_user`,
  không cần chờ 30 ngày. Chỉ nhận bản ghi vẫn ở thùng rác tại thời điểm giao dịch.
  Xóa tài khoản dọn toàn bộ link còn gắn tài khoản, kể cả link xóa riêng, và thu
  hồi phiên. Giữ mã link thành tombstone, hạn mức tạo và nhật ký quản trị. Không
  cho xóa tài khoản admin. Dọn dữ liệu và ghi audit phải cùng giao dịch, rollback
  toàn bộ khi lỗi. Nút màu đỏ, xác nhận nêu đúng đối tượng và không thể hoàn tác.
  Thử cả dữ liệu vừa hoàn tác, yêu cầu lặp, lỗi audit và tài khoản nhiều link.

1. Tuân thủ design system và quy tắc nội dung trên.
2. Chạy app khi khả thi; xem giao diện render bằng browser trước và sau khi sửa.
3. Chụp và xem ảnh của nhóm trang đã thay đổi ở desktop, tablet và mobile.
4. Sửa vấn đề phát hiện từ ảnh hoặc thao tác; kiểm tra lại các trạng thái liên quan.
5. Chạy `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
   Repo có Prettier nhưng chưa có ESLint; dùng `npx prettier --check` cho các
   source đã sửa và ghi rõ đây là kiểm tra định dạng.
6. Kiểm thử UI thiết yếu: `node scripts/test-ui.mjs`. Script cần Playwright và
   Chrome đã cài; ưu tiên runtime có sẵn. Có thể đặt `PLAYWRIGHT_PACKAGE` thành
   đường dẫn tuyệt đối tới `playwright/package.json` của runtime đó. Đặt
   `UI_ORIGIN` tới Worker local (mặc định `http://localhost:8791`) và `UI_OUTPUT`
   để đổi thư mục bằng chứng. Khởi động lại Wrangler sau khi build để tránh
   manifest assets cũ. Không cần thêm Playwright vào dependency của ứng dụng.
7. Script UI chỉ chấp nhận localhost. Các thao tác ghi dùng API/Turnstile giả
   trong browser; lượt smoke test Worker thật chỉ đọc trang. Không dùng khóa,
   phiên hoặc dữ liệu production. Không bỏ qua xác thực trong code ứng dụng.
8. Không tuyên bố đã kiểm tra thiết bị thật, OAuth/Turnstile production hoặc
   screen reader khi chỉ có bằng chứng từ browser tự động. Ghi rõ giới hạn.

## Skills

Các skill thiết kế, gồm `iconography`, nằm trong `.agents/skills/`; nguồn và commit nằm trong
`.agents/skills/SOURCES.md`. Đọc trực tiếp hướng dẫn nếu Codex chưa nhận skill mới.
Ba skill nội dung đã cài ở cấp người dùng, không cần cài lại. Chỉ chạy script
bên thứ ba sau khi đọc nội dung; hướng dẫn của project và người dùng có ưu tiên.

## SEO RULES

- Metadata và nội dung chính phải có trong HTML ban đầu. Dùng `scripts/seo.mjs`
  và cấu hình trang trong `scripts/generate-pages.mjs`, không chèn SEO sau khi JS chạy.
- Chỉ khai báo `indexable: true` cho trang công khai có nội dung hữu ích. Trang
  mới mặc định noindex. `private: true` luôn thắng mọi cấu hình indexable.
- Mỗi trang công khai có title, description riêng, một H1 rõ nghĩa, canonical
  HTTPS đúng đường dẫn, Open Graph và metadata chia sẻ nhất quán với nội dung.
- Sitemap được sinh từ chính các trang indexable. Không thêm admin, dashboard,
  API, auth, link người dùng, URL chuyển hướng, query hay lastmod không có căn cứ.
- Giữ canonical `https://oh.io.vn/` và quy tắc trailing slash của các trang tĩnh.
  Không đổi URL hoặc cấu hình DNS/redirect production khi chưa được yêu cầu.
- Giữ chính sách robots hiện có. Robots không thay thế xác thực. API, auth,
  chuyển hướng link người dùng và trang lỗi của Worker có `X-Robots-Tag: noindex`.
  Không áp dụng header này cho các trang công khai từ assets binding.
- Giữ internal links dễ hiểu, có đích tồn tại. Không nhồi từ khóa, thêm trang
  mỏng, hoặc đổi lỗi 404 thành trang chủ 200 để che vấn đề crawl.
- Khi xử lý lịch sử domain, kiểm tra URL Inspection và báo cáo index thật.
  URL xuất hiện trong log, Wayback hoặc mục trang giới thiệu không chứng minh
  URL còn nằm trong chỉ mục Google. Báo cáo đang xử lý không đồng nghĩa 0 URL.
- Nội dung cũ không có trang thay thế tương đương phải tiếp tục trả lỗi 4xx,
  không redirect hàng loạt về trang chủ hoặc thêm robots Disallow chỉ để xóa
  index. Không dùng Removals để dọn hàng loạt URL đã ngừng phục vụ khi chưa có
  nhu cầu xóa khẩn được xác minh. Giữ WebSite/WebApplication nhận diện dịch vụ
  hiện tại và chỉ yêu cầu index trang công khai có giá trị. Đã gửi yêu cầu
  crawl không đồng nghĩa đã index hoặc đã cập nhật kết quả tìm kiếm.
- Cache dài chỉ cho tài nguyên có content hash trong `/assets/`. HTML phải
  revalidate, API và dữ liệu xác thực vẫn `no-store`.

## AEO RULES

- Trả lời trực tiếp câu hỏi thực tế: cách tạo, đăng nhập, chỉnh sửa, thời hạn,
  giới hạn và báo cáo vi phạm. Dùng các bước khi người dùng cần làm theo.
- Nội dung hướng dẫn phải khớp API và hành vi sản phẩm, nhất là đổi mã link,
  quyền quản lý, thời hạn và hạn mức. Không bịa chức năng hay cam kết.
- Dùng câu ngắn, heading có nghĩa. Không chia nhỏ văn bản theo số từ máy móc.
  FAQ chỉ thêm khi giúp người đọc, không tự động thêm FAQ rich-result schema.

## GEO RULES

- Nhận diện dịch vụ bằng `oh.io.vn`, với thông tin công khai chính xác và liên
  kết nguồn thật. Không gán tên cá nhân, thành tích, đánh giá hoặc số liệu giả.
- Giữ cùng nội dung cho người dùng và crawler. Không cloaking, tài liệu AI riêng
  mâu thuẫn với website, hoặc mở dữ liệu riêng tư để được AI truy cập.
- Phân biệt crawler tìm kiếm, truy xuất theo yêu cầu và huấn luyện. Không thay
  chính sách Cloudflare/robots chỉ vì muốn tăng lượt trích dẫn.
- Không coi `llms.txt` hay schema đặc biệt là điều kiện xuất hiện trong AI Search.
  Chỉ thêm định dạng mới khi có bên sử dụng cụ thể và kế hoạch duy trì.
- Không suy ra đã index, được AI trích dẫn hoặc tăng thứ hạng từ test localhost.

## STRUCTURED DATA RULES

- Dùng JSON-LD trong HTML với `@id` ổn định, bám sát nội dung hiển thị. WebSite
  mô tả thương hiệu, WebPage/AboutPage/ContactPage mô tả đúng loại trang.
- Chỉ dùng WebApplication cho công cụ thật. Schema.org hợp lệ không đồng nghĩa
  đủ điều kiện Google rich results. Không bịa offers, ratings, reviews hoặc tác giả.
- Không gắn JSON-LD hoặc metadata chia sẻ công khai vào trang riêng tư.
- Kiểm tra JSON-LD trong cả response và DOM. Xác thực Schema.org, kiểm tra
  điều kiện Google hiện hành khi nhắm tới một rich result cụ thể.
- Ảnh chia sẻ và favicon dùng logo thật, không thêm lời quảng cáo thiếu căn cứ.
  Tạo lại bằng `scripts/generate-social-card.mjs` với Playwright đã có khi cần.

## Kiểm tra khi thêm hoặc sửa trang công khai

1. Xác định mục đích trang và nhu cầu tìm kiếm, tránh trùng nội dung vô ích.
2. Kiểm tra metadata, canonical, indexability, sitemap và internal links.
3. Đánh giá schema dựa trên nội dung thật, không thêm mọi schema cho mọi trang.
4. Build, chạy Worker local và `node scripts/check-seo.mjs` với Playwright có sẵn.
   Script kiểm tra HTTP, HTML/DOM, liên kết, không-JS và ảnh 1440/768/390px.
5. Xem screenshot, thử CTA, bàn phím và các luồng hiện có, chạy các test liên quan.
6. Phân biệt Lighthouse lab với dữ liệu người dùng thật và số liệu Search Console.
   Ghi rõ môi trường, thời điểm và giới hạn đo, không hứa kết quả xếp hạng.
7. Vitest chỉ khám phá test của project trong `tests/`, không chạy test từ các
   công cụ/skill tải về `.local` hoặc `.agents`.

## SECURE CODING RULES

- Xác thực và phân quyền ở Worker. Mọi route quản lý link phải kiểm tra chủ sở
  hữu hoặc quyền admin, kể cả đọc thống kê. Không tin ID, role, owner, thời hạn
  hay trạng thái do frontend gửi ngoài danh sách trường được cho phép.
- Giữ session token ngẫu nhiên, chỉ lưu hash trong D1. Cookie production phải
  giữ `__Host-`, `Secure`, `HttpOnly`, `SameSite` và Path phù hợp. Khóa tài khoản
  phải thu hồi phiên. Giữ xác minh chữ ký, issuer, audience, nonce, state và PKCE
  của Google OAuth. Không bỏ kiểm tra để chạy được một fixture.
- Validate tại ranh giới server. Giới hạn body theo byte thực nhận, không chỉ
  Content-Length. Dùng prepared statements và bind giá trị. Tên bảng/cột động
  phải lấy từ allowlist trong code, không lấy trực tiếp từ request.
- Dùng chung `targetValue`, `canonicalHostname` và `blockTargetValue` khi sửa
  đích hoặc danh sách chặn. Chuẩn hóa hostname trước so sánh. Chặn URL bỏ qua
  fragment `#`, vẫn phân biệt scheme, path và query. Link hợp lệ vẫn giữ fragment
  khi chuyển hướng. Giữ tương thích với block cũ và không quét toàn bảng mỗi lượt.
- Không fetch URL đích do người dùng gửi. Nếu thêm preview/fetch về sau, phải
  đánh giá SSRF, DNS/IP, redirect và giới hạn response trước khi triển khai.
- API đọc và ghi có ngân sách tốc độ riêng, kiểm tra trước truy vấn D1. Giới hạn
  theo binding Cloudflare không thay thế quota nguyên tử trong D1 hoặc WAF.
  Không tự áp giới hạn API lên đường chuyển hướng công khai và static assets.
- Giữ Origin + CSRF cho thao tác cookie-auth, không mở CORS tùy tiện. Backup
  nội bộ dùng bearer secret riêng, kiểm tra trước đọc/ghi. Không xuất session
  hoặc network hash vào backup. Không đưa token vào URL.
- Không hardcode hoặc log secret, cookie, token, nội dung backup hay lỗi SQL.
  Trả lỗi chung khi có lỗi nội bộ. Đầu vào người dùng phải được escape đúng ngữ
  cảnh HTML hoặc gán bằng textContent/value. Không thêm eval, event handler từ
  chuỗi, script URL động hoặc unsafe-inline/unsafe-eval cho script.
- Khi sửa auth, quyền, API, query, session, upload, export hoặc tích hợp ngoài:
  truy vết input tới sink, xét quyền thực tế và thêm regression test có ý nghĩa.
  Phân biệt lỗ hổng đã tái hiện, rủi ro chưa xác minh và hardening.

## SECURITY VERIFICATION AND DELIVERY

- Chỉ tái hiện bằng dữ liệu giả trên local/staging được cho phép. Không kiểm thử
  khai thác, fuzz/stress production, đọc dữ liệu thật hay tự rotate credentials.
- Test Worker phải override mọi credential provider/backup bằng fixture rỗng
  hoặc giả. Mock Google/Turnstile, không dùng secret trong `.dev.vars` để gọi ngoài.
- Chạy `npm run test:security`, `npm test`, `npm run build`, `npm run security:audit`
  và `npm run security:secrets -- <Gitleaks đã xác minh>`. Gitleaks phải redact
  100%, kiểm tra Git history, file trong phạm vi Git và frontend build.
- Khi sửa UI có dữ liệu người dùng hoặc CSP, chạy `scripts/test-security-ui.mjs`
  và `scripts/test-csp.mjs` với Playwright hiện có. Test UI chỉ cho localhost,
  dùng dữ liệu giả, kiểm tra 1440/768/390px và xem screenshot.
- Giữ audit dependency và secret scan trong job `verify` trước deploy. Ghim
  Actions bằng SHA đã kiểm tra từ repository gốc, công cụ tải về bằng version
  và SHA-256. Không tăng permissions/secret scope để chạy scanner.
- Không sửa Git history hoặc thêm allowlist rộng để làm scanner hết cảnh báo.
  Xác minh false positive và che giá trị nhạy cảm khi ghi nhận phát hiện.
- Giữ nguyên các thay đổi chưa commit. Bản vá chưa có trên production cho tới
  khi người dùng cho phép push/deploy. Không đồng nhất test local với bảo đảm
  an toàn tuyệt đối hoặc xác minh cấu hình production.
