import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, useWindowDimensions, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export default function RoomDetailScreen({ route, navigation }) {
  // Chọn ngẫu nhiên 1 câu trong danh sách — giúp câu trả lời đỡ lặp khuôn cố định.
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const { room_number = '0101', type = 'Deluxe' } = route?.params || {};

  const API_URL = 'https://backend-cz3y.onrender.com/api/iot';
  const PREDICTION_API_URL = 'https://backend-cz3y.onrender.com/api/prediction';
  const LLM_VOICE_API_URL = 'https://backend-cz3y.onrender.com/api/voice/llm-command';

  const [sensorData, setSensorData] = useState({
    temp: '--', humidity: '--', smoke: '--', light: '--', energy: '--',
    motion: false, door_open: false, co2: '--', leak_detected: false, noise: '--'
  });

  const [prediction, setPrediction] = useState(null); // { predicted_co2, predicted_humidity, predicted_energy_kwh, predicted_at, model_name }
  const [predictionLoading, setPredictionLoading] = useState(true);
  
  const [acTemp, setAcTemp] = useState(24);
  const [lightBrightness, setLightBrightness] = useState(100); // 0-100% PWM dimming
  const [devices, setDevices] = useState({
    ac_power: false, main_light: false, bedside_lamp: false, desk_lamp: false, 
    door_lock: true, curtain: false, fan: false, siren: false, sprinkler: false, tv: false, main_power: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [volume, setVolume] = useState(0); 

  const webAudioStreamRef = useRef(null);
  const webAudioCtxRef = useRef(null);
  const reqAnimFrameRef = useRef(null);

  const devicesRef = useRef(devices);
  const acTempRef = useRef(acTemp);
  const sensorDataRef = useRef(sensorData);
  const lightBrightnessRef = useRef(lightBrightness);
  const isTogglingRef = useRef(false); // block poll khi đang toggle để tránh race condition

  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { acTempRef.current = acTemp; }, [acTemp]);
  useEffect(() => { sensorDataRef.current = sensorData; }, [sensorData]);
  useEffect(() => { lightBrightnessRef.current = lightBrightness; }, [lightBrightness]);

  const { width } = useWindowDimensions();
  const isMobile = width < 768; 

  const fetchIoTData = async () => {
    if (isTogglingRef.current) return; // skip poll khi đang toggle
    try {
      const response = await fetch(`${API_URL}/${room_number}`);
      if (!response.ok) return;
      const data = await response.json();
      
      setSensorData({
        temp: data.temp !== undefined ? Number(data.temp).toFixed(1) : '--', 
        humidity: data.humidity !== undefined ? Number(data.humidity).toFixed(1) : '--', 
        light: data.light !== undefined ? Number(data.light).toFixed(0) : '--', 
        motion: !!data.motion, 
        smoke: data.smoke !== undefined ? Number(data.smoke).toFixed(1) : '--', 
        energy: data.energy !== undefined ? Number(data.energy).toFixed(2) : '--',
        door_open: !!data.door_open, 
        co2: data.co2 !== undefined ? Number(data.co2).toFixed(0) : '--', 
        leak_detected: !!data.leak_detected, 
        noise: data.noise !== undefined ? Number(data.noise).toFixed(1) : '--'
      });
      
      setDevices({
        ac_power: !!data.ac_power, main_light: !!data.main_light, bedside_lamp: !!data.bedside_lamp, desk_lamp: !!data.desk_lamp,
        door_lock: !!data.door_lock, curtain: !!data.curtain, fan: !!data.fan, siren: !!data.siren, sprinkler: !!data.sprinkler, 
        tv: !!data.tv, main_power: !!data.main_power
      });
      
      setAcTemp(data.ac_temp || 24);
      setLightBrightness(data.light_brightness !== undefined ? Number(data.light_brightness) : 100);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Lỗi khi fetch IoT data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrediction = async () => {
    try {
      const response = await fetch(`${PREDICTION_API_URL}/${room_number}`);
      if (!response.ok) {
        setPrediction(null); // chưa có prediction nào (agent chưa chạy cycle đầu)
        return;
      }
      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      console.error('Lỗi khi fetch AI prediction:', error);
    } finally {
      setPredictionLoading(false);
    }
  };

  useEffect(() => {
    fetchIoTData();
    fetchPrediction();
    const interval = setInterval(() => {
      fetchIoTData();
      fetchPrediction();
    }, 3000);
    return () => clearInterval(interval);
  }, [room_number]);

  // Hook lắng nghe sự kiện của expo-speech-recognition
  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech error:', event);
    setIsListening(false);
    setRecognizedText('Error listening');
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (event.results && event.results.length > 0) {
      processVoiceCommand(event.results[0].transcript);
    }
    setIsListening(false);
  });

  // Tạo hiệu ứng sóng âm giả lập khi đang nghe (do thư viện mới không lấy raw volume trực tiếp)
  useEffect(() => {
    let interval;
    if (isListening) {
      interval = setInterval(() => setVolume(Math.random() * 4), 150);
    } else {
      setVolume(0);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  const updateDeviceInDB = async (deviceKey, value) => {
    try {
      await fetch(`${API_URL}/${room_number}/control`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey, value }) 
      });
    } catch (error) {
      console.error("Lỗi khi update", error);
    }
  };

  const deviceNamesEN = {
    main_light: 'Main Light', fan: 'Ventilation Fan', bedside_lamp: 'Bedside Lamp',
    desk_lamp: 'Desk Lamp', door_lock: 'Door Lock', curtain: 'Curtain', tv: 'TV',
    siren: 'Alarm Siren', sprinkler: 'Sprinkler', main_power: 'Main Power', ac_power: 'Air Conditioner'
  };

  const toggleDevice = (key, forceTargetState = null) => {
    const currentDevices = devicesRef.current;
    
    if (key !== 'main_power' && !currentDevices.main_power) {
      const msg = "Please turn on Main Power first!";
      if (Platform.OS === 'web') alert(msg); else Alert.alert("Warning", msg);
      Speech.speak("Please turn on main power first", { language: 'en-US' });
      return; 
    }

    const newValue = forceTargetState !== null ? forceTargetState : !currentDevices[key];
    if (forceTargetState !== null && currentDevices[key] === newValue) return;

    let newDevices = { ...currentDevices, [key]: newValue };

    if (key === 'main_power' && !newValue) {
      Object.keys(newDevices).forEach(k => {
        if (k !== 'main_power') newDevices[k] = false;
      });
    }

    // Block poll 3s để tránh race condition (poll override state vừa toggle)
    isTogglingRef.current = true;
    setTimeout(() => { isTogglingRef.current = false; }, 3000);

    setDevices(newDevices); 
    updateDeviceInDB(key, newValue); 

    let actionWord = newValue ? 'Turned on' : 'Turned off';
    if (key === 'door_lock') actionWord = newValue ? 'Locked' : 'Unlocked';
    if (key === 'curtain') actionWord = newValue ? 'Closed' : 'Opened';
    
    Speech.speak(`${actionWord} the ${deviceNamesEN[key] || key}`, { language: 'en-US' });

    if (key === 'door_lock') {
        setSensorData(prev => ({ ...prev, door_open: !newValue }));
    }

    if (key === 'main_power' && !newValue) {
        const offDevices = ['ac_power', 'main_light', 'bedside_lamp', 'desk_lamp', 'tv', 'fan', 'siren', 'sprinkler', 'curtain', 'door_lock'];
        offDevices.forEach(d => updateDeviceInDB(d, false));
    }
  };

  const changeAcTemp = (change) => {
    if (!devicesRef.current.main_power) return;
    const newTemp = Math.max(16, Math.min(30, acTempRef.current + change));
    setAcTemp(newTemp);
    updateDeviceInDB('ac_temp', newTemp);
    Speech.speak(`Air conditioner set to ${newTemp} degrees`, { language: 'en-US' });
  };

  const updateBrightnessInDB = async (brightness) => {
    try {
      await fetch(`${API_URL}/${room_number}/control`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceKey: 'main_light', value: true, brightness })
      });
    } catch (error) {
      console.error("Lỗi khi update brightness", error);
    }
  };

  const changeLightBrightness = (change) => {
    if (!devicesRef.current.main_power) return;
    if (!devicesRef.current.main_light) {
      // Tự bật main_light nếu chưa bật
      setDevices(prev => ({ ...prev, main_light: true }));
      updateDeviceInDB('main_light', true);
    }
    const newBrightness = Math.max(0, Math.min(100, lightBrightnessRef.current + change));
    setLightBrightness(newBrightness);
    updateBrightnessInDB(newBrightness);
    Speech.speak(`Main light brightness set to ${newBrightness} percent`, { language: 'en-US' });
  };

  const setAcTargetTemp = (targetValue) => {
    if (!devicesRef.current.main_power) {
      Speech.speak("Please turn on main power first", { language: 'en-US' });
      return;
    }
    if (!devicesRef.current.ac_power) {
      setDevices(prev => ({ ...prev, ac_power: true }));
      updateDeviceInDB('ac_power', true);
    }
    const newTemp = Math.max(16, Math.min(30, targetValue));
    setAcTemp(newTemp);
    updateDeviceInDB('ac_temp', newTemp);
    Speech.speak(`Air conditioner set to ${newTemp} degrees`, { language: 'en-US' });
  };

  // ── MAIN ENTRY: LLM-backed command understanding ────────────
  // Gửi transcript lên server (Groq -> OpenRouter -> regex, đã xử lý
  // resilience ở server.js). LLM chỉ trả JSON {device, action, type},
  // không được tự thao tác thiết bị — toggleDevice/setAcTargetTemp
  // vẫn giữ nguyên mọi logic an toàn cũ (main_power gate, clamp 16-30°C).
  const processVoiceCommand = async (text) => {
    const respond = (msg) => {
      setRecognizedText(msg);
      Speech.speak(msg, { language: 'en-US' });
      setTimeout(() => setRecognizedText(''), 5000);
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(LLM_VOICE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, room_number }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const result = await res.json();

      if (!result.success) {
        // Server tự trả success:false khi LLM không hiểu hoặc lỗi hạ tầng —
        // thử lại bằng regex trước khi báo "không hiểu" hẳn.
        fallbackVoiceCommand(text);
        return;
      }

      // Server đã tự thực thi CONTROL (DB + MQTT) hoặc query QUERY rồi,
      // client chỉ cần đọc kết quả trả về cho người dùng nghe.
      respond(result.message);

      // Đồng bộ lại UI ngay (server đã đổi state DB) thay vì chờ vòng poll tiếp theo.
      if (result.type === 'CONTROL') fetchIoTData();

    } catch (error) {
      console.warn('LLM voice endpoint unreachable, using regex fallback:', error.message);
      fallbackVoiceCommand(text);
    }
  };

  // ── FALLBACK: regex-based parser ────────────────────────────
  // Dùng khi LLM endpoint không gọi được (mạng lỗi, VPS/server down) —
  // voice control vẫn hoạt động, chỉ kém linh hoạt hơn với câu lạ.
  const fallbackVoiceCommand = (text) => {
    const lower = text.toLowerCase().trim();
    const sensor = sensorDataRef.current;
    const currTemp = acTempRef.current;

    const extractNumber = (str) => {
      const m = str.match(/\d+/);
      return m ? parseInt(m[0]) : null;
    };

    const respond = (msg) => {
      setRecognizedText(msg);
      Speech.speak(msg, { language: 'en-US' });
      setTimeout(() => setRecognizedText(''), 5000);
    };

    // ── MAIN POWER ────────────────────────────────────────────
    if (/turn on main power|main power on/.test(lower)) {
      toggleDevice('main_power', true);

    } else if (/turn off main power|main power off/.test(lower)) {
      toggleDevice('main_power', false);

    // ── AIR CONDITIONER ───────────────────────────────────────
    } else if (/turn on (the )?(ac|air conditioner|aircon)/.test(lower)) {
      toggleDevice('ac_power', true);

    } else if (/turn off (the )?(ac|air conditioner|aircon)/.test(lower)) {
      toggleDevice('ac_power', false);

    } else if (/set (ac|air conditioner|temp(erature)?) to \d+|set to \d+ degree/.test(lower)) {
      const num = extractNumber(lower);
      if (num && num >= 16 && num <= 30) {
        setAcTargetTemp(num);
      } else if (num) {
        respond('Temperature must be between 16 and 30 degrees.');
      } else {
        respond('Please say a number. Example: set AC to 25 degrees.');
      }

    } else if (/increase (the )?(ac|temp(erature)?)|temp(erature)? up/.test(lower)) {
      setAcTargetTemp(currTemp + 1);

    } else if (/decrease (the )?(ac|temp(erature)?)|temp(erature)? down/.test(lower)) {
      setAcTargetTemp(currTemp - 1);

    // ── MAIN LIGHT + DIMMING ──────────────────────────────────
    } else if (/turn on (the )?main light/.test(lower)) {
      toggleDevice('main_light', true);

    } else if (/turn off (the )?main light/.test(lower)) {
      toggleDevice('main_light', false);

    } else if (/set (the )?light(s)? (brightness |level )?to \d+|dim (the )?light(s)? to \d+/.test(lower)) {
      const num = extractNumber(lower);
      if (num !== null && num >= 0 && num <= 100) {
        changeLightBrightness(num - lightBrightnessRef.current);
      } else {
        respond('Please say a brightness between 0 and 100. Example: set light to 70.');
      }

    } else if (/increase (the )?brightness|brighter|lights? up/.test(lower)) {
      changeLightBrightness(10);

    } else if (/decrease (the )?brightness|dimmer|lights? down/.test(lower)) {
      changeLightBrightness(-10);

    // ── BEDSIDE LAMP ──────────────────────────────────────────
    } else if (/turn on (the )?bedside( lamp)?/.test(lower)) {
      toggleDevice('bedside_lamp', true);

    } else if (/turn off (the )?bedside( lamp)?/.test(lower)) {
      toggleDevice('bedside_lamp', false);

    // ── DESK LAMP ─────────────────────────────────────────────
    } else if (/turn on (the )?desk lamp/.test(lower)) {
      toggleDevice('desk_lamp', true);

    } else if (/turn off (the )?desk lamp/.test(lower)) {
      toggleDevice('desk_lamp', false);

    // ── FAN ───────────────────────────────────────────────────
    } else if (/turn on (the )?fan/.test(lower)) {
      toggleDevice('fan', true);

    } else if (/turn off (the )?fan/.test(lower)) {
      toggleDevice('fan', false);

    // ── TV ────────────────────────────────────────────────────
    } else if (/turn on (the )?tv/.test(lower)) {
      toggleDevice('tv', true);

    } else if (/turn off (the )?tv/.test(lower)) {
      toggleDevice('tv', false);

    // ── DOOR LOCK ─────────────────────────────────────────────
    } else if (/lock (the )?door/.test(lower)) {
      toggleDevice('door_lock', true);

    } else if (/unlock (the )?door/.test(lower)) {
      toggleDevice('door_lock', false);

    // ── CURTAIN ───────────────────────────────────────────────
    } else if (/close (the )?curtain/.test(lower)) {
      toggleDevice('curtain', true);

    } else if (/open (the )?curtain/.test(lower)) {
      toggleDevice('curtain', false);

    // ── SIREN ─────────────────────────────────────────────────
    } else if (/turn on (the )?siren|activate siren/.test(lower)) {
      toggleDevice('siren', true);

    } else if (/turn off (the )?siren|deactivate siren/.test(lower)) {
      toggleDevice('siren', false);

    // ── SPRINKLER ─────────────────────────────────────────────
    } else if (/turn on (the )?sprinkler|activate sprinkler/.test(lower)) {
      toggleDevice('sprinkler', true);

    } else if (/turn off (the )?sprinkler|deactivate sprinkler/.test(lower)) {
      toggleDevice('sprinkler', false);

    // ── SENSOR QUERIES ────────────────────────────────────────
    // pick() chọn ngẫu nhiên 1 trong nhiều cách diễn đạt — thuần code,
    // không gọi thêm API nào, nên không tăng độ trễ hay rủi ro rate limit.
    } else if (/what is the temperature|what.s the temperature|current temperature|how hot/.test(lower)) {
      respond(pick([
        `The current room temperature is ${sensor.temp} degrees Celsius.`,
        `It's ${sensor.temp} degrees in here right now.`,
        `Room temperature reads ${sensor.temp}°C.`,
      ]));

    } else if (/what is the humidity|what.s the humidity|current humidity/.test(lower)) {
      respond(pick([
        `The current humidity is ${sensor.humidity} percent.`,
        `Humidity is sitting at ${sensor.humidity}% right now.`,
        `It's ${sensor.humidity}% humidity in the room.`,
      ]));

    } else if (/what is the co2|co2 level|carbon dioxide/.test(lower)) {
      respond(pick([
        `The current CO2 level is ${sensor.co2} parts per million.`,
        `CO2 is at ${sensor.co2} ppm right now.`,
      ]));

    } else if (/what is the smoke|smoke level|is there smoke/.test(lower)) {
      const s = parseFloat(sensor.smoke);
      respond(s > 50
        ? pick([
            `Warning! Smoke level is high at ${sensor.smoke} ppm.`,
            `Careful — smoke level reads ${sensor.smoke} ppm, that's elevated.`,
          ])
        : pick([
            `Smoke level is normal at ${sensor.smoke} ppm.`,
            `No concern — smoke reading is ${sensor.smoke} ppm.`,
          ]));

    } else if (/what('?s| is) the light\b|how bright|light level|(number|amount) of light|how much light|\blux\b/.test(lower)) {
      respond(pick([
        `The current light level is ${sensor.light} lux.`,
        `It's reading ${sensor.light} lux in the room right now.`,
        `Light level is at ${sensor.light} lux.`,
      ]));

    } else if (/what is the noise|noise level|how loud/.test(lower)) {
      respond(pick([
        `The current noise level is ${sensor.noise} decibels.`,
        `It's about ${sensor.noise} decibels in here.`,
      ]));

    } else if (/energy consumption|how much energy|what is the energy/.test(lower)) {
      respond(pick([
        `Current energy consumption is ${sensor.energy} kilowatt-hours.`,
        `You've used ${sensor.energy} kWh so far.`,
      ]));

    } else if (/is there a leak|water leak/.test(lower)) {
      respond(sensor.leak_detected
        ? 'Warning! Water leak detected!'
        : pick([
            'No water leak detected. Everything is safe.',
            "All clear — no leaks right now.",
          ]));

    } else if (/is there (motion|anyone|someone|somebody)|is (anyone|someone|somebody) (in|there)|any (movement|occupant)|room (occupied|empty)/.test(lower)) {
      respond(sensor.motion
        ? pick(['Motion detected in the room.', 'Yes, someone appears to be in the room.'])
        : pick(['No motion detected.', "No, the room looks empty right now."]));

    } else if (/room status|status report/.test(lower)) {
      const acStatus = devicesRef.current.ac_power ? 'on at ' + currTemp + ' degrees' : 'off';
      respond(
        'Main power is ' + (devicesRef.current.main_power ? 'on' : 'off') +
        '. Temperature ' + sensor.temp + ' degrees, humidity ' + sensor.humidity + ' percent.' +
        ' AC is ' + acStatus + '. Main light is ' + (devicesRef.current.main_light ? 'on' : 'off') + '.'
      );

    // ── NOT RECOGNIZED ────────────────────────────────────────
    // Thay vì từ chối cụt lủn, nói rõ phạm vi mình hiểu được — đỡ cảm
    // giác "ngố" vì ít nhất người dùng biết nên hỏi/ra lệnh kiểu gì.
    } else {
      setRecognizedText('Unrecognized: "' + text + '"');
      Speech.speak("Sorry, I didn't catch that.", { language: 'en-US' });
      setTimeout(() => setRecognizedText(''), 4000);
    }
  };

  const stopWebAudio = () => {
    if (reqAnimFrameRef.current) cancelAnimationFrame(reqAnimFrameRef.current);
    if (webAudioCtxRef.current) webAudioCtxRef.current.close();
    if (webAudioStreamRef.current) webAudioStreamRef.current.getTracks().forEach(t => t.stop());
    setVolume(0);
  };

  const startListening = async () => {
    // Ngắt ngay câu đang nói (nếu có) — bấm mic là ưu tiên nghe người dùng
    // ngay lập tức, không bắt họ chờ hệ thống nói xong.
    Speech.stop();

    if (Platform.OS === 'web') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Please use Chrome.");
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webAudioStreamRef.current = stream;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        webAudioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
          let avg = sum / dataArray.length;
          setVolume(avg / 4);
          reqAnimFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (err) {
        console.warn("Could not get audio visualizer context", err);
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US'; 
      recognition.interimResults = false;
      
      recognition.onstart = () => { setIsListening(true); setRecognizedText('Listening...'); };
      recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        processVoiceCommand(speechResult);
      };
      recognition.onerror = () => { setIsListening(false); stopWebAudio(); };
      recognition.onend = () => { setIsListening(false); stopWebAudio(); };
      recognition.start();
      
    } else {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Voice recognition requires microphone permission.");
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });
    }
  };

  const SensorItem = ({ icon, label, value, unit, color }) => (
    <View style={[styles.sensorCard, isMobile && styles.cardMobile]}>
      <View style={[styles.sensorIconBg, { backgroundColor: color + '15' }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sensorLabel}>{label}</Text>
        {isLoading ? (
           <ActivityIndicator size="small" color={color} style={{marginTop: 2, alignSelf: 'flex-start'}}/>
        ) : (
           <Text style={styles.sensorValue} numberOfLines={1}>
             {value}{unit && value !== '--' ? <Text style={styles.unitText}>{unit}</Text> : null}
           </Text>
        )}
      </View>
    </View>
  );

  const ActuatorCard = ({ id, icon, label, status, activeColor, isDisabled }) => (
    <TouchableOpacity 
      style={[
        styles.actuatorCard, 
        isMobile && styles.cardMobile,
        status && { borderColor: activeColor, backgroundColor: activeColor + '08' },
        isDisabled && { opacity: 0.4 } 
      ]} 
      onPress={() => toggleDevice(id)}
      activeOpacity={isDisabled ? 1 : 0.2} 
    >
      <MaterialCommunityIcons name={icon} size={28} color={status ? activeColor : "#94a3b8"} />
      <Text style={[styles.actuatorLabel, status && { color: '#1e293b' }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.statusIndicator, { backgroundColor: status ? activeColor : "#e2e8f0" }]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#44403c" />
        </TouchableOpacity>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="home-automation" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.title, isMobile && { fontSize: 18 }]} numberOfLines={1}>Room {room_number} Control Hub</Text>
            {lastUpdate ? <Text style={styles.updateText}>Last sync: {lastUpdate}</Text> : null}
        </View>
        <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{type}</Text></View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && styles.scrollContentMobile]} showsVerticalScrollIndicator={false}>

        {/* ===== PREDICTIVE ENVIRONMENT AI CARD ===== */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.aiIconBg}>
                <MaterialCommunityIcons name="creation" size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.aiLabel}>Predictive Environment AI</Text>
                <Text style={styles.aiMeta}>
                  {predictionLoading
                    ? 'Syncing with edge node…'
                    : prediction
                      ? `${prediction.model_name} · next 15 min · updated ${new Date(prediction.predicted_at).toLocaleTimeString()}`
                      : 'No prediction yet — waiting for edge agent…'}
                </Text>
              </View>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.dotPulse} />
              <Text style={styles.liveBadgeText}>FORECAST</Text>
            </View>
          </View>

          {predictionLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" style={{ marginTop: 14 }} />
          ) : prediction ? (
            <View style={styles.aiStatRow}>
              <View style={styles.aiStatItem}>
                <View style={[styles.aiStatIconBg, { backgroundColor: '#fce7f3' }]}>
                  <MaterialCommunityIcons name="molecule-co2" size={20} color="#ec4899" />
                </View>
                <View>
                  <Text style={[styles.aiStatVal, { color: '#ec4899' }]}>{Number(prediction.predicted_co2).toFixed(0)} <Text style={styles.aiStatUnit}>ppm</Text></Text>
                  <Text style={styles.aiStatLabel}>CO2 / AQI NEXT</Text>
                </View>
              </View>
              <View style={styles.aiStatItem}>
                <View style={[styles.aiStatIconBg, { backgroundColor: '#dbeafe' }]}>
                  <MaterialCommunityIcons name="water-percent" size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text style={[styles.aiStatVal, { color: '#3b82f6' }]}>{Number(prediction.predicted_humidity).toFixed(1)} <Text style={styles.aiStatUnit}>%</Text></Text>
                  <Text style={styles.aiStatLabel}>HUMIDITY NEXT</Text>
                </View>
              </View>
              <View style={styles.aiStatItem}>
                <View style={[styles.aiStatIconBg, { backgroundColor: '#ede9fe' }]}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#8b5cf6" />
                </View>
                <View>
                  <Text style={[styles.aiStatVal, { color: '#8b5cf6' }]}>{Number(prediction.predicted_energy_kwh).toFixed(3)} <Text style={styles.aiStatUnit}>kWh</Text></Text>
                  <Text style={styles.aiStatLabel}>ENERGY NEXT STEP</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Environmental Sensors (Real-time)</Text>
            {isLoading && <ActivityIndicator size="small" color="#3b82f6" />}
        </View>

        <View style={styles.gridContainer}>
          <SensorItem icon="thermometer" label="Temp" value={sensorData.temp} unit="°C" color="#ef4444" />
          <SensorItem icon="water-percent" label="Humidity" value={sensorData.humidity} unit="%" color="#3b82f6" />
          <SensorItem icon="brightness-6" label="Light" value={sensorData.light} unit="lux" color="#eab308" />
          <SensorItem icon="motion-sensor" label="Motion" value={sensorData.motion ? 'Detected' : 'None'} color="#10b981" />
          <SensorItem icon="smoke-detector" label="Smoke" value={sensorData.smoke} unit="ppm" color="#f59e0b" />
          <SensorItem icon="lightning-bolt" label="Energy" value={sensorData.energy} unit="kWh" color="#8b5cf6" />
          <SensorItem icon="door-open" label="Door" value={sensorData.door_open ? 'Closed' : 'Open'} color="#6366f1" />
          <SensorItem icon="molecule-co2" label="CO2" value={sensorData.co2} unit="ppm" color="#ec4899" />
          <SensorItem icon="water-alert" label="Leak" value={sensorData.leak_detected ? 'LEAKING!' : 'Safe'} color="#06b6d4" />
          <SensorItem icon="volume-high" label="Noise" value={sensorData.noise} unit="dB" color="#475569" />
        </View>

        <Text style={styles.sectionTitle}>Lighting Control Node</Text>
        <View style={[styles.acCard, !devices.main_power && { opacity: 0.4 }]}>
          <View style={styles.acInfo}>
            <MaterialCommunityIcons name="lightbulb-on" size={32} color={devices.main_light ? "#eab308" : "#94a3b8"} />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={styles.acName} numberOfLines={1}>Main Light Dimmer</Text>
              <Text style={styles.acStatus}>
                {devices.main_light ? `PWM Brightness: ${lightBrightness}%` : 'Light Off'}
              </Text>
            </View>
            <Switch 
              value={devices.main_light} 
              onValueChange={() => toggleDevice('main_light')} 
              style={{marginLeft: 'auto'}} 
              disabled={!devices.main_power} 
              trackColor={{ false: '#e2e8f0', true: '#fef08a' }}
              thumbColor={devices.main_light ? '#eab308' : '#f4f4f5'}
            />
          </View>
          {devices.main_light && (
            <View style={styles.tempRow}>
              <TouchableOpacity onPress={() => changeLightBrightness(-10)} style={styles.tempBtn} activeOpacity={!devices.main_power ? 1 : 0.2}>
                <Ionicons name="remove" size={24} color={!devices.main_power ? "#cbd5e1" : "#000"} />
              </TouchableOpacity>
              <Text style={[styles.tempText, !devices.main_power && { color: "#cbd5e1" }]}>{lightBrightness}%</Text>
              <TouchableOpacity onPress={() => changeLightBrightness(10)} style={styles.tempBtn} activeOpacity={!devices.main_power ? 1 : 0.2}>
                <Ionicons name="add" size={24} color={!devices.main_power ? "#cbd5e1" : "#000"} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Output Actuators</Text>
        <View style={styles.gridContainer}>
          <ActuatorCard id="main_light" icon="lightbulb-group" label="Main Light" status={devices.main_light} activeColor="#eab308" isDisabled={!devices.main_power} />
          <ActuatorCard id="fan" icon="fan" label="Vent. Fan" status={devices.fan} activeColor="#06b6d4" isDisabled={!devices.main_power} />
          <ActuatorCard id="bedside_lamp" icon="lamp" label="Bedside" status={devices.bedside_lamp} activeColor="#f59e0b" isDisabled={!devices.main_power} />
          <ActuatorCard id="desk_lamp" icon="desk-lamp" label="Desk Lamp" status={devices.desk_lamp} activeColor="#3b82f6" isDisabled={!devices.main_power} />
          <ActuatorCard id="door_lock" icon="lock" label="Door Lock" status={devices.door_lock} activeColor="#10b981" isDisabled={!devices.main_power} />
          <ActuatorCard id="curtain" icon="curtains" label="Curtains" status={devices.curtain} activeColor="#8b5cf6" isDisabled={!devices.main_power} />
          <ActuatorCard id="tv" icon="television" label="Smart TV" status={devices.tv} activeColor="#ef4444" isDisabled={!devices.main_power} />
          <ActuatorCard id="siren" icon="alarm-bell" label="Alarm Siren" status={devices.siren} activeColor="#f43f5e" isDisabled={!devices.main_power} />
          <ActuatorCard id="sprinkler" icon="sprinkler" label="Sprinkler" status={devices.sprinkler} activeColor="#0ea5e9" isDisabled={!devices.main_power} />
          <ActuatorCard id="main_power" icon="power-socket-au" label="Main Power" status={devices.main_power} activeColor="#10b981" isDisabled={false} />
        </View>
      </ScrollView>

      {recognizedText !== '' && (
        <View style={styles.speechBubble}>
          <Text style={styles.speechText}>{recognizedText}</Text>
        </View>
      )}

      <View style={styles.micContainer}>
        {isListening && (
          <View style={[
            styles.micRipple, 
            { transform: [{ scale: 1 + Math.min(volume / 5, 2.5) }] }
          ]} />
        )}
        <TouchableOpacity 
          style={[styles.micButton, isListening && styles.micButtonActive]} 
          onPress={startListening}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name={isListening ? "microphone-settings" : "microphone"} size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 22, gap: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0',
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 100 } : { elevation: 3 }),
  },
  headerMobile: { padding: 15 },
  backBtn: { padding: 6 },
  logoBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 5 },
  title: { fontSize: 18, fontWeight: '900', color: '#1e293b', letterSpacing: -0.3 },
  updateText: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  typeBadge: { marginLeft: 'auto', backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  typeBadgeText: { fontSize: 12, fontWeight: '800', color: '#3b82f6' },
  scrollContent: { padding: 30, maxWidth: 1000, alignSelf: 'center', width: '100%', paddingBottom: 100 },
  scrollContentMobile: { padding: 15, paddingBottom: 100 },

  aiCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 16, padding: 22, marginBottom: 25,
    shadowColor: '#94a3b8', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiIconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  aiLabel: { fontSize: 15, fontWeight: '800', color: '#1e293b', letterSpacing: -0.2, marginBottom: 3 },
  aiMeta: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  dotPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6', marginRight: 6 },
  liveBadgeText: { color: '#2563eb', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  aiStatRow: { flexDirection: 'row', gap: 12, marginTop: 18, flexWrap: 'wrap' },
  aiStatItem: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  aiStatIconBg: { padding: 8, borderRadius: 10 },
  aiStatVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  aiStatUnit: { fontSize: 11, fontWeight: '700' },
  aiStatLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: '1.5%', marginBottom: 35 },
  cardMobile: { width: '48.5%' }, 
  sensorCard: { width: '18.8%', backgroundColor: '#fff', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  sensorIconBg: { padding: 8, borderRadius: 8 },
  sensorLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  sensorValue: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  unitText: { fontSize: 11 },
  acCard: { backgroundColor: '#fff', padding: 25, borderRadius: 16, marginBottom: 35, borderWidth: 1, borderColor: '#e2e8f0' },
  acInfo: { flexDirection: 'row', alignItems: 'center' },
  acName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  acStatus: { fontSize: 12, color: '#64748b', marginTop: 4 },
  tempRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, gap: 40 },
  tempBtn: { width: 44, height: 44, backgroundColor: '#f1f5f9', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tempText: { fontSize: 36, fontWeight: 'bold', color: '#1e293b' },
  actuatorCard: { width: '18.8%', backgroundColor: '#fff', padding: 18, borderRadius: 12, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e8f0', position: 'relative', marginBottom: 10 },
  actuatorLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textAlign: 'center', marginTop: 4 },
  statusIndicator: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 12, right: 12 },
  micContainer: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  micRipple: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(239, 68, 68, 0.3)' },
  micButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', shadowColor: '#3b82f6', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, zIndex: 10 },
  micButtonActive: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  speechBubble: { position: 'absolute', bottom: 105, right: 30, backgroundColor: '#1e293b', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderBottomRightRadius: 0, maxWidth: 250, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  speechText: { color: '#fff', fontSize: 14, fontWeight: '600' }
});