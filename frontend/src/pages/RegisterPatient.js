import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { extractErrorMessage } from '@/lib/errors';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, ArrowLeft } from 'lucide-react';

const RegisterPatient = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    password: '',
    commune: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim() || !form.password) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      // Patient minimal: name = "Prénom Nom", whatsapp_number defaults to phone
      const phoneDigits = form.phone.replace(/\D/g, '');
      const payload = {
        user_type: 'patient',
        email: (form.email || `phone-${phoneDigits}@keneyakafisa.app`).toLowerCase(),
        password: form.password,
        name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
        whatsapp_number: form.whatsapp_number || form.phone,
        address: form.commune,
      };
      const r = await axios.post(`${API}/auth/register`, payload);
      localStorage.setItem('token', r.data.token);
      setUser(r.data.user);
      toast.success('Bienvenue sur keneyakafisa !');
      navigate('/patient/dashboard');
    } catch (err) {
      toast.error(extractErrorMessage(err, "Erreur lors de l'inscription. Cet email/téléphone est peut-être déjà utilisé."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4 py-12" data-testid="register-patient-page">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-1 text-stone-600 hover:text-blue-900 mb-4 text-sm" data-testid="back-home-link">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
        </Link>
        <Card className="shadow-xl border-stone-100">
          <CardContent className="p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-7 h-7 text-blue-900" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-stone-900">Créer mon compte Patient</h1>
              <p className="text-stone-600 mt-2 text-sm">Rejoignez la communauté santé en quelques secondes.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-patient-form">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input id="first_name" value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required data-testid="patient-first-name-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input id="last_name" value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required data-testid="patient-last-name-input" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input id="phone" type="tel" placeholder="+225 07 XX XX XX XX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required data-testid="patient-phone-input" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_number">WhatsApp (optionnel)</Label>
                <Input id="whatsapp_number" type="tel" placeholder="Identique au téléphone si vide"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  data-testid="patient-whatsapp-input" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email (optionnel)</Label>
                <Input id="email" type="email" placeholder="vous@exemple.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  data-testid="patient-email-input" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="commune">Commune</Label>
                <Input id="commune" placeholder="Ex: Cocody, Yopougon, Plateau…"
                  value={form.commune}
                  onChange={(e) => setForm({ ...form, commune: e.target.value })}
                  data-testid="patient-commune-input" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe *</Label>
                <Input id="password" type="password" placeholder="Minimum 6 caractères"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required minLength={6} data-testid="patient-password-input" />
              </div>

              <Button type="submit" disabled={submitting}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-full py-6 text-base font-semibold"
                data-testid="patient-submit-btn">
                {submitting ? 'Création…' : 'Créer mon compte'}
              </Button>

              <p className="text-center text-sm text-stone-600">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-blue-900 font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPatient;
