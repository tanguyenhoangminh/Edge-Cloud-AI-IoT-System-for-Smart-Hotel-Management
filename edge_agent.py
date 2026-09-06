import time
import requests
import joblib
import pandas as pd


API_BASE     = 'https://backend-cz3y.onrender.com'
ROOM_NUMBERS = ['0101']
POLL_S       = 10
# Phòng thực tế có gắn mạch ESP8266
ROOM_NUMBERS = [f'01{i:02d}' for i in range(1, 11)]
GATEWAY_ID   = 1


IOT_URL     = f'{API_BASE}/api/iot'
PRED_URL    = f'{API_BASE}/api/prediction'
PERF_URL    = f'{API_BASE}/api/perf'
POLL_S      = 10   # Chu kỳ chạy suy luận mỗi 10 giây

FEATURES = None
MODELS   = {}

def load_models():
    global FEATURES, MODELS
    FEATURES = joblib.load('feature_columns.joblib')
    MODELS = {
        'co2':      joblib.load('co2_model.joblib'),
        'humidity': joblib.load('humidity_model.joblib'),
        'energy':   joblib.load('energy_model.joblib'),
    }
    print(f' Đã nạp thành công {len(MODELS)} mô hình AI | Features: {list(FEATURES)}')

def fetch_snapshot(room_number):
    r = requests.get(f'{IOT_URL}/{room_number}', timeout=2)
    r.raise_for_status()
    return r.json()

def build_features(snap):
    """Ánh xạ dữ liệu snapshot vào đúng thứ tự ma trận feature đầu vào của mô hình."""
    now = time.localtime()
    row = {
        'hour':       round(now.tm_hour + now.tm_min / 60, 3),
        'humidity':   float(snap.get('humidity') or 60.0),
        'co2':        float(snap.get('co2') or 450.0),
        'motion':     int(bool(snap.get('motion', False))),
        'main_power': int(bool(snap.get('main_power', True))),
        'ac_power':   int(bool(snap.get('ac_power', False))),
        'ac_temp':    float(snap.get('ac_temp') or 25.0),
        'fan':        int(bool(snap.get('fan', False))),
        'main_light': int(bool(snap.get('main_light', False))),
        'tv':         int(bool(snap.get('tv', False))),
        'curtain':    int(bool(snap.get('curtain', False))),
        'door_open':  int(bool(snap.get('door_open', False))),
    }
    return pd.DataFrame([row], columns=FEATURES)

def apply_ai_rules(room_number, snap, preds):
    """
    Quy tắc điều khiển tối ưu hóa năng lượng dựa trên dự đoán:
    - Có kiểm tra trạng thái hiện tại để TRÁNH SPAM LỆNH LIÊN TỤC.
    """
    actions = []
    curr_brightness = int(snap.get('light_brightness') or 100)
    has_motion = bool(snap.get('motion', False))
    main_light = bool(snap.get('main_light', False))
    fan_state  = bool(snap.get('fan', False))
    smoke_val  = float(snap.get('smoke') or 0.0)

    # Rule 1: Không có người + đèn đang sáng mạnh → Dim xuống 30% tiết kiệm điện
    if not has_motion and main_light and curr_brightness > 30:
        actions.append({'deviceKey': 'main_light', 'value': True, 'brightness': 30})

    # Rule 2: Phát hiện có người + đèn đang ở mức dim → Trả về 100% độ sáng
    if has_motion and main_light and curr_brightness < 100:
        actions.append({'deviceKey': 'main_light', 'value': True, 'brightness': 100})

    # Rule 3: CO2 dự đoán vượt ngưỡng 800 ppm → Bật quạt thông gió
    if preds['co2'] > 800 and not fan_state:
        actions.append({'deviceKey': 'fan', 'value': True})

    # Rule 4: CO2 dự đoán đã hạ dưới 500 ppm → Tắt quạt thông gió
    if preds['co2'] < 500 and fan_state:
        actions.append({'deviceKey': 'fan', 'value': False})

    # Rule 5: Báo cháy khẩn cấp (Smoke > 50 ppm) → Mở quạt và rèm thoát khí
    if smoke_val > 50:
        if not fan_state:
            actions.append({'deviceKey': 'fan', 'value': True})
        if not bool(snap.get('curtain', False)):
            actions.append({'deviceKey': 'curtain', 'value': True})

    return actions

def push_control(room_number, actions):
    applied = []
    for act in actions:
        try:
            r = requests.put(f'{IOT_URL}/{room_number}/control', json=act, timeout=2)
            r.raise_for_status()
            applied.append(act)
        except requests.RequestException as e:
            print(f' [Control Fail] Phòng {room_number} ({act}): {e}')
    return applied

def post_prediction(room_number, preds):
    payload = {
        'room_number':          room_number,
        'model_name':           'RandomForest',
        'predicted_co2':        round(preds['co2'], 2),
        'predicted_humidity':   round(preds['humidity'], 3),
        'predicted_energy_kwh': round(preds['energy'], 5),
    }
    r = requests.post(PRED_URL, json=payload, timeout=2)
    r.raise_for_status()
    return payload

def log_performance(latency_ms):
    """Ghi nhận thời gian xử lý suy luận (Inference Latency) vào MariaDB."""
    try:
        requests.post(PERF_URL, json={
            'component': 'RandomForest_Edge',
            'gateway_id': GATEWAY_ID,
            'metric_name': 'inference_latency',
            'metric_value': round(latency_ms, 2),
            'unit': 'ms'
        }, timeout=2)
    except Exception:
        pass

def run_once(room_number):
    snap = fetch_snapshot(room_number)
    X    = build_features(snap)

    # Đo thời gian suy luận AI
    t_start = time.perf_counter()
    preds = {k: float(m.predict(X)[0]) for k, m in MODELS.items()}
    infer_latency = (time.perf_counter() - t_start) * 1000.0

    # Thực thi luật can thiệp tự động
    actions = apply_ai_rules(room_number, snap, preds)
    if actions:
        applied = push_control(room_number, actions)
        if applied:
            print(f' [Phòng {room_number}] AI can thiệp thiết bị: {applied}')

    result = post_prediction(room_number, preds)
    log_performance(infer_latency)

    ts = time.strftime('%H:%M:%S')
    print(f'[{ts}] Phòng {room_number} (Độ trễ: {infer_latency:.1f}ms) | '
          f'Dự đoán: CO2={result["predicted_co2"]} ppm, '
          f'Hum={result["predicted_humidity"]}%, '
          f'Energy={result["predicted_energy_kwh"]} kWh')

def main():
    load_models()
    print(f' Bắt đầu vòng lặp Edge AI Agent (chu kỳ {POLL_S}s) cho phòng: {ROOM_NUMBERS}\n')
    while True:
        for room in ROOM_NUMBERS:
            try:
                run_once(room)
            except requests.RequestException as e:
                print(f' Lỗi kết nối phòng {room}: {e}')
            except Exception as e:
                print(f' Lỗi xử lý phòng {room}: {e}')
        time.sleep(POLL_S)

if __name__ == '__main__':
    main()
