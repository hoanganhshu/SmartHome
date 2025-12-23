// ===================== MQTT HANDLER =====================
// Xử lý MQTT messages từ ESP32 và lưu vào database

const History = require('./models/History');
const Room = require('./models/Room');

// Hàm xử lý khi nhận được data từ MQTT
function handleMqttMessage(topic, message) {
  try {
    // Parse topic: room/P101/data -> roomId = P101
    const parts = topic.split('/');
    if (parts.length !== 3 || parts[0] !== 'room' || parts[2] !== 'data') {
      return; // Bỏ qua topic không hợp lệ
    }
    
    const roomId = parts[1]; // Lấy roomId từ topic
    const data = JSON.parse(message.toString()); // Parse JSON data
    
    console.log(`📥 Nhận data từ ${roomId}:`, data);
    
    // Cập nhật thông tin phòng trong database
    updateRoomData(roomId, data);
    
    // Ghi lại lịch sử (Feature 7: Theo dõi thời gian và lịch sử sử dụng thiết bị)
    recordHistory(roomId, data);
    
  } catch (error) {
    console.error('❌ Lỗi xử lý MQTT message:', error);
  }
}

// Cập nhật dữ liệu phòng
async function updateRoomData(roomId, data) {
  try {
    // Kiểm tra xem MongoDB đã kết nối chưa
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log(`⚠️  MongoDB chưa kết nối, bỏ qua cập nhật phòng ${roomId}`);
      return;
    }
    
    await Room.findOneAndUpdate(
      { roomId: roomId },
      {
        people: data.people || 0,
        temperature: data.temp || 0,
        humidity: data.humidity || 0,
        lightState: data.light || false,
        doorState: data.door || false,
        fanState: data.fan || false,
        lastUpdate: new Date()
      },
      { upsert: true, new: true } // Tạo mới nếu chưa tồn tại
    );
  } catch (error) {
    console.error(`❌ Lỗi cập nhật phòng ${roomId}:`, error.message);
  }
}

// Ghi lại lịch sử sử dụng thiết bị (Feature 7)
async function recordHistory(roomId, data) {
  try {
    // Kiểm tra xem MongoDB đã kết nối chưa
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log(`⚠️  MongoDB chưa kết nối, bỏ qua ghi lịch sử cho phòng ${roomId}`);
      return;
    }
    
    const historyEntries = [];
    
    // Ghi lại thay đổi trạng thái đèn
    if (data.light !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'light',
        state: data.light,
        sensorData: {
          people: data.people,
          temp: data.temp,
          humidity: data.humidity
        }
      });
    }
    
    // Ghi lại thay đổi trạng thái cửa
    if (data.door !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'door',
        state: data.door,
        sensorData: {
          people: data.people,
          temp: data.temp,
          humidity: data.humidity
        }
      });
    }
    
    // Ghi lại thay đổi trạng thái quạt (nếu có)
    if (data.fan !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'fan',
        state: data.fan,
        sensorData: {
          people: data.people,
          temp: data.temp,
          humidity: data.humidity
        }
      });
    }
    
    // Ghi lại phát hiện chuyển động (nếu có)
    if (data.motion !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'motion',
        state: data.motion,
        sensorData: {
          people: data.people,
          temp: data.temp,
          humidity: data.humidity
        }
      });
    }
    
    // Lưu tất cả các hành động vào database
    if (historyEntries.length > 0) {
      await History.insertMany(historyEntries);
      console.log(`✅ Đã ghi ${historyEntries.length} hành động vào lịch sử cho phòng ${roomId}`);
    }
    
  } catch (error) {
    console.error(`❌ Lỗi ghi lịch sử cho phòng ${roomId}:`, error.message);
  }
}

// Ghi lại lệnh điều khiển (khi người dùng gửi lệnh)
async function recordControlCommand(roomId, command) {
  try {
    // Kiểm tra xem MongoDB đã kết nối chưa
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log(`⚠️  MongoDB chưa kết nối, bỏ qua ghi lệnh điều khiển cho phòng ${roomId}`);
      return;
    }
    
    const history = new History({
      roomId: roomId,
      action: 'control',
      state: command,
      timestamp: new Date()
    });
    
    await history.save();
    console.log(`✅ Đã ghi lệnh điều khiển cho phòng ${roomId}`);
  } catch (error) {
    console.error(`❌ Lỗi ghi lệnh điều khiển:`, error.message);
  }
}

module.exports = {
  handleMqttMessage,
  recordControlCommand
};

