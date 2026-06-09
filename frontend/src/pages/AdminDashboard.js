import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, UserCheck, Stethoscope, Calendar, CreditCard, 
  TrendingUp, Search, Eye, Trash2, CheckCircle, XCircle,
  Lock, LogOut, Download, RefreshCw, ChevronLeft, ChevronRight,
  Shield, AlertTriangle, AlertCircle, Bell, MessageCircle, X, UserPlus,
  Crown, ShieldCheck
} from 'lucide-react';
import OwnerAdminPanel from '../components/OwnerAdminPanel';
import AdminClaimsPanel from '../components/AdminClaimsPanel';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceToggling, setMaintenanceToggling] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentAdminRole, setCurrentAdminRole] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchMaintenanceStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTab, currentPage, userTypeFilter]);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      try {
        const res = await axios.get(`${API}/admin/verify`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsAuthenticated(true);
        setCurrentAdminRole(res.data?.admin_role || null);
      } catch (error) {
        localStorage.removeItem('admin_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/admin/login`, loginData);
      if (response.data.success) {
        localStorage.setItem('admin_token', response.data.token);
        setIsAuthenticated(true);
        setCurrentAdminRole(response.data.admin_role || null);
        toast.success('Connexion admin réussie');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Identifiants incorrects');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setCurrentAdminRole(null);
    toast.success('Déconnexion réussie');
  };

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [statsRes, notifRes] = await Promise.all([
          axios.get(`${API}/admin/stats`, getAuthHeaders()),
          axios.get(`${API}/admin/notifications`, getAuthHeaders())
        ]);
        setStats(statsRes.data);
        setNotifications(notifRes.data.notifications || []);
        setUnreadCount(notifRes.data.unread_count || 0);
      } else if (activeTab === 'users') {
        const params = new URLSearchParams();
        if (userTypeFilter !== 'all') params.append('user_type', userTypeFilter);
        if (searchQuery) params.append('search', searchQuery);
        params.append('skip', (currentPage - 1) * 20);
        params.append('limit', 20);
        
        const response = await axios.get(`${API}/admin/users?${params}`, getAuthHeaders());
        setUsers(response.data.users);
        setTotalPages(response.data.pages);
      } else if (activeTab === 'payments') {
        const response = await axios.get(`${API}/admin/payments`, getAuthHeaders());
        setPayments(response.data.payments);
      } else if (activeTab === 'appointments') {
        const response = await axios.get(`${API}/admin/appointments`, getAuthHeaders());
        setAppointments(response.data.appointments);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData();
  };

  const handleVerifyUser = async (userId) => {
    try {
      await axios.patch(`${API}/admin/users/${userId}/verify`, {}, getAuthHeaders());
      toast.success('Utilisateur vérifié');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la vérification');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    try {
      await axios.delete(`${API}/admin/users/${userId}`, getAuthHeaders());
      toast.success('Utilisateur supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API}/admin/export/users`, getAuthHeaders());
      const dataStr = JSON.stringify(response.data.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `utilisateurs_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success('Export réussi');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const markNotificationRead = async (notifId) => {
    try {
      await axios.post(`${API}/admin/notifications/${notifId}/read`, {}, getAuthHeaders());
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.post(`${API}/admin/notifications/read-all`, {}, getAuthHeaders());
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const r = await axios.get(`${API}/maintenance/status`);
      setMaintenanceEnabled(!!r.data.enabled);
    } catch {
      // Silent fail
    }
  };

  const toggleMaintenance = async () => {
    setMaintenanceToggling(true);
    const newValue = !maintenanceEnabled;
    try {
      await axios.put(`${API}/admin/maintenance`, { enabled: newValue }, getAuthHeaders());
      setMaintenanceEnabled(newValue);
      toast.success(newValue ? "Mode maintenance activé : l'app est inaccessible aux utilisateurs" : "Mode maintenance désactivé : l'app est de nouveau accessible");
    } catch {
      toast.error("Impossible de modifier le mode maintenance");
    } finally {
      setMaintenanceToggling(false);
    }
  };

  const [seedRunning, setSeedRunning] = useState(false);
  const [masterRunning, setMasterRunning] = useState(false);

  const runMasterMigration = async () => {
    setMasterRunning(true);
    try {
      const r = await axios.post(`${API}/admin/migrate-master-model`, {}, getAuthHeaders());
      const s = r.data.stats || {};
      toast.success(`Master Model V2 appliqué : ${s.doctors_migrated || 0} médecins, ${s.partners_migrated || 0} partenaires.`);
      alert(
        `Master Model V2 enrichissement terminé ✅\n\n` +
        `Médecins enrichis : ${s.doctors_migrated || 0}\n` +
        `Partenaires enrichis : ${s.partners_migrated || 0}\n` +
        `Erreurs : ${s.errors || 0}\n\n` +
        `Total profils médecins : ${r.data.doctor_profiles_in_db}\n` +
        `Avec master_profile : ${r.data.doctors_with_master}\n\n` +
        `Total profils partenaires : ${r.data.partner_profiles_in_db}\n` +
        `Avec master_profile : ${r.data.partners_with_master}`
      );
    } catch (err) {
      toast.error('Échec : ' + (err.response?.data?.detail || err.message));
    } finally {
      setMasterRunning(false);
    }
  };
  const runSeed = async () => {
    setSeedRunning(true);
    try {
      const r = await axios.post(`${API}/admin/run-seed`, {}, getAuthHeaders());
      const s = r.data.stats || {};
      const totalImported = (s.imported_doctor || 0) + (s.imported_partner || 0);
      toast.success(`Seed exécuté : ${totalImported} nouveaux profils importés. Total médecins en base : ${r.data.doctor_profiles_in_db}`);
      console.info('[Seed] details:', r.data);
      alert(
        `Seed exécuté ✅\n\n` +
        `Fichier seed présent : ${r.data.seed_file_exists ? 'OUI' : 'NON'}\n` +
        `Taille fichier : ${r.data.seed_file_size_bytes} octets\n\n` +
        `Nouveaux médecins importés : ${s.imported_doctor || 0}\n` +
        `Nouveaux partenaires importés : ${s.imported_partner || 0}\n` +
        `Déjà existants (skippés) : ${s.skipped_exists || 0}\n` +
        `Erreurs : ${s.errors || 0}\n\n` +
        `Total utilisateurs en base : ${r.data.users_total_in_db}\n` +
        `Total profils médecins : ${r.data.doctor_profiles_in_db}\n` +
        `Total profils partenaires : ${r.data.partner_profiles_in_db}`
      );
      fetchData();
    } catch (err) {
      toast.error("Échec du seed : " + (err.response?.data?.detail || err.message));
    } finally {
      setSeedRunning(false);
    }
  };

  const formatWhatsApp = (raw) => {
    if (!raw) return null;
    // Garde uniquement les chiffres
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    // Si le numéro commence déjà par un indicatif (>10 chiffres), on garde tel quel.
    // Sinon (cas "0777154048" - 10 chiffres), on suppose Côte d'Ivoire (225).
    if (digits.length <= 10) {
      // Retire le 0 de tête s'il existe (CI mobile : "07 XX XX XX XX" → "7 XX XX XX XX")
      const trimmed = digits.startsWith('0') ? digits.slice(1) : digits;
      return `225${trimmed}`;
    }
    return digits;
  };

  const openWhatsAppNotif = (notif) => {
    const userPhone = formatWhatsApp(notif.whatsapp_number);
    const typeLabel = notif.user_type === 'doctor' ? 'Médecin' : notif.user_type === 'partner' ? 'Partenaire' : 'Patient';
    if (!userPhone) {
      // Pas de numéro renseigné → on alerte l'admin et on n'ouvre pas WhatsApp
      toast.error(`${typeLabel} ${notif.user_name} n'a pas renseigné de numéro WhatsApp.`);
      return;
    }
    const msg = `Bonjour ${notif.user_name}, bienvenue sur keneyakafisa ! Je suis l'équipe support et je vous contacte suite à votre inscription comme ${typeLabel.toLowerCase()}. Comment puis-je vous aider ?`;
    window.open(`https://wa.me/${userPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const viewUserDetail = async (userId) => {
    try {
      const response = await axios.get(`${API}/admin/users/${userId}`, getAuthHeaders());
      setSelectedUser(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Administration
            </CardTitle>
            <p className="text-slate-400 text-sm">Accès réservé aux administrateurs</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Nom d'utilisateur"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="admin-username"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="admin-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                data-testid="admin-login-btn"
              >
                <Lock className="w-4 h-4 mr-2" />
                Se connecter
              </Button>
            </form>
            <p className="text-xs text-slate-500 text-center mt-4">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Zone sécurisée - Accès surveillé
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User Detail Modal
  if (selectedUser) {
    return (
      <div className="min-h-screen bg-slate-900 pt-6 px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedUser(null)}
            className="text-slate-400 hover:text-white mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                  {selectedUser.user?.user_type === 'patient' ? (
                    <Users className="w-6 h-6 text-blue-500" />
                  ) : (
                    <Stethoscope className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                {selectedUser.user?.name}
                {selectedUser.user?.verified && (
                  <Badge className="bg-blue-500">Vérifié</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Email</p>
                  <p className="text-white">{selectedUser.user?.email}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Type</p>
                  <p className="text-white capitalize">{selectedUser.user?.user_type}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">ID</p>
                  <p className="text-slate-300 font-mono text-xs">{selectedUser.user?.id}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Inscrit le</p>
                  <p className="text-white">{formatDate(selectedUser.user?.created_at)}</p>
                </div>
              </div>

              {/* Doctor Profile */}
              {selectedUser.doctor_profile && (
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="text-white font-semibold mb-3">Profil Médecin</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Spécialités</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedUser.doctor_profile.specialties?.map((s) => (
                          <Badge key={s} variant="secondary">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Type médecine</p>
                      <p className="text-white capitalize">{selectedUser.doctor_profile.medical_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Note</p>
                      <p className="text-yellow-500">{selectedUser.doctor_profile.rating?.toFixed(1)} ⭐</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Tarif consultation</p>
                      <p className="text-blue-500">{selectedUser.doctor_profile.consultation_fee || 0} XOF</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payments */}
              {selectedUser.payments?.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="text-white font-semibold mb-3">Paiements ({selectedUser.payments.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedUser.payments.map((p) => (
                      <div key={p.reference_id || p.description} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                        <span className="text-slate-300 text-sm">{p.description}</span>
                        <span className={`font-medium ${p.status === 'SUCCESSFUL' ? 'text-blue-500' : 'text-yellow-500'}`}>
                          {p.amount} XOF
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                {!selectedUser.user?.verified && (
                  <Button 
                    onClick={() => handleVerifyUser(selectedUser.user?.id)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Vérifier
                  </Button>
                )}
                <Button 
                  variant="destructive"
                  onClick={() => {
                    handleDeleteUser(selectedUser.user?.id);
                    setSelectedUser(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-slate-900 pt-16">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Administration</h1>
              <p className="text-slate-400 text-sm">keneyakafisa</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <Button 
                variant="ghost" 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-slate-400 hover:text-white relative"
                data-testid="notification-bell"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-96 max-h-96 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50" data-testid="notification-panel">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                    <h3 className="text-white font-semibold">Notifications</h3>
                    <div className="flex gap-2">
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllNotificationsRead}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Tout marquer lu
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-500">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className={`px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${!notif.read ? 'bg-slate-700/30' : ''}`}
                        onClick={() => !notif.read && markNotificationRead(notif.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.user_type === 'doctor' ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
                            {notif.user_type === 'doctor' 
                              ? <Stethoscope className="w-4 h-4 text-blue-400" />
                              : <UserPlus className="w-4 h-4 text-green-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">{notif.user_email}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-slate-500">{formatDate(notif.created_at)}</span>
                              {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); openWhatsAppNotif(notif); }}
                            className="text-green-400 hover:text-green-300 p-1"
                            title="Envoyer sur WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <Button 
              variant="ghost" 
              onClick={fetchData}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: TrendingUp },
            { id: 'users', label: 'Utilisateurs', icon: Users },
            { id: 'claims', label: 'Revendications', icon: ShieldCheck },
            { id: 'payments', label: 'Paiements', icon: CreditCard },
            { id: 'appointments', label: 'Rendez-vous', icon: Calendar },
            ...(currentAdminRole === 'super_admin_owner'
              ? [{ id: 'owner', label: 'OWNER', icon: Crown }]
              : [])
          ].map((tab) => (
            <button
              key={tab.id}
              data-testid={`admin-tab-${tab.id}`}
              onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? (tab.id === 'owner' ? 'bg-amber-500 text-slate-900' : 'bg-red-600 text-white')
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                {/* Maintenance Mode Toggle */}
                <Card className={`border-2 ${maintenanceEnabled ? 'bg-amber-900/30 border-amber-500' : 'bg-slate-800 border-slate-700'}`}>
                  <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className={`w-8 h-8 ${maintenanceEnabled ? 'text-amber-400' : 'text-slate-400'}`} />
                      <div>
                        <p className="text-white font-semibold">Mode Maintenance</p>
                        <p className="text-sm text-slate-400">
                          {maintenanceEnabled
                            ? "⚠️ Activé : tous les utilisateurs voient la page de maintenance"
                            : "Désactivé : l'application est accessible à tous"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={toggleMaintenance}
                      disabled={maintenanceToggling}
                      className={maintenanceEnabled
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-slate-700 hover:bg-slate-600 text-white border border-slate-500"}
                      data-testid="toggle-maintenance-btn"
                    >
                      {maintenanceToggling ? '…' : maintenanceEnabled ? 'Désactiver la maintenance' : 'Activer la maintenance'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Manual seed trigger (diagnostic) */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Download className="w-8 h-8 text-blue-400" />
                      <div>
                        <p className="text-white font-semibold">Import des cabinets initiaux (103)</p>
                        <p className="text-sm text-slate-400">
                          Charge manuellement la base de cabinets/cliniques/spas. Sans effet si déjà chargés.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={runSeed}
                      disabled={seedRunning}
                      className="bg-blue-700 hover:bg-blue-800 text-white"
                      data-testid="run-seed-btn"
                    >
                      {seedRunning ? 'En cours…' : 'Lancer l\'import'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Master Model V2 migration */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-8 h-8 text-purple-400" />
                      <div>
                        <p className="text-white font-semibold">Master Model V2 (modèle unifié)</p>
                        <p className="text-sm text-slate-400">
                          Enrichit chaque fiche avec la structure imbriquée (identity, classification, ai_matching, contact, booking, trust). Idempotent.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={runMasterMigration}
                      disabled={masterRunning}
                      className="bg-purple-700 hover:bg-purple-800 text-white"
                      data-testid="run-master-model-btn"
                    >
                      {masterRunning ? 'En cours…' : 'Appliquer V2'}
                    </Button>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">Total Utilisateurs</p>
                          <p className="text-3xl font-bold text-white">{stats.users.total}</p>
                        </div>
                        <Users className="w-10 h-10 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">Patients</p>
                          <p className="text-3xl font-bold text-blue-500">{stats.users.patients}</p>
                        </div>
                        <UserCheck className="w-10 h-10 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">Médecins</p>
                          <p className="text-3xl font-bold text-blue-500">{stats.users.doctors}</p>
                        </div>
                        <Stethoscope className="w-10 h-10 text-blue-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">Revenus</p>
                          <p className="text-2xl font-bold text-yellow-500">{stats.payments.revenue?.toLocaleString()} XOF</p>
                        </div>
                        <CreditCard className="w-10 h-10 text-yellow-500 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Rendez-vous</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total</span>
                          <span className="text-white font-medium">{stats.appointments.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">En attente</span>
                          <span className="text-yellow-500 font-medium">{stats.appointments.pending}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white">Paiements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total transactions</span>
                          <span className="text-white font-medium">{stats.payments.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Réussis</span>
                          <span className="text-blue-500 font-medium">{stats.payments.successful}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Search & Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Rechercher par nom ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                      <Button onClick={handleSearch} className="bg-slate-700 hover:bg-slate-600">
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <select
                    value={userTypeFilter}
                    onChange={(e) => { setUserTypeFilter(e.target.value); setCurrentPage(1); }}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
                  >
                    <option value="all">Tous</option>
                    <option value="patient">Patients</option>
                    <option value="doctor">Médecins</option>
                  </select>
                  <Button onClick={handleExport} variant="outline" className="border-slate-700 text-slate-300">
                    <Download className="w-4 h-4 mr-2" />
                    Exporter
                  </Button>
                </div>

                {/* Users Table */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-700/50">
                          <tr>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Utilisateur</th>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Email</th>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Type</th>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Statut</th>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Inscrit le</th>
                            <th className="text-left text-slate-400 text-sm font-medium p-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-700/30">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    user.user_type === 'patient' ? 'bg-blue-500/20' : 'bg-blue-500/20'
                                  }`}>
                                    {user.user_type === 'patient' ? (
                                      <Users className="w-5 h-5 text-blue-500" />
                                    ) : (
                                      <Stethoscope className="w-5 h-5 text-blue-500" />
                                    )}
                                  </div>
                                  <span className="text-white font-medium">{user.name}</span>
                                </div>
                              </td>
                              <td className="p-4 text-slate-300">{user.email}</td>
                              <td className="p-4">
                                <Badge variant={user.user_type === 'patient' ? 'default' : 'secondary'}>
                                  {user.user_type === 'patient' ? 'Patient' : 'Médecin'}
                                </Badge>
                              </td>
                              <td className="p-4">
                                {user.verified ? (
                                  <Badge className="bg-blue-500/20 text-blue-500">Vérifié</Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/20 text-yellow-500">Non vérifié</Badge>
                                )}
                              </td>
                              <td className="p-4 text-slate-400 text-sm">{formatDate(user.created_at)}</td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => viewUserDetail(user.id)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {!user.verified && (
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => handleVerifyUser(user.id)}
                                      className="text-blue-500 hover:text-blue-400"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-slate-700">
                        <Button
                          variant="ghost"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                          className="text-slate-400"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Précédent
                        </Button>
                        <span className="text-slate-400">
                          Page {currentPage} sur {totalPages}
                        </span>
                        <Button
                          variant="ghost"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                          className="text-slate-400"
                        >
                          Suivant
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/50">
                        <tr>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Référence</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Client</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Provider</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Montant</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Statut</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {payments.map((payment) => (
                          <tr key={payment.reference_id || payment.id} className="hover:bg-slate-700/30">
                            <td className="p-4 text-slate-300 font-mono text-xs">
                              {payment.reference_id?.slice(0, 8)}...
                            </td>
                            <td className="p-4">
                              <div>
                                <p className="text-white">{payment.customer_name}</p>
                                <p className="text-slate-500 text-xs">{payment.email}</p>
                              </div>
                            </td>
                            <td className="p-4 text-slate-300 capitalize">
                              {payment.provider?.replace('_', ' ')}
                            </td>
                            <td className="p-4 text-white font-medium">
                              {payment.amount?.toLocaleString()} XOF
                            </td>
                            <td className="p-4">
                              <Badge className={
                                payment.status === 'SUCCESSFUL' ? 'bg-blue-500/20 text-blue-500' :
                                payment.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                'bg-red-500/20 text-red-500'
                              }>
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">{formatDate(payment.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/50">
                        <tr>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Patient</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Médecin</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Date/Heure</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Statut</th>
                          <th className="text-left text-slate-400 text-sm font-medium p-4">Créé le</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {appointments.map((apt) => (
                          <tr key={apt.id || `${apt.patient_name}-${apt.appointment_date}`} className="hover:bg-slate-700/30">
                            <td className="p-4 text-white">{apt.patient_name}</td>
                            <td className="p-4 text-slate-300">{apt.doctor_name}</td>
                            <td className="p-4 text-slate-300">
                              {apt.appointment_date} à {apt.appointment_time}
                            </td>
                            <td className="p-4">
                              <Badge className={
                                apt.status === 'confirmed' ? 'bg-blue-500/20 text-blue-500' :
                                apt.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                apt.status === 'cancelled' ? 'bg-red-500/20 text-red-500' :
                                'bg-blue-500/20 text-blue-500'
                              }>
                                {apt.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">{formatDate(apt.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* OWNER Tab — only visible to super_admin_owner */}
            {activeTab === 'owner' && currentAdminRole === 'super_admin_owner' && (
              <OwnerAdminPanel token={localStorage.getItem('admin_token')} />
            )}

            {/* Claims Management — visible to all admins */}
            {activeTab === 'claims' && (
              <AdminClaimsPanel token={localStorage.getItem('admin_token')} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
