import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/src/api/client';
import * as ImagePicker from 'expo-image-picker';

export default function CreateSupportTicket() {
  const { user } = useAuth();
  const { fontSizeScale, t, colors, comfortMode } = useSettings();
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('warning') || 'İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert(t('error') || 'Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !subject.trim() || !description.trim()) {
      Alert.alert(t('error') || 'Hata', t('fieldsRequired') || 'Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/support/tickets', {
        name,
        phone,
        subject,
        description,
        base64_image: imageBase64,
      });

      if (response.data.success) {
        Alert.alert(t('success') || 'Başarılı', t('supportFormSuccess') || 'Destek talebi başarıyla oluşturuldu.');
        router.replace('/support/list');
      }
    } catch (err: any) {
      console.error('Error creating support ticket:', err);
      Alert.alert(t('error') || 'Hata', err.response?.data?.detail || 'Destek talebi oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
          {t('supportCreateTicket') || 'Destek Talebi Oluştur'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ad Soyad */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportFormName') || 'Ad Soyad'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontSize: 16 * fontSizeScale }]}
            value={name}
            onChangeText={setName}
            placeholder={t('supportFormName') || 'Ad Soyad'}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Telefon */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportFormPhone') || 'Telefon Numarası'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontSize: 16 * fontSizeScale }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('supportFormPhone') || 'Telefon Numarası'}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        {/* Konu */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportFormSubject') || 'Konu'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontSize: 16 * fontSizeScale }]}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('supportFormSubject') || 'Konu'}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Açıklama */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportFormDescription') || 'Açıklama'}
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, fontSize: 16 * fontSizeScale }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('supportFormDescription') || 'Açıklama...'}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
          />
        </View>

        {/* Resim Ekle */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {t('supportFormImage') || 'Fotoğraf Ekle'}
          </Text>
          
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity onPress={removeImage} style={styles.removeImageBtn}>
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              style={[styles.imagePickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="camera-outline" size={32} color={colors.accent} />
              <Text style={[styles.imagePickText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                {t('supportFormImage') || 'Fotoğraf Seç'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Gönder Butonu */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, { backgroundColor: colors.accent, height: comfortMode ? 64 : 56 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={[styles.submitBtnText, { fontSize: 16 * fontSizeScale }]}>
                {t('supportFormSubmit') || 'Destek Talebini Gönder'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: {
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    height: 120,
    textAlignVertical: 'top',
  },
  imagePickBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickText: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  submitBtn: {
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
