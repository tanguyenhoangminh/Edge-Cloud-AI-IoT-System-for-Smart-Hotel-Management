import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function EnergyScreen() {
  const [roomData, setRoomData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State cho Tìm kiếm và Lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('All');
  
  // State cho Sắp xếp (Sort)
  const [sortConfig, setSortConfig] = useState({ key: 'energy', direction: 'desc' });

  const PRICE_PER_KWH = 2000;

  // ==========================================
  // RESPONSIVE LOGIC
  // ==========================================
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Kích hoạt mode Mobile nếu < 768px

  const fetchEnergyData = async () => {
    try {
      const [roomsRes, iotAllRes] = await Promise.all([
        fetch('https://backend-cz3y.onrender.com/api/rooms'),
        fetch('https://backend-cz3y.onrender.com/api/iot/all'),
      ]);
      const rooms = await roomsRes.json();
      const iotAll = iotAllRes.ok ? await iotAllRes.json() : [];

      // Map iot data by room_number for O(1) lookup
      const iotMap = {};
      iotAll.forEach(d => { iotMap[d.room_number] = d; });

      const combinedData = rooms.map(room => {
        const iot = iotMap[room.room_number] || {};
        return {
          ...room,
          energy: Number(iot.energy) || 0,
          main_power: !!iot.main_power,
        };
      });

      setRoomData(combinedData);
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu năng lượng:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnergyData();
    const interval = setInterval(fetchEnergyData, 3000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const totalEnergy = roomData.reduce((sum, room) => sum + room.energy, 0);
    const offlineRooms = roomData.filter(room => !room.main_power).length;
    const activeRoomsCount = roomData.length || 1;
    
    return {
      total: totalEnergy.toFixed(1),
      cost: (totalEnergy * PRICE_PER_KWH).toLocaleString('vi-VN'),
      avg: (totalEnergy / activeRoomsCount).toFixed(1),
      offline: offlineRooms
    };
  }, [roomData]);

  const topConsumers = useMemo(() => {
    return [...roomData]
      .sort((a, b) => b.energy - a.energy)
      .slice(0, 5);
  }, [roomData]);

  const availableFloors = useMemo(() => {
    const floors = new Set(roomData.map(r => r.floor));
    return ['All', ...Array.from(floors).sort()];
  }, [roomData]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const processedRooms = useMemo(() => {
    let result = [...roomData];

    if (selectedFloor !== 'All') {
      result = result.filter(r => String(r.floor) === String(selectedFloor));
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(room => 
        room.room_number.toLowerCase().includes(lowerQuery) ||
        room.type.toLowerCase().includes(lowerQuery) ||
        room.status.toLowerCase().includes(lowerQuery)
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [roomData, searchQuery, selectedFloor, sortConfig]);

  const renderSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return <MaterialCommunityIcons name="unfold-more-horizontal" size={16} color="#cbd5e1" />;
    return <MaterialCommunityIcons name={sortConfig.direction === 'asc' ? "arrow-up" : "arrow-down"} size={16} color="#3b82f6" />;
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'available': return { bg: '#dcfce7', text: '#16a34a' };
      case 'occupied': return { bg: '#fef3c7', text: '#d97706' };
      case 'cleaning': return { bg: '#eff6ff', text: '#3b82f6' };
      case 'maintenance': return { bg: '#fee2e2', text: '#ef4444' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const weeklyData = [
    { day: 'Mon', val: 120 }, { day: 'Tue', val: 194.4 }, { day: 'Wed', val: 188.8 },
    { day: 'Thu', val: 183.2 }, { day: 'Fri', val: 177.5 }, { day: 'Sat', val: 171.9 }, { day: 'Sun', val: 166.3 }
  ];
  const maxWeeklyVal = Math.max(...weeklyData.map(d => d.val));

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, isMobile && { paddingHorizontal: 15, paddingVertical: 20 }]}>
        <View style={isMobile && { flex: 1, paddingRight: 10 }}>
          <Text style={[styles.pageTitle, isMobile && { fontSize: 22 }]}>Energy Monitoring</Text>
          <Text style={[styles.subtitle, isMobile && { fontSize: 12 }]} numberOfLines={2}>Real-time power consumption across all rooms</Text>
        </View>
        <View style={styles.badgeActive}>
          <View style={styles.dot} />
          <Text style={styles.badgeText}>Live Sync</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollArea, isMobile && { padding: 15 }]} showsVerticalScrollIndicator={false}>
        
        {isLoading && roomData.length === 0 ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{marginTop: 50}} />
        ) : (
          <>
            {/* 1. THỐNG KÊ TỔNG QUAN */}
            <View style={[styles.statsRow, isMobile && styles.flexColumn]}>
              <View style={[styles.statCard, isMobile && styles.fullWidth]}>
                <View style={[styles.iconBg, {backgroundColor: '#eff6ff'}]}><MaterialCommunityIcons name="lightning-bolt" size={24} color="#3b82f6" /></View>
                <Text style={[styles.statNumber, {color: '#3b82f6'}]}>{stats.total} <Text style={styles.unitText}>kWh</Text></Text>
                <Text style={styles.statLabel}>Total This Month</Text>
              </View>
              <View style={[styles.statCard, isMobile && styles.fullWidth]}>
                <View style={[styles.iconBg, {backgroundColor: '#fef2f2'}]}><MaterialCommunityIcons name="cash-multiple" size={24} color="#ef4444" /></View>
                <Text style={[styles.statNumber, {color: '#ef4444'}]}>{stats.cost}₫</Text>
                <Text style={styles.statLabel}>Monthly Cost</Text>
              </View>
              <View style={[styles.statCard, isMobile && styles.fullWidth]}>
                <View style={[styles.iconBg, {backgroundColor: '#f0fdf4'}]}><MaterialCommunityIcons name="chart-line-variant" size={24} color="#10b981" /></View>
                <Text style={[styles.statNumber, {color: '#10b981'}]}>{stats.avg} <Text style={styles.unitText}>kWh</Text></Text>
                <Text style={styles.statLabel}>Avg per Room/Day</Text>
              </View>
              <View style={[styles.statCard, isMobile && styles.fullWidth]}>
                <View style={[styles.iconBg, {backgroundColor: '#f1f5f9'}]}><MaterialCommunityIcons name="power-plug-off" size={24} color="#64748b" /></View>
                <Text style={[styles.statNumber, {color: '#64748b'}]}>{stats.offline}</Text>
                <Text style={styles.statLabel}>Rooms Main Power OFF</Text>
              </View>
            </View>

            {/* 2. KHU VỰC BIỂU ĐỒ & TOP TIÊU THỤ */}
            <View style={[styles.midSection, isMobile && styles.flexColumn]}>
              <View style={[styles.cardContainer, styles.flex2, isMobile && styles.fullWidth]}>
                <Text style={styles.cardTitle}>Weekly Consumption (kWh)</Text>
                <View style={styles.chartContainer}>
                  {weeklyData.map((item, idx) => (
                    <View key={idx} style={styles.barWrapper}>
                      <Text style={styles.barValue}>{item.val}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: (item.val / maxWeeklyVal) * 120 }]} />
                      </View>
                      <Text style={styles.barLabel}>{item.day}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.cardContainer, styles.flex3, isMobile && styles.fullWidth]}>
                <Text style={styles.cardTitle}>Top Consumers (This Month)</Text>
                <View style={styles.topConsumersList}>
                  {topConsumers.map((room, idx) => {
                    const maxTopEnergy = topConsumers[0]?.energy || 1;
                    const percentage = (room.energy / maxTopEnergy) * 100;
                    const barColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];
                    
                    return (
                      <View key={idx} style={styles.consumerRow}>
                        <View style={styles.consumerHeader}>
                          <Text style={styles.consumerName}>Room {room.room_number} <Text style={styles.consumerType}>• {room.type}</Text></Text>
                          <Text style={styles.consumerVal}>{room.energy.toFixed(1)} kWh</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { flex: percentage / 100, backgroundColor: barColors[idx] || '#cbd5e1' }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 3. BẢNG CHI TIẾT ĐIỆN NĂNG TỪNG PHÒNG */}
            <View style={[styles.cardContainer, styles.tableCard, isMobile && { backgroundColor: 'transparent', borderWidth: 0, elevation: 0 }]}>
              
              <View style={[styles.tableToolbar, isMobile && styles.tableToolbarMobile]}>
                <Text style={styles.cardTitleNoMargin}>Energy Breakdown</Text>
                
                <View style={[styles.toolbarActions, isMobile && styles.toolbarActionsMobile]}>
                  <View style={[styles.floorFilterContainer, isMobile && { flexWrap: 'wrap', gap: 6 }]}>
                    <Text style={styles.filterLabel}>Filter by Floor:</Text>
                    {availableFloors.map(floor => (
                      <TouchableOpacity 
                        key={floor} 
                        style={[styles.floorChip, selectedFloor === floor && styles.floorChipActive]}
                        onPress={() => setSelectedFloor(floor)}
                      >
                        <Text style={[styles.floorChipText, selectedFloor === floor && styles.floorChipTextActive]}>
                          {floor === 'All' ? 'All Floors' : `F${floor}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={[styles.searchBox, isMobile && { width: '100%', marginTop: 5 }]}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
                    <TextInput 
                      style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                      placeholder="Search room..."
                      placeholderTextColor="#94a3b8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <MaterialCommunityIcons name="close-circle" size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              
              {/* ======================================================= */}
              {/* ĐÃ FIX LỖI CO RÚM TABLE TRÊN WEB Ở ĐÂY                    */}
              {/* ======================================================= */}
              {isMobile ? (
                <View style={styles.mobileListContainer}>
                  
                  {/* Nút Sort cho Mobile */}
                  <View style={styles.mobileSortRow}>
                    <Text style={styles.filterLabel}>Sort by:</Text>
                    <TouchableOpacity style={styles.mobileSortBtn} onPress={() => requestSort('energy')}>
                      <Text style={styles.mobileSortBtnText}>Energy/Cost</Text>
                      {renderSortIcon('energy')}
                    </TouchableOpacity>
                  </View>

                  {processedRooms.length === 0 ? (
                    <View style={styles.noDataBox}><Text style={styles.noDataText}>No rooms match your filter.</Text></View>
                  ) : (
                    processedRooms.map((room, idx) => {
                      const statusStyle = getStatusColor(room.status);
                      return (
                        <View key={idx} style={styles.mobileRoomCard}>
                          <View style={styles.mobileRoomHeader}>
                            <View>
                              <Text style={styles.mobileRoomTitle}>Room {room.room_number}</Text>
                              <Text style={styles.mobileRoomSub}>{room.type} • Floor {room.floor}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                              </Text>
                            </View>
                          </View>
                          
                          <View style={styles.mobileRoomData}>
                            <View style={styles.mobileDataItem}>
                              <Text style={styles.mobileDataLabel}>Monthly (kWh)</Text>
                              <Text style={[styles.mobileDataValue, {color: '#3b82f6'}]}>{room.energy.toFixed(2)}</Text>
                            </View>
                            <View style={styles.mobileDataItem}>
                              <Text style={styles.mobileDataLabel}>Est. Cost</Text>
                              <Text style={[styles.mobileDataValue, {color: '#ef4444'}]}>
                                {(room.energy * PRICE_PER_KWH).toLocaleString('vi-VN')} ₫
                              </Text>
                            </View>
                          </View>
                        </View>
                      )
                    })
                  )}
                </View>
              ) : (
                // TRÊN WEB: Ép thẳng Width 100% thay vì dùng ScrollView ngang
                <View style={{ width: '100%' }}>
                  <View style={styles.tableHeader}>
                    <View style={styles.colRoom}><Text style={styles.th}>ROOM</Text></View>
                    <View style={styles.colFloor}><Text style={styles.th}>FLOOR</Text></View>
                    <View style={styles.colType}><Text style={styles.th}>ROOM TYPE</Text></View>
                    
                    <TouchableOpacity style={[styles.colNum, styles.sortableHeader]} onPress={() => requestSort('energy')}>
                      <Text style={[styles.th, styles.textRight]}>MONTHLY (kWh)</Text>
                      {renderSortIcon('energy')}
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.colNum, styles.sortableHeader]} onPress={() => requestSort('energy')}>
                      <Text style={[styles.th, styles.textRight]}>EST. COST (VND)</Text>
                      {renderSortIcon('energy')} 
                    </TouchableOpacity>
                    
                    <View style={styles.colStatus}><Text style={[styles.th, styles.textRight]}>STATUS</Text></View>
                  </View>

                  {processedRooms.length === 0 ? (
                    <View style={styles.noDataBox}>
                      <Text style={styles.noDataText}>No rooms match your filter.</Text>
                    </View>
                  ) : (
                    processedRooms.map((room, idx) => {
                      const statusStyle = getStatusColor(room.status);
                      
                      return (
                        <View key={idx} style={styles.tableRow}>
                          <View style={styles.colRoom}><Text style={[styles.td, styles.tdBold]}>{room.room_number}</Text></View>
                          <View style={styles.colFloor}><Text style={styles.td}>Floor {room.floor}</Text></View>
                          <View style={styles.colType}><Text style={styles.td}>{room.type}</Text></View>
                          
                          <View style={styles.colNum}>
                            <Text style={[styles.td, styles.textRight, {color: '#3b82f6', fontWeight: 'bold'}]}>
                              {room.energy.toFixed(2)}
                            </Text>
                          </View>
                          
                          <View style={styles.colNum}>
                            <Text style={[styles.td, styles.textRight, {color: '#ef4444', fontWeight: 'bold'}]}>
                              {(room.energy * PRICE_PER_KWH).toLocaleString('vi-VN')} ₫
                            </Text>
                          </View>
                          
                          <View style={styles.colStatus}>
                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 30, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 5 },
  
  badgeActive: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 },
  badgeText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },

  scrollArea: { padding: 30, paddingBottom: 50 },

  flexColumn: { flexDirection: 'column' },
  fullWidth: { width: '100%', flex: undefined },
  tableToolbarMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 15, paddingHorizontal: 0, paddingBottom: 15 },
  toolbarActionsMobile: { flexDirection: 'column', alignItems: 'flex-start', width: '100%' },

  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 22, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  iconBg: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  statNumber: { fontSize: 28, fontWeight: '900', marginBottom: 5 },
  unitText: { fontSize: 16, fontWeight: '600' },
  statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  midSection: { flexDirection: 'row', gap: 20, marginBottom: 25 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  
  cardContainer: { backgroundColor: '#fff', padding: 25, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  cardTitleNoMargin: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },

  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180, paddingTop: 20 },
  barWrapper: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 11, color: '#3b82f6', fontWeight: 'bold', marginBottom: 8 },
  barTrack: { width: '50%', height: 120, backgroundColor: '#f1f5f9', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#3b82f6', borderRadius: 8 },
  barLabel: { fontSize: 12, color: '#64748b', marginTop: 10, fontWeight: '500' },

  topConsumersList: { gap: 16 },
  consumerRow: { marginBottom: 5 },
  consumerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  consumerName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  consumerType: { fontSize: 12, color: '#94a3b8', fontWeight: 'normal' },
  consumerVal: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  progressFill: { height: 8, borderRadius: 4 },

  tableCard: { paddingHorizontal: 0, paddingTop: 0 },
  
  tableToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  
  floorFilterContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: 13, color: '#64748b', fontWeight: 'bold', marginRight: 5 },
  floorChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  floorChipActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  floorChipText: { fontSize: 12, color: '#475569', fontWeight: 'bold' },
  floorChipTextActive: { color: '#3b82f6' },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, width: 220, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },

  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingHorizontal: 25, paddingVertical: 15, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  th: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5 },
  
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 25, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  td: { fontSize: 13, color: '#475569' },
  tdBold: { fontWeight: 'bold', color: '#0f172a' },
  
  colRoom: { flex: 1 },
  colFloor: { flex: 1 },
  colType: { flex: 1.5 },
  colNum: { flex: 2, paddingRight: 20 },
  colStatus: { flex: 1.5, alignItems: 'flex-end' },
  
  textRight: { textAlign: 'right' },
  sortableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  noDataBox: { padding: 50, alignItems: 'center' },
  noDataText: { color: '#94a3b8', fontStyle: 'italic', fontSize: 14 },

  // ==========================================
  // MOBILE CARD LIST STYLES (Thay thế Bảng)
  // ==========================================
  mobileListContainer: { paddingTop: 10 },
  mobileSortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 15 },
  mobileSortBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  mobileSortBtnText: { fontSize: 13, fontWeight: 'bold', color: '#3b82f6', marginRight: 4 },
  
  mobileRoomCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  mobileRoomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15, marginBottom: 15 },
  mobileRoomTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  mobileRoomSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  
  mobileRoomData: { flexDirection: 'row', justifyContent: 'space-between' },
  mobileDataItem: { flex: 1 },
  mobileDataLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  mobileDataValue: { fontSize: 16, fontWeight: 'bold' },
});