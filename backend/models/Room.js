// ===================== ROOM MODEL =====================
// Schema MongoDB để lưu trạng thái hiện tại của các phòng

const mongoose = require('mongoose');

// Schema lưu trữ thông tin phòng
const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true, // Mỗi phòng có ID duy nhất
    index: true
  },
  // Số người trong phòng
  people: {
    type: Number,
    default: 0
  },
  // Nhiệt độ
  temperature: {
    type: Number,
    default: 0
  },
  // Độ ẩm
  humidity: {
    type: Number,
    default: 0
  },
  // Trạng thái đèn
  lightState: {
    type: Boolean,
    default: false
  },
  // Trạng thái cửa
  doorState: {
    type: Boolean,
    default: false
  },
  // Trạng thái quạt (nếu có)
  fanState: {
    type: Boolean,
    default: false
  },
  // Thời gian cập nhật cuối cùng
  lastUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Tạo model
const Room = mongoose.model('Room', roomSchema);

module.exports = Room;



