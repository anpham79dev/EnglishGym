# EnglishGym

Tool tự luyện tiếng Anh cho dev web: nói hoặc viết theo tình huống công việc, AI gợi ý lỗi, bạn duyệt lại,
lỗi đã duyệt được lưu vào sổ để ôn và làm lại.

## Công nghệ

- **Nuxt 4** (Vue 3, TypeScript), chạy dạng SPA
- **Nuxt UI 4** + **Tailwind CSS 4** cho giao diện, icon Lucide, font Inter (có bộ tiếng Việt), sáng/tối
- **Nitro** `server/api` cho backend
- **Drizzle ORM** + **Turso / SQLite**
- **Gemini API** (`@google/genai`) để chép lời và gợi ý lỗi
- **Zod** để validate dữ liệu và đầu ra của AI
- **Dexie** (IndexedDB) lưu audio và bản nháp trên máy
- **Vitest**, **Prettier**

## Tính năng

- **Hôm nay**: đề nói và đề viết mỗi ngày, số bài đã làm, lỗi trọng tâm tuần
- **Luyện nói**: ghi âm 1–2 phút, nghe lại, nộp để nhận bản chép lời và gợi ý lỗi
- **Luyện viết**: viết bài, nhận gợi ý lỗi, sửa và nộp phiên bản mới
- **Duyệt lỗi**: sửa bản chép lời, bỏ tick hoặc sửa lỗi AI đề xuất, tự chấm độ trôi chảy, xem tốc độ nói và số lỗi
- **Sổ lỗi**: lọc theo nói/viết, sửa, gộp, tách lỗi, chọn lỗi trọng tâm tuần
- **Xuất / nhập dữ liệu**: JSON để sao lưu, CSV sổ lỗi, CSV cho Anki
- **Dự phòng**: khi Gemini lỗi hoặc hết quota, dán JSON chấm bằng AI khác hoặc tự duyệt không cần AI; bài chưa gửi được giữ trên máy để gửi lại
- **Kho đề**: thêm, sửa, tắt đề, gắn tag, nhập từ JSON/CSV, đề TOEIC có bấm giờ chuẩn bị và trả lời
- **Ôn lỗi**: thẻ ôn từ chính câu mình từng sai, lịch giãn cách FSRS; kiểm tra tuần với những lỗi hay sai nhất
- **Streak và lịch**: chuỗi ngày luyện, mục tiêu 5 ngày mỗi tuần, lịch tháng, điểm danh ngày tự học bằng sách
- **Tiến bộ**: biểu đồ theo tuần (lỗi/100 từ, tái phạm lỗi trọng tâm, tốc độ nói, tỉ lệ tự bắt được lỗi, tỉ lệ nhớ), bài đối chứng hằng tháng
- **Tự tìm lỗi trước khi xem AI** và **so sánh các phiên bản** của cùng một đề

## Cách chạy

Yêu cầu Node.js 24 trở lên.

```sh
npm install
cp .env.example .env        # điền GEMINI_API_KEY và SESSION_SECRET
npm run db:migrate          # tạo database
npm run db:seed             # nạp đề mẫu
npm run user:create -- you@example.com "mat-khau-it-nhat-8-ky-tu"
npm run dev                 # mở http://localhost:3000
```

Các lệnh khác:

```sh
npm test                    # chạy test
npm run typecheck           # kiểm tra kiểu
npm run build               # build production
npm run db:backup           # sao lưu JSON thẳng từ DATABASE_URL, không giới hạn dung lượng
npm run db:restore -- <file.json>   # nhập lại file sao lưu (giữ dữ liệu đang có)
```
