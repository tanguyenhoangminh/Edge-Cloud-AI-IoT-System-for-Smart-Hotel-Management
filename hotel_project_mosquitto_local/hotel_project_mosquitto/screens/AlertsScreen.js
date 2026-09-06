import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AlertsScreen() {
  const API_URL = 'https://backend-cz3y.onrender.com/api/alerts';
  
  // Giữ nguyên toàn bộ logic của bạn
  const [alertHistory, setAlertHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All'); 
  const [severityFilter, setSeverityFilter] = useState('All'); 

  // ==========================================
  // RESPONSIVE LOGIC: Xác định nền tảng & kích thước
  // ==========================================
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Bật chế độ Mobile nếu màn hình < 768px

  // ========================================================
  // 1. FETCH & MERGE DATA
  // ========================================================
  const fetchAlerts = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      
      setAlertHistory(prev => {
        let updatedHistory = [...prev];
        
        data.forEach(incomingAlert => {
          if (incomingAlert.type === 'Water Leak') {
              incomingAlert.severity = 'warning';
          }
          const uniqueId = `${incomingAlert.room_number}-${incomingAlert.type}`;
          const existingIndex = updatedHistory.findIndex(a => `${a.room_number}-${a.type}` === uniqueId);
          
          if (existingIndex >= 0) {
            updatedHistory[existingIndex].value = incomingAlert.value;
          } else {
            updatedHistory.unshift(incomingAlert);
          }
        });
        return updatedHistory;
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  // ========================================================
  // 2. CÁC HÀM XỬ LÝ TRẠNG THÁI (ACTIONS)
  // ========================================================
  const handleAcknowledge = (room_number, alert_type) => {
    setAlertHistory(prev => prev.map(a => 
      (a.room_number === room_number && a.type === alert_type) ? { ...a, status: 'Acknowledged' } : a
    ));
  };

  const handleResolve = async (room_number, alert_type) => {
    try {
      setAlertHistory(prev => prev.map(a => 
        (a.room_number === room_number && a.type === alert_type) ? { ...a, status: 'Resolved' } : a
      ));
      await fetch(`https://backend-cz3y.onrender.com/api/alerts/resolve/${room_number}/${alert_type}`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error("Resolve Error:", error);
    }
  };

  const handleAcknowledgeAll = () => {
    setAlertHistory(prev => prev.map(a => 
      a.status === 'Active' ? { ...a, status: 'Acknowledged' } : a
    ));
  };

  const handleResolveAll = async () => {
    const alertsToResolve = alertHistory.filter(a => a.status === 'Active' || a.status === 'Acknowledged');
    setAlertHistory(prev => prev.map(a => 
      (a.status === 'Active' || a.status === 'Acknowledged') ? { ...a, status: 'Resolved' } : a
    ));
    alertsToResolve.forEach(async (alert) => {
        try {
            await fetch(`https://backend-cz3y.onrender.com/api/alerts/resolve/${alert.room_number}/${alert.type}`, { method: 'PUT' });
        } catch (e) { console.error("Batch Resolve Error:", e); }
    });
  };

  // ========================================================
  // 3. THỐNG KÊ & LỌC HIỂN THỊ
  // ========================================================
  const stats = useMemo(() => {
    return {
      active: alertHistory.filter(a => a.status === 'Active').length,
      acknowledged: alertHistory.filter(a => a.status === 'Acknowledged').length,
      resolved: alertHistory.filter(a => a.status === 'Resolved').length,
      critical: alertHistory.filter(a => a.severity === 'critical').length,
    };
  }, [alertHistory]);

  const filteredAlerts = useMemo(() => {
    return alertHistory.filter(a => {
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const matchSeverity = severityFilter === 'All' || 
                           (severityFilter === 'Critical' && a.severity === 'critical') ||
                           (severityFilter === 'Warning' && a.severity === 'warning');
      return matchStatus && matchSeverity;
    });
  }, [alertHistory, statusFilter, severityFilter]);

  const getSeverityStyle = (severity) => {
    switch(severity) {
      case 'critical':
        return { borderAccent: '#ef4444', textBadge: '#ef4444', bgBadge: '#fef2f2', icon: '#ef4444' };
      case 'warning':
        return { borderAccent: '#f59e0b', textBadge: '#d97706', bgBadge: '#fef3c7', icon: '#f59e0b' };
      default:
        return { borderAccent: '#10b981', textBadge: '#10b981', bgBadge: '#dcfce7', icon: '#10b981' };
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'Active': return { bg: '#fee2e2', text: '#ef4444', icon: 'alert-circle-outline' };
      case 'Acknowledged': return { bg: '#eff6ff', text: '#3b82f6', icon: 'eye-check-outline' };
      case 'Resolved': return { bg: '#dcfce7', text: '#10b981', icon: 'check-circle-outline' };
      default: return { bg: '#f1f5f9', text: '#64748b', icon: 'information-outline' };
    }
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={isMobile && { marginBottom: 15 }}>
          <Text style={[styles.pageTitle, isMobile && { fontSize: 22 }]}>System Alerts Monitor</Text>
          <Text style={styles.subtitle}>Track, acknowledge, and resolve facility issues.</Text>
        </View>
        <View style={[styles.headerButtons, isMobile && styles.headerButtonsMobile]}>
          <TouchableOpacity style={[styles.ackAllBtn, isMobile && { flex: 1, justifyContent: 'center' }]} onPress={handleAcknowledgeAll}>
            <MaterialCommunityIcons name="playlist-check" size={18} color="#3b82f6" />
            <Text style={styles.ackAllText}>Ack All ({stats.active})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.resAllBtn, isMobile && { flex: 1, justifyContent: 'center' }]} onPress={handleResolveAll}>
            <MaterialCommunityIcons name="wrench-cog" size={18} color="#fff" />
            <Text style={styles.resAllText}>Resolve All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollArea, isMobile && { padding: 15 }]} showsVerticalScrollIndicator={false}>
        
        {/* SUMMARY CARDS */}
        <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
          <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
            <View style={[styles.statIconBg, { backgroundColor: '#fef2f2' }]}><MaterialCommunityIcons name="alert-circle" size={24} color="#ef4444" /></View>
            <View>
              <Text style={[styles.statNumber, {color: '#ef4444'}]}>{stats.active}</Text>
              <Text style={styles.statLabel}>Active Alerts</Text>
            </View>
          </View>
          <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
            <View style={[styles.statIconBg, { backgroundColor: '#eff6ff' }]}><MaterialCommunityIcons name="eye-check" size={24} color="#3b82f6" /></View>
            <View>
              <Text style={[styles.statNumber, {color: '#3b82f6'}]}>{stats.acknowledged}</Text>
              <Text style={styles.statLabel}>Acknowledged</Text>
            </View>
          </View>
          <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
            <View style={[styles.statIconBg, { backgroundColor: '#f0fdf4' }]}><MaterialCommunityIcons name="check-decagram" size={24} color="#10b981" /></View>
            <View>
              <Text style={[styles.statNumber, {color: '#10b981'}]}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>
          <View style={[styles.statCard, isMobile && styles.statCardMobile]}>
            <View style={[styles.statIconBg, { backgroundColor: '#fef2f2' }]}><MaterialCommunityIcons name="fire-alert" size={24} color="#b91c1c" /></View>
            <View>
              <Text style={[styles.statNumber, {color: '#b91c1c'}]}>{stats.critical}</Text>
              <Text style={styles.statLabel}>Critical Level</Text>
            </View>
          </View>
        </View>

        {/* BỘ LỌC (FILTERS) */}
        <View style={[styles.filterArea, isMobile && styles.filterAreaMobile]}>
          <View style={[styles.filterGroup, isMobile && { flexWrap: 'wrap' }]}>
            <Text style={styles.filterTitle}>Status:</Text>
            {['All', 'Active', 'Acknowledged', 'Resolved'].map(s => (
              <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.pillBtn, statusFilter === s && styles.pillActive]}>
                <Text style={[styles.pillText, statusFilter === s && styles.pillTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={[styles.filterDivider, isMobile && styles.filterDividerMobile]} />
          
          <View style={[styles.filterGroup, isMobile && { flexWrap: 'wrap' }]}>
            <Text style={styles.filterTitle}>Severity:</Text>
            {['All', 'Critical', 'Warning', 'Info'].map(s => (
              <TouchableOpacity key={s} onPress={() => setSeverityFilter(s)} style={[styles.pillBtn, severityFilter === s && styles.pillActive]}>
                <Text style={[styles.pillText, severityFilter === s && styles.pillTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.countText, isMobile && { width: '100%', marginTop: 5 }]}>{filteredAlerts.length} shown</Text>
          </View>
        </View>

        {/* ALERTS LIST */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} />
        ) : filteredAlerts.length === 0 ? (
          <View style={styles.emptyState}>
             <View style={styles.emptyIconBg}><MaterialCommunityIcons name="shield-check" size={60} color="#10b981" /></View>
             <Text style={styles.emptyStateTitle}>System is Secure</Text>
             <Text style={styles.emptyStateSub}>There are no matching alerts in the history.</Text>
          </View>
        ) : (
          filteredAlerts.map((alert, index) => {
            const theme = getSeverityStyle(alert.severity);
            const statusStyle = getStatusStyle(alert.status);
            const isResolved = alert.status === 'Resolved';

            return (
              <View key={index} style={[styles.alertCard, { borderLeftColor: isResolved ? '#cbd5e1' : theme.borderAccent }, isResolved && { opacity: 0.65 }, isMobile && styles.alertCardMobile]}>
                
                {/* Bọc Icon và Content thành 1 hàng ngang để giữ cấu trúc khi xuống dòng ở Mobile */}
                <View style={{ flexDirection: 'row', flex: 1, width: isMobile ? '100%' : 'auto' }}>
                  <View style={styles.iconContainer}>
                    <MaterialCommunityIcons 
                      name={alert.type.includes('Leak') ? "water-alert" : alert.type.includes('Smoke') ? "fire-alert" : alert.type.includes('Alarm') ? "volume-high" : "alert"} 
                      size={28} 
                      color={isResolved ? '#94a3b8' : theme.icon} 
                    />
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.alertTitle, isResolved && {color: '#64748b'}]}>{alert.type}</Text>
                      
                      {!isResolved && (
                        <View style={[styles.badge, { backgroundColor: theme.bgBadge }]}>
                          <Text style={[styles.badgeText, { color: theme.textBadge }]}>{alert.severity}</Text>
                        </View>
                      )}

                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <MaterialCommunityIcons name={statusStyle.icon} size={12} color={statusStyle.text} style={{marginRight: 4}} />
                        <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{alert.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.alertMessage}>{alert.message}</Text>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}><MaterialCommunityIcons name="door" size={14} color="#94a3b8" /><Text style={styles.metaText}>Room {alert.room_number}</Text></View>
                      <Text style={styles.metaDot}>•</Text>
                      <View style={styles.metaItem}><MaterialCommunityIcons name="layers" size={14} color="#94a3b8" /><Text style={styles.metaText}>Floor {alert.floor}</Text></View>
                      <Text style={styles.metaDot}>•</Text>
                      <View style={styles.metaItem}><MaterialCommunityIcons name="router-wireless" size={14} color="#94a3b8" /><Text style={styles.metaText}>{alert.sensor}</Text></View>
                      <Text style={styles.metaDot}>•</Text>
                      <View style={styles.metaItem}><Text style={styles.metaText}>Value: <Text style={{ color: isResolved ? '#64748b' : theme.textBadge, fontWeight: 'bold' }}>{alert.value}</Text></Text></View>
                    </View>
                  </View>
                </View>

                {/* Các nút Hành động được đẩy xuống dòng nếu ở Mobile */}
                {!isResolved && (
                  <View style={[styles.actionButtons, isMobile && styles.actionButtonsMobile]}>
                    {alert.status === 'Active' && (
                      <TouchableOpacity style={[styles.btnAck, isMobile && { flex: 1 }]} onPress={() => handleAcknowledge(alert.room_number, alert.type)}>
                        <Text style={styles.btnAckText}>Acknowledge</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.btnRes, isMobile && { flex: 1 }]} onPress={() => handleResolve(alert.room_number, alert.type)}>
                      <Text style={styles.btnResText}>Resolve Issue</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' }, 
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 30, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerMobile: { flexDirection: 'column', alignItems: 'flex-start', padding: 20 },
  
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 5 },
  
  headerButtons: { flexDirection: 'row', gap: 12 },
  headerButtonsMobile: { width: '100%' },
  
  ackAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  ackAllText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
  resAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  resAllText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  scrollArea: { padding: 30, paddingBottom: 50 },

  // STATS RESPONSIVE
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 25 },
  statsRowMobile: { flexWrap: 'wrap', gap: 15 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 15, elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
  statCardMobile: { flex: undefined, minWidth: '47%' }, // Lưới 2x2 trên mobile
  
  statIconBg: { padding: 12, borderRadius: 12 },
  statNumber: { fontSize: 26, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  // FILTERS RESPONSIVE
  filterArea: { flexDirection: 'row', marginBottom: 25, alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  filterAreaMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  
  filterGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterTitle: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginRight: 5 },
  filterDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0', marginHorizontal: 20 },
  filterDividerMobile: { width: '100%', height: 1, marginVertical: 15, marginHorizontal: 0 },
  
  pillBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  pillActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  pillText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  pillTextActive: { color: '#fff', fontWeight: 'bold' },
  countText: { color: '#94a3b8', fontSize: 13, marginLeft: 'auto', fontStyle: 'italic' },

  // EMPTY STATE
  emptyState: { alignItems: 'center', marginTop: 60, padding: 40, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  emptyIconBg: { backgroundColor: '#dcfce7', padding: 20, borderRadius: 40, marginBottom: 15 },
  emptyStateTitle: { color: '#0f172a', fontSize: 20, fontWeight: 'bold' },
  emptyStateSub: { color: '#64748b', fontSize: 14, marginTop: 5 },

  // ALERT CARDS RESPONSIVE
  alertCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5, elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
  alertCardMobile: { flexDirection: 'column', alignItems: 'flex-start' },
  
  iconContainer: { marginRight: 20, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, justifyContent: 'center' },
  
  cardHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  alertTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },

  alertMessage: { fontSize: 14, color: '#475569', marginBottom: 15, lineHeight: 20 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  metaDot: { fontSize: 12, color: '#cbd5e1' },

  actionButtons: { justifyContent: 'center', alignItems: 'flex-end', gap: 10, marginLeft: 20 },
  actionButtonsMobile: { flexDirection: 'row', width: '100%', marginLeft: 0, marginTop: 20, justifyContent: 'flex-start' },
  
  btnAck: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', minWidth: 120 },
  btnAckText: { color: '#475569', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  btnRes: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#10b981', minWidth: 120 },
  btnResText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
});