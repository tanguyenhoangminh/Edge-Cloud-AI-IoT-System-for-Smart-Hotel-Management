import mysql.connector
import random
from datetime import datetime, timedelta
import hashlib

# ==========================================
# CẤU HÌNH KẾT NỐI MYSQL
# ==========================================
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'minhmongmo1',
    'database': 'iot_hotel'
}

def get_db_connection():
    return mysql.connector.connect(**db_config)

def generate_room_numbers():
    rooms = []
    for floor in range(1, 11):
        for room_idx in range(1, 21):
            room_number = f"{floor:02d}{room_idx:02d}"
            rooms.append(room_number)
    return rooms

# ==========================================
# 1. HÀM RANDOM TRẠNG THÁI VÀ LOẠI PHÒNG (FIXED: Không tự tạo phòng dơ/hỏng)
# ==========================================
def seed_rooms_directly():
    rooms = generate_room_numbers()
    conn = get_db_connection()
    cursor = conn.cursor()

    # CHỈ tạo phòng Trống hoặc Có khách. Việc Dơ/Hỏng sẽ do Staff quyết định sau.
    statuses = ['available', 'occupied']
    status_weights = [0.60, 0.40] 
    
    types = ['Standard', 'Single', 'Deluxe', 'Family', 'Executive', 'Suite']
    type_weights = [0.30, 0.25, 0.20, 0.15, 0.05, 0.05]

    print("\n🚀 BẮT ĐẦU SEED DỮ LIỆU PHÒNG TRỰC TIẾP VÀO MYSQL...")
    try:
        cursor.execute("SELECT type_id, type_name FROM room_type")
        type_map = {name: tid for (tid, name) in cursor.fetchall()}

        for room_no in rooms:
            new_status = random.choices(statuses, weights=status_weights, k=1)[0]
            if room_no.startswith("10"):
                selected_type = 'Suite'
            else:
                selected_type = random.choices(types, weights=type_weights, k=1)[0]
            
            type_id = type_map.get(selected_type)
            sql = "UPDATE room SET status = %s, type_id = %s WHERE room_number = %s"
            cursor.execute(sql, (new_status, type_id, room_no))

        conn.commit()
        print(f"✅ Thành công! Đã cập nhật trạng thái cho {len(rooms)} phòng.")
    except mysql.connector.Error as err:
        print(f"❌ Lỗi MySQL (Rooms): {err}")
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 2. HÀM RANDOM KHÁCH HÀNG (GUESTS)
# ==========================================
def seed_guests_directly():
    conn = get_db_connection()
    cursor = conn.cursor()

    first_names = ['Minh', 'Hoa', 'Tuan', 'Lan', 'John', 'Jane', 'Michael', 'Sarah', 'Akira', 'Yuki']
    last_names = ['Ta', 'Nguyen', 'Tran', 'Le', 'Pham', 'Smith', 'Johnson', 'Williams', 'Sato', 'Suzuki']
    nationalities = ['Vietnamese', 'American', 'British', 'Japanese', 'Korean', 'French']
    genders = ['Male', 'Female']

    print("\n🚀 ĐANG RESET BẢNG VÀ TẠO 100 KHÁCH HÀNG MỚI...")
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("TRUNCATE TABLE guest")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        insert_query = """
            INSERT INTO guest (first_name, last_name, email, phone, nationality, passport_no, gender, date_of_birth, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        guests_data = []
        start_date = datetime(2025, 1, 1)
        dob_start_date = datetime(1960, 1, 1)

        for _ in range(100):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}{random.randint(1000, 9999)}@email.com"
            phone = f"+84 {random.randint(100, 999)} {random.randint(1000, 9999)}"
            nat = random.choice(nationalities)
            passport_no = f"{chr(random.randint(65, 90))}{random.randint(1000000, 9999999)}"
            gen = random.choice(genders)
            
            random_dob_days = random.randint(0, 365 * 45)
            date_of_birth = (dob_start_date + timedelta(days=random_dob_days)).strftime('%Y-%m-%d')
            random_days = random.randint(0, 365)
            created_at = (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d %H:%M:%S')
            
            guests_data.append((fn, ln, email, phone, nat, passport_no, gen, date_of_birth, created_at))

        cursor.executemany(insert_query, guests_data)
        conn.commit()
        print(f"✅ Thành công! Đã thêm {cursor.rowcount} khách hàng vào database.")
    except mysql.connector.Error as err:
        print(f"❌ Lỗi MySQL: {err}")
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 3. HÀM TẠO BOOKING
# ==========================================
def seed_bookings_directly():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) 

    print("\n🚀 ĐANG KẾT NỐI KHÁCH HÀNG VÀO CÁC PHÒNG 'OCCUPIED'...")
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("TRUNCATE TABLE booking")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        cursor.execute("SELECT r.room_id, rt.base_price FROM room r JOIN room_type rt ON r.type_id = rt.type_id WHERE r.status = 'occupied'")
        occupied_rooms = cursor.fetchall()

        cursor.execute("SELECT guest_id FROM guest")
        guests = cursor.fetchall()

        if not guests or not occupied_rooms:
            return

        guest_ids = [g['guest_id'] for g in guests]
        booking_data = []

        for room in occupied_rooms:
            guest_id = random.choice(guest_ids)
            room_id = room['room_id']
            days_ago = random.randint(0, 3)
            check_in = datetime.now() - timedelta(days=days_ago)
            duration = random.randint(1, 5)
            check_out = check_in + timedelta(days=duration)
            pay_status = random.choices(['paid', 'unpaid', 'partially_paid'], weights=[0.6, 0.3, 0.1], k=1)[0]
            base_price = float(room['base_price'])
            total_price = base_price * duration

            booking_data.append((guest_id, room_id, check_in.strftime('%Y-%m-%d'), check_out.strftime('%Y-%m-%d'), 'checked_in', pay_status, total_price))

        insert_query = """
            INSERT INTO booking (guest_id, room_id, check_in_date, check_out_date, status, payment_status, total_price)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.executemany(insert_query, booking_data)
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        print(f"✅ Thành công! Đã tạo {cursor.rowcount} đơn đặt phòng cho các phòng Occupied.")
    except mysql.connector.Error as err:
        print(f"❌ Lỗi MySQL (Bookings): {err}")
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 4. HÀM RANDOM NHÂN VIÊN & GIAO VIỆC (ĐỒNG BỘ NGƯỢC VỀ PHÒNG)
# ==========================================
def seed_staff_and_tasks_directly():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) 

    print("\n🚀 ĐANG TẠO NHÂN VIÊN VÀ ĐỒNG BỘ CÔNG VIỆC CHUẨN XÁC...")
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        cursor.execute("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'iot_hotel' AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'staff_id'")
        staff_id_type = cursor.fetchone()['COLUMN_TYPE']
        
        cursor.execute("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'iot_hotel' AND TABLE_NAME = 'room' AND COLUMN_NAME = 'room_id'")
        room_id_type = cursor.fetchone()['COLUMN_TYPE']

        create_table_query = f"""
            CREATE TABLE IF NOT EXISTS staff_task (
                task_id INT AUTO_INCREMENT PRIMARY KEY,
                staff_id {staff_id_type} NOT NULL, 
                room_id {room_id_type} NOT NULL, 
                task_type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'In Progress',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_st_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
                CONSTRAINT fk_st_room FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """
        cursor.execute(create_table_query)
        
        cursor.execute("TRUNCATE TABLE staff_task")
        cursor.execute("TRUNCATE TABLE staff")
        cursor.execute("TRUNCATE TABLE role")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        # Nạp Role
        cursor.execute("INSERT INTO role (role_name, description) VALUES ('Housekeeping', 'Dọn dẹp vệ sinh'), ('Maintenance', 'Bảo trì thiết bị')")
        conn.commit()

        cursor.execute("SELECT role_id, role_name FROM role")
        roles = cursor.fetchall()
        hk_role_id = next((r['role_id'] for r in roles if r['role_name'] == 'Housekeeping'), 1)
        mt_role_id = next((r['role_id'] for r in roles if r['role_name'] == 'Maintenance'), 2)

        # Nạp 36 Staff
        first_names = ['An', 'Binh', 'Cuong', 'Dung', 'Em', 'Phong', 'Giang', 'Hoa', 'Tuan', 'Lan', 'John', 'Jane', 'Akira']
        last_names = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Smith', 'Sato']
        dummy_hash = hashlib.sha256(b"123456").hexdigest() 
        
        staff_data = []
        for i in range(36):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}{random.randint(100,9999)}@hotel.com"
            phone = f"09{random.randint(10000000, 99999999)}"
            role_id = random.choice([hk_role_id, mt_role_id])
            hire_date = (datetime.now() - timedelta(days=random.randint(10, 365))).strftime('%Y-%m-%d')
            staff_data.append((fn, ln, email, phone, role_id, dummy_hash, True, hire_date))
            
        cursor.executemany("""
            INSERT INTO staff (first_name, last_name, email, phone, role_id, password_hash, is_active, hire_date) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, staff_data)
        conn.commit()

        # =========================================================
        # CHIẾN LƯỢC ĐỒNG BỘ NGƯỢC: Lấy phòng trống ra giao việc
        # =========================================================
        cursor.execute("SELECT room_id FROM room WHERE status = 'available'")
        available_rooms = [r['room_id'] for r in cursor.fetchall()]
        
        cursor.execute("SELECT staff_id, role_id FROM staff")
        all_staff = cursor.fetchall()

        task_data = []
        room_updates = []
        
        # Xáo trộn các phòng trống để phân ngẫu nhiên
        random.shuffle(available_rooms)

        for staff in all_staff:
            # 50% cơ hội nhân viên này đang bận làm việc
            if random.random() < 0.50 and len(available_rooms) > 0:
                assigned_room_id = available_rooms.pop() # Rút 1 phòng trống ra để làm
                task_type = 'cleaning' if staff['role_id'] == hk_role_id else 'maintenance'
                
                # Tạo Task cho nhân viên
                task_data.append((staff['staff_id'], assigned_room_id, task_type, 'In Progress'))
                # Lên lịch cập nhật ngược trạng thái phòng
                room_updates.append((task_type, assigned_room_id))

        if task_data:
            # 1. Chèn Task vào database
            cursor.executemany("INSERT INTO staff_task (staff_id, room_id, task_type, status) VALUES (%s, %s, %s, %s)", task_data)
            
            # 2. Cập nhật phòng tương ứng thành cleaning/maintenance (Đồng bộ tuyệt đối)
            cursor.executemany("UPDATE room SET status = %s WHERE room_id = %s", room_updates)

        conn.commit()
        print(f"✅ Thành công! Đã tạo {len(task_data)} task công việc và đồng bộ ngược về trạng thái phòng 100%.")

    except mysql.connector.Error as err:
        print(f"❌ Lỗi MySQL (Staff/Task): {err}")
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 5. HÀM TẠO BẢNG VÀ RANDOM DỮ LIỆU IOT
# ==========================================
def seed_iot_data_directly():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    print("\n🚀 ĐANG KHỞI TẠO BẢNG TRẠNG THÁI IOT VÀ RANDOM DỮ LIỆU...")
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        cursor.execute("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'iot_hotel' AND TABLE_NAME = 'room' AND COLUMN_NAME = 'room_id'")
        room_result = cursor.fetchone()
        room_id_type = room_result['COLUMN_TYPE'] if room_result else "INT"

        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS room_iot_state (
                room_id {room_id_type} PRIMARY KEY,
                temp FLOAT DEFAULT 24.0,
                humidity FLOAT DEFAULT 50.0,
                smoke FLOAT DEFAULT 0.0,
                light FLOAT DEFAULT 300.0,
                energy FLOAT DEFAULT 0.0,
                motion BOOLEAN DEFAULT FALSE,
                door_open BOOLEAN DEFAULT FALSE,
                co2 FLOAT DEFAULT 400.0,
                leak_detected BOOLEAN DEFAULT FALSE,
                noise FLOAT DEFAULT 30.0,
                
                ac_power BOOLEAN DEFAULT FALSE,
                ac_temp INT DEFAULT 24,
                main_light BOOLEAN DEFAULT FALSE,
                bedside_lamp BOOLEAN DEFAULT FALSE,
                desk_lamp BOOLEAN DEFAULT FALSE,
                door_lock BOOLEAN DEFAULT TRUE,
                curtain BOOLEAN DEFAULT FALSE,
                fan BOOLEAN DEFAULT FALSE,
                tv BOOLEAN DEFAULT FALSE,
                siren BOOLEAN DEFAULT FALSE,
                sprinkler BOOLEAN DEFAULT FALSE,
                main_power BOOLEAN DEFAULT TRUE,
                
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_iot_room FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """)
        
        cursor.execute("TRUNCATE TABLE room_iot_state")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

        cursor.execute("SELECT room_id FROM room")
        rooms = cursor.fetchall()

        iot_data = []
        for r in rooms:
            room_id = r['room_id']
            temp = round(random.uniform(18.0, 30.0), 1)
            humidity = round(random.uniform(40.0, 75.0), 1)
            smoke = round(random.uniform(0.0, 15.0), 1)
            light = round(random.uniform(50.0, 500.0), 1)
            energy = round(random.uniform(10.0, 150.0), 1)
            motion = random.choice([True, False, False, False]) 
            door_open = random.choice([True, False, False]) 
            co2 = round(random.uniform(400.0, 800.0), 1)
            leak = random.choice([True, False, False, False, False]) 
            noise = round(random.uniform(30.0, 65.0), 1)
            
            ac_power = random.choice([True, False])
            ac_temp = random.randint(18, 28)
            main_light = random.choice([True, False])
            bedside_lamp = random.choice([True, False])
            desk_lamp = random.choice([True, False])
            door_lock = random.choice([True, False])
            curtain = random.choice([True, False])
            fan = random.choice([True, False])
            tv = random.choice([True, False])
            sprinkler = random.choice([True, False, False, False, False])
            siren = False 
            main_power = True

            iot_data.append((
                room_id, temp, humidity, smoke, light, energy, motion, door_open, co2, leak, noise,
                ac_power, ac_temp, main_light, bedside_lamp, desk_lamp, door_lock, curtain, fan, tv, siren, sprinkler, main_power
            ))

        insert_query = """
            INSERT INTO room_iot_state (
                room_id, temp, humidity, smoke, light, energy, motion, door_open, co2, leak_detected, noise,
                ac_power, ac_temp, main_light, bedside_lamp, desk_lamp, door_lock, curtain, fan, tv, siren, sprinkler, main_power
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.executemany(insert_query, iot_data)
        conn.commit()
        
        print(f"✅ Thành công! Đã seed dữ liệu IoT cho {len(iot_data)} phòng.")

    except mysql.connector.Error as err:
        print(f"❌ Lỗi MySQL (IoT Data): {err}")
    finally:
        cursor.close()
        conn.close()

# ==========================================
# CHƯƠNG TRÌNH CHÍNH
# ==========================================
if __name__ == "__main__":
    seed_rooms_directly()
    seed_guests_directly()
    seed_bookings_directly()
    seed_staff_and_tasks_directly()
    seed_iot_data_directly()
    
    print("\n" + "="*40 + "\n🎉 TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC ĐỒNG BỘ HOÀN HẢO!\n" + "="*40)