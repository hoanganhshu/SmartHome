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
        
        // Cập nhật thông tin lên giao diện
        document.getElementById('people').textContent = data.people || 0;
        document.getElementById('temperature').textContent = `${data.temperature || 0}°C`;
        document.getElementById('humidity').textContent = `${data.humidity || 0}%`;
        document.getElementById('lightState').textContent = data.lightState ? 'ON' : 'OFF';
        document.getElementById('doorState').textContent = data.doorState ? 'OPEN' : 'CLOSED';
        
        // Cập nhật màu sắc cho trạng thái
        const lightEl = document.getElementById('lightState');
        const doorEl = document.getElementById('doorState');
        lightEl.style.color = data.lightState ? '#28a745' : '#dc3545';
        doorEl.style.color = data.doorState ? '#28a745' : '#dc3545';
        
    } catch (error) {
        console.error('❌ Lỗi tải dữ liệu phòng:', error);
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
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Không thể tải lịch sử');
        }
        
        const history = await response.json();
        displayHistory(history);
        
    } catch (error) {
        console.error('❌ Lỗi tải lịch sử:', error);
        document.getElementById('historyList').innerHTML = 
            '<p class="loading">❌ Lỗi tải lịch sử</p>';
    }
}

// ===================== DISPLAY HISTORY =====================
// Hiển thị lịch sử lên giao diện
function displayHistory(history) {
    const historyList = document.getElementById('historyList');
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="loading">Chưa có lịch sử</p>';
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

// Xử lý lệnh giọng nói tiếng Việt
function processVoiceCommand(transcript) {
    // Chuẩn hóa text: loại bỏ dấu, chuyển thành chữ thường
    const normalized = transcript
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    
    console.log('🔍 Xử lý lệnh:', normalized);
    
    // Tìm phòng (P101, P102, P103)
    let targetRoom = currentRoom; // Mặc định là phòng đang chọn
    const roomMatch = normalized.match(/phong\s*(\d{3})|p\s*(\d{3})/);
    if (roomMatch) {
        const roomNum = roomMatch[1] || roomMatch[2];
        targetRoom = `P${roomNum}`;
    }
    
    // Tìm thiết bị và hành động
    let device = null;
    let action = null;
    
    // Đèn
    if (normalized.includes('den') || normalized.includes('đèn')) {
        device = 'light';
        if (normalized.includes('bat') || normalized.includes('bật')) {
            action = 1;
        } else if (normalized.includes('tat') || normalized.includes('tắt')) {
            action = 0;
        }
    }
    // Cửa
    else if (normalized.includes('cua') || normalized.includes('cửa')) {
        device = 'door';
        if (normalized.includes('mo') || normalized.includes('mở')) {
            action = 1;
        } else if (normalized.includes('dong') || normalized.includes('đóng')) {
            action = 0;
        }
    }
    // Quạt
    else if (normalized.includes('quat') || normalized.includes('quạt')) {
        device = 'fan';
        if (normalized.includes('bat') || normalized.includes('bật')) {
            action = 1;
        } else if (normalized.includes('tat') || normalized.includes('tắt')) {
            action = 0;
        }
    }
    
    // Thực thi lệnh
    if (device !== null && action !== null) {
        // Nếu đổi phòng, chọn phòng mới trước
        if (targetRoom !== currentRoom) {
            selectRoom(targetRoom);
            setTimeout(() => {
                controlDevice(device, action);
            }, 500);
        } else {
            controlDevice(device, action);
        }
        
        const actionText = action === 1 ? 
            (device === 'light' ? 'bật đèn' : device === 'door' ? 'mở cửa' : 'bật quạt') :
            (device === 'light' ? 'tắt đèn' : device === 'door' ? 'đóng cửa' : 'tắt quạt');
        
        document.getElementById('voiceStatus').textContent = `✅ Đã ${actionText} phòng ${targetRoom}`;
        document.getElementById('voiceStatus').className = 'voice-status success';
        
        showNotification(`Đã ${actionText} phòng ${targetRoom} bằng giọng nói`, 'success');
    } else {
        document.getElementById('voiceStatus').textContent = '⚠️ Không hiểu lệnh. Vui lòng thử lại với cú pháp: "Bật đèn phòng 101"';
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
