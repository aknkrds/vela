import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '@/src/api/client';

export default function SupportTicketDetail() {
  const { fontSizeScale, t, colors } = useSettings();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const fetchTicketDetails = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get(`/support/tickets/${id}`);
      setTicket(response.data);
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTicketDetails(true);

      // Auto poll every 8 seconds for new responses from admin
      const interval = setInterval(() => {
        fetchTicketDetails(false);
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [id]);

  useEffect(() => {
    // Scroll chat to bottom when ticket messages load or change
    if (ticket?.messages?.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [ticket?.messages]);

  const getStatusColor = (status: string) => {
    return status === 'open' ? colors.success : colors.textMuted;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'open') return t('supportStatusOpen') || 'Açık';
    return t('supportStatusClosed') || 'Kapalı';
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    if (ticket?.status === 'closed') {
      Alert.alert(t('error') || 'Hata', 'Bu talep kapatılmıştır. Yeni mesaj gönderemezsiniz.');
      return;
    }

    setSending(true);
    try {
      const response = await api.post(`/support/tickets/${id}/message`, {
        content: replyText,
      });

      if (response.data.success) {
        setReplyText('');
        await fetchTicketDetails(false);
      }
    } catch (err: any) {
      console.error('Error sending reply:', err);
      Alert.alert(t('error') || 'Hata', err.response?.data?.detail || 'Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  if (loading && !ticket) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.textPrimary }}>Bilet bulunamadı.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = ticket.image_url ? `${backendUrl}${ticket.image_url}` : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace('/support/list')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>
            {ticket.ticket_id}
          </Text>
          <Text style={[styles.headerSubtitle, { fontSize: 13 * fontSizeScale, color: colors.textSecondary }]} numberOfLines={1}>
            {ticket.subject}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '1A' }]}>
          <Text style={[styles.statusText, { fontSize: 11 * fontSizeScale, color: getStatusColor(ticket.status) }]}>
            {getStatusLabel(ticket.status)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Ticket Information Card */}
          <View style={[styles.ticketInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { fontSize: 13 * fontSizeScale, color: colors.textMuted }]}>
              Talep Sahibi
            </Text>
            <Text style={[styles.infoValue, { fontSize: 15 * fontSizeScale, color: colors.textPrimary }]}>
              {ticket.name} ({ticket.phone})
            </Text>

            <Text style={[styles.infoLabel, { fontSize: 13 * fontSizeScale, color: colors.textMuted, marginTop: 10 }]}>
              Açıklama
            </Text>
            <Text style={[styles.infoValue, { fontSize: 15 * fontSizeScale, color: colors.textPrimary, lineHeight: 22 }]}>
              {ticket.description}
            </Text>

            {imageUrl && (
              <View style={styles.attachedImageContainer}>
                <Text style={[styles.infoLabel, { fontSize: 13 * fontSizeScale, color: colors.textMuted, marginBottom: 6 }]}>
                  Ekli Görsel
                </Text>
                <Image source={{ uri: imageUrl }} style={styles.attachedImage} />
              </View>
            )}
          </View>

          {/* Conversation Title */}
          <Text style={[styles.chatTitle, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportChatTitle') || 'Destek Görüşmesi'}
          </Text>

          {/* Messages Thread */}
          <View style={styles.chatContainer}>
            {ticket.messages && ticket.messages.length > 0 ? (
              ticket.messages.map((msg: any) => {
                const isUser = msg.sender === 'user';
                return (
                  <View
                    key={msg.message_id}
                    style={[
                      styles.messageRow,
                      isUser ? styles.messageRowUser : styles.messageRowAdmin
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isUser 
                          ? [styles.bubbleUser, { backgroundColor: colors.accent }]
                          : [styles.bubbleAdmin, { backgroundColor: colors.surface, borderColor: colors.border }]
                      ]}
                    >
                      <Text
                        style={[
                          styles.senderName,
                          { fontSize: 11 * fontSizeScale, color: isUser ? '#e0f2fe' : colors.textSecondary }
                        ]}
                      >
                        {msg.sender_name}
                      </Text>
                      <Text
                        style={[
                          styles.messageText,
                          { fontSize: 14 * fontSizeScale, color: isUser ? '#fff' : colors.textPrimary }
                        ]}
                      >
                        {msg.content}
                      </Text>
                      <Text
                        style={[
                          styles.messageTime,
                          { fontSize: 9 * fontSizeScale, color: isUser ? '#cbd5e1' : colors.textMuted }
                        ]}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.noMessagesContainer}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.noMessagesText, { fontSize: 13 * fontSizeScale, color: colors.textMuted }]}>
                  Henüz mesaj yazılmamış. Sorununuz incelendikten sonra yönetici buradan cevap verecektir.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Input Bar */}
        {ticket.status === 'open' ? (
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              style={[
                styles.chatInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  fontSize: 14 * fontSizeScale,
                }
              ]}
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t('supportChatPlaceholder') || 'Bir mesaj yazın...'}
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              onPress={handleSendReply}
              disabled={sending || !replyText.trim()}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.accent },
                !replyText.trim() && { opacity: 0.6 }
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={[styles.closedText, { fontSize: 14 * fontSizeScale, color: colors.textMuted }]}>
              Bu destek talebi kapatıldığı için yeni mesaj gönderilemez.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  headerSubtitle: {
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  ticketInfoCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontWeight: '500',
  },
  attachedImageContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  attachedImage: {
    width: '100%',
    height: 180,
    borderRadius: 6,
    resizeMode: 'cover',
    marginTop: 4,
  },
  chatTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatContainer: {
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAdmin: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '80%',
  },
  bubbleUser: {
    borderBottomRightRadius: 0,
  },
  bubbleAdmin: {
    borderWidth: 1,
    borderBottomLeftRadius: 0,
  },
  senderName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  messageText: {
    lineHeight: 18,
  },
  messageTime: {
    textAlign: 'right',
    marginTop: 4,
  },
  noMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  noMessagesText: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    minHeight: 38,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closedBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  closedText: {
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
