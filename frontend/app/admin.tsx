import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/src/api/client';

interface AdminUser {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  subscription_tier: string;
  status: string;
  days_since_checkin: number;
  last_checkin?: string;
  created_at?: string;
  expo_push_token?: string;
  extra_recipients?: number;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  flagged_users: number;
  deceased_users: number;
  total_messages: number;
}

interface StaffUser {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  permissions?: {
    can_manage_staff?: boolean;
    can_view_users?: boolean;
    can_edit_user_status?: boolean;
    can_manage_plans?: boolean;
  };
}

interface PlanPricing {
  price: number;
  currency: string;
  payment_methods: string[];
}

interface SubscriptionPlan {
  _id: string;
  name: string;
  display_name: string;
  price: number;
  max_recipients: number;
  max_messages: number;
  allowed_types: string[];
  features: string[];
  country_pricing?: Record<string, PlanPricing>;
  payment_methods?: string[];
  billing_cycle?: string;
}

interface Campaign {
  _id: string;
  code: string;
  discount_percentage: number;
  is_active: boolean;
  created_at?: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { fontSizeScale, t } = useSettings();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'plans' | 'campaigns' | 'packages' | 'requests'>('overview');
  const [loading, setLoading] = useState(true);

  // Packages (Points packages)
  const [packages, setPackages] = useState<any[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgDisplayName, setPkgDisplayName] = useState('');
  const [pkgPointsCost, setPkgPointsCost] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgBenefitType, setPkgBenefitType] = useState('extra_recipients');
  const [pkgBenefitValue, setPkgBenefitValue] = useState('1');
  const [pkgActionLoading, setPkgActionLoading] = useState(false);

  // User Profile Change Requests
  const [profileRequests, setProfileRequests] = useState<any[]>([]);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);

  // User Upgrade states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState('free');
  const [upgradeDuration, setUpgradeDuration] = useState('1_month');
  const [upgradeExtraRecipients, setUpgradeExtraRecipients] = useState('0');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgradeUser = async () => {
    if (!selectedUser) return;
    setUpgradeLoading(true);
    try {
      const response = await api.post(`/admin/users/${selectedUser._id}/upgrade`, {
        subscription_tier: upgradeTier,
        duration: upgradeDuration,
        extra_recipients: parseInt(upgradeExtraRecipients || '0')
      });
      Alert.alert(t('success') || 'Başarılı', response.data.message || 'Kullanıcı paketi güncellendi.');
      setShowUpgradeModal(false);
      setShowUserModal(false);
      loadTabContent();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Yükseltme başarısız.');
    } finally {
      setUpgradeLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'packages') {
      loadAdminPackages();
    } else if (activeTab === 'requests') {
      loadAdminRequests();
    }
  }, [activeTab]);

  const loadAdminPackages = async () => {
    try {
      const response = await api.get('/packages');
      setPackages(response.data);
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadAdminRequests = async () => {
    try {
      const response = await api.get('/admin/profile-requests');
      setProfileRequests(response.data);
    } catch (error) {
      console.error('Error loading profile requests:', error);
    }
  };

  const handleSavePackage = async () => {
    if (!pkgName || !pkgDisplayName || !pkgPointsCost || !pkgDescription || !pkgBenefitValue) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setPkgActionLoading(true);
    try {
      const payload = {
        name: pkgName.trim(),
        display_name: pkgDisplayName.trim(),
        points_cost: parseInt(pkgPointsCost),
        description: pkgDescription.trim(),
        benefit_type: pkgBenefitType,
        benefit_value: parseInt(pkgBenefitValue)
      };

      if (selectedPackage) {
        await api.put(`/admin/packages/${selectedPackage.package_id}`, payload);
        Alert.alert(t('success'), 'Paket başarıyla güncellendi.');
      } else {
        await api.post('/admin/packages', payload);
        Alert.alert(t('success'), 'Paket başarıyla oluşturuldu.');
      }
      setShowPackageModal(false);
      loadAdminPackages();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Paket kaydedilemedi.');
    } finally {
      setPkgActionLoading(false);
    }
  };

  const handleDeletePackage = (packageId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Bu paketi silmek istediğinizden emin misiniz?')) {
        (async () => {
          try {
            await api.delete(`/admin/packages/${packageId}`);
            window.alert('Paket başarıyla silindi.');
            loadAdminPackages();
          } catch (error: any) {
            window.alert(error.response?.data?.detail || 'Paket silinemedi.');
          }
        })();
      }
      return;
    }

    Alert.alert(
      t('delete') || 'Sil',
      'Bu paketi silmek istediğinizden emin misiniz?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/packages/${packageId}`);
              Alert.alert(t('success'), 'Paket başarıyla silindi.');
              loadAdminPackages();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || 'Paket silinemedi.');
            }
          }
        }
      ]
    );
  };

  const handleApproveRequest = async (requestId: string) => {
    setRequestActionLoading(requestId);
    try {
      await api.post(`/admin/profile-requests/${requestId}/approve`);
      Alert.alert(t('success'), 'Değişiklik talebi onaylandı.');
      loadAdminRequests();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Onaylanamadı.');
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setRequestActionLoading(requestId);
    try {
      await api.post(`/admin/profile-requests/${requestId}/reject`);
      Alert.alert(t('success'), 'Değişiklik talebi reddedildi.');
      loadAdminRequests();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Reddedilemedi.');
    } finally {
      setRequestActionLoading(null);
    }
  };

  // User Details Modal (Overview)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users search & filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'flagged' | 'deceased'>('all');
  const [filterMinDays, setFilterMinDays] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Staff Tab
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState('moderator');
  const [permManageStaff, setPermManageStaff] = useState(false);
  const [permViewUsers, setPermViewUsers] = useState(false);
  const [permEditStatus, setPermEditStatus] = useState(false);
  const [permManagePlans, setPermManagePlans] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStaffId, setPasswordStaffId] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');

  // Plans Tab
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planDisplayName, setPlanDisplayName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planMaxRecipients, setPlanMaxRecipients] = useState('');
  const [planMaxMessages, setPlanMaxMessages] = useState('');
  const [planFeatures, setPlanFeatures] = useState('');
  const [planPaymentMethods, setPlanPaymentMethods] = useState('');
  const [planBillingCycle, setPlanBillingCycle] = useState('yearly');

  // Country Pricing Modal
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [countryPrice, setCountryPrice] = useState('');
  const [countryCurrency, setCountryCurrency] = useState('USD');
  const [countryPaymentMethods, setCountryPaymentMethods] = useState('');

  // Campaigns & Config Tab
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campCode, setCampCode] = useState('');
  const [campDiscount, setCampDiscount] = useState('');
  const [campActive, setCampActive] = useState(true);

  // Gateway Settings Form
  const [paytrMerchantId, setPaytrMerchantId] = useState('');
  const [paytrMerchantKey, setPaytrMerchantKey] = useState('');
  const [paytrMerchantSalt, setPaytrMerchantSalt] = useState('');
  const [paytrActive, setPaytrActive] = useState(false);

  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleMerchantId, setGoogleMerchantId] = useState('');
  const [googlePackageName, setGooglePackageName] = useState('');
  const [googleActive, setGoogleActive] = useState(false);

  const isSuperAdmin = user?.email === 'akin@symi.com.tr' || user?.email === 'aknkrds@hotmail.com';
  const canManageStaff = isSuperAdmin || user?.permissions?.can_manage_staff;
  const canManagePlans = isSuperAdmin || user?.permissions?.can_manage_plans;
  const canViewUsers = isSuperAdmin || user?.permissions?.can_view_users;
  const canEditUserStatus = isSuperAdmin || user?.permissions?.can_edit_user_status;

  useEffect(() => {
    if (user?.role !== 'admin' && !user?.permissions) {
      Alert.alert(t('error') || 'Access Denied', t('adminPanelButton') + ' required');
      router.back();
      return;
    }
    loadTabContent();
  }, [activeTab]);

  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview' && canViewUsers) {
        const [usersRes, statsRes] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/stats'),
        ]);
        setUsers(usersRes.data);
        setStats(statsRes.data);
      } else if (activeTab === 'staff' && canManageStaff) {
        const res = await api.get('/admin/staff');
        setStaffList(res.data);
      } else if (activeTab === 'plans' && canManagePlans) {
        const res = await api.get('/admin/plans');
        setPlans(res.data);
      } else if (activeTab === 'campaigns' && canManagePlans) {
        const [campRes, paytrRes, googleRes] = await Promise.all([
          api.get('/admin/campaigns'),
          api.get('/admin/config/paytr'),
          api.get('/admin/config/google_pay'),
        ]);
        setCampaigns(campRes.data);
        
        // PayTR config backfill
        const pt = paytrRes.data;
        setPaytrMerchantId(pt.fields?.merchant_id || '');
        setPaytrMerchantKey(pt.fields?.merchant_key || '');
        setPaytrMerchantSalt(pt.fields?.merchant_salt || '');
        setPaytrActive(!!pt.is_active);

        // Google Pay config backfill
        const gp = googleRes.data;
        setGoogleApiKey(gp.fields?.api_key || '');
        setGoogleMerchantId(gp.fields?.merchant_id || '');
        setGooglePackageName(gp.fields?.package_name || '');
        setGoogleActive(!!gp.is_active);
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Staff Handlers
  const handleOpenStaffModal = (staff?: StaffUser) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffEmail(staff.email);
      setStaffFullName(staff.full_name);
      setStaffPhone(staff.phone);
      setStaffRole(staff.role);
      setPermManageStaff(!!staff.permissions?.can_manage_staff);
      setPermViewUsers(!!staff.permissions?.can_view_users);
      setPermEditStatus(!!staff.permissions?.can_edit_user_status);
      setPermManagePlans(!!staff.permissions?.can_manage_plans);
    } else {
      setEditingStaff(null);
      setStaffEmail('');
      setStaffPassword('');
      setStaffFullName('');
      setStaffPhone('');
      setStaffRole('moderator');
      setPermManageStaff(false);
      setPermViewUsers(true);
      setPermEditStatus(true);
      setPermManagePlans(false);
    }
    setShowStaffModal(true);
  };

  const handleSaveStaff = async () => {
    if (!staffEmail.trim() || !staffFullName.trim() || !staffPhone.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    if (!editingStaff && !staffPassword.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    const payload: any = {
      full_name: staffFullName.trim(),
      role: staffRole,
      permissions: {
        can_manage_staff: permManageStaff,
        can_view_users: permViewUsers,
        can_edit_user_status: permEditStatus,
        can_manage_plans: permManagePlans,
      },
    };

    try {
      if (editingStaff) {
        await api.put(`/admin/staff/${editingStaff._id}`, payload);
        Alert.alert(t('success'), t('staffUpdatedSuccess'));
      } else {
        payload.email = staffEmail.trim();
        payload.password = staffPassword;
        payload.phone = staffPhone.trim();
        await api.post('/admin/staff', payload);
        Alert.alert(t('success'), t('staffAddedSuccess'));
      }
      setShowStaffModal(false);
      loadTabContent();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  const handleDeleteStaff = (staff: StaffUser) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t('deleteStaffConfirm').replace('{name}', staff.full_name))) {
        (async () => {
          try {
            await api.delete(`/admin/staff/${staff._id}`);
            window.alert(t('staffDeletedSuccess') || 'Personel başarıyla silindi.');
            loadTabContent();
          } catch (error: any) {
            window.alert(error.response?.data?.detail || 'Personel silinemedi.');
          }
        })();
      }
      return;
    }

    Alert.alert(
      t('delete') || 'Delete',
      t('deleteStaffConfirm').replace('{name}', staff.full_name),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/staff/${staff._id}`);
              Alert.alert(t('success'), t('staffDeletedSuccess'));
              loadTabContent();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('error'));
            }
          },
        },
      ]
    );
  };

  const handleOpenPasswordModal = (staffId: string) => {
    setPasswordStaffId(staffId);
    setNewStaffPassword('');
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (!newStaffPassword.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    try {
      await api.put(`/admin/staff/${passwordStaffId}/password`, { password: newStaffPassword });
      Alert.alert(t('success'), t('passwordUpdatedSuccess'));
      setShowPasswordModal(false);
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  // User Status Updates (Overview)
  const handleUpdateStatus = (userId: string, currentStatus: string, userName: string) => {
    const statusOptions = ['active', 'flagged', 'deceased', 'inactive'];
    const otherStatuses = statusOptions.filter(s => s !== currentStatus);

    if (Platform.OS === 'web') {
      const promptMsg = `Yeni durumu girin (${otherStatuses.join(', ')}):`;
      const val = window.prompt(promptMsg);
      if (val && otherStatuses.includes(val.trim().toLowerCase())) {
        const chosenStatus = val.trim().toLowerCase();
        (async () => {
          try {
            await api.put(`/admin/users/${userId}/status?status=${chosenStatus}`);
            window.alert('Durum başarıyla güncellendi.');
            loadTabContent();
            setShowUserModal(false);
          } catch (error: any) {
            window.alert(error.response?.data?.detail || 'Durum güncellenemedi.');
          }
        })();
      } else if (val) {
        window.alert('Geçersiz durum girdiniz!');
      }
      return;
    }

    Alert.alert(
      `${t('changeStatus')} - ${userName}`,
      t('selectNewStatus').replace('{name}', userName),
      [
        { text: t('cancel'), style: 'cancel' },
        ...otherStatuses.map(status => ({
          text: t('adminStatus' + status.charAt(0).toUpperCase() + status.slice(1)) || status.toUpperCase(),
          onPress: async () => {
            try {
              await api.put(`/admin/users/${userId}/status?status=${status}`);
              Alert.alert(t('success'), t('statusUpdateSuccess'));
              loadTabContent();
              setShowUserModal(false);
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('statusUpdateFailed'));
            }
          },
        })),
      ]
    );
  };

  // Ping User action
  const handlePingUser = async (userId: string) => {
    setPingLoading(true);
    try {
      await api.post(`/admin/users/${userId}/ping`);
      Alert.alert(t('success'), t('pingSent'));
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    } finally {
      setPingLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`"${userName}" isimli kullanıcıyı ve tüm verilerini kalıcı olarak silmek istediğinize emin misiniz?`)) {
        try {
          await api.delete(`/admin/users/${userId}`);
          window.alert("Kullanıcı başarıyla silindi.");
          setShowUserModal(false);
          loadTabContent();
        } catch (error: any) {
          window.alert(error.response?.data?.detail || "Kullanıcı silinemedi.");
        }
      }
      return;
    }

    Alert.alert(
      "Kullanıcıyı Sil",
      `"${userName}" isimli kullanıcıyı ve tüm verilerini (alıcılar, mesajlar vb.) kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Evet, Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/users/${userId}`);
              Alert.alert(t('success') || 'Başarılı', "Kullanıcı başarıyla silindi.");
              setShowUserModal(false);
              loadTabContent();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || "Kullanıcı silinemedi.");
            }
          }
        }
      ]
    );
  };

  // Plan Handlers
  const handleOpenPlanModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanDisplayName(plan.display_name);
    setPlanPrice(plan.price.toString());
    setPlanMaxRecipients(plan.max_recipients.toString());
    setPlanMaxMessages(plan.max_messages.toString());
    setPlanFeatures(plan.features.join('\n'));
    setPlanPaymentMethods(plan.payment_methods?.join(', ') || 'credit_card, stripe');
    setPlanBillingCycle(plan.billing_cycle || 'yearly');
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planDisplayName.trim() || !planPrice.trim() || !planMaxRecipients.trim() || !planMaxMessages.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    const payload = {
      display_name: planDisplayName.trim(),
      price: parseFloat(planPrice),
      max_recipients: parseInt(planMaxRecipients),
      max_messages: parseInt(planMaxMessages),
      features: planFeatures.split('\n').map(f => f.trim()).filter(Boolean),
      payment_methods: planPaymentMethods.split(',').map(p => p.trim()).filter(Boolean),
      billing_cycle: planBillingCycle,
    };

    try {
      await api.put(`/admin/plans/${editingPlan?._id}`, payload);
      Alert.alert(t('success'), t('planUpdatedSuccess'));
      setShowPlanModal(false);
      loadTabContent();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  // Country Pricing Handlers
  const handleOpenCountryModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setCountryCode('');
    setCountryPrice('');
    setCountryCurrency('USD');
    setCountryPaymentMethods('stripe, credit_card');
    setShowCountryModal(true);
  };

  const handleSaveCountryPrice = async () => {
    if (!countryCode.trim() || !countryPrice.trim() || !countryCurrency.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    const code = countryCode.trim().toUpperCase();
    const existingPricing = editingPlan?.country_pricing || {};
    
    const updatedPricing = {
      ...existingPricing,
      [code]: {
        price: parseFloat(countryPrice),
        currency: countryCurrency.trim().toUpperCase(),
        payment_methods: countryPaymentMethods.split(',').map(p => p.trim()).filter(Boolean),
      }
    };

    try {
      await api.put(`/admin/plans/${editingPlan?._id}`, { country_pricing: updatedPricing });
      Alert.alert(t('success'), t('planUpdatedSuccess'));
      setShowCountryModal(false);
      loadTabContent();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  const handleDeleteCountryPrice = async (plan: SubscriptionPlan, code: string) => {
    Alert.alert(
      t('delete') || 'Delete',
      `${code} pricing will be deleted. Are you sure?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const updatedPricing = { ...(plan.country_pricing || {}) };
            delete updatedPricing[code];
            try {
              await api.put(`/admin/plans/${plan._id}`, { country_pricing: updatedPricing });
              Alert.alert(t('success'), t('planUpdatedSuccess'));
              loadTabContent();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('error'));
            }
          }
        }
      ]
    );
  };

  // Campaigns Handlers
  const handleOpenCampaignModal = (camp?: Campaign) => {
    if (camp) {
      setEditingCampaign(camp);
      setCampCode(camp.code);
      setCampDiscount(camp.discount_percentage.toString());
      setCampActive(camp.is_active);
    } else {
      setEditingCampaign(null);
      setCampCode('');
      setCampDiscount('');
      setCampActive(true);
    }
    setShowCampaignModal(true);
  };

  const handleSaveCampaign = async () => {
    if (!campCode.trim() || !campDiscount.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    const payload = {
      code: campCode.trim().toUpperCase(),
      discount_percentage: parseInt(campDiscount),
      is_active: campActive
    };

    try {
      if (editingCampaign) {
        await api.put(`/admin/campaigns/${editingCampaign._id}`, payload);
      } else {
        await api.post('/admin/campaigns', payload);
      }
      Alert.alert(t('success'), t('campaignSaved'));
      setShowCampaignModal(false);
      loadTabContent();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  const handleDeleteCampaign = (campId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this campaign?')) {
        (async () => {
          try {
            await api.delete(`/admin/campaigns/${campId}`);
            window.alert('Kampanya başarıyla silindi.');
            loadTabContent();
          } catch (error: any) {
            window.alert(error.response?.data?.detail || 'Kampanya silinemedi.');
          }
        })();
      }
      return;
    }

    Alert.alert(
      t('delete') || 'Delete',
      'Are you sure you want to delete this campaign?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/campaigns/${campId}`);
              Alert.alert(t('success'), t('campaignDeleted'));
              loadTabContent();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('error'));
            }
          }
        }
      ]
    );
  };

  // Gateway Config Settings Save
  const handleSavePaytrSettings = async () => {
    try {
      await api.put('/admin/config/paytr', {
        fields: {
          merchant_id: paytrMerchantId.trim(),
          merchant_key: paytrMerchantKey.trim(),
          merchant_salt: paytrMerchantSalt.trim(),
        },
        is_active: paytrActive
      });
      Alert.alert(t('success'), 'PayTR config saved successfully');
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  const handleSaveGooglePaySettings = async () => {
    try {
      await api.put('/admin/config/google_pay', {
        fields: {
          api_key: googleApiKey.trim(),
          merchant_id: googleMerchantId.trim(),
          package_name: googlePackageName.trim(),
        },
        is_active: googleActive
      });
      Alert.alert(t('success'), 'Google Pay config saved successfully');
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 24 * fontSizeScale }]}>{t('adminTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs Menu */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
          {canViewUsers && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'overview' && styles.activeTabButton]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('overviewTab')}
              </Text>
            </TouchableOpacity>
          )}
          {canManageStaff && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'staff' && styles.activeTabButton]}
              onPress={() => setActiveTab('staff')}
            >
              <Text style={[styles.tabText, activeTab === 'staff' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('staffTab')}
              </Text>
            </TouchableOpacity>
          )}
          {canManagePlans && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'plans' && styles.activeTabButton]}
              onPress={() => setActiveTab('plans')}
            >
              <Text style={[styles.tabText, activeTab === 'plans' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('plansTab')}
              </Text>
            </TouchableOpacity>
          )}
          {canManagePlans && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'campaigns' && styles.activeTabButton]}
              onPress={() => setActiveTab('campaigns')}
            >
              <Text style={[styles.tabText, activeTab === 'campaigns' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('campaignsTab')}
              </Text>
            </TouchableOpacity>
          )}
          {canManagePlans && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'packages' && styles.activeTabButton]}
              onPress={() => setActiveTab('packages')}
            >
              <Text style={[styles.tabText, activeTab === 'packages' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('pointPackagesTab')}
              </Text>
            </TouchableOpacity>
          )}
          {canViewUsers && (
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'requests' && styles.activeTabButton]}
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText, { fontSize: 13 * fontSizeScale }]}>
                {t('userRequestsTab')}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              {stats && (
                <View style={styles.statsSection}>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Ionicons name="people" size={32} color="#6366f1" />
                      <Text style={[styles.statValue, { fontSize: 28 * fontSizeScale }]}>{stats.total_users}</Text>
                      <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale }]}>{t('totalUsers')}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                      <Text style={[styles.statValue, { fontSize: 28 * fontSizeScale }]}>{stats.active_users}</Text>
                      <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale }]}>{t('activeUsers')}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="alert-circle" size={32} color="#f59e0b" />
                      <Text style={[styles.statValue, { fontSize: 28 * fontSizeScale }]}>{stats.flagged_users}</Text>
                      <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale }]}>{t('flaggedUsers')}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Ionicons name="close-circle" size={32} color="#ef4444" />
                      <Text style={[styles.statValue, { fontSize: 28 * fontSizeScale }]}>{stats.deceased_users}</Text>
                      <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale }]}>{t('deceasedUsers')}</Text>
                    </View>
                  </View>
                  <View style={styles.messagesStat}>
                    <Ionicons name="mail" size={24} color="#6366f1" />
                    <Text style={[styles.messagesStatText, { fontSize: 16 * fontSizeScale }]}>
                      {stats.total_messages} {t('totalMessages')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Users Filter & Search Panel */}
              <View style={{ marginBottom: 16 }}>
                <View style={styles.searchBarContainer}>
                  <Ionicons name="search" size={20} color="#64748b" style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, color: '#fff', fontSize: 14 * fontSizeScale }}
                    placeholder="Kullanıcı adı veya e-posta ile ara..."
                    placeholderTextColor="#64748b"
                    value={filterSearch}
                    onChangeText={setFilterSearch}
                  />
                  {filterSearch ? (
                    <TouchableOpacity onPress={() => setFilterSearch('')}>
                      <Ionicons name="close" size={20} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {[
                    { key: 'all', label: 'Tümü' },
                    { key: 'active', label: 'Aktif' },
                    { key: 'inactive', label: 'Deaktif' },
                    { key: 'flagged', label: 'İşaretli' },
                    { key: 'deceased', label: 'Vefat Eden' }
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterOptionTab,
                        filterStatus === opt.key && styles.filterOptionTabActive
                      ]}
                      onPress={() => setFilterStatus(opt.key as any)}
                    >
                      <Text style={[
                        styles.filterOptionTabText,
                        filterStatus === opt.key && styles.filterOptionTabTextActive,
                        { fontSize: 13 * fontSizeScale }
                      ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.daysFilterContainer}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 * fontSizeScale, flex: 1 }}>
                    Son yoklamadan beri geçen gün &gt;=
                  </Text>
                  <TextInput
                    style={styles.daysFilterInput}
                    placeholder="Örn: 2"
                    placeholderTextColor="#64748b"
                    value={filterMinDays}
                    onChangeText={setFilterMinDays}
                    keyboardType="numeric"
                  />
                  {filterMinDays ? (
                    <TouchableOpacity onPress={() => setFilterMinDays('')} style={{ marginLeft: 8 }}>
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Users Grid */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale }]}>{t('totalUsers')}</Text>
              </View>
              {users
                .filter((u) => {
                  if (filterSearch) {
                    const searchLower = filterSearch.toLowerCase();
                    const matchName = u.full_name?.toLowerCase().includes(searchLower);
                    const matchEmail = u.email?.toLowerCase().includes(searchLower);
                    if (!matchName && !matchEmail) return false;
                  }
                  if (filterStatus !== 'all' && u.status !== filterStatus) {
                    return false;
                  }
                  if (filterMinDays) {
                    const minDays = parseInt(filterMinDays);
                    if (!isNaN(minDays) && (u.days_since_checkin ?? 0) < minDays) {
                      return false;
                    }
                  }
                  return true;
                })
                .sort((a, b) => {
                  if (a.status === 'inactive' && b.status !== 'inactive') return 1;
                  if (a.status !== 'inactive' && b.status === 'inactive') return -1;
                  return 0;
                })
                .map((u) => {
                  const isDeactivated = u.status === 'inactive';
                  return (
                    <TouchableOpacity
                      key={u._id}
                      style={[
                        styles.userCard,
                        isDeactivated && { borderColor: '#ef4444', borderWidth: 1 }
                      ]}
                      onPress={() => {
                        setSelectedUser(u);
                        setUpgradeTier(u.subscription_tier);
                        setUpgradeExtraRecipients(String(u.extra_recipients || 0));
                        setUpgradeDuration('1_month');
                        setShowUserModal(true);
                      }}
                    >
                      <View style={styles.userInfo}>
                        <Text
                          style={[
                            styles.userName,
                            { fontSize: 18 * fontSizeScale },
                            isDeactivated && { color: '#ef4444' }
                          ]}
                        >
                          {u.full_name} {isDeactivated && `(Deaktif)`}
                        </Text>
                        <Text
                          style={[
                            styles.userEmail,
                            { fontSize: 14 * fontSizeScale },
                            isDeactivated && { color: '#f87171' }
                          ]}
                        >
                          {u.email}
                        </Text>
                        <View style={styles.userMeta}>
                          <View style={styles.userBadge}>
                            <Text style={[styles.userBadgeText, { fontSize: 10 * fontSizeScale }]}>
                              {u.subscription_tier.toUpperCase()}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.statusBadge,
                              u.status === 'active' && styles.statusActive,
                              u.status === 'flagged' && styles.statusFlagged,
                              u.status === 'deceased' && styles.statusDeceased,
                              u.status === 'inactive' && { backgroundColor: '#ef4444' }
                            ]}
                          >
                            <Text style={[styles.statusText, { fontSize: 10 * fontSizeScale }]}>
                              {(t('adminStatus' + u.status.charAt(0).toUpperCase() + u.status.slice(1)) || u.status).toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.checkinInfo, { fontSize: 12 * fontSizeScale }]}>
                          {t('lastCheckin')}: {u.days_since_checkin === 0 ? t('today') : `${u.days_since_checkin} ${t('daysAgo')}`}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={isDeactivated ? '#ef4444' : '#64748b'} style={{ alignSelf: 'center' }} />
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* TAB 2: STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale }]}>{t('staffTab')}</Text>
                <TouchableOpacity style={styles.smallAddButton} onPress={() => handleOpenStaffModal()}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={[styles.smallAddButtonText, { fontSize: 12 * fontSizeScale }]}>{t('addStaff')}</Text>
                </TouchableOpacity>
              </View>

              {staffList.map((s) => (
                <View key={s._id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { fontSize: 18 * fontSizeScale }]}>{s.full_name}</Text>
                    <Text style={[styles.userEmail, { fontSize: 14 * fontSizeScale }]}>{s.email}</Text>
                    <View style={styles.userMeta}>
                      <View style={[styles.userBadge, { backgroundColor: '#312e81' }]}>
                        <Text style={[styles.userBadgeText, { color: '#818cf8', fontSize: 10 * fontSizeScale }]}>
                          {s.role.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.permissionTitle, { fontSize: 12 * fontSizeScale }]}>{t('permissionsLabel')}:</Text>
                    <View style={styles.permissionTags}>
                      {s.permissions?.can_manage_staff && <Text style={styles.permissionTag}>Manage Staff</Text>}
                      {s.permissions?.can_view_users && <Text style={styles.permissionTag}>View Users</Text>}
                      {s.permissions?.can_edit_user_status && <Text style={styles.permissionTag}>Edit Status</Text>}
                      {s.permissions?.can_manage_plans && <Text style={styles.permissionTag}>Manage Plans</Text>}
                    </View>
                  </View>
                  
                  <View style={styles.staffActions}>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleOpenStaffModal(s)}
                    >
                      <Ionicons name="create-outline" size={20} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleOpenPasswordModal(s._id)}
                    >
                      <Ionicons name="key-outline" size={20} color="#f59e0b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleDeleteStaff(s)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: SUBSCRIPTION PLANS */}
          {activeTab === 'plans' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale }]}>{t('plansTab')}</Text>
              </View>

              {plans.map((plan) => (
                <View key={plan._id} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <Text style={[styles.planTitle, { fontSize: 20 * fontSizeScale }]}>{plan.display_name}</Text>
                    <Text style={[styles.planPriceText, { fontSize: 16 * fontSizeScale }]}>
                      {plan.price === 0 ? t('free') || 'FREE' : `$${plan.price} / ${t(plan.billing_cycle + 'Cycle')}`}
                    </Text>
                  </View>

                  <View style={styles.planInfo}>
                    <Text style={[styles.planSubtext, { fontSize: 13 * fontSizeScale }]}>
                      Recipients: {plan.max_recipients} | Messages: {plan.max_messages}
                    </Text>
                    <Text style={[styles.planSubtext, { fontSize: 13 * fontSizeScale }]}>
                      Types: {plan.allowed_types.join(', ')}
                    </Text>
                    <Text style={[styles.planSubtext, { fontSize: 13 * fontSizeScale }]}>
                      Methods: {plan.payment_methods?.join(', ') || 'credit_card'}
                    </Text>
                  </View>

                  {/* Country Pricing List */}
                  <View style={styles.countryPricingSection}>
                    <View style={styles.countryHeaderRow}>
                      <Text style={[styles.countryPricingTitle, { fontSize: 14 * fontSizeScale }]}>{t('countryPricing')}</Text>
                      <TouchableOpacity
                        style={styles.addCountryBtn}
                        onPress={() => handleOpenCountryModal(plan)}
                      >
                        <Ionicons name="add-circle" size={16} color="#6366f1" />
                        <Text style={[styles.addCountryText, { fontSize: 12 * fontSizeScale }]}>{t('addCountryPrice')}</Text>
                      </TouchableOpacity>
                    </View>

                    {plan.country_pricing && Object.keys(plan.country_pricing).length > 0 ? (
                      Object.entries(plan.country_pricing).map(([code, details]) => (
                        <View key={code} style={styles.countryRow}>
                          <Text style={[styles.countryCodeText, { fontSize: 14 * fontSizeScale }]}>
                            {code}: {details.price} {details.currency} ({details.payment_methods.join(', ')})
                          </Text>
                          <TouchableOpacity onPress={() => handleDeleteCountryPrice(plan, code)}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.noCountryText, { fontSize: 12 * fontSizeScale }]}>No custom country pricing configured.</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.planEditBtn}
                    onPress={() => handleOpenPlanModal(plan)}
                  >
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>Edit Base Plan</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* TAB 4: CAMPAIGNS & GATEWAY CONFIGS */}
          {activeTab === 'campaigns' && (
            <View style={styles.tabContent}>
              
              {/* Campaign list */}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale }]}>{t('campaignsTab')}</Text>
                <TouchableOpacity style={styles.smallAddButton} onPress={() => handleOpenCampaignModal()}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={[styles.smallAddButtonText, { fontSize: 12 * fontSizeScale }]}>{t('addCampaign')}</Text>
                </TouchableOpacity>
              </View>

              {campaigns.map((camp) => (
                <View key={camp._id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { fontSize: 18 * fontSizeScale }]}>{camp.code}</Text>
                    <Text style={[styles.userEmail, { fontSize: 14 * fontSizeScale }]}>
                      {t('discountPercentage')}: {camp.discount_percentage}%
                    </Text>
                    <View style={styles.userMeta}>
                      <View style={[styles.statusBadge, camp.is_active ? styles.statusActive : styles.statusDeceased]}>
                        <Text style={[styles.statusText, { fontSize: 10 * fontSizeScale }]}>
                          {camp.is_active ? t('activeLabel').toUpperCase() : 'INACTIVE'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.staffActions}>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleOpenCampaignModal(camp)}
                    >
                      <Ionicons name="create-outline" size={20} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleDeleteCampaign(camp._id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* PayTR Config */}
              <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale, marginTop: 32, marginBottom: 16 }]}>
                {t('paytrSettings')}
              </Text>
              <View style={styles.configCard}>
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('merchantId')}</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={paytrMerchantId}
                  onChangeText={setPaytrMerchantId}
                  placeholder="PayTR Merchant ID"
                  placeholderTextColor="#64748b"
                />
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('merchantKey')}</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={paytrMerchantKey}
                  onChangeText={setPaytrMerchantKey}
                  placeholder="PayTR Merchant Key"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('merchantSalt')}</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={paytrMerchantSalt}
                  onChangeText={setPaytrMerchantSalt}
                  placeholder="PayTR Merchant Salt"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
                <View style={[styles.switchRow, { marginTop: 12 }]}>
                  <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('activeLabel')}</Text>
                  <Switch value={paytrActive} onValueChange={setPaytrActive} />
                </View>
                <TouchableOpacity style={styles.planEditBtn} onPress={handleSavePaytrSettings}>
                  <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>{t('saveChanges')}</Text>
                </TouchableOpacity>
              </View>

              {/* Google Config */}
              <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale, marginTop: 32, marginBottom: 16 }]}>
                {t('googlePaySettings')}
              </Text>
              <View style={styles.configCard}>
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('apiKey')}</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={googleApiKey}
                  onChangeText={setGoogleApiKey}
                  placeholder="Google API Key"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('merchantId')} (Google Merchant ID)</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={googleMerchantId}
                  onChangeText={setGoogleMerchantId}
                  placeholder="Google Merchant ID"
                  placeholderTextColor="#64748b"
                />
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('packageName')}</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={googlePackageName}
                  onChangeText={setGooglePackageName}
                  placeholder="com.example.app"
                  placeholderTextColor="#64748b"
                />
                <View style={[styles.switchRow, { marginTop: 12 }]}>
                  <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('activeLabel')}</Text>
                  <Switch value={googleActive} onValueChange={setGoogleActive} />
                </View>
                <TouchableOpacity style={styles.planEditBtn} onPress={handleSaveGooglePaySettings}>
                  <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>{t('saveChanges')}</Text>
                </TouchableOpacity>
              </View>

            </View>
          )}

          {/* TAB 5: POINT PACKAGES MANAGER */}
          {activeTab === 'packages' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale }]}>{t('pointPackagesTab')}</Text>
                <TouchableOpacity
                  style={styles.smallAddButton}
                  onPress={() => {
                    setSelectedPackage(null);
                    setPkgName('');
                    setPkgDisplayName('');
                    setPkgPointsCost('');
                    setPkgDescription('');
                    setPkgBenefitType('extra_recipients');
                    setPkgBenefitValue('1');
                    setShowPackageModal(true);
                  }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={[styles.smallAddButtonText, { fontSize: 12 * fontSizeScale }]}>Paket Ekle</Text>
                </TouchableOpacity>
              </View>

              {packages.map((pkg) => (
                <View key={pkg.package_id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { fontSize: 18 * fontSizeScale }]}>{pkg.display_name}</Text>
                    <Text style={[styles.userEmail, { fontSize: 14 * fontSizeScale }]}>
                      Sistem İsmi: {pkg.name} | Gerekli Puan: {pkg.points_cost} SYMI
                    </Text>
                    <Text style={[styles.userEmail, { fontSize: 13 * fontSizeScale }]}>
                      Fayda: {pkg.benefit?.type === 'extra_recipients' ? 'Ek Alıcı Sınırı' : pkg.benefit?.type} (+{pkg.benefit?.value})
                    </Text>
                  </View>
                  <View style={styles.staffActions}>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => {
                        setSelectedPackage(pkg);
                        setPkgName(pkg.name);
                        setPkgDisplayName(pkg.display_name);
                        setPkgPointsCost(String(pkg.points_cost));
                        setPkgDescription(pkg.description);
                        setPkgBenefitType(pkg.benefit?.type || 'extra_recipients');
                        setPkgBenefitValue(String(pkg.benefit?.value || 1));
                        setShowPackageModal(true);
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.staffActionBtn}
                      onPress={() => handleDeletePackage(pkg.package_id)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 6: USER PROFILE REQUESTS REVIEWER */}
          {activeTab === 'requests' && (
            <View style={styles.tabContent}>
              <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale, marginBottom: 16 }]}>
                {t('userRequestsTab')}
              </Text>
              {profileRequests.length > 0 ? (
                profileRequests.map((req) => (
                  <View key={req.request_id} style={[styles.userCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.userName, { fontSize: 16 * fontSizeScale }]}>{req.full_name}</Text>
                      <View style={[
                        styles.statusBadge,
                        req.status === 'pending'
                          ? { backgroundColor: '#f59e0b' }
                          : req.status === 'approved'
                          ? { backgroundColor: '#10b981' }
                          : req.status === 'completed'
                          ? { backgroundColor: '#6366f1' }
                          : { backgroundColor: '#ef4444' }
                      ]}>
                        <Text style={[styles.statusText, { fontSize: 10 * fontSizeScale }]}>
                          {req.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={{ color: '#cbd5e1', fontSize: 14 * fontSizeScale, marginBottom: 4 }}>
                      Alan: <Text style={{ fontWeight: 'bold' }}>{req.field === 'email' ? 'E-posta' : 'Telefon'}</Text>
                    </Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 14 * fontSizeScale, marginBottom: 4 }}>
                      Eski Değer: <Text style={{ textDecorationLine: 'line-through' }}>{req.old_value || 'Belirtilmedi'}</Text>
                    </Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 14 * fontSizeScale, marginBottom: 4 }}>
                      Yeni Değer: <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{req.new_value}</Text>
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13 * fontSizeScale, fontStyle: 'italic', marginBottom: 12 }}>
                      Gerekçe: {req.reason}
                    </Text>

                    {req.status === 'pending' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                        <TouchableOpacity
                          style={[styles.staffActionBtn, { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }]}
                          onPress={() => handleRejectRequest(req.request_id)}
                          disabled={requestActionLoading === req.request_id}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{t('rejectRequestBtn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.staffActionBtn, { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }]}
                          onPress={() => handleApproveRequest(req.request_id)}
                          disabled={requestActionLoading === req.request_id}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{t('allowChangeBtn')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginVertical: 24 }}>
                  {t('noRequestsYet')}
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Point Package Modal */}
        <Modal visible={showPackageModal} animationType="slide" transparent={true}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale }]}>
                  {selectedPackage ? 'Paketi Düzenle' : 'Yeni Paket Oluştur'}
                </Text>
                <TouchableOpacity onPress={() => setShowPackageModal(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8', marginTop: 12 }]}>Paket İsmi (Sistem):</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={pkgName}
                  onChangeText={setPkgName}
                  placeholder="Örn: recipient_1"
                  placeholderTextColor="#64748b"
                  editable={!selectedPackage}
                />

                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Görünür İsim:</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={pkgDisplayName}
                  onChangeText={setPkgDisplayName}
                  placeholder="Örn: Ek Alıcı Hakkı (+1)"
                  placeholderTextColor="#64748b"
                />

                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Gerekli SYMI Puanı:</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={pkgPointsCost}
                  onChangeText={setPkgPointsCost}
                  placeholder="Örn: 400"
                  keyboardType="numeric"
                  placeholderTextColor="#64748b"
                />

                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Açıklama:</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale, height: 60 }]}
                  value={pkgDescription}
                  onChangeText={setPkgDescription}
                  placeholder="Paket detayları..."
                  placeholderTextColor="#64748b"
                  multiline
                />

                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Fayda Tipi:</Text>
                <View style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff' }}>Ek Alıcı Hakkı (extra_recipients)</Text>
                </View>

                <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Fayda Değeri (+):</Text>
                <TextInput
                  style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                  value={pkgBenefitValue}
                  onChangeText={setPkgBenefitValue}
                  placeholder="Örn: 1"
                  keyboardType="numeric"
                  placeholderTextColor="#64748b"
                />

                <TouchableOpacity
                  style={[styles.planEditBtn, { marginTop: 16, marginBottom: 32 }]}
                  onPress={handleSavePackage}
                  disabled={pkgActionLoading}
                >
                  {pkgActionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>{t('saveChanges')}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      {/* User Details Modal (Overview) */}
      <Modal visible={showUserModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeScale }]}>{t('userDetails')}</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView style={styles.modalForm}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Name:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>{selectedUser.full_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Email:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>{selectedUser.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Phone:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>{selectedUser.phone || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Plan:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>{selectedUser.subscription_tier.toUpperCase()}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Status:</Text>
                  <Text style={[
                    styles.detailValue,
                    { fontSize: 16 * fontSizeScale },
                    selectedUser.status === 'inactive' && { color: '#ef4444', fontWeight: 'bold' }
                  ]}>
                    {selectedUser.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Days since check-in:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>{selectedUser.days_since_checkin}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { fontSize: 14 * fontSizeScale }]}>Member since:</Text>
                  <Text style={[styles.detailValue, { fontSize: 16 * fontSizeScale }]}>
                    {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>

                {/* User Status controls directly inside modal */}
                {canEditUserStatus && (
                  <View style={{ marginTop: 24, gap: 12 }}>
                    <TouchableOpacity
                      style={[styles.planEditBtn, { backgroundColor: '#312e81' }]}
                      onPress={() => handleUpdateStatus(selectedUser._id, selectedUser.status, selectedUser.full_name)}
                    >
                      <Ionicons name="options-outline" size={18} color="#fff" />
                      <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>{t('changeStatus')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.planEditBtn, { backgroundColor: '#10b981' }]}
                      onPress={() => {
                        setUpgradeTier(selectedUser.subscription_tier);
                        setUpgradeExtraRecipients(String(selectedUser.extra_recipients || 0));
                        setUpgradeDuration('1_month');
                        setShowUserModal(false);
                        setShowUpgradeModal(true);
                      }}
                    >
                      <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                      <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>Paketi Yükselt / Düzenle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.planEditBtn, { backgroundColor: '#f59e0b' }]}
                      onPress={() => handlePingUser(selectedUser._id)}
                      disabled={pingLoading}
                    >
                      {pingLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="notifications-outline" size={18} color="#fff" />
                          <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>{t('pingUser')}</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.planEditBtn, { backgroundColor: '#ef4444' }]}
                      onPress={() => handleDeleteUser(selectedUser._id, selectedUser.full_name)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>Kullanıcıyı Sil</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* User Upgrade Modal */}
      <Modal visible={showUpgradeModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale }]}>
                Paket Yükselt - {selectedUser?.full_name}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowUpgradeModal(false);
                setShowUserModal(true);
              }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8', marginTop: 12 }]}>Abonelik Paketi:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['free', 'basic', 'silver', 'gold', 'diamond', 'blue_diamond', 'platinum', 'galaxy'].map((tTier) => (
                  <TouchableOpacity
                    key={tTier}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
                      upgradeTier === tTier && { backgroundColor: '#6366f1', borderColor: '#6366f1' }
                    ]}
                    onPress={() => setUpgradeTier(tTier)}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{tTier.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Süre (Zamanlı):</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[
                  { label: '1 Ay', value: '1_month' },
                  { label: '1 Yıl', value: '1_year' },
                  { label: 'Ömür Boyu', value: 'lifetime' }
                ].map((dur) => (
                  <TouchableOpacity
                    key={dur.value}
                    style={[
                      { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
                      upgradeDuration === dur.value && { backgroundColor: '#6366f1', borderColor: '#6366f1' }
                    ]}
                    onPress={() => setUpgradeDuration(dur.value)}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{dur.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale, color: '#94a3b8' }]}>Ek Alıcı Hakkı (Limit):</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                value={upgradeExtraRecipients}
                onChangeText={setUpgradeExtraRecipients}
                placeholder="Örn: 0"
                keyboardType="numeric"
                placeholderTextColor="#64748b"
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 32 }}>
                <TouchableOpacity
                  style={[styles.planEditBtn, { flex: 1, backgroundColor: '#ef4444' }]}
                  onPress={() => {
                    setUpgradeTier('free');
                    setUpgradeDuration('lifetime');
                    setUpgradeExtraRecipients('0');
                    Alert.alert('Sıfırla', 'Bilgiler temizlendi. Kaydet butonuna basarak sıfırlayabilirsiniz.');
                  }}
                >
                  <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>Temizle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.planEditBtn, { flex: 2, backgroundColor: '#10b981' }]}
                  onPress={handleUpgradeUser}
                  disabled={upgradeLoading}
                >
                  {upgradeLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.planEditBtnText, { fontSize: 14 * fontSizeScale }]}>Kaydet / Güncelle</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Staff Create/Edit Modal */}
      <Modal visible={showStaffModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeScale }]}>
                {editingStaff ? t('editStaff') : t('addStaff')}
              </Text>
              <TouchableOpacity onPress={() => setShowStaffModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('fullNamePlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder={t('fullNamePlaceholder')}
                placeholderTextColor="#64748b"
                value={staffFullName}
                onChangeText={setStaffFullName}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('emailPlaceholder')}</Text>
              <TextInput
                style={[styles.input, editingStaff && styles.inputDisabled, { fontSize: 16 * fontSizeScale }]}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor="#64748b"
                value={staffEmail}
                onChangeText={setStaffEmail}
                editable={!editingStaff}
                autoCapitalize="none"
              />

              {!editingStaff && (
                <>
                  <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>Password</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                    placeholder="Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    value={staffPassword}
                    onChangeText={setStaffPassword}
                  />
                </>
              )}

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('phonePlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder={t('phonePlaceholder')}
                placeholderTextColor="#64748b"
                value={staffPhone}
                onChangeText={setStaffPhone}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('roleLabel')}</Text>
              <View style={styles.roleSelection}>
                {['admin', 'moderator', 'manager'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, staffRole === r && styles.roleChipActive]}
                    onPress={() => setStaffRole(r)}
                  >
                    <Text style={[styles.roleChipText, staffRole === r && styles.roleChipTextActive]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale, marginTop: 24 }]}>{t('permissionsLabel')}</Text>
              
              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('canManageStaff')}</Text>
                <Switch value={permManageStaff} onValueChange={setPermManageStaff} />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('canViewUsers')}</Text>
                <Switch value={permViewUsers} onValueChange={setPermViewUsers} />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('canEditUserStatus')}</Text>
                <Switch value={permEditStatus} onValueChange={setPermEditStatus} />
              </View>

              <View style={styles.switchRow}>
                <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('canManagePlans')}</Text>
                <Switch value={permManagePlans} onValueChange={setPermManagePlans} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStaff}>
                <Text style={[styles.saveBtnText, { fontSize: 16 * fontSizeScale }]}>{t('saveChanges')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Staff Password Reset Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale }]}>{t('changePassword')}</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('newPasswordPlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder={t('newPasswordPlaceholder')}
                placeholderTextColor="#64748b"
                secureTextEntry
                value={newStaffPassword}
                onChangeText={setNewStaffPassword}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePassword}>
                <Text style={[styles.saveBtnText, { fontSize: 16 * fontSizeScale }]}>{t('saveChanges')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Plan Base Edit Modal */}
      <Modal visible={showPlanModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 22 * fontSizeScale }]}>Edit {editingPlan?.display_name}</Text>
              <TouchableOpacity onPress={() => setShowPlanModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                value={planDisplayName}
                onChangeText={setPlanDisplayName}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('basePrice')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                keyboardType="numeric"
                value={planPrice}
                onChangeText={setPlanPrice}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('billingCycleLabel')}</Text>
              <View style={styles.roleSelection}>
                {['monthly', 'yearly', 'lifetime'].map((cycle) => (
                  <TouchableOpacity
                    key={cycle}
                    style={[styles.roleChip, planBillingCycle === cycle && styles.roleChipActive]}
                    onPress={() => setPlanBillingCycle(cycle)}
                  >
                    <Text style={[styles.roleChipText, planBillingCycle === cycle && styles.roleChipTextActive]}>
                      {t(cycle + 'Cycle').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale, marginTop: 16 }]}>Max Recipients</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                keyboardType="numeric"
                value={planMaxRecipients}
                onChangeText={setPlanMaxRecipients}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>Max Messages</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                keyboardType="numeric"
                value={planMaxMessages}
                onChangeText={setPlanMaxMessages}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('paymentMethods')} (comma separated)</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                value={planPaymentMethods}
                onChangeText={setPlanPaymentMethods}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>Features (one per line)</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, minHeight: 80 }]}
                multiline
                value={planFeatures}
                onChangeText={setPlanFeatures}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlan}>
                <Text style={[styles.saveBtnText, { fontSize: 16 * fontSizeScale }]}>{t('saveChanges')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country Pricing Add/Edit Modal */}
      <Modal visible={showCountryModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale }]}>{t('addCountryPrice')}</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('countryCode')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder="e.g. TR"
                placeholderTextColor="#64748b"
                value={countryCode}
                onChangeText={setCountryCode}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('pricePlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                keyboardType="numeric"
                placeholder="e.g. 199"
                placeholderTextColor="#64748b"
                value={countryPrice}
                onChangeText={setCountryPrice}
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('currencyPlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder="e.g. TRY"
                placeholderTextColor="#64748b"
                value={countryCurrency}
                onChangeText={setCountryCurrency}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('paymentMethodsPlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder="e.g. stripe, credit_card, bank_transfer"
                placeholderTextColor="#64748b"
                value={countryPaymentMethods}
                onChangeText={setCountryPaymentMethods}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCountryPrice}>
                <Text style={[styles.saveBtnText, { fontSize: 16 * fontSizeScale }]}>{t('saveChanges')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Campaign Add/Edit Modal */}
      <Modal visible={showCampaignModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale }]}>
                {editingCampaign ? t('editCampaign') : t('addCampaign')}
              </Text>
              <TouchableOpacity onPress={() => setShowCampaignModal(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('campaignCode')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                placeholder="e.g. BUGUNE_OZEL"
                placeholderTextColor="#64748b"
                value={campCode}
                onChangeText={setCampCode}
                autoCapitalize="characters"
              />

              <Text style={[styles.label, { fontSize: 14 * fontSizeScale }]}>{t('discountPercentage')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale }]}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor="#64748b"
                value={campDiscount}
                onChangeText={setCampDiscount}
              />

              <View style={[styles.switchRow, { marginTop: 16 }]}>
                <Text style={[styles.switchLabel, { fontSize: 14 * fontSizeScale }]}>{t('activeLabel')}</Text>
                <Switch value={campActive} onValueChange={setCampActive} />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCampaign}>
                <Text style={[styles.saveBtnText, { fontSize: 16 * fontSizeScale }]}>{t('saveChanges')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#64748b',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  messagesStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  messagesStatText: {
    color: '#fff',
    marginLeft: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  smallAddButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 4,
  },
  smallAddButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  filterOptionTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  filterOptionTabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterOptionTabText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterOptionTabTextActive: {
    color: '#fff',
  },
  daysFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  daysFilterInput: {
    width: 60,
    height: 36,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 6,
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userBadge: {
    backgroundColor: '#312e81',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  userBadgeText: {
    color: '#818cf8',
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#064e3b',
  },
  statusFlagged: {
    backgroundColor: '#78350f',
  },
  statusDeceased: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkinInfo: {
    color: '#64748b',
  },
  updateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312e81',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  permissionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionTag: {
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
  },
  staffActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staffActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  configCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 12,
  },
  planTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  planPriceText: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  planInfo: {
    marginBottom: 12,
    gap: 4,
  },
  planSubtext: {
    color: '#94a3b8',
  },
  countryPricingSection: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  countryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countryPricingTitle: {
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  addCountryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addCountryText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  countryCodeText: {
    color: '#94a3b8',
  },
  noCountryText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  planEditBtn: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  planEditBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  modalForm: {
    padding: 20,
  },
  label: {
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputDisabled: {
    backgroundColor: '#0f172a',
    color: '#64748b',
  },
  roleSelection: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  roleChipText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 12,
  },
  roleChipTextActive: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  switchLabel: {
    color: '#cbd5e1',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  detailLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  detailValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
