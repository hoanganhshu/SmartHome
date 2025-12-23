// ===================== BACKEND SERVER =====================
// Server chính xử lý API requests và MQTT communication

const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const historyRouter = require('./routers/history');
const roomsRouter = require('./routers/rooms');
const voiceRouter = require('./routers/voice'); // API cho Smart Home (Alexa/Google Home)
const { handleMqttMessage } = require('./mqtt');

const app = express();
const PORT = 3000;

// ===================== MIDDLEWARE =====================
app.use(cors()); // Cho phép frontend gọi API từ domain khác
app.use(express.json()); // Parse JSON request body

// ===================== DATABASE CONNECTION =====================
// Kết nối MongoDB để lưu lịch sử sử dụng thiết bị
// Lưu ý: Nếu MongoDB chưa chạy, server vẫn hoạt động nhưng không lưu được lịch sử
mongoose.connect('mongodb://localhost:27017/smarthome', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Đã kết nối MongoDB'))
.catch(err => {
  console.error('⚠️  Lỗi kết nối MongoDB:', err.message);
  console.log('⚠️  Server vẫn chạy nhưng không thể lưu lịch sử. Vui lòng khởi động MongoDB.');
});

// ===================== MQTT CONNECTION =====================
// Kết nối MQTT broker để nhận dữ liệu từ ESP32 và gửi lệnh điều khiển
const mqttClient = mqtt.connect('mqtt://test.mosquitto.org');

mqttClient.on('connect', () => {
  console.log('✅ Đã kết nối MQTT broker');
  // Subscribe tất cả các topic data từ các phòng
  mqttClient.subscribe('room/+/data', (err) => {
    if (err) console.error('❌ Lỗi subscribe MQTT:', err);
    else console.log('✅ Đã subscribe topic: room/+/data');
  });
});

mqttClient.on('error', (err) => {
  console.error('❌ Lỗi MQTT:', err);
});

// Xử lý khi nhận được message từ MQTT
mqttClient.on('message', (topic, message) => {
  handleMqttMessage(topic, message);
});

// Lưu MQTT client vào app để các router có thể sử dụng
app.locals.mqttClient = mqttClient;

// ===================== ROUTES =====================
// API endpoints cho các chức năng khác nhau
app.use('/history', historyRouter); // Lịch sử sử dụng thiết bị
app.use('/rooms', roomsRouter); // Thông tin và điều khiển phòng
app.use('/voice', voiceRouter); // API cho Smart Home (Alexa/Google Home)

// ===================== START SERVER =====================
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

module.exports = app;

