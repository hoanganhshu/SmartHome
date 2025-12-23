// ===================== VOICE ROUTER =====================
// API endpoints cho Feature 8: Tích hợp với Smart Home (Alexa/Google Home)
// Cung cấp API để các virtual assistant có thể điều khiển thiết bị bằng giọng nói

const express = require('express');
const Room = require('../models/Room');
const { recordControlCommand } = require('../mqtt');
const router = express.Router();

// POST /voice/command - Nhận lệnh từ Alexa/Google Home
// Body: { 
//   room: "P101", 
//   intent: "turn_on_light" hoặc "open_door", "set_temperature", etc.
//   parameters: { value: 25 } (tùy chọn)
// }
router.post('/command', async (req, res) => {
  try {
    const { room, intent, parameters } = req.body;
    
    if (!room || !intent) {
      return res.status(400).json({ error: 'Thiếu thông tin room hoặc intent' });
    }
    
    // Kiểm tra phòng có tồn tại không (không bắt buộc nếu MongoDB chưa kết nối)
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const roomData = await Room.findOne({ roomId: room });
      // Nếu không tìm thấy, vẫn cho phép gửi lệnh (có thể phòng chưa có trong DB)
    }
    
    // Chuyển đổi intent thành lệnh MQTT
    let command = {};
    
    switch (intent) {
      case 'turn_on_light':
      case 'bật_đèn':
        command = { light: 1 };
        break;
        
      case 'turn_off_light':
      case 'tắt_đèn':
        command = { light: 0 };
        break;
        
      case 'open_door':
      case 'mở_cửa':
        command = { door: 1 };
        break;
        
      case 'close_door':
      case 'đóng_cửa':
        command = { door: 0 };
        break;
        
      case 'turn_on_fan':
      case 'bật_quạt':
        command = { fan: 1 };
        break;
        
      case 'turn_off_fan':
      case 'tắt_quạt':
        command = { fan: 0 };
        break;
        
      case 'set_temperature':
      case 'đặt_nhiệt_độ':
        if (parameters && parameters.value) {
          command = { temperature: parameters.value };
        } else {
          return res.status(400).json({ error: 'Thiếu giá trị nhiệt độ' });
        }
        break;
        
      default:
        return res.status(400).json({ error: `Intent không được hỗ trợ: ${intent}` });
    }
    
    // Gửi lệnh qua MQTT
    const mqttClient = req.app.locals.mqttClient;
    const topic = `room/${room}/cmd`;
    const message = JSON.stringify(command);
    
    mqttClient.publish(topic, message, (err) => {
      if (err) {
        console.error('❌ Lỗi gửi MQTT:', err);
        return res.status(500).json({ error: 'Lỗi gửi lệnh điều khiển' });
      }
      
      // Ghi lại lệnh điều khiển bằng giọng nói vào lịch sử
      recordControlCommand(room, { ...command, source: 'voice', intent: intent });
      
      console.log(`🎤 Lệnh giọng nói: ${intent} -> ${topic}: ${message}`);
      res.json({ 
        success: true, 
        message: `Đã thực hiện lệnh "${intent}" cho phòng ${room}`,
        command: command,
        room: room
      });
    });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý lệnh giọng nói:', error);
    res.status(500).json({ error: 'Lỗi xử lý lệnh giọng nói' });
  }
});

// GET /voice/status/:roomId - Lấy trạng thái phòng (cho Alexa/Google Home query)
router.get('/status/:roomId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { roomId } = req.params;
    
    let room;
    if (mongoose.connection.readyState === 1) {
      room = await Room.findOne({ roomId: roomId });
    }
    
    // Nếu không tìm thấy hoặc MongoDB chưa kết nối, trả về dữ liệu mặc định
    if (!room) {
      return res.json({
        roomId: roomId,
        status: {
          light: 'OFF',
          door: 'CLOSED',
          fan: 'OFF',
          temperature: 0,
          humidity: 0,
          people: 0
        },
        lastUpdate: new Date()
      });
    }
    
    // Format response cho virtual assistant
    res.json({
      roomId: room.roomId,
      status: {
        light: room.lightState ? 'ON' : 'OFF',
        door: room.doorState ? 'OPEN' : 'CLOSED',
        fan: room.fanState ? 'ON' : 'OFF',
        temperature: room.temperature,
        humidity: room.humidity,
        people: room.people
      },
      lastUpdate: room.lastUpdate
    });
  } catch (error) {
    console.error('❌ Lỗi lấy trạng thái:', error.message);
    res.status(500).json({ error: 'Lỗi lấy trạng thái' });
  }
});

// GET /voice/rooms - Lấy danh sách phòng (cho Alexa/Google Home discovery)
router.get('/rooms', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // Danh sách phòng mặc định
    const defaultRooms = ['P101', 'P102', 'P103'];
    
    if (mongoose.connection.readyState === 1) {
      const rooms = await Room.find({})
        .select('roomId')
        .sort({ roomId: 1 });
      
      if (rooms.length > 0) {
        return res.json({
          rooms: rooms.map(r => r.roomId),
          count: rooms.length
        });
      }
    }
    
    // Trả về danh sách mặc định nếu MongoDB chưa kết nối hoặc chưa có dữ liệu
    res.json({
      rooms: defaultRooms,
      count: defaultRooms.length
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách phòng:', error.message);
    res.status(500).json({ error: 'Lỗi lấy danh sách phòng' });
  }
});

module.exports = router;

