import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/contexts/SettingsContext';

interface MediaRecorderModalProps {
  visible: boolean;
  type: 'audio' | 'video';
  onClose: () => void;
  onRecordingComplete: (base64Content: string, mediaType: 'audio' | 'video') => void;
}

const MAX_DURATION_SECONDS = 300; // 5 minutes max

export default function MediaRecorderModal({
  visible,
  type,
  onClose,
  onRecordingComplete,
}: MediaRecorderModalProps) {
  const { colors, t, fontSizeScale } = useSettings();
  
  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  // Audio recording reference
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Camera reference
  const cameraRef = useRef<any>(null);

  // Interval reference for timer
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      checkAndRequestPermissions();
    } else {
      resetState();
    }
  }, [visible, type]);

  const checkAndRequestPermissions = async (): Promise<boolean> => {
    try {
      if (type === 'audio') {
        const audioPerm = await Audio.requestPermissionsAsync();
        const isGranted = audioPerm.status === 'granted';
        setPermissionGranted(isGranted);
        if (!isGranted) {
          Alert.alert(t('error') || 'Hata', 'Ses kaydı için mikrofon izni gereklidir.');
        }
        return isGranted;
      } else {
        const camPerm = await requestCameraPermission();
        const micPerm = await requestMicPermission();
        const isGranted = !!(camPerm?.granted && micPerm?.granted);
        setPermissionGranted(isGranted);
        if (!isGranted) {
          Alert.alert(t('error') || 'Hata', 'Video kaydı için kamera ve mikrofon izinleri gereklidir.');
        }
        return isGranted;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionGranted(false);
      return false;
    }
  };

  const resetState = () => {
    stopTimer();
    setIsRecording(false);
    setIsProcessing(false);
    setTimerSeconds(0);
    recordingRef.current = null;
  };

  const startTimer = () => {
    stopTimer();
    setTimerSeconds(0);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev >= MAX_DURATION_SECONDS - 1) {
          stopRecording();
          return MAX_DURATION_SECONDS;
        }
        return prev + 1;
      });
    }, 1000) as any;
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startRecording = async () => {
    let isPermitted = permissionGranted;
    if (!isPermitted) {
      isPermitted = await checkAndRequestPermissions();
      if (!isPermitted) return;
    }

    try {
      if (type === 'audio') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        startTimer();
      } else {
        if (!cameraRef.current) {
          Alert.alert(t('error') || 'Hata', 'Kamera hazır değil, lütfen tekrar deneyin.');
          return;
        }
        setIsRecording(true);
        startTimer();

        const videoRecordPromise = cameraRef.current.recordAsync({
          maxDuration: MAX_DURATION_SECONDS,
          quality: '720p',
        });

        videoRecordPromise.then(async (data: any) => {
          if (data && data.uri) {
            await handleMediaSaved(data.uri);
          }
        }).catch((err: any) => {
          console.error('Video recording error:', err);
          setIsRecording(false);
          stopTimer();
        });
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert(t('error') || 'Hata', 'Kayıt başlatılamadı.');
      setIsRecording(false);
      stopTimer();
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    stopTimer();
    setIsRecording(false);
    setIsProcessing(true);

    try {
      if (type === 'audio') {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
          });
          const uri = recordingRef.current.getURI();
          if (uri) {
            await handleMediaSaved(uri);
          } else {
            throw new Error('No audio file URI found');
          }
        }
      } else {
        if (cameraRef.current) {
          cameraRef.current.stopRecording();
          // The promise in startRecording will handle saved video URI
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert(t('error') || 'Hata', 'Kayıt durdurulurken hata oluştu.');
      setIsProcessing(false);
    }
  };

  const handleMediaSaved = async (fileUri: string) => {
    try {
      setIsProcessing(true);
      // Read file as Base64
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimePrefix = type === 'audio' ? 'data:audio/m4a;base64,' : 'data:video/mp4;base64,';
      const fullPayload = `${mimePrefix}${base64Data}`;

      onRecordingComplete(fullPayload, type);
      onClose();
    } catch (error) {
      console.error('Error processing media file:', error);
      Alert.alert(t('error') || 'Hata', 'Kayıt dosyası işlenirken hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (totalSec: number) => {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            if (isRecording) {
              stopRecording();
            }
            onClose();
          }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontSizeScale }]}>
          {type === 'audio' ? 'Sesli Mesaj Kaydı' : 'Video Mesaj Kaydı (720P)'}
        </Text>

        {type === 'video' ? (
          <TouchableOpacity style={styles.closeButton} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {/* Media Preview Area */}
      <View style={styles.previewContainer}>
        {type === 'video' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            mode="video"
            facing={facing}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.timerBadge}>
                <View style={[styles.dot, isRecording && styles.dotActive]} />
                <Text style={styles.timerText}>
                  {formatTime(timerSeconds)} / 05:00
                </Text>
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.audioPreview}>
            <View style={styles.micCircle}>
              <Ionicons
                name={isRecording ? 'mic' : 'mic-outline'}
                size={64}
                color={isRecording ? colors.accent : '#94a3b8'}
              />
            </View>
            <Text style={[styles.timerTextLarge, { color: colors.textPrimary }]}>
              {formatTime(timerSeconds)} / 05:00
            </Text>
            <Text style={[styles.audioSubtext, { color: colors.textSecondary }]}>
              {isRecording
                ? 'Kayıt yapılıyor... (Maks 5 dk)'
                : 'Kaydı başlatmak için aşağıdaki butona basın.'}
            </Text>
          </View>
        )}
      </View>

      {/* Footer / Controls */}
      <View style={styles.controlsContainer}>
        {isProcessing ? (
          <View style={styles.processingView}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.processingText, { color: colors.textPrimary }]}>
              Medya işleniyor ve hazırlanıyor...
            </Text>
          </View>
        ) : isRecording ? (
          <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
            <View style={styles.stopSquare} />
            <Text style={styles.controlText}>Kaydı Tamamla</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
            <View style={styles.recordInnerCircle} />
            <Text style={styles.controlText}>Kayda Başla</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 44 : 10,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94a3b8',
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#ef4444',
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  audioPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  micCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  timerTextLarge: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  audioSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  controlsContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingBottom: 20,
  },
  recordButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ef4444',
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 6,
  },
  stopButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 4,
    borderColor: '#fff',
    marginBottom: 6,
  },
  controlText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  processingView: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 14,
  },
});
