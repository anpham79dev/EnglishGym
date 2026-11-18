---
name: ui-ux
description: Quy tắc UI/UX của EnglishGym (Nuxt UI 4 + Tailwind 4). Dùng mỗi khi tạo hoặc sửa màn hình, component, modal, toast, icon, màu, bố cục trong app/.
---

# UI/UX EnglishGym

App luyện nói/viết cho một người, dùng chủ yếu trên điện thoại. Giao diện tiếng Việt, ngắn, nói thẳng hành động.

## Nền tảng

- Nuxt UI 4 trên Tailwind 4. Dùng component `U*` trước, chỉ tự viết khi Nuxt UI không có.
- Theme: `app/app.config.ts` (`primary: teal`, `neutral: slate`) và `app/assets/css/main.css`.
  - Sáng: `--ui-primary` là teal-700 (`#0f766e`), success-700, error-600, warning-700, để chữ đủ tương phản trên nền trắng.
  - Tối: các màu trên dùng shade 400.
  - Bo góc `--ui-radius: 0.625rem`. Thẻ dùng `rounded-xl`.
- Font Inter qua `@nuxt/fonts`, có subset `vietnamese`, phục vụ từ app.
- **Chỉ dùng token màu**: `text-highlighted`, `text-default`, `text-toned`, `text-muted`, `bg-default`, `bg-elevated`, `border-default`, `text-primary`, `bg-primary/10`, `text-success`, `text-error`, `text-warning`. Không viết mã màu hay `text-gray-*` trong component.
- `main.css` chỉ giữ style riêng: `mark` (tô lỗi), `mark.off`, `.prewrap`, `prefers-reduced-motion`.

## Icon

- Không dùng emoji hay ký tự đặc biệt làm icon (☀ 🎙 ✎ ★ ⋯ → ● ■…) ở bất kỳ đâu: nhãn, nút, toast, modal, điều hướng, chuỗi kết quả. Kể cả trong text gửi AI và file xuất.
- Chỉ dùng Lucide qua `UIcon` hoặc prop `icon` của component Nuxt UI. Khi Lucide không có icon phù hợp, vẽ SVG riêng dùng `currentColor`, đặt trong `app/assets/icons/` và khai báo thành bộ icon của `@nuxt/icon`.
- Icon được đóng gói (`clientBundle.scan`, quét cả `.vue` và `.ts`), nên tên icon phải là chuỗi literal `i-lucide-...` trong code để scanner thấy. Không ghép tên icon động.
- `tests/icons.test.ts` báo lỗi khi tên icon không có trong Lucide hoặc có emoji trong `app/`. Class Tailwind cũng phải là chuỗi literal (không `text-${color}`).
- Icon trang trí: `aria-hidden="true"`. Nút chỉ có icon: bắt buộc `aria-label`.
- Icon cho từng khái niệm:

| Khái niệm | Icon |
| --- | --- |
| Hôm nay | `i-lucide-house` |
| Nói | `i-lucide-mic` |
| Viết | `i-lucide-pen-line` |
| Sổ lỗi | `i-lucide-notebook-pen` |
| Lịch sử | `i-lucide-history` |
| Lỗi trọng tâm | `i-lucide-star` |
| Sai → đúng | `<BaseCorrectionPair>` (`i-lucide-arrow-right`) |
| Nói lại / phiên bản mới | `i-lucide-repeat` / `i-lucide-git-branch` |
| Gộp / tách | `i-lucide-merge` / `i-lucide-split` |
| Xuất / nhập | `i-lucide-download` / `i-lucide-upload` |
| Ôn (N5) / Tiến bộ (N7) | `i-lucide-repeat` / `i-lucide-chart-line` |
| Streak / điểm danh / tự học (N11) | `i-lucide-flame` / `i-lucide-calendar-check` / `i-lucide-book-open` |
| Kho đề (N3) | `i-lucide-library` |
| Luyện (tab chọn nói/viết) | `i-lucide-dumbbell` |
| Kiểm tra tuần (N6) | `i-lucide-clipboard-check` |
| Tự tìm lỗi (N9) | `i-lucide-scan-search` |
| So sánh phiên bản (N10) | `i-lucide-git-compare` |
| Bấm giờ TOEIC (N8) | `i-lucide-timer` |
| Bài đối chứng (N7) | `i-lucide-target` |
| Tự duyệt / dán JSON (N1, N2) | `i-lucide-user-check` / `i-lucide-clipboard-paste` |

Hằng số dùng lại nằm trong `app/constants/index.ts`: `NAV_ITEMS`, `KIND_ICONS`, `KIND_LABELS`, `STATUS_LABELS`, `STATUS_COLORS`.

## Trường hợp nào dùng gì

| Việc | Dùng |
| --- | --- |
| Khung trang (tiêu đề, nút góc phải, độ rộng) | `<LayoutPage title="…">`, thêm `wide` cho màn 2 cột |
| Nhóm nội dung | `UCard` (header là `h2 font-semibold text-highlighted`) |
| Thông báo ngắn | `useNotify().success/error/info` (không gọi `useToast` trực tiếp ở trang) |
| Xác nhận xoá, gộp, tách | `await useConfirm()({ title, description, confirmLabel, danger })` |
| Xem hoặc sửa chi tiết một mục | `USlideover` |
| Form ngắn một bước (tách lỗi, kết quả nhập) | `UModal` |
| Lựa chọn ngắn 2–4 giá trị | `UTabs :content="false"` |
| Lọc nhiều giá trị | hàng `UButton size="sm"` (solid khi chọn, outline khi không), có `aria-pressed` |
| Trạng thái, nhãn | `UBadge variant="subtle"` theo `STATUS_COLORS` |
| Lỗi, cảnh báo, gợi ý trong trang | `UAlert variant="subtle"` có icon, hành động đặt trong `actions` |
| Trường form | `UFormField` + `UInput` / `UTextarea` / `USelect` / `USelectMenu` / `UInputMenu`, luôn `class="w-full"` |
| Bật/tắt một mục | `USwitch` có `aria-label` |
| Menu | `UDropdownMenu` |

Không dùng `alert()`, `confirm()`, `prompt()` của trình duyệt.

## Bố cục

- Thanh dưới 5 mục: Hôm nay · Luyện · Ôn · Sổ lỗi · Tiến bộ (`NAV_ITEMS`, mỗi mục có `match` cho các trang con). Thêm mục mới vào menu hoặc thanh bên, không thêm vào thanh dưới.

- Điện thoại: header gọn (logo + menu), thanh dưới cố định (`LayoutBottomNav`), nội dung `pb-28` để không bị che.
- Từ 1024px (`lg`): thanh bên trái `LayoutSideNav` rộng 240px, bỏ thanh dưới. Trang thường `max-w-2xl`, trang 2 cột `max-w-5xl`.
- Nút chính của màn hình nhập liệu (Nộp, Lưu) nằm trong thanh dính đáy: `sticky bottom-20 lg:bottom-4`, nền `bg-default/90 backdrop-blur`, để không bị bàn phím ảo và thanh dưới che.
- Màn duyệt bài: điện thoại dùng tab, máy tính chia 2 cột (`lg:grid-cols-2`).
- Tôn trọng vùng an toàn: `pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`.
- Vùng chạm tối thiểu 44px (`min-h-11`, nút `size="lg"` cho hành động chính).

## Biểu đồ

- Tải skill `dataviz` trước khi vẽ biểu đồ. Dùng lại `<ProgressWeekChart>`: mỗi chỉ số một biểu đồ nhỏ một series, không gộp hai trục.
- Màu series là `--chart-series` (teal-600), đã chạy validator cho cả nền sáng và tối. Chữ trên biểu đồ dùng token chữ, không dùng màu series.
- Luôn có tooltip khi rê/chạm và nút "Xem bảng số".

## UX riêng của app

- **Không mất bài**: lưu vào máy (IndexedDB) trước rồi mới gửi. Mọi thao tác xoá, gộp, tách đều qua `useConfirm` hoặc modal.
- **Đủ 4 trạng thái mỗi màn hình**:
  - đang tải: `USkeleton`, không để trắng
  - rỗng: icon lớn `text-muted`, một câu hướng dẫn, nút hành động tiếp theo
  - lỗi: `UAlert color="error"` nói rõ chuyện gì xảy ra và cách đi tiếp (gửi lại, Copy prompt, tự duyệt)
  - thành công: toast `success`
- **Chờ AI chấm** (tới 1 phút): nút ở trạng thái `loading`, ghi rõ bài đã lưu trên máy và rời trang không mất.
- **Duyệt phải thật sự duyệt**: không có nút "giữ tất cả". Lỗi đáng ngờ (đoạn trích không khớp, nghi viết lại) có viền và badge `warning`.
- **Không truyền thông tin chỉ bằng màu**: lỗi bị tắt vừa mờ vừa gạch ngang; cặp sai/đúng có gạch ngang và nhãn ẩn "Sai"/"Đúng"; lỗi trọng tâm có nền, viền và `aria-pressed`.
- **Chữ**: tiếng Việt, ngắn. Không hiện thuật ngữ kỹ thuật (`pattern_key` hiện là "kiểu lỗi"). Không render HTML từ AI; chỉ tô lỗi khi đoạn trích khớp (`HighlightedText`).
- **Chuyển động**: nhẹ, 150–250ms; tắt khi `prefers-reduced-motion`.
- **Truy cập**: viền focus thấy rõ (mặc định của Nuxt UI, nút tự vẽ thì thêm `focus-visible:outline-*`), đủ tương phản ở cả sáng và tối.

## Kiểm tra trước khi coi là xong

1. `npm run typecheck`, `npm test`, `npm run build`.
2. Quét emoji/ký tự làm icon trong `app/` (không được có kết quả).
3. Chụp mỗi màn hình mới ở 390px và 1280px, cả sáng lẫn tối. Cách làm: chạy `nuxt dev` với `DATABASE_URL` trỏ tới một DB tạm (migrate, `db:seed`, `user:create`, thêm dữ liệu mẫu), rồi dùng `puppeteer-core` với Chrome có sẵn trên máy để đăng nhập và chụp. Đồng thời ghi lại lỗi console, request hỏng và icon thiếu.
