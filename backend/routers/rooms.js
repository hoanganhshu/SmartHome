// ===================== ROOMS ROUTER =====================
// API endpoints cho thông tin phòng và điều khiển thiết bị

const express = require('express');
const Room = require('../models/Room');
const { recordControlCommand } = require('../mqtt');
const router = express.Router();

// GET /rooms - Lấy danh sách tất cả các phòng
router.get('/', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // Nếu MongoDB chưa kết nối, trả về mảng rỗng
      return res.json([]);
    }
    
    const rooms = await Room.find({})
      .select('roomId people temperature humidity lightState doorState fanState lastUpdate')
      .sort({ roomId: 1 });
    
    res.json(rooms);
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách phòng:', error.message);
    res.status(500).json({ error: 'Lỗi lấy danh sách phòng' });
  }
});

// GET /rooms/:roomId - Lấy thông tin chi tiết một phòng
router.get('/:roomId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // Nếu MongoDB chưa kết nối, trả về dữ liệu mặc định
      return res.json({
        roomId: req.params.roomId,
        people: 0,
        temperature: 0,
        humidity: 0,
        lightState: false,
        doorState: false,
        fanState: false,
        lastUpdate: new Date()
      });
    }
    
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId: roomId });
    
    if (!room) {
      // Trả về dữ liệu mặc định nếu chưa có trong database
      return res.json({
        roomId: roomId,
        people: 0,
        temperature: 0,
        humidity: 0,
        lightState: false,
        doorState: false,
        fanState: false,
        lastUpdate: new Date()
      });
    }
    
    res.json(room);
  } catch (error) {
    console.error('❌ Lỗi lấy thông tin phòng:', error.message);
    res.status(500).json({ error: 'Lỗi lấy thông tin phòng' });
  }
});

// POST /rooms/control - Gửi lệnh điều khiển thiết bị
// Body: { room: "P101", command: { light: 1 } }
router.post('/control', async (req, res) => {
  try {
    const { room, command } = req.body;
    
    if (!room || !command) {
      return res.status(400).json({ error: 'Thiếu thông tin room hoặc command' });
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
      
      // Ghi lại lệnh điều khiển vào lịch sử (Feature 7)
      recordControlCommand(room, command);
      
      console.log(`✅ Đã gửi lệnh đến ${topic}: ${message}`);
      res.json({ 
        success: true, 
        message: `Đã gửi lệnh đến phòng ${room}`,
        command: command
      });
    });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý lệnh điều khiển:', error);
    res.status(500).json({ error: 'Lỗi xử lý lệnh điều khiển' });
  }
});

module.exports = router;

