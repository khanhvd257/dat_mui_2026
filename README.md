# dat_mui_2026 – REPLY 2006: Sóng về Đất Mũi, Tết về muôn nhà

## Chạy

```bash
node server.js            # http://localhost:8080  (đổi cổng: PORT=3000 node server.js)
```

Không cần cài thư viện (Node ≥ 14). Server phục vụ trang và lưu check-in vào `data/checkins.json`.

- `POST /api/checkin`  `{ name, serial }` – ghi một lượt check-in (tên tối đa 40 ký tự, giới hạn 8 lượt/phút/IP, số chứng nhận trùng thì bỏ qua).
- `GET /api/checkins` – trả `{ total, items: [{ name, ts }] }` (mới nhất trước) cho dải chữ chạy sau phiếu.
- Đổi nơi lưu bằng `DATA_DIR=/duong/dan node server.js`. Hãy sao lưu thư mục `data/` định kỳ.
- Khi mở trang mà không có server (file tĩnh), check-in và chứng nhận vẫn chạy, chỉ là tên không được lưu chung.
- Dữ liệu là họ tên khách: chỉ dùng cho màn hình gian hàng, trang đã có dòng báo khách biết tên sẽ hiển thị công khai.

## Triển khai trên Vercel

Vercel không có ổ đĩa ghi lâu dài nên không dùng `server.js`; thay vào đó các hàm trong `api/` lưu vào Redis (Upstash), cùng đường dẫn `/api/checkin` và `/api/checkins` nên giao diện không đổi.

1. Đẩy mã lên Git rồi Import project vào Vercel (không cần build, Framework Preset: Other).
2. Vào project → **Storage / Marketplace** → thêm **Upstash Redis** và nối vào project. Vercel tự thêm biến môi trường `KV_REST_API_URL`, `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_*`).
3. Deploy lại. Xem/xuất danh sách tên trong bảng điều khiển Upstash (key `reply2006:checkins`).

`server.js` và `data/` được loại khỏi bản deploy bằng `.vercelignore`; `server.js` chỉ để chạy thử trên máy.
