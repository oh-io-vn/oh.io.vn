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

## UX RULES

- Nhãn nút phải nói rõ hành động. Hướng dẫn không chen giữa trường chính và nút
  gửi trên mobile.
- Gắn lỗi với trường tương ứng. Mở phần tùy chỉnh trước khi focus vào trường lỗi.
- Khi chờ API, báo đang xử lý và ngăn gửi trùng. Không cho sửa cấu hình quản trị
  trước khi tải thành công các giá trị hiện tại.
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

Năm skill thiết kế nằm trong `.agents/skills/`; nguồn và commit nằm trong
`.agents/skills/SOURCES.md`. Đọc trực tiếp hướng dẫn nếu Codex chưa nhận skill mới.
Ba skill nội dung đã cài ở cấp người dùng, không cần cài lại. Chỉ chạy script
bên thứ ba sau khi đọc nội dung; hướng dẫn của project và người dùng có ưu tiên.
