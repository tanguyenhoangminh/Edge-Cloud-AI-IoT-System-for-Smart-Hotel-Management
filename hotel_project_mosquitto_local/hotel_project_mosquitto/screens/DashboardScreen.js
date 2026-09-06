import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, useWindowDimensions, Platform, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Svg, Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  primary:     '#1A56DB',   // sapphire — one dominant brand color
  primaryDim:  '#EEF2FF',   // sapphire tint for icon backgrounds
  primaryMid:  '#BFDBFE',   // sapphire mid for badges

  amber:       '#D97706',   // energy / warning — semantic only
  amberDim:    '#FFFBEB',
  amberMid:    '#FDE68A',

  danger:      '#DC2626',   // alerts — semantic only
  dangerDim:   '#FEF2F2',
  dangerMid:   '#FECACA',

  success:     '#059669',
  successDim:  '#ECFDF5',

  bg:          '#F1F5F9',   // page background
  surface:     '#FFFFFF',   // card surface
  border:      '#E2E8F0',   // card border
  borderHover: '#CBD5E1',

  text:        '#0F172A',   // headings
  textSub:     '#475569',   // subtext
  textMuted:   '#94A3B8',   // placeholders / labels

  accentBar:   '#1A56DB',   // left accent bar on live cards
};

export default function DashboardScreen({ onNavigate = () => {} }) {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [iotData, setIotData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [guestsCount, setGuestsCount] = useState(0);
  const [staffStats, setStaffStats] = useState({ available: 0, busy: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [energyHistory, setEnergyHistory] = useState([]);
  const [chartWidth, setChartWidth] = useState(0);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [adminProfile, setAdminProfile] = useState({ name: 'minh', email: 'tanguyenhoangminh2002@gmail.com' });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });

  // Live pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const PRICE_PER_KWH = 2000;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [roomsRes, bookingsRes, alertsRes, guestsRes, predRes] = await Promise.all([
        fetch('https://backend-cz3y.onrender.com/api/rooms'),
        fetch('https://backend-cz3y.onrender.com/api/bookings'),
        fetch('https://backend-cz3y.onrender.com/api/alerts'),
        fetch('https://backend-cz3y.onrender.com/api/guests'),
        fetch('https://backend-cz3y.onrender.com/api/prediction/latest').catch(() => null)
      ]);
      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      const guestsData = await guestsRes.json();
      const iotAllRes = await fetch('https://backend-cz3y.onrender.com/api/iot/all');
      setIotData(iotAllRes.ok ? await iotAllRes.json() : []);
      setRooms(roomsData);
      setBookings(bookingsData);
      setAlerts(await alertsRes.json());
      setPredictions(predRes && predRes.ok ? await predRes.json() : []);
      setGuestsCount(guestsData.length);
      setStaffStats({ available: 0, busy: 0 });

      // Dùng /api/iot/all thay vì 200 request riêng lẻ — fix Energy Expenses và Room Appliances = 0

    } catch (error) {
      console.error('Dashboard Fetch Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatCompactMoney = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M ₫';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K ₫';
    return value.toLocaleString('vi-VN') + ' ₫';
  };
  const formatChartValue = (val) => {
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val.toFixed(0);
  };

  // ── KPI ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const paidBookings = bookings.filter(b => b.payment_status?.toLowerCase() === 'paid');
    const totalPaidRevenue = paidBookings.reduce((sum, b) => {
      const nights = Math.max(1, Math.ceil(Math.abs(new Date(b.check_out_date) - new Date(b.check_in_date)) / 86400000));
      const basePrice = Number(b.total_price) || 0;
      let discount = (basePrice / nights <= 600000) ? 0.05 : (basePrice / nights <= 1200000) ? 0.08 : (basePrice / nights <= 2000000) ? 0.1 : 0.15;
      return sum + (basePrice * (1 - discount));
    }, 0);
    const totalEnergyUsage = iotData.reduce((sum, d) => sum + (Number(d.energy) || 0), 0);
    const totalElectricCost = totalEnergyUsage * PRICE_PER_KWH;
    let onlineAct = 0, offlineAct = 0;
    iotData.forEach(device => {
      ['ac_power', 'main_light', 'bedside_lamp', 'desk_lamp', 'door_lock', 'curtain', 'fan', 'siren', 'sprinkler', 'tv'].forEach(act => {
        (device[act] == 1 || device[act] === true || String(device[act]).toLowerCase() === 'true') ? onlineAct++ : offlineAct++;
      });
    });
    return {
      totalPaidRevenue: formatCompactMoney(totalPaidRevenue),
      totalElectricCost: formatCompactMoney(totalElectricCost),
      currentLiveEnergy: totalEnergyUsage.toFixed(1),
      roomStats: {
        total: rooms.length || 1,
        available: rooms.filter(r => r.status === 'available').length,
        occupied: rooms.filter(r => r.status === 'occupied').length,
        maintenance: rooms.filter(r => r.status === 'maintenance').length,
        cleaning: rooms.filter(r => r.status === 'cleaning').length,
      },
      onlineActuators: onlineAct, offlineActuators: offlineAct, totalActuators: onlineAct + offlineAct,
    };
  }, [rooms, bookings, iotData]);

  useEffect(() => {
    if (kpi.currentLiveEnergy && Number(kpi.currentLiveEnergy) > 0) {
      setEnergyHistory(prev => {
        const newHistory = [...prev, Number(kpi.currentLiveEnergy)];
        return newHistory.length > 7 ? newHistory.slice(newHistory.length - 7) : newHistory;
      });
    }
  }, [kpi.currentLiveEnergy]);

  const aiInsights = useMemo(() => {
    if (predictions.length === 0) return { hasData: false, coverage: 0 };
    const sum = predictions.reduce((acc, p) => ({
      co2: acc.co2 + (Number(p.predicted_co2) || 0),
      humidity: acc.humidity + (Number(p.predicted_humidity) || 0),
      energy: acc.energy + (Number(p.predicted_energy_kwh) || 0),
    }), { co2: 0, humidity: 0, energy: 0 });
    const n = predictions.length;
    return {
      hasData: true, coverage: n,
      avgCo2: (sum.co2 / n).toFixed(0),
      avgHumidity: (sum.humidity / n).toFixed(1),
      avgEnergyKwh: (sum.energy / n).toFixed(3),
    };
  }, [predictions]);

  const roomTypeStats = useMemo(() => {
    const statsMap = {};
    rooms.forEach(r => {
      if (!statsMap[r.type]) statsMap[r.type] = { total: 0, occupied: 0 };
      statsMap[r.type].total++;
      if (r.status === 'occupied') statsMap[r.type].occupied++;
    });
    return Object.keys(statsMap)
      .map(key => ({ type: key, total: statsMap[key].total, occupied: statsMap[key].occupied, rate: ((statsMap[key].occupied / statsMap[key].total) * 100).toFixed(0) }))
      .sort((a, b) => b.rate - a.rate);
  }, [rooms]);

  const activeUnreadAlerts = useMemo(() => alerts.filter(a => a.status === 'Active' && !a.is_acknowledged), [alerts]);
  const criticalUnreadCount = useMemo(() => activeUnreadAlerts.filter(a => a.severity === 'critical').length, [activeUnreadAlerts]);

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0] ? parts[0].substring(0, 2).toUpperCase() : 'MT';
  };

  const handleOpenEditProfile = () => { setEditForm({ name: adminProfile.name, email: adminProfile.email }); setShowProfileMenu(false); setShowEditProfile(true); };
  const handleSaveProfile = () => { setAdminProfile({ name: editForm.name, email: editForm.email }); setShowEditProfile(false); };

  const handleAcknowledgeAlerts = async () => {
    const unreadAlerts = activeUnreadAlerts.map(a => ({ room_number: a.room_number, type: a.type }));
    if (unreadAlerts.length === 0) { setShowNotifMenu(false); return; }
    try {
      await fetch('https://backend-cz3y.onrender.com/api/alerts/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertsToAck: unreadAlerts }) });
      setShowNotifMenu(false); fetchData();
    } catch (e) { console.error('Lỗi:', e); }
  };

  // ── Charts ─────────────────────────────────────────────────────────────────
  const renderEnergyLineChart = () => {
    if (chartWidth === 0) return null;
   const liveEnergy = Number(kpi.currentLiveEnergy) || 0;
    let data = energyHistory.length >= 3
      ? energyHistory
      : [liveEnergy * 0.7, liveEnergy * 0.8, liveEnergy * 0.85, liveEnergy * 0.92, liveEnergy].map(v => Math.max(0, v));
    if (data.every(v => v === 0)) data = [0.1, 0.2, 0.3, 0.4, 0.5]; // placeholder khi chưa có data

    const chartHeight = 220, paddingLeft = 45, paddingRight = 20, paddingTop = 20, paddingBottom = 30;
    const maxVal = Math.max(...data) + 10;
    const minVal = Math.max(0, Math.min(...data) - 10);
    const range = maxVal - minVal || 1;

    const points = data.map((val, i) => ({
      x: paddingLeft + (i * (chartWidth - paddingLeft - paddingRight)) / (data.length - 1),
      y: paddingTop + chartHeight - paddingBottom - paddingTop - ((val - minVal) / range) * (chartHeight - paddingTop - paddingBottom)
    }));

    let linePath = `M ${points[0].x} ${points[0].y}`;
    points.slice(1).forEach(p => linePath += ` L ${p.x} ${p.y}`);
    let fillPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;
    const timeLabels = ['-18s', '-15s', '-12s', '-9s', '-6s', '-3s', 'Now'];

    return (
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.primary} stopOpacity="0.18" />
            <Stop offset="1" stopColor={C.primary} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        {/* Grid lines */}
        <Path d={`M ${paddingLeft} ${paddingTop} L ${chartWidth - paddingRight} ${paddingTop}`} stroke={C.border} strokeWidth="1" strokeDasharray="4 4" />
        <SvgText x={paddingLeft - 8} y={paddingTop + 4} fill={C.textMuted} fontSize="11" textAnchor="end" fontWeight="600">{formatChartValue(maxVal)}</SvgText>
        <Path d={`M ${paddingLeft} ${chartHeight - paddingBottom} L ${chartWidth - paddingRight} ${chartHeight - paddingBottom}`} stroke={C.border} strokeWidth="1" strokeDasharray="4 4" />
        <SvgText x={paddingLeft - 8} y={chartHeight - paddingBottom + 4} fill={C.textMuted} fontSize="11" textAnchor="end" fontWeight="600">{formatChartValue(minVal)}</SvgText>
        {points.map((p, i) => (
          <SvgText key={`xl-${i}`} x={p.x} y={chartHeight - 5} fill={C.textMuted} fontSize="10" textAnchor="middle" fontWeight="600">{timeLabels[i]}</SvgText>
        ))}
        {/* Fill + line */}
        <Path d={fillPath} fill="url(#energyGrad)" />
        <Path d={linePath} fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? '6' : '3.5'} fill={i === points.length - 1 ? C.primary : C.surface} stroke={C.primary} strokeWidth={i === points.length - 1 ? '0' : '2'} />
        ))}
      </Svg>
    );
  };

  const renderDonutChart = () => {
    const radius = 50, strokeWidth = 20, circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;
    const pieSegments = [
      { color: C.amber,   value: kpi.roomStats.occupied },
      { color: C.primary, value: kpi.roomStats.available },
      { color: C.textMuted, value: kpi.roomStats.cleaning },
      { color: C.danger,  value: kpi.roomStats.maintenance },
    ];
    return (
      <Svg width="140" height="140" viewBox="0 0 140 140">
        <Circle cx="70" cy="70" r={radius} fill="none" stroke={C.bg} strokeWidth={strokeWidth} />
        {pieSegments.map((seg, i) => {
          if (seg.value === 0) return null;
          const percent = seg.value / kpi.roomStats.total;
          const strokeDasharray = `${percent * circumference} ${circumference}`;
          const strokeDashoffset = -(cumulativePercent * circumference);
          cumulativePercent += percent;
          return <Circle key={i} cx="70" cy="70" r={radius} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} transform="rotate(-90 70 70)" strokeLinecap="round" />;
        })}
      </Svg>
    );
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={styles.appBackground}>

      {/* ── Top Nav ───────────────────────────────────────────────────────── */}
      <View style={styles.topNavWrapper}>
        <View style={styles.topNavContent}>
          <View style={styles.brandGroup}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="shield-home" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.brandText}>Grand<Text style={{ color: C.primary }}>IoT</Text></Text>
              <Text style={styles.brandSub}>Hospitality OS</Text>
            </View>
          </View>

          {!isMobile && (
            <View style={styles.navLinksRow}>
              {[
                { key: 'Dashboard', label: 'Dashboard', icon: 'view-dashboard-outline', screen: 'Dashboard' },
                { key: 'Rooms', label: 'Room Units', icon: 'bed-outline', screen: 'Rooms' },
                { key: 'Energy', label: 'Eco Energy', icon: 'lightning-bolt-circle', screen: 'Energy' },
                { key: 'Alerts', label: 'Incident Log', icon: 'shield-alert-outline', screen: 'Alerts' },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity key={tab.key} style={[styles.navLinkItem, isActive && styles.navLinkItemActive]}
                    onPress={() => { setActiveTab(tab.key); if (tab.screen !== 'Dashboard') onNavigate(tab.screen); }}>
                    <MaterialCommunityIcons name={tab.icon} size={17} color={isActive ? C.primary : C.textSub} />
                    <Text style={[styles.navLinkText, isActive && styles.navLinkTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.headerIconsArea}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowNotifMenu(true)}>
              <MaterialCommunityIcons name="bell-outline" size={21} color={C.textSub} />
              {activeUnreadAlerts.length > 0 && (
                <View style={[styles.badge, { backgroundColor: criticalUnreadCount > 0 ? C.danger : C.amber }]}>
                  <Text style={styles.badgeText}>{activeUnreadAlerts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarCircle} onPress={() => setShowProfileMenu(true)}>
              <Text style={styles.avatarText}>{getInitials(adminProfile.name)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, isMobile && { paddingHorizontal: 16 }]}>

        {/* Title row */}
        <View style={[styles.titleAreaRow, isMobile && { marginBottom: 20 }]}>
          <View>
            <Text style={[styles.viewTitle, isMobile && { fontSize: 22 }]}>Property Overview</Text>
            <Text style={styles.subTitle}>Operations, Energy & Smart Guest Services</Text>
          </View>
          <View style={styles.liveIndicator}>
            <Animated.View style={[styles.dotPulseLive, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.8], outputRange: [1, 0.3] }) }]} />
            <View style={styles.dotPulseLiveCore} />
            <Text style={styles.liveText}>SYSTEM LIVE</Text>
          </View>
        </View>

        {/* ── KPI Row ─────────────────────────────────────────────────────── */}
        <View style={[styles.kpiRow, isMobile && styles.kpiRowMobile]}>

          {/* Revenue */}
          <TouchableOpacity style={[styles.kpiCard, isMobile && styles.cardFullWidth]} onPress={() => onNavigate('Reservation')}>
            <View style={styles.kpiAccentBar} />
            <View style={styles.kpiInner}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>TOTAL REVENUE</Text>
                <View style={[styles.iconWrapper, { backgroundColor: C.primaryDim }]}>
                  <MaterialCommunityIcons name="finance" size={18} color={C.primary} />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: C.text }]}>{kpi.totalPaidRevenue}</Text>
              <View style={styles.trendRow}>
                <View style={[styles.trendBadge, { backgroundColor: C.primaryDim }]}>
                  <Text style={[styles.trendText, { color: C.primary }]}>↑ 5.8%</Text>
                </View>
                <Text style={styles.trendLabel}>vs last cycle</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Energy */}
          <TouchableOpacity style={[styles.kpiCard, isMobile && styles.cardFullWidth]} onPress={() => onNavigate('Energy')}>
            <View style={[styles.kpiAccentBar, { backgroundColor: C.amber }]} />
            <View style={styles.kpiInner}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>ENERGY EXPENSES</Text>
                <View style={[styles.iconWrapper, { backgroundColor: C.amberDim }]}>
                  <MaterialCommunityIcons name="lightning-bolt-circle" size={18} color={C.amber} />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: C.text }]}>{kpi.totalElectricCost}</Text>
              <View style={styles.trendRow}>
                <View style={[styles.trendBadge, { backgroundColor: C.amberDim }]}>
                  <Text style={[styles.trendText, { color: C.amber }]}>Optimal</Text>
                </View>
                <Text style={styles.trendLabel}>{kpi.currentLiveEnergy} kWh sync</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Alerts */}
          <TouchableOpacity style={[styles.kpiCard, isMobile && styles.cardFullWidth]} onPress={() => onNavigate('Alerts')}>
            <View style={[styles.kpiAccentBar, { backgroundColor: activeUnreadAlerts.length > 0 ? C.danger : C.success }]} />
            <View style={styles.kpiInner}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel}>ACTIVE ALERTS</Text>
                <View style={[styles.iconWrapper, { backgroundColor: activeUnreadAlerts.length > 0 ? C.dangerDim : C.successDim }]}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={18} color={activeUnreadAlerts.length > 0 ? C.danger : C.success} />
                </View>
              </View>
              <Text style={[styles.kpiValue, { color: activeUnreadAlerts.length > 0 ? C.danger : C.success }]}>
                {activeUnreadAlerts.length} <Text style={{ fontSize: 16, fontWeight: '600', color: C.textSub }}>issues</Text>
              </Text>
              <Text style={[styles.trendLabel, { color: activeUnreadAlerts.length === 0 ? C.success : C.danger, fontWeight: '600', marginTop: 4 }]}>
                {activeUnreadAlerts.length === 0 ? 'All sensors normal' : `${criticalUnreadCount} critical attention required`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Main Grid ───────────────────────────────────────────────────── */}
        <View style={[styles.mainGrid, isMobile && styles.mainGridMobile]}>

          {/* LEFT COLUMN */}
          <View style={[styles.leftCol, isMobile && styles.cardFullWidth]}>

            {/* Energy chart */}
            <View style={[styles.widgetCard, { paddingHorizontal: 0, paddingBottom: 0 }]}>
              <View style={[styles.widgetHeader, { paddingHorizontal: 24 }]}>
                <View>
                  <Text style={styles.widgetTitle}>Energy Efficiency</Text>
                  <Text style={styles.kpiSub}>Real-time IoT load analysis (kWh)</Text>
                </View>
                <TouchableOpacity onPress={() => onNavigate('Energy')} style={styles.btnOutline}>
                  <Text style={styles.linkText}>Details</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chartWrapper} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                {renderEnergyLineChart()}
              </View>
            </View>

            {/* Occupancy by category */}
            <View style={styles.widgetCard}>
              <View style={styles.widgetHeader}>
                <Text style={styles.widgetTitle}>Occupancy by Category</Text>
              </View>
              <View style={styles.occupancyContainer}>
                {roomTypeStats.map((stat, i) => (
                  <View key={i} style={styles.occupancyRow}>
                    <View style={styles.occupancyHeader}>
                      <Text style={styles.occupancyType}>{stat.type}</Text>
                      <Text style={styles.occupancyStats}>{stat.occupied}/{stat.total}
                        <Text style={{ fontWeight: '700', color: C.textSub }}> ({stat.rate}%)</Text>
                      </Text>
                    </View>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressFill, {
                        flex: Number(stat.rate) / 100,
                        backgroundColor: Number(stat.rate) >= 70 ? C.primary : Number(stat.rate) >= 40 ? C.amber : C.textMuted,
                        borderRadius: 4
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* RIGHT COLUMN */}
          <View style={[styles.rightCol, isMobile && styles.cardFullWidth]}>

            {/* Room Availability */}
            <View style={styles.widgetCard}>
              <View style={styles.widgetHeader}>
                <Text style={styles.widgetTitle}>Room Availability</Text>
                <TouchableOpacity onPress={() => onNavigate('Rooms')} style={styles.btnOutline}>
                  <Text style={styles.linkText}>Inventory</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.pieChartArea, isMobile && styles.pieChartAreaMobile]}>
                {renderDonutChart()}
                <View style={[styles.roomStatusList, isMobile && { width: '100%', marginTop: 20 }]}>
                  {[
                    { label: 'Occupied',    color: C.amber,    val: kpi.roomStats.occupied },
                    { label: 'Available',   color: C.primary,  val: kpi.roomStats.available },
                    { label: 'Cleaning',    color: C.textMuted, val: kpi.roomStats.cleaning },
                    { label: 'Maintenance', color: C.danger,   val: kpi.roomStats.maintenance },
                  ].map((item, i) => (
                    <View key={i} style={styles.statusBox}>
                      <View style={[styles.dotBox, { backgroundColor: item.color }]} />
                      <Text style={styles.statusName}>{item.label}</Text>
                      <Text style={styles.statusVal}>{item.val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Smart Room Assistant */}
            <View style={styles.widgetCard}>
              <View style={styles.widgetHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.iconWrapper, { backgroundColor: C.primaryDim }]}>
                    <MaterialCommunityIcons name="creation" size={16} color={C.primary} />
                  </View>
                  <Text style={styles.widgetTitle}>Smart Room Assistant</Text>
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.dotPulseSmall} />
                  <Text style={styles.liveBadgeText}>{aiInsights.hasData ? `${aiInsights.coverage} ROOMS` : 'AUTO SYNC'}</Text>
                </View>
              </View>
              <Text style={styles.kpiSub}>Average predicted values across all rooms</Text>

              {!aiInsights.hasData ? (
                <Text style={{ color: C.textMuted, fontStyle: 'italic', fontSize: 13, paddingVertical: 10, marginTop: 4 }}>
                  Awaiting sensor data synchronization from edge nodes.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15, flexWrap: 'wrap' }}>
                  {[
                    { icon: 'molecule-co2', color: C.danger,  bg: C.dangerDim,  val: aiInsights.avgCo2,       label: 'AVG CO₂ (ppm)' },
                    { icon: 'water-percent', color: C.primary, bg: C.primaryDim, val: `${aiInsights.avgHumidity}%`, label: 'AVG HUMIDITY' },
                    { icon: 'lightning-bolt', color: C.amber, bg: C.amberDim,   val: aiInsights.avgEnergyKwh, label: 'AVG ENERGY (kWh)' },
                  ].map((item, i) => (
                    <View key={i} style={styles.sensorItem}>
                      <View style={[styles.sensorIcon, { backgroundColor: item.bg }]}>
                        <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                      </View>
                      <Text style={[styles.sensorVal, { color: item.color }]}>{item.val}</Text>
                      <Text style={styles.sensorLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Incident Reports */}
            <View style={styles.widgetCard}>
              <View style={styles.widgetHeader}>
                <Text style={styles.widgetTitle}>Incident Reports</Text>
                <TouchableOpacity onPress={() => onNavigate('Alerts')}>
                  <Text style={[styles.linkText, { color: C.textSub }]}>View All →</Text>
                </TouchableOpacity>
              </View>
              <View style={{ gap: 10 }}>
                {activeUnreadAlerts.length === 0 ? (
                  <View style={styles.emptyAlertBox}>
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color={C.success} style={{ marginRight: 8 }} />
                    <Text style={{ color: C.success, fontWeight: '600', fontSize: 13 }}>Operations are running smoothly.</Text>
                  </View>
                ) : (
                  activeUnreadAlerts.slice(0, 3).map((alert, i) => (
                    <View key={i} style={styles.alertRow}>
                      <View style={[styles.alertIconBg, { backgroundColor: alert.severity === 'critical' ? C.dangerDim : C.amberDim }]}>
                        <MaterialCommunityIcons
                          name={alert.severity === 'critical' ? 'alert-decagram-outline' : 'alert-circle-outline'}
                          size={18}
                          color={alert.severity === 'critical' ? C.danger : C.amber}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertRowTitle}>{alert.type}</Text>
                        <Text style={styles.alertRowSub} numberOfLines={1}>Room {alert.room_number} • {alert.sensor}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Room Appliances */}
            <View style={styles.widgetCard}>
              <View style={styles.widgetHeader}>
                <Text style={styles.widgetTitle}>Room Appliances</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={styles.actuatorStatItem}>
                  <View style={[styles.actuatorIcon, { backgroundColor: C.primaryDim }]}>
                    <MaterialCommunityIcons name="lightbulb-group" size={22} color={C.primary} />
                  </View>
                  <View>
                    <Text style={[styles.actuatorVal, { color: C.primary }]}>{kpi.onlineActuators}</Text>
                    <Text style={styles.actuatorLabel}>ACTIVE</Text>
                  </View>
                </View>
                <View style={styles.actuatorStatItem}>
                  <View style={[styles.actuatorIcon, { backgroundColor: C.bg }]}>
                    <MaterialCommunityIcons name="lightbulb-group-outline" size={22} color={C.textMuted} />
                  </View>
                  <View>
                    <Text style={[styles.actuatorVal, { color: C.textMuted }]}>{kpi.offlineActuators}</Text>
                    <Text style={styles.actuatorLabel}>IDLE</Text>
                  </View>
                </View>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Modal visible={showProfileMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProfileMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.profileMenuBox, isMobile && { right: 15, width: '90%' }]}>
            <View style={styles.profileMenuHeader}>
              <View style={styles.profileMenuAvatarBg}>
                <Text style={styles.profileMenuBigInitials}>{getInitials(adminProfile.name)}</Text>
              </View>
              <Text style={styles.profileMenuName}>{adminProfile.name}</Text>
              <Text style={styles.profileMenuEmail}>{adminProfile.email}</Text>
            </View>
            <View style={styles.profileMenuList}>
              {[
                { icon: 'shield-key-outline', label: 'Security Settings' },
                { icon: 'account-cog-outline', label: 'Manager Profile', onPress: handleOpenEditProfile },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.profileMenuItem} onPress={item.onPress || (() => setShowProfileMenu(false))}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={C.textSub} />
                  <Text style={styles.profileMenuText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showEditProfile} transparent animationType="fade">
        <View style={styles.modalOverlayDark}>
          <View style={[styles.editModalBox, isMobile && { width: '90%', padding: 20 }]}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Update Profile</Text>
              <TouchableOpacity onPress={() => setShowEditProfile(false)}>
                <MaterialCommunityIcons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {[
              { label: 'Display Name', key: 'name', placeholder: 'Enter your name' },
              { label: 'Email Address', key: 'email', placeholder: 'Enter your email', keyboard: 'email-address' },
            ].map((field) => (
              <View key={field.key} style={styles.editInputGroup}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TextInput style={styles.textInput} value={editForm[field.key]} onChangeText={(t) => setEditForm({ ...editForm, [field.key]: t })} placeholder={field.placeholder} keyboardType={field.keyboard} />
              </View>
            ))}
            <View style={styles.editModalFooter}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowEditProfile(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveProfile}>
                <Text style={styles.btnSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotifMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNotifMenu(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.notifMenuBox, isMobile && { right: 15, width: '90%' }]}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>Notifications</Text>
              <TouchableOpacity onPress={handleAcknowledgeAlerts} style={styles.btnOutlineNotif}>
                <Text style={styles.notifAcknowledgeBtn}>Mark as read</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
              {activeUnreadAlerts.length === 0 ? (
                <Text style={{ textAlign: 'center', color: C.textMuted, padding: 40, fontWeight: '500' }}>You're all caught up!</Text>
              ) : (
                activeUnreadAlerts.map((alert, i) => (
                  <View key={i} style={styles.notifItem}>
                    <View style={[styles.notifIconBg, { backgroundColor: alert.severity === 'critical' ? C.dangerDim : C.amberDim }]}>
                      <MaterialCommunityIcons name={alert.type.includes('Leak') ? 'water-alert' : 'alert-outline'} size={20} color={alert.severity === 'critical' ? C.danger : C.amber} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifMessage}>
                        <Text style={{ fontWeight: '700', color: C.text }}>{alert.type}</Text> — {alert.message}
                      </Text>
                      <Text style={styles.notifTime}>{alert.time} · Room {alert.room_number}</Text>
                    </View>
                    <View style={[styles.blueDot, { backgroundColor: alert.severity === 'critical' ? C.danger : C.primary }]} />
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.notifFooter}>
              <TouchableOpacity style={styles.btnViewDetails} onPress={() => { setShowNotifMenu(false); onNavigate('Alerts'); }}>
                <Text style={styles.btnViewDetailsText}>View All Alerts</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  appBackground: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  content: { padding: 28, maxWidth: 1440, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Nav ───────────────────────────────────────────────────────────────────
  topNavWrapper: {
    width: '100%',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 100 } : { elevation: 2 })
  },
  topNavContent: { maxWidth: 1440, alignSelf: 'center', width: '100%', paddingHorizontal: 28, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logoBadge: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  brandText: { fontSize: 17, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  brandSub: { fontSize: 9, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  navLinksRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, padding: 3, borderRadius: 22, gap: 2 },
  navLinkItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, gap: 6 },
  navLinkItemActive: { backgroundColor: C.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  navLinkText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  navLinkTextActive: { color: C.primary, fontWeight: '700' },

  headerIconsArea: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 8, backgroundColor: C.surface, borderRadius: 18, position: 'relative', borderWidth: 1, borderColor: C.border },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.surface },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // ── Page header ───────────────────────────────────────────────────────────
  titleAreaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  viewTitle: { fontSize: 26, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  subTitle: { fontSize: 13, color: C.textMuted, marginTop: 3, fontWeight: '500' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  dotPulseLive: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary, opacity: 0.4 },
  dotPulseLiveCore: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  liveText: { color: C.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // ── KPI ───────────────────────────────────────────────────────────────────
  kpiRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  kpiRowMobile: { flexDirection: 'column' },
  kpiCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#94a3b8',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kpiAccentBar: { width: 4, backgroundColor: C.primary },
  kpiInner: { flex: 1, padding: 20 },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: C.textMuted, letterSpacing: 1 },
  kpiValue: { fontSize: 28, fontWeight: '900', marginBottom: 6, letterSpacing: -0.5 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  trendText: { fontSize: 11, fontWeight: '800' },
  trendLabel: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  iconWrapper: { padding: 7, borderRadius: 9 },
  cardFullWidth: { width: '100%', flex: undefined },

  // ── Grid ──────────────────────────────────────────────────────────────────
  mainGrid: { flexDirection: 'row', gap: 16 },
  mainGridMobile: { flexDirection: 'column' },
  leftCol: { flex: 1.8, gap: 16 },
  rightCol: { flex: 1.2, gap: 16 },

  // ── Widget cards ──────────────────────────────────────────────────────────
  widgetCard: {
    backgroundColor: C.surface,
    padding: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#94a3b8',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  widgetTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  kpiSub: { fontSize: 12, color: C.textMuted, marginTop: 2, fontWeight: '500' },
  btnOutline: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  linkText: { color: C.primary, fontWeight: '700', fontSize: 12 },

  chartWrapper: { width: '100%', marginTop: 6, paddingBottom: 8 },

  // ── Donut / availability ──────────────────────────────────────────────────
  pieChartArea: { flexDirection: 'row', alignItems: 'center', gap: 22, marginBottom: 4 },
  pieChartAreaMobile: { flexDirection: 'column', alignItems: 'center' },
  roomStatusList: { flex: 1, gap: 11 },
  statusBox: { flexDirection: 'row', alignItems: 'center' },
  dotBox: { width: 9, height: 9, borderRadius: 3, marginRight: 10 },
  statusName: { fontSize: 13, color: C.textSub, flex: 1, fontWeight: '600' },
  statusVal: { fontSize: 15, fontWeight: '900', color: C.text },

  // ── Occupancy bars ────────────────────────────────────────────────────────
  occupancyContainer: { gap: 13 },
  occupancyRow: { gap: 7 },
  occupancyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  occupancyType: { fontSize: 13, fontWeight: '700', color: C.text },
  occupancyStats: { fontSize: 12, color: C.textMuted },
  progressContainer: { height: 5, backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  progressFill: { height: 5 },

  // ── Sensor items (Smart Room) ─────────────────────────────────────────────
  sensorItem: { flex: 1, alignItems: 'center', backgroundColor: C.bg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: 4 },
  sensorIcon: { padding: 7, borderRadius: 9, marginBottom: 2 },
  sensorVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  sensorLabel: { fontSize: 9, color: C.textMuted, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },

  // ── Live badge ────────────────────────────────────────────────────────────
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.amberDim, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 11, borderWidth: 1, borderColor: C.amberMid },
  dotPulseSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.amber, marginRight: 5 },
  liveBadgeText: { color: C.amber, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // ── Actuators ─────────────────────────────────────────────────────────────
  actuatorStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  actuatorIcon: { padding: 7, borderRadius: 9 },
  actuatorVal: { fontSize: 19, fontWeight: '900', marginBottom: 1, letterSpacing: -0.5 },
  actuatorLabel: { fontSize: 9, color: C.textMuted, fontWeight: '800', letterSpacing: 0.5 },

  // ── Alert rows ────────────────────────────────────────────────────────────
  alertRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  alertIconBg: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  alertRowTitle: { fontSize: 13, fontWeight: '800', color: C.text },
  alertRowSub: { fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: '500' },
  emptyAlertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successDim, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0' },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'transparent' },
  modalOverlayDark: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(4px)' } : {}) },

  profileMenuBox: { position: 'absolute', top: 70, right: 28, width: 270, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, elevation: 10, shadowColor: '#1c1917', shadowOpacity: 0.12, shadowRadius: 22, overflow: 'hidden', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}) },
  profileMenuHeader: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20, backgroundColor: C.bg },
  profileMenuAvatarBg: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  profileMenuBigInitials: { fontSize: 22, color: '#fff', fontWeight: '900' },
  profileMenuName: { fontSize: 15, color: C.text, fontWeight: '800', marginBottom: 2 },
  profileMenuEmail: { fontSize: 12, color: C.textMuted, fontWeight: '500' },
  profileMenuList: { paddingVertical: 8 },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18, gap: 12 },
  profileMenuText: { fontSize: 14, color: C.textSub, fontWeight: '600' },

  editModalBox: { width: 390, backgroundColor: C.surface, borderRadius: 18, padding: 24, elevation: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 22 },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  editModalTitle: { fontSize: 18, fontWeight: '900', color: C.text },
  editInputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: C.textMuted, marginBottom: 7, letterSpacing: 0.5 },
  textInput: { borderWidth: 1, borderColor: C.border, padding: 11, borderRadius: 9, backgroundColor: C.bg, fontSize: 14, color: C.text, fontWeight: '500', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  editModalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 8 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, backgroundColor: C.bg },
  btnCancelText: { color: C.textSub, fontWeight: '800', fontSize: 13 },
  btnSave: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, backgroundColor: C.primary },
  btnSaveText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  notifMenuBox: { position: 'absolute', top: 70, right: 80, width: 370, maxHeight: 440, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, elevation: 14, shadowColor: '#1c1917', shadowOpacity: 0.12, shadowRadius: 22, overflow: 'hidden', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}) },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  notifTitle: { fontSize: 15, fontWeight: '900', color: C.text },
  btnOutlineNotif: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: C.primaryDim },
  notifAcknowledgeBtn: { fontSize: 11, color: C.primary, fontWeight: '800' },
  notifList: { flex: 1 },
  notifItem: { flexDirection: 'row', padding: 13, borderBottomWidth: 1, borderColor: C.border, alignItems: 'center' },
  notifIconBg: { width: 36, height: 36, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  notifContent: { flex: 1, paddingRight: 7 },
  notifMessage: { fontSize: 13, color: C.textSub, lineHeight: 18, fontWeight: '500' },
  notifTime: { fontSize: 11, color: C.textMuted, marginTop: 3, fontWeight: '600' },
  blueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  notifFooter: { padding: 12, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  btnViewDetails: { backgroundColor: C.surface, paddingVertical: 10, borderRadius: 9, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  btnViewDetailsText: { color: C.text, fontSize: 13, fontWeight: '800' },
});