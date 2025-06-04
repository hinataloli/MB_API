# MB Bank Transaction History API

## 🏦 Giới thiệu

Đây là một API Node.js dùng để **đăng nhập MB Bank online** và **lấy lịch sử giao dịch tài khoản** thông qua reverse-engineered API. Toàn bộ quá trình xử lý CAPTCHA, mã hóa WASM và duy trì session đều được tự động hóa.

> ⚠️ Dự án chỉ dùng cho mục đích học tập / nghiên cứu cá nhân.

---

## 🚀 Tính năng

- ✅ Đăng nhập tự động vào MB Bank Internet Banking
- 🔐 Mã hóa thông tin login bằng WASM (WebAssembly)
- 🤖 Tự động giải CAPTCHA thông qua dịch vụ bên ngoài
- 📜 Lấy lịch sử giao dịch tài khoản MB Bank
- 🌐 API RESTful, dễ tích hợp

---

## 🛠️ Công nghệ sử dụng

- Node.js + Express
- Axios (hỗ trợ cookie bằng `axios-cookiejar-support`)
- WASM (mã hóa thông tin)
- Tough-Cookie (quản lý cookie phiên)
- CORS
- Node-Fetch
- Crypto (MD5 hash)
- Captcha Resolver API (bên ngoài)

---

## 📦 Cài đặt

### 1. Clone dự án

```bash
git clone https://github.com/hinataloli/MB_API
cd MB_API
```

2. Cài dependencies
```bash
npm install
```
🔐 Mô tả API
POST /api/mb
Lấy lịch sử giao dịch của một tài khoản MB Bank.
✅ Body JSON
```bash
json
{
  "username": "your_username",
  "password": "your_password",
  "account_no": "your_account_number",
  "from_date": "01/06/2024",
  "to_date": "04/06/2024"
}
```
from_date và to_date không bắt buộc. Nếu không cung cấp, sẽ mặc định lấy từ đầu tháng đến ngày hiện tại.

📥 Phản hồi (ví dụ):
json
```bash
{
  "status": "success",
  "data": [
    {
      "posting_date": "04/06/2024",
      "description": "xxx",
      "debit_amount": "500000",
      "credit_amount": "",
      ...
    }
  ]
}
```
🧠 Cấu trúc chính
File	Chức năng
index.js	File chính chạy API
loadWasm.js	Hàm load mã hóa bằng WASM
main.wasm	File WebAssembly mã hóa login
package.json	Cấu hình project

▶️ Chạy server
```bash
node index.js
```
Server sẽ chạy tại:
```bash
http://localhost:8277/api/mb
```
⚠️ Cảnh báo
Không nên sử dụng vào mục đích thương mại hoặc trái pháp luật.

MB Bank có thể thay đổi API bất kỳ lúc nào.


💡 Liên hệ
Nếu bạn thấy hữu ích, hãy ⭐ dự án này!
