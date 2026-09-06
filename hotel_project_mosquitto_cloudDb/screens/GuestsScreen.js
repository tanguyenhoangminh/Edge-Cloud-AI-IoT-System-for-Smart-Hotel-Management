import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons, AntDesign, Ionicons } from '@expo/vector-icons';

export default function GuestsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('All');
  const [filterNationality, setFilterNationality] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [guestsData, setGuestsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State quản lý Modal Add/Edit
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ guest_id: '', full_name: '', phone: '', nationality: '', passport_no: '', gender: 'Male' });

  // State quản lý Modal View (Nút Mắt)
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [viewData, setViewData] = useState(null);

  // State quản lý Modal Dropdown Filter
  const [activeDropdown, setActiveDropdown] = useState(null);

  const API_URL = 'https://192.168.1.9:5000/api/guests';

  // Danh sách các tùy chọn Lọc
  const dropdownOptions = {
    gender: ['All', 'Male', 'Female'],
    nationality: ['All', 'Vietnamese', 'American', 'British', 'Japanese', 'Korean', 'French']
  };

  // 1. FETCH API LẤY DỮ LIỆU TỪ MYSQL
  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      if (Array.isArray(data)) {
        const formattedData = data.map(guest => {
          const dateObj = new Date(guest.created_at);
          return {
            ...guest,
            display_name: `${guest.first_name} ${guest.last_name}`,
            registered: isNaN(dateObj) ? '--' : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          };
        });
        setGuestsData(formattedData);
      }
    } catch (error) {
      console.error("Lỗi Fetch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchGuests(); }, []);

  // 2. XỬ LÝ ACTIONS (XEM, THÊM, SỬA, XÓA)
  const openViewModal = (guest) => {
    setViewData(guest);
    setIsViewModalVisible(true);
  };

  const openAddModal = () => {
    setFormData({ guest_id: '', full_name: '', phone: '', nationality: '', passport_no: '', gender: 'Male' });
    setIsEditMode(false);
    setIsModalVisible(true);
  };

  const openEditModal = (guest) => {
    setFormData({
      guest_id: guest.guest_id,
      full_name: guest.display_name,
      phone: guest.phone || '',
      nationality: guest.nationality || '',
      passport_no: guest.passport_no || '',
      gender: guest.gender || 'Male'
    });
    setIsEditMode(true);
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if(!formData.full_name || !formData.passport_no) return alert("Vui lòng nhập tên và passport!");
    
    try {
      const url = isEditMode ? `${API_URL}/${formData.guest_id}` : API_URL;
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalVisible(false);
        fetchGuests(); // Load lại data
      } else {
        alert("Có lỗi xảy ra khi lưu dữ liệu!");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = (id) => {
    if(window.confirm("Bạn có chắc chắn muốn xóa khách hàng này không?")) {
      fetch(`${API_URL}/${id}`, { method: 'DELETE' })
        .then(res => { if (res.ok) fetchGuests(); })
        .catch(err => console.error(err));
    }
  };

  // 3. XỬ LÝ LỌC & TÌM KIẾM
  const processedData = useMemo(() => {
    let filtered = guestsData;
    
    // Tìm kiếm theo tên, phone, passport
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.display_name?.toLowerCase().includes(lowerQuery) || 
        g.passport_no?.toLowerCase().includes(lowerQuery) ||
        g.phone?.includes(lowerQuery)
      );
    }
    
    // Lọc theo Giới tính
    if (filterGender !== 'All') {
      filtered = filtered.filter(g => g.gender === filterGender);
    }
    
    // Lọc theo Quốc tịch
    if (filterNationality !== 'All') {
      filtered = filtered.filter(g => g.nationality === filterNationality);
    }
    
    return filtered;
  }, [searchQuery, filterGender, filterNationality, guestsData]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));
  const paginatedGuests = processedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterGender, filterNationality]);

  return (
    <View style={styles.container}>
      
      {/* HEADER SECTION */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.pageTitle}>Guests</Text>
            {isLoading ? (
               <ActivityIndicator size="small" color="#3b82f6" style={{ alignSelf: 'flex-start', marginTop: 4 }}/>
            ) : (
               <Text style={styles.summaryText}>{guestsData.length} registered guests total</Text>
            )}
          </View>
          <TouchableOpacity style={styles.btnAdd} onPress={openAddModal}>
            <AntDesign name="plus" size={16} color="#fff" />
            <Text style={styles.btnAddText}>Add Guest</Text>
          </TouchableOpacity>
        </View>

        {/* TOOLBAR */}
        <View style={styles.toolbarContainer}>
          <View style={styles.searchBox}>
            <AntDesign name="search1" size={18} color="#94a3b8" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by name, phone, or passport..." 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
            />
          </View>
          
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setActiveDropdown('gender')}>
            <Text style={styles.dropdownBtnText}>Gender: <Text style={{color: '#1e293b'}}>{filterGender}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setActiveDropdown('nationality')}>
            <Text style={styles.dropdownBtnText}>Nationality: <Text style={{color: '#1e293b'}}>{filterNationality}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* BẢNG DỮ LIỆU */}
      <View style={styles.tableWrapper}>
        <View style={styles.tableContainer}>
          
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colHeader, styles.colId]}>ID</Text>
            <Text style={[styles.colHeader, styles.colGuest]}>GUEST</Text>
            <Text style={[styles.colHeader, styles.colPhone]}>PHONE</Text>
            <Text style={[styles.colHeader, styles.colNat]}>NATIONALITY</Text>
            <Text style={[styles.colHeader, styles.colPass]}>PASSPORT</Text>
            <Text style={[styles.colHeader, styles.colGen]}>GENDER</Text>
            <Text style={[styles.colHeader, styles.colReg]}>REGISTERED</Text>
            <Text style={[styles.colHeader, styles.colAction]}>ACTIONS</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={styles.emptyState}>
                 <ActivityIndicator size="large" color="#3b82f6" />
                 <Text style={styles.emptyStateText}>Loading data...</Text>
              </View>
            ) : paginatedGuests.length > 0 ? (
              paginatedGuests.map((guest, index) => (
                <View key={guest.guest_id} style={[styles.tableRow, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <Text style={[styles.cellText, styles.colId, styles.textLight]}>{guest.guest_id}</Text>
                  
                  <View style={[styles.colGuest, styles.guestInfoCell]}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{guest.first_name?.charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                    <Text style={[styles.cellText, styles.textBold]}>{guest.display_name}</Text>
                  </View>
                  
                  <Text style={[styles.cellText, styles.colPhone]}>{guest.phone || '---'}</Text>
                  
                  <View style={[styles.colNat, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={styles.natBadge}>
                      <Text style={styles.natBadgeText}>
                        {guest.nationality?.substring(0, 3).toUpperCase() || '---'}
                      </Text>
                    </View>
                    <Text style={styles.cellText}>{guest.nationality}</Text>
                  </View>
                  
                  <Text style={[styles.cellText, styles.colPass, styles.textBold, { color: '#475569' }]}>{guest.passport_no || '---'}</Text>
                  
                  <View style={styles.colGen}>
                    <View style={[styles.genderBadge, guest.gender === 'Female' ? styles.genderFemale : styles.genderMale]}>
                      <Text style={[styles.genderBadgeText, guest.gender === 'Female' ? styles.genderTextFemale : styles.genderTextMale]}>
                        {guest.gender}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cellText, styles.colReg, styles.textLight]}>{guest.registered}</Text>
                  
                  <View style={[styles.colAction, styles.actionCell]}>
                    {/* GẮN SỰ KIỆN MỞ VIEW MODAL Ở ĐÂY */}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openViewModal(guest)}>
                      <MaterialCommunityIcons name="eye-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(guest)}>
                      <MaterialCommunityIcons name="pencil-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(guest.guest_id)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-search-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No guests found.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={currentPage === 1 ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(num => num >= currentPage - 2 && num <= currentPage + 2)
            .map(num => (
            <TouchableOpacity key={num} style={[styles.pageBtn, currentPage === num && styles.pageBtnActive]} onPress={() => setCurrentPage(num)}>
              <Text style={[styles.pageBtnText, currentPage === num && styles.pageBtnTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={currentPage === totalPages ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL LỌC DROPDOWN */}
      {activeDropdown && (
        <Modal transparent animationType="fade" visible={true}>
          <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
            <View style={styles.dropdownOverlay}>
              <View style={styles.dropdownMenuBox}>
                <Text style={styles.dropdownTitle}>Select {activeDropdown.charAt(0).toUpperCase() + activeDropdown.slice(1)}</Text>
                <ScrollView style={{maxHeight: 250}}>
                  {dropdownOptions[activeDropdown].map((option, idx) => (
                    <TouchableOpacity 
                      key={idx} style={styles.dropdownOptionBtn}
                      onPress={() => {
                        if(activeDropdown === 'gender') setFilterGender(option);
                        if(activeDropdown === 'nationality') setFilterNationality(option);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* MODAL XEM CHI TIẾT KHÁCH HÀNG (NÚT MẮT) */}
      <Modal visible={isViewModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: 500 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Guest Details</Text>
              <TouchableOpacity onPress={() => setIsViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {viewData && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{flexDirection: 'row', gap: 15, marginBottom: 15}}>
                  <View style={[styles.detailCard, {flex: 1}]}>
                    <Text style={styles.detailLabel}>Guest ID</Text>
                    <Text style={styles.detailValue}>#{viewData.guest_id}</Text>
                  </View>
                  <View style={[styles.detailCard, {flex: 2}]}>
                    <Text style={styles.detailLabel}>Full Name</Text>
                    <Text style={[styles.detailValue, {fontWeight: 'bold'}]}>{viewData.display_name}</Text>
                  </View>
                </View>

                <View style={{flexDirection: 'row', gap: 15, marginBottom: 15}}>
                  <View style={[styles.detailCard, {flex: 1}]}>
                    <Text style={styles.detailLabel}>Phone Number</Text>
                    <Text style={styles.detailValue}>{viewData.phone || '---'}</Text>
                  </View>
                  <View style={[styles.detailCard, {flex: 1}]}>
                    <Text style={styles.detailLabel}>Passport No.</Text>
                    <Text style={[styles.detailValue, {color: '#475569', fontWeight: 'bold'}]}>{viewData.passport_no || '---'}</Text>
                  </View>
                </View>

                <View style={{flexDirection: 'row', gap: 15, marginBottom: 15}}>
                  <View style={[styles.detailCard, {flex: 1}]}>
                    <Text style={styles.detailLabel}>Nationality</Text>
                    <Text style={styles.detailValue}>{viewData.nationality || '---'}</Text>
                  </View>
                  <View style={[styles.detailCard, {flex: 1}]}>
                    <Text style={styles.detailLabel}>Gender</Text>
                    <Text style={styles.detailValue}>{viewData.gender}</Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailLabel}>Registered Date</Text>
                  <Text style={styles.detailValue}>{viewData.registered}</Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnSave} onPress={() => setIsViewModalVisible(false)}>
                <Text style={styles.btnSaveText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL THÊM / SỬA KHÁCH HÀNG */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditMode ? 'Edit Guest Info' : 'Add New Guest'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.inputField} placeholder="Enter full name" value={formData.full_name} onChangeText={t => setFormData({...formData, full_name: t})} />
            </View>

            <View style={{flexDirection: 'row', gap: 15}}>
              <View style={[styles.formGroup, {flex: 1}]}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput style={styles.inputField} placeholder="+1 234 567 8900" value={formData.phone} onChangeText={t => setFormData({...formData, phone: t})} />
              </View>
              <View style={[styles.formGroup, {flex: 1}]}>
                <Text style={styles.inputLabel}>Passport No.</Text>
                <TextInput style={styles.inputField} placeholder="e.g., A1234567" value={formData.passport_no} onChangeText={t => setFormData({...formData, passport_no: t})} />
              </View>
            </View>

            <View style={{flexDirection: 'row', gap: 15}}>
              <View style={[styles.formGroup, {flex: 1}]}>
                <Text style={styles.inputLabel}>Nationality</Text>
                <TextInput style={styles.inputField} placeholder="Vietnamese" value={formData.nationality} onChangeText={t => setFormData({...formData, nationality: t})} />
              </View>
              <View style={[styles.formGroup, {flex: 1}]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderSelectGroup}>
                  <TouchableOpacity style={[styles.genderBtn, formData.gender === 'Male' && styles.genderBtnActive]} onPress={() => setFormData({...formData, gender: 'Male'})}>
                    <Text style={[styles.genderBtnText, formData.gender === 'Male' && styles.genderBtnTextActive]}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.genderBtn, formData.gender === 'Female' && styles.genderBtnActive]} onPress={() => setFormData({...formData, gender: 'Female'})}>
                    <Text style={[styles.genderBtnText, formData.gender === 'Female' && styles.genderBtnTextActive]}>Female</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
                <Text style={styles.btnSaveText}>{isEditMode ? 'Update Guest' : 'Save Guest'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerSection: { backgroundColor: '#f8fafc', paddingHorizontal: 25, paddingTop: 25, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  summaryText: { fontSize: 13, color: '#64748b', marginTop: 4 },
  btnAdd: { flexDirection: 'row', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', gap: 6 },
  btnAddText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  toolbarContainer: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 15, borderRadius: 8, gap: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, outlineStyle: 'none' },
  
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 150 },
  dropdownBtnText: { fontSize: 13, color: '#475569', fontWeight: '500' },

  tableWrapper: { flex: 1, paddingHorizontal: 25, paddingBottom: 80 },
  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  colHeader: { fontSize: 12, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5 },
  
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: '#fafafb' }, 
  
  cellText: { fontSize: 14, color: '#1e293b' },
  textBold: { fontWeight: '600' },
  textLight: { color: '#64748b' },

  colId: { flex: 0.5, paddingLeft: 5 },
  colGuest: { flex: 2 },
  colPhone: { flex: 1.5 },
  colNat: { flex: 1.2 },
  colPass: { flex: 1.2 },
  colGen: { flex: 0.8 },
  colReg: { flex: 1.2 },
  colAction: { flex: 1, alignItems: 'center' },

  guestInfoCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe' },
  avatarText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
  natBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  natBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  genderBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  genderMale: { backgroundColor: '#f0fdf4' },
  genderFemale: { backgroundColor: '#fdf2f8' },
  genderTextMale: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  genderTextFemale: { color: '#db2777', fontSize: 12, fontWeight: '600' },

  actionCell: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  actionBtn: { padding: 4 },

  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { marginTop: 10, color: '#94a3b8', fontSize: 15 },

  paginationContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#fff', padding: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pageBtnDisabled: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  pageBtnText: { fontSize: 16, color: '#475569', fontWeight: '500' },
  pageBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center' },
  
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenuBox: { width: 300, backgroundColor: '#fff', borderRadius: 12, padding: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  dropdownTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 10 },
  dropdownOptionBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  dropdownOptionText: { fontSize: 15, color: '#475569' },

  modalContent: { width: 500, backgroundColor: '#fff', borderRadius: 16, padding: 30, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  formGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  inputField: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10, fontSize: 14, color: '#1e293b' },
  
  genderSelectGroup: { flexDirection: 'row', gap: 10 },
  genderBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', alignItems: 'center' },
  genderBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  genderBtnText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  genderBtnTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10 },
  btnCancel: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#475569', fontWeight: 'bold' },
  btnSave: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b82f6' },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },

  // STYLES MỚI CHO MODAL VIEW (NÚT MẮT)
  detailCard: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  detailLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 15, color: '#1e293b' }
});