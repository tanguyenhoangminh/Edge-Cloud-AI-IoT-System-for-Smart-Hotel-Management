import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ScrollView, Platform, Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import RoomsScreen from './screens/RoomsScreen';
import RoomDetailScreen from './screens/RoomDetailScreen';
import GuestsScreen from './screens/GuestsScreen';
import StaffScreen from './screens/StaffScreen';
import AlertsScreen from './screens/AlertsScreen';
import EnergyScreen from './screens/EnergyScreen';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const SIDEBAR_FULL_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

const PRIMARY = '#3b82f6';
const PRIMARY_LIGHT = '#bfdbfe';
const PRIMARY_BG = '#eff6ff';
const TEXT_DARK = '#1e293b';
const TEXT_MUTED = '#94a3b8';
const BORDER = '#e2e8f0';
const BG = '#f8fafc';

const IS_WEB = Platform.OS === 'web';

// ─────────────────────────────────────────────
// NAV GROUPS
// ─────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { id: 'Dashboard', icon: 'view-dashboard-outline', label: 'Dashboard' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { id: 'Rooms',       icon: 'home-outline',           label: 'Rooms' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { id: 'Energy',  icon: 'lightning-bolt',      label: 'Energy Management' },
      { id: 'Alerts',  icon: 'shield-alert-outline', label: 'System Alerts' },
    ],
  },
];

// ─────────────────────────────────────────────
// SIDEBAR COMPONENT (Cải tiến hỗ trợ Mobile Overlay)
// ─────────────────────────────────────────────
function Sidebar({ activeTab, onTabChange, onLogout, badges, collapsed, onToggleCollapse, onCloseMobile }) {
  // Nếu là mobile và đang thu gọn (collapsed) ở chế độ overlay -> Ẩn hoàn toàn
  if (!IS_WEB && collapsed) return null;

  return (
    <View style={[
      sidebarStyles.container, 
      collapsed ? sidebarStyles.collapsed : sidebarStyles.expanded,
      !IS_WEB && sidebarStyles.mobileOverlay // [MỚI] Biến thành menu nổi trên Mobile
    ]}>

      {/* Logo + Collapse/Close Toggle */}
      <View style={sidebarStyles.header}>
        {!collapsed && (
          <View style={sidebarStyles.logoArea}>
            <View style={sidebarStyles.logoIcon}>
              <MaterialCommunityIcons name="hexagon-multiple-outline" size={20} color="#fff" />
            </View>
            <Text style={sidebarStyles.logoText}>Hotel IoT</Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[sidebarStyles.collapseBtn, collapsed && { marginLeft: 'auto', marginRight: 'auto' }]}
          onPress={IS_WEB ? onToggleCollapse : onCloseMobile} // Mobile bấm vào đây là đóng menu
        >
          <MaterialCommunityIcons
            name={IS_WEB ? (collapsed ? 'chevron-right' : 'chevron-left') : 'close'}
            size={20}
            color={TEXT_MUTED}
          />
        </TouchableOpacity>
      </View>

      {/* Nav Groups */}
      <ScrollView style={sidebarStyles.nav} showsVerticalScrollIndicator={false}>
        {NAV_GROUPS.map((group, gi) => (
          <View key={gi} style={sidebarStyles.group}>
            {!collapsed && <Text style={sidebarStyles.groupLabel}>{group.label}</Text>}

            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              const badge = badges[item.id];
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    sidebarStyles.navItem,
                    isActive && sidebarStyles.navItemActive,
                    collapsed && sidebarStyles.navItemCollapsed,
                  ]}
                  onPress={() => {
                    onTabChange(item.id);
                    if (!IS_WEB) onCloseMobile(); // Đổi tab xong thì đóng menu luôn trên mobile
                  }}
                >
                  {isActive && <View style={sidebarStyles.activeAccent} />}

                  <MaterialCommunityIcons
                    name={item.icon}
                    size={21}
                    color={isActive ? PRIMARY : TEXT_MUTED}
                  />

                  {!collapsed && (
                    <Text style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}>
                      {item.label}
                    </Text>
                  )}

                  {badge > 0 && !collapsed && (
                    <View style={sidebarStyles.badge}>
                      <Text style={sidebarStyles.badgeText}>{badge}</Text>
                    </View>
                  )}
                  {badge > 0 && collapsed && (
                    <View style={sidebarStyles.badgeDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Logout */}
      <View style={sidebarStyles.footer}>
        <View style={sidebarStyles.footerDivider} />
        <TouchableOpacity
          style={[sidebarStyles.navItem, sidebarStyles.logoutItem, collapsed && sidebarStyles.navItemCollapsed]}
          onPress={onLogout}
        >
          <MaterialCommunityIcons name="logout" size={21} color="#ef4444" />
          {!collapsed && <Text style={sidebarStyles.logoutText}>Logout</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  container:       { backgroundColor: '#ffffff', borderRightWidth: 1, borderColor: BORDER, paddingVertical: 16, justifyContent: 'space-between' },
  expanded:        { width: SIDEBAR_FULL_WIDTH, paddingHorizontal: 12 },
  collapsed:       { width: SIDEBAR_COLLAPSED_WIDTH, paddingHorizontal: 0, alignItems: 'center' },
  
  // Style dành riêng để biến Sidebar thành Drawer tràn màn hình trên Điện thoại
  mobileOverlay:   {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: SIDEBAR_FULL_WIDTH, zIndex: 999,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10
  },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 },
  logoArea:        { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logoIcon:        { width: 34, height: 34, borderRadius: 9, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
  logoText:        { fontSize: 16, fontWeight: '800', color: TEXT_DARK, letterSpacing: -0.3 },
  collapseBtn:     { width: 30, height: 30, borderRadius: 8, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },

  nav:             { flex: 1 },
  group:           { marginBottom: 6 },
  groupLabel:      { fontSize: 10, fontWeight: '700', color: '#cbd5e1', letterSpacing: 1.2, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },

  navItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, position: 'relative', overflow: 'hidden' },
  navItemActive:   { backgroundColor: PRIMARY_BG },
  navItemCollapsed:{ justifyContent: 'center', paddingHorizontal: 0, width: 44, alignSelf: 'center', borderRadius: 10 },

  activeAccent:    { position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: PRIMARY },

  navLabel:        { fontSize: 14, fontWeight: '600', color: TEXT_MUTED, flex: 1 },
  navLabelActive:  { color: TEXT_DARK },

  badge:           { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  badgeText:       { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  badgeDot:        { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#fff' },

  footer:          { paddingHorizontal: 4 },
  footerDivider:   { height: 1, backgroundColor: BORDER, marginBottom: 10 },
  logoutItem:      { gap: 10 },
  logoutText:      { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab]   = useState('Dashboard');
  const [screenParams, setScreenParams] = useState({});
  
  // Nếu chạy trên Web thì mặc định mở rộng, nếu chạy trên App Mobile thì mặc định đóng ẩn đi
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!IS_WEB);

  const handleTabChange = useCallback((tabId, params = {}) => {
    setActiveTab(tabId);
    setScreenParams(params);
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setActiveTab('Dashboard');
    setScreenParams({});
    setSidebarCollapsed(!IS_WEB);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const badges = {};

  // ─────────────────────────────────────────────
  // SCREEN MAP
  // ─────────────────────────────────────────────
  const SCREENS = {
    Dashboard:   <DashboardScreen onNavigate={handleTabChange} />,

    Rooms: screenParams.room ? (
      <RoomDetailScreen
        route={{ params: screenParams.room }}
        navigation={{ goBack: () => handleTabChange('Rooms') }}
      />
    ) : (
      <RoomsScreen onRoomPress={(room) => handleTabChange('Rooms', { room })} />
    ),

    Energy:      <EnergyScreen />,
    Alerts:      <AlertsScreen />,
  };

  const ActiveScreen = SCREENS[activeTab] ?? <DashboardScreen onNavigate={handleTabChange} />;

  return (
    <SafeAreaView style={appStyles.safeArea}>
      
      {/* [MỚI THÊM] THANH TOPBAR CHO MOBILE ĐỂ BẤM MỞ MENU */}
      {!IS_WEB && (
        <View style={appStyles.mobileHeader}>
          <TouchableOpacity onPress={() => setSidebarCollapsed(false)} style={appStyles.menuBtn}>
            <MaterialCommunityIcons name="menu" size={24} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={appStyles.mobileTitle}>{activeTab}</Text>
          <View style={{ width: 40 }} /> {/* Tạo khoảng trống cân bằng */}
        </View>
      )}

      <View style={appStyles.shell}>
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          badges={badges}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onCloseMobile={() => setSidebarCollapsed(true)} // Hàm đóng riêng cho mobile
        />
        
        {/* Vùng mờ làm nền đen nhẹ khi mở Sidebar trên Mobile */}
        {!IS_WEB && !sidebarCollapsed && (
          <TouchableOpacity 
            activeOpacity={1} 
            style={appStyles.backdrop} 
            onPress={() => setSidebarCollapsed(true)} 
          />
        )}

        {/* Nội dung Màn hình chính */}
        <View style={appStyles.content}>
          {ActiveScreen}
        </View>
      </View>
    </SafeAreaView>
  );
}

const appStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff', paddingTop: Platform.OS === 'android' ? 35 : 0 },
  shell:    { flex: 1, flexDirection: 'row', backgroundColor: BG, position: 'relative' },
  content:  { flex: 1, backgroundColor: BG },
  
  // Style cho header mobile mới thêm
  mobileHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12
  },
  menuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  mobileTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK },
  

  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 99
  }
});