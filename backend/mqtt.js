// ===================== MQTT HANDLER =====================
// Xử lý MQTT messages từ ESP32 và lưu vào database

const History = require('./models/History');
const Room = require('./models/Room');

// ===================== IN-MEMORY STORAGE =====================
// Lưu trữ dữ liệu tạm thời khi MongoDB chưa kết nối
const roomDataCache = new Map(); // Map<roomId, roomData>

// Hàm xử lý khi nhận được data từ MQTT
function handleMqttMessage(topic, message) {
  try {
    // Parse topic: room/P101/data -> roomId = P101
    const parts = topic.split('/');
    if (parts.length !== 3 || parts[0] !== 'room' || parts[2] !== 'data') {
      return; // Bỏ qua topic không hợp lệ
    }
    
    const roomId = parts[1]; // Lấy roomId từ topic
    const messageStr = message.toString();
    console.log(`📥 Nhận MQTT message từ topic: ${topic}`);
    console.log(`📥 Raw message: ${messageStr}`);
    
    const data = JSON.parse(messageStr); // Parse JSON data
    console.log(`📥 Parsed data từ ${roomId}:`, JSON.stringify(data, null, 2));
    
    // Lưu vào cache ngay lập tức (ngay cả khi MongoDB chưa kết nối)
    saveToCache(roomId, data);
    
    // Cập nhật thông tin phòng trong database
    updateRoomData(roomId, data);
    
    // Ghi lại lịch sử (Feature 7: Theo dõi thời gian và lịch sử sử dụng thiết bị)
    recordHistory(roomId, data);
    
  } catch (error) {
    console.error('❌ Lỗi xử lý MQTT message:', error);
  }
}

// Lưu vào cache (in-memory storage)
function saveToCache(roomId, data) {
  try {
    const roomData = {
      roomId: roomId,
      people: data.people !== undefined ? data.people : 0,
      temperature: data.temp !== undefined ? data.temp : 0,
      humidity: data.humidity !== undefined ? data.humidity : 0,
      lightState: data.light !== undefined ? (data.light === 1 || data.light === true) : false,
      doorState: data.door !== undefined ? (data.door === 1 || data.door === true) : false,
      fanState: data.fan !== undefined ? (data.fan === 1 || data.fan === true) : false,
      lastUpdate: new Date()
    };
    
    roomDataCache.set(roomId, roomData);
    console.log(`💾 Đã lưu vào cache: ${roomId}`, roomData);
  } catch (error) {
    console.error(`❌ Lỗi lưu cache cho phòng ${roomId}:`, error.message);
  }
}

// Lấy dữ liệu từ cache
function getFromCache(roomId) {
  return roomDataCache.get(roomId) || null;
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
      console.log(`⚠️  MongoDB chưa kết nối (readyState: ${mongoose.connection.readyState}), bỏ qua ghi lệnh điều khiển cho phòng ${roomId}`);
      console.log(`⚠️  Vui lòng khởi động MongoDB để lưu lịch sử.`);
      return;
    }
    
    console.log(`📝 Bắt đầu ghi lịch sử cho phòng ${roomId}, command:`, command);
    
    // Lấy dữ liệu phòng hiện tại để có sensorData
    const currentData = getFromCache(roomId);
    const sensorData = currentData ? {
      people: currentData.people,
      temp: currentData.temperature,
      humidity: currentData.humidity
    } : {};
    
    console.log(`📊 Sensor data:`, sensorData);
    
    // Ghi lại từng hành động trong command
    const historyEntries = [];
    
    if (command.light !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'light',
        state: command.light === 1 || command.light === true ? 1 : 0,
        sensorData: sensorData,
        timestamp: new Date()
      });
      console.log(`📝 Thêm lịch sử: light = ${command.light}`);
    }
    
    if (command.door !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'door',
        state: command.door === 1 || command.door === true ? 1 : 0,
        sensorData: sensorData,
        timestamp: new Date()
      });
      console.log(`📝 Thêm lịch sử: door = ${command.door}`);
    }
    
    if (command.fan !== undefined) {
      historyEntries.push({
        roomId: roomId,
        action: 'fan',
        state: command.fan === 1 || command.fan === true ? 1 : 0,
        sensorData: sensorData,
        timestamp: new Date()
      });
      console.log(`📝 Thêm lịch sử: fan = ${command.fan}`);
    }
    
    // Lưu tất cả các hành động vào database
    if (historyEntries.length > 0) {
      const result = await History.insertMany(historyEntries);
      console.log(`✅ Đã ghi ${historyEntries.length} lệnh điều khiển vào lịch sử cho phòng ${roomId}`);
      console.log(`✅ Kết quả:`, result.map(r => ({ id: r._id, action: r.action, state: r.state })));
    } else {
      console.log(`⚠️  Không có hành động nào để ghi lịch sử cho phòng ${roomId}`);
    }
    
  } catch (error) {
    console.error(`❌ Lỗi ghi lệnh điều khiển:`, error);
    console.error(`❌ Error stack:`, error.stack);
    throw error; // Throw để caller biết có lỗi
  }
}

module.exports = {
  handleMqttMessage,
  recordControlCommand,
  getFromCache // Export để router có thể sử dụng
};

