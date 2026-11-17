# EnglishGym

Tool tự luyện tiếng Anh một người dùng: **nói/viết → AI gợi ý lỗi → bạn duyệt → sổ lỗi → làm lại**.
Plan chi tiết: [docs/plan.md](docs/plan.md).

Stack: Nuxt 4 (SPA, `ssr: false`) · Nitro `server/api` · Drizzle + Turso/libSQL · Gemini (`@google/genai`) · Zod · Dexie.

## Cài đặt (dev)

```sh
npm install
cp .env.example .env          # điền GEMINI_API_KEY, SESSION_SECRET
npm run db:migrate            # tạo bảng (SQLite file data/local.db)
npm run db:seed               # nạp 20 đề tình huống công việc
npm run user:create -- you@example.com "mat-khau-it-nhat-10-ky-tu"
npm run dev
```

Mở trên điện thoại cùng mạng: `npm run dev -- --host`. Lưu ý micro chỉ hoạt động trên HTTPS hoặc `localhost`.

## Buổi 0: kiểm chứng Gemini

Không cần chạy app. Đặt clip + đáp án vào `golden_samples/` (xem [README](golden_samples/README.md)), rồi:

```sh
npm run eval:gemini -- --runs 2
```

Kết quả so với ngưỡng mục 4 của plan; chi tiết lưu ở `golden_samples/results/`.

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy dev |
| `npm test` | Vitest: hàm kiểm tra `original_quote` và KPI |
| `npm run typecheck` | Kiểm tra kiểu |
| `npm run db:generate` | Sinh migration sau khi sửa `server/db/schema.ts` |
| `npm run db:migrate` | Áp migration (dev hoặc Turso, theo `DATABASE_URL`) |
| `npm run format` | Prettier (cấu hình giống CRM) |

## Deploy (Vercel + Turso)

1. `turso db create englishgym` → lấy URL `libsql://…` và token.
2. Chạy migrate/seed/user:create một lần với `DATABASE_URL`, `DATABASE_AUTH_TOKEN` của Turso.
3. Vercel: import repo, đặt biến môi trường `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_DAILY_LIMIT`,
   `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET`. Không dùng tiền tố `NUXT_PUBLIC_`.
4. Nitro tự nhận preset Vercel; `maxDuration` của function đặt 60s trong `nuxt.config.ts`.

## Cấu trúc

```text
app/                    # Frontend (Vue)
  api/                  #   gọi API theo domain: authApi, attemptApi, mistakeApi, backupApi
  pages/                #   trang mỏng: index (Hôm nay), speaking, writing, review/[id], mistakes, history, login
  components/
    base/               #   dùng chung: Toast, CopyPrompt, TopicSelect
    layout/             #   BottomNav, AppMenu
    speaking/ review/ mistakes/   # thành phần theo tính năng
  composables/          #   useRecorder, useLocalDb (IndexedDB), useReviewForm, useSpeakingSubmit…
  constants/
server/                 # Backend (Nitro)
  api/                  #   route mỏng: validate → gọi service
  services/             #   nghiệp vụ: geminiService, attemptService, mistakeService, backupService
  db/                   #   schema Drizzle + migrations
  utils/                #   session cookie, scrypt, rate limit, quota, http helpers
  middleware/auth.ts    #   chặn mọi /api trừ đăng nhập
shared/                 # Dùng chung client + server + script
  utils/                #   quote (khớp đoạn trích), kpi, aiSchema (Zod → JSON Schema), prompts, patternKey
  types/ constants/
scripts/                # create-user, seed-topics, gemini-eval (Buổi 0)
tests/                  # Vitest
```

## Quy tắc đã cài trong code

- Lỗi **chỉ vào sổ sau khi duyệt** (`POST /api/attempts/:id/confirm`). Đoạn trích không khớp hoặc dài bất thường → bỏ tick sẵn, gắn "cần xem lại".
- Chống trùng: `client_attempt_id` unique (nộp lại trả kết quả cũ, không gọi Gemini lần hai); unique `(attempt_id, issue_index)` cho `mistake_hits`; xác nhận lần hai không đổi gì.
- `ai_json` giữ nguyên bản gốc; chỗ bạn sửa nằm ở `final_transcript` và `mistake_hits`. Mỗi lượt lưu `model` + `prompt_version`.
- Gemini: JSON sai schema thử lại đúng 1 lần; 429 không thử lại, hiện **Copy prompt**. Giới hạn lượt/ngày bằng bảng `rate_counters`.
- Audio chỉ nằm trong IndexedDB của máy đã ghi (lưu ngay khi dừng); bản chưa gửi được nằm ở mục "Chưa gửi" để gửi lại.
- Upload tối đa 3 MB, MIME theo danh sách cho phép (`shared/constants/app.ts`).
