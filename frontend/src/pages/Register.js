import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff } from 'lucide-react';

const Register = ({ setUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    whatsapp_number: '',
    user_type: 'patient',
    medical_type: '',
    specialties: [],
    custom_corps: '',
    custom_specialties: '',
    company_name: '',
    activity_type: '',
    address: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [specialtiesList, setSpecialtiesList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialtiesList(response.data);
    } catch {
      // Specialties fetch failed
    }
  };

  const handleSpecialtyToggle = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation pour "Corps de Santé"
    if (formData.user_type === 'doctor') {
      if (!formData.medical_type) {
        toast.error('Veuillez sélectionner un type de médecine');
        return;
      }
      
      // Si "Autre" est sélectionné, vérifier le champ personnalisé
      if (formData.medical_type === 'autre') {
        if (!formData.custom_corps || formData.custom_corps.trim() === '') {
          toast.error('Veuillez préciser votre corps de santé');
          return;
        }
      } else {
        // Sinon, vérifier qu'au moins une spécialité est sélectionnée
        if (formData.specialties.length === 0) {
          toast.error('Veuillez sélectionner au moins une spécialité');
          return;
        }
      }
    }

    // Validation pour "Partenaire"
    if (formData.user_type === 'partner') {
      if (!formData.company_name.trim()) {
        toast.error('Veuillez entrer le nom de votre entreprise');
        return;
      }
      if (!formData.activity_type) {
        toast.error('Veuillez sélectionner votre type d\'activité');
        return;
      }
      if (!formData.address.trim()) {
        toast.error('Veuillez entrer votre adresse');
        return;
      }
    }

    setLoading(true);

    try {
      // Préparer les données à envoyer
      const dataToSend = { ...formData };
      
      // Si "Autre", utiliser custom_corps comme nom de spécialité
      if (formData.medical_type === 'autre') {
        dataToSend.specialties = formData.custom_specialties 
          ? formData.custom_specialties.split(',').map(s => s.trim()).filter(s => s)
          : [formData.custom_corps];
        dataToSend.custom_medical_type = formData.custom_corps;
      }
      
      const response = await axios.post(`${API}/auth/register`, dataToSend);
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      toast.success('Inscription réussie !');
      
      // Open WhatsApp notification to admin for both user types
      const userName = response.data.user.name;
      const userType = response.data.user.user_type === 'doctor' ? 'Médecin' : 'Patient';
      const whatsappMsg = `Bonjour keneyakafisa, je viens de m'inscrire en tant que ${userType}. Mon nom est ${userName}.`;
      window.open(`https://wa.me/2250777154048?text=${encodeURIComponent(whatsappMsg)}`, '_blank');

      // Redirect based on user type
      setTimeout(() => {
        if (response.data.user.user_type === 'patient') {
          navigate('/patient/dashboard');
        } else if (response.data.user.user_type === 'partner') {
          navigate('/partner/dashboard');
        } else {
          // Health professionals go to welcome page with brochure
          navigate('/welcome-doctor');
        }
      }, 100);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const filteredSpecialties = specialtiesList.filter(
    s => !formData.medical_type || s.medical_type === formData.medical_type
  );

  return (
    <div data-testid="register-page" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-blue-50 to-sky-50 px-6 py-24">
      <Card className="w-full max-w-2xl shadow-xl border-stone-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-serif font-bold text-blue-900" data-testid="register-title">Inscription</CardTitle>
          <CardDescription className="text-stone-600">
            Créez votre compte keneyakafisa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Votre nom"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                data-testid="register-name-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                data-testid="register-email-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12 pr-10"
                  data-testid="register-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">Numéro WhatsApp</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 text-lg">📱</span>
                <Input
                  id="whatsapp"
                  type="tel"
                  placeholder="+225 XX XX XX XX XX"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12 pl-10"
                  data-testid="register-whatsapp-input"
                />
              </div>
              <p className="text-xs text-stone-500">Pour être contacté facilement par vos patients ou médecins</p>
            </div>

            <div className="space-y-2">
              <Label>Type de compte</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: 'patient', medical_type: '', specialties: [], company_name: '', activity_type: '', address: '' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.user_type === 'patient'
                      ? 'border-blue-800 bg-blue-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                  data-testid="user-type-patient-btn"
                >
                  <div className="font-medium text-stone-900 text-sm">Patient</div>
                  <div className="text-xs text-stone-600">Je cherche un médecin</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: 'doctor', company_name: '', activity_type: '', address: '' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.user_type === 'doctor'
                      ? 'border-blue-800 bg-blue-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                  data-testid="user-type-doctor-btn"
                >
                  <div className="font-medium text-stone-900 text-sm">Corps de Santé</div>
                  <div className="text-xs text-stone-600">Je suis praticien</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: 'partner', medical_type: '', specialties: [], custom_corps: '', custom_specialties: '' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.user_type === 'partner'
                      ? 'border-blue-800 bg-blue-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                  data-testid="user-type-partner-btn"
                >
                  <div className="font-medium text-stone-900 text-sm">Partenaire</div>
                  <div className="text-xs text-stone-600">Entreprise / Sponsor</div>
                </button>
              </div>
            </div>

            {formData.user_type === 'doctor' && (
              <>
                <div className="space-y-2">
                  <Label>Type de médecine *</Label>
                  <Select 
                    value={formData.medical_type} 
                    onValueChange={(value) => setFormData({ ...formData, medical_type: value, specialties: [], custom_corps: '' })}
                    required
                  >
                    <SelectTrigger className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12" data-testid="medical-type-select">
                      <SelectValue placeholder="Sélectionnez un type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="moderne" className="cursor-pointer hover:bg-stone-100">Médecine Moderne</SelectItem>
                      <SelectItem value="traditionnel_africain" className="cursor-pointer hover:bg-stone-100">Médecine Traditionnelle Africaine</SelectItem>
                      <SelectItem value="bien_etre" className="cursor-pointer hover:bg-stone-100">Bien-être & Beauté</SelectItem>
                      <SelectItem value="service_domicile" className="cursor-pointer hover:bg-stone-100">Service à Domicile</SelectItem>
                      <SelectItem value="materiel_medical" className="cursor-pointer hover:bg-stone-100">Matériel Médical</SelectItem>
                      <SelectItem value="boutique_bien_etre" className="cursor-pointer hover:bg-stone-100">Boutique Bien-être</SelectItem>
                      <SelectItem value="autre" className="cursor-pointer hover:bg-stone-100">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-stone-500">Choisissez votre type de pratique médicale</p>
                </div>

                {/* Champ personnalisé pour "Autre" */}
                {formData.medical_type === 'autre' && (
                  <div className="space-y-2">
                    <Label>Précisez votre corps de santé *</Label>
                    <Input
                      type="text"
                      placeholder="Ex: Orthophoniste, Podologue, Ergothérapeute..."
                      value={formData.custom_corps || ''}
                      onChange={(e) => setFormData({ ...formData, custom_corps: e.target.value })}
                      className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                      data-testid="custom-corps-input"
                      required
                    />
                    <p className="text-xs text-stone-500">Entrez le nom de votre profession de santé</p>
                  </div>
                )}

                {formData.medical_type && formData.medical_type !== 'autre' && (
                  <div className="space-y-2">
                    <Label>Spécialités * (sélectionnez au moins une)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-4 bg-stone-50 rounded-lg border border-stone-200">
                      {filteredSpecialties.map((specialty) => (
                        <div key={specialty.id} className="flex items-start space-x-3 p-2 hover:bg-white rounded transition-colors">
                          <Checkbox
                            id={specialty.id}
                            checked={formData.specialties.includes(specialty.name)}
                            onCheckedChange={() => handleSpecialtyToggle(specialty.name)}
                            data-testid={`specialty-checkbox-${specialty.id}`}
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={specialty.id}
                            className="text-sm text-stone-700 cursor-pointer flex-1 select-none"
                          >
                            {specialty.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-stone-500">
                      {formData.specialties.length} spécialité(s) sélectionnée(s)
                    </p>
                  </div>
                )}

                {/* Pour "Autre", permettre d'entrer des spécialités manuellement */}
                {formData.medical_type === 'autre' && formData.custom_corps && (
                  <div className="space-y-2">
                    <Label>Vos spécialités (optionnel)</Label>
                    <Input
                      type="text"
                      placeholder="Ex: Rééducation, Soins à domicile..."
                      value={formData.custom_specialties || ''}
                      onChange={(e) => setFormData({ ...formData, custom_specialties: e.target.value })}
                      className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                      data-testid="custom-specialties-input"
                    />
                    <p className="text-xs text-stone-500">Séparez les spécialités par des virgules</p>
                  </div>
                )}
              </>
            )}

            {formData.user_type === 'partner' && (
              <>
                <div className="space-y-2">
                  <Label>Nom de l'entreprise *</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Pharmacie Santé Plus, Labo Biolim..."
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                    data-testid="partner-company-input"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type d'activité *</Label>
                  <Select
                    value={formData.activity_type}
                    onValueChange={(value) => setFormData({ ...formData, activity_type: value })}
                    required
                  >
                    <SelectTrigger className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12" data-testid="partner-activity-select">
                      <SelectValue placeholder="Sélectionnez votre activité" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="pharmacie" className="cursor-pointer hover:bg-stone-100">Pharmacie</SelectItem>
                      <SelectItem value="laboratoire" className="cursor-pointer hover:bg-stone-100">Laboratoire</SelectItem>
                      <SelectItem value="fournisseur" className="cursor-pointer hover:bg-stone-100">Fournisseur de produits</SelectItem>
                      <SelectItem value="investisseur" className="cursor-pointer hover:bg-stone-100">Investisseur / Sponsor</SelectItem>
                      <SelectItem value="assurance" className="cursor-pointer hover:bg-stone-100">Assurance</SelectItem>
                      <SelectItem value="clinique" className="cursor-pointer hover:bg-stone-100">Clinique / Hôpital</SelectItem>
                      <SelectItem value="ong" className="cursor-pointer hover:bg-stone-100">ONG Santé</SelectItem>
                      <SelectItem value="autre" className="cursor-pointer hover:bg-stone-100">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Adresse / Localisation *</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Abidjan, Cocody Riviera 3"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-white border-stone-200 focus:border-blue-800 focus:ring-1 focus:ring-blue-800 rounded-lg h-12"
                    data-testid="partner-address-input"
                    required
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 text-white hover:bg-blue-800 rounded-full h-12 text-lg font-medium"
              data-testid="register-submit-btn"
            >
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-stone-600">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-blue-900 font-medium hover:underline" data-testid="register-login-link">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;