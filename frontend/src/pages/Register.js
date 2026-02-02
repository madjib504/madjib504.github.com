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
    user_type: 'patient',
    medical_type: '',
    specialties: [],
    custom_corps: '',
    custom_specialties: ''
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
    } catch (error) {
      console.error('Erreur lors du chargement des spécialités');
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
      
      // Small delay to ensure state is updated
      setTimeout(() => {
        if (response.data.user.user_type === 'patient') {
          navigate('/patient/dashboard');
        } else {
          navigate('/doctor/dashboard');
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
    <div data-testid="register-page" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-green-50 to-sky-50 px-6 py-24">
      <Card className="w-full max-w-2xl shadow-xl border-stone-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-serif font-bold text-green-900" data-testid="register-title">Inscription</CardTitle>
          <CardDescription className="text-stone-600">
            Créez votre compte SANA VITA
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
                className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12"
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
                className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12"
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
                  className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12 pr-10"
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
              <Label>Type de compte</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: 'patient', medical_type: '', specialties: [] })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.user_type === 'patient'
                      ? 'border-green-800 bg-green-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                  data-testid="user-type-patient-btn"
                >
                  <div className="font-medium text-stone-900">Patient</div>
                  <div className="text-sm text-stone-600">Je cherche un médecin</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, user_type: 'doctor' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.user_type === 'doctor'
                      ? 'border-green-800 bg-green-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                  data-testid="user-type-doctor-btn"
                >
                  <div className="font-medium text-stone-900">Corps de Santé</div>
                  <div className="text-sm text-stone-600">Je suis un praticien</div>
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
                    <SelectTrigger className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12" data-testid="medical-type-select">
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
                      className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12"
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
                      className="bg-white border-stone-200 focus:border-green-800 focus:ring-1 focus:ring-green-800 rounded-lg h-12"
                      data-testid="custom-specialties-input"
                    />
                    <p className="text-xs text-stone-500">Séparez les spécialités par des virgules</p>
                  </div>
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-green-900 text-white hover:bg-green-800 rounded-full h-12 text-lg font-medium"
              data-testid="register-submit-btn"
            >
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-stone-600">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-green-900 font-medium hover:underline" data-testid="register-login-link">
              Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;