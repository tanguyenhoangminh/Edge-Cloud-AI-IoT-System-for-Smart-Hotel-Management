import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

export default function ReservationDetail({ booking, onBack }) {
  if (!booking) return null;

  // Lấy raw_date từ booking (được truyền từ ReservationScreen) hoặc tự format nếu chưa có
  const rawCheckIn = booking.raw_check_in || new Date(booking.check_in_date).toISOString().substring(0, 10);
  const rawCheckOut = booking.raw_check_out || new Date(booking.check_out_date).toISOString().substring(0, 10);

  // State quản lý Modal Edit kèm thêm 2 ô Ngày tháng
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    booking_id: booking.booking_id,
    payment_status: booking.payment_status,
    status: booking.status,
    check_in: rawCheckIn,
    check_out: rawCheckOut
  });

  const API_URL = 'http://localhost:5000/api/bookings';

  // Tính toán hóa đơn chuẩn xác khớp 100% với màn hình ngoài
  const basePricePerNight = Number(booking.base_price) || (Number(booking.total_price) / booking.nights);
  const subtotal = basePricePerNight * booking.nights;
  const discountPercent = booking.discount_percent || 0;
  const discountAmount = subtotal * (discountPercent / 100);

  // BỘ TỪ ĐIỂN ẢNH THEO LOẠI PHÒNG
  const roomTypeDetails = {
    'Single': { image: require('../../assets/single_main.png'), area: '20 m²', bed: '1 Single Bed', guests: '1 guest' },
    'Standard': { image: require('../../assets/standard_main.png'), area: '25 m²', bed: '1 Queen Bed', guests: '2 guests' },
    'Deluxe': { image: require('../../assets/deluxe_main.png'), area: '35 m²', bed: '1 King Bed', guests: '2 guests' },
    'Executive': { image: require('../../assets/executive_main.png'), area: '45 m²', bed: '1 King Bed', guests: '2 guests' },
    'Suite': { image: require('../../assets/suite_main.png'), area: '60 m²', bed: '1 Super King', guests: '3 guests' },
    'Family': { image: require('../../assets/family_main.png'), area: '50 m²', bed: '2 Queen Beds', guests: '4 guests' },
  };

  const roomInfo = roomTypeDetails[booking.room_type] || roomTypeDetails['Standard'];

  // HÀM XỬ LÝ LƯU (SỬA PAYMENT, STATUS & DATE)
  const handleSaveEdit = async () => {
    // Validate: Check-out không được trước Check-in
    if (new Date(editData.check_out) < new Date(editData.check_in)) {
      alert("Lỗi: Ngày Check-out không được trước ngày Check-in!");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${editData.booking_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_status: editData.payment_status, 
          status: editData.status,
          check_in_date: editData.check_in,
          check_out_date: editData.check_out
        })
      });

      if (response.ok) {
        setIsEditModalVisible(false);
        onBack(); // Đóng Modal và báo ngoài bảng load lại data mới nhất
      } else {
        alert("Lỗi cập nhật hệ thống!");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // HÀM XỬ LÝ HỦY PHÒNG
  const handleCancelBooking = async () => {
    if(window.confirm("Bạn có chắc chắn muốn hủy đơn và giải phóng phòng trống trở lại?")) {
      try {
        const response = await fetch(`${API_URL}/${booking.booking_id}`, { method: 'DELETE' });
        if (response.ok) {
          onBack(); 
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* BREADCRUMB HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#64748b" />
          <Text style={styles.breadcrumbText}>Reservation / <Text style={styles.breadcrumbActive}>Booking #{booking.booking_id}</Text></Text>
        </TouchableOpacity>
      </View>

      {/* 3 CỘT NỘI DUNG */}
      <View style={styles.contentRow}>
        
        {/* CỘT 1: PROFILE */}
        <View style={[styles.card, styles.col1]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Profile</Text>
            <MaterialCommunityIcons name="dots-horizontal" size={20} color="#94a3b8" />
          </View>
          
          <View style={styles.profileInfo}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{booking.guest_name?.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.guestNameLarge}>{booking.guest_name}</Text>
              <Text style={styles.guestIdText}>G-{booking.guest_id.toString().padStart(6, '0')}</Text>
            </View>
          </View>

          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={16} color="#10b981" style={styles.contactIconBg} />
              <Text style={styles.contactText}>{booking.phone || '+84 ---'}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="mail-outline" size={16} color="#10b981" style={styles.contactIconBg} />
              <Text style={styles.contactText}>{booking.email || 'guest@email.com'}</Text>
            </View>
          </View>

          <Text style={styles.sectionSubTitle}>Personal Information</Text>
          <View style={styles.grid2Col}>
            <View style={styles.gridItem2}>
              <Text style={styles.labelSmall}>Date of Birth</Text>
              <Text style={styles.valueSmall}>
                {booking.date_of_birth ? new Date(booking.date_of_birth).toLocaleDateString('en-GB') : '--/--/----'}
              </Text>
            </View>
            <View style={styles.gridItem2}>
              <Text style={styles.labelSmall}>Gender</Text>
              <Text style={styles.valueSmall}>{booking.gender || '---'}</Text>
            </View>
            <View style={styles.gridItem2}>
              <Text style={styles.labelSmall}>Nationality</Text>
              <Text style={styles.valueSmall}>{booking.nationality || '---'}</Text>
            </View>
            <View style={styles.gridItem2}>
              <Text style={styles.labelSmall}>Passport No.</Text>
              <Text style={styles.valueSmall}>{booking.passport_no || '---'}</Text>
            </View>
          </View>
        </View>

        {/* CỘT 2: BOOKING INFO */}
        <View style={[styles.card, styles.col2]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Booking Info</Text>
            <MaterialCommunityIcons name="dots-horizontal" size={20} color="#94a3b8" />
          </View>

          {/* HIỂN THỊ STATUS */}
          <View style={[styles.statusBadgeConfirmed, booking.status === 'cancelled' && {backgroundColor: '#fee2e2'}]}>
            <MaterialCommunityIcons name={booking.status === 'cancelled' ? "close" : "check"} size={14} color={booking.status === 'cancelled' ? "#b91c1c" : "#15803d"} />
            <Text style={[styles.statusBadgeConfirmedText, booking.status === 'cancelled' && {color: '#b91c1c'}]}>
              {booking.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          <Text style={styles.bookingIdLarge}>Booking ID: LG-B{(booking.booking_id).toString().padStart(4, '0')}</Text>

          <View style={styles.grid3Col}>
            <View style={{flex: 1}}>
              <Text style={styles.labelSmall}>Room Type</Text>
              <Text style={styles.valueSmall}>{booking.room_type}</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.labelSmall}>Room Number</Text>
              <Text style={styles.valueSmall}>{booking.room_number}</Text>
            </View>
            <View style={{flex: 1.5}}>
              <Text style={styles.labelSmall}>Price per night</Text>
              <Text style={styles.valueSmall} numberOfLines={1} adjustsFontSizeToFit>
                {basePricePerNight.toLocaleString('vi-VN')} đ
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.grid3Col}>
            <View style={{flex: 1}}>
              <Text style={styles.labelSmall}>Check In</Text>
              <Text style={styles.valueSmall}>{booking.check_in}</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.labelSmall}>Check Out</Text>
              <Text style={styles.valueSmall}>{booking.check_out}</Text>
            </View>
            <View style={{flex: 1.5}}>
              <Text style={styles.labelSmall}>Duration</Text>
              <Text style={styles.valueSmall}>{booking.nights} nights</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.labelSmall}>Notes</Text>
          <Text style={styles.noteText}>VIP Guest. Ensure room is perfectly cleaned before check-in. Prepare welcome amenities.</Text>

          <View style={styles.actionButtonsRow}>
            {/* NÚT EDIT BẬT MODAL LÊN */}
            <TouchableOpacity style={styles.btnEdit} onPress={() => setIsEditModalVisible(true)}>
              <Text style={styles.btnEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={handleCancelBooking}>
              <Text style={styles.btnCancelText}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CỘT 3: ROOM INFO & SUMMARY */}
        <View style={[styles.card, styles.col3]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Room Info</Text>
            <Text style={styles.linkText}>View Detail</Text>
          </View>

          <Image source={roomInfo.image} style={styles.roomImage} />
          <View style={styles.roomSpecsRow}>
            <Text style={styles.roomSpecText}><Ionicons name="expand-outline" size={12}/> {roomInfo.area}</Text>
            <Text style={styles.roomSpecText}><Ionicons name="bed-outline" size={12}/> {roomInfo.bed}</Text>
            <Text style={styles.roomSpecText}><Ionicons name="people-outline" size={12}/> {roomInfo.guests}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Price Summary</Text>
            <View style={[styles.badgePaid, booking.payment_status !== 'paid' && {backgroundColor: '#fee2e2'}]}>
              <Text style={[styles.badgePaidText, booking.payment_status !== 'paid' && {color: '#ef4444'}]}>
                {booking.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* ĐÃ FIX: BẢNG HÓA ĐƠN KHỚP 100% LOGIC CỦA MÀN HÌNH NGOÀI */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Room ({booking.nights} nights)</Text>
            <Text style={styles.summaryValue}>{subtotal.toLocaleString('vi-VN')} đ</Text>
          </View>
          
          {discountPercent > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, {color: '#ea580c'}]}>Discount ({discountPercent}%)</Text>
              <Text style={[styles.summaryValue, {color: '#ea580c'}]}>- {discountAmount.toLocaleString('vi-VN')} đ</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>8% VAT</Text>
            <Text style={[styles.summaryValue, {color: '#10b981', fontSize: 12}]}>Included</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Price</Text>
            {/* Sử dụng đúng formatted_price đã truyền từ ngoài vào */}
            <Text style={styles.summaryTotalValue}>{booking.formatted_price}</Text> 
          </View>
        </View>

      </View>

      {/* ======================================= */}
      {/* MODAL EDIT ĐÃ ĐƯỢC BỔ SUNG DATE INPUTS */}
      {/* ======================================= */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: 450 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Reservation #{editData.booking_id}</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}><Ionicons name="close" size={24} color="#64748b" /></TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#475569', marginBottom: 5 }}>Guest: <Text style={{fontWeight: 'bold', color: '#1e293b'}}>{booking.guest_name}</Text></Text>
              <Text style={{ fontSize: 14, color: '#475569' }}>Room: <Text style={{fontWeight: 'bold', color: '#1e293b'}}>{booking.room_number}</Text></Text>
            </View>

            {/* ĐÃ THÊM: Ô CHỈNH SỬA CHECK-IN VÀ CHECK-OUT */}
            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Check-In Date</Text>
                <TextInput 
                  style={styles.dateInput} 
                  value={editData.check_in} 
                  onChangeText={(t) => setEditData({...editData, check_in: t})}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Check-Out Date</Text>
                <TextInput 
                  style={styles.dateInput} 
                  value={editData.check_out} 
                  onChangeText={(t) => setEditData({...editData, check_out: t})}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Payment Status</Text>
            <View style={styles.btnGroup}>
              {['unpaid', 'partially_paid', 'paid'].map(s => (
                <TouchableOpacity key={s} style={[styles.toggleBtn, editData.payment_status === s && styles.toggleBtnActive]} onPress={() => setEditData({...editData, payment_status: s})}>
                  <Text style={[styles.toggleBtnText, editData.payment_status === s && styles.toggleBtnTextActive]}>{s.replace('_', ' ').toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Booking Status</Text>
            <View style={styles.btnGroup}>
              {['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map(s => (
                <TouchableOpacity key={s} style={[styles.toggleBtn, editData.status === s && styles.toggleBtnActive]} onPress={() => setEditData({...editData, status: s})}>
                  <Text style={[styles.toggleBtnText, editData.status === s && styles.toggleBtnTextActive]}>{s.replace('_', ' ').toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnCancelSecondary} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.btnCancelTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveEdit}>
                <Text style={styles.btnSaveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 25 },
  header: { marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  breadcrumbText: { fontSize: 14, color: '#94a3b8', marginLeft: 10, fontWeight: '500' },
  breadcrumbActive: { color: '#1e293b', fontWeight: 'bold' },
  
  contentRow: { flexDirection: 'row', gap: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 25, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  col1: { flex: 1.2 },
  col2: { flex: 2 },
  col3: { flex: 1.3 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  linkText: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },

  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 25 },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarLargeText: { fontSize: 24, fontWeight: 'bold', color: '#3b82f6' },
  guestNameLarge: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  guestIdText: { fontSize: 13, color: '#64748b', marginTop: 4 },

  contactInfo: { marginBottom: 25 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  contactIconBg: { backgroundColor: '#d1fae5', padding: 6, borderRadius: 6, overflow: 'hidden' },
  contactText: { fontSize: 14, color: '#475569', fontWeight: '500' },

  sectionSubTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, marginTop: 10 },
  grid2Col: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  grid3Col: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 }, 
  gridItem2: { width: '45%', marginBottom: 15 }, 
  labelSmall: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  valueSmall: { fontSize: 14, fontWeight: '600', color: '#1e293b' },

  statusBadgeConfirmed: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 6, marginBottom: 15 },
  statusBadgeConfirmedText: { fontSize: 12, fontWeight: 'bold', color: '#15803d' },
  bookingIdLarge: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 25 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },
  noteText: { fontSize: 13, color: '#475569', lineHeight: 20 },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 40 },
  btnEdit: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  btnEditText: { fontWeight: 'bold', color: '#475569' },
  btnCancel: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fee2e2' },
  btnCancelText: { fontWeight: 'bold', color: '#ef4444' },

  roomImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 15 },
  roomSpecsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  roomSpecText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  badgePaid: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePaidText: { fontSize: 11, fontWeight: 'bold', color: '#15803d' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  summaryTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  summaryTotalValue: { fontSize: 22, fontWeight: 'bold', color: '#166534' }, // Highlight màu xanh bự lên

  // STYLES CHO MODAL EDIT
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 30, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  
  dateInput: { borderWidth: 1, borderColor: '#e2e8f0', padding: 10, borderRadius: 8, backgroundColor: '#fff', fontSize: 14, color: '#1e293b' },

  btnGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  toggleBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  toggleBtnText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  toggleBtnTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  btnCancelSecondary: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  btnCancelTextSecondary: { color: '#475569', fontWeight: 'bold' },
  btnSave: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b82f6' },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },
});