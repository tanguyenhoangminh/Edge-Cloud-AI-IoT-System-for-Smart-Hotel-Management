import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons, AntDesign, Ionicons } from '@expo/vector-icons';

export default function StaffScreen() {
  const [staffData, setStaffData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States Lọc & Tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [activeDropdown, setActiveDropdown] = useState(null);

  // States Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // States Modal (Thêm/Sửa/Xem)
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'edit', 'add'
  const [selectedStaff, setSelectedStaff] = useState({ first_name: '', last_name: '', phone: '', role: 'Housekeeping', email: '' });

  const API_URL = 'http://localhost:5000/api/staff';
  const TASK_URL = 'http://localhost:5000/api/tasks';

  const fetchStaff = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setStaffData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    const interval = setInterval(fetchStaff, 5000);
    return () => clearInterval(interval);
  }, []);

  // HÀM: HOÀN THÀNH CÔNG VIỆC
  const handleCompleteTask = async (task_id, room_id) => {
    if (window.confirm("Đánh dấu công việc này là đã hoàn thành? (Phòng sẽ tự động chuyển về Available)")) {
      try {
        const response = await fetch(`${TASK_URL}/${task_id}/complete`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id })
        });
        if (response.ok) fetchStaff();
      } catch (error) { console.error(error); }
    }
  };

  // HÀM: XÓA NHÂN VIÊN
  const handleDeleteStaff = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn vô hiệu hóa nhân viên này?")) {
      try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        fetchStaff();
      } catch (error) { console.error(error); }
    }
  };

  // HÀM: LƯU THÊM/SỬA
  const handleSaveStaff = async () => {
    try {
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      const url = modalMode === 'add' ? API_URL : `${API_URL}/${selectedStaff.staff_id}`;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedStaff)
      });
      if (response.ok) {
        setIsModalVisible(false);
        fetchStaff();
      }
    } catch (error) { console.error(error); }
  };

  // Mở Modal
  const openModal = (mode, staff = null) => {
    setModalMode(mode);
    if (staff) setSelectedStaff(staff);
    else setSelectedStaff({ first_name: '', last_name: '', phone: '', role: 'Housekeeping', email: '' });
    setIsModalVisible(true);
  };

  // ĐÃ FIX: BỔ SUNG TÌM KIẾM THEO SỐ PHÒNG (ROOM NUMBER)
  const processedData = useMemo(() => {
    let filtered = staffData;
    
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.full_name.toLowerCase().includes(lowerQuery) || 
        s.phone.includes(lowerQuery) ||
        (s.room_number && s.room_number.toString().includes(lowerQuery)) // Thêm dòng này để tìm số phòng
      );
    }
    
    if (filterRole !== 'All') {
      filtered = filtered.filter(s => s.role.toLowerCase() === filterRole.toLowerCase());
    }
    
    if (filterStatus !== 'All') {
      filtered = filtered.filter(s => s.status.toLowerCase() === filterStatus.toLowerCase());
    }
    
    return filtered;
  }, [searchQuery, filterRole, filterStatus, staffData]);

  // XỬ LÝ PHÂN TRANG
  const totalPages = Math.max(1, Math.ceil(processedData.length / ITEMS_PER_PAGE));
  const paginatedData = processedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterRole, filterStatus]);

  const getPageNumbers = () => {
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    return Array.from({ length: (endPage - startPage) + 1 }, (_, i) => startPage + i);
  };

  return (
    <View style={styles.container}>
      {/* HEADER SECTION */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.pageTitle}>Staff</Text>
            <Text style={styles.summaryText}>{staffData.length} registered staff total</Text>
          </View>
          <TouchableOpacity style={styles.btnAdd} onPress={() => openModal('add')}>
            <AntDesign name="plus" size={16} color="#fff" />
            <Text style={styles.btnAddText}>Add Staff</Text>
          </TouchableOpacity>
        </View>

        {/* BỘ LỌC */}
        <View style={styles.filterRow}>
          <View style={styles.searchBox}>
            <AntDesign name="search1" size={16} color="#94a3b8" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search by name, phone or room..." 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
            />
          </View>

          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setActiveDropdown('role')}>
            <Text style={styles.dropdownBtnText}>Role: <Text style={{color: '#1e293b'}}>{filterRole}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setActiveDropdown('status')}>
            <Text style={styles.dropdownBtnText}>Status: <Text style={{color: '#1e293b'}}>{filterStatus}</Text></Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* TABLE */}
      <View style={styles.tableWrapper}>
        <View style={styles.tableContainer}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colHeader, styles.colId]}>ID</Text>
            <Text style={[styles.colHeader, styles.colName]}>STAFF NAME</Text>
            <Text style={[styles.colHeader, styles.colPhone]}>PHONE</Text>
            <Text style={[styles.colHeader, styles.colRole]}>ROLE</Text>
            <Text style={[styles.colHeader, styles.colStatus]}>STATUS</Text>
            <Text style={[styles.colHeader, styles.colTask]}>CURRENT TASK</Text>
            <Text style={[styles.colHeader, styles.colAction]}>ACTIONS</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            {isLoading ? <ActivityIndicator style={{marginTop: 40}} size="large" color="#3b82f6" /> : (
              paginatedData.map((staff, index) => (
                <View key={staff.task_id ? `s-${staff.staff_id}-t-${staff.task_id}` : `s-${staff.staff_id}`} style={[styles.tableRow, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                  <Text style={[styles.cellText, styles.colId, styles.textLight]}>{staff.staff_id}</Text>
                  
                  <View style={[styles.colName, {flexDirection: 'row', alignItems: 'center', gap: 10}]}>
                    <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{staff.first_name?.charAt(0) || 'S'}</Text></View>
                    <Text style={[styles.cellText, styles.textBold]}>{staff.full_name}</Text>
                  </View>

                  <Text style={[styles.cellText, styles.colPhone]}>{staff.phone}</Text>
                  
                  <View style={styles.colRole}>
                    <View style={styles.roleBadge}><Text style={styles.roleText}>{staff.role}</Text></View>
                  </View>

                  <View style={styles.colStatus}>
                    <View style={[styles.badge, staff.status === 'Available' ? styles.bgSuccess : styles.bgDanger]}>
                      <Text style={[styles.badgeText, staff.status === 'Available' ? styles.textSuccess : styles.textDanger]}>
                        {staff.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* CỘT TASK */}
                  <View style={styles.colTask}>
                    {staff.task_type ? (
                       <View style={styles.taskContainer}>
                         <Text style={styles.taskText}>{staff.task_type.toUpperCase()} - Rm {staff.room_number}</Text>
                         <TouchableOpacity style={styles.btnSmallDone} onPress={() => handleCompleteTask(staff.task_id, staff.room_id)}>
                           <MaterialCommunityIcons name="check" size={14} color="#fff" />
                           <Text style={styles.btnSmallDoneText}>Done</Text>
                         </TouchableOpacity>
                       </View>
                    ) : <Text style={styles.textLight}>---</Text>}
                  </View>

                  {/* 3 NÚT ACTIONS */}
                  <View style={[styles.colAction, styles.actionIcons]}>
                    <TouchableOpacity onPress={() => openModal('view', staff)}>
                      <MaterialCommunityIcons name="eye-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openModal('edit', staff)}>
                      <MaterialCommunityIcons name="pencil-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteStaff(staff.staff_id)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      {/* PHÂN TRANG */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={currentPage === 1 ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
          {getPageNumbers().map(num => (
            <TouchableOpacity key={num} style={[styles.pageBtn, currentPage === num && styles.pageBtnActive]} onPress={() => setCurrentPage(num)}>
              <Text style={[styles.pageBtnText, currentPage === num && styles.pageBtnTextActive]}>{num}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={currentPage === totalPages ? "#cbd5e1" : "#475569"} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL LỌC DROPDOWN */}
      {activeDropdown && (
        <Modal transparent animationType="fade" visible={true}>
          <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
            <View style={styles.dropdownOverlay}>
              <View style={styles.dropdownMenuBox}>
                <Text style={styles.dropdownTitle}>Select {activeDropdown}</Text>
                <ScrollView>
                  {(activeDropdown === 'role' ? ['All', 'Housekeeping', 'Maintenance'] : ['All', 'Available', 'Busy']).map((option, idx) => (
                    <TouchableOpacity 
                      key={idx} style={styles.dropdownOptionBtn}
                      onPress={() => {
                        if(activeDropdown === 'role') setFilterRole(option);
                        if(activeDropdown === 'status') setFilterStatus(option);
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

      {/* MODAL TƯƠNG TÁC (VIEW/EDIT/ADD) */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayDark}>
          <View style={[styles.modalContentBox, { width: 450 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalMode === 'add' ? 'Add New Staff' : modalMode === 'edit' ? 'Edit Staff' : 'Staff Profile'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}><Ionicons name="close" size={24} color="#64748b" /></TouchableOpacity>
            </View>

            <View style={{ gap: 15, marginBottom: 20 }}>
              <View>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput style={styles.inputField} value={selectedStaff.first_name} onChangeText={t => setSelectedStaff({...selectedStaff, first_name: t})} editable={modalMode !== 'view'} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput style={styles.inputField} value={selectedStaff.last_name} onChangeText={t => setSelectedStaff({...selectedStaff, last_name: t})} editable={modalMode !== 'view'} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput style={styles.inputField} value={selectedStaff.phone} onChangeText={t => setSelectedStaff({...selectedStaff, phone: t})} editable={modalMode !== 'view'} />
              </View>
              
              {modalMode === 'add' && (
                <View>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput style={styles.inputField} value={selectedStaff.email} onChangeText={t => setSelectedStaff({...selectedStaff, email: t})} />
                </View>
              )}

              <View>
                <Text style={styles.inputLabel}>Role</Text>
                <View style={{flexDirection: 'row', gap: 10}}>
                  <TouchableOpacity style={[styles.roleSelectBtn, selectedStaff.role === 'Housekeeping' && styles.roleSelectActive]} onPress={() => modalMode !== 'view' && setSelectedStaff({...selectedStaff, role: 'Housekeeping'})}>
                    <Text style={{color: selectedStaff.role === 'Housekeeping' ? '#3b82f6' : '#64748b'}}>Housekeeping</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.roleSelectBtn, selectedStaff.role === 'Maintenance' && styles.roleSelectActive]} onPress={() => modalMode !== 'view' && setSelectedStaff({...selectedStaff, role: 'Maintenance'})}>
                    <Text style={{color: selectedStaff.role === 'Maintenance' ? '#3b82f6' : '#64748b'}}>Maintenance</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setIsModalVisible(false)}><Text style={{fontWeight: 'bold', color: '#475569'}}>Close</Text></TouchableOpacity>
              {modalMode !== 'view' && (
                <TouchableOpacity style={styles.btnSave} onPress={handleSaveStaff}>
                  <Text style={{fontWeight: 'bold', color: '#fff'}}>Save Changes</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  headerSection: { paddingHorizontal: 25, paddingTop: 25, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  summaryText: { fontSize: 13, color: '#64748b', marginTop: 4 },
  
  btnAdd: { flexDirection: 'row', backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', gap: 6 },
  btnAddText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  filterRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, outlineStyle: 'none', marginLeft: 10 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 150 },
  dropdownBtnText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  
  tableWrapper: { flex: 1, paddingHorizontal: 25, paddingBottom: 80 },
  tableContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  colHeader: { fontSize: 11, fontWeight: 'bold', color: '#64748b', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: '#fafafb' }, 
  cellText: { fontSize: 13, color: '#1e293b' },
  textBold: { fontWeight: '600' },
  textLight: { color: '#94a3b8' },
  
  colId: { flex: 0.5 }, 
  colName: { flex: 2 }, 
  colPhone: { flex: 1.5 }, 
  colRole: { flex: 1.2 }, 
  colStatus: { flex: 1 }, 
  colTask: { flex: 2 }, 
  colAction: { flex: 1, alignItems: 'center' },
  
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 14 },
  
  roleBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e2e8f0' },
  roleText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  bgSuccess: { backgroundColor: '#dcfce7' }, textSuccess: { color: '#166534' },
  bgDanger: { backgroundColor: '#fee2e2' }, textDanger: { color: '#991b1b' },
  
  taskContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskText: { fontSize: 12, fontWeight: 'bold', color: '#b45309', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnSmallDone: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  btnSmallDoneText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  actionIcons: { flexDirection: 'row', justifyContent: 'center', gap: 15 },

  paginationContainer: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#fff', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  pageBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pageBtnDisabled: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  pageBtnText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  pageBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },

  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenuBox: { width: 200, backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 5 },
  dropdownTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 15, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 10 },
  dropdownOptionBtn: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  dropdownOptionText: { fontSize: 14, color: '#475569' },

  modalOverlayDark: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContentBox: { backgroundColor: '#fff', borderRadius: 16, padding: 30, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 6 },
  inputField: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc' },
  roleSelectBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
  roleSelectActive: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  btnCancel: { padding: 12, borderRadius: 8, backgroundColor: '#f1f5f9', minWidth: 80, alignItems: 'center' },
  btnSave: { padding: 12, borderRadius: 8, backgroundColor: '#3b82f6', alignItems: 'center', paddingHorizontal: 20 },
});