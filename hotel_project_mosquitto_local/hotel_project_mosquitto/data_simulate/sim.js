const mqtt = require('mqtt');

// Đổi thành IP của Pi (nếu chạy trên Pi thì dùng 127.0.0.1)
const PI_MQTT_BROKER = 'mqtt://192.168.1.11:1883'; 

// Cấu hình danh sách phòng
const TOTAL_ROOMS = 192;              // 50 phòng giả lập
const REAL_ROOMS = ['0101', '0102']; // Bỏ qua phòng mạch thật
const INTERVAL_MS = 10000;           // 10s bắn 1 lần để tiết kiệm băng thông

const client = mqtt.connect(PI_MQTT_BROKER);

const random = (min, max, decimals = 1) => 
    parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// Lưu trữ điện tích lũy cho từng phòng ảo để tăng dần đều
const accumulatedEnergy = {};

function getRoomNumber(index) {
    const floor = Math.floor(index / 10) + 1;
    const room = (index % 10) + 1;
    return `${String(floor).padStart(2, '0')}${String(room).padStart(2, '0')}`;
}

client.on('connect', () => {
    console.log(`✅ Connected to Mosquitto on Pi (${PI_MQTT_BROKER})`);
    console.log(`🚀 Running simulation for virtual rooms. Press Ctrl + C to stop.\n`);

    setInterval(() => {
        let sentCount = 0;

        for (let i = 0; i < TOTAL_ROOMS; i++) {
            const roomNum = getRoomNumber(i);

            // Bỏ qua phòng thật để không đè dữ liệu của ESP
            if (REAL_ROOMS.includes(roomNum)) continue;

            // Khởi tạo hoặc cộng dồn điện năng tiêu thụ (tăng nhẹ 0.001 - 0.005 kWh)
            if (!accumulatedEnergy[roomNum]) accumulatedEnergy[roomNum] = random(15.0, 45.0, 2);
            accumulatedEnergy[roomNum] += random(0.001, 0.005, 4);

            const payload = {
                temp: random(23.5, 29.5),
                humidity: random(50.0, 75.0),
                co2: Math.round(random(420, 850, 0)),
                light: Math.round(random(30, 450, 0)),
                noise: random(28.0, 65.0),
                motion: Math.random() < 0.2 ? 1 : 0,
                smoke: 0.0,
                energy: parseFloat(accumulatedEnergy[roomNum].toFixed(4))
            };

            const topic = `hotel/room/${roomNum}/sensors`;
            client.publish(topic, JSON.stringify(payload), { qos: 0 });
            sentCount++;
        }

        const now = new Date().toLocaleTimeString();
        console.log(`[${now}] 📡 Pushed updated sensor metrics for ${sentCount} virtual rooms`);
    }, INTERVAL_MS);
});

client.on('error', (err) => {
    console.error('❌ MQTT Connection error:', err.message);
});