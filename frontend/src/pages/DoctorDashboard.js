import { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Star, Clock, User, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [appointments, setAppointments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: '',
    experience_years: '',
    location: '',
    consultation_fee: '',
    languages: '',
    profile_image: ''
  });

  const fetchAppointments = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(response.data);
    } catch {
      // Appointments fetch failed
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/doctors/search?specialty=`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myProfile = response.data.find(d => d.user_id === user.id);
      if (myProfile) {
        setProfile(myProfile);
        setProfileData({
          bio: myProfile.bio || '',
          experience_years: myProfile.experience_years || '',
          location: myProfile.location || '',
          consultation_fee: myProfile.consultation_fee || '',
          languages: myProfile.languages ? myProfile.languages.join(', ') : '',
          profile_image: myProfile.profile_image || ''
        });
      }
    } catch {
      // Profile fetch failed
    }
  }, [user.id]);

  useEffect(() => {
    fetchAppointments();
    fetchProfile();
  }, [fetchAppointments, fetchProfile]);

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`${API}/appointments/${appointmentId}/status?status=${newStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Statut mis à jour');
      fetchAppointments();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        ...profileData,
        experience_years: profileData.experience_years ? parseInt(profileData.experience_years) : null,
        consultation_fee: profileData.consultation_fee ? parseFloat(profileData.consultation_fee) : null,
        languages: profileData.languages ? profileData.languages.split(',').map(l => l.trim()) : []
      };
      await axios.put(`${API}/doctors/profile`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Profil mis à jour avec succès');
      setEditOpen(false);
      fetchProfile();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      confirmed: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: XCircle },
      completed: { label: 'Terminé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
          <p className="mt-4 text-stone-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const todayAppointments = appointments.filter(
    a => a.appointment_date === new Date().toISOString().split('T')[0] && a.status !== 'cancelled'
  );
  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  return (
    <div data-testid="doctor-dashboard" className="min-h-screen bg-stone-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-blue-900 mb-2" data-testid="dashboard-title">
            Espace Médecin
          </h1>
          <p className="text-lg text-stone-600">Bienvenue, Dr. {user?.name}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Aujourd'hui</p>
                  <p className="text-3xl font-bold text-blue-900" data-testid="today-count">{todayAppointments.length}</p>
                </div>
                <Calendar className="w-12 h-12 text-blue-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">En attente</p>
                  <p className="text-3xl font-bold text-yellow-600" data-testid="pending-count">{pendingAppointments.length}</p>
                </div>
                <Clock className="w-12 h-12 text-yellow-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Total patients</p>
                  <p className="text-3xl font-bold text-blue-900" data-testid="patients-count">{appointments.length}</p>
                </div>
                <User className="w-12 h-12 text-blue-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Note moyenne</p>
                  <p className="text-3xl font-bold text-blue-900" data-testid="rating">{profile?.rating || 0}</p>
                </div>
                <Star className="w-12 h-12 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card */}
        <Card className="shadow-md border-stone-100 mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-serif text-blue-900">Mon Profil</CardTitle>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-blue-900 text-blue-900 hover:bg-blue-50 rounded-full" data-testid="edit-profile-btn">
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif text-blue-900">Modifier mon profil</DialogTitle>
                  <DialogDescription>Mettez à jour vos informations professionnelles</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleProfileUpdate} className="space-y-4" data-testid="profile-form">
                  <div className="space-y-2">
                    <Label htmlFor="bio">Biographie</Label>
                    <Textarea
                      id="bio"
                      placeholder="Présentez-vous..."
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      className="bg-white border-stone-200 rounded-lg min-h-[100px]"
                      data-testid="bio-input"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="experience">Années d'expérience</Label>
                      <Input
                        id="experience"
                        type="number"
                        placeholder="10"
                        value={profileData.experience_years}
                        onChange={(e) => setProfileData({ ...profileData, experience_years: e.target.value })}
                        className="bg-white border-stone-200 rounded-lg h-12"
                        data-testid="experience-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fee">Tarif consultation (€)</Label>
                      <Input
                        id="fee"
                        type="number"
                        step="0.01"
                        placeholder="50"
                        value={profileData.consultation_fee}
                        onChange={(e) => setProfileData({ ...profileData, consultation_fee: e.target.value })}
                        className="bg-white border-stone-200 rounded-lg h-12"
                        data-testid="fee-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Localisation</Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="Paris, France"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      className="bg-white border-stone-200 rounded-lg h-12"
                      data-testid="location-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">Langues (séparées par des virgules)</Label>
                    <Input
                      id="languages"
                      type="text"
                      placeholder="Français, Anglais, Arabe"
                      value={profileData.languages}
                      onChange={(e) => setProfileData({ ...profileData, languages: e.target.value })}
                      className="bg-white border-stone-200 rounded-lg h-12"
                      data-testid="languages-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image">URL de la photo de profil</Label>
                    <Input
                      id="image"
                      type="url"
                      placeholder="https://..."
                      value={profileData.profile_image}
                      onChange={(e) => setProfileData({ ...profileData, profile_image: e.target.value })}
                      className="bg-white border-stone-200 rounded-lg h-12"
                      data-testid="image-input"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full" data-testid="save-profile-btn">
                    Enregistrer les modifications
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Spécialités</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.specialties?.map((spec) => (
                      <span key={spec} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-stone-600 mb-1">Type de médecine</p>
                  <p className="text-stone-900 font-medium capitalize">{profile.medical_type}</p>
                </div>
                {profile.location && (
                  <div>
                    <p className="text-sm text-stone-600 mb-1">Localisation</p>
                    <p className="text-stone-900 font-medium">{profile.location}</p>
                  </div>
                )}
                {profile.experience_years && (
                  <div>
                    <p className="text-sm text-stone-600 mb-1">Expérience</p>
                    <p className="text-stone-900 font-medium">{profile.experience_years} ans</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-stone-600">Chargement du profil...</p>
            )}
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="shadow-md border-stone-100">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-blue-900">Rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12" data-testid="no-appointments">
                <Calendar className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-600">Aucun rendez-vous pour le moment</p>
              </div>
            ) : (
              <div className="space-y-4" data-testid="appointments-list">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    data-testid={`appointment-${apt.id}`}
                    className="flex items-center justify-between p-6 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-serif font-bold text-stone-900">
                          {apt.patient_info?.name || 'Patient'}
                        </h3>
                        {getStatusBadge(apt.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-stone-600 mb-2">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(apt.appointment_date).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {apt.appointment_time}
                        </div>
                      </div>
                      {apt.reason && (
                        <p className="text-sm text-stone-600">Motif: {apt.reason}</p>
                      )}
                    </div>
                    {apt.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleStatusUpdate(apt.id, 'confirmed')}
                          className="bg-blue-900 text-white hover:bg-blue-800 rounded-full"
                          data-testid={`confirm-btn-${apt.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button
                          onClick={() => handleStatusUpdate(apt.id, 'cancelled')}
                          variant="outline"
                          className="border-red-600 text-red-600 hover:bg-red-50 rounded-full"
                          data-testid={`cancel-btn-${apt.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    )}
                    {apt.status === 'confirmed' && (
                      <Button
                        onClick={() => handleStatusUpdate(apt.id, 'completed')}
                        className="bg-blue-600 text-white hover:bg-blue-700 rounded-full"
                        data-testid={`complete-btn-${apt.id}`}
                      >
                        Marquer comme terminé
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DoctorDashboard;