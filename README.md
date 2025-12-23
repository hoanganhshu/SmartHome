# 🏠 Hệ Thống Nhà Thông Minh

Hệ thống web để điều khiển và theo dõi các phòng thông minh (P101, P102, P103) với tích hợp MQTT, lịch sử sử dụng thiết bị, và API cho Smart Home.

## 📋 Tính Năng

### 1. Hiển thị thông tin phòng
- Số người trong phòng
- Nhiệt độ và độ ẩm
- Trạng thái đèn và cửa
- Cập nhật real-time qua MQTT

### 2. Điều khiển thiết bị
- Bật/tắt đèn
- Mở/đóng cửa
- Bật/tắt quạt

### 3. Feature 7: Theo dõi thời gian và lịch sử sử dụng thiết bị
- Ghi lại tất cả hành động: bật/tắt đèn, mở/đóng cửa, điều khiển quạt, phát hiện chuyển động
- Lưu trữ thời gian chính xác của mỗi hành động
- Xem lịch sử theo phòng và loại hành động
- Thống kê sử dụng thiết bị

### 4. Feature 8: Tích hợp Smart Home (Alexa/Google Home)
- API endpoint `/voice/command` để nhận lệnh từ virtual assistant
- Hỗ trợ các intent: bật/tắt đèn, mở/đóng cửa, điều khiển quạt, đặt nhiệt độ
- API query trạng thái phòng

## 🚀 Cài Đặt

### Backend

```bash
cd backend
npm install
```

### Frontend

Chỉ cần mở file `frontend/index.html` trong trình duyệt hoặc sử dụng local server.

## 🔧 Cấu Hình

### MongoDB

Đảm bảo MongoDB đang chạy trên `localhost:27017` hoặc cập nhật connection string trong `backend/server.js`.

### MQTT

Mặc định sử dụng `test.mosquitto.org`. Có thể thay đổi trong `backend/server.js`.

## 📡 Chạy Ứng Dụng

### 1. Khởi động MongoDB
```bash
mongod
```

### 2. Khởi động Backend
```bash
cd backend
npm start
```

Server sẽ chạy tại `http://localhost:3000`

### 3. Mở Frontend

Mở file `frontend/index.html` trong trình duyệt hoặc sử dụng:
```bash
cd frontend
# Sử dụng Python
python -m http.server 8000

# Hoặc Node.js
npx http-server
```

Sau đó truy cập `http://localhost:8000`

## 📡 API Endpoints

### Rooms
- `GET /rooms` - Lấy danh sách tất cả phòng
- `GET /rooms/:roomId` - Lấy thông tin chi tiết một phòng
- `POST /rooms/control` - Gửi lệnh điều khiển thiết bị

### History (Feature 7)
- `GET /history/:roomId` - Lấy lịch sử sử dụng thiết bị
- `GET /history/:roomId/stats` - Lấy thống kê sử dụng
- `DELETE /history/:roomId` - Xóa lịch sử

### Voice (Feature 8)
- `POST /voice/command` - Nhận lệnh từ Alexa/Google Home
- `GET /voice/status/:roomId` - Lấy trạng thái phòng
- `GET /voice/rooms` - Lấy danh sách phòng

## 🎤 Ví Dụ Sử Dụng Voice API

```bash
# Bật đèn phòng P101
curl -X POST http://localhost:3000/voice/command \
  -H "Content-Type: application/json" \
  -d '{
    "room": "P101",
    "intent": "turn_on_light"
  }'

# Mở cửa phòng P102
curl -X POST http://localhost:3000/voice/command \
  -H "Content-Type: application/json" \
  -d '{
    "room": "P102",
    "intent": "open_door"
  }'
```

## 📁 Cấu Trúc Thư Mục

```
.
├── backend/
│   ├── models/
│   │   ├── History.js      # Model lưu lịch sử
│   │   └── Room.js         # Model lưu thông tin phòng
│   ├── routers/
│   │   ├── history.js      # API lịch sử (Feature 7)
│   │   ├── rooms.js        # API phòng và điều khiển
│   │   └── voice.js        # API Smart Home (Feature 8)
│   ├── mqtt.js             # Xử lý MQTT messages
│   ├── server.js           # Server chính
│   └── package.json
├── frontend/
│   ├── index.html          # Giao diện chính
│   ├── style.css           # Styling
│   └── app.js              # Logic frontend
└── README.md
```

## 🔌 Kết Nối với ESP32

ESP32 sẽ publish data lên topic: `room/{roomId}/data`
Backend sẽ subscribe topic: `room/+/data`

ESP32 sẽ subscribe lệnh từ topic: `room/{roomId}/cmd`
Backend sẽ publish lệnh lên topic: `room/{roomId}/cmd`

## 📝 Ghi Chú

- Tất cả các file đều có comment giải thích bằng tiếng Việt
- Lịch sử được lưu tự động khi có thay đổi trạng thái thiết bị
- API Voice có thể tích hợp với Alexa Skills hoặc Google Actions



