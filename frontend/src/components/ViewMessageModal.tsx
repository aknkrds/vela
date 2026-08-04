import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Audio, Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/contexts/SettingsContext';
import { decryptMessage } from '@/src/utils/encryption';

interface MessageData {
  _id: string;
  message_type: string;
  recipient_name: string;
  created_at: string;
  is_delivered: boolean;
  delivery_mode?: 'checkin_based' | 'scheduled_date';
  scheduled_at?: string;
  delivery_channel?: string;
  status?: string;
  encrypted_content?: string;
  content?: string;
}

interface ViewMessageModalProps {
  visible: boolean;
  message: MessageData | null;
  onClose: () => void;
}

export default function ViewMessageModal({
  visible,
  message,
  onClose,
}: ViewMessageModalProps) {
  const { colors, t, fontSizeScale } = useSettings();

  const [password, setPassword] = useState('');
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [mediaFileUri, setMediaFileUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<Video | null>(null);

  useEffect(() => {
    if (!visible) {
      cleanupPlayback();
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setPassword('');
    setIsDecrypted(false);
    setDecryptedText(null);
    setMediaFileUri(null);
    setErrorMsg(null);
    setIsLoading(false);
    setShowConfirmModal(false);
    setIsPlayingAudio(false);
    setPlaybackPosition(0);
    setPlaybackDuration(0);
  };

  const cleanupPlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // ignore cleanup errors
      }
      soundRef.current = null;
    }
  };

  const handleOpenConfirm = () => {
    if (!password.trim()) {
      setErrorMsg('Lütfen şifrenizi girin.');
      return;
    }
    setErrorMsg(null);
    setShowConfirmModal(true);
  };

  const handleConfirmDecrypt = () => {
    setShowConfirmModal(false);
    handleDecrypt();
  };

  const handleCancelAndExit = async () => {
    setShowConfirmModal(false);
    await handleCloseModal();
  };

  const handleDecrypt = async () => {
    if (!password.trim()) {
      setErrorMsg('Lütfen şifrenizi girin.');
      return;
    }

    if (!message) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const cipherText = message.encrypted_content || message.content || '';
      if (!cipherText) {
        throw new Error('Mesaj içeriği bulunamadı.');
      }

      const decrypted = decryptMessage(cipherText, password);

      if (decrypted.startsWith('data:audio/')) {
        // Handle Audio base64
        const parts = decrypted.split(';base64,');
        const base64Data = parts[1] || decrypted;
        const tempUri = `${FileSystem.cacheDirectory}audio_${message._id}.m4a`;

        await FileSystem.writeAsStringAsync(tempUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setMediaFileUri(tempUri);
        setIsDecrypted(true);
      } else if (decrypted.startsWith('data:video/')) {
        // Handle Video base64
        const parts = decrypted.split(';base64,');
        const base64Data = parts[1] || decrypted;
        const tempUri = `${FileSystem.cacheDirectory}video_${message._id}.mp4`;

        await FileSystem.writeAsStringAsync(tempUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setMediaFileUri(tempUri);
        setIsDecrypted(true);
      } else {
        // Handle Plain Text
        setDecryptedText(decrypted);
        setIsDecrypted(true);
      }
    } catch (err: any) {
      console.error('Decryption error:', err);
      setErrorMsg('Şifre hatalı veya mesaj çözülemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayAudio = async () => {
    if (!mediaFileUri) return;

    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlayingAudio(false);
          } else {
            await soundRef.current.playAsync();
            setIsPlayingAudio(true);
          }
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: mediaFileUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsPlayingAudio(true);
    } catch (err) {
      console.error('Audio play error:', err);
      Alert.alert(t('error') || 'Hata', 'Ses dosyası çalınamadı.');
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(Math.floor((status.positionMillis || 0) / 1000));
      setPlaybackDuration(Math.floor((status.durationMillis || 0) / 1000));
      setIsPlayingAudio(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlayingAudio(false);
        if (soundRef.current) {
          soundRef.current.setPositionAsync(0);
        }
      }
    }
  };

  const formatTime = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleCloseModal = async () => {
    await cleanupPlayback();
    resetState();
    onClose();
  };

  if (!message) return null;

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'audio':
        return 'Sesli Mesaj';
      case 'video':
        return 'Video Mesaj';
      default:
        return 'Metin Mesajı';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return 'mic';
      case 'video':
        return 'videocam';
      default:
        return 'document-text';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseModal}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.typeBadge, { backgroundColor: colors.accentDark }]}>
                <Ionicons
                  name={getMessageTypeIcon(message.message_type) as any}
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={[styles.headerTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
                {getMessageTypeLabel(message.message_type)}
              </Text>
            </View>

            <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Metadata Card */}
            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={18} color={colors.accent} />
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Alıcı:</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{message.recipient_name}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Oluşturulma:</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                  {new Date(message.created_at).toLocaleString()}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="send-outline" size={18} color={colors.accent} />
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Teslimat Modu:</Text>
                <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
                  {message.delivery_mode === 'scheduled_date'
                    ? `Zamanlanmış (${message.scheduled_at ? new Date(message.scheduled_at).toLocaleString() : ''})`
                    : 'Check-in Odaklı (Sözleşme)'}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="checkmark-done-outline" size={18} color={colors.accent} />
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Durum:</Text>
                <Text style={[styles.metaValue, { color: message.is_delivered ? colors.success : '#f59e0b' }]}>
                  {message.is_delivered ? 'Teslim Edildi' : 'Kilitli / Beklemede'}
                </Text>
              </View>
            </View>

            {/* Decryption Section */}
            {!isDecrypted ? (
              <View style={[styles.decryptBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-closed" size={40} color={colors.accent} />
                </View>
                <Text style={[styles.decryptTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }]}>
                  Şifrelenmiş İçerik
                </Text>
                <Text style={[styles.decryptDesc, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }]}>
                  Bu mesajın içeriğini görüntülemek veya dinlemek için mesajı oluştururken belirlediğiniz şifreyi giriniz.
                </Text>

                {errorMsg ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: errorMsg ? colors.danger : colors.inputBorder,
                      color: colors.inputText,
                    },
                  ]}
                  placeholder="Mesaj Şifresi"
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  style={[styles.decryptBtn, { backgroundColor: colors.accent }]}
                  onPress={handleOpenConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="key-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.decryptBtnText}>Şifreyi Çöz ve Göster</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Decrypted Content View */
              <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.successBadge}>
                  <Ionicons name="lock-open" size={18} color={colors.success} />
                  <Text style={[styles.successText, { color: colors.success }]}>
                    Şifre Çözüldü
                  </Text>
                </View>

                {/* Text Message */}
                {message.message_type === 'text' && decryptedText ? (
                  <View style={styles.textContainer}>
                    <Text style={[styles.decryptedTextMessage, { color: colors.textPrimary, fontSize: 16 * fontSizeScale }]}>
                      {decryptedText}
                    </Text>
                  </View>
                ) : null}

                {/* Audio Player */}
                {message.message_type === 'audio' && mediaFileUri ? (
                  <View style={styles.audioPlayerBox}>
                    <TouchableOpacity style={styles.playButton} onPress={togglePlayAudio}>
                      <Ionicons
                        name={isPlayingAudio ? 'pause' : 'play'}
                        size={32}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <View style={styles.audioProgressContainer}>
                      <Text style={[styles.audioTimeText, { color: colors.textPrimary }]}>
                        {formatTime(playbackPosition)} / {formatTime(playbackDuration)}
                      </Text>
                      <Text style={[styles.audioSubtext, { color: colors.textSecondary }]}>
                        {isPlayingAudio ? 'Oynatılıyor...' : 'Dinlemek için oynat butonuna basın.'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Video Player */}
                {message.message_type === 'video' && mediaFileUri ? (
                  <View style={styles.videoPlayerBox}>
                    <Video
                      ref={videoRef}
                      style={styles.videoPlayer}
                      source={{ uri: mediaFileUri }}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                      isLooping={false}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>

        {/* Decryption Warning / Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          animationType="fade"
          transparent={true}
          onRequestClose={handleCancelAndExit}
        >
          <View style={styles.confirmOverlay}>
            <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.confirmHeaderIcon}>
                <Ionicons name="shield-checkmark" size={36} color={colors.accent} />
              </View>

              <Text style={[styles.confirmTitle, { color: colors.textPrimary, fontSize: 18 * fontSizeScale }]}>
                Şifreniz Çözülüyor, Lütfen Bekleyin
              </Text>

              <Text style={[styles.confirmBody, { color: colors.textSecondary, fontSize: 13 * fontSizeScale }]}>
                Mesajlarınız uçtan uca yüksek güvenlikli (AES-256) şifreleme standartları ile saklanmaktadır.{'\n\n'}
                Şifrenizi girdikten sonra, internet bağlantı hızınıza ve cihazınızın donanım performansına bağlı olarak şifre çözme işlemi kısa bir zaman alabilir. Sistemin bu süreçte sizi bir miktar bekletmesi tamamen normal bir durumdur.{'\n\n'}
                Lütfen işlem tamamlanana kadar aynı ekranda bekleyiniz. Ekrandan ayrılmanız durumunda şifre çözme işleminiz iptal edilecek ve tekrar şifre girmeniz gerekecektir.
              </Text>

              <View style={styles.confirmActionRow}>
                <TouchableOpacity
                  style={[styles.confirmCancelBtn, { borderColor: colors.border }]}
                  onPress={handleCancelAndExit}
                >
                  <Text style={[styles.confirmCancelText, { color: colors.danger }]}>
                    Çık / İptal Et
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmSubmitBtn, { backgroundColor: colors.accent }]}
                  onPress={handleConfirmDecrypt}
                >
                  <Text style={styles.confirmSubmitText}>
                    Şifreyi Çöz ve Bekle
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    marginTop: 16,
  },
  metaCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
  decryptBox: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  decryptTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  decryptDesc: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  passwordInput: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 16,
  },
  decryptBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  decryptBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  contentCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  successText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  textContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  decryptedTextMessage: {
    lineHeight: 22,
  },
  audioPlayerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioProgressContainer: {
    flex: 1,
  },
  audioTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  audioSubtext: {
    fontSize: 12,
  },
  videoPlayerBox: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmHeaderIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmBody: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmSubmitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
