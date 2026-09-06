import React, { useState, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChatContext } from '../ChatContext'; // Nhớ trỏ đúng đường dẫn

export default function FloatingChatWidget() {
  // Đã rút thêm setUnreadCount từ ChatContext ra
  const { messages, setMessages, setUnreadCount } = useContext(ChatContext);
  
  const [isOpen, setIsOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isNicknameSet, setIsNicknameSet] = useState(false);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef();

  const handleStartChat = () => {
    if (nickname.trim()) setIsNicknameSet(true);
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg = {
      id: Date.now(),
      sender: nickname,
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAdmin: false
    };
    
    setMessages(prev => [...prev, newMsg]);
    
    // TĂNG SỐ TIN NHẮN CHƯA ĐỌC LÊN 1 ĐỂ BÁO VỀ ADMIN
    setUnreadCount(prev => prev + 1);
    
    setInputText('');
  };
  // Nút bong bóng khi chưa mở
  if (!isOpen) {
    return (
      <TouchableOpacity style={styles.floatingButton} onPress={() => setIsOpen(true)}>
        <MaterialCommunityIcons name="chat-processing" size={32} color="#fff" />
      </TouchableOpacity>
    );
  }

  // Khung chat khi đã mở
  return (
    <View style={styles.chatPanel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contact with us</Text>
        <TouchableOpacity onPress={() => setIsOpen(false)}>
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {!isNicknameSet ? (
        <View style={styles.nicknameContainer}>
          <MaterialCommunityIcons name="account-circle-outline" size={48} color="#0ea5e9" style={{marginBottom: 10}}/>
          <Text style={styles.nicknamePrompt}>Please type your username to send the messages!:</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Username..." 
            value={nickname}
            onChangeText={setNickname}
            onSubmitEditing={handleStartChat}
          />
          <TouchableOpacity style={styles.startBtn} onPress={handleStartChat}>
            <Text style={styles.startBtnText}>Bắt đầu Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.chatContainer}>
          <ScrollView 
            style={styles.messageArea} 
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({animated: true})}
          >
            {messages.map(msg => (
              <View key={msg.id} style={[styles.messageBubble, msg.isAdmin ? styles.msgAdmin : styles.msgClient]}>
                {msg.isAdmin && <MaterialCommunityIcons name="face-agent" size={20} color="#0ea5e9" style={{marginRight: 5, alignSelf: 'flex-end'}}/>}
                <View style={[styles.bubbleBg, msg.isAdmin ? styles.bgAdmin : styles.bgClient]}>
                  <Text style={[styles.msgText, msg.isAdmin ? styles.textAdmin : styles.textClient]}>{msg.text}</Text>
                  <Text style={styles.timeText}>{msg.time}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.inputArea}>
            <TextInput 
              style={styles.chatInput} 
              placeholder="Nhập tin nhắn..." 
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
              <MaterialCommunityIcons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5, zIndex: 9999 },
  chatPanel: { position: 'absolute', bottom: 20, right: 20, width: 320, height: 450, backgroundColor: '#fff', borderRadius: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 9999, overflow: 'hidden' },
  header: { backgroundColor: '#0ea5e9', padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  nicknameContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  nicknamePrompt: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 15 },
  startBtn: { backgroundColor: '#0ea5e9', padding: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: 'bold' },

  chatContainer: { flex: 1 },
  messageArea: { flex: 1, padding: 15 },
  messageBubble: { maxWidth: '85%', marginBottom: 15, flexDirection: 'row' },
  msgAdmin: { alignSelf: 'flex-start' },
  msgClient: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubbleBg: { padding: 12, borderRadius: 12 },
  bgAdmin: { backgroundColor: '#f1f5f9', borderBottomLeftRadius: 2 },
  bgClient: { backgroundColor: '#0ea5e9', borderBottomRightRadius: 2 },
  msgText: { fontSize: 14 },
  textAdmin: { color: '#1e293b' },
  textClient: { color: '#fff' },
  timeText: { fontSize: 10, color: '#94a3b8', marginTop: 5, alignSelf: 'flex-end' },
  
  inputArea: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  chatInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginRight: 10 },
  sendBtn: { backgroundColor: '#0ea5e9', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
});