import React, { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, MapPin, Phone, Mail, Edit2, Save, 
  TrendingUp, Users, Award, MessageCircle, ExternalLink, X,
  Video, Upload, Facebook, Instagram
} from 'lucide-react';

const PartnerDashboard = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [socialLinks, setSocialLinks] = useState({
    tiktok_url: '',
    facebook_url: '',
    instagram_url: '',
    video_url: ''
  });
  const [uploading, setUploading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/partner/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setEditData({
        company_name: response.data.company_name || '',
        activity_type: response.data.activity_type || '',
        address: response.data.address || '',
        whatsapp_number: response.data.whatsapp_number || ''
      });
      setSocialLinks({
        tiktok_url: response.data.tiktok_url || '',
        facebook_url: response.data.facebook_url || '',
        instagram_url: response.data.instagram_url || '',
        video_url: response.data.video_url || ''
      });
    } catch {
      toast.error('Erreur lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API}/partner/profile`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setEditing(false);
      toast.success('Profil mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
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

  const activityLabels = {
    pharmacie: 'Pharmacie',
    laboratoire: 'Laboratoire',
    fournisseur: 'Fournisseur de produits',
    investisseur: 'Investisseur / Sponsor',
    assurance: 'Assurance',
    clinique: 'Clinique / Hôpital',
    ong: 'ONG Santé',
    autre: 'Autre'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-20 pb-10" data-testid="partner-dashboard">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900" data-testid="partner-welcome">
              Bienvenue, {user?.name}
            </h1>
            <p className="text-stone-500">Espace Partenaire keneyakafisa</p>
          </div>
          <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
            {activityLabels[profile?.activity_type] || profile?.activity_type}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Building2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-stone-900">1</p>
              <p className="text-xs text-stone-500">Profil actif</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-stone-900">0</p>
              <p className="text-xs text-stone-500">Clients via keneyakafisa</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-stone-900">0</p>
              <p className="text-xs text-stone-500">Vues du profil</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-stone-900">Actif</p>
              <p className="text-xs text-stone-500">Statut</p>
            </CardContent>
          </Card>
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Informations du partenaire</CardTitle>
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-2"
                data-testid="edit-profile-btn"
              >
                <Edit2 className="w-4 h-4" /> Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="gap-2 bg-blue-700 hover:bg-blue-800" data-testid="save-profile-btn">
                  <Save className="w-4 h-4" /> Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom de l'entreprise</Label>
                  <Input
                    value={editData.company_name}
                    onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                    data-testid="edit-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={editData.address}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    data-testid="edit-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={editData.whatsapp_number}
                    onChange={(e) => setEditData({ ...editData, whatsapp_number: e.target.value })}
                    data-testid="edit-whatsapp"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-500">Entreprise</p>
                    <p className="font-medium text-stone-900" data-testid="company-name">{profile?.company_name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-500">Activité</p>
                    <p className="font-medium text-stone-900">{activityLabels[profile?.activity_type] || profile?.activity_type || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-500">Adresse</p>
                    <p className="font-medium text-stone-900">{profile?.address || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-500">Email</p>
                    <p className="font-medium text-stone-900">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-500">WhatsApp</p>
                    <p className="font-medium text-stone-900">{profile?.whatsapp_number || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Social Links & Video */}
        <Card className="border-0 shadow-sm" data-testid="partner-social-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-700" />
              Réseaux sociaux & Vidéo de présentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9a6.33 6.33 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.81a8.23 8.23 0 004.76 1.52V6.88a4.85 4.85 0 01-1-.19z"/></svg>
                  TikTok
                </Label>
                <Input
                  placeholder="https://tiktok.com/@votre-entreprise"
                  value={socialLinks.tiktok_url}
                  onChange={(e) => setSocialLinks({ ...socialLinks, tiktok_url: e.target.value })}
                  data-testid="partner-tiktok-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Facebook className="w-4 h-4 text-blue-600" /> Facebook
                </Label>
                <Input
                  placeholder="https://facebook.com/votre-page"
                  value={socialLinks.facebook_url}
                  onChange={(e) => setSocialLinks({ ...socialLinks, facebook_url: e.target.value })}
                  data-testid="partner-facebook-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Instagram className="w-4 h-4 text-pink-500" /> Instagram
                </Label>
                <Input
                  placeholder="https://instagram.com/votre-profil"
                  value={socialLinks.instagram_url}
                  onChange={(e) => setSocialLinks({ ...socialLinks, instagram_url: e.target.value })}
                  data-testid="partner-instagram-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4" /> Lien vidéo externe (YouTube, TikTok…)
              </Label>
              <Input
                placeholder="https://youtube.com/watch?v=…"
                value={socialLinks.video_url}
                onChange={(e) => setSocialLinks({ ...socialLinks, video_url: e.target.value })}
                data-testid="partner-video-url-input"
              />
            </div>

            <Button
              onClick={handleSaveSocialLinks}
              className="bg-blue-700 hover:bg-blue-800 text-white"
              data-testid="partner-save-social-btn"
            >
              <Save className="w-4 h-4 mr-2" /> Enregistrer les liens
            </Button>

            {/* Video Upload */}
            <div className="border-t pt-6 space-y-3">
              <Label className="flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" /> Uploader une vidéo de présentation (max 50 Mo)
              </Label>
              {profile?.presentation_video && (
                <div className="mb-3">
                  <video
                    src={`${API.replace('/api', '')}${profile.presentation_video}`}
                    controls
                    className="w-full max-w-md rounded-lg bg-black"
                    data-testid="partner-presentation-video"
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
                  data-testid="partner-video-upload-input"
                />
                {uploading && <span className="text-sm text-blue-600 animate-pulse">Upload en cours…</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <a
                href="https://docs.google.com/presentation/d/1bIwp7orIlr2wfKgO1WRlF2hUpe3mRk4jLo4lxfofQ2E/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-blue-50 hover:border-blue-200 transition-colors"
                data-testid="catalogue-link"
              >
                <ExternalLink className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-stone-700">Catalogue de partenariat</span>
              </a>
              <a
                href={`https://wa.me/2250777154048?text=${encodeURIComponent('Bonjour keneyakafisa, je suis partenaire et je souhaite avoir plus d\'informations.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-green-50 hover:border-green-200 transition-colors"
                data-testid="contact-whatsapp-link"
              >
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-stone-700">Contacter keneyakafisa</span>
              </a>
              <a
                href="/advertise"
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-orange-50 hover:border-orange-200 transition-colors"
                data-testid="advertise-link"
              >
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-stone-700">Publier une annonce</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerDashboard;
