// ===================== CHAT ROUTER =====================
// API xử lý chat với AI để quản lý phòng và đưa ra cảnh báo

const express = require('express');
const Room = require('../models/Room');
const History = require('../models/History');
const router = express.Router();

// POST /chat/message - Xử lý tin nhắn chat với AI
router.post('/message', async (req, res) => {
  try {
    const { message, roomId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Thiếu tin nhắn' });
    }
    
    // Lấy thông tin phòng hiện tại
    const rooms = await getRoomsData();
    
    // Lấy thông tin phòng hiện tại từ MongoDB (nếu có)
    let currentRoomData = null;
    if (roomId) {
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          currentRoomData = await Room.findOne({ roomId });
        } else {
          // Nếu MongoDB chưa kết nối, lấy từ cache
          const { getFromCache } = require('../mqtt');
          currentRoomData = getFromCache(roomId);
        }
      } catch (error) {
        console.error('❌ Lỗi lấy currentRoomData:', error);
        // Lấy từ cache nếu MongoDB lỗi
        const { getFromCache } = require('../mqtt');
        currentRoomData = getFromCache(roomId);
      }
    }
    
    console.log('📥 Nhận chat message:', message);
    console.log('📊 Số phòng có dữ liệu:', rooms.length);
    console.log('📊 Current room:', roomId, currentRoomData ? 'có dữ liệu' : 'không có dữ liệu');
    
    // Xử lý với AI (sẽ tích hợp OpenAI hoặc AI khác)
    let aiResponse;
    try {
      aiResponse = await processAIQuery(message, rooms, currentRoomData);
    } catch (error) {
      console.error('❌ Lỗi processAIQuery:', error);
      aiResponse = {
        text: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
        warnings: []
      };
    }
    
    // Đảm bảo aiResponse luôn có cấu trúc đúng
    if (!aiResponse || typeof aiResponse !== 'object') {
      console.error('⚠️ aiResponse không hợp lệ:', aiResponse);
      aiResponse = {
        text: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn.",
        warnings: []
      };
    }
    
    // Đảm bảo response luôn có giá trị
    const responseText = aiResponse.text || aiResponse.response || "Xin lỗi, tôi chưa hiểu câu hỏi của bạn.";
    
    console.log('📤 Trả về response:', responseText.substring(0, 100));
    
    // Kiểm tra nếu AI muốn thực hiện lệnh điều khiển
    if (aiResponse.command) {
      // Gửi lệnh điều khiển
      const mqttClient = req.app.locals.mqttClient;
      const topic = `room/${aiResponse.command.room}/cmd`;
      mqttClient.publish(topic, JSON.stringify(aiResponse.command.action));
      console.log('✅ Đã gửi lệnh điều khiển:', topic);
    }
    
    // Đảm bảo responseText không phải là "undefined" string
    const finalResponse = (responseText && responseText !== "undefined" && responseText !== undefined) 
      ? String(responseText) 
      : "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn.";
    
    console.log('📤 Final response (length:', finalResponse.length, '):', finalResponse.substring(0, 100));
    
    res.json({
      response: finalResponse,
      command: aiResponse.command || null,
      warnings: aiResponse.warnings || []
    });
    
  } catch (error) {
    console.error('❌ Lỗi xử lý chat:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Trả về response hợp lệ ngay cả khi có lỗi (để frontend không bị lỗi)
    res.status(500).json({ 
      response: 'Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.',
      command: null,
      warnings: []
    });
  }
});

// Hàm lấy dữ liệu tất cả phòng
async function getRoomsData() {
  try {
    const mongoose = require('mongoose');
    const { getFromCache } = require('../mqtt');
    
    // Luôn ưu tiên lấy từ cache trước (dữ liệu real-time)
    const cachedRooms = [];
    ['P101', 'P102', 'P103'].forEach(roomId => {
      const cached = getFromCache(roomId);
      if (cached) {
        cachedRooms.push(cached);
      }
    });
    
    // Nếu có cache, trả về cache
    if (cachedRooms.length > 0) {
      console.log('📦 Lấy từ cache:', cachedRooms.length, 'phòng');
      return cachedRooms;
    }
    
    // Nếu không có cache, thử lấy từ MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const dbRooms = await Room.find({}).select('roomId people temperature humidity lightState doorState fanState lastUpdate');
        if (dbRooms.length > 0) {
          console.log('💾 Lấy từ MongoDB:', dbRooms.length, 'phòng');
          return dbRooms;
        }
      } catch (dbError) {
        console.error('❌ Lỗi query MongoDB:', dbError);
        // Tiếp tục trả về mảng rỗng nếu MongoDB lỗi
      }
    }
    
    console.log('⚠️ Không có dữ liệu từ cache và MongoDB');
    return [];
  } catch (error) {
    console.error('❌ Lỗi getRoomsData:', error);
    console.error('❌ Error stack:', error.stack);
    // Luôn trả về mảng rỗng thay vì throw error
    return [];
  }
}

// Hàm xử lý query với AI
async function processAIQuery(message, rooms, currentRoom) {
  const lowerMessage = message.toLowerCase();
  
  console.log('🤖 processAIQuery:', { message, roomsCount: rooms.length });
  
  // Phân tích ngữ cảnh
  const context = analyzeContext(message, rooms, currentRoom);
  console.log('🔍 Context:', context);
  
  // Xử lý các loại câu hỏi
  let result;
  try {
    if (context.isQuestion) {
      result = handleQuestion(message, context, rooms, currentRoom);
    } else if (context.isCommand) {
      result = handleCommand(message, context, rooms);
    } else if (context.isWarning) {
      result = handleWarning(context, rooms);
    } else {
      // Nếu không match được gì, trả về hướng dẫn
      result = {
        text: "Xin lỗi, tôi chưa hiểu. Bạn có thể hỏi:\n\n" +
              "📊 Thông tin: 'Thông tin phòng 101', 'Nhiệt độ phòng 102'\n" +
              "🔍 Phân tích: 'Phòng nào nóng nhất?', 'Tổng số người'\n" +
              "🎮 Điều khiển: 'Bật đèn phòng 101'\n" +
              "⚠️ Cảnh báo: 'Cảnh báo', 'Kiểm tra cảnh báo'",
        warnings: []
      };
    }
    
    // Đảm bảo result luôn có text
    if (!result || !result.text) {
      console.error('⚠️ Result không có text:', result);
      result = {
        text: "Xin lỗi, có lỗi xảy ra khi xử lý. Vui lòng thử lại.",
        warnings: []
      };
    }
    
    console.log('✅ Result:', { hasText: !!result.text, textLength: result.text?.length });
    return result;
    
  } catch (error) {
    console.error('❌ Lỗi trong processAIQuery:', error);
    return {
      text: "Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
      warnings: []
    };
  }
}

// Phân tích ngữ cảnh
function analyzeContext(message, rooms, currentRoom) {
  const lower = message.toLowerCase();
  
  return {
    isQuestion: /thông tin|trạng thái|nhiệt độ|độ ẩm|số người|hỏi|bao nhiêu|như thế nào|cho biết|tình trạng|phòng nào|nóng nhất|nhiều người nhất|tổng số|so sánh|cần bật/.test(lower),
    isCommand: /bật|tắt|mở|đóng|điều khiển|kiểm soát|chuyển/.test(lower),
    isWarning: /cảnh báo|nguy hiểm|bất thường|vấn đề|kiểm tra/.test(lower),
    mentionsRoom: /p101|p102|p103|phòng\s*\d{3}/.test(lower),
    mentionsDevice: /đèn|cửa|quạt|nhiệt độ|độ ẩm/.test(lower)
  };
}

// Xử lý câu hỏi
function handleQuestion(message, context, rooms, currentRoom) {
  const lower = message.toLowerCase();
  let response = "";
  const warnings = [];
  
  console.log('🔍 Xử lý câu hỏi:', { message, roomsCount: rooms.length, mentionsRoom: context.mentionsRoom });
  
  // Hỏi về thông tin phòng
  if (lower.includes('thông tin') || lower.includes('trạng thái') || lower.includes('tình trạng')) {
    if (context.mentionsRoom) {
      const roomMatch = message.match(/p(\d{3})|phòng\s*(\d{3})/i);
      const roomNum = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;
      const room = rooms.find(r => r.roomId === `P${roomNum}`);
      
      if (room) {
        response = `📊 Thông tin phòng P${roomNum}:\n\n`;
        response += `👥 Số người: ${room.people || 0}\n`;
        response += `🌡️ Nhiệt độ: ${room.temperature || 0}°C\n`;
        response += `💧 Độ ẩm: ${room.humidity || 0}%\n`;
        response += `💡 Đèn: ${room.lightState ? '✅ Bật' : '❌ Tắt'}\n`;
        response += `🚪 Cửa: ${room.doorState ? '✅ Mở' : '❌ Đóng'}\n`;
        response += `🌀 Quạt: ${room.fanState ? '✅ Bật' : '❌ Tắt'}`;
        
        // Cảnh báo
        if (room.temperature > 30) {
          warnings.push(`⚠️ Nhiệt độ phòng P${roomNum} cao: ${room.temperature}°C - Nên bật quạt hoặc điều hòa`);
        }
        if (room.humidity > 80) {
          warnings.push(`⚠️ Độ ẩm phòng P${roomNum} cao: ${room.humidity}% - Nên thông gió`);
        }
        if (room.people > 10) {
          warnings.push(`⚠️ Phòng P${roomNum} có quá nhiều người: ${room.people} người - Có thể quá tải`);
        }
        if (room.temperature < 18) {
          warnings.push(`❄️ Nhiệt độ phòng P${roomNum} thấp: ${room.temperature}°C - Nên tăng nhiệt`);
        }
      } else {
        response = `❌ Không tìm thấy dữ liệu phòng P${roomNum}. Phòng có thể chưa gửi dữ liệu hoặc chưa được khởi tạo.`;
      }
    } else {
      response = "📋 Danh sách các phòng:\n\n";
      if (rooms.length === 0) {
        response += "⚠️ Chưa có dữ liệu từ các phòng. Vui lòng đợi ESP32 gửi dữ liệu.";
      } else {
        rooms.forEach(room => {
          response += `🏠 ${room.roomId}:\n`;
          response += `   👥 ${room.people || 0} người | 🌡️ ${room.temperature || 0}°C | 💧 ${room.humidity || 0}%\n`;
          response += `   💡 ${room.lightState ? 'Bật' : 'Tắt'} | 🚪 ${room.doorState ? 'Mở' : 'Đóng'} | 🌀 ${room.fanState ? 'Bật' : 'Tắt'}\n\n`;
        });
      }
    }
  }
  // Hỏi về nhiệt độ
  else if (lower.includes('nhiệt độ')) {
    if (context.mentionsRoom) {
      const roomMatch = message.match(/p(\d{3})|phòng\s*(\d{3})/i);
      const roomNum = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;
      const room = rooms.find(r => r.roomId === `P${roomNum}`);
      if (room) {
        response = `🌡️ Nhiệt độ phòng P${roomNum}: ${room.temperature || 0}°C`;
        if (room.temperature > 30) {
          warnings.push(`⚠️ Nhiệt độ cao, nên bật quạt hoặc điều hòa`);
        } else if (room.temperature < 18) {
          warnings.push(`❄️ Nhiệt độ thấp, nên tăng nhiệt`);
        }
      } else {
        response = `❌ Không tìm thấy dữ liệu phòng P${roomNum}`;
      }
    } else {
      response = "🌡️ Nhiệt độ các phòng:\n\n";
      if (rooms.length === 0) {
        response += "⚠️ Chưa có dữ liệu từ các phòng.";
      } else {
        rooms.forEach(room => {
          response += `${room.roomId}: ${room.temperature || 0}°C\n`;
        });
      }
    }
  }
  // Hỏi về độ ẩm
  else if (lower.includes('độ ẩm')) {
    if (context.mentionsRoom) {
      const roomMatch = message.match(/p(\d{3})|phòng\s*(\d{3})/i);
      const roomNum = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;
      const room = rooms.find(r => r.roomId === `P${roomNum}`);
      if (room) {
        response = `💧 Độ ẩm phòng P${roomNum}: ${room.humidity || 0}%`;
        if (room.humidity > 80) {
          warnings.push(`⚠️ Độ ẩm cao, nên thông gió`);
        } else if (room.humidity < 30) {
          warnings.push(`💨 Độ ẩm thấp, nên tăng độ ẩm`);
        }
      } else {
        response = `❌ Không tìm thấy dữ liệu phòng P${roomNum}`;
      }
    } else {
      response = "💧 Độ ẩm các phòng:\n\n";
      if (rooms.length === 0) {
        response += "⚠️ Chưa có dữ liệu từ các phòng.";
      } else {
        rooms.forEach(room => {
          response += `${room.roomId}: ${room.humidity || 0}%\n`;
        });
      }
    }
  }
  // Hỏi về số người
  else if (lower.includes('số người') || lower.includes('người')) {
    if (context.mentionsRoom) {
      const roomMatch = message.match(/p(\d{3})|phòng\s*(\d{3})/i);
      const roomNum = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;
      const room = rooms.find(r => r.roomId === `P${roomNum}`);
      if (room) {
        response = `👥 Số người trong phòng P${roomNum}: ${room.people || 0} người`;
        if (room.people > 10) {
          warnings.push(`⚠️ Phòng có quá nhiều người, có thể quá tải`);
        }
      } else {
        response = `❌ Không tìm thấy dữ liệu phòng P${roomNum}`;
      }
    } else {
      response = "👥 Số người trong các phòng:\n\n";
      if (rooms.length === 0) {
        response += "⚠️ Chưa có dữ liệu từ các phòng.";
      } else {
        rooms.forEach(room => {
          response += `${room.roomId}: ${room.people || 0} người\n`;
        });
      }
    }
  }
  // Hỏi về phòng nào nóng nhất
  else if (lower.includes('nóng nhất') || lower.includes('nong nhat') || lower.includes('nhiệt độ cao nhất')) {
    if (rooms.length === 0) {
      response = "Chưa có dữ liệu từ các phòng.";
    } else {
      const sortedRooms = [...rooms].sort((a, b) => b.temperature - a.temperature);
      const hottestRoom = sortedRooms[0];
      response = `🌡️ Phòng ${hottestRoom.roomId} đang nóng nhất: ${hottestRoom.temperature}°C`;
      if (hottestRoom.temperature > 30) {
        warnings.push(`⚠️ Nhiệt độ cao, nên bật quạt hoặc điều hòa cho phòng ${hottestRoom.roomId}`);
      }
    }
  }
  // Hỏi về phòng nào có nhiều người nhất
  else if (lower.includes('nhiều người nhất') || lower.includes('nhieu nguoi nhat') || lower.includes('đông nhất')) {
    if (rooms.length === 0) {
      response = "Chưa có dữ liệu từ các phòng.";
    } else {
      const sortedRooms = [...rooms].sort((a, b) => b.people - a.people);
      const crowdedRoom = sortedRooms[0];
      response = `👥 Phòng ${crowdedRoom.roomId} có nhiều người nhất: ${crowdedRoom.people} người`;
      if (crowdedRoom.people > 10) {
        warnings.push(`⚠️ Phòng ${crowdedRoom.roomId} có quá nhiều người, có thể quá tải`);
      }
    }
  }
  // Tổng số người
  else if (lower.includes('tổng số người') || lower.includes('tong so nguoi') || lower.includes('tất cả người')) {
    if (rooms.length === 0) {
      response = "Chưa có dữ liệu từ các phòng.";
    } else {
      const totalPeople = rooms.reduce((sum, room) => sum + (room.people || 0), 0);
      response = `👥 Tổng số người trong tất cả các phòng: ${totalPeople} người`;
    }
  }
  // Phòng nào cần bật quạt
  else if (lower.includes('cần bật quạt') || lower.includes('can bat quat') || lower.includes('nên bật quạt')) {
    if (rooms.length === 0) {
      response = "Chưa có dữ liệu từ các phòng.";
    } else {
      const needFan = rooms.filter(r => r.temperature > 28 && !r.fanState);
      if (needFan.length === 0) {
        response = "✅ Tất cả các phòng đều ổn, không cần bật quạt thêm.";
      } else {
        response = `🌀 Các phòng nên bật quạt:\n`;
        needFan.forEach(room => {
          response += `• ${room.roomId}: ${room.temperature}°C (nhiệt độ cao)\n`;
        });
      }
    }
  }
  // So sánh phòng
  else if (lower.includes('so sánh') || lower.includes('so sanh') || lower.includes('khác nhau')) {
    if (rooms.length < 2) {
      response = "Cần ít nhất 2 phòng để so sánh.";
    } else {
      response = "📊 So sánh các phòng:\n\n";
      rooms.forEach(room => {
        response += `${room.roomId}:\n`;
        response += `  👥 ${room.people || 0} người | 🌡️ ${room.temperature || 0}°C | 💧 ${room.humidity || 0}%\n`;
      });
    }
  }
  // Câu hỏi chung
  else {
    response = "Tôi có thể giúp bạn:\n\n";
    response += "📊 Thông tin:\n";
    response += "• Thông tin phòng 101\n";
    response += "• Nhiệt độ phòng 102\n";
    response += "• Số người phòng 103\n\n";
    response += "🔍 Phân tích:\n";
    response += "• Phòng nào nóng nhất?\n";
    response += "• Phòng nào có nhiều người nhất?\n";
    response += "• Tổng số người\n";
    response += "• Phòng nào cần bật quạt?\n\n";
    response += "🎮 Điều khiển:\n";
    response += "• Bật đèn phòng 101\n";
    response += "• Tắt quạt phòng 102\n\n";
    response += "⚠️ Cảnh báo:\n";
    response += "• Cảnh báo\n";
    response += "• Kiểm tra cảnh báo";
  }
  
  // Đảm bảo response luôn có giá trị
  if (!response || response.trim() === "") {
    response = "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Bạn có thể hỏi:\n" +
               "• Thông tin phòng 101\n" +
               "• Nhiệt độ phòng 102\n" +
               "• Phòng nào nóng nhất?\n" +
               "• Cảnh báo";
  }
  
  console.log('✅ Trả về response:', response.substring(0, 50) + '...');
  return { text: response, warnings: warnings || [] };
}

// Xử lý lệnh điều khiển
function handleCommand(message, context, rooms) {
  const lower = message.toLowerCase();
  const roomMatch = message.match(/p(\d{3})|phòng\s*(\d{3})/i);
  const roomNum = roomMatch ? (roomMatch[1] || roomMatch[2]) : null;
  const targetRoom = roomNum ? `P${roomNum}` : null;
  
  let device = null;
  let action = null;
  
  if (lower.includes('đèn') || lower.includes('den')) {
    device = 'light';
    if (lower.includes('bật') || lower.includes('bat')) {
      action = 1;
    } else if (lower.includes('tắt') || lower.includes('tat')) {
      action = 0;
    }
  } else if (lower.includes('cửa') || lower.includes('cua')) {
    device = 'door';
    if (lower.includes('mở') || lower.includes('mo')) {
      action = 1;
    } else if (lower.includes('đóng') || lower.includes('dong')) {
      action = 0;
    }
  } else if (lower.includes('quạt') || lower.includes('quat')) {
    device = 'fan';
    if (lower.includes('bật') || lower.includes('bat')) {
      action = 1;
    } else if (lower.includes('tắt') || lower.includes('tat')) {
      action = 0;
    }
  }
  
  if (device !== null && targetRoom) {
    const deviceName = device === 'light' ? 'đèn' : device === 'door' ? 'cửa' : 'quạt';
    const actionText = action === 1 ? 'bật' : device === 'door' ? (action === 1 ? 'mở' : 'đóng') : 'tắt';
    
    return {
      text: `✅ Đã ${actionText} ${deviceName} phòng ${targetRoom}`,
      command: {
        room: targetRoom,
        action: { [device]: action }
      }
    };
  }
  
  // Nếu không có phòng, dùng phòng đầu tiên có dữ liệu
  if (device !== null && !targetRoom && rooms.length > 0) {
    const deviceName = device === 'light' ? 'đèn' : device === 'door' ? 'cửa' : 'quạt';
    const actionText = action === 1 ? 'bật' : device === 'door' ? (action === 1 ? 'mở' : 'đóng') : 'tắt';
    const defaultRoom = rooms[0].roomId;
    
    return {
      text: `✅ Đã ${actionText} ${deviceName} phòng ${defaultRoom} (phòng mặc định)`,
      command: {
        room: defaultRoom,
        action: { [device]: action }
      }
    };
  }
  
  return { 
    text: "Tôi không hiểu lệnh. Vui lòng nói rõ:\n" +
          "• Bật/tắt đèn/cửa/quạt phòng 101\n" +
          "• Mở/đóng cửa phòng 102\n" +
          "• Bật quạt phòng 103",
    warnings: []
  };
}

// Xử lý cảnh báo
function handleWarning(context, rooms) {
  const warnings = [];
  
  if (rooms.length === 0) {
    return { text: "⚠️ Chưa có dữ liệu từ các phòng để kiểm tra cảnh báo.", warnings: [] };
  }
  
  rooms.forEach(room => {
    if (room.temperature > 30) {
      warnings.push(`🌡️ Nhiệt độ phòng ${room.roomId} cao: ${room.temperature}°C - Nên bật quạt hoặc điều hòa`);
    }
    if (room.humidity > 80) {
      warnings.push(`💧 Độ ẩm phòng ${room.roomId} cao: ${room.humidity}% - Nên thông gió`);
    }
    if (room.people > 10) {
      warnings.push(`👥 Phòng ${room.roomId} có quá nhiều người: ${room.people} người - Có thể quá tải`);
    }
    if (room.temperature < 18) {
      warnings.push(`❄️ Nhiệt độ phòng ${room.roomId} thấp: ${room.temperature}°C - Nên tăng nhiệt`);
    }
  });
  
  if (warnings.length === 0) {
    return { text: "✅ Không có cảnh báo nào. Tất cả các phòng đều hoạt động bình thường.", warnings: [] };
  }
  
  return {
    text: `⚠️ Có ${warnings.length} cảnh báo:\n\n${warnings.join('\n')}`,
    warnings
  };
}

module.exports = router;

