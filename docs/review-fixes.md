# Review code, hướng sửa và lộ trình tính năng

Ngày review: 18/11/2026 · Commit: `8ebf4be` · Phạm vi: toàn bộ `server/`, `shared/`, các luồng chính ở `app/`.

File có hai phần:
- **Phần A (F1–F8, C1–C12, T1):** lỗi và chỗ chưa sạch trong code hiện tại, kèm hướng sửa.
- **Phần B (B1–B7, N1–N11):** phạm vi tính năng đã chốt ngày 18/11/2026, kèm hướng làm từng tính năng và kế hoạch làm mới giao diện (B7).

**Quy ước:** mọi thay đổi, quyết định và đề xuất mới đều ghi vào file này, không tách file riêng. `plan.md` chưa được cập nhật theo phần B. Khi hai file lệch nhau thì theo file này.

## Trạng thái (cập nhật 18/11/2026)

**Phần A đã sửa xong**, trừ hai việc còn mở ở cuối mục này. `npm run typecheck`, `npm test` (25 test) và `npm run build` đều chạy qua.

| Mục | Đã làm |
| --- | --- |
| F1 | Timeout 25 giây cho mỗi lần gọi Gemini (`GEMINI_TIMEOUT_MS`, `abortSignal`), hết giờ trả `AI_TIMEOUT` và không gọi lại. Thêm cột `processing_at` (migration `0001`). Row `processing` dưới 2 phút trả 409 `IN_PROGRESS`, quá 2 phút thì chấm lại. Lệnh nhận lại row là `UPDATE` có điều kiện để hai request không cùng chấm. Client chỉ đánh dấu `sent` hoặc xoá nháp khi bài đã `needs_review`/`confirmed`. `toApiFailure`: 502/504 không có code thì gán `AI_TIMEOUT`, `status = 0` khi đang có mạng thì báo "Server không phản hồi". Trang review coi `processing` quá 2 phút như `failed` |
| F2 | `importAll` ánh xạ id (attempt theo `client_attempt_id`, mistake theo `pattern_key`), trỏ lại hit, gọi `recomputeMistake`, giữ lỗi trọng tâm đang có, trả thêm `skipped`. Menu nhập hiện số dòng bỏ qua |
| F3 | Export JSON lớn hơn 4 MB trả 413 `TOO_LARGE`, import chặn file lớn hơn 4 MB ở cả client lẫn server. Thêm `npm run db:backup` và `npm run db:restore`. Màn hình Hôm nay ghi dung lượng ước tính khi nhắc sao lưu, và nhắc dùng script khi vượt 80% giới hạn. Đã cập nhật `plan.md`, `README.md`, `ARCHITECTURE.md` |
| F4 | Sửa chữ sau một lần nộp lỗi thì tạo `clientAttemptId` mới, trừ lỗi `IN_PROGRESS` (giữ id để lần gửi lại nhận đúng kết quả đang chấm) |
| F5 | Insert vi phạm unique thì trả 409 `IN_PROGRESS` |
| F6 | Cửa sổ ngày tính theo giờ VN (`APP_UTC_OFFSET_MIN`). Hạn mức được đếm trước mỗi lần gọi qua `gradeWithGemini(…, { beforeCall })` |
| F7 + C3 | `topicText` chuyển sang `server/services/topicService.ts`, đề không tồn tại trả 400 không kèm code |
| F8 | `escapeHtml` cho cả 3 trường của Anki |
| C1 | `topicToText()` trong `shared/utils/prompts.ts`, dùng ở 4 nơi |
| C2 | `geminiDailyLimit()` và `geminiUsedToday()` trong `quota.ts` |
| C4 | `mergeMistake`, `splitMistake`, `updateMistake`. Route `PATCH` chọn hàm theo trường trong body, API client giữ nguyên. Lúc tách chỉ chuyển những hit thuộc đúng lỗi nguồn |
| C5 | Import `toPatternKey` thẳng từ `shared`, bỏ re-export |
| C6 | Logic của `today` và `attempts/[id]` chuyển vào `todayService.getTodaySummary` và `attemptService.getAttemptDetail`. CLAUDE.md ghi rõ route chỉ đọc một bảng thì được truy vấn thẳng |
| C7 | `validationError()` trong `http.ts`, dùng ở 3 nơi |
| C8 | Gộp import `h3`. CLAUDE.md ghi quy tắc: route dùng auto-import, service và utils import tường minh |
| C9 | Bỏ `'draft'` khỏi schema, kiểu và nhãn. Bảng dữ liệu trong `plan.md` đã sửa |
| C10 | Bỏ comment `eslint-disable` |
| C11 | `MANUAL_FORMAT_SPEAKING` / `MANUAL_FORMAT_WRITING`. Đã kiểm tra chuỗi prompt thủ công y hệt bản cũ, không tăng `PROMPT_VERSION` |
| C12 | Tách `<ReviewForm>` (`app/components/review/ReviewForm.vue`) dùng `:key`, trang review từ 295 dòng còn 169 dòng |
| Mục nhỏ | `IssueEditor` nhận prop `issue` và có comment "sửa trực tiếp object của form". Bỏ `and()` thừa trong `today` |
| T1 | `vitest.config.ts`, `tests/helpers/db.ts` (file SQLite tạm, migrate, xoá dữ liệu giữa các test, `fakeGrade`). Test cho `submitAttempt` (gửi trùng, `failed`, `processing` mới và cũ, song song), `confirmAttempt`, gộp/tách/đổi key/trọng tâm, `importAll` (DB trống, gộp có `pattern_key` trùng, nhập hai lần), Anki escape, ước tính dung lượng |

**Phát hiện thêm khi kiểm tra lại (đã xử lý):**
- `npm test` lỗi ngay từ đầu (`Cannot read properties of undefined (reading 'config')`) khi thư mục mở bằng ổ đĩa chữ thường (`d:\`, cách VS Code mở). Vitest nạp hai bản của chính nó. `vitest.config.ts` đã ghim `vitest` về một bản.
- Script sao lưu kéo theo `backupService.ts` và `mistakeService.ts`, nên hai file này import `shared/` bằng đường dẫn tương đối. `tsconfig.tools.json` thêm `paths` cho `#shared` (chỉ dùng cho import kiểu).

## Trạng thái phần B (cập nhật 18/11/2026)

**B7 (giai đoạn 1a) đã làm xong:**
- Cài `@nuxt/ui` 4.12.2 (kèm Tailwind 4.3, `@nuxt/icon`, `@nuxt/fonts`, color mode) và `@iconify-json/lucide`. Icon được đóng gói vào bundle (80 icon, khoảng 22 KB), `fallbackToApi: false` nên không gọi Iconify lúc chạy. `/api/_nuxt_icon` được miễn auth.
- Font Inter tải lúc build và phục vụ từ app, có subset `vietnamese`.
- Theme: `app/app.config.ts` (primary teal, neutral slate), `main.css` chỉ còn Tailwind, Nuxt UI, style của `mark` và `.prewrap`. Màu chính ở chế độ sáng là teal-700 (`#0f766e`, giữ màu cũ) để chữ trắng đủ tương phản; màu success/error/warning ở chế độ sáng cũng đậm hơn mặc định. Tôn trọng `prefers-reduced-motion`.
- Bỏ `useToast`/`Toast.vue` tự viết, thay bằng `useNotify()` dựng trên `useToast` của Nuxt UI. Thêm `useConfirm()` + `BaseConfirmDialog` (mở bằng `useOverlay`). Không còn `alert()`, `confirm()`, `prompt()`: tách lỗi dùng modal, kết quả nhập dùng modal có bảng Trước / Sau / Trong file / Bỏ qua.
- Không còn emoji hay ký tự làm icon trong `app/` (đã quét bằng script). Thêm `BaseCorrectionPair` (icon `i-lucide-arrow-right`, có nhãn "Sai"/"Đúng" cho trình đọc màn hình).
- Bố cục: thanh dưới 4 mục trên điện thoại, thanh bên trái (`UNavigationMenu`, có thêm Lịch sử) từ 1024px, header gọn với menu `UDropdownMenu` (Lịch sử, xuất/nhập, giao diện Theo máy/Sáng/Tối, xoá audio, đăng xuất). `LayoutPage` làm khung cho mọi trang.
- Làm lại mọi màn hình: Đăng nhập, Hôm nay (thẻ đề lớn, skeleton khi tải, nút "Sao lưu ngay" ngay trong thông báo), Luyện nói (nút ghi âm tròn, vòng tiến độ, thanh mức âm), Luyện viết (ô viết cao, thanh đếm từ và nút Nộp dính đáy), Duyệt bài (điện thoại có tab Bài/Lỗi, máy tính chia 2 cột, công tắc giữ/bỏ, sửa lỗi trong slideover, lỗi đáng ngờ viền vàng, nút Lưu dính đáy), Sổ lỗi (tìm kiếm, chip lọc nhóm lỗi, chi tiết trong slideover, gộp và tách trong modal), Lịch sử (dòng thời gian theo ngày, badge trạng thái có màu).
- Xuất file đi qua `useBackup()` (fetch rồi tải blob), nên lỗi 413 hiện thành toast thay vì mở trang JSON lỗi.
- Đã kiểm tra bằng ảnh chụp 390px và 1280px, sáng và tối, cho mọi màn hình cùng menu, slideover chi tiết lỗi và slideover sửa lỗi. Không có lỗi JS, request hỏng hay icon thiếu. `typecheck`, `npm test`, `build` đều qua. Tổng dung lượng build gần như không đổi (5,85 MB lên 5,88 MB).
- Tạo skill dự án `.claude/skills/ui-ux/SKILL.md`.

**Khác với kế hoạch B7:** chưa dựng mockup để chọn phong cách, mà dùng luôn đề xuất mặc định (tối giản, teal, Inter, Lucide). Muốn đổi thì sửa `app.config.ts` và `main.css`. Thanh dưới giữ 4 mục hiện có; bố cục 5 mục (Hôm nay · Luyện · Ôn · Sổ lỗi · Tiến bộ) sẽ áp dụng khi có N5 và N7. Chưa thử trên điện thoại thật và Safari iOS.

**Phần B còn lại chưa làm:** B4, N1–N11.

**Còn mở:**
- **F1, `maxDuration`:** chưa đổi, vẫn 60 giây. Theo hiểu biết hiện tại, Vercel Hobby có Fluid compute cho phép tới 300 giây. Cần kiểm tra trang Vercel Functions Limits rồi mới tăng, vì đặt quá giới hạn của gói thì deploy lỗi.
- **Migration trên Turso:** đã chạy `db:migrate` cho DB dev. Trước khi deploy cần chạy `npm run db:migrate` với `DATABASE_URL` của Turso (thêm cột `processing_at`).

# Phần A. Review code

Chưa chạy `npm test` và `npm run typecheck` lúc review (máy chưa cài `node_modules`). Số dòng trong link là theo commit trên, sửa xong thì có thể lệch.

## Tóm tắt

Code nhìn chung sạch. Phần lớn các mục dưới đây là chỗ thiếu nhất quán hoặc lặp nhỏ. Chỉ có **F1** là bug thật có thể làm mất bài, nên sửa trước.

| # | Vấn đề | Loại | Mức | Công sức |
| --- | --- | --- | --- | --- |
| F1 | Bài kẹt ở `processing` mãi, gửi lại bị coi là thành công | Bug | **Cao** | 1–2 giờ |
| F2 | Import không tính lại `hit_count`, lỗi khi gộp vào DB đã có dữ liệu | Dữ liệu | Trung bình | 1 giờ |
| F3 | Xuất và nhập JSON qua API sẽ vượt giới hạn 4,5 MB của Vercel | Dữ liệu | Trung bình (sau vài tháng) | 1 giờ |
| F4 | Sửa bài rồi gửi lại cùng `clientAttemptId` thì nhận kết quả cũ | Bug nhỏ | Thấp | 20 phút |
| F5 | Hai request cùng `clientAttemptId` chạy song song gây lỗi 500 | Bug nhỏ | Thấp | 15 phút |
| F6 | Hạn mức Gemini reset lúc 7h sáng giờ VN, lần thử lại không bị đếm | Hành vi | Thấp | 20 phút |
| F7 | Đề không tồn tại trả mã `AI_ERROR` | Hành vi | Thấp | 10 phút |
| F8 | Xuất Anki không escape HTML | Hành vi | Thấp | 10 phút |
| C1–C12 | Lặp code, đặt sai chỗ, không nhất quán | Code sạch | Thấp | ~2 giờ tổng |
| T1 | Chưa có test cho service | Test | Trung bình | 2–3 giờ |

**Thứ tự đề xuất:** F1 → T1 (viết test cho F1 luôn) → F2 + F3 → C1, C3 → phần còn lại khi rảnh.

---

## F1. Bài kẹt ở `processing` mãi mãi

**Vấn đề**

1. Function trên Vercel bị giới hạn 60 giây ([nuxt.config.ts:23](../nuxt.config.ts#L23)). Lời gọi Gemini không có timeout ([geminiService.ts:31](../server/services/geminiService.ts#L31)). Bài nói 2 phút cộng một lần gọi lại vì JSON sai có thể vượt 60 giây. Vercel dừng function giữa chừng, và row nằm lại ở trạng thái `processing`.
2. Gửi lại: [attemptService.ts:60](../server/services/attemptService.ts#L60) chỉ chấm lại row `failed`, còn row `processing` thì trả về nguyên trạng.
3. Client coi đó là thành công:
   - Bài nói ([useSpeakingSubmit.ts:25](../app/composables/useSpeakingSubmit.ts#L25)): audio bị đánh dấu `sent` và rời hàng đợi "Chưa gửi".
   - Bài viết ([writing.vue:74](../app/pages/writing.vue#L74)): bản nháp bị xoá.
   - Trang review hiện "Bài đang được chấm" mãi, không có nút gửi lại hay Copy prompt.
4. Lần lỗi đầu tiên cũng không có Copy prompt: Vercel trả 504 không kèm `data.code`. Nếu `$fetch` tự timeout ở 90 giây thì `status = 0`, và [http.ts:20](../app/api/http.ts#L20) báo nhầm là "Mất mạng".

**Hướng giải quyết**

1. **Timeout cho Gemini.**
   - Mỗi lần gọi tối đa khoảng 25 giây, để hai lần cộng lại cùng thời gian đọc file audio vẫn dưới 60 giây.
   - `@google/genai` hỗ trợ `config.abortSignal` (dùng `AbortSignal.timeout(25_000)`) hoặc `config.httpOptions.timeout`; kiểm tra lại tên trường ở bản 3.4.
   - Hết giờ thì **không gọi lại**, ném luôn `apiError(504, 'AI_TIMEOUT', ...)`. Chỉ gọi lại khi lần đầu trả JSON sai cấu trúc (giữ nguyên quy tắc hiện tại).
   - Kiểm tra giới hạn `maxDuration` tối đa hiện tại của gói Vercel Hobby. Nếu được phép cao hơn 60 giây thì tăng lên để giảm rủi ro, nhưng vẫn giữ timeout ở trên.
2. **Coi row `processing` cũ là hỏng.**
   - Thêm cột `processing_at` (integer) vào `attempts`. Ghi cột này mỗi khi chuyển sang `processing`, cả lúc tạo mới lẫn lúc chấm lại.
   - Trong `submitAttempt`: nếu `existing.status === 'processing'` và `Date.now() - processing_at > PROCESSING_STALE_MS` (2 phút) thì chấm lại như row `failed`. Nếu chưa quá 2 phút thì ném `apiError(409, 'IN_PROGRESS', 'Bài đang được chấm, thử lại sau ít phút')`.
   - Chạy `npm run db:generate` rồi `npm run db:migrate`.
3. **Client chỉ coi bài đã chấm xong là thành công.** Trong `useSpeakingSubmit` và `writing.vue`, chỉ đánh dấu `sent` hoặc xoá nháp khi `attempt.status` là `needs_review` hoặc `confirmed` (bài đã duyệt từ trước, ví dụ gửi lại một bản ghi cũ). Trạng thái khác thì giữ nguyên bản ghi hoặc nháp và báo lỗi.
4. **Hiển thị lỗi timeout đúng.**
   - Trong `toApiFailure`: status 502 hoặc 504 không có code thì gán `AI_TIMEOUT`. `status = 0` mà `navigator.onLine === true` thì báo "Server không phản hồi", không báo mất mạng.
   - Thêm `AI_TIMEOUT` vào `ApiErrorCode` và `shouldOfferManualPrompt`.
5. **Trang review:** khi `processing` đã quá 2 phút, hiện hướng dẫn gửi lại và Copy prompt giống trường hợp `failed`.

**Cách kiểm tra:** viết test cho `submitAttempt` với một row `processing` cũ (xem T1). Kiểm tra tay bằng cách cho `grade()` chờ 70 giây ở môi trường dev.

---

## F2. Import không tính lại số liệu và lỗi khi gộp dữ liệu

**Vấn đề:** [backupService.ts:98](../server/services/backupService.ts#L98)

- Sau import không gọi `recomputeMistake`, nên `hit_count`, `first_seen`, `last_seen` có thể sai. CLAUDE.md có quy tắc luôn tính lại từ hits.
- DB đã có mistake cùng `pattern_key` nhưng khác `id`:
  - `onConflictDoNothing` bỏ qua mistake trong file.
  - Hits của nó trỏ tới một id không tồn tại.
  - Tuỳ foreign key có được bật hay không (kiểm tra bằng `PRAGMA foreign_keys`), kết quả là hit mồ côi hoặc cả transaction thất bại.
- Attempt trùng `client_attempt_id` nhưng khác `id` cũng gặp tình trạng tương tự.
- File và DB mỗi bên có một lỗi trọng tâm khác nhau thì sau import có hai lỗi `is_focus`, trái với quy tắc "chỉ một lỗi trọng tâm".
- Khôi phục vào DB trống thì không bị ảnh hưởng.

**Hướng giải quyết**

1. **Trong transaction, tạo bảng ánh xạ id** trước khi insert:
   - `mistakes`: với mỗi row trong file, nếu DB đã có `pattern_key` đó thì ánh xạ `fileId → existingId` và không insert.
   - `attempts`: làm tương tự theo `client_attempt_id`.
   - `mistake_hits`: thay `mistakeId` và `attemptId` theo bảng ánh xạ rồi mới insert. Unique `(attempt_id, issue_index)` vẫn chặn hit trùng.
2. **Sau khi insert,** gọi `recomputeMistake(tx, id)` cho mọi mistake được thêm hit.
3. **Nếu DB đã có lỗi trọng tâm** thì giữ lỗi đó, đặt `is_focus = false` cho các lỗi trọng tâm đến từ file.
4. **Trả thêm số row bị bỏ qua** do trùng, để màn hình báo kết quả rõ ràng.

**Cách kiểm tra:**
1. Tạo DB có dữ liệu, xuất ra file A.
2. Thêm vài bài và lỗi mới, trong đó có lỗi cùng `pattern_key` với dữ liệu cũ.
3. Nhập A vào DB thứ hai đã có dữ liệu khác.
4. Kiểm tra `hit_count` bằng đúng số hits, và `PRAGMA foreign_key_check` không trả về dòng nào.

---

## F3. Xuất và nhập JSON qua API sẽ vượt giới hạn 4,5 MB

**Vấn đề:**
- File JSON chứa `ai_json` của mọi lượt nộp. Ước lượng thô: vài trăm lượt (khoảng nửa năm đến một năm nếu luyện 2 bài/ngày) là vượt 4,5 MB.
- Vercel giới hạn 4,5 MB cho **cả body request lẫn body response** của function. Kiểm tra lại trên trang Vercel Functions Limits lúc sửa.
- Khi vượt:
  - `POST /api/import` không chạy được nữa.
  - `GET /api/export?format=json` cũng lỗi, nghĩa là **không tải được bản sao lưu**, đúng lúc dữ liệu có giá trị nhất.

**Hướng giải quyết**

1. **Thêm hai script chạy local**, đọc và ghi thẳng `DATABASE_URL` (Turso), không đi qua Vercel:
   - `scripts/backup.ts` (`npm run db:backup`): ghi file JSON cùng định dạng với `exportAll`.
   - `scripts/restore.ts <file.json>` (`npm run db:restore -- file.json`): dùng chung logic import với F2.
   - Lưu ý: script không dùng được alias `#shared`. Cần cho `backupService.ts` import `shared/` bằng đường dẫn tương đối, hoặc tách phần xuất/nhập ra một module chỉ dùng import tương đối, đúng quy tắc trong CLAUDE.md.
2. **Trong app:**
   - Export: nếu chuỗi JSON lớn hơn 4 MB thì trả `apiError(413, 'TOO_LARGE', 'Dữ liệu lớn, dùng npm run db:backup')` thay vì để Vercel cắt ngang.
   - Import: file lớn hơn 4 MB thì báo dùng `npm run db:restore`, không gửi lên.
   - Màn hình Hôm nay nhắc sao lưu thì ghi kèm dung lượng ước tính, để biết khi nào phải chuyển sang script.
3. **Cập nhật mục Sao lưu** trong `plan.md` và `README.md`.

---

## F4. Sửa bài rồi gửi lại thì nhận kết quả cũ

**Vấn đề:** client bị timeout nhưng server thực ra đã chấm xong (`needs_review`). Bạn sửa text rồi bấm nộp lại với cùng `clientAttemptId`. Server trả về bài cũ, phần sửa bị bỏ qua mà không có thông báo.

**Hướng giải quyết (chọn cách đơn giản):** trong [writing.vue](../app/pages/writing.vue), khi text thay đổi sau một lần nộp lỗi thì tạo `clientAttemptId` mới. Nếu lần trước thực ra đã thành công, bài đó vẫn hiện ở mục "Chờ bạn duyệt" trên màn hình Hôm nay, không mất.

---

## F5. Hai request cùng `clientAttemptId` chạy song song gây lỗi 500

**Vấn đề:** cả hai request đều không tìm thấy row nên cùng insert. Request thứ hai vi phạm unique và trả 500. Hiếm xảy ra vì nút nộp đã bị khoá khi đang gửi.

**Hướng giải quyết:** bọc lệnh insert trong `try/catch`. Nếu lỗi là unique constraint thì đọc lại row theo `clientAttemptId` và đi tiếp theo nhánh "đã tồn tại", với F1 thì sẽ trả 409 `IN_PROGRESS`.

---

## F6. Hạn mức Gemini tính theo ngày UTC

**Vấn đề:**
- [rateLimit.ts:7](../server/utils/rateLimit.ts#L7) chia ngày theo giờ UTC, nên ở Việt Nam bộ đếm reset lúc 7h sáng. Trong khi đó màn hình Hôm nay đếm bài từ 0h giờ địa phương.
- Lần gọi lại vì JSON sai tốn thêm một lượt Gemini thật nhưng không được đếm.

**Hướng giải quyết:**
1. Thêm hằng `APP_UTC_OFFSET_MIN = 420` vào `shared/constants/app.ts`. Với cửa sổ theo ngày, tính `windowStart = floor((now + offset) / DAY) * DAY - offset`. Cửa sổ 15 phút của đăng nhập không cần đổi.
2. Đếm hạn mức trước **mỗi** lần gọi Gemini: chuyển `consumeGeminiQuota()` vào ngay trước `callOnce`, hoặc truyền callback vào. Nếu lần thử lại bị chặn vì hết hạn mức thì trả `DAILY_LIMIT`.

---

## F7. Đề không tồn tại trả mã `AI_ERROR`

**Vấn đề:** [quota.ts:21](../server/utils/quota.ts#L21). Client thấy mã `AI_ERROR` nên hiện Copy prompt, trong khi lỗi không liên quan đến AI. `GEMINI_API_KEY` chưa cấu hình cũng dùng mã `AI_ERROR`.

**Hướng giải quyết:** trả `createError({ statusCode: 400 })` không kèm code, hoặc thêm mã `BAD_TOPIC`. Gộp sửa cùng C3.

---

## F8. Xuất Anki không escape HTML

**Vấn đề:** [backupService.ts:79](../server/services/backupService.ts#L79) bật `#html:true` nhưng chèn `exampleWrong` và `labelVi` nguyên văn. Câu chứa `<` hoặc `&` sẽ hiển thị sai trong Anki.

**Hướng giải quyết:** thêm hàm `escapeHtml` (thay `& < > "`) và áp dụng cho cả 3 trường có chứa HTML (`exampleWrong`, `labelVi`, `exampleRight`) trước khi đưa vào `csvCell`.

---

## Code sạch

| # | Vấn đề | Vị trí | Hướng giải quyết |
| --- | --- | --- | --- |
| C1 | Chuỗi mô tả đề `` `${title}. ${prompt}` `` lặp 4 nơi. Đây là nội dung đi vào prompt, sửa lệch thì prompt chấm và prompt Copy sẽ khác nhau | [quota.ts:22](../server/utils/quota.ts#L22), [review/[id].vue:38](../app/pages/review/[id].vue#L38), [speaking.vue:70](../app/pages/speaking.vue#L70), [writing.vue:93](../app/pages/writing.vue#L93) | Thêm `topicToText(topic \| null)` vào `shared/utils/prompts.ts`, cả 4 nơi gọi hàm này |
| C2 | `Number(process.env.GEMINI_DAILY_LIMIT \|\| 40)` lặp 2 nơi | [quota.ts:8](../server/utils/quota.ts#L8), [today.get.ts:48](../server/api/today.get.ts#L48) | Thêm `geminiDailyLimit()` trong `quota.ts` |
| C3 | `topicText` nằm trong `quota.ts`, không liên quan đến hạn mức | [quota.ts:18](../server/utils/quota.ts#L18) | Chuyển sang `server/services/topicService.ts`, gộp sửa cùng F7 |
| C4 | `patchMistake` gánh 3 việc (gộp, tách, sửa), phân nhánh bằng `return` sớm, và sửa thẳng object `patch` truyền vào | [mistakeService.ts:81](../server/services/mistakeService.ts#L81) | Tách thành `mergeMistake`, `splitMistake`, `updateMistake`. Route chọn hàm theo trường có trong body, hoặc tách thành `POST /api/mistakes/:id/merge` và `.../split` |
| C5 | `toPatternKey` bị re-export qua `mistakeService` rồi `attemptService` import từ đó | [mistakeService.ts:11](../server/services/mistakeService.ts#L11), [attemptService.ts:6](../server/services/attemptService.ts#L6) | Import thẳng từ `#shared/utils/patternKey`, xoá re-export |
| C6 | CLAUDE.md ghi "route mỏng, gọi service" nhưng 5 route truy vấn DB thẳng | [today.get.ts](../server/api/today.get.ts), [attempts/[id].get.ts](../server/api/attempts/[id].get.ts), `topics.get`, `auth/me.get`, `auth/login.post` | Chuyển `today` và `attempts/[id]` (nhiều logic) vào service. Route chỉ đọc một bảng thì giữ nguyên, và sửa CLAUDE.md cho đúng thực tế |
| C7 | Lỗi validate có hai dạng: `parseBody` trả `data: { issues }`, chỗ khác trả `data: issues` | [http.ts:14](../server/utils/http.ts#L14), [speaking.post.ts:37](../server/api/attempts/speaking.post.ts#L37), [backupService.ts:101](../server/services/backupService.ts#L101) | Export `validationError(issues)` từ `http.ts` và dùng ở cả 3 nơi |
| C8 | Lúc import tường minh, lúc dựa vào auto-import của Nitro. `http.ts` import `'h3'` hai dòng | [http.ts:1-2](../server/utils/http.ts#L1-L2), [middleware/auth.ts:1](../server/middleware/auth.ts#L1) | Gộp thành một dòng import. Chốt quy tắc: service và utils import tường minh, route dùng auto-import, rồi ghi vào CLAUDE.md |
| C9 | Trạng thái `'draft'` có trong kiểu nhưng không được dùng | [schema.ts:32](../server/db/schema.ts#L32), [types/index.ts:4](../shared/types/index.ts#L4) | Xoá khỏi cả hai nơi. Enum text của Drizzle trên SQLite không tạo ràng buộc CHECK, nhưng vẫn chạy `db:generate` để chắc không sinh migration. Sửa bảng dữ liệu trong `plan.md` |
| C10 | Comment `eslint-disable` trong khi dự án không cài ESLint | [backupService.ts:113](../server/services/backupService.ts#L113) | Xoá comment. Muốn có lint thì thêm `@nuxt/eslint` (tuỳ chọn) |
| C11 | Bỏ phần `transcript` khỏi prompt thủ công bằng `.replace()` trên chuỗi | [prompts.ts:30](../shared/utils/prompts.ts#L30) | Tách thành hai hằng `MANUAL_FORMAT_SPEAKING` và `MANUAL_FORMAT_WRITING`. Giữ chuỗi kết quả y hệt hiện tại. Chỉ khi đổi nội dung prompt gửi Gemini mới tăng `PROMPT_VERSION` |
| C12 | Trang review tự tạo và hủy `effectScope` để dựng lại form khi dữ liệu đổi | [review/[id].vue:17-32](../app/pages/review/[id].vue#L17-L32) | Tách phần form thành `<ReviewForm :key="attempt.id + attempt.status" :detail :mistakes @saved="refresh">`, gọi `useReviewForm` trong component đó. Vue tự dựng lại khi `key` đổi. Trang review sẽ ngắn khoảng một nửa |

**Mục nhỏ, có thể giữ nguyên:**
- [IssueEditor.vue](../app/components/review/IssueEditor.vue) dùng `defineModel` nhưng sửa thẳng thuộc tính bên trong (`issue.checked`), trong khi cha chỉ truyền `:model-value` một chiều. Vẫn chạy đúng vì object là reactive và thuộc `useReviewForm`. Nếu giữ thì đổi thành prop `issue` và thêm comment nói rõ "sửa trực tiếp object của form", để không ai tưởng nhầm là `v-model` hai chiều.
- [today.get.ts:38](../server/api/today.get.ts#L38) có `and(eq(...))` với một điều kiện, bỏ `and` đi.

---

## T1. Test cho service

**Vấn đề:** test hiện chỉ có cho `quote` và `kpi`. Các quy tắc quan trọng nhất trong CLAUDE.md (gửi lại không trùng, xác nhận hai lần, tính lại số liệu, gộp và tách, import) chưa có test nào.

**Hướng giải quyết**

1. **Thêm `vitest.config.ts`** với alias `#shared → ./shared`, vì service import theo alias này.
2. **Helper `tests/helpers/db.ts`:**
   - Đặt `process.env.DATABASE_URL` **trước** khi import `server/db`, trỏ tới một **file SQLite tạm** trong thư mục tạm của hệ điều hành, mỗi file test một DB riêng.
   - Không dùng DB `:memory:`: theo hiểu biết hiện tại, `@libsql/client` mở kết nối mới sau mỗi `transaction()`, và với DB trong RAM thì kết nối mới là một DB trống. Các service dùng transaction nên sẽ hỏng ngầm. Nếu thử `:memory:` thì kiểm tra kỹ điểm này trước.
   - Chạy migration bằng `migrate(useDb(), { migrationsFolder: 'server/db/migrations' })` từ `drizzle-orm/libsql/migrator`.
   - Reset giữa các test bằng cách xoá dữ liệu các bảng. `useDb()` giữ client trong biến module nên không tạo lại được giữa chừng. Xoá file tạm khi chạy xong.
3. **Test tối thiểu:**
   - `submitAttempt`:
     - gửi lại cùng id thì không gọi `grade()` lần hai
     - row `failed` được chấm lại
     - row `processing` cũ được chấm lại, row `processing` mới trả 409 (F1)
   - `confirmAttempt`:
     - xác nhận hai lần không đổi `hit_count`
     - nhiều issue cùng `pattern_key` chỉ tạo một mistake
   - `patchMistake` gộp và tách: `hit_count` của cả hai mistake đúng sau thao tác, mistake rỗng bị xoá.
   - `importAll`: nhập vào DB trống thì đúng số bản ghi, nhập vào DB có `pattern_key` trùng thì không có hit mồ côi (F2).
4. **Dùng `grade` giả** (hàm trả `GradeOutput` cố định) để không gọi Gemini thật.

---

# Phần B. Lộ trình tính năng (chốt 18/11/2026)

## B1. Mục tiêu và nguyên tắc

- **App chỉ luyện nói và viết.** Nghe, đọc, từ vựng và ngữ pháp bạn tự học bằng sách giấy. App và sách nối với nhau qua ô ghi chú trong sổ lỗi (N4).
- **Chỉ gọi AI ở đúng một chỗ: chấm bài nói hoặc viết.** Mọi tính năng mới chạy bằng logic thường, không gọi Gemini.
- **Dữ liệu của bạn là trung tâm.** Lỗi đã duyệt được dùng lại cho ôn tập, kiểm tra và thống kê, thay vì làm các mục rời rạc như web khác.
- **Giữ nguyên tắc cũ trong `plan.md`:**
  - học quan trọng hơn code tool
  - Alpha trước 30/3/2027
  - mỗi giai đoạn dùng thật 2 tuần rồi mới làm tiếp
  - AI chỉ đề xuất, bạn duyệt

## B2. Phạm vi

| Mục | Làm gì | Gọi AI? | Giai đoạn |
| --- | --- | --- | --- |
| Làm mới giao diện (B7) | Chuyển sang Tailwind và Nuxt UI, thiết kế lại mọi màn hình | Không | 1a |
| Luyện nói/viết (đã có) | Thêm chế độ tự duyệt (N1) và ô dán JSON (N2) | 1 lần mỗi bài, hoặc 0 | 1 |
| Kho đề (N3) | Thêm, sửa, tắt đề. Import CSV/JSON. Gắn tag | Không | 1 |
| Ghi chú sổ lỗi (N4) | Ô ghi chú cho mỗi kiểu lỗi, ví dụ trang sách cần ôn | Không | 1 |
| Streak và lịch điểm danh (N11) | Chuỗi ngày luyện liên tiếp, mục tiêu 5 ngày mỗi tuần, lịch tháng tô màu theo ngày đã luyện. Điểm danh tay cho ngày tự học bằng sách | Không | 1 |
| Ôn lỗi (N5) | Thẻ ôn lấy từ lỗi đã duyệt, lịch ôn bằng `ts-fsrs` | Không | 2 |
| Kiểm tra tuần (N6) | Bài ngắn gồm những thẻ hay sai nhất | Không | 2 |
| Tiến bộ (N7) | Thống kê theo tuần, bài đối chứng hằng tháng | Không | 3 |
| Tự tìm lỗi trước khi xem AI (N9) | Đánh dấu chỗ nghi sai trước khi hiện đề xuất của AI, đo số lỗi tự bắt được | Không | 3 |
| So sánh phiên bản (N10) | Đặt v1, v2… của cùng một đề cạnh nhau, xem lỗi cũ đã hết chưa | Không | 3 |
| Chế độ TOEIC S&W (N8) | Bấm giờ chuẩn bị và trả lời theo dạng đề | Không gọi thêm | 4 (tuỳ chọn) |

## B3. Không làm

| Mục | Lý do |
| --- | --- |
| Từ vựng, ngữ pháp | Bạn tự học bằng sách. Ô ghi chú ở N4 nối sổ lỗi với sách |
| Nghe, đọc (gồm trắc nghiệm TOEIC L&R, nghe chép chính tả) | Bạn tự luyện bằng sách. Giữ app gọn |
| Cào đề trên mạng | Đề ETS có bản quyền, điều khoản của các web luyện thi cấm cào. Web cần đăng nhập, có chống bot, đổi giao diện là công cụ hỏng. Kho đề với import (N3) đã đủ |
| Hội thoại với AI theo thời gian thực (P2 cũ) | Tốn lượt gọi AI nhất |
| Chấm điểm kiểu thi | Prompt đã ghi "Do not assign an exam score". Điểm từ AI không đáng tin |

## B4. Giảm lượt gọi AI

| Việc | Hướng làm |
| --- | --- |
| Hạ hạn mức mỗi ngày | Đổi `GEMINI_DAILY_LIMIT` từ 40 xuống 10 trong `.env` và `.env.example`. Gộp với C2 thành `geminiDailyLimit()`, mặc định 10 |
| Đếm đúng số lần gọi | Theo F6: đếm cả lần gọi lại vì JSON sai |
| Không gọi lại khi hết giờ | Theo F1: Gemini quá 25 giây thì báo lỗi luôn, không gọi lại. Chỉ gọi lại khi JSON sai cấu trúc |
| Có đường đi không cần AI | N1 (tự duyệt) và N2 (dán JSON từ AI chat miễn phí) không tốn hạn mức |
| Hiển thị cho bạn biết | Màn hình Hôm nay đã hiện "Gemini hôm nay: x/y". Thêm ghi chú "còn z lượt" khi đã dùng quá 70% |

## B5. Các giai đoạn

Lịch làm theo ràng buộc trong `plan.md`: tối đa 2 buổi mỗi tháng, 3–4 giờ mỗi buổi. Số giờ dưới đây là ước lượng, có thể trễ.

Code hiện tại đã có gần đủ phần P0 của `plan.md` (4 màn hình, duyệt lỗi, xuất/nhập, Copy prompt), tức là đi trước lịch trong plan. Vì vậy hạn Alpha 30/3/2027 giờ áp cho phần sửa lỗi và các phần thêm dưới đây.

| Giai đoạn | Nội dung | Ước lượng | Xong khi |
| --- | --- | --- | --- |
| 0 | F1, T1. Nên làm luôn F2, F3 | 4–6 giờ | Test cho `submitAttempt` và `confirmAttempt` chạy qua. Bài kẹt `processing` được chấm lại |
| 1a | Làm mới giao diện (B7): cài Nuxt UI, dựng lại layout và các màn hình hiện có | 6–10 giờ | Không còn `alert()`/`confirm()`. Không còn emoji hay ký tự làm icon (tìm trong `app/` không ra kết quả). Mọi màn hình hiện có chạy trên giao diện mới, cả sáng lẫn tối, trên điện thoại và máy tính |
| 1 (Alpha, trước 30/3/2027) | N1, N2, N3, N4, N11, B4. Màn hình mới dựng thẳng bằng Nuxt UI | 11–16 giờ | Nộp được bài khi Gemini lỗi mà không mất bài. Thêm hoặc import đề không cần sửa code |
| 2 | N5, N6 | 8–12 giờ | Ôn được thẻ đến hạn mỗi ngày trên điện thoại. Có bài kiểm tra tuần |
| 3 | N7, N9, N10 | 10–16 giờ | Thấy được xu hướng lỗi/100 từ, mức tái phạm của lỗi trọng tâm và tỉ lệ lỗi tự bắt được qua các tuần. So được hai phiên bản của cùng một đề |
| 4 (tuỳ chọn) | N8 | 4–6 giờ | Luyện được một đề TOEIC S&W đúng giờ |

Giai đoạn 1a làm **trước** N1–N10 để các màn hình mới không phải thiết kế hai lần. Giai đoạn 0 + 1a + 1 cộng lại khoảng 21–32 giờ, tức 6–9 buổi. Với lịch 2 buổi mỗi tháng thì có thể không kịp 30/3/2027. Nếu trễ, theo quy tắc cắt phạm vi của `plan.md`: đẩy N3, N4 sang sau Alpha, giữ N1, N2, N11.

N11 (streak và lịch) xếp vào Alpha vì mục tiêu số một của `plan.md` là thói quen: "dùng ít nhất 5 ngày mỗi tuần". Có lịch từ sớm thì đo được mục tiêu này ngay từ đầu.

Phần A còn lại (C1–C12, F4–F8) làm xen kẽ khi đụng tới file liên quan. C1 và C3 nên làm cùng N3, vì N3 sửa đúng chỗ đó.

---

## B6. Hướng làm từng tính năng

### N1. Chế độ tự duyệt (không chấm AI)

**Mục đích:** Gemini lỗi, hết lượt, hoặc bạn tự thấy lỗi của mình thì vẫn ghi được lỗi vào sổ.

**Hướng làm:**
- Thêm cột `source` vào `attempts` với 3 giá trị `gemini | manual | pasted`, mặc định `gemini`. Chạy `db:generate`.
- **Không cần route mới, nhưng 2 route nộp bài nhận thêm trường `mode`** (`ai | manual | pasted`, mặc định `ai`). Route dựa vào `mode` để chọn hàm `grade()` truyền vào `submitAttempt`.
- **`submitAttempt` nhận thêm `source`** và ghi vào row. Khi `source = 'manual'` thì lưu `aiJson = null` (hiện tại code luôn ghi `out.raw`, nên phải sửa chỗ này).
- `grade()` của chế độ tự duyệt không gọi Gemini:
  - **Bài viết:** trả `{ result: { issues: [], focus_pattern_suggestion: '' }, raw: '', model: 'manual', promptVersion: PROMPT_VERSION }`.
  - **Bài nói:** bạn tự gõ bản chép lời. Route nhận thêm trường `transcript`. Audio không cần gửi lên vì không có gì để chấm. `durationS` lấy từ bản ghi trên máy nếu có, không có thì để trống (khi đó không tính tốc độ nói). `grade()` trả `transcript` đó.
- **Không gọi `consumeGeminiQuota()`** trong chế độ này. Sau F6, hạn mức được truyền qua `gradeWithGemini(…, { beforeCall })`, nên `grade()` của chế độ tự duyệt chỉ cần không gọi Gemini.
- **Nới ràng buộc ở route nói:** hiện route bắt buộc có file audio và `durationS ≥ 1` (`speaking.post.ts`). Với `mode = 'manual' | 'pasted'` phải bỏ yêu cầu audio và cho `durationS` để trống, nếu không thì không nộp được.
- **Chấm lại row `failed` bằng chế độ khác:** nhánh nhận lại row trong `claimAttempt` hiện chỉ ghi `status`, `error`, `processing_at`. Phải ghi thêm `source` (và `durationS` nếu có), nếu không row sẽ giữ giá trị cũ của lần chấm AI.
- **Dùng lại `clientAttemptId`:** nếu lần chấm AI trước đã `failed` thì chuyển sang tự duyệt với cùng id, row cũ được dùng lại theo đúng luồng hiện có, không tạo bài trùng.
- **Client:** trang nói và viết có thêm nút "Tự duyệt, không chấm AI". Khi Gemini lỗi, nút này hiện cạnh Copy prompt. Trang review hiện có đã xử lý được `ai_json` rỗng (`parseAi` trả `null` thì danh sách lỗi rỗng). Bạn dùng nút "+ Thêm" để tự ghi lỗi.

### N2. Dán JSON từ AI khác

**Mục đích:** chấm bằng AI chat miễn phí (ChatGPT, Claude, Gemini web) rồi đưa kết quả vào app, để lỗi được ghi vào sổ như khi Gemini chấm.

**Hướng làm:**
- Trong khối Copy prompt, thêm ô "Dán kết quả JSON" và nút "Dùng kết quả này".
- Gửi lên route nộp bài với `mode = 'pasted'` và trường `pastedJson` (giới hạn khoảng 50 KB).
- Server parse rồi validate bằng chính `speakingResultSchema` / `writingResultSchema`. Sai cấu trúc thì trả 400, kèm chỗ sai. Hay gặp: AI chat bọc JSON trong khối ```` ```json ````, nên bỏ phần bọc này trước khi parse.
- Dùng `submitAttempt` với `grade()` trả kết quả đã validate:
  - `source = 'pasted'`, `model = 'pasted'`
  - `raw` là chuỗi bạn dán, được giữ nguyên để đối chiếu
  - Không tốn hạn mức.
- Kiểm tra đoạn trích vẫn chạy như cũ ở màn hình review (`assessIssue`). AI ngoài bịa đoạn trích thì lỗi đó không được tick sẵn.
- Bài nói: bản chép lời lấy từ trường `transcript` trong JSON. Thời lượng lấy từ bản ghi trên máy.
- Prompt thủ công đã yêu cầu đúng định dạng này (`buildManualPrompt`). Làm C11 trước để prompt nói và viết tách bạch.

### N3. Kho đề

**Mục đích:** thêm, sửa, tắt và import đề mà không phải sửa `seed-topics.ts`.

**Hướng làm:**
- **Bảng `topics`:**
  - thêm `tags` (text, các tag cách nhau bằng dấu phẩy, ví dụ `work,standup` hoặc `toeic-sw,opinion`)
  - thêm `created_at`
  - `id` của đề mới dùng UUID. Đề seed giữ id cũ.
- **API:**
  - `POST /api/topics`, `PATCH /api/topics/:id` (sửa, bật hoặc tắt `active`)
  - `POST /api/topics/import`, nhận JSON hoặc CSV với các cột `kind,title,prompt,level,tags`. JSON là định dạng chính. Đề thường có dấu phẩy và ngoặc kép, nên CSV phải dùng parser xử lý được ô trong ngoặc kép, không tách chuỗi bằng dấu phẩy
- **Không xoá cứng đề** đã có bài nộp vì khoá ngoại. Chỉ cho tắt. Đề chưa có bài nào thì cho xoá.
- **Chống trùng khi import:** bỏ qua dòng trùng `(kind, title)`, trả số dòng thêm mới và số dòng bỏ qua, giống cách báo của `importAll`.
- **Trang `/topics`** mở từ menu ⋯: danh sách theo nói/viết, lọc theo tag, form thêm và sửa, nút import file.
- **Màn hình Hôm nay** vẫn xoay vòng đề như cũ, chỉ trong các đề đang bật. Tuỳ chọn: chọn tag ưu tiên trong tuần.
  - Lưu ý: đề hôm nay được chọn bằng `day % số đề`, nên thêm hoặc tắt đề sẽ làm đề hôm nay đổi ngay giữa ngày. Chấp nhận được với app cá nhân. Nếu thấy phiền thì lưu đề đã chọn của mỗi ngày.
- Gộp sửa C1 và C3 (`topicToText`, `topicService`).
- **Thêm `tags` vào bản xuất JSON** và tăng `EXPORT_SCHEMA_VERSION`. Import vẫn phải đọc được file của phiên bản cũ.

### N4. Ghi chú trong sổ lỗi

**Mục đích:** nối sổ lỗi với sách bạn đang học, ví dụ "Grammar in Use unit 12, trang 24".

**Hướng làm:**
- Thêm cột `note` (text, mặc định rỗng) vào `mistakes`.
- `PATCH /api/mistakes/:id` nhận thêm `note`, đặt vào `updateMistake` sau khi làm C4.
- `MistakeCard` hiện ghi chú bên dưới ví dụ và cho sửa trong form chi tiết. Lỗi trọng tâm trên màn hình Hôm nay cũng hiện ghi chú.
- Khi gộp hai kiểu lỗi: nối hai ghi chú lại, không bỏ ghi chú nào.
- Thêm `note` vào CSV sổ lỗi và CSV Anki (mặt sau).

### N5. Ôn lỗi (FSRS)

**Mục đích:** ôn lại đúng những câu mình từng nói hoặc viết sai, theo lịch giãn cách.

**Hướng làm:**
- **Kiểm tra trước:** phiên bản `ts-fsrs` mới nhất và yêu cầu phiên bản Node. `plan.md` có ghi bản 6 có thể cần Node 24.
- **Bảng `cards`**, mỗi lần mắc (`mistake_hit`) là một thẻ:
  - `id`, `hit_id` (unique, khoá ngoại tới `mistake_hits`)
  - các trường trạng thái FSRS: lưu đúng các trường của kiểu `Card` trong bản `ts-fsrs` đang dùng, ví dụ `due`, `stability`, `difficulty`, `scheduled_days`, `reps`, `lapses`, `state`, `last_review`. Tên trường có thay đổi giữa các bản lớn nên kiểm tra lúc làm. Thời gian lưu dạng số mili giây như các bảng hiện có
  - `suspended`
  - Thẻ gắn với lần mắc, nên gộp hoặc tách kiểu lỗi không ảnh hưởng.
- **Bảng `review_logs`:** `id`, `card_id`, `rating`, `reviewed_at`, các trường log của `ts-fsrs`, `is_quiz` (dùng cho N6).
- **Tạo thẻ** ngay trong transaction của `confirmAttempt`, mỗi hit mới một thẻ. Chỉ lỗi bạn đã duyệt mới thành thẻ, đúng quy tắc "không tự tạo thẻ từ phỏng đoán của AI". Thêm một script tạo thẻ cho các hit đã có từ trước.
- **Giới hạn số thẻ:** một kiểu lỗi có tối đa 3 thẻ đang hoạt động, các thẻ còn lại để `suspended`. Tránh một lỗi hay gặp chiếm hết buổi ôn. Sau khi gộp hoặc tách kiểu lỗi thì chạy lại bước cân bằng này.
- **API:**
  - `GET /api/cards/due?limit=20`
  - `POST /api/cards/:id/review { rating }`: server tính lịch bằng `ts-fsrs`. Client không tự tính, để hai thiết bị không ghi đè lịch của nhau.
- **Màn hình ôn:**
  - Mặt trước: câu chứa lỗi, lấy từ `final_transcript` quanh `original_quote`, với đoạn sai được tô. Có thêm nhãn kiểu lỗi. Nếu không tìm thấy đoạn trích trong bài (bạn đã sửa bản chép lời, hoặc lỗi tự thêm) thì chỉ hiện đoạn trích.
  - Bạn tự gõ câu sửa (tuỳ chọn) rồi bấm "Xem đáp án".
  - Mặt sau: câu sửa đúng, ghi chú N4 và link về bài gốc.
  - Chấm 4 mức: Lại / Khó / Được / Dễ.
- **Màn hình Hôm nay:** thêm dòng "x thẻ đến hạn" và nút "Ôn ngay".
- **Xuất/nhập JSON:** thêm `cards` và `review_logs`, tăng `EXPORT_SCHEMA_VERSION`, thêm vào thứ tự import theo khoá ngoại.
  - `importAll` (F2) mới ánh xạ id cho `attempts` và `mistakes`. Một hit trong file có thể bị bỏ qua vì trùng `(attempt_id, issue_index)` nhưng có `id` khác hit trong DB, khi đó `cards.hit_id` sẽ trỏ tới hit không tồn tại. Cần thêm bảng ánh xạ cho `mistake_hits` (tra hit đang có theo `(attempt_id, issue_index)`), rồi thay `hit_id` của `cards`, `card_id` của `review_logs` trước khi insert.
- **Test:**
  - xác nhận bài tạo đúng số thẻ, xác nhận lần hai không tạo thêm
  - review thì `due` được đẩy lùi
  - gộp kiểu lỗi không mất thẻ

### N6. Kiểm tra tuần

**Mục đích:** mỗi tuần làm một bài ngắn với những lỗi bạn hay sai nhất, để biết lỗi nào đã hết, lỗi nào vẫn lặp lại.

**Hướng làm:**
- **Chọn 10–15 thẻ** xếp theo thứ tự ưu tiên:
  1. nhiều lần chấm "Lại" trong 30 ngày gần nhất
  2. kiểu lỗi tái phạm trong các bài nộp gần đây
  3. lỗi trọng tâm tuần
- Cách làm giống màn hình ôn N5, nhưng không xem gợi ý trước.
- **Kết quả vẫn cập nhật lịch FSRS,** vì đây là một lần nhớ lại thật. Log ghi `is_quiz = true`.
- **Bảng `quizzes`:** `id`, `created_at`, `card_ids` (JSON), `score` (tỉ lệ Được + Dễ). Trang Tiến bộ (N7) dùng bảng này để vẽ điểm theo tuần.
- Màn hình Hôm nay nhắc làm bài kiểm tra vào Chủ nhật, cùng lúc với nhắc sao lưu.

### N7. Tiến bộ

**Mục đích:** thấy được mình có tiến bộ thật không, theo đúng "Chỉ số học tập" trong `plan.md`.

**Hướng làm:**
- **`GET /api/stats?from&to`**, gom theo tuần:
  - số ngày có luyện
  - số bài nói và viết đã duyệt
  - lỗi/100 từ trung bình
  - tốc độ nói trung bình
  - mức tái phạm của lỗi trọng tâm (số lần mắc trên 100 từ). Hiện app không lưu lỗi nào là trọng tâm ở tuần nào, chỉ có cờ `is_focus` hiện tại. Cần thêm bảng `focus_log` (`mistake_id`, `from`, `to`), ghi mỗi khi đổi lỗi trọng tâm
  - số thẻ đã ôn và tỉ lệ nhớ
  - điểm kiểm tra tuần
  - tỉ lệ lỗi tự bắt được (N9)
- **Chỉ so những tuần dùng cùng `prompt_version` và `model`.** Nếu đổi giữa chừng thì vẽ một vạch đánh dấu trên biểu đồ. Bài `manual` và `pasted` tính riêng.
- **Bài đối chứng:**
  - thêm cột `is_benchmark` vào `attempts`
  - các đề đối chứng có tag `benchmark` trong kho đề (N3)
  - mỗi tháng màn hình Hôm nay nhắc làm một bài nói và một bài viết đối chứng
  - trang Tiến bộ đặt các bài đối chứng cạnh nhau theo tháng
- **Biểu đồ:** SVG tự vẽ đơn giản (đường hoặc cột), dùng token màu của theme Nuxt UI (B7) để đồng bộ cả sáng lẫn tối. Theo hướng dẫn của skill `dataviz`. Chỉ dùng thư viện nếu tự vẽ quá tốn công.
- Trang `/progress` đặt trên thanh điều hướng theo bố cục chốt ở B7.

### N8. Chế độ TOEIC Speaking & Writing (tuỳ chọn)

**Mục đích:** luyện đúng định dạng và thời gian của đề thi. Phần chấm dùng chung, không gọi thêm AI.

**Hướng làm:**
- **Bảng `topics`:** thêm `prep_s` (thời gian chuẩn bị) và `response_s` (thời gian trả lời), có thể để trống. Đề TOEIC import qua N3 với tag `toeic-sw` và tag dạng câu.
- **Trang nói:** nếu đề có `prep_s` thì đếm ngược thời gian chuẩn bị, rồi tự bật ghi âm và tự dừng khi hết `response_s`. Xin quyền micro ngay lúc bạn bấm "Bắt đầu chuẩn bị", vì Safari iOS chỉ cho mở micro khi có thao tác chạm của người dùng. Đến lúc tự bật ghi âm thì micro đã sẵn sàng. `MAX_RECORD_SECONDS` hiện là 120, đủ cho mọi dạng câu nói của TOEIC.
- **Trang viết:** có đồng hồ đếm ngược theo `response_s`, chỉ nhắc khi hết giờ chứ không khoá ô viết.
- **Không chấm điểm kiểu thi** (B3). App chỉ ghi nhận "xong trong giờ" hay "quá giờ".
- Nội dung đề do bạn tự soạn theo các dạng đề, không lấy đề có bản quyền.

### N9. Tự tìm lỗi trước khi xem AI

**Mục đích:** tự phát hiện lỗi mới là phần giúp tiến bộ, đọc đề xuất của AI thì thụ động. Tính năng này cũng giảm nguy cơ duyệt qua loa (`plan.md` mục 11: "mặc định chấp nhận khiến duyệt qua loa").

**Hướng làm:**
- **Bước tự tìm (bật/tắt trong menu, mặc định bật):** màn hình review ẩn danh sách lỗi của AI trước. Bạn chạm hoặc bôi chọn những chỗ nghi sai trong bài (bài nói thì nghe lại audio nếu còn trên máy), rồi bấm "Xem gợi ý của AI".
- **So khớp:** chỗ bạn đánh dấu trùng với đoạn trích của AI (dùng `findQuote`, có chồng lấn là tính) thì lỗi đó được ghi "tự bắt được". Chỗ bạn đánh dấu mà AI không nêu thì gợi ý thêm thành lỗi tự thêm (nút "+ Thêm" có sẵn, điền sẵn đoạn trích).
- **Lưu kết quả:**
  - thêm cột `self_found` (boolean) vào `mistake_hits`
  - thêm `self_marked_count` vào `attempts`
  - dữ liệu ghi trong transaction của `confirmAttempt`
- **Chỉ số mới cho N7:** tỉ lệ lỗi tự bắt được = số lỗi `self_found` ÷ tổng lỗi đã duyệt, theo tuần. Con số này đo việc bạn tự nhận ra lỗi, không phụ thuộc vào model AI.
- **Tuỳ chọn bỏ tick sẵn:** thêm cài đặt "không tick sẵn lỗi của AI". Bật thì mọi lỗi bắt đầu ở trạng thái bỏ tick và bạn phải tự tick từng lỗi muốn giữ. Mặc định vẫn như hiện tại (`assessIssue`), đúng quyết định trong `plan.md`.
- Cài đặt lưu trong `localStorage`, vì chỉ là tiện ích trên từng máy (theo cách app đang lưu `LS_LAST_BACKUP`).

### N10. So sánh phiên bản

**Mục đích:** `plan.md` có P1 "so sánh 2 lần nói". App đã lưu `attempt_group_id` và `version` cho "Nói lại" và "Viết phiên bản mới", nhưng chưa có màn hình đặt các phiên bản cạnh nhau.

**Hướng làm:**
- **API `GET /api/attempts/groups/:groupId`:** trả các phiên bản trong nhóm, theo thứ tự `version`, kèm hits và KPI của từng bản.
- **Màn hình so sánh** (từ trang review của bài có hơn 1 phiên bản, nút "So với bản trước"):
  - Điện thoại: chọn 2 bản bằng tab. Máy tính: hai cột cạnh nhau.
  - Bảng KPI hai bản: số từ, tốc độ nói, lỗi/100 từ, số từ đệm, tự chấm.
  - Lỗi theo kiểu lỗi: **đã hết** (có ở bản trước, không có ở bản sau), **còn lặp lại**, **mới xuất hiện**. So bằng `pattern_key`.
  - Bài viết: tô phần chữ khác nhau giữa hai bản (diff theo từ, tự viết hàm so sánh đơn giản hoặc dùng thư viện diff nhỏ).
- Không gọi AI. Mọi thứ tính từ dữ liệu đã duyệt.
- **Lịch sử** (N7 hoặc trang hiện có): gom các phiên bản cùng nhóm thành một dòng có thể mở rộng.

### N11. Streak và lịch điểm danh

**Mục đích:** theo dõi thói quen bằng mắt, đúng mục tiêu "dùng ít nhất 5 ngày mỗi tuần" của `plan.md`. Lịch tính cả những ngày bạn tự học bằng sách, vì nghe, đọc, từ vựng và ngữ pháp nằm ngoài app (B1).

**Thế nào là một ngày có luyện:**

| Loại | Điều kiện | Tự động hay tay |
| --- | --- | --- |
| Luyện nói | Có ít nhất 1 bài nói **đã duyệt** (`confirmed`), tính theo ngày `created_at` (ngày bạn nói) | Tự động |
| Luyện viết | Tương tự, cho bài viết | Tự động |
| Ôn lỗi | Có ít nhất 1 lần ôn thẻ (sau N5, dựa trên `review_logs`) | Tự động |
| Tự học | Bạn bấm "Điểm danh" và chọn loại: sách, nghe, đọc, từ vựng, ngữ pháp, khác. Có thể ghi số phút và ghi chú | Tay |

- Bài chưa duyệt không được tính. Đây là cách khuyến khích duyệt bài, đúng nguyên tắc "lỗi chỉ vào sổ sau khi duyệt".
- Bài nộp lúc 23h50 và duyệt sáng hôm sau vẫn tính cho ngày nộp.
- Ngày tính theo giờ Việt Nam, dùng chung hằng `APP_UTC_OFFSET_MIN` của F6. Server và client không lệch nhau.

**Streak:**
- **Chuỗi ngày:** số ngày liên tiếp có luyện, tính đến hôm nay. Hôm nay chưa luyện thì chuỗi vẫn giữ, tính đến hôm qua, và hiện nhắc "Luyện hôm nay để giữ chuỗi".
- **Chuỗi dài nhất** từ trước đến nay.
- **Mục tiêu tuần:** đếm số ngày có luyện trong tuần (thứ Hai đến Chủ nhật), hiện dạng "4/5 ngày". **Chuỗi tuần** là số tuần liên tiếp đạt 5/7. Đây là chỉ số chính, vì nó cho phép nghỉ 2 ngày mỗi tuần mà không mất chuỗi, đúng với lịch học thực tế. Không tạo áp lực phải học bằng mọi giá.
- Tuỳ chọn trong menu: streak chỉ tính ngày luyện trong app, hoặc tính cả ngày điểm danh tay. Mặc định tính cả hai.
- Không làm "đóng băng streak", điểm thưởng hay huy hiệu. Giữ đơn giản.

**Lịch tháng (điểm danh theo calendar):**
- Mỗi ô ngày tô màu theo mức:
  - không có gì
  - chỉ tự học hoặc chỉ ôn
  - có 1 bài nói hoặc viết
  - có cả nói lẫn viết
- Mỗi ô có chấm nhỏ theo loại: nói, viết, ôn, tự học, để nhìn vào là biết hôm đó làm gì. Dùng màu kèm hình dạng hoặc icon, không truyền thông tin chỉ bằng màu (quy tắc UX ở B7).
- Chạm vào một ngày mở drawer chi tiết: danh sách bài nộp (link tới trang review), số thẻ đã ôn, các lần điểm danh tay. Có nút "Điểm danh" cho ngày đó, để bổ sung khi quên điểm danh.
- Chuyển tháng trước/sau. Dưới lịch có tổng của tháng: số ngày luyện, số bài nói, số bài viết, số phút tự học.
- Ngày trong tương lai không cho điểm danh.

**Dữ liệu:**
- **Bảng mới `checkins`:** `id`, `date` (chuỗi `YYYY-MM-DD` theo giờ VN), `kind` (`book | listening | reading | vocab | grammar | other`), `minutes` (có thể trống), `note`, `created_at`. Một ngày có thể có nhiều lần điểm danh.
- **Ngày luyện tự động không cần bảng mới:** tính từ `attempts` (`status = 'confirmed'`, nhóm theo ngày của `created_at`) và từ `review_logs` sau N5. Với dữ liệu của một người, truy vấn lại mỗi lần vẫn nhanh.
- Thêm `checkins` vào bản xuất JSON và thứ tự import, tăng `EXPORT_SCHEMA_VERSION`.

**API:**
- `GET /api/calendar?month=YYYY-MM`: trả từng ngày trong tháng với số bài nói, viết, lần ôn, các lần điểm danh.
- `GET /api/streak`: trả chuỗi ngày hiện tại, chuỗi dài nhất, số ngày tuần này, chuỗi tuần. Hoặc gộp vào `GET /api/today` để màn hình Hôm nay chỉ gọi một API.
- `POST /api/checkins`, `PATCH /api/checkins/:id`, `DELETE /api/checkins/:id`.
- Logic tính streak đặt trong `server/services/streakService.ts`. Hàm tính chuỗi từ danh sách ngày nên là hàm thuần trong `shared/utils/streak.ts`, để test dễ.

**Giao diện:**
- **Màn hình Hôm nay:** thẻ streak ở đầu trang, gồm:
  - icon `i-lucide-flame` và số ngày liên tiếp
  - "4/5 ngày tuần này" dạng vòng tiến độ
  - dải 7 ô của tuần hiện tại
  - nút "Điểm danh tự học"
  - chạm vào thẻ thì mở lịch tháng
- **Trang lịch `/calendar`:** mở từ thẻ streak. Khi làm N7, gộp vào trang Tiến bộ dưới dạng một tab.
- Nuxt UI có component lịch (`UCalendar`). Kiểm tra nó có cho tuỳ biến nội dung từng ô ngày qua slot không. Nếu không thì tự dựng lưới 7 cột.
- Icon theo quy tắc ở B7: `i-lucide-flame` (streak), `i-lucide-calendar-check` (điểm danh), `i-lucide-book-open` (tự học bằng sách). Không dùng emoji 🔥.

**Test:**
- hàm tính chuỗi: chuỗi đứt, hôm nay chưa luyện, qua đêm giao thừa, qua tuần mới
- ngày tính đúng theo giờ VN, ví dụ bài nộp lúc 6h sáng giờ VN, tức 23h hôm trước theo UTC
- bài chưa duyệt không được tính

---

## B7. Làm mới giao diện (Tailwind + Nuxt UI)

### Vì sao

Giao diện hiện tại trông cũ vì:
- icon là emoji (☀ 🎙 ✎ 📒 ★ ⋯), mỗi máy hiển thị một kiểu
- hộp thoại dùng `alert()` và `confirm()` của trình duyệt
- mọi thứ là thẻ phẳng có viền xếp dọc, không có điểm nhấn, không có chuyển động
- trên máy tính chỉ là một cột hẹp 680px
- dùng font hệ thống

### Lựa chọn đã cân nhắc

| Lựa chọn | Kết luận |
| --- | --- |
| **Nuxt UI (chạy trên Tailwind)** | **Chọn.** Thư viện chính thức của hệ Nuxt. Có sẵn modal, drawer, toast, dropdown, tabs, form, progress. Icon qua Iconify. Dark mode có sẵn. Đổi theme bằng cấu hình |
| Tailwind thuần | Modal, toast, menu phải tự làm. Tốn công hơn mà không thêm lợi ích |
| Bootstrap | Trông đúng kiểu cũ đang muốn bỏ. Phần JS không ăn khớp tự nhiên với Vue |
| Tabler | Template dashboard quản trị cho máy tính, xây trên Bootstrap. Không hợp với app luyện tập trên điện thoại |
| Giữ CSS tự viết | Phải tự thiết kế và tự làm mọi component |

### Cần chốt trước khi làm

Lúc làm giai đoạn 1a sẽ dựng mockup để chọn. Dưới đây là đề xuất mặc định:

| Quyết định | Đề xuất mặc định |
| --- | --- |
| Phong cách chung | Tối giản, sáng sủa, nhiều khoảng trắng, bo góc lớn, kiểu app di động hiện đại |
| Màu chủ đạo | Giữ teal hiện tại (`#0f766e`) cho quen mắt, hoặc chọn lại khi xem mockup |
| Font | Inter, qua `@nuxt/fonts` (Nuxt UI cài kèm). **Phải có bộ ký tự tiếng Việt** (subset `vietnamese`), vì toàn bộ chữ trên giao diện là tiếng Việt. Kiểm tra font được phục vụ từ app chứ không gọi Google lúc chạy |
| Icon | Bộ Lucide qua `@nuxt/icon` |
| Bố cục điện thoại | Thanh dưới hiện có 4 mục (Hôm nay, Luyện nói, Luyện viết, Sổ lỗi), sau này còn thêm Ôn lỗi và Tiến bộ. Đề xuất 5 mục: **Hôm nay · Luyện** (chọn nói hoặc viết bên trong) **· Ôn · Sổ lỗi · Tiến bộ**. Lịch sử, Kho đề, sao lưu nằm trong menu. Header gọn |
| Bố cục máy tính (từ 1024px) | Thanh bên trái thay cho thanh dưới. Nội dung rộng hơn. Màn hình review chia 2 cột |
| Sáng/tối | Theo cài đặt máy, có thêm nút chuyển trong menu |

### Hướng làm

**Bước 1. Cài đặt**
- Cài Nuxt UI theo hướng dẫn của bản mới nhất (kiểm tra bản hỗ trợ Nuxt 4.6 và Tailwind v4 lúc làm). Thêm module vào `nuxt.config.ts`. `main.css` import Tailwind và Nuxt UI.
- Bọc `app.vue` bằng `<UApp>`, component gốc mà toast và modal cần.
- Khai báo màu chủ đạo, màu trung tính và bo góc trong `app.config.ts`.
- Tuỳ chọn: thêm `prettier-plugin-tailwindcss` để tự sắp xếp class.
- Chạy `npm run typecheck` và `npm run build`, kiểm tra app vẫn chạy ở chế độ SPA (`ssr: false`).

**Bước 2. Thay các phần dùng chung**

| Hiện tại | Thay bằng |
| --- | --- |
| `useToast` và `Toast.vue` tự viết | `useToast()` của Nuxt UI. **Lưu ý trùng tên:** composable tự viết cũng tên `useToast` nên phải xoá, nếu không auto-import sẽ xung đột |
| `alert()` / `confirm()` (xoá bản ghi, gộp lỗi, xoá nháp, kết quả import) | Một composable `useConfirm()` dựng trên modal của Nuxt UI, mở bằng code (xem `useOverlay` trong tài liệu của bản đang dùng). Kết quả import hiện trong modal |
| `AppMenu.vue` (nút ⋯ và panel tự làm) | `UDropdownMenu` |
| `BottomNav.vue` | Giữ cho điện thoại, đổi icon. Trên máy tính thay bằng thanh bên dùng `UNavigationMenu` |
| `.btn`, `.card`, `.alert`, `.badge`, `.tabs` | `UButton`, `UCard`, `UAlert`, `UBadge`, `UTabs` |
| `input`, `textarea`, `select`, `label` | `UInput`, `UTextarea`, `USelect`, `UFormField` |
| Emoji và ký tự dùng làm icon (☀ 🎙 ✎ 📒 ★ ☆ ⋯ →) | `UIcon` (Lucide) hoặc SVG. Xem "Quy tắc icon" bên dưới |
| `main.css` (khoảng 240 dòng) | Chỉ giữ các style riêng của app (`mark` khi tô lỗi, `.prewrap`). Phần còn lại xoá |

**Quy tắc icon**

- **Không dùng emoji hay ký tự đặc biệt làm icon** ở bất kỳ đâu trên giao diện: nhãn, tiêu đề, nút, toast, hộp thoại, thanh điều hướng. Emoji hiển thị khác nhau trên từng máy và không đổi màu theo theme.
- **Chỉ dùng hai nguồn:**
  1. **Thư viện icon:** Lucide qua `UIcon`, ví dụ `<UIcon name="i-lucide-mic" />`. Đây là lựa chọn mặc định.
  2. **SVG tự vẽ:** chỉ khi Lucide không có icon phù hợp, ví dụ logo app. Đặt trong `app/assets/icons/` và khai báo thành bộ icon riêng của `@nuxt/icon` (kiểm tra cách khai báo trong tài liệu bản đang dùng), để vẫn gọi được bằng `UIcon`. SVG dùng `currentColor` để đổi màu theo theme.
- **Icon chỉ để trang trí** thì gắn `aria-hidden="true"`. **Nút chỉ có icon** thì phải có `aria-label`.
- **Chữ thuần** (ví dụ chuỗi kết quả import) cũng không chèn ký tự kiểu `→`. Viết thành chữ, hoặc đưa vào component có icon.
- **Không dùng emoji trong text gửi AI** hay trong file xuất (CSV, Anki), để dữ liệu sạch.

Các chỗ đang dùng emoji hoặc ký tự làm icon (theo commit `8ebf4be`) và icon thay thế đề xuất. Tên icon kiểm tra lại trên lucide.dev lúc làm:

| Vị trí | Hiện tại | Thay bằng |
| --- | --- | --- |
| [constants/index.ts:4-7](../app/constants/index.ts#L4-L7) (`NAV_ITEMS`) | ☀ 🎙 ✎ 📒 | Đổi trường `icon` thành tên icon: `i-lucide-house` (Hôm nay), `i-lucide-mic` (Luyện nói), `i-lucide-pen-line` (Luyện viết), `i-lucide-notebook-pen` (Sổ lỗi). Mục mới: `i-lucide-repeat` (Ôn), `i-lucide-chart-line` (Tiến bộ) |
| [index.vue:45, 67, 98](../app/pages/index.vue#L45) | 🎙 Đề nói, ✎ Đề viết, 🎙/✎ Duyệt | `i-lucide-mic`, `i-lucide-pen-line` |
| [index.vue:107](../app/pages/index.vue#L107), [mistakes.vue:46](../app/pages/mistakes.vue#L46) | ★ Lỗi trọng tâm | `i-lucide-star` |
| [MistakeCard.vue:71](../app/components/mistakes/MistakeCard.vue#L71) | ★ / ☆ (nút trọng tâm) | `i-lucide-star`: tô đầy khi là trọng tâm, chỉ viền khi không. Kèm `aria-label` |
| [index.vue:111](../app/pages/index.vue#L111), [review/[id].vue:280](../app/pages/review/[id].vue#L280), [IssueEditor.vue:54](../app/components/review/IssueEditor.vue#L54), [MistakeCard.vue:76, 146](../app/components/mistakes/MistakeCard.vue#L76) | → giữa câu sai và câu đúng | Component dùng chung `<CorrectionPair :wrong :right>` có `i-lucide-arrow-right` ở giữa, hoặc xếp hai dòng "Sai" / "Đúng" trên điện thoại |
| [index.vue:131](../app/pages/index.vue#L131) | "mở menu ⋯ →" | Nút "Sao lưu ngay" ngay trong thông báo, không bắt mở menu |
| [AppMenu.vue:57](../app/components/layout/AppMenu.vue#L57) | ⋯ (nút menu) | `i-lucide-ellipsis` trong `UDropdownMenu`, kèm `aria-label="Menu"` |
| [AppMenu.vue:30-32](../app/components/layout/AppMenu.vue#L30-L32) | "trước → sau" trong `alert()` | Modal kết quả import với bảng Trước / Sau / Trong file |
| [review/[id].vue:92](../app/pages/review/[id].vue#L92), [history.vue:65](../app/pages/history.vue#L65) | 🎙 Bài nói, ✎ Bài viết | `i-lucide-mic`, `i-lucide-pen-line` |
| [login.vue:29](../app/pages/login.vue#L29) | "Nói hoặc viết → phản hồi → …" | Dãy bước nhỏ có icon, hoặc viết thành câu |
| Streak và lịch (N11) | | `i-lucide-flame` (streak), `i-lucide-calendar-check` (điểm danh), `i-lucide-book-open` (tự học bằng sách) |
| Mục mới trong menu | | `i-lucide-history` (Lịch sử), `i-lucide-library` (Kho đề), `i-lucide-download` (Xuất), `i-lucide-upload` (Nhập), `i-lucide-log-out` (Đăng xuất), `i-lucide-sun-moon` (Sáng/tối) |

**Bước 3. Thiết kế lại từng màn hình**

| Màn hình | Hướng thiết kế |
| --- | --- |
| Đăng nhập | Thẻ căn giữa, logo, form gọn |
| Hôm nay | Thẻ streak và tiến độ tuần ở đầu trang (N11). Hai thẻ đề lớn có icon và nút bắt đầu. Danh sách "Chờ duyệt". Thẻ lỗi trọng tâm. Sau N5 thêm "x thẻ đến hạn" |
| Luyện nói | Nút ghi âm tròn lớn ở giữa, vòng tiến độ thời gian quanh nút, thanh mức âm động. Ghi xong: trình phát audio và hai nút Nộp / Ghi lại. Hàng đợi "Chưa gửi" thành danh sách gọn |
| Luyện viết | Ô viết cao gần hết màn hình. Thanh đếm từ và nút Nộp dính dưới đáy |
| Duyệt bài | Điện thoại: tab "Bài" và "Lỗi". Máy tính: bài bên trái, danh sách lỗi bên phải. Mỗi lỗi là một thẻ có công tắc giữ/bỏ, sửa lỗi mở drawer. Nút "Lưu x lỗi" dính dưới đáy |
| Sổ lỗi | Ô tìm kiếm và chip lọc (nói/viết/nhóm lỗi). Bấm vào lỗi mở drawer chi tiết thay vì mở rộng tại chỗ. Gộp và tách lỗi làm trong modal |
| Lịch sử | Dòng thời gian theo ngày, icon theo loại bài, badge trạng thái có màu |
| Màn hình mới (Kho đề, Ôn lỗi, Kiểm tra tuần, Tiến bộ, So sánh phiên bản, Lịch điểm danh) | Dựng thẳng bằng Nuxt UI khi làm N3, N5, N6, N7, N10, N11. Màn hình ôn dùng thẻ lật có hiệu ứng chuyển. Bước tự tìm lỗi (N9) là một chế độ của màn hình Duyệt bài |

**Bước 4. Giữ nguyên**
- Toàn bộ logic: `app/api/*`, composable (trừ `useToast`), Dexie, server.
- `HighlightedText.vue` vẫn không render HTML. Chỉ đổi style của `mark`.
- Thứ tự an toàn dữ liệu khi nộp bài: lưu audio và nháp trước, gửi sau.

**Bước 5. Kiểm tra**
- Từng màn hình trên điện thoại thật và trình duyệt máy tính, ở cả chế độ sáng và tối.
- Ghi âm vẫn chạy trên Chrome Android và Safari iOS (nếu có máy).
- Bàn phím ảo trên điện thoại không che nút Nộp và nút Lưu.
- `npm run build` không tăng dung lượng bundle quá mức. Ghi lại dung lượng trước và sau để so.

### Công cụ hỗ trợ khi làm

| Công cụ | Loại | Dùng vào việc |
| --- | --- | --- |
| `superpowers:brainstorming` (chế độ hiển thị trực quan) | Skill | Dựng mockup trong trình duyệt để chốt phong cách |
| `frontend-design` (của Anthropic) | Plugin, có chứa skill | Hướng dẫn làm giao diện có cá tính, không giống template. Cài nếu marketplace còn: `/plugin install frontend-design@claude-plugins-official` |
| Context7 | MCP | Tra tài liệu mới nhất của Nuxt UI và Tailwind trước khi code |
| `writing-vue-code` | Skill | Quy tắc viết component, form, modal Vue 3 |
| `dataviz` | Skill | Biểu đồ cho trang Tiến bộ (N7) |
| Chrome DevTools | MCP | Chụp màn hình cỡ điện thoại và máy tính, chạy Lighthouse |
| `run` | Skill | Chạy app để xem thay đổi thật |
| `anthropic-skills:skill-creator` | Skill | Tạo skill dự án `ui-ux` bên dưới |

### Skill dự án `ui-ux`

**Mục đích:** ghi lại quy tắc UI và UX đã chốt, để mọi màn hình làm sau (Kho đề, Ôn lỗi, Kiểm tra tuần, Tiến bộ) đồng bộ với phần còn lại, không phải nhắc lại mỗi lần.

**Khi nào tạo:** cuối giai đoạn 1a, sau khi đã chốt phong cách và làm lại xong các màn hình hiện có. Làm sớm hơn thì chưa có quy tắc thật để ghi.

**Vị trí:** `.claude/skills/ui-ux/SKILL.md`, cạnh skill `commit` đang có. Tạo bằng `skill-creator`. Viết tiếng Việt, giống CLAUDE.md.

**Phần UI:**
- Màu (chủ đạo, trung tính, trạng thái), font và cỡ chữ, khoảng cách, bo góc, đổ bóng. Ghi đúng tên token trong `app.config.ts`.
- Quy tắc icon (chép từ B7): không emoji, không ký tự làm icon. Chỉ dùng Lucide qua `UIcon`, hoặc SVG tự vẽ khi Lucide không có. Kèm bảng icon cho từng khái niệm: nói, viết, lỗi, trọng tâm, ôn, đề, tiến bộ, lịch sử.
- Bảng "trường hợp nào dùng component nào". Ví dụ: xác nhận dùng `useConfirm()`, chi tiết dùng drawer, lựa chọn ngắn dùng `UTabs`.
- Bố cục điện thoại và máy tính (mốc 1024px), thanh dưới hay thanh bên, nút chính dính đáy.
- Sáng và tối: luôn dùng token màu, không viết mã màu thẳng trong component.

**Phần UX (riêng cho app này):**
- **Không mất bài:** lưu xuống máy trước rồi mới gửi. Mọi thao tác xoá, gộp hay tách đều có modal xác nhận. Xoá thì có nút "Hoàn tác" trong toast nếu làm được.
- **Đủ 4 trạng thái cho mỗi màn hình:**
  - đang tải: khung xương (skeleton), không để trắng màn hình
  - rỗng: một câu hướng dẫn và nút hành động tiếp theo
  - lỗi: nói rõ chuyện gì xảy ra và cho cách đi tiếp (gửi lại, Copy prompt, tự duyệt)
  - thành công
- **Chờ AI chấm** (có thể tới 1 phút): hiện tiến trình và thời gian ước lượng, cho rời trang mà không mất bài.
- **Duyệt lỗi phải thật sự duyệt:** không có nút "giữ tất cả" nổi bật. Lỗi đáng ngờ (đoạn trích không khớp, nghi viết lại cả đoạn) phải nổi bật rõ.
- **Thao tác bằng một tay trên điện thoại:**
  - nút chính nằm trong vùng ngón cái chạm tới
  - vùng chạm tối thiểu 44px
  - bàn phím ảo không che nút Nộp/Lưu
  - tôn trọng vùng an toàn (tai thỏ, thanh home)
- **Chữ:** tiếng Việt, ngắn, nói thẳng hành động. Không dùng thuật ngữ kỹ thuật trên giao diện, ví dụ hiện "kiểu lỗi" thay vì `pattern_key`.
- **Chuyển động:** nhẹ, 150–250ms. Tắt khi máy bật chế độ giảm chuyển động (`prefers-reduced-motion`).
- **Khả năng truy cập:**
  - đủ độ tương phản ở cả sáng lẫn tối
  - thấy rõ viền focus khi dùng bàn phím
  - nút chỉ có icon phải có `aria-label`
  - không truyền thông tin chỉ bằng màu (ví dụ lỗi bị bỏ tick vừa mờ vừa gạch ngang)
- **An toàn:** không render HTML từ AI, chỉ tô lỗi khi đoạn trích khớp (như hiện tại).

**Phần kiểm tra:** mỗi màn hình mới phải được chụp ở 390px và 1280px, cả sáng lẫn tối, bằng Chrome DevTools trước khi coi là xong.
