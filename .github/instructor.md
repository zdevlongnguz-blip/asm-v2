# Instructor

## 1. Nguyên tắc viết code
- Viết code đơn giản, dễ hiểu, phù hợp với người mới học JavaScript.
- Dùng cú pháp JavaScript cơ bản, tránh cách viết quá phức tạp nếu không cần thiết.
- Ưu tiên rõ ràng, ngắn gọn, dễ đọc hơn tối ưu hóa cực đoan.
- Không viết logic lồng quá sâu khi có thể tách thành hàm đơn giản.

## 2. Comment bắt buộc
- Mỗi hàm tiện ích phải có comment giải thích mục đích.
- Nếu logic có thể gây nhầm lẫn, phải comment rõ từng bước.
- Khi hàm cần đầu vào đầu ra rõ ràng, phải ghi comment ví dụ input/output mẫu.
- Comment nên viết bằng tiếng Việt nếu project đang làm theo tiếng Việt.

## 3. Test bắt buộc
- Mọi hàm core phải có test tương ứng.
- Test phải kiểm tra behavior thật, không chỉ mock.
- Mỗi trường hợp quan trọng nên có ít nhất 1 test rõ ràng.

## 4. Logging bắt buộc
- Mọi hàm tiện ích quan trọng phải ghi log khi chạy.
- Dùng logger.info cho các flow thành công hoặc cache hit.
- Dùng logger.warn cho lỗi, dữ liệu rỗng, hoặc fallback không thành công.
- Log nên ngắn, rõ, có giá trị cho debug.

## 5. Fallback & xử lý lỗi
- Nếu có dữ liệu offline, ưu tiên dùng dữ liệu offline trước.
- Chỉ gọi external API khi thật sự cần.
- Khi gọi API thất bại, phải log cảnh báo và trả về giá trị an toàn.

## 6. Mẫu style
- Hàm nên ngắn, dễ đọc, rõ ý nghĩa.
- Không để phần comment quá dài và rườm rà.
- Tập trung vào giáo dục, maintainability và dễ debug.
