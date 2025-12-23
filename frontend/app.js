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
