// ===================== FRONTEND JAVASCRIPT =====================
// Xử lý giao diện, gọi API, và cập nhật real-time

const API_BASE = 'http://localhost:3000';
let currentRoom = 'P101'; // Phòng được chọn hiện tại
let updateInterval = null; // Interval để cập nhật dữ liệu định kỳ

// ===================== INITIALIZATION =====================
// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
    selectRoom('P101'); // Mặc định chọn phòng P101
    loadHistory(); // Tải lịch sử ban đầu
    
    // Cập nhật dữ liệu mỗi 2 giây
    updateInterval = setInterval(() => {
        loadRoomData();
    }, 2000);
});

// ===================== ROOM SELECTION =====================
// Chọn phòng để xem thông tin và điều khiển
function selectRoom(roomId) {
    currentRoom = roomId;
    
    // Cập nhật UI: đánh dấu phòng được chọn
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.room === roomId) {
            btn.classList.add('active');
        }
    });
    
    // Cập nhật tên phòng hiển thị
    document.getElementById('currentRoom').textContent = roomId;
    
    // Tải dữ liệu phòng mới
    loadRoomData();
    loadHistory();
}

// ===================== LOAD ROOM DATA =====================
// Tải thông tin phòng từ API
async function loadRoomData() {
    try {
        const response = await fetch(`${API_BASE}/rooms/${currentRoom}`);
        if (!response.ok) {
            throw new Error('Không thể tải dữ liệu phòng');
        }
        
        const data = await response.json();
        console.log('📥 Room data received:', data);
        
        // Kiểm tra nếu có dữ liệu
        if (data && Object.keys(data).length > 0) {
            // Cập nhật thông tin lên giao diện
            document.getElementById('people').textContent = data.people !== undefined ? data.people : 0;
            document.getElementById('temperature').textContent = `${data.temperature !== undefined ? data.temperature : 0}°C`;
            document.getElementById('humidity').textContent = `${data.humidity !== undefined ? data.humidity : 0}%`;
            document.getElementById('lightState').textContent = data.lightState ? 'ON' : 'OFF';
            document.getElementById('doorState').textContent = data.doorState ? 'OPEN' : 'CLOSED';
            
            // Cập nhật màu sắc cho trạng thái
            const lightEl = document.getElementById('lightState');
            const doorEl = document.getElementById('doorState');
            lightEl.style.color = data.lightState ? '#28a745' : '#dc3545';
            doorEl.style.color = data.doorState ? '#28a745' : '#dc3545';
        } else {
            console.warn('⚠️ Không có dữ liệu phòng:', currentRoom);
            // Hiển thị "--" nếu không có dữ liệu
            document.getElementById('people').textContent = '--';
            document.getElementById('temperature').textContent = '--';
            document.getElementById('humidity').textContent = '--';
            document.getElementById('lightState').textContent = '--';
            document.getElementById('doorState').textContent = '--';
        }
        
    } catch (error) {
        console.error('❌ Lỗi tải dữ liệu phòng:', error);
        console.error('❌ Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        
        // Hiển thị lỗi trên UI
        document.getElementById('people').textContent = 'Error';
        document.getElementById('temperature').textContent = 'Error';
        document.getElementById('humidity').textContent = 'Error';
        
        // Chỉ hiển thị notification nếu lỗi thực sự
        if (error.message && !error.message.includes('JSON')) {
            showNotification('Không thể tải dữ liệu. Kiểm tra kết nối server.', 'error');
        }
    }
}

// ===================== CONTROL DEVICE =====================
// Gửi lệnh điều khiển thiết bị (đèn, cửa, quạt)
async function controlDevice(device, value) {
    try {
        const command = {};
        command[device] = value; // Ví dụ: { light: 1 } hoặc { door: 0 }
        
        const response = await fetch(`${API_BASE}/rooms/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room: currentRoom,
                command: command
            })
        });
        
        if (!response.ok) {
            throw new Error('Không thể gửi lệnh điều khiển');
        }
        
        const result = await response.json();
        console.log('✅ Lệnh đã được gửi:', result);
        
        // Hiển thị thông báo thành công
        showNotification(`Đã ${value ? 'bật' : 'tắt'} ${getDeviceName(device)} phòng ${currentRoom}`, 'success');
        
        // Tải lại dữ liệu và lịch sử sau 1 giây
        setTimeout(() => {
            loadRoomData();
            loadHistory();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Lỗi gửi lệnh điều khiển:', error);
        showNotification('Lỗi gửi lệnh điều khiển', 'error');
    }
}

// ===================== LOAD HISTORY =====================
// Tải lịch sử sử dụng thiết bị (Feature 7: Theo dõi thời gian và lịch sử)
async function loadHistory() {
    try {
        const actionFilter = document.getElementById('historyActionFilter').value;
        let url = `${API_BASE}/history/${currentRoom}?limit=50`;
        
        // Thêm filter nếu có chọn
        if (actionFilter) {
            url += `&action=${actionFilter}`;
        }
        
        console.log('📥 Đang tải lịch sử từ:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const history = await response.json();
        console.log('📥 Nhận được lịch sử:', history.length, 'bản ghi');
        
        displayHistory(history);
        
    } catch (error) {
        console.error('❌ Lỗi tải lịch sử:', error);
        document.getElementById('historyList').innerHTML = 
            '<p class="loading">❌ Lỗi tải lịch sử: ' + error.message + '<br><small>Vui lòng kiểm tra kết nối MongoDB và thử lại.</small></p>';
    }
}

// ===================== DISPLAY HISTORY =====================
// Hiển thị lịch sử lên giao diện
function displayHistory(history) {
    const historyList = document.getElementById('historyList');
    
    if (!history || history.length === 0) {
        historyList.innerHTML = '<p class="loading">📭 Chưa có lịch sử sử dụng thiết bị.<br><small>Lịch sử sẽ được ghi lại khi bạn điều khiển thiết bị hoặc khi ESP32 gửi dữ liệu.<br><br>⚠️ <strong>Lưu ý:</strong> Để lưu lịch sử, bạn cần khởi động MongoDB. Nếu MongoDB chưa chạy, lịch sử sẽ không được lưu.</small></p>';
        return;
    }
    
    historyList.innerHTML = history.map(item => {
        const time = new Date(item.timestamp).toLocaleString('vi-VN');
        const actionName = getActionName(item.action);
        const stateText = getStateText(item.action, item.state);
        
        // Hiển thị thông tin cảm biến nếu có
        let sensorInfo = '';
        if (item.sensorData) {
            const sensors = [];
            if (item.sensorData.people !== undefined) sensors.push(`👥 ${item.sensorData.people}`);
            if (item.sensorData.temp !== undefined) sensors.push(`🌡️ ${item.sensorData.temp}°C`);
            if (item.sensorData.humidity !== undefined) sensors.push(`💧 ${item.sensorData.humidity}%`);
            if (sensors.length > 0) {
                sensorInfo = `<div style="margin-top: 5px; font-size: 0.9em; color: #6c757d;">${sensors.join(' | ')}</div>`;
            }
        }
        
        return `
            <div class="history-item">
                <div class="time">🕐 ${time}</div>
                <div class="action">
                    <span class="action-type">${actionName}</span>
                    ${stateText}
                </div>
                ${sensorInfo}
            </div>
        `;
    }).join('');
}

// ===================== HELPER FUNCTIONS =====================
// Các hàm hỗ trợ

// Lấy tên thiết bị bằng tiếng Việt
function getDeviceName(device) {
    const names = {
        'light': 'đèn',
        'door': 'cửa',
        'fan': 'quạt'
    };
    return names[device] || device;
}

// Lấy tên hành động bằng tiếng Việt
function getActionName(action) {
    const names = {
        'light': '💡 Đèn',
        'door': '🚪 Cửa',
        'fan': '🌀 Quạt',
        'motion': '👁️ Chuyển Động',
        'control': '🎮 Điều Khiển'
    };
    return names[action] || action;
}

// Lấy mô tả trạng thái
function getStateText(action, state) {
    if (typeof state === 'boolean' || typeof state === 'number') {
        const isOn = state === true || state === 1;
        if (action === 'light') {
            return isOn ? '✅ Bật' : '❌ Tắt';
        } else if (action === 'door') {
            return isOn ? '✅ Mở' : '❌ Đóng';
        } else if (action === 'fan') {
            return isOn ? '✅ Bật' : '❌ Tắt';
        } else if (action === 'motion') {
            return isOn ? '✅ Phát Hiện' : '❌ Không Phát Hiện';
        }
    }
    
    // Nếu là object (lệnh điều khiển)
    if (typeof state === 'object') {
        return JSON.stringify(state);
    }
    
    return state;
}

// Hiển thị thông báo
function showNotification(message, type = 'info') {
    // Tạo element thông báo
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Tự động xóa sau 3 giây
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Thêm CSS animation cho thông báo
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ===================== VOICE CONTROL =====================
// Tích hợp AI điều khiển bằng giọng nói

let recognition = null;
let isListening = false;

// Kiểm tra trình duyệt có hỗ trợ Speech Recognition không
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        document.getElementById('voiceStatus').textContent = '❌ Trình duyệt không hỗ trợ nhận diện giọng nói';
        document.getElementById('voiceStatus').className = 'voice-status error';
        document.getElementById('voiceBtn').disabled = true;
        return false;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN'; // Tiếng Việt
    recognition.continuous = false; // Dừng sau khi nói xong
    recognition.interimResults = false; // Chỉ trả về kết quả cuối cùng
    
    recognition.onstart = () => {
        isListening = true;
        document.getElementById('voiceBtn').classList.add('listening');
        document.getElementById('voiceIcon').textContent = '🔴';
        document.getElementById('voiceText').textContent = 'Đang nghe...';
        document.getElementById('voiceStatus').textContent = '🎤 Đang nghe... Hãy nói lệnh của bạn';
        document.getElementById('voiceStatus').className = 'voice-status listening';
    };
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        console.log('🎤 Nhận diện được:', transcript);
        
        document.getElementById('voiceStatus').textContent = `📝 Đã nghe: "${transcript}"`;
        document.getElementById('voiceStatus').className = 'voice-status processing';
        
        // Xử lý lệnh giọng nói
        processVoiceCommand(transcript);
    };
    
    recognition.onerror = (event) => {
        console.error('❌ Lỗi nhận diện giọng nói:', event.error);
        isListening = false;
        document.getElementById('voiceBtn').classList.remove('listening');
        document.getElementById('voiceIcon').textContent = '🎤';
        document.getElementById('voiceText').textContent = 'Bấm để nói';
        
        let errorMsg = '❌ Lỗi nhận diện giọng nói';
        if (event.error === 'no-speech') {
            errorMsg = '⚠️ Không nghe thấy giọng nói. Vui lòng thử lại.';
        } else if (event.error === 'network') {
            errorMsg = '❌ Lỗi kết nối. Vui lòng kiểm tra internet.';
        }
        
        document.getElementById('voiceStatus').textContent = errorMsg;
        document.getElementById('voiceStatus').className = 'voice-status error';
    };
    
    recognition.onend = () => {
        isListening = false;
        document.getElementById('voiceBtn').classList.remove('listening');
        document.getElementById('voiceIcon').textContent = '🎤';
        document.getElementById('voiceText').textContent = 'Bấm để nói';
    };
    
    return true;
}

// Xử lý lệnh giọng nói với AI
async function processVoiceCommand(transcript) {
    console.log('🎤 Nhận diện được:', transcript);
    
    document.getElementById('voiceStatus').textContent = `📝 Đã nghe: "${transcript}"`;
    document.getElementById('voiceStatus').className = 'voice-status processing';
    
    try {
        // Gửi đến AI để xử lý
        const response = await fetch(`${API_BASE}/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: transcript,
                roomId: currentRoom
            })
        });
        
        const data = await response.json();
        
        const aiResponse = data.response || data.text || "Đã xử lý lệnh";
        document.getElementById('voiceStatus').textContent = aiResponse;
        document.getElementById('voiceStatus').className = 'voice-status success';
        
        // Hiển thị cảnh báo nếu có
        if (data.warnings && data.warnings.length > 0) {
            data.warnings.forEach(warning => {
                showNotification(warning, 'error');
            });
        }
        
        // Thực thi lệnh nếu có
        if (data.command) {
            const device = Object.keys(data.command.action)[0];
            const action = Object.values(data.command.action)[0];
            
            // Nếu đổi phòng, chọn phòng mới trước
            if (data.command.room !== currentRoom) {
                selectRoom(data.command.room);
                setTimeout(() => {
                    controlDevice(device, action);
                }, 500);
            } else {
                controlDevice(device, action);
            }
            
            showNotification(`Đã thực hiện lệnh bằng giọng nói`, 'success');
        }
        
    } catch (error) {
        console.error('❌ Lỗi xử lý lệnh giọng nói:', error);
        document.getElementById('voiceStatus').textContent = '❌ Lỗi xử lý lệnh. Vui lòng thử lại.';
        document.getElementById('voiceStatus').className = 'voice-status error';
    }
}

// Bật/tắt điều khiển bằng giọng nói
function toggleVoiceControl() {
    if (!recognition) {
        if (!initSpeechRecognition()) {
            return;
        }
    }
    
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error('❌ Lỗi khởi động recognition:', error);
            document.getElementById('voiceStatus').textContent = '❌ Lỗi khởi động. Vui lòng thử lại.';
            document.getElementById('voiceStatus').className = 'voice-status error';
        }
    }
}

// Khởi tạo Speech Recognition sau khi DOM sẵn sàng
setTimeout(() => {
    if (document.getElementById('voiceBtn')) {
        initSpeechRecognition();
    }
}, 500);

// ===================== AI CHAT =====================
let chatOpen = false;

function toggleChat() {
    chatOpen = !chatOpen;
    const chatContainer = document.getElementById('chatContainer');
    if (chatOpen) {
        chatContainer.classList.add('active');
        document.getElementById('chatInput').focus();
    } else {
        chatContainer.classList.remove('active');
    }
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Hiển thị tin nhắn của user
    addChatMessage(message, 'user');
    input.value = '';
    
    // Hiển thị "đang suy nghĩ"
    const thinkingId = addChatMessage('🤔 Đang xử lý...', 'bot');
    
    // Gửi đến AI
    try {
        const response = await fetch(`${API_BASE}/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
    body: JSON.stringify({
                message: message,
                roomId: currentRoom
    })
  });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📥 Nhận data từ API:', data);
        
        // Xóa "đang suy nghĩ"
        removeChatMessage(thinkingId);
        
        // Hiển thị phản hồi từ AI (đảm bảo có giá trị)
        let aiResponse = null;
        
        if (data && typeof data === 'object') {
          aiResponse = data.response || data.text || data.message;
        }
        
        if (!aiResponse || aiResponse === "undefined" || aiResponse === undefined || aiResponse === null || aiResponse === "") {
          console.error('❌ Response không hợp lệ:', data);
          addChatMessage("Xin lỗi, có lỗi xảy ra khi nhận phản hồi từ AI. Vui lòng thử lại.", 'bot');
        } else {
          console.log('✅ Hiển thị response');
          addChatMessage(String(aiResponse), 'bot');
        }
        
        // Hiển thị cảnh báo nếu có
        if (data.warnings && data.warnings.length > 0) {
            data.warnings.forEach(warning => {
                addChatMessage(`⚠️ ${warning}`, 'bot');
            });
        }
        
        // Nếu có lệnh điều khiển, thực thi
        if (data.command) {
            setTimeout(() => {
                const device = Object.keys(data.command.action)[0];
                const action = Object.values(data.command.action)[0];
                controlDevice(device, action);
                // Tải lại dữ liệu sau khi điều khiển
                setTimeout(() => {
                    loadRoomData();
                    loadHistory();
                }, 1000);
            }, 500);
        }
        
    } catch (error) {
        console.error('❌ Lỗi chat:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            type: error.constructor.name
        });
        removeChatMessage(thinkingId);
        
        // Xử lý các loại lỗi khác nhau
        let errorMessage = '❌ Lỗi kết nối. ';
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('fetch'))) {
            errorMessage += 'Không thể kết nối đến server.\n\n';
            errorMessage += 'Vui lòng kiểm tra:\n';
            errorMessage += '• Backend server có đang chạy không (http://localhost:3000)\n';
            errorMessage += '• Kiểm tra kết nối internet\n';
            errorMessage += '• Thử làm mới trang (F5)';
        } else if (error.message && error.message.includes('JSON')) {
            errorMessage += 'Lỗi xử lý dữ liệu từ server.';
        } else {
            errorMessage += error.message || 'Vui lòng thử lại.';
        }
        
        removeChatMessage(thinkingId);
        addChatMessage(errorMessage, 'bot');
    }
}

function addChatMessage(text, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    messageDiv.id = messageId;
    messageDiv.className = `chat-message ${type}`;
    messageDiv.innerHTML = `<div class="message-content">${text}</div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageId;
}

function removeChatMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}
