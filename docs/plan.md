# Plan tool tự học tiếng Anh (Nuxt + Gemini)

Nov 17, 2026 · @An niige

## 1. Mục tiêu, nguyên tắc và phạm vi

Bản 2.1 này dựa trên bản 2.0 bạn gửi, giữ các quyết định cốt lõi, làm nhẹ phần kỹ thuật thừa với app một người dùng, và đánh dấu rõ chỗ cần kiểm tra.

**Mục tiêu duy nhất:** biến vòng lặp **nói hoặc viết → nhận phản hồi → xác nhận lỗi → ôn lại → thử lại** thành thói quen dễ duy trì. Nội dung luyện tập trung vào tình huống công việc của dev web: mô tả bug, giải thích code, báo cáo tiến độ, trao đổi requirement.

**Thành công nghĩa là:** dùng ít nhất 5 ngày mỗi tuần, bớt thao tác chép tay, và không tự động ghi nhớ những lỗi do AI đoán mò. Chất lượng học quan trọng hơn số tính năng.

**Nguyên tắc bắt buộc:**

1. Học tiếng Anh luôn ưu tiên hơn code tool. Không lấy giờ học ngày thường để code.
2. Một project Nuxt full-stack duy nhất. Không tách microservice, không làm app mobile native.
3. AI chỉ đề xuất lỗi. Lỗi chỉ vào sổ sau khi bạn duyệt (mặc định chấp nhận, bạn bỏ tick lỗi nào thấy sai).
4. Có bản Alpha dùng được trước 30/3/2027. FSRS, thống kê và PWA nâng cao làm sau khi Alpha chứng minh hữu ích.
5. Không phụ thuộc hoàn toàn vào gói Gemini miễn phí, một trình duyệt hay việc chạy nền.
6. Mục tiêu chi phí 0 đồng mỗi tháng khi còn đủ quota. Kiểm tra lại giới hạn và chính sách lúc triển khai.

**Phạm vi theo mức ưu tiên:**

| Chức năng | Mức |
| --- | --- |
| Đăng nhập cá nhân, lưu dữ liệu trên server | P0 (Alpha) |
| Luyện viết, gợi ý lỗi, lưu phiên bản | P0 (Alpha) |
| Luyện nói 1–2 phút: ghi âm, bản chép lời, phản hồi | P0 (Alpha) |
| Sửa bản chép lời, duyệt lỗi trước khi lưu | P0 (Alpha) |
| Sổ lỗi tối giản, xuất CSV và JSON | P0 (Alpha) |
| Màn hình Hôm nay tối giản | P0 (Alpha) |
| Nút "Copy prompt" để chấm thủ công khi Gemini lỗi | P0 (Alpha) |
| Xuất CSV sang Anki | P0 nếu còn thời gian, không chặn phát hành |
| Thẻ ôn FSRS với `ts-fsrs` | P1 |
| Thống kê tuần, so sánh 2 lần nói | P1 |
| PWA cài đặt, hàng chờ offline đầy đủ | P1 |
| Đo khoảng lặng bằng phân tích âm thanh | P1, chỉ khi thấy cần |
| Phỏng vấn AI thời gian thực, chấm phát âm, nhập lịch CSV | P2 |

**Quy tắc cắt phạm vi:** tính năng nào làm trễ Alpha thì chuyển sang P1. Không bao giờ cắt bước duyệt lỗi hay phần kiểm thử dữ liệu.

## 2. Kiến trúc và stack

Một project Nuxt chứa cả giao diện và API, deploy lên Vercel, database Turso. Audio chỉ nằm trên thiết bị đã ghi, server chỉ lưu chữ.

```text
Trình duyệt (Nuxt, Vue, TypeScript)
  ├─ Viết bài, ghi âm bằng MediaRecorder, nghe lại
  ├─ IndexedDB: audio cục bộ, bản nháp, hàng chờ gửi lại
  └─ HTTPS + cookie phiên
             │
Nuxt server/api (Vercel Functions)
  ├─ Kiểm tra phiên, giới hạn lượt gọi, validate
  ├─ Gemini adapter: model, phiên bản prompt, schema
  ├─ Duyệt lỗi: chỉ lỗi đã xác nhận mới vào sổ
  └─ Drizzle → Turso (SQLite)
```

| Thành phần | Quyết định | Lý do |
| --- | --- | --- |
| Full-stack | Nuxt 3, Vue 3, TypeScript | Đúng stack bạn đang dùng. Khóa phiên bản khi khởi tạo |
| API | Nuxt `server/api` trên Vercel Functions | Đủ cho app cá nhân |
| Database | Turso + Drizzle, SQLite file khi dev | Dữ liệu nhỏ, deploy đơn giản |
| AI | Gemini API, model Flash có hỗ trợ audio và structured output, chọn sau Buổi 0 | Tên model đặt trong biến `GEMINI_MODEL`, không hard-code |
| Ghi âm | MediaRecorder, dò định dạng bằng `isTypeSupported()` | Ít code hơn tự nén MP3 |
| Lưu cục bộ | IndexedDB (Dexie) | Audio, bản nháp, hàng chờ. Không phải nơi sao lưu |
| Validate | Zod, chuyển sang JSON Schema gửi Gemini | Kiểm tra cả cấu trúc lẫn logic đầu ra |
| Ôn thẻ (P1) | `ts-fsrs`, lịch ôn tính ở server | Tránh hai thiết bị tính lịch rồi ghi đè nhau |
| Giao diện | Web responsive trước, PWA sau | Tập trung vào giá trị học trước |

**Audio:**

- Theo nhật ký thay đổi tài liệu Gemini API ngày 28/8/2026, danh sách định dạng audio đã được mở rộng, có thêm WebM và Opus. Nhờ vậy Chrome gửi thẳng file WebM được, không cần nén lại MP3. Vẫn thử thật ở Buổi 0.
- Mỗi lần ghi lưu lại `mimeType` thực tế. Server chỉ nhận các MIME trong danh sách cho phép.
- Giới hạn upload của app là **3 MB**, thấp hơn giới hạn 4,5 MB của Vercel để có biên an toàn. File lớn hơn thì báo bạn nói ngắn lại.
- Thử trên Chrome máy tính, Android và Safari iOS nếu có máy.
- Audio **không đồng bộ giữa các thiết bị** trong Alpha. Nút nghe lại chỉ hiện khi audio còn trên máy đã ghi. Trình duyệt có thể tự xóa dữ liệu cục bộ, nên app không hứa giữ audio 30 ngày.

## 3. Màn hình Alpha và KPI

Alpha chỉ có 4 khu vực, làm thành tab ở thanh điều hướng dưới cùng, không cần 4 trang phức tạp.

1. **Hôm nay:** đề nói, đề viết và số bài đã làm trong ngày. Một chạm để bắt đầu.
2. **Luyện nói:** chọn đề, ghi âm 1–2 phút, nghe lại, nộp. Xem bản chép lời, sửa chỗ AI nghe sai, xem danh sách lỗi đề xuất (mặc định đã tick), bỏ tick hoặc sửa lỗi nào thấy sai, bấm Lưu.
3. **Luyện viết:** tự viết, nộp, xem lỗi đề xuất. AI không viết lại cả bài. Sửa rồi nộp phiên bản mới. Chỉ tô lỗi trong bài khi đoạn trích của AI khớp đúng văn bản gốc.
4. **Sổ lỗi:** các lỗi đã duyệt, lọc theo nói hoặc viết, gộp hoặc tách thủ công, chọn 1 lỗi trọng tâm tuần, xuất CSV và JSON.

Các thao tác cần có như xuất dữ liệu, đăng xuất, xóa audio cục bộ nằm trong một menu gọn.

**KPI đúng bản chất:**

| Chỉ số | Cách tính | Lưu ý | Mức |
| --- | --- | --- | --- |
| Tốc độ nói toàn bài | số từ ÷ (thời lượng giây ÷ 60) | Từ bản chép lời đã duyệt | Alpha |
| Số từ đệm | Đếm trong bản chép lời đã duyệt | "like", "you know" có khi là từ dùng đúng, cho phép chỉnh tay | Alpha |
| Lỗi trên 100 từ | số lỗi đã duyệt × 100 ÷ số từ | Không tính lỗi bạn đã bỏ tick | Alpha |
| Độ trôi chảy | Bạn tự chấm 1–5 | AI chỉ gợi ý, không coi là đánh giá khách quan | Alpha |
| Tốc độ nói khi có tiếng | số từ ÷ thời gian có tiếng nói | Cần phát hiện tiếng nói đủ tin cậy | P1 |
| Ngừng quá 3 giây | Phân tích tín hiệu âm thanh | Phụ thuộc mic và tiếng ồn | P1 |

Các chỉ số tính từ bản chép lời vẫn phụ thuộc vào độ chính xác nhận dạng và bước duyệt của bạn. Nói nhanh hơn không có nghĩa là giỏi hơn: mỗi tháng nên so 2 bài cùng độ khó về đúng ý, từ vựng, ngữ pháp và độ tự tin.

## 4. Buổi 0: cổng kiểm chứng Gemini

Buổi 0 là bắt buộc và làm sau khi xong phần chính của đồ án. Chưa biết Gemini có đủ đáng tin hay không thì chưa viết app. Buổi này chỉ cần một script Node nhỏ, chưa cần Nuxt.

**Bộ test:**

- Bắt đầu với 8–10 clip dài 30–120 giây, nâng lên ít nhất 20 clip trước khi phát hành Alpha.
- Có đủ các kiểu: nói bình thường, cố ý nói sai ngữ pháp, ngập ngừng, từ đệm, tiếng ồn nhẹ, và vài câu hoàn toàn đúng để xem AI có bịa lỗi không.
- Tự viết bản chép lời chuẩn và đánh dấu lỗi chuẩn trước khi gọi AI. Lưu vào thư mục `golden_samples/`, không chứa dữ liệu công ty.
- Chạy cùng model và prompt ít nhất 2 lượt trên vài mẫu để xem kết quả có ổn định không.
- Thử gửi file WebM ghi từ Chrome và file MP4/AAC ghi từ Safari nếu có.

**Ngưỡng tự đặt (mục tiêu, chưa phải số đã đo):**

| Chỉ số | Mục tiêu | Nếu không đạt |
| --- | --- | --- |
| Giữ nguyên lỗi ngữ pháp được nói rõ trong bản chép lời | Từ 85% trở lên | Bắt buộc bước sửa bản chép lời, cân nhắc tách chép lời và chấm thành 2 lần gọi |
| Lỗi do AI bịa | Tối đa 10% số gợi ý | Prompt chỉ đưa lỗi chắc chắn, tăng bước duyệt |
| JSON hợp lệ sau validate | Từ 95% trở lên | Đơn giản hóa schema, cho thử lại 1 lần |
| Không viết lại cả bài | 100% các test | Đổi prompt, chặn ở giao diện |

`responseSchema` kết hợp Zod chỉ đảm bảo đúng cấu trúc, không chứng minh nội dung đúng. Server phải kiểm tra đoạn trích `original_quote` có thật trong bản chép lời hoặc bài viết.

**Phương án dự phòng, theo thứ tự:**

1. Mặc định: một lần gọi Gemini với audio, nhận bản chép lời và lỗi.
2. Nếu Gemini hay sửa câu khi chép lời: tách thành chép lời trước, bạn sửa bản chép lời, rồi mới gửi văn bản đi chấm. Chậm hơn nhưng đáng tin hơn.
3. Nếu hết quota hoặc model lỗi: giữ bản nháp, hiện nút "Copy prompt" để bạn dán vào AI khác. Không mất buổi học.
4. Nếu đến cuối tháng 1/2027 vẫn không đạt: Alpha chỉ gồm luyện viết và sổ lỗi, không cố làm phần nói khi chưa đáng tin.

## 5. Luồng xử lý và hợp đồng dữ liệu AI

Mỗi lượt nộp đi qua 2 bước: AI chấm và lưu với trạng thái chờ duyệt, sau đó bạn duyệt thì lỗi mới vào sổ.

**Luyện nói:**

1. Chọn đề, ghi âm bằng MediaRecorder, lưu audio vào IndexedDB ngay khi dừng.
2. Frontend tạo `client_attempt_id` (UUID). Khi gửi lại vẫn dùng đúng ID này nên không tạo phiên trùng.
3. `POST /api/attempts/speaking` dạng multipart: audio, `mimeType`, đề, thời lượng, `client_attempt_id`. Server kiểm tra kích thước, MIME và số lượt gọi trong ngày.
4. Server gọi Gemini với model và phiên bản prompt cố định, validate bằng Zod, lưu lượt nộp với trạng thái `needs_review`. Chưa ghi gì vào sổ lỗi.
5. Giao diện hiện bản chép lời và danh sách lỗi (mặc định đã tick). Bạn sửa bản chép lời nếu AI nghe sai, bỏ tick hoặc sửa lỗi nếu cần.
6. `POST /api/attempts/:id/confirm` lưu bản chép lời cuối cùng và các lỗi đã duyệt trong một transaction, tạo `mistake_hits` không trùng lặp.
7. Nút "Nói lại" tạo lượt mới cùng `attempt_group_id` để so sánh sau này. Audio cục bộ đã bị xóa thì ẩn nút nghe lại.

**Luyện viết:** gửi văn bản kèm đề, nhận danh sách lỗi có `original_quote`, `suggested_correction`, `reason_vi`, `category`. Chỉ tô lỗi khi đoạn trích khớp đúng văn bản gốc. Bài nộp lại dùng cùng `attempt_group_id` và `version` tăng dần.

**Prompt cốt lõi (rút gọn):**

```text
You are an English coach for a Vietnamese web developer.
You are NOT an authority on what was actually spoken.
For audio: transcribe as faithfully as possible, including repetitions,
false starts, fillers and grammatical mistakes. Never silently improve it.
For writing: preserve the student's original text.
Suggest only HIGH-CONFIDENCE, actionable grammar or word-choice issues.
For each issue, quote the exact source phrase and suggest one correction,
with a brief Vietnamese explanation. Do not invent a source quotation.
Do not rewrite the whole answer. Do not assign an exam score.
Return JSON matching the supplied schema. Topic: {topic}
```

**Hợp đồng JSON cho bài nói:**

```json
{
  "transcript": "...",
  "issues": [
    {
      "original_quote": "...",
      "suggested_correction": "...",
      "reason_vi": "...",
      "category": "tense",
      "pattern_key_suggestion": "past-simple-time-marker"
    }
  ],
  "focus_pattern_suggestion": "..."
}
```

Bài viết dùng schema riêng, bỏ trường `transcript`. `pattern_key_suggestion` chỉ là gợi ý, không tự động dùng làm khóa gộp lỗi. Chưa yêu cầu mốc thời gian theo giây khi chưa chứng minh được độ chính xác.

## 6. Dữ liệu tối thiểu

Alpha chỉ cần 6 bảng. Gộp bài nói và bài viết vào một bảng `attempts` để ít code hơn.

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| `users` | id, email, password\_hash, created\_at | Một tài khoản duy nhất là bạn |
| `topics` | id, kind (speaking/writing), title, prompt, level, active | Kho đề, sửa tay được |
| `attempts` | id, client\_attempt\_id (unique), kind, topic\_id, attempt\_group\_id, version, status, text\_or\_transcript, final\_transcript, duration\_s, mime\_type, model, prompt\_version, ai\_json, processing\_at, created\_at | `status`: processing, needs\_review, confirmed, failed |
| `mistakes` | id, pattern\_key, label\_vi, example\_wrong, example\_right, category, first\_seen, last\_seen, hit\_count, is\_focus | Mỗi dòng là một kiểu lỗi, không phải một lần sai |
| `mistake_hits` | id, mistake\_id, attempt\_id, issue\_index, original\_quote, correction | Unique (attempt\_id, issue\_index) để xác nhận hai lần vẫn không đếm trùng |
| `rate_counters` | key, window\_start, count | Giới hạn đăng nhập và lượt gọi Gemini, xem mục 8 |

**Để sang P1:** `cards` và `review_logs` cho ôn thẻ bằng `ts-fsrs`, tạo thẻ từ lỗi đã xác nhận.

**Quy tắc:**

- `pattern_key` do bạn chốt khi xác nhận. AI chỉ gợi ý, app tự điền sẵn nếu đã có key giống.
- Lưu `model` và `prompt_version` trong mỗi lượt để sau này so sánh khi đổi prompt.
- `ai_json` giữ nguyên kết quả gốc của AI, không sửa. Chỗ bạn sửa nằm ở `final_transcript` và `mistake_hits`.
- Không lưu audio trên server.

## 7. API và xử lý lỗi

| Endpoint | Việc | Mức |
| --- | --- | --- |
| `POST /api/auth/login` | Đăng nhập, đặt cookie phiên | Alpha |
| `POST /api/auth/logout` | Xóa phiên | Alpha |
| `GET /api/topics` | Lấy đề theo loại | Alpha |
| `POST /api/attempts/speaking` | Nộp audio, nhận bản chép lời và lỗi đề xuất | Alpha |
| `POST /api/attempts/writing` | Nộp bài viết, nhận lỗi đề xuất | Alpha |
| `POST /api/attempts/:id/confirm` | Lưu bản chép lời cuối và lỗi đã duyệt | Alpha |
| `GET /api/attempts` | Lịch sử, lọc theo loại và ngày | Alpha |
| `GET /api/mistakes` | Sổ lỗi | Alpha |
| `PATCH /api/mistakes/:id` | Sửa nhãn, gộp, đặt lỗi trọng tâm | Alpha |
| `GET /api/export` | Xuất JSON và CSV | Alpha |
| `POST /api/import` | Nhập lại từ file xuất | Alpha |
| `GET /api/stats` | KPI theo tuần | P1 |
| `GET /api/cards/due`, `POST /api/cards/:id/review` | Ôn thẻ | P1 |

**Xử lý lỗi:**

| Tình huống | Cách xử lý |
| --- | --- |
| File quá 3 MB | Từ chối ngay ở frontend, server kiểm tra lại, báo nói ngắn hơn |
| MIME không nằm trong danh sách | Trả lỗi rõ ràng, ghi log `mimeType` để bổ sung |
| JSON sai schema | Thử lại đúng 1 lần, vẫn sai thì đặt `failed` và giữ bản nháp |
| `original_quote` không khớp văn bản | Giữ lỗi nhưng không tô, đánh dấu "cần xem lại" và bỏ tick mặc định |
| Gemini trả 429 hết quota | Không thử lại liên tục. Báo rõ, giữ bản nháp, hiện nút "Copy prompt" |
| Lỗi mạng hoặc timeout | Giữ trong hàng chờ IndexedDB, gửi lại cùng `client_attempt_id` |
| Gửi trùng | Server trả lại kết quả cũ theo `client_attempt_id`, không gọi Gemini lần hai |

Chống gửi trùng chỉ cần cho 2 endpoint nộp bài và endpoint xác nhận, vì đó là nơi tốn quota hoặc có thể đếm lỗi hai lần.

## 8. Bảo mật vừa đủ, chi phí, sao lưu

App chỉ có một người dùng là bạn, nên bảo mật làm vừa đủ, không để nó ăn hết giờ code.

**Bắt buộc:**

- `GEMINI_API_KEY` và thông tin Turso **chỉ nằm trong biến môi trường server**, không bao giờ đặt trong `NUXT_PUBLIC_*` hay import vào code Vue. Dùng key từ tài khoản Google cá nhân, không dùng tài khoản công ty.
- Mật khẩu hash bằng `scrypt` có sẵn trong `node:crypto`, không cần thêm thư viện.
- Cookie phiên `httpOnly`, `Secure`, `SameSite=Strict`. Vì frontend và API cùng domain nên `SameSite=Strict` đã chặn được CSRF cho app cá nhân, không cần thêm token CSRF riêng.
- Giới hạn đăng nhập sai và số lượt gọi Gemini mỗi ngày bằng bảng `rate_counters` trong Turso. Không đếm trong RAM vì serverless function không giữ bộ nhớ giữa các lần gọi.
- Mỗi endpoint kiểm tra phiên và validate đầu vào bằng Zod. Chỉ hiển thị text của Gemini, không render HTML thô.
- Không đưa code, tài liệu hay dữ liệu công ty vào bài nói hoặc bài viết. Gói miễn phí của Gemini có thể dùng nội dung gửi lên để cải thiện sản phẩm (cần kiểm tra trên trang Pricing khi triển khai).

**Chi phí mục tiêu 0 đồng:**

| Dịch vụ | Gói | Cần kiểm tra khi deploy |
| --- | --- | --- |
| Vercel | Hobby | Giới hạn body 4,5 MB, thời gian chạy function |
| Turso | Free | Hạn mức dung lượng và lượt đọc ghi hiện hành |
| Gemini API | Free tier qua AI Studio | Tên model thực tế có hỗ trợ audio và structured output, số lượt mỗi phút và mỗi ngày |

Không bật thanh toán. Nếu sau này cần thì đặt cảnh báo ngân sách trước.

**Sao lưu:** xuất JSON mỗi Chủ nhật (app nhắc). Trước khi tin vào bản sao lưu, thử ít nhất một lần: xuất, xóa database test, nhập lại, đối chiếu số bản ghi. File xuất có `schema_version`. Vercel giới hạn body 4,5 MB: khi dữ liệu lớn hơn 4 MB, app báo lỗi rõ ràng và dùng `npm run db:backup` / `npm run db:restore` chạy trên máy.

## 9. Lộ trình build và ước lượng giờ

**Ràng buộc cứng:** đồ án xong phần chính mới bắt đầu. Chỉ code cuối tuần, tối đa 2 buổi mỗi tháng, 3–4 giờ mỗi buổi, và chỉ khi tuần đó đã học tiếng Anh ít nhất 5 ngày. Trễ lịch thì dời mốc hoặc cắt phạm vi, không bù bằng cách bỏ học.

**Mốc A: Alpha trước 30/3/2027.** Lịch tránh tuần Tết (Tết Đinh Mùi rơi vào 6/2/2027).

| Buổi | Ngày dự kiến | Kết quả kiểm tra được | Nếu thiếu thời gian |
| --- | --- | --- | --- |
| 0 (bắt buộc) | Cuối 12/2026, sau đồ án | Script Node gọi Gemini với 8–10 clip, ghi kết quả theo bảng ngưỡng mục 4 | Chọn phương án dự phòng phù hợp |
| 1 | 9–10/1/2027 | Nuxt, Drizzle, Turso, đăng nhập, deploy bản trống chạy được trên điện thoại | Chưa làm PWA |
| 2 | 23–24/1/2027 | Luyện viết: nộp bài, nhận JSON, lưu lượt nộp | Chưa tô lỗi trong bài |
| 3 | 20–21/2/2027 | Luyện nói: ghi âm, upload, nhận bản chép lời và lỗi | Chưa đo khoảng ngừng |
| 4 | 27–28/2/2027 | Bước xác nhận (mặc định chấp nhận), sổ lỗi, chống ghi trùng | Gộp lỗi bằng tay |
| 5 | 13–14/3/2027 | Màn hình Hôm nay, xuất và nhập dữ liệu, bắt đầu dùng thật | Ôn bằng Anki thủ công |
| 6 | 27–28/3/2027 | Test trên thiết bị có sẵn, xử lý 429, 413, gửi trùng, sửa UX | Hoãn tiện ích phụ |

Nếu phần lõi vượt thời gian: phát hành Luyện viết, Luyện nói và bước xác nhận trước 30/3, hoàn thiện sổ lỗi và xuất dữ liệu trong tháng 4.

**Mốc B: tháng 4–6/2027.** Dùng thật 2 tuần rồi mới quyết định làm tiếp. Thứ tự ưu tiên: (1) thẻ ôn với `ts-fsrs`, (2) tiến độ tuần, (3) PWA offline, (4) nói lại và so sánh. Hội thoại thời gian thực chỉ làm khi vòng lặp cơ bản đã dùng ổn.

**Ước lượng thật lòng:**

- Alpha lõi: 18–24 giờ là mục tiêu khi có AI hỗ trợ code. Thực tế có thể lên 30–45 giờ nếu gặp lỗi audio, trình duyệt hoặc deploy.
- Phần mở rộng ở Mốc B: thêm khoảng 15–30 giờ.
- Các con số này không phải lý do để cắt giờ học. Trễ thì dời lịch.

## 10. Kiểm thử và cổng phát hành Alpha

**Cổng phát hành, phải đạt đủ:**

- [ ] Đăng nhập và đăng xuất hoạt động, endpoint được bảo vệ, key không lọt ra phía trình duyệt.
- [ ] Nộp bài viết nhận gợi ý lỗi mà AI không viết lại cả bài.
- [ ] Ghi và nộp bài nói 1–2 phút, xem bản chép lời trên trình duyệt đã test.
- [ ] Sửa được bản chép lời, bỏ tick hoặc sửa lỗi. Lỗi đã bỏ tick không vào sổ.
- [ ] Gửi lại request không tạo lượt nộp hoặc `mistake_hits` trùng.
- [ ] Với 20 clip test, đạt ngưỡng ở mục 4 hoặc đã test xong phương án dự phòng.
- [ ] Mất mạng, lỗi 429, lỗi 413 đều không làm mất bản nháp.
- [ ] Xuất rồi nhập lại đúng số bản ghi, tiếng Việt không lỗi font.

**Sau phát hành:** dùng thật 14 ngày, ít nhất 10 ngày có luyện. Điều kiện này chỉ đo được sau 30/3.

**Bộ test hồi quy nhỏ:**

| Nhóm | Kịch bản |
| --- | --- |
| AI | Chép lời tự sửa ngữ pháp, mất từ đệm, JSON sai schema, lỗi bịa, đoạn trích không khớp |
| Audio | Mic bị từ chối, không có tiếng, định dạng lạ, file quá 3 MB, mất mạng lúc gửi |
| Dữ liệu | Nộp trùng, tải lại trang khi đang xử lý, xác nhận hai lần, hai phiên bản bài viết |
| Bảo mật | Cookie hết hạn, đăng nhập sai liên tục, gọi API không có phiên |
| Giao diện | Màn hình điện thoại nhỏ, đóng mở lại app, mạng yếu |

Bạn chưa viết unit test bao giờ thì Alpha chỉ cần test tay theo bảng này, ghi kết quả vào một file checklist. Viết test tự động bằng Vitest cho hàm kiểm tra `original_quote` và hàm tính KPI là đủ để bắt đầu.

**Chỉ số học tập, không phải chỉ số app:** số ngày luyện mỗi tuần, tỉ lệ tái phạm của lỗi trọng tâm tuần, và mỗi tháng một bài nói cùng một bài viết đối chứng tự chấm 1–5.

## 11. Rủi ro và điều kiện dừng

| Rủi ro | Mức | Biện pháp và điều kiện dừng |
| --- | --- | --- |
| Code lấn giờ học và đồ án | Rất cao | Tuần học dưới 5 ngày thì hoãn buổi code. Đồ án chưa xong thì chưa bắt đầu |
| Gemini chép lời rồi tự sửa câu | Cao | Buổi 0, bước sửa bản chép lời, tách chép lời và chấm nếu cần |
| AI bịa lỗi | Cao | Kiểm tra đoạn trích, chỉ lưu sau khi duyệt, không tự tạo thẻ ôn |
| Mặc định chấp nhận khiến duyệt qua loa | Trung bình | Lỗi có đoạn trích không khớp thì bỏ tick sẵn. Cuối tuần xem lại sổ lỗi 5 phút |
| Ghi âm lỗi trên Safari hoặc Android | Trung bình đến cao | Dò định dạng bằng `isTypeSupported()`, test máy thật, lỗi thì làm phần viết trước |
| Free tier đổi hoặc hết quota | Trung bình | Model đặt qua biến môi trường, nút "Copy prompt" dự phòng |
| Mất audio trong IndexedDB | Trung bình | Báo rõ audio chỉ lưu trên máy, text được sao lưu hằng tuần |
| Phình phạm vi | Cao | Đóng băng P0, ý tưởng mới ghi vào danh sách P1 và P2, chỉ mở rộng sau 2 tuần dùng thật |

**Dừng phát triển tính năng mới nếu:** tool không tiết kiệm thời gian so với làm tay, hoặc AI sai thường xuyên đến mức bạn mất nhiều thời gian duyệt hơn luyện. Khi đó quay về cách cũ: ghi âm bằng điện thoại, dán vào AI chat, ghi lỗi vào tab Sổ lỗi sai trong Sheet theo dõi.

## Nguồn và điểm cần kiểm tra khi triển khai

**Đã xác minh:** Gemini API nhận audio WebM và Opus (nhật ký thay đổi tài liệu 28/8/2026). Vercel Hobby giới hạn body 4,5 MB.

**Cần kiểm tra khi triển khai:**

- Tên model Gemini cụ thể và hạn mức thực tế trong AI Studio tại thời điểm làm Buổi 0.
- Chính sách sử dụng dữ liệu của free tier trên trang Pricing.
- Phiên bản `ts-fsrs` mới nhất và yêu cầu phiên bản Node (có thông tin bản 6 cần Node 24 trở lên, chưa xác minh). Chỉ cần kiểm tra khi vào P1.
- Hạn mức free của Turso tại ngày deploy.

**Tài liệu:**

- [Gemini API: Audio understanding](https://ai.google.dev/gemini-api/docs/audio)
- [Gemini API: Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API: Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API: Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API: Changelog](https://ai.google.dev/gemini-api/docs/changelog)
- [Vercel Functions: Limits](https://vercel.com/docs/functions/limitations)
- [Turso: Pricing](https://turso.tech/pricing)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- [MDN: MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)

**Quyết định chốt:** làm một Alpha nhỏ, đáng tin và dùng thật trước 30/3/2027. Tool phục vụ việc học tiếng Anh, không thay thế nó.
