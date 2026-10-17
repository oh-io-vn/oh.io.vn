# Yêu cầu sản phẩm oh.io.vn

Ngày chốt: 17/10/2026, múi giờ Asia/Ho_Chi_Minh.

Trạng thái: yêu cầu đã được chủ dự án đồng ý trong cuộc trao đổi trước khi viết mã. Tài liệu này ghi các quyết định sản phẩm; kiến trúc và kế hoạch kỹ thuật đề xuất nằm trong [ARCHITECTURE.md](ARCHITECTURE.md).

Các giới hạn thử nghiệm và ngưỡng giảm tải dưới đây là cấu hình khởi đầu đã thống nhất, cần kiểm chứng bằng đo đạc trước khi mở công khai. Chúng không phải cam kết về sức tải hoặc mức sử dụng miễn phí của nhà cung cấp.

## 1. Mục tiêu và nguyên tắc

- Tên miền chính: `oh.io.vn`; chủ dự án đã thuê tên miền một năm và cần tiếp tục gia hạn nếu duy trì dịch vụ.
- Xây công cụ rút gọn link hữu ích cho cộng đồng, đồng thời giúp chủ dự án thử sức xây dựng và vận hành sản phẩm thực tế.
- Đối tượng là bất kỳ ai cần rút gọn link; giao diện chỉ hỗ trợ tiếng Việt.
- Miễn phí cho người sử dụng; ưu tiên vận hành bằng các gói miễn phí.
- Mã nguồn mở trên GitHub, giấy phép MIT cho phần mã nguồn của dự án. Giữ thông tin giấy phép của font, icon và thư viện bên thứ ba.
- Hiện là dự án phi thương mại. Có thể cân nhắc yếu tố thương mại hạn chế trong tương lai để duy trì dịch vụ; chưa có mô hình kinh doanh được chốt.
- Cho phép đóng góp tự nguyện, không bắt buộc và không gắn với điều kiện được chuyển hướng.
- Không tự nâng gói trả phí hoặc tự bật dịch vụ có thể phát sinh phí. Chi phí mới phải là quyết định riêng của chủ dự án.
- Ưu tiên đơn giản, gọn nhẹ, ít thao tác, dễ duy trì và bảo vệ tài nguyên.
- Quan tâm SEO, GEO, AEO để người dùng tìm thấy dịch vụ; không cam kết lượng người dùng hoặc thứ hạng tìm kiếm.
- Không quảng bá link là tồn tại vĩnh viễn. Khả năng hoạt động phụ thuộc thời hạn link, tên miền, dữ liệu và việc duy trì dịch vụ.

## 2. Vai trò

1. Khách: chưa đăng nhập, được tạo link nhưng không có quyền quản lý.
2. Thành viên: đăng nhập Google, được tạo và quản lý link của mình.
3. Người truy cập link: bấm link rút gọn để đến địa chỉ đích, không cần tài khoản.
4. Quản trị: chủ dự án, có quyền xử lý lạm dụng và điều khiển trạng thái dịch vụ.

Google là phương thức đăng nhập duy nhất trong bản đầu. Đăng nhập không miễn trừ giới hạn hoặc kiểm tra bảo vệ hệ thống.

## 3. Luồng sử dụng chính

### 3.1. Tạo link

- Luồng chính: dán địa chỉ → rút gọn → sao chép.
- Hiển thị kết quả rõ ràng, nút sao chép và thông tin thời hạn phù hợp.
- Xác minh chống bot và giới hạn sử dụng được áp dụng khi cần, giảm tương tác thủ công cho người bình thường.
- Nhắc khách đăng nhập trước khi tạo nếu muốn quản lý link và xem thống kê.
- Không hỗ trợ nhận lại quyền quản lý link khách sau khi đăng nhập ở bản đầu.

### 3.2. Chuyển hướng

- Link hợp lệ chuyển thẳng đến địa chỉ đích.
- Luồng bình thường không có trang chờ, đếm ngược, quảng cáo, đăng nhập hoặc CAPTCHA cho người bấm link.
- Link không tồn tại, hết hạn, đã xóa hoặc bị vô hiệu hóa không được chuyển hướng đến địa chỉ đích.
- Lỗi thống kê không được làm hỏng chuyển hướng nếu hệ thống còn khả năng phục vụ.
- Trong tình huống tấn công nặng, có thể cần biện pháp khẩn cấp ảnh hưởng đến trải nghiệm; không cam kết luôn phục vụ trên hạ tầng miễn phí.

## 4. Quyền và chức năng bản đầu

| Chức năng | Khách | Thành viên Google |
| --- | --- | --- |
| Tạo link với mã ngẫu nhiên | Có | Có, mặc định |
| Chọn mã sau tên miền | Không | Có, nếu khả dụng |
| Danh sách và tìm kiếm link của mình | Không | Có |
| Đặt tên ghi nhớ | Không | Có, tùy chọn |
| Sửa địa chỉ đích | Không | Có |
| Sửa tên ghi nhớ | Không | Có |
| Xóa link của mình | Không | Có |
| Đặt hoặc sửa ngày hết hạn cố định | Không | Có, tùy chọn |
| Đổi mã link sau khi tạo | Không | Không |
| Xem thống kê | Không | Có, chỉ link của mình |
| Xuất Excel | Không | Có, chỉ dữ liệu của mình |

- Mã link mặc định được tạo ngẫu nhiên, không dùng ID tuần tự công khai.
- Tên ghi nhớ dùng trong trang quản lý, không phải trang trung gian của người bấm link.
- Mã tùy chỉnh áp dụng nguyên tắc ai tạo trước được dùng trước.
- Giữ lại tên hệ thống và tên dễ gây nhầm lẫn, tối thiểu gồm `admin`, `api`, `login`, `support`; bổ sung các đường dẫn mà ứng dụng sử dụng.
- Mã link giữ nguyên suốt vòng đời. Muốn mã khác phải tạo link mới.
- Mọi mã đã sử dụng đều không được cấp lại sau khi xóa, hết hạn hoặc vô hiệu hóa. Có thể giữ một bản ghi tối thiểu đánh dấu mã đã dùng và dọn phần dữ liệu không còn cần thiết.
- Quy tắc ký tự, độ dài, chuẩn hóa chữ hoa/chữ thường và giới hạn độ dài địa chỉ đích thuộc đặc tả kỹ thuật cần ghi rõ trước khi triển khai chức năng tương ứng.

## 5. Thời hạn và gia hạn link

### 5.1. Hết hạn do không hoạt động

| Loại link | Thời hạn khi tạo | Khi có lượt truy cập hợp lệ được ghi nhận |
| --- | --- | --- |
| Tạo bởi khách | 3 tháng từ lúc tạo | Tính lại 3 tháng từ lượt truy cập đó |
| Tạo bởi thành viên Google | 12 tháng từ lúc tạo | Tính lại 12 tháng từ lượt truy cập đó |

- Đây là thời hạn không hoạt động, không phải tuổi thọ tối đa tính từ lần tạo đầu tiên.
- Link được sử dụng tiếp có thể tồn tại nhiều năm.
- Tháng được tính theo tháng lịch. Nếu tháng đích không có ngày tương ứng thì dùng ngày cuối tháng.
- Giao diện hiển thị thời điểm hết hạn theo giờ Việt Nam.
- Mốc tính ban đầu là thời điểm tạo khi chưa có lượt truy cập.

### 5.2. Lượt truy cập dùng để gia hạn

- Là lượt yêu cầu chuyển hướng hợp lệ được hệ thống ghi nhận.
- Người bấm không cần đăng nhập. Chủ link tự bấm cũng được tính.
- Mở trang quản lý, xem thống kê, yêu cầu bị chặn và yêu cầu chỉ kiểm tra thông tin không thực hiện chuyển hướng không gia hạn.
- Link đã hết hạn, đã xóa hoặc bị vô hiệu hóa không được tự hồi sinh bởi lượt truy cập mới.
- Loại bot và trình xem trước nhận diện được trong khả năng hợp lý; chấp nhận sai số, không hứa nhận diện chính xác người thật.
- Không dùng thời hạn làm biện pháp chống lạm dụng duy nhất: người tạo có thể tự truy cập link để giữ hoạt động.

### 5.3. Ngày hết hạn do chủ link đặt

- Thành viên có thể đặt ngày hết hạn cố định, không bắt buộc.
- Hạn có hiệu lực là thời điểm đến trước giữa hạn không hoạt động và hạn cố định, nếu có.
- Truy cập không kéo dài vượt hạn cố định.
- Giao diện giải thích rõ sự khác nhau giữa hai loại hạn và hiển thị hạn có hiệu lực.

### 5.4. Dọn dữ liệu và sự cố

- Link hết hạn ngừng chuyển hướng và được dọn dữ liệu theo tác vụ bảo trì.
- Giữ dấu mã đã dùng; không cấp lại mã.
- Thông tin lần truy cập gần nhất và gia hạn độc lập với dữ liệu thống kê 30 ngày.
- Khi ghi nhận truy cập gặp sự cố hoặc không đáng tin cậy, tạm hoãn dọn link bị ảnh hưởng để tránh xóa nhầm; thiết kế kỹ thuật phải bao gồm cách tránh làm hết hạn nhầm trong thời gian này.

## 6. Thống kê và Excel

- Chỉ chủ link được xem và xuất thống kê của link đó.
- Không có trang thống kê công khai trong bản đầu.
- Phạm vi gồm lượt truy cập theo ngày, nguồn giới thiệu nhận diện được và nhóm thiết bị: điện thoại, máy tính, khác.
- Lưu lịch sử thống kê 30 ngày gần nhất; không hứa tổng lượt trọn đời trong bản đầu.
- Nguồn thiếu thông tin hiển thị `Không xác định`; không tự gán là truy cập trực tiếp.
- Không hứa nhận diện chính xác mọi nguồn Facebook, Zalo hoặc ứng dụng khác.
- Không gọi số lượt truy cập là số người thật duy nhất. Có thể chứa bot hoặc lượt xem trước chưa nhận diện được.
- Ưu tiên số liệu tổng hợp, tránh hồ sơ từng người truy cập hoặc lưu toàn bộ sự kiện không cần thiết.
- Khi giảm hoặc tạm dừng thống kê, thông báo rõ khoảng thời gian dữ liệu bị thiếu; không điền giả thành số 0 hoặc tạo ấn tượng đầy đủ.
- Xuất định dạng Excel `.xlsx`; ưu tiên tạo file trên trình duyệt để giảm xử lý máy chủ.
- Không có tính năng tải Excel trở lại để phân tích ở bản đầu.

## 7. Giới hạn sử dụng khởi đầu

Các giá trị sau đã được thống nhất làm cấu hình thử nghiệm, có thể điều chỉnh sau khi đo tài nguyên. Chưa được xác nhận là đủ để đảm bảo không chạm quota.

| Hạng mục | Giới hạn khởi đầu |
| --- | --- |
| Khách tạo link | 3 link trong 24 giờ trên một địa chỉ mạng |
| Thành viên tạo link | 20 link trong 24 giờ trên một tài khoản |
| Link đang hoạt động trên một tài khoản | 100 link |
| Tổng link mới toàn dịch vụ khi mở thử | 200 link trong 24 giờ |
| Tạo hàng loạt hoặc API công khai | Chưa hỗ trợ |

- Có thêm giới hạn thao tác dồn dập trong thời gian ngắn cho tạo, sửa và các chức năng nhạy cảm; số cụ thể được đo và cấu hình ở bước triển khai.
- Giới hạn ngày cần ghi rõ thời điểm/cửa sổ khôi phục cho người dùng; cách thực thi cửa sổ 24 giờ phải được đặc tả và kiểm chứng.
- Kết hợp giới hạn theo tài khoản, tín hiệu mạng và toàn hệ thống; không chỉ dựa vào IP.
- Giới hạn khách theo mạng có thể ảnh hưởng người dùng chung mạng; thông báo rõ và gợi ý đăng nhập. Thành viên vẫn chịu các biện pháp bảo vệ chung.
- Kiểm tra đồng thời để nhiều yêu cầu cùng lúc không vượt giới hạn cứng đã đặt.
- Các giá trị có thể thay đổi bằng cấu hình có kiểm soát; không yêu cầu sửa logic nghiệp vụ.

## 8. Chống bot và xử lý lạm dụng

- Dùng Cloudflare Turnstile cho thao tác tạo link với cách tích hợp giảm ma sát; kiểm tra token ở máy chủ.
- Thành viên vẫn có thể bị yêu cầu xác minh và bị hạn chế.
- Có biện pháp bảo vệ trước khi yêu cầu chạy vào phần xử lý ứng dụng trong phạm vi gói miễn phí hỗ trợ.
- Từ chối sớm đầu vào sai và hành vi bất thường; tính cả chi phí của yêu cầu bị từ chối.
- Sửa địa chỉ đích phải áp dụng các kiểm tra an toàn tương ứng với tạo mới.
- Chặn địa chỉ đích đã xác nhận độc hại và vô hiệu hóa link lừa đảo được xác nhận.
- Không hứa tự nhận diện hoặc chặn mọi link lừa đảo ngay lập tức.
- Không kết luận chỉ từ lượng truy cập tăng rằng đó là tấn công; cố gắng hạn chế nguồn/thao tác đáng ngờ trước.
- Công bố email tố cáo và hướng dẫn gửi link rút gọn, lý do, bằng chứng nếu có. Bản đầu chưa xây hệ thống phiếu tố cáo.

## 9. Quản trị

- Chỉ chủ dự án hoặc định danh quản trị được cấu hình mới có quyền quản trị.
- Tìm link để kiểm tra và xử lý báo cáo.
- Vô hiệu hóa link, khóa tài khoản và quản lý danh sách chặn địa chỉ đích.
- Tạm ngừng khách tạo link, tạm ngừng tạo link toàn hệ thống và giảm/tắt thống kê.
- Xem trạng thái dịch vụ và thông tin tài nguyên cần thiết để vận hành.
- Nhật ký thay đổi quản trị tối thiểu phục vụ xử lý sự cố, tuân theo thời gian lưu đã quy định.
- Khóa tài khoản phải có quy tắc xử lý các link liên quan được đặc tả trước khi viết chức năng này.

## 10. Quota và giảm tải

- Theo dõi riêng lượt xử lý, lượt đọc, lượt ghi và dung lượng lưu trữ. Không gom mọi hạn mức thành một con số duy nhất.
- Hạn chế tạo dữ liệu mới và giảm công việc phụ để ưu tiên chuyển hướng link đang có.
- Ưu tiên phục vụ link thành viên, sau đó cố gắng duy trì link khách; thiết kế cần tránh tạo thêm chi phí chỉ để phân loại ưu tiên.
- Dừng thống kê không được đồng thời dừng gia hạn link nếu vẫn có khả năng ghi nhận lượt truy cập.

| Mức sử dụng tài nguyên liên quan | Hành động thử nghiệm |
| --- | --- |
| Khoảng 70% | Cảnh báo quản trị, theo dõi tốc độ tăng |
| Khoảng 80% | Giảm thống kê tốn tài nguyên; có thể tạm ngừng khách tạo link |
| Khoảng 90% | Tạm ngừng tạo mới toàn hệ thống, giảm thao tác phụ để ưu tiên chuyển hướng |

- Các ngưỡng cần hiệu chỉnh sau đo đạc, chừa khoảng đệm vì số liệu có thể cập nhật trễ.
- Dung lượng lưu trữ không được coi là tài nguyên tự khôi phục vào ngày hôm sau.
- Chỉ thông báo thời điểm mở lại khi biết đúng cơ chế đặt lại hạn mức.
- Thông báo rõ chức năng đang bị ảnh hưởng, không hứa link vẫn hoạt động nếu nhà cung cấp đã chặn phục vụ.
- Có công tắc thủ công cho quản trị trong trường hợp giám sát tự động gặp lỗi.
- Chấp nhận có thể thiếu thống kê hoặc gián đoạn khi vượt khả năng hạ tầng miễn phí; không cam kết uptime tuyệt đối hoặc miễn nhiễm tấn công.

## 11. Dữ liệu, quyền riêng tư và bí mật

| Nhóm | Dữ liệu cần thiết và thời gian lưu |
| --- | --- |
| Tài khoản | Định danh Google, email, tên hiển thị cần thiết |
| Link | Mã, địa chỉ đích, chủ sở hữu nếu có, tên ghi nhớ, thời điểm tạo, truy cập và hết hạn, trạng thái |
| Thống kê | Tổng hợp theo ngày, nguồn, nhóm thiết bị; 30 ngày |
| Dữ liệu giới hạn thao tác | Trong thời gian cần cho cửa sổ giới hạn |
| Nhật ký xử lý sự cố/quản trị | Tối đa 7 ngày theo cấu hình khởi đầu |
| Mã đã sử dụng | Dấu tối thiểu giữ lâu dài để không cấp lại |

- Không xây hồ sơ từng người bấm link hoặc lưu lịch sử IP lâu dài cho thống kê.
- Không lưu toàn bộ URL giới thiệu có query nhạy cảm nếu chỉ cần thông tin nguồn.
- Hạn chế dữ liệu nhạy cảm trong log; không log token, cookie phiên, bí mật hoặc toàn bộ địa chỉ đích một cách mặc định.
- Dữ liệu tài khoản, địa chỉ đích riêng tư, token và bản sao lưu không nằm trong repository công khai.
- Quy định sử dụng và thông báo quyền riêng tư riêng với giấy phép mã nguồn, viết ngắn gọn bằng tiếng Việt.
- Cần đặc tả quy trình yêu cầu xóa dữ liệu tài khoản trước khi mở công khai; đây là chi tiết triển khai chưa được chốt riêng.

## 12. Sao lưu và khôi phục

- Có phương án sao lưu trước khi mở công khai.
- Mục tiêu ban đầu: sao lưu tự động mỗi ngày, giữ các bản gần nhất theo kiểu xoay vòng.
- Có ít nhất một bản ngoài nơi chạy dữ liệu chính, truy cập riêng tư.
- Ưu tiên tài khoản, link, trạng thái khóa và mã đã sử dụng; thống kê có ưu tiên thấp hơn.
- Mã nguồn GitHub không thay thế sao lưu dữ liệu.
- Kiểm chứng khôi phục thành công trên môi trường tách biệt trước khi mở công khai.
- Công cụ, nơi lưu, số bản cụ thể và cách tránh vượt dung lượng miễn phí được chốt trong thiết kế vận hành.

## 13. Thiết kế và nội dung

- Phong cách siêu tối giản, phẳng, sáng sủa.
- Màu nhấn xanh nước biển sáng, thiên pastel; chữ và điều khiển phải dễ đọc.
- Một họ font duy nhất: Space Grotesk; kiểm tra hiển thị tiếng Việt đầy đủ.
- Icon Lucide: <https://lucide.dev/>.
- Sử dụng thuận tiện trên điện thoại và máy tính; thao tác bàn phím, nhãn điều khiển và trạng thái lỗi rõ ràng.
- Không ép đăng nhập khi khách chỉ muốn tạo link trong hạn mức.
- Liên kết đóng góp nhẹ nhàng trên trang chủ, trang quản lý và thông báo giảm chức năng ở các trang này; không chen vào chuyển hướng hợp lệ.
- Các trang công khai giới thiệu và hướng dẫn có nội dung tiếng Việt rõ ràng, phục vụ khả năng tìm kiếm. Không công khai dữ liệu riêng tư để phục vụ SEO.

## 14. Hạ tầng đã chọn

- Cloudflare làm nền tảng chính: Workers, Static Assets, D1 và Turnstile.
- GitHub lưu mã nguồn mở và hỗ trợ kiểm tra/phát hành theo nhu cầu.
- Không cần Vercel trong kiến trúc ban đầu. Có thể đánh giá lại khi có lý do cụ thể.
- Không dùng Git commit hoặc GitHub Actions cho từng lượt tạo/bấm link.
- Framework, thư viện, schema, cấu hình route và cơ chế giám sát là đề xuất kỹ thuật; phải đáp ứng tài liệu này và hạn mức đã kiểm chứng.

## 15. Ngoài phạm vi bản đầu

- Mật khẩu bảo vệ link.
- Website nhập Excel để xem lại/phân tích thống kê.
- API công khai và tạo link hàng loạt.
- Đăng nhập bằng phương thức khác Google.
- Nhận lại quyền quản lý link khách sau đăng nhập.
- Đổi mã link đã tạo, cấp lại mã cũ hoặc lời hứa link vĩnh viễn.
- Hệ thống phiếu tố cáo và thống kê công khai.
- Tính phí, quảng cáo trung gian hoặc mô hình thương mại chưa được quyết định.

## 16. Điều kiện trước khi mở công khai

- Kiểm chứng các luồng tạo, sao chép, chuyển hướng, đăng nhập, quản lý, hết hạn, thống kê, xuất Excel và quản trị.
- Kiểm chứng quyền sở hữu: không đọc, sửa, xóa hoặc xuất dữ liệu của tài khoản khác.
- Kiểm chứng cộng tháng lịch, cuối tháng/năm nhuận, hạn cố định và lượt truy cập đồng thời.
- Kiểm chứng tranh chấp mã tùy chỉnh, giới hạn tài khoản/toàn hệ thống và việc không cấp lại mã.
- Kiểm chứng lỗi ghi nhận truy cập, giảm tải, ngừng thống kê và hoãn dọn link an toàn.
- Đo tài nguyên cho các luồng chính, kể cả yêu cầu bị chặn, bot và thao tác quản trị; điều chỉnh mức thử nghiệm khi cần.
- Có cấu hình bảo vệ, thông báo quyền riêng tư, quy định sử dụng, email tố cáo và cơ chế quản trị.
- Sao lưu và khôi phục đã chạy thử thành công.
- Bí mật được lưu an toàn, dữ liệu runtime không bị công khai cùng mã nguồn.
- Chủ dự án cung cấp/cấu hình tài khoản Google quản trị, Google OAuth, Cloudflare, GitHub, DNS và email tố cáo; thông tin nhận đóng góp chỉ cần khi bật.
- Hạn mức, điều khoản và khả năng của các gói miễn phí được kiểm tra lại trước khi triển khai thật.

## 17. Cách quản lý thay đổi

- Quy tắc sản phẩm đã chốt chỉ thay đổi khi có quyết định rõ ràng của chủ dự án.
- Con số thử nghiệm có thể hiệu chỉnh theo đo đạc, phải ghi lại giá trị và lý do.
- Nếu cần rút ngắn thời hạn link trong tương lai, thông báo trước và tránh làm link cũ hết hạn đột ngột.
- Các chi tiết kỹ thuật chưa quyết định trong tài liệu này không được ngầm thay đổi quyền, thời hạn hoặc cam kết sản phẩm.

## 18. Thông tin triển khai do chủ dự án cung cấp

Cập nhật ngày 17/10/2026 theo yêu cầu thiết lập domain, repository và email.

- Tổ chức GitHub: `oh-io-vn`; repository dự án: `https://github.com/oh-io-vn/oh.io.vn`.
- Email công khai nhận báo cáo lạm dụng: `abuse@oh.io.vn`.
- Cấu hình chuyển tiếp được yêu cầu: `abuse@oh.io.vn` → `oh.io.vn@proton.me` qua Cloudflare Email Routing. Trạng thái thực tế phải được xác minh và ghi trong tài liệu vận hành.
- Thông tin đóng góp tự nguyện do chủ dự án cung cấp để hiển thị trên website:
  - Ngân hàng: TPBank.
  - Chủ tài khoản: NGUYỄN THÀNH NHÂN.
  - Số tài khoản: `0802 8329 999`.
  - Tên/alias đi kèm: `thanhnhanaz`.
  - Ảnh QR gốc: [assets/donate/tpbank-vietqr.png](assets/donate/tpbank-vietqr.png).
- Giữ nguyên ảnh QR đã cung cấp; không dựng lại hoặc thay đổi nội dung thanh toán. Không thực hiện giao dịch để kiểm tra.
- Ảnh QR và thông tin chuyển khoản là dữ liệu đóng góp do chủ dự án cung cấp; giấy phép MIT của mã nguồn không mặc định cấp quyền sử dụng danh tính hoặc thông tin thanh toán cho mục đích khác.
