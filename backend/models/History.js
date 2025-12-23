// ===================== HISTORY MODEL =====================
// Schema MongoDB để lưu lịch sử sử dụng thiết bị theo Feature 7

const mongoose = require('mongoose');

// Schema lưu trữ từng hành động của thiết bị
const historySchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true // Tạo index để tìm kiếm nhanh theo phòng
  },
  // Loại hành động: 'light', 'door', 'fan', 'motion', 'data'
  action: {
    type: String,
    required: true
  },
  // Trạng thái thiết bị (ví dụ: light ON/OFF, door OPEN/CLOSE)
  state: {
    type: mongoose.Schema.Types.Mixed, // Có thể là boolean, number, string
    required: true
  },
  // Dữ liệu cảm biến (nếu có)
  sensorData: {
    people: Number,
    temp: Number,
    humidity: Number
  },
  // Thời gian ghi lại hành động
  timestamp: {
    type: Date,
    default: Date.now,
    index: true // Index để sắp xếp theo thời gian
  }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo model
const History = mongoose.model('History', historySchema);

module.exports = History;



