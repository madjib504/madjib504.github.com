import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  'Médecine générale', 'Cardiologie', 'Pédiatrie', 'Gynécologie', 'Dentisterie',
  'Nutrition', 'Psychologie', 'Kinésithérapie', 'Pharmacie', 'Laboratoire',
  'Imagerie médicale', 'Coaching sportif', 'Massage thérapeutique', 'Yoga',
  'Méditation', 'Bien-être', 'Spa', 'Salon de coiffure', 'Esthétique',
  'Humanitaire / ONG', 'Centre d\'écoute', 'Service communautaire', 'Autre',
];

const RegisterAddStructure = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    structure_name: '',
    categorie: 'Médecine générale',
    sous_categorie: '',
    phone: '',
    whatsapp_number: '',
    email: '',
    address: '',
    commune: '',
    ville: 'Abidjan',
    description: '',
    full_name: '',
    function_role: 'Propriétaire',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.structure_name.trim() || !form.phone.trim() || !form.full_name.trim() || !form.password) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/structures/add`, form);
      toast.success('Structure ajoutée avec succès !');
      if (r.data?.token) {
        localStorage.setItem('token', r.data.token);
        setUser(r.data.user);
        navigate('/partner/dashboard');
      } else {
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'ajout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12" data-testid="add-structure-page">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-stone-600 hover:text-blue-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
        </Link>

        <Card className="shadow-xl border-stone-100">
          <CardContent className="p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="w-7 h-7 text-blue-900" />
              </div>
              <h1 className="text-3xl font-serif font-bold text-stone-900">Ajouter ma structure</h1>
              <p className="text-stone-600 mt-2 text-sm">
                Référencez votre cabinet, clinique, spa ou centre sur keneyakafisa.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="add-structure-form">

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-3 text-sm">Informations sur la structure</h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="structure_name">Nom de la structure *</Label>
                    <Input id="structure_name" placeholder="Ex: Clinique Le Plateau"
                      value={form.structure_name}
                      onChange={(e) => setForm({ ...form, structure_name: e.target.value })}
                      required data-testid="structure-name-input" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="categorie">Catégorie *</Label>
                      <select id="categorie" value={form.categorie}
                        onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-stone-200 bg-white text-stone-900"
                        data-testid="structure-categorie-select">
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sous_categorie">Sous-catégorie</Label>
                      <Input id="sous_categorie" placeholder="Ex: Cardiologie interventionnelle"
                        value={form.sous_categorie}
                        onChange={(e) => setForm({ ...form, sous_categorie: e.target.value })}
                        data-testid="structure-souscategorie-input" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Téléphone *</Label>
                      <Input id="phone" type="tel" placeholder="+225 …"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required data-testid="structure-phone-input" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input id="whatsapp" type="tel"
                        value={form.whatsapp_number}
                        onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                        data-testid="structure-whatsapp-input" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email professionnel</Label>
                    <Input id="email" type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      data-testid="structure-email-input" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address">Adresse</Label>
                    <Input id="address" placeholder="Ex: Rue des Jardins, Lot 23"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      data-testid="structure-address-input" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="commune">Commune</Label>
                      <Input id="commune" placeholder="Ex: Cocody"
                        value={form.commune}
                        onChange={(e) => setForm({ ...form, commune: e.target.value })}
                        data-testid="structure-commune-input" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ville">Ville</Label>
                      <Input id="ville" value={form.ville}
                        onChange={(e) => setForm({ ...form, ville: e.target.value })}
                        data-testid="structure-ville-input" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" rows={3}
                      placeholder="Présentez brièvement votre structure et les services proposés…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      data-testid="structure-description-input" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <h3 className="font-semibold text-stone-900 mb-3 text-sm">Votre compte (responsable)</h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Nom complet *</Label>
                    <Input id="full_name" value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      required data-testid="structure-fullname-input" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="function_role">Fonction</Label>
                    <select id="function_role" value={form.function_role}
                      onChange={(e) => setForm({ ...form, function_role: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-stone-200 bg-white text-stone-900"
                      data-testid="structure-role-select">
                      <option>Propriétaire</option>
                      <option>Directeur</option>
                      <option>Médecin</option>
                      <option>Manager</option>
                      <option>Secrétaire</option>
                      <option>Autre</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Mot de passe *</Label>
                    <Input id="password" type="password" placeholder="Minimum 6 caractères"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required minLength={6} data-testid="structure-password-input" />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={submitting}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-full py-6 text-base font-semibold"
                data-testid="structure-submit-btn">
                {submitting ? 'Création…' : 'Ajouter ma structure'}
              </Button>

              <p className="text-center text-xs text-stone-500">
                En soumettant ce formulaire, vous certifiez être autorisé(e) à représenter cette structure.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterAddStructure;
