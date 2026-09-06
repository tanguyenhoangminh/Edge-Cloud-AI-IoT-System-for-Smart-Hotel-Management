import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Image, TouchableWithoutFeedback, ActivityIndicator, useWindowDimensions, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons, AntDesign, Ionicons } from '@expo/vector-icons';

export default function RoomsScreen({ onRoomPress }) {
  // State tìm kiếm, tầng và phân trang
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFloor, setActiveFloor] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  // State Bộ lọc Dropdowns
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterGuests, setFilterGuests] = useState('All'); 
  
  // State quản lý hiển thị Dropdown & View Mode
  const [activeDropdown, setActiveDropdown] = useState(null); 
  const [activeEditDropdown, setActiveEditDropdown] = useState(null); 
  const [viewMode, setViewMode] = useState('list'); 
  
  // State sắp xếp
  const [sortBy, setSortBy] = useState('price'); 
  const [sortOrder, setSortOrder] = useState('asc'); 
  
  // Modal State
  const [previewRoom, setPreviewRoom] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});

  // --- LOGIC BOOKING ---
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  
  // ĐÃ THÊM: State chọn Mode
  const [bookingMode, setBookingMode] = useState('Guest'); // 'Guest' hoặc 'Staff'

  // State Khách hàng
  const [allGuests, setAllGuests] = useState([]); 
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [payStatus, setPayStatus] = useState('unpaid');
  const [showPayDropdown, setShowPayDropdown] = useState(false);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');

  // ĐÃ THÊM: State Nhân viên
  const [allStaff, setAllStaff] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [taskType, setTaskType] = useState('cleaning');
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);

  // ==========================================
  // STATE DỮ LIỆU TỪ API
  // ==========================================
  const [roomsData, setRoomsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ĐỊA CHỈ API
  const API_URL = 'https://backend-cz3y.onrender.com/api/rooms';
  const PREDICTION_LATEST_URL = 'https://backend-cz3y.onrender.com/api/prediction/latest';

  // ==========================================
  // RESPONSIVE LOGIC: Bắt chiều rộng để đổi Layout
  // ==========================================
  const { width } = useWindowDimensions();
  const isMobile = width < 768; // Kích hoạt mode Mobile nếu < 768px

  // 1. DATA ĐỊA PHƯƠNG
  const roomTypesLocal = {
    'Single': { area: '20 m²', bed: '1 Single Bed', images: { main: require('../assets/single_main.png'), t1: require('../assets/single_t1.png'), t2: require('../assets/single_t2.png'), t3: require('../assets/single_t3.png')}, features: ['City view', 'Work desk', 'Compact design'], facilities: [{icon: 'wifi', name: 'High-speed Wi-Fi'}, {icon: 'television', name: 'Smart TV'}], amenities: ['Bottled water', 'Basic toiletries'] },
    'Standard': { area: '25 m²', bed: '1 Queen Bed', images: { main: require('../assets/standard_main.png'), t1: require('../assets/standard_t1.png'), t2: require('../assets/standard_t2.png'), t3: require('../assets/standard_t3.png')}, features: ['City view', 'Work desk with chair', 'Soundproof windows'], facilities: [{icon: 'wifi', name: 'High-speed Wi-Fi'}, {icon: 'air-conditioner', name: 'Air conditioning'}], amenities: ['Complimentary bottled water', 'Daily housekeeping'] },
    'Deluxe': { area: '35 m²', bed: '1 King Bed', images: { main: require('../assets/deluxe_main.png'), t1: require('../assets/deluxe_t1.png'), t2: require('../assets/deluxe_t2.png'), t3: require('../assets/deluxe_t3.png')}, features: ['Private balcony', 'Spacious layout'], facilities: [{icon: 'safe', name: 'In-room safe'}, {icon: 'fridge-outline', name: 'Mini-fridge'}], amenities: ['Luxury toiletries', 'Coffee/tea maker'] },
    'Executive': { area: '45 m²', bed: '1 King Bed', images: { main: require('../assets/executive_main.png'), t1: require('../assets/executive_t1.png'), t2: require('../assets/executive_t2.png'), t3: require('../assets/executive_t3.png')}, features: ['Lounge access', 'High-floor views'], facilities: [{icon: 'printer', name: 'In-room printing'}], amenities: ['Shoe shine service', 'Evening turndown'] },
    'Suite': { area: '60 m²', bed: '1 Super King', images: { main: require('../assets/suite_main.png'), t1: require('../assets/suite_t1.png'), t2: require('../assets/suite_t2.png'), t3: require('../assets/suite_t3.png')}, features: ['Separate living area', 'Panoramic views'], facilities: [{icon: 'silverware-fork-knife', name: 'Kitchenette'}], amenities: ['Butler service', 'Welcome wine'] },
    'Family': { area: '50 m²', bed: '2 Queen Beds', images: { main: require('../assets/family_main.png'), t1: require('../assets/family_t1.png'), t2: require('../assets/family_t2.png'), t3: require('../assets/family_t3.png')}, features: ['Connecting rooms available', 'Child-proofing'], facilities: [{icon: 'gamepad-variant-outline', name: 'Gaming console'}], amenities: ['Kid-friendly toiletries'] },
  };

  const fetchRooms = async () => {
    try {
      const [response, predRes] = await Promise.all([
        fetch(API_URL),
        fetch(PREDICTION_LATEST_URL).catch(() => null) // không để lỗi prediction làm hỏng cả trang phòng
      ]);
      const apiData = await response.json();

      let predictionMap = {};
      if (predRes && predRes.ok) {
        const predictions = await predRes.json();
        predictions.forEach(p => { predictionMap[p.room_number] = p; });
      }

      if (Array.isArray(apiData)) {
        const mergedData = apiData.map(room => {
          const localDetails = roomTypesLocal[room.type] || roomTypesLocal['Standard'];
          const pred = predictionMap[room.room_number];
          return {
            ...localDetails,
            ...room,
            ai_predicted_occupied: pred ? !!pred.predicted_occupied : null,
            ai_probability: pred ? Number(pred.probability) : null,
          };
        });
        setRoomsData(mergedData);
      }
    } catch (error) {
      console.error("Lỗi Fetch Data Rooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); 
    return () => clearInterval(interval);
  }, []);

  const floors = useMemo(() => {
    if (roomsData.length === 0) return [1];
    return [...new Set(roomsData.map(r => r.floor))].sort((a, b) => a - b);
  }, [roomsData]);

  const statusCounts = useMemo(() => {
    const counts = { available: 0, occupied: 0, maintenance: 0, cleaning: 0 };
    roomsData.forEach(r => { if(counts[r.status] !== undefined) counts[r.status]++; });
    return counts;
  }, [roomsData]);

  const getAvailabilityInfo = (type) => {
    const total = roomsData.filter(r => r.type === type).length;
    const available = roomsData.filter(r => r.type === type && r.status === 'available').length;
    return { total, available };
  };

  const isGlobalFilterActive = searchQuery.trim() !== '' || filterStatus !== 'All' || filterType !== 'All' || filterGuests !== 'All';

  const processedData = useMemo(() => {
    let filtered = roomsData;

    if (viewMode === 'map' || isGlobalFilterActive) {
      if (searchQuery.trim() !== '') {
        filtered = filtered.filter(room => 
          room.room_number.includes(searchQuery) || room.type.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      if (filterStatus !== 'All') filtered = filtered.filter(room => room.status === filterStatus);
      if (filterType !== 'All') filtered = filtered.filter(room => room.type === filterType);
      if (filterGuests !== 'All') filtered = filtered.filter(room => room.occupancy.toString() === filterGuests);
    } else {
      filtered = filtered.filter(room => room.floor === activeFloor);
    }

    const parseNum = (str) => parseInt(str?.toString().replace(/\D/g, '') || '0', 10);
    filtered.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'price') { valA = parseNum(a.price); valB = parseNum(b.price); } 
      else if (sortBy === 'area') { valA = parseNum(a.area); valB = parseNum(b.area); } 
      else if (sortBy === 'availability') {
        valA = getAvailabilityInfo(a.type).available; valB = getAvailabilityInfo(b.type).available;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }, [searchQuery, activeFloor, filterStatus, filterType, filterGuests, sortBy, sortOrder, isGlobalFilterActive, viewMode, roomsData]);

  const ITEMS_PER_PAGE = viewMode === 'list' ? 6 : roomsData.length; 
  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));
  const paginatedRooms = processedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFloor, filterStatus, filterType, filterGuests, sortBy, sortOrder, viewMode]);

  const getPageNumbers = () => {
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    return Array.from({ length: (endPage - startPage) + 1 }, (_, i) => startPage + i);
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'available': return { color: '#4d7c0f', bg: '#ecfccb', label: 'Available' };
      case 'occupied': return { color: '#b45309', bg: '#fef3c7', label: 'Occupied' };
      case 'cleaning': return { color: '#1d4ed8', bg: '#dbeafe', label: 'Cleaning' };
      case 'maintenance': return { color: '#b91c1c', bg: '#fee2e2', label: 'Maintenance' };
      default: return { color: '#64748b', bg: '#f8fafc', label: 'Unknown' };
    }
  };

  const openModal = (room) => {
    setPreviewRoom(room);
    setEditedData({ 
        area: room.area, 
        bed: room.bed, 
        occupancy: room.occupancy?.toString(), 
        desc: room.desc, 
        price: room.price, 
        status: room.status 
    });
    setIsEditing(false);
  };

  const dropdownOptions = {
    status: ['All', 'available', 'occupied', 'cleaning', 'maintenance'],
    type: ['All', 'Single', 'Standard', 'Deluxe', 'Executive', 'Suite', 'Family'],
    guests: ['All', '1', '2', '3', '4']
  };

  const editSelectOptions = {
    area: ['20 m²', '25 m²', '35 m²', '45 m²', '50 m²', '60 m²'],
    bed: ['1 Single Bed', '1 Queen Bed', '1 King Bed', '1 Super King', '2 Queen Beds'],
    occupancy: ['1', '2', '3', '4']
  };

  useEffect(() => {
    if (showBookingModal) {
      fetch('https://backend-cz3y.onrender.com/api/guests')
        .then(res => res.json())
        .then(data => setAllGuests(data))
        .catch(err => console.error(err));
      
      fetch('https://backend-cz3y.onrender.com/api/staff')
        .then(res => res.json())
        .then(data => setAllStaff(data.filter(s => s.status === 'Available'))) // Chỉ lấy nhân viên rảnh
        .catch(err => console.error(err));
    }
  }, [showBookingModal]);

  const handleSaveEdit = async () => {
    if (!previewRoom) return;
    try {
      const response = await fetch(`${API_URL}/${previewRoom.room_number}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editedData.status })
      });
      if (response.ok) {
        setIsEditing(false);
        setPreviewRoom({ ...previewRoom, status: editedData.status });
        fetchRooms();
      } else {
        alert("Lỗi khi lưu trạng thái!");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ĐÃ FIX BẰNG PLATFORM CHO MOBILE
  const handleClearBusyStatus = async (room_number) => {
    const performClear = async () => {
      try {
        const response = await fetch(`${API_URL}/${room_number}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'available' })
        });
        if (response.ok) {
          setPreviewRoom(null);
          fetchRooms();
        } else alert("Lỗi khi xử lý!");
      } catch (error) { console.error(error); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Xác nhận đã xử lý xong? Phòng này sẽ chuyển về Available.")) performClear();
    } else {
      Alert.alert("Xác nhận", "Xác nhận đã xử lý xong? Phòng này sẽ chuyển về Available.", [
        { text: "Hủy", style: "cancel" }, { text: "Xác nhận", onPress: performClear }
      ]);
    }
  };

  const confirmAction = async () => {
    setIsBookingLoading(true);
    try {
      if (bookingMode === 'Guest') {
        if (!selectedGuestId) return alert("Please select a guest!");
        const rawPrice = previewRoom.base_price || previewRoom.price || "0";
        const finalPrice = rawPrice.toString().replace(/\D/g, '');

        const response = await fetch('https://backend-cz3y.onrender.com/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guest_id: selectedGuestId,
            room_id: previewRoom.room_id || previewRoom.id, 
            payment_status: payStatus,
            total_price: finalPrice
          })
        });
        if (response.ok) alert("Booking successful!"); else alert("Booking failed!");
      } else {
        if (!selectedStaffId) return alert("Please select a staff member!");
        const response = await fetch('https://backend-cz3y.onrender.com/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: selectedStaffId,
            room_id: previewRoom.room_id || previewRoom.id,
            task_type: taskType
          })
        });
        if (response.ok) alert("Task assigned successfully!"); else alert("Task assignment failed!");
      }

      setShowBookingModal(false);
      setPreviewRoom(null);
      setGuestSearchQuery('');
      setStaffSearchQuery('');
      setSelectedGuestId(null);
      setSelectedStaffId(null);
      fetchRooms();
    } catch (error) {
      alert("Network error.");
      console.error(error);
    } finally {
      setIsBookingLoading(false);
    }
  };

  // ĐÃ FIX BẰNG PLATFORM CHO MOBILE
  const handleCancelBooking = async (roomId) => {
    const performCancel = async () => {
      try {
        const res = await fetch('https://backend-cz3y.onrender.com/api/bookings');
        const bookings = await res.json();
        const activeBooking = bookings.find(b => b.room_id === roomId && (b.status === 'checked_in' || b.status === 'confirmed'));
        if (activeBooking) {
          await fetch(`https://backend-cz3y.onrender.com/api/bookings/${activeBooking.booking_id}`, { method: 'DELETE' });
          setPreviewRoom(null);
          fetchRooms();
        } else alert("Could not find an active reservation for this room.");
      } catch (error) { console.error(error); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Do you want to cancel this booking and delete it from Reservations?")) performCancel();
    } else {
      Alert.alert("Cancel Booking", "Do you want to cancel this booking and delete it from Reservations?", [
        { text: "No", style: "cancel" }, { text: "Yes", onPress: performCancel }
      ]);
    }
  };

  const filteredGuests = allGuests.filter(g => 
    `${g.first_name} ${g.last_name} ${g.passport_no}`.toLowerCase().includes(guestSearchQuery.toLowerCase())
  );

  const filteredStaff = allStaff.filter(s => 
    s.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      
      {/* HEADER SECTION */}
      <View style={[styles.headerSection, isMobile && { paddingHorizontal: 15 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.pageTitle}>Rooms</Text>
          <View style={styles.viewToggleBox}>
            <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]} onPress={() => setViewMode('list')}>
              <Ionicons name="list" size={20} color={viewMode === 'list' ? '#3b82f6' : '#94a3b8'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]} onPress={() => setViewMode('map')}>
              <Ionicons name="grid-outline" size={18} color={viewMode === 'map' ? '#3b82f6' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* THỐNG KÊ */}
        <View style={styles.summaryBar}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <>
              <Text style={styles.summaryText}>Total: <Text style={{fontWeight: 'bold', color:'#1e293b'}}>{roomsData.length}</Text></Text>
              <Text style={styles.summaryText}>•</Text>
              <Text style={[styles.summaryText, {color: '#4d7c0f'}]}>Available: <Text style={{fontWeight: 'bold'}}>{statusCounts.available}</Text></Text>
              <Text style={styles.summaryText}>•</Text>
              <Text style={[styles.summaryText, {color: '#b45309'}]}>Occupied: <Text style={{fontWeight: 'bold'}}>{statusCounts.occupied}</Text></Text>
              <Text style={styles.summaryText}>•</Text>
              <Text style={[styles.summaryText, {color: '#1d4ed8'}]}>Cleaning: <Text style={{fontWeight: 'bold'}}>{statusCounts.cleaning}</Text></Text>
              <Text style={styles.summaryText}>•</Text>
              <Text style={[styles.summaryText, {color: '#b91c1c'}]}>Maintenance: <Text style={{fontWeight: 'bold'}}>{statusCounts.maintenance}</Text></Text>
            </>
          )}
        </View>

        {/* ========================================================== */}
        {/* RESPONSIVE BỘ LỌC TÌM KIẾM & DROPDOWNS                     */}
        {/* ========================================================== */}
        <View style={[styles.filterRow, isMobile && { flexWrap: 'wrap' }]}>
          <View style={[styles.searchBox, isMobile && { minWidth: '100%' }]}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
            <TextInput 
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} 
              placeholder="Search global room..." 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
            />
          </View>

          <TouchableOpacity style={[styles.dropdownBtn, isMobile && { flex: 1, minWidth: '48%' }]} onPress={() => setActiveDropdown('status')}>
            <Text style={styles.dropdownBtnText}>Status: <Text style={{color: '#1e293b'}}>{filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dropdownBtn, isMobile && { flex: 1, minWidth: '48%' }]} onPress={() => setActiveDropdown('type')}>
            <Text style={styles.dropdownBtnText}>Type: <Text style={{color: '#1e293b'}}>{filterType}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dropdownBtn, isMobile && { flex: 1, minWidth: '48%' }]} onPress={() => setActiveDropdown('guests')}>
            <Text style={styles.dropdownBtnText}>Guests: <Text style={{color: '#1e293b'}}>{filterGuests}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* ========================================================== */}
        {/* RESPONSIVE ADVANCED SORTING BAR                            */}
        {/* ========================================================== */}
        <View style={[styles.sortingBar, isMobile && { flexWrap: 'wrap' }]}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <TouchableOpacity style={[styles.sortChip, sortBy === 'price' && styles.sortChipActive]} onPress={() => setSortBy('price')}>
            <Text style={[styles.sortChipText, sortBy === 'price' && styles.sortChipTextActive]}>Price</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sortChip, sortBy === 'area' && styles.sortChipActive]} onPress={() => setSortBy('area')}>
            <Text style={[styles.sortChipText, sortBy === 'area' && styles.sortChipTextActive]}>Size</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sortChip, sortBy === 'availability' && styles.sortChipActive]} onPress={() => setSortBy('availability')}>
            <Text style={[styles.sortChipText, sortBy === 'availability' && styles.sortChipTextActive]}>Availability</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortOrderBtn} onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
            <MaterialCommunityIcons name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'} size={20} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={[styles.resultCountText, isMobile && { width: '100%', marginTop: 5 }]}>{processedData.length} results</Text>
        </View>
      </View>

      {/* CHỈ HIỂN THỊ TABS TẦNG KHI Ở CHẾ ĐỘ LIST */}
      {viewMode === 'list' && (
        <View style={styles.floorBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: isMobile ? 15 : 20}}>
            {floors.map(f => (
              <TouchableOpacity 
                key={f} 
                style={[
                  styles.floorItem, 
                  activeFloor === f && !isGlobalFilterActive && styles.floorActive,
                  isGlobalFilterActive && { opacity: 0.5 }
                ]} 
                onPress={() => { 
                  setActiveFloor(f); 
                  setSearchQuery('');
                  setFilterStatus('All');
                  setFilterType('All');
                  setFilterGuests('All');
                }}
              >
                <Text style={[styles.floorText, activeFloor === f && !isGlobalFilterActive && styles.floorTextActive]}>Floor {f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ========================================================== */}
      {/* DANH SÁCH PHÒNG (LIST HOẶC MAP)                             */}
      {/* ========================================================== */}
      <ScrollView contentContainerStyle={[styles.roomList, isMobile && { padding: 15 }]} showsVerticalScrollIndicator={false}>
        {viewMode === 'list' ? (
          <View style={styles.listGrid}>
            {paginatedRooms.map(room => {
              const statusStyle = getStatusStyle(room.status);
              const availability = getAvailabilityInfo(room.type);
              return (
                <TouchableOpacity 
                  key={room.id} 
                  // TRÊN MOBILE, ÉP MINWIDTH AUTO VÀ WIDTH 100% ĐỂ THẺ KHÔNG BỊ TRÀN
                  style={[styles.horizontalCard, isMobile && { width: '100%', minWidth: 'auto', padding: 14 }]} 
                  onPress={() => openModal(room)}
                >
                  <View style={styles.cardRow1}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Text style={styles.roomTitleText}>{room.type} {room.room_number}</Text>
                      {room.ai_predicted_occupied !== null && room.ai_predicted_occupied !== undefined && (
                        <View
                          style={[
                            styles.aiDot,
                            { backgroundColor: room.ai_predicted_occupied ? '#7c3aed' : '#cbd5e1' }
                          ]}
                          accessibilityLabel={`AI prediction: ${room.ai_predicted_occupied ? 'Occupied' : 'Empty'} (${(room.ai_probability * 100).toFixed(0)}% confidence)`}
                        />
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}><Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text></View>
                  </View>
                  <View style={[styles.cardSpecs, isMobile && { flexWrap: 'wrap' }]}>
                    <View style={styles.specItem}><Ionicons name="expand-outline" size={14} color="#64748b" /><Text style={styles.specText}>{room.area}</Text></View>
                    <View style={styles.specItem}><MaterialCommunityIcons name="bed-outline" size={14} color="#64748b" /><Text style={styles.specText}>{room.bed}</Text></View>
                    <View style={styles.specItem}><Ionicons name="people-outline" size={14} color="#64748b" /><Text style={styles.specText}>{room.occupancy} guests</Text></View>
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>{room.desc}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.availText, isMobile && { fontSize: 11 }]}>Availability: <Text style={styles.availBold}>{availability.available}/{availability.total} Rms</Text></Text>
                    <Text style={[styles.priceText, isMobile && { fontSize: 16 }]}>{room.price} <Text style={styles.priceNight}>VND/n</Text></Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.mapContainerLight}>
            {[...new Set(paginatedRooms.map(r => r.floor))].sort((a,b) => a-b).map(floorNum => {
              const roomsInFloor = paginatedRooms.filter(r => r.floor === floorNum);
              return (
                <View key={floorNum} style={styles.floorSection}>
                  <View style={styles.floorSectionHeader}>
                    <Text style={styles.floorSectionTitle}>FLOOR {floorNum}</Text>
                    <View style={styles.floorSectionLine} />
                  </View>
                  <View style={styles.mapGrid}>
                    {roomsInFloor.map(room => {
                      const statusStyle = getStatusStyle(room.status);
                      return (
                        <TouchableOpacity 
                          key={room.id} 
                          style={[
                            styles.mapPill, 
                            { 
                              backgroundColor: statusStyle.bg, 
                              borderColor: statusStyle.color + '40',
                              ...(isMobile && { width: 65, height: 65 }) // Thu nhỏ pill map trên mobile
                            }
                          ]} 
                          onPress={() => openModal(room)}
                        >
                          <Text style={[styles.mapPillRoom, { color: statusStyle.color }]}>{room.room_number}</Text>
                          <Text style={[styles.mapPillType, { color: statusStyle.color, opacity: 0.85 }]}>{room.type.substring(0, 3).toUpperCase()}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {!isLoading && paginatedRooms.length === 0 && (
          <View style={{flex: 1, alignItems: 'center', marginTop: 50}}>
            <MaterialCommunityIcons name="bed-empty" size={60} color="#cbd5e1" />
            <Text style={{color: '#64748b', marginTop: 10}}>No rooms found matching your filters.</Text>
          </View>
        )}
      </ScrollView>

      {/* PHÂN TRANG */}
      {viewMode === 'list' && totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={currentPage === 1 ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
          {getPageNumbers().map(num => (
            <TouchableOpacity key={num} style={[styles.pageBtn, currentPage === num && styles.pageBtnActive]} onPress={() => setCurrentPage(num)}>
              <Text style={[styles.pageBtnText, currentPage === num && styles.pageBtnTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={currentPage === totalPages ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL: CUSTOM MAIN DROPDOWN */}
      {activeDropdown && (
        <Modal transparent animationType="fade" visible={true}>
          <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
            <View style={styles.dropdownOverlay}>
              <View style={[styles.dropdownMenu, isMobile && { width: '80%' }]}>
                <Text style={styles.dropdownTitle}>Select {activeDropdown}</Text>
                <ScrollView style={{maxHeight: 300}}>
                  {dropdownOptions[activeDropdown].map((option, idx) => (
                    <TouchableOpacity 
                      key={idx} style={styles.dropdownOptionBtn}
                      onPress={() => {
                        if(activeDropdown === 'status') setFilterStatus(option);
                        if(activeDropdown === 'type') setFilterType(option);
                        if(activeDropdown === 'guests') setFilterGuests(option);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* ========================================================== */}
      {/* MODAL: CHI TIẾT PHÒNG & CHỈNH SỬA                          */}
      {/* ========================================================== */}
      <Modal visible={!!previewRoom} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isMobile && { width: '95%', height: '90%' }]}>
            
            <ScrollView contentContainerStyle={[styles.modalScrollContent, isMobile && { padding: 20 }]} showsVerticalScrollIndicator={false}>
              <View style={styles.modalTopNav}>
                <Text style={styles.modalNavTitle}>Room Detail</Text>
                <View style={styles.navActions}>
                  <TouchableOpacity 
                    style={[styles.editBtn, isEditing && styles.saveBtn]} 
                    onPress={() => { isEditing ? handleSaveEdit() : setIsEditing(true); }}
                  >
                    <Text style={[styles.editBtnText, isEditing && styles.saveBtnText]}>
                      {isEditing ? 'Save Changes' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPreviewRoom(null)} style={{marginLeft: 15}}><MaterialCommunityIcons name="close" size={24} color="#64748b" /></TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalTitleRow}>
                <Text style={styles.modalRoomTitle}>{previewRoom?.type} Room</Text>
                {isEditing ? (
                  <View style={styles.statusEditGroup}>
                    {['available', 'occupied', 'cleaning', 'maintenance'].map(s => (
                      <TouchableOpacity
                        key={s} style={[styles.statusBadgeModal, { backgroundColor: getStatusStyle(s).bg, borderWidth: editedData.status === s ? 1 : 0, borderColor: getStatusStyle(s).color }]}
                        onPress={() => setEditedData({...editedData, status: s})}
                      >
                        <Text style={[styles.statusBadgeTextModal, { color: getStatusStyle(s).color }]}>{getStatusStyle(s).label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  previewRoom && (
                    <View style={[styles.statusBadgeModal, { backgroundColor: getStatusStyle(previewRoom.status).bg }]}>
                      <Text style={[styles.statusBadgeTextModal, { color: getStatusStyle(previewRoom.status).color }]}>{getStatusStyle(previewRoom.status).label}</Text>
                    </View>
                  )
                )}
              </View>
              <Text style={styles.roomOccupiedText}>Room Number: <Text style={{fontWeight: 'bold', color: '#1e293b'}}>{previewRoom?.room_number}</Text></Text>

              {/* Responsive Gallery */}
              <View style={[styles.galleryContainer, isMobile && { height: 220 }]}>
                <View style={styles.mainImagePlaceholder}>
                  {previewRoom?.images?.main ? <Image source={previewRoom.images.main} style={styles.fullImage} /> : <View style={styles.emptyImgCenter}><MaterialCommunityIcons name="image-off-outline" size={32} color="#cbd5e1" /></View>}
                </View>
                <View style={styles.thumbnailsColumn}>
                  <View style={styles.thumbnailPlaceholder}>{previewRoom?.images?.t1 ? <Image source={previewRoom.images.t1} style={styles.fullImage} /> : <MaterialCommunityIcons name="image-off-outline" size={20} color="#cbd5e1" />}</View>
                  <View style={styles.thumbnailPlaceholder}>{previewRoom?.images?.t2 ? <Image source={previewRoom.images.t2} style={styles.fullImage} /> : <MaterialCommunityIcons name="image-off-outline" size={20} color="#cbd5e1" />}</View>
                  <View style={styles.thumbnailPlaceholder}>{previewRoom?.images?.t3 ? <Image source={previewRoom.images.t3} style={styles.fullImage} /> : <MaterialCommunityIcons name="image-off-outline" size={20} color="#cbd5e1" />}</View>
                </View>
              </View>

              <View style={styles.quickInfoBar}>
                <View style={styles.quickInfoItem}>
                  <MaterialCommunityIcons name="currency-usd" size={16} color="#64748b" />
                  {isEditing ? (
                    <TextInput style={styles.priceInput} value={editedData.price} onChangeText={(val) => setEditedData({...editedData, price: val})} />
                  ) : (
                    <Text style={[styles.quickInfoText, {fontWeight: 'bold'}]}>{editedData.price}</Text>
                  )}
                </View>

                <View style={styles.quickInfoItem}>
                  <Ionicons name="expand-outline" size={16} color="#64748b" />
                  {isEditing ? (
                    <TouchableOpacity style={styles.editSelectBtn} onPress={() => setActiveEditDropdown('area')}>
                      <Text style={styles.editSelectText}>{editedData.area}</Text>
                      <Ionicons name="chevron-down" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                  ) : (<Text style={styles.quickInfoText}>{editedData.area}</Text>)}
                </View>

                <View style={styles.quickInfoItem}>
                  <MaterialCommunityIcons name="bed-outline" size={16} color="#64748b" />
                  {isEditing ? (
                    <TouchableOpacity style={styles.editSelectBtn} onPress={() => setActiveEditDropdown('bed')}>
                      <Text style={styles.editSelectText}>{editedData.bed}</Text>
                      <Ionicons name="chevron-down" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                  ) : (<Text style={styles.quickInfoText}>{editedData.bed}</Text>)}
                </View>

                <View style={styles.quickInfoItem}>
                  <Ionicons name="people-outline" size={16} color="#64748b" />
                  {isEditing ? (
                    <TouchableOpacity style={styles.editSelectBtn} onPress={() => setActiveEditDropdown('occupancy')}>
                      <Text style={styles.editSelectText}>{editedData.occupancy}</Text>
                      <Ionicons name="chevron-down" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                  ) : (<Text style={styles.quickInfoText}>{editedData.occupancy} guests</Text>)}
                </View>
              </View>

              {isEditing ? (
                <TextInput style={[styles.editTextArea, Platform.OS === 'web' && { outlineStyle: 'none' }]} value={editedData.desc} onChangeText={(val) => setEditedData({...editedData, desc: val})} multiline numberOfLines={4} />
              ) : (
                <Text style={styles.descriptionText}>{editedData.desc}</Text>
              )}

              <Text style={styles.sectionHeader}>Features</Text>
              <View style={styles.listGrid2Col}>
                {previewRoom?.features?.map((f, i) => (<View key={i} style={[styles.listItem, isMobile && { width: '100%' }]}><View style={styles.checkCircle}><MaterialCommunityIcons name="check" size={12} color="#166534" /></View><Text style={styles.listItemText}>{f}</Text></View>))}
              </View>

              <Text style={styles.sectionHeader}>Facilities</Text>
              <View style={styles.listGrid3Col}>
                {previewRoom?.facilities?.map((f, i) => (<View key={i} style={[styles.facilityItem, isMobile && { width: '50%' }]}><MaterialCommunityIcons name={f.icon} size={18} color="#94a3b8" /><Text style={styles.facilityItemText}>{f.name}</Text></View>))}
              </View>

              <View style={[styles.actionRow, isMobile && { flexDirection: 'column' }]}>
                <TouchableOpacity style={styles.btnExamine} onPress={() => { const r = previewRoom; setPreviewRoom(null); onRoomPress(r); }}>
                  <MaterialCommunityIcons name="home-lightning-bolt-outline" size={20} color="#ffffff" />
                  <Text style={styles.btnExamineText}>Examine (IoT Control)</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* OVERLAY: TRÌNH CHỌN CHO AREA/BED/OCCUPANCY */}
            {activeEditDropdown && (
              <TouchableWithoutFeedback onPress={() => setActiveEditDropdown(null)}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
                  <TouchableWithoutFeedback>
                    <View style={[styles.dropdownMenu, isMobile && { width: '80%' }]}>
                      <Text style={styles.dropdownTitle}>Select {activeEditDropdown.charAt(0).toUpperCase() + activeEditDropdown.slice(1)}</Text>
                      <ScrollView style={{maxHeight: 250}}>
                        {editSelectOptions[activeEditDropdown].map((option, idx) => (
                          <TouchableOpacity 
                            key={idx} style={styles.dropdownOptionBtn}
                            onPress={() => { setEditedData({...editedData, [activeEditDropdown]: option}); setActiveEditDropdown(null); }}
                          >
                            <Text style={styles.dropdownOptionText}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            )}

          </View>
        </View>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL GÁN KHÁCH HÀNG HOẶC NHÂN VIÊN                        */}
      {/* ========================================================== */}
      {showBookingModal && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { width: isMobile ? '95%' : 450, padding: isMobile ? 20 : 30, zIndex: 1000 }]}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>Action: Room {previewRoom?.room_number}</Text>
              
              <View style={styles.modalTabs}>
                <TouchableOpacity style={[styles.tabBtn, bookingMode === 'Guest' && styles.tabBtnActive]} onPress={() => setBookingMode('Guest')}>
                  <Text style={[styles.tabBtnText, bookingMode === 'Guest' && styles.tabBtnTextActive]}>Book for Guest</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, bookingMode === 'Staff' && styles.tabBtnActive]} onPress={() => setBookingMode('Staff')}>
                  <Text style={[styles.tabBtnText, bookingMode === 'Staff' && styles.tabBtnTextActive]}>Assign to Staff</Text>
                </TouchableOpacity>
              </View>

              {bookingMode === 'Guest' ? (
                <>
                  <Text style={styles.inputLabel}>Select Guest</Text>
                  <View style={styles.guestSearchBox}>
                    <AntDesign name="search" size={16} color="#94a3b8" />
                    <TextInput 
                      style={[styles.guestSearchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} 
                      placeholder="Search by name or passport..." 
                      value={guestSearchQuery} 
                      onChangeText={setGuestSearchQuery} 
                    />
                  </View>

                  <View style={{ maxHeight: 200, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 20 }}>
                    <ScrollView>
                      {filteredGuests.length > 0 ? filteredGuests.map(g => (
                        <TouchableOpacity 
                          key={g.guest_id} 
                          style={[styles.guestItem, selectedGuestId === g.guest_id && { backgroundColor: '#eff6ff' }]}
                          onPress={() => setSelectedGuestId(g.guest_id)}
                        >
                          <Text style={{ color: selectedGuestId === g.guest_id ? '#3b82f6' : '#1e293b' }}>
                            {g.first_name} {g.last_name} ({g.passport_no})
                          </Text>
                        </TouchableOpacity>
                      )) : (
                        <Text style={{padding: 15, color: '#94a3b8'}}>No guests found.</Text>
                      )}
                    </ScrollView>
                  </View>

                  <Text style={styles.inputLabel}>Payment Status</Text>
                  <TouchableOpacity style={[styles.dropdownBtn, { marginBottom: showPayDropdown ? 5 : 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }]} onPress={() => setShowPayDropdown(!showPayDropdown)}>
                    <Text style={styles.dropdownBtnText}>{payStatus === 'paid' ? 'Paid' : 'Unpaid'}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>

                  {showPayDropdown && (
                    <View style={styles.inlineDropdownMenu}>
                      <TouchableOpacity style={styles.inlineDropdownItem} onPress={() => { setPayStatus('paid'); setShowPayDropdown(false); }}>
                        <Text style={{ color: '#1e293b', fontWeight: '500' }}>Paid</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.inlineDropdownItem} onPress={() => { setPayStatus('unpaid'); setShowPayDropdown(false); }}>
                        <Text style={{ color: '#1e293b', fontWeight: '500' }}>Unpaid</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Select Staff (Available only)</Text>
                  <View style={styles.guestSearchBox}>
                    <AntDesign name="search" size={16} color="#94a3b8" />
                    <TextInput 
                      style={[styles.guestSearchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]} 
                      placeholder="Search staff..." 
                      value={staffSearchQuery} 
                      onChangeText={setStaffSearchQuery} 
                    />
                  </View>
                  
                  <View style={{ maxHeight: 200, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 20 }}>
                    <ScrollView>
                      {filteredStaff.length > 0 ? filteredStaff.map(s => (
                        <TouchableOpacity 
                          key={s.staff_id} 
                          style={[styles.guestItem, selectedStaffId === s.staff_id && { backgroundColor: '#eff6ff' }]} 
                          onPress={() => setSelectedStaffId(s.staff_id)}
                        >
                          <Text style={{ color: selectedStaffId === s.staff_id ? '#3b82f6' : '#1e293b' }}>
                            {s.full_name} ({s.role})
                          </Text>
                        </TouchableOpacity>
                      )) : (
                        <Text style={{padding: 15, color: '#94a3b8'}}>No available staff found.</Text>
                      )}
                    </ScrollView>
                  </View>

                  <Text style={styles.inputLabel}>Task Type</Text>
                  <TouchableOpacity style={[styles.dropdownBtn, { marginBottom: showTaskDropdown ? 5 : 20, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }]} onPress={() => setShowTaskDropdown(!showTaskDropdown)}>
                    <Text style={styles.dropdownBtnText}>{taskType.toUpperCase()}</Text>
                    <Ionicons name="chevron-down" size={16} color="#64748b" />
                  </TouchableOpacity>

                  {showTaskDropdown && (
                    <View style={styles.inlineDropdownMenu}>
                      <TouchableOpacity style={styles.inlineDropdownItem} onPress={() => { setTaskType('cleaning'); setShowTaskDropdown(false); }}>
                        <Text style={{ color: '#1e293b', fontWeight: '500' }}>Cleaning</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.inlineDropdownItem} onPress={() => { setTaskType('maintenance'); setShowTaskDropdown(false); }}>
                        <Text style={{ color: '#1e293b', fontWeight: '500' }}>Maintenance</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => { 
                  setShowBookingModal(false); 
                  setShowPayDropdown(false); 
                  setShowTaskDropdown(false);
                  setGuestSearchQuery(''); 
                  setStaffSearchQuery('');
                  setSelectedGuestId(null); 
                  setSelectedStaffId(null);
                }}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSave, { flex: 1 }]} onPress={confirmAction}>
                  {isBookingLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Confirm Action</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  headerSection: { backgroundColor: '#fff', paddingHorizontal: 25, paddingTop: 25, paddingBottom: 15, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  
  viewToggleBox: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 },
  viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  viewToggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },

  summaryBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  summaryText: { fontSize: 13, color: '#64748b' },

  filterRow: { flexDirection: 'row', gap: 12, alignItems: 'center', zIndex: 10, marginBottom: 15 },
  searchBox: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 15, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 }, // Xóa outlineStyle tĩnh ở đây, thay bằng logic Platform ở JSX
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 140 },
  dropdownBtnText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  sortingBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortLabel: { fontSize: 13, color: '#64748b', fontWeight: '500', marginRight: 5 },
  sortChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  sortChipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  sortChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  sortChipTextActive: { color: '#3b82f6' },
  sortOrderBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
  resultCountText: { fontSize: 13, color: '#94a3b8', marginLeft: 'auto', fontWeight: '500' },

  floorBar: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  floorItem: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 20, marginRight: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  floorActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  floorText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  floorTextActive: { color: '#fff' },

  roomList: { padding: 25, paddingBottom: 100 }, 
  
  mapContainerLight: { 
    backgroundColor: '#ffffff', 
    padding: 25, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    width: '100%', 
    minHeight: 500,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2
  },
  floorSection: { marginBottom: 35 },
  floorSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  floorSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', letterSpacing: 1.5, marginRight: 15 },
  floorSectionLine: { flex: 1, height: 1, backgroundColor: '#f1f5f9' },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mapPill: { 
    width: 75, 
    height: 75, 
    borderRadius: 12, 
    borderWidth: 1,
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowRadius: 4, 
    elevation: 1 
  },
  mapPillRoom: { fontSize: 18, fontWeight: 'bold' },
  mapPillType: { fontSize: 11, fontWeight: '700', marginTop: 4 },

  listGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between' },
  horizontalCard: { width: '48%', minWidth: 300, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardRow1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  roomTitleText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  aiDot: { width: 9, height: 9, borderRadius: 5 }, // Chấm tím = AI dự đoán có người, xám = trống
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold' },
  cardSpecs: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 20, marginBottom: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 15, borderTopWidth: 1, borderColor: '#f1f5f9' },
  availText: { fontSize: 13, color: '#64748b' },
  availBold: { fontWeight: 'bold', color: '#1e293b' },
  priceText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  priceNight: { fontSize: 12, fontWeight: 'normal', color: '#94a3b8' },

  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenu: { width: 300, backgroundColor: '#fff', borderRadius: 12, padding: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  dropdownTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 10 },
  dropdownOptionBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  dropdownOptionText: { fontSize: 15, color: '#475569' },

  paginationContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#fff', padding: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pageBtnDisabled: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  pageBtnText: { fontSize: 16, color: '#475569', fontWeight: '500' },
  pageBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  modalContainer: { width: '100%', maxWidth: 750, height: '95%', backgroundColor: '#ffffff', borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10, overflow: 'hidden', position: 'relative' },
  modalScrollContent: { padding: 40 },
  modalTopNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalNavTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
  navActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { backgroundColor: '#ecfccb', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  editBtnText: { color: '#4d7c0f', fontWeight: 'bold', fontSize: 12 },
  saveBtn: { backgroundColor: '#3b82f6' },
  saveBtnText: { color: '#ffffff' },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 5, flexWrap: 'wrap' },
  modalRoomTitle: { fontSize: 32, fontWeight: 'bold', color: '#1e293b' },
  statusEditGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBadgeModal: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTextModal: { fontSize: 12, fontWeight: 'bold' },
  roomOccupiedText: { fontSize: 13, color: '#64748b', marginBottom: 25 },
  galleryContainer: { flexDirection: 'row', height: 350, gap: 15, marginBottom: 25 },
  mainImagePlaceholder: { flex: 3, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  emptyImgCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  thumbnailsColumn: { flex: 1, gap: 15 },
  thumbnailPlaceholder: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fullImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  quickInfoBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 25, marginBottom: 20 }, 
  quickInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickInfoText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  
  priceInput: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#3b82f6', minWidth: 80, maxWidth: 120, paddingVertical: 0 },
  editSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 1, borderBottomColor: '#3b82f6', paddingBottom: 2 },
  editSelectText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },

  descriptionText: { fontSize: 14, color: '#64748b', lineHeight: 24, marginBottom: 30 },
  editTextArea: { fontSize: 14, color: '#1e293b', lineHeight: 24, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, padding: 15, backgroundColor: '#f8fafc', minHeight: 100, textAlignVertical: 'top', marginBottom: 30 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  listGrid2Col: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 30 },
  listItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: 15 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  listItemText: { fontSize: 13, color: '#475569', flex: 1 },
  listGrid3Col: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 30 },
  facilityItem: { width: '33.33%', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  facilityItemText: { fontSize: 13, color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 15, marginTop: 10, borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 30 },
  btnBook: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#f1f5f9', borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  btnBookText: { fontSize: 15, fontWeight: 'bold', color: '#475569' },
  btnExamine: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: '#3b82f6', borderRadius: 10 },
  btnExamineText: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },

  // GUEST & STAFF MODAL STYLES MỚI
  modalContent: { backgroundColor: '#fff', borderRadius: 16, elevation: 10 },
  modalTabs: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  tabBtnTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  guestItem: { padding: 15, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  inlineDropdownMenu: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 20 },
  inlineDropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnCancel: { padding: 12, borderRadius: 8, backgroundColor: '#f1f5f9', minWidth: 80, alignItems: 'center' },
  btnSave: { padding: 12, borderRadius: 8, backgroundColor: '#3b82f6', alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },
  guestSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  guestSearchInput: { flex: 1, paddingVertical: 8, fontSize: 13, marginLeft: 8 } // Đã dời logic outlineStyle lên trên
});