// ===================== HISTORY ROUTER =====================
// API endpoints cho Feature 7: Theo dõi thời gian và lịch sử sử dụng thiết bị

const express = require('express');
const History = require('../models/History');
const router = express.Router();

// GET /history/:roomId - Lấy lịch sử sử dụng thiết bị của một phòng
// Ví dụ: GET /history/P101
router.get('/:roomId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // Nếu MongoDB chưa kết nối, trả về mảng rỗng
      return res.json([]);
    }
    
    const { roomId } = req.params;
    const { limit = 100, action } = req.query; // limit: số lượng bản ghi, action: lọc theo loại hành động
    
    // Xây dựng query
    const query = { roomId: roomId };
    if (action) {
      query.action = action; // Lọc theo loại hành động (light, door, fan, motion)
    }
    
    // Lấy lịch sử, sắp xếp theo thời gian mới nhất trước
    const history = await History.find(query)
      .sort({ timestamp: -1 }) // Sắp xếp giảm dần (mới nhất trước)
      .limit(parseInt(limit))
      .select('action state sensorData timestamp'); // Chỉ lấy các trường cần thiết
    
    res.json(history);
  } catch (error) {
    console.error('❌ Lỗi lấy lịch sử:', error.message);
    res.status(500).json({ error: 'Lỗi lấy lịch sử' });
  }
});

// GET /history/:roomId/stats - Lấy thống kê sử dụng thiết bị
// Ví dụ: GET /history/P101/stats?days=7
router.get('/:roomId/stats', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // Nếu MongoDB chưa kết nối, trả về mảng rỗng
      return res.json([]);
    }
    
    const { roomId } = req.params;
    const days = parseInt(req.query.days) || 7; // Mặc định 7 ngày
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Thống kê theo loại hành động
    const stats = await History.aggregate([
      {
        $match: {
          roomId: roomId,
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          lastTime: { $max: '$timestamp' }
        }
      }
    ]);
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Lỗi lấy thống kê:', error.message);
    res.status(500).json({ error: 'Lỗi lấy thống kê' });
  }
});

// DELETE /history/:roomId - Xóa lịch sử của một phòng (tùy chọn)
router.delete('/:roomId', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB chưa kết nối' });
    }
    
    const { roomId } = req.params;
    await History.deleteMany({ roomId: roomId });
    res.json({ message: `Đã xóa lịch sử của phòng ${roomId}` });
  } catch (error) {
    console.error('❌ Lỗi xóa lịch sử:', error.message);
    res.status(500).json({ error: 'Lỗi xóa lịch sử' });
  }
});

module.exports = router;

