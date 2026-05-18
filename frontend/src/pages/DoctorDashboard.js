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
import { Calendar, Star, Clock, User, CheckCircle, XCircle, AlertCircle, Edit, Video, Upload, MapPin, Globe, Save } from 'lucide-react';
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
  const [socialLinks, setSocialLinks] = useState({
    tiktok_url: '',
    facebook_url: '',
    instagram_url: '',
    video_url: ''
  });
  const [locationDetails, setLocationDetails] = useState({
    country: '',
    city: '',
    neighborhood: '',
    landmark: '',
    website: '',
    latitude: '',
    longitude: ''
  });
  const [uploading, setUploading] = useState(false);

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
        setSocialLinks({
          tiktok_url: myProfile.tiktok_url || '',
          facebook_url: myProfile.facebook_url || '',
          instagram_url: myProfile.instagram_url || '',
          video_url: myProfile.video_url || ''
        });
        setLocationDetails({
          country: myProfile.country || '',
          city: myProfile.city || '',
          neighborhood: myProfile.neighborhood || '',
          landmark: myProfile.landmark || '',
          website: myProfile.website || '',
          latitude: myProfile.coordinates?.latitude ?? '',
          longitude: myProfile.coordinates?.longitude ?? ''
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

  const handleSaveSocialLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/profile/social-links`, socialLinks, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Liens mis à jour');
      fetchProfile();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleSaveLocation = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/profile/location-details`, locationDetails, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Localisation mise à jour');
      fetchProfile();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUseMyGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non disponible sur cet appareil');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationDetails({
          ...locationDetails,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        });
        toast.success('Position GPS récupérée');
      },
      () => toast.error('Impossible de récupérer la position GPS')
    );
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('La vidéo ne doit pas dépasser 50 Mo');
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/upload/video`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Vidéo uploadée avec succès');
      fetchProfile();
    } catch {
      toast.error('Erreur lors de l\'upload de la vidéo');
    } finally {
      setUploading(false);
    }
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

        {/* Localisation détaillée */}
        <Card className="shadow-md border-stone-100">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-blue-900 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Localisation de votre cabinet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="loc-country">Pays</Label>
                <Input id="loc-country" placeholder="Ex: Côte d'Ivoire"
                  value={locationDetails.country}
                  onChange={(e) => setLocationDetails({ ...locationDetails, country: e.target.value })}
                  data-testid="loc-country-input" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="loc-city">Ville</Label>
                <Input id="loc-city" placeholder="Ex: Abidjan"
                  value={locationDetails.city}
                  onChange={(e) => setLocationDetails({ ...locationDetails, city: e.target.value })}
                  data-testid="loc-city-input" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="loc-neighborhood">Quartier</Label>
                <Input id="loc-neighborhood" placeholder="Ex: Cocody Riviera 3"
                  value={locationDetails.neighborhood}
                  onChange={(e) => setLocationDetails({ ...locationDetails, neighborhood: e.target.value })}
                  data-testid="loc-neighborhood-input" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="loc-landmark">Repère</Label>
                <Input id="loc-landmark" placeholder="Ex: En face de la pharmacie du Plateau"
                  value={locationDetails.landmark}
                  onChange={(e) => setLocationDetails({ ...locationDetails, landmark: e.target.value })}
                  data-testid="loc-landmark-input" />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="loc-website" className="flex items-center gap-1">
                <Globe className="w-4 h-4" /> Site web
              </Label>
              <Input id="loc-website" placeholder="https://votre-site.com" type="url"
                value={locationDetails.website}
                onChange={(e) => setLocationDetails({ ...locationDetails, website: e.target.value })}
                data-testid="loc-website-input" />
            </div>

            <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <Label className="font-medium">Position GPS</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Latitude (ex: 5.3364)" type="number" step="0.000001"
                  value={locationDetails.latitude}
                  onChange={(e) => setLocationDetails({ ...locationDetails, latitude: e.target.value })}
                  data-testid="loc-latitude-input" />
                <Input placeholder="Longitude (ex: -4.0267)" type="number" step="0.000001"
                  value={locationDetails.longitude}
                  onChange={(e) => setLocationDetails({ ...locationDetails, longitude: e.target.value })}
                  data-testid="loc-longitude-input" />
              </div>
              <Button type="button" variant="outline" onClick={handleUseMyGPS}
                className="w-full text-blue-900 border-blue-300 hover:bg-blue-100"
                data-testid="use-my-gps-btn">
                <MapPin className="w-4 h-4 mr-2" /> Utiliser ma position actuelle
              </Button>
            </div>

            <Button onClick={handleSaveLocation}
              className="bg-blue-900 hover:bg-blue-800 text-white"
              data-testid="save-location-btn">
              <Save className="w-4 h-4 mr-2" /> Enregistrer la localisation
            </Button>
          </CardContent>
        </Card>

        {/* Social Links & Video */}
        <Card className="shadow-md border-stone-100">
          <CardHeader>
            <CardTitle className="text-2xl font-serif text-blue-900">Réseaux sociaux & Vidéo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Social Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9a6.33 6.33 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.81a8.23 8.23 0 004.76 1.52V6.88a4.85 4.85 0 01-1-.19z"/></svg>
                  TikTok
                </Label>
                <Input
                  placeholder="https://tiktok.com/@votre-profil"
                  value={socialLinks.tiktok_url}
                  onChange={(e) => setSocialLinks({...socialLinks, tiktok_url: e.target.value})}
                  data-testid="tiktok-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </Label>
                <Input
                  placeholder="https://facebook.com/votre-page"
                  value={socialLinks.facebook_url}
                  onChange={(e) => setSocialLinks({...socialLinks, facebook_url: e.target.value})}
                  data-testid="facebook-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </Label>
                <Input
                  placeholder="https://instagram.com/votre-profil"
                  value={socialLinks.instagram_url}
                  onChange={(e) => setSocialLinks({...socialLinks, instagram_url: e.target.value})}
                  data-testid="instagram-input"
                />
              </div>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Video className="w-4 h-4" /> Lien vidéo de présentation (YouTube, TikTok...)
              </Label>
              <Input
                placeholder="https://youtube.com/watch?v=... ou https://tiktok.com/..."
                value={socialLinks.video_url}
                onChange={(e) => setSocialLinks({...socialLinks, video_url: e.target.value})}
                data-testid="video-url-input"
              />
            </div>

            <Button onClick={handleSaveSocialLinks} className="bg-blue-900 hover:bg-blue-800 text-white" data-testid="save-social-btn">
              Enregistrer les liens
            </Button>

            {/* Video Upload */}
            <div className="border-t pt-6 space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="w-4 h-4" /> Uploader une vidéo de présentation (max 50 Mo)
              </Label>
              {profile?.presentation_video && (
                <div className="mb-3">
                  <video
                    src={`${API.replace('/api', '')}${profile.presentation_video}`}
                    controls
                    className="w-full max-w-md rounded-lg"
                    data-testid="presentation-video"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  disabled={uploading}
                  className="max-w-sm"
                  data-testid="video-upload-input"
                />
                {uploading && <span className="text-sm text-blue-600 animate-pulse">Upload en cours...</span>}
              </div>
            </div>
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