# EnglishGym

Tool tự luyện tiếng Anh cho dev web: nói hoặc viết theo tình huống công việc, AI gợi ý lỗi, bạn duyệt lại,
lỗi đã duyệt được lưu vào sổ để ôn và làm lại.

## Công nghệ

- **Nuxt 4** (Vue 3, TypeScript), chạy dạng SPA
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
- **Dự phòng**: khi Gemini lỗi hoặc hết quota, có nút Copy prompt để chấm bằng AI khác; bài chưa gửi được giữ trên máy để gửi lại

## Cách chạy

Yêu cầu Node.js 22 trở lên.

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
```
