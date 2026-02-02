import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Megaphone, Building2, User, Mail, Phone, Link as LinkIcon, 
  Image, FileText, CheckCircle, ArrowLeft, Sparkles
} from 'lucide-react';

const Advertise = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: '',
    link: '',
    advertiser_name: '',
    advertiser_email: '',
    advertiser_phone: '',
    ad_type: 'entreprise',
    duration_days: 30
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.advertiser_name || !formData.advertiser_email || !formData.advertiser_phone) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/ads`, formData);
      if (response.data.success) {
        setSubmitted(true);
        toast.success('Votre publicité a été soumise avec succès !');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center px-4 py-24">
        <Card className="max-w-lg w-full text-center shadow-xl">
          <CardContent className="pt-12 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-blue-900 mb-3">
              Publicité Soumise !
            </h2>
            <p className="text-stone-600 mb-6">
              Votre annonce a été envoyée pour validation. Notre équipe l'examinera dans les 24-48 heures.
              Vous recevrez une notification par email une fois approuvée.
            </p>
            <div className="space-y-3">
              <Link to="/">
                <Button className="w-full bg-blue-900 hover:bg-blue-800">
                  Retour à l'accueil
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    title: '',
                    description: '',
                    image: '',
                    link: '',
                    advertiser_name: '',
                    advertiser_email: '',
                    advertiser_phone: '',
                    ad_type: 'entreprise',
                    duration_days: 30
                  });
                }}
                className="w-full"
              >
                Soumettre une autre publicité
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 pt-20 pb-12 px-4" data-testid="advertise-page">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>
        
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-blue-100 text-blue-800 px-4 py-2 rounded-full mb-4">
            <Megaphone className="w-5 h-5" />
            <span className="font-semibold">Espace Publicitaire SANA VITA</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">
            Faites Connaître Votre Activité
          </h1>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Atteignez des milliers de patients et professionnels de santé. 
            Publiez votre annonce sur notre plateforme et augmentez votre visibilité.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-4xl mx-auto mb-10">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-2 border-stone-200 hover:border-blue-300 transition-colors">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-stone-700">Standard</CardTitle>
              <div className="text-3xl font-bold text-blue-900">5 000 <span className="text-lg">XOF</span></div>
              <CardDescription>par semaine</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-stone-600 space-y-2">
              <p>✓ Affichage carousel accueil</p>
              <p>✓ 7 jours de diffusion</p>
              <p>✓ Statistiques de vues</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Populaire
            </div>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-blue-700">Premium</CardTitle>
              <div className="text-3xl font-bold text-blue-900">15 000 <span className="text-lg">XOF</span></div>
              <CardDescription>par mois</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-stone-600 space-y-2">
              <p>✓ Position prioritaire</p>
              <p>✓ 30 jours de diffusion</p>
              <p>✓ Statistiques détaillées</p>
              <p>✓ Support dédié</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-400 bg-gradient-to-b from-yellow-50 to-white">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg text-yellow-700">Entreprise</CardTitle>
              <div className="text-3xl font-bold text-blue-900">50 000 <span className="text-lg">XOF</span></div>
              <CardDescription>par trimestre</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-stone-600 space-y-2">
              <p>✓ Affichage exclusif</p>
              <p>✓ 90 jours de diffusion</p>
              <p>✓ Rapports personnalisés</p>
              <p>✓ Manager de compte</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-blue-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Formulaire de Publicité
          </CardTitle>
          <CardDescription>
            Remplissez les informations ci-dessous pour soumettre votre annonce
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type d'annonceur */}
            <div className="space-y-2">
              <Label>Type d'annonceur *</Label>
              <Select 
                value={formData.ad_type} 
                onValueChange={(value) => setFormData({...formData, ad_type: value})}
              >
                <SelectTrigger data-testid="ad-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entreprise">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Entreprise
                    </div>
                  </SelectItem>
                  <SelectItem value="particulier">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" /> Particulier
                    </div>
                  </SelectItem>
                  <SelectItem value="formation">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Formation / École
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Titre */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre de l'annonce *</Label>
              <Input
                id="title"
                placeholder="Ex: Clinique Santé Plus - Consultations 7j/7"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                data-testid="ad-title-input"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Décrivez votre offre, service ou produit en quelques phrases..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                required
                rows={3}
                data-testid="ad-description-input"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image" className="flex items-center gap-2">
                <Image className="w-4 h-4" /> URL de l'image
              </Label>
              <Input
                id="image"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.image}
                onChange={(e) => setFormData({...formData, image: e.target.value})}
                data-testid="ad-image-input"
              />
              <p className="text-xs text-stone-500">Recommandé: 800x600 pixels minimum</p>
            </div>

            {/* Link */}
            <div className="space-y-2">
              <Label htmlFor="link" className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Lien vers votre site (optionnel)
              </Label>
              <Input
                id="link"
                type="url"
                placeholder="https://votre-site.com"
                value={formData.link}
                onChange={(e) => setFormData({...formData, link: e.target.value})}
                data-testid="ad-link-input"
              />
            </div>

            <hr className="my-6" />

            <h3 className="font-semibold text-stone-700 mb-3">Informations de contact</h3>

            {/* Nom */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4" /> Nom / Raison sociale *
              </Label>
              <Input
                id="name"
                placeholder="Votre nom ou celui de votre entreprise"
                value={formData.advertiser_name}
                onChange={(e) => setFormData({...formData, advertiser_name: e.target.value})}
                required
                data-testid="ad-name-input"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@entreprise.com"
                value={formData.advertiser_email}
                onChange={(e) => setFormData({...formData, advertiser_email: e.target.value})}
                required
                data-testid="ad-email-input"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> Téléphone *
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+225 XX XX XX XX XX"
                value={formData.advertiser_phone}
                onChange={(e) => setFormData({...formData, advertiser_phone: e.target.value})}
                required
                data-testid="ad-phone-input"
              />
            </div>

            {/* Submit */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 py-6 text-lg mt-6"
              data-testid="ad-submit-btn"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Megaphone className="w-5 h-5 mr-2" />
                  Soumettre ma publicité
                </>
              )}
            </Button>

            <p className="text-xs text-center text-stone-500 mt-4">
              En soumettant ce formulaire, vous acceptez nos conditions d'utilisation.
              Notre équipe validera votre annonce sous 24-48h.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Advertise;
