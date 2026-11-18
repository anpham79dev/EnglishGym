# Kiến trúc EnglishGym

Tài liệu này mô tả cách code được tổ chức và dữ liệu chạy qua hệ thống. Mục tiêu sản phẩm và phạm vi
P0/P1/P2 nằm ở [docs/plan.md](docs/plan.md); cách cài đặt và chạy nằm ở [README.md](README.md).

## 1. Tổng quan

```text
┌──────────────────────── Trình duyệt (Nuxt SPA, ssr: false) ────────────────────────┐
│ pages/  ──►  components/<feature>/  ──►  composables/  ──►  app/api/*Api.ts ($fetch)│
│                                              │                                      │
│                                              └─► IndexedDB (Dexie): audio, nháp,     │
│                                                  hàng chờ gửi lại                    │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │ HTTPS + cookie eg_session (httpOnly, SameSite=Strict)
┌───────────────────────────────────────▼──────── Nitro (Vercel Functions) ───────────┐
│ server/middleware/auth.ts  ──►  server/api/* (validate Zod)  ──►  server/services/*  │
│                                                                    │         │       │
│                                              Gemini API ◄──────────┘         │       │
│                                                                              ▼       │
│                                                        Drizzle ──► Turso / SQLite    │
└──────────────────────────────────────────────────────────────────────────────────────┘
                      shared/  (dùng chung client + server + scripts)
```

Nguyên tắc chính:

- **Một project Nuxt duy nhất**: giao diện và API trong cùng repo, cùng domain. Vì cùng domain nên cookie
  `SameSite=Strict` đủ để chống CSRF.
- **SPA**: MediaRecorder và IndexedDB chỉ có ở trình duyệt; app một người dùng không cần SSR.
- **Server chỉ lưu chữ**: audio gửi lên để chấm rồi bỏ, bản gốc chỉ nằm trên máy đã ghi.
- **AI chỉ đề xuất**: không có đường nào ghi vào sổ lỗi mà không qua bước người dùng xác nhận.

## 2. Các lớp và trách nhiệm

| Lớp | Thư mục | Được làm | Không làm |
| --- | --- | --- | --- |
| Trang | `app/pages/` | Ghép component, đọc query, điều hướng | Chứa logic nghiệp vụ dài |
| Component theo tính năng | `app/components/{speaking,review,mistakes}/` | UI của một tính năng | Gọi `$fetch` trực tiếp |
| Component dùng chung | `app/components/{base,layout}/` | Toast, CopyPrompt, TopicSelect, menu, thanh điều hướng | Biết về một tính năng cụ thể |
| Composable | `app/composables/` | Trạng thái và logic phía client: ghi âm, IndexedDB, form duyệt, gửi bài nói | Render UI |
| Client API | `app/api/` | Một file cho mỗi domain, gom URL và kiểu trả về; `http.ts` chuẩn hoá lỗi | Giữ state |
| Route | `server/api/` | Validate đầu vào bằng Zod, gọi service, trả kết quả | Viết SQL hoặc gọi Gemini trực tiếp |
| Service | `server/services/` | Nghiệp vụ, transaction, gọi Gemini | Đọc request/response |
| Tiện ích server | `server/utils/` | Cookie phiên, scrypt, rate limit, quota, helper HTTP | Nghiệp vụ |
| Dùng chung | `shared/` | Hàm thuần, kiểu, hằng số, prompt, schema | Phụ thuộc Nuxt, DOM hay DB |
| Script | `scripts/` | Tạo user, seed đề, Buổi 0 | Import qua alias `#shared` |

Kiểm tra kiểu: `tsconfig.json` ở gốc tham chiếu các tsconfig Nuxt sinh trong `.nuxt/` (app, server,
shared, node) và `tsconfig.tools.json` cho `drizzle.config.ts`, `scripts/`, `tests/` (có kiểu Node).

Cách chia này học từ dự án CRM: client API tách theo domain (`api/*Queries.ts` → `app/api/*Api.ts`),
trang mỏng, component chia theo tính năng.

## 3. Mô hình dữ liệu

```text
users (1 dòng)

topics ──< attempts ──< mistake_hits >── mistakes
              │
              └─ attempt_group_id: các lần nói lại / phiên bản bài viết cùng nhóm, version tăng dần

rate_counters: key → (window_start, count)   // giới hạn đăng nhập sai và lượt gọi Gemini/ngày
```

| Bảng | Ý nghĩa | Ràng buộc quan trọng |
| --- | --- | --- |
| `attempts` | Một lần nộp bài nói hoặc viết | `client_attempt_id` unique (chống gửi trùng) |
| `mistakes` | Một **kiểu** lỗi, không phải một lần sai | `pattern_key` unique; `hit_count`, `first_seen`, `last_seen` luôn tính lại từ hits |
| `mistake_hits` | Một lần mắc lỗi trong một lượt nộp | Unique `(attempt_id, issue_index)`: xác nhận hai lần không đếm trùng |
| `rate_counters` | Bộ đếm theo cửa sổ thời gian cố định | Lưu trong DB vì serverless function không giữ RAM giữa các lần gọi |

Các trường của `attempts` cần chú ý:

- `ai_json`: kết quả gốc của Gemini, **không bao giờ sửa**.
- `text_or_transcript`: bài viết gốc, hoặc bản chép lời do AI tạo.
- `final_transcript`: bản người dùng đã sửa và chốt khi xác nhận.
- `model`, `prompt_version`: để so sánh khi đổi model hoặc prompt.
- `processing_at`: lần gần nhất chuyển sang `processing`, dùng để phát hiện bài chấm bị kẹt.

Thời gian lưu dạng mili-giây (`integer`). Mọi khoá chính là UUID dạng text, nhờ vậy xuất/nhập không bị
xung đột id.

## 4. Vòng đời một lượt nộp

```text
            nộp (client_attempt_id)
                    │
        ┌───────────▼───────────┐   đã chấm (needs_review/confirmed) → trả lại bản ghi cũ
        │      processing       │   đang chấm < 2 phút → 409 IN_PROGRESS
        └───────────┬───────────┘   kẹt > 2 phút (function bị dừng) → chấm lại như failed
          Gemini OK │   Gemini lỗi / quota / quá 25 giây / JSON sai 2 lần
        ┌───────────▼───────┐   ┌────────────┐
        │   needs_review    │   │   failed   │ ── nộp lại cùng client_attempt_id → processing
        └───────────┬───────┘   └────────────┘
     người dùng xác nhận
        ┌───────────▼───────┐
        │     confirmed     │   xác nhận lần nữa → không đổi gì
        └───────────────────┘
```

- Mỗi lần chuyển sang `processing` ghi `processing_at`; `PROCESSING_STALE_MS` (2 phút) quyết định khi
  nào coi row là kẹt. Lệnh nhận lại row là `UPDATE` có điều kiện, nên hai request song song không cùng
  chấm. Hai request cùng tạo mới thì request thua vi phạm unique và nhận 409 `IN_PROGRESS`.
- Mỗi lần gọi Gemini có timeout `GEMINI_TIMEOUT_MS` (25 giây). Hết giờ thì báo `AI_TIMEOUT`, không gọi lại.
- Hạn mức ngày (`consumeGeminiQuota`) được đếm trước **mỗi** lần gọi, kể cả lần gọi lại vì JSON sai, và
  reset lúc 0h giờ Việt Nam (`APP_UTC_OFFSET_MIN`).

### 4.1 Luyện nói

1. `useRecorder` dò định dạng bằng `MediaRecorder.isTypeSupported()` (thứ tự ưu tiên trong
   `RECORDER_MIME_CANDIDATES`), ghi ở 32 kbps, tự dừng sau 120 giây, đo mức âm để phát hiện không có tiếng.
2. Khi dừng, trang `speaking.vue` kiểm tra kích thước (≤ 3 MB) rồi **lưu ngay vào IndexedDB** với
   `status: 'pending'` và một `client_attempt_id` mới.
3. `useSpeakingSubmit` gửi multipart tới `POST /api/attempts/speaking`.
4. Route kiểm tra `content-length`, kích thước, MIME gốc (bỏ `;codecs`) và đề, rồi gọi
   `submitAttempt` với hàm chấm `gradeWithGemini(…, { beforeCall: consumeGeminiQuota })`.
5. Chỉ khi server trả bài đã chấm (`needs_review` hoặc `confirmed`), IndexedDB mới đổi sang `sent` và
   lưu `attemptId`, sau đó chuyển tới `/review/:id`.
   Thất bại: bài giữ nguyên `pending` kèm `lastError`, hiện trong mục "Chưa gửi" để gửi lại.

### 4.2 Luyện viết

Bản nháp nằm trong IndexedDB (`drafts`, id `current`) và tự lưu sau 400 ms. Mã lượt nộp được tạo cùng
bản nháp và giữ nguyên tới khi nộp thành công, nên gửi lại sau lỗi không tạo lượt trùng. Nếu sửa chữ
sau một lần nộp lỗi thì tạo mã mới, để server không trả lại kết quả của bản cũ (trừ lỗi `IN_PROGRESS`).
Bản nháp chỉ bị xoá khi bài đã chấm xong.
"Viết phiên bản mới" mở `/writing?from=<id>`, giữ `attempt_group_id`; server tự tăng `version`.

### 4.3 Duyệt và xác nhận

`useReviewForm` dựng trạng thái màn duyệt từ `ai_json`:

- Mỗi lỗi chạy `assessIssue`: đoạn trích **khớp** văn bản và **không dài bất thường** thì tick sẵn;
  ngược lại bỏ tick và gắn nhãn "cần xem lại".
- `pattern_key` lấy từ gợi ý của AI qua `toPatternKey`. Nếu key đã có trong sổ thì điền sẵn nhãn cũ.
- Sửa bản chép lời sẽ kiểm tra lại độ khớp nhưng không tự đổi tick.
- Lỗi tự thêm dùng `issue_index` từ 1000 để không trùng chỉ số của AI.

`POST /api/attempts/:id/confirm` (`confirmAttempt`) chạy trong **một transaction**:

1. Mỗi lỗi đã tick: tìm `mistakes` theo `pattern_key`, chưa có thì tạo.
2. Chèn `mistake_hits` với `onConflictDoNothing`.
3. `recomputeMistake` tính lại `hit_count`, `first_seen`, `last_seen` từ hits.
4. Đổi lượt nộp sang `confirmed`, lưu `final_transcript`, điểm tự chấm, số từ đệm.

## 5. Tích hợp Gemini

`server/services/geminiService.ts` là nơi duy nhất gọi Gemini (ngoài script Buổi 0).

- Model đọc từ `GEMINI_MODEL`, không viết cứng trong code.
- Structured output: `responseJsonSchema` sinh từ schema Zod bằng `toGeminiSchema` (bỏ `$schema` và
  `additionalProperties`). Sau đó **validate lại bằng Zod**, vì schema chỉ đảm bảo đúng cấu trúc, không
  đảm bảo nội dung đúng.
- Kiểm tra nội dung (đoạn trích có thật trong văn bản không) làm ở client khi duyệt, bằng
  `shared/utils/quote.ts`.

| Tình huống | Xử lý | Mã lỗi gửi client |
| --- | --- | --- |
| JSON hỏng hoặc sai schema | Thử lại đúng 1 lần | `INVALID_AI` (502) |
| Gemini trả 429 | Không thử lại | `QUOTA` (429) |
| Vượt giới hạn lượt/ngày của app | Chặn trước khi gọi | `DAILY_LIMIT` (429) |
| Lỗi khác của Gemini | Báo lỗi | `AI_ERROR` (502) |

Client dùng `shouldOfferManualPrompt` để hiện **Copy prompt** (prompt lấy từ `buildManualPrompt`, kèm
nút tải audio cho bài nói) với 4 mã lỗi trên.

Đổi nội dung prompt trong `shared/utils/prompts.ts` thì tăng `PROMPT_VERSION`.

## 6. Xác thực và bảo vệ

- Cookie `eg_session` = `<userId>.<hết hạn ms>.<HMAC-SHA256>` ký bằng `SESSION_SECRET`, sống 30 ngày.
  Không cần bảng sessions cho một người dùng. Các hàm tên `*AuthCookie` để tránh trùng helper session
  của h3.
- `server/middleware/auth.ts` chặn mọi `/api/*` trừ `/api/auth/login` và `/api/auth/me`.
  `app/middleware/auth.global.ts` chặn trang khi chưa đăng nhập.
- Mật khẩu: tối thiểu 8 ký tự (kiểm tra trong `scripts/create-user.ts`), hash bằng `scrypt` của
  `node:crypto`, so sánh bằng `timingSafeEqual`. Tài khoản chỉ tạo hoặc đổi mật khẩu qua script, không có
  trang đăng ký.
- Đăng nhập sai quá 5 lần trong 15 phút theo IP thì bị chặn (`rate_counters`).
- Biến môi trường chỉ đọc qua `process.env` ở server, không dùng `runtimeConfig.public`.

## 7. Lưu trữ phía client

| Store (Dexie, DB `englishgym`) | Khoá | Nội dung |
| --- | --- | --- |
| `audios` | `client_attempt_id` | Blob audio, MIME thực tế, thời lượng, đề, `status: pending/sent`, lỗi gần nhất |
| `drafts` | `'current'` | Bản nháp bài viết đang làm |

`pending` chính là hàng chờ gửi lại; không có bảng hàng chờ riêng. App xin `navigator.storage.persist()`
nhưng không hứa giữ audio, vì trình duyệt vẫn có thể tự xoá. Menu có nút xoá các audio đã gửi.

`localStorage` chỉ giữ mốc sao lưu gần nhất (`eg:lastBackupAt`) để nhắc xuất JSON.

## 8. Sao lưu và nhập lại

- `GET /api/export?format=json`: mọi bảng trừ `users` và `rate_counters`, kèm `schema_version` và số bản ghi.
- `format=csv`: sổ lỗi, có BOM để Excel đọc đúng tiếng Việt.
- `format=anki`: CSV có header `#separator`, `#html`, `#tags column` để nhập thẳng vào Anki. Các trường
  được escape HTML.
- `POST /api/import`: nhập theo thứ tự khoá ngoại `topics → attempts → mistakes → mistake_hits`, theo lô
  50 dòng, trong một transaction, `onConflictDoNothing`. Gộp được vào DB đã có dữ liệu:
  - attempt khớp theo `client_attempt_id`, mistake khớp theo `pattern_key`; hit được trỏ lại sang id
    trong DB nên không có hit mồ côi
  - `hit_count`, `first_seen`, `last_seen` được tính lại bằng `recomputeMistake`
  - DB đã có lỗi trọng tâm thì giữ lỗi đó
  - trả về số bản ghi trước, sau, trong file và số dòng bỏ qua.
- Vercel giới hạn body 4,5 MB. Export JSON lớn hơn `MAX_BACKUP_BYTES` (4 MB) trả 413 `TOO_LARGE`, menu
  nhập chặn file lớn hơn mức này. Khi đó dùng script chạy trên máy, đọc ghi thẳng `DATABASE_URL`:
  `npm run db:backup` (ghi `backups/englishgym-YYYY-MM-DD.json`) và `npm run db:restore -- <file>` (cùng
  logic với `importAll`). `backupService.ts` và `mistakeService.ts` import `shared/` bằng đường dẫn
  tương đối vì script chạy ngoài Nuxt.

Đổi cấu trúc file xuất thì tăng `EXPORT_SCHEMA_VERSION`.

## 9. Buổi 0: script kiểm chứng

`scripts/gemini-eval.ts` chạy độc lập, không cần Nuxt hay DB, nhưng dùng **chung prompt, schema và hàm
khớp đoạn trích** với app (import tương đối từ `shared/`). Vì vậy kết quả đo phản ánh đúng hành vi của
app. Script so với đáp án tự viết trong `golden_samples/*.json` và báo 4 chỉ số theo ngưỡng mục 4 của
plan: giữ lỗi ngữ pháp trong transcript, gợi ý nghi bịa, JSON hợp lệ, nghi viết lại cả bài.

## 10. Muốn thay đổi X thì sửa ở đâu

| Việc | Chỗ sửa |
| --- | --- |
| Thêm cột hoặc bảng | `server/db/schema.ts` → `npm run db:generate` → `npm run db:migrate` |
| Đổi prompt hoặc schema đầu ra AI | `shared/utils/prompts.ts`, `shared/utils/aiSchema.ts`; tăng `PROMPT_VERSION` |
| Thêm định dạng audio | `ALLOWED_AUDIO_MIME`, `RECORDER_MIME_CANDIDATES` trong `shared/constants/app.ts` |
| Thêm nhóm lỗi | `ISSUE_CATEGORIES` (shared) và `CATEGORY_LABELS` (`app/constants`) |
| Thêm endpoint | Route mỏng trong `server/api/`, logic trong `server/services/`, hàm gọi trong `app/api/` |
| Thêm hoặc sửa đề | `scripts/seed-topics.ts` rồi `npm run db:seed` (bỏ qua đề đã có), hoặc sửa thẳng DB |
| Đổi giới hạn | `MAX_AUDIO_BYTES`, `MAX_RECORD_SECONDS`, `MAX_WRITING_CHARS`; `GEMINI_DAILY_LIMIT` trong env |

## 11. Hướng mở rộng (P1)

- **Thẻ ôn FSRS**: thêm bảng `cards`, `review_logs`; tạo thẻ từ `mistakes` đã xác nhận; lịch ôn tính ở
  server để hai thiết bị không ghi đè nhau.
- **Thống kê tuần, so sánh hai lần nói**: dữ liệu đã có sẵn trong `attempts` (`attempt_group_id`,
  `version`, `final_transcript`, `duration_s`, `filler_count`, `self_rating`).
- **PWA và hàng chờ offline tự động**: hàng chờ đã có (`audios.status = 'pending'`); chỉ cần thêm
  service worker và tự gửi lại khi có mạng.
- **Tách chép lời và chấm thành 2 lần gọi** (phương án dự phòng 2 trong plan): thêm hàm mới trong
  `geminiService`; luồng `submitAttempt` và màn duyệt giữ nguyên.
