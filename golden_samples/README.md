# golden_samples (Buổi 0)

Thư mục này bị `.gitignore` trừ file README. **Không đặt dữ liệu công ty vào đây.**

Mỗi clip gồm 2 file cùng tên:

- `clip01.webm` (hoặc `.ogg`, `.m4a`, `.mp4`, `.mp3`, `.wav`)
- `clip01.json`, viết **trước** khi chạy AI:

```json
{
    "topic": "Describe a bug",
    "transcript": "So yesterday I fix a bug in the, um, login page...",
    "issues": [{ "original_quote": "I fix a bug" }]
}
```

Cần đủ loại: nói bình thường, cố ý sai ngữ pháp, ngập ngừng, từ đệm, ồn nhẹ, và vài clip hoàn toàn đúng
(`"issues": []`) để xem AI có bịa lỗi không. Bắt đầu 8–10 clip, đủ 20 trước Alpha.

Chạy: `npm run eval:gemini -- --runs 2`
