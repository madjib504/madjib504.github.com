import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, ArrowLeft, Building2, MapPin, CheckCircle2, ChevronRight } from 'lucide-react';

const FUNCTION_OPTIONS = [
  'Médecin', 'Directeur', 'Responsable', 'Secrétaire', 'Manager',
  'Propriétaire', 'Coach', 'Thérapeute', 'Assistant(e)', 'Autre',
];

const ClaimFiche = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=search, 2=fill, 3=done
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    function_role: 'Médecin',
    justification: '',
    password: '',
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return undefined;
    }
    let aborted = false;
    setSearching(true);
    const t = setTimeout(() => {
      axios.get(`${API}/providers/search`, { params: { q: trimmed } })
        .then((r) => { if (!aborted) setResults(r.data || []); })
        .catch(() => { if (!aborted) toast.error('Erreur lors de la recherche.'); })
        .finally(() => { if (!aborted) setSearching(false); });
    }, 350);
    return () => { aborted = true; clearTimeout(t); };
  }, [query]);

  const handleSelectProvider = (provider) => {
    setSelected(provider);
    setStep(2);
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim() || !form.password) {
      toast.error('Veuillez remplir les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/claims`, {
        provider_id: selected.id,
        provider_kind: selected.kind, // 'doctor' | 'partner'
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        function_role: form.function_role,
        justification: form.justification,
        password: form.password,
      });
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Impossible d\'envoyer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12" data-testid="claim-page">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-stone-600 hover:text-blue-900 mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
        </Link>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm flex-wrap">
          <span className={`px-3 py-1.5 rounded-full font-medium ${step >= 1 ? 'bg-blue-900 text-white' : 'bg-stone-200 text-stone-500'}`}>1. Rechercher</span>
          <ChevronRight className="w-4 h-4 text-stone-400" />
          <span className={`px-3 py-1.5 rounded-full font-medium ${step >= 2 ? 'bg-blue-900 text-white' : 'bg-stone-200 text-stone-500'}`}>2. Vos infos</span>
          <ChevronRight className="w-4 h-4 text-stone-400" />
          <span className={`px-3 py-1.5 rounded-full font-medium ${step >= 3 ? 'bg-blue-900 text-white' : 'bg-stone-200 text-stone-500'}`}>3. Validation</span>
        </div>

        {/* STEP 1 - SEARCH */}
        {step === 1 && (
          <Card className="shadow-xl border-stone-100">
            <CardContent className="p-8 md:p-10">
              <div className="text-center mb-8">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                  <Search className="w-7 h-7 text-blue-900" />
                </div>
                <h1 className="text-3xl font-serif font-bold text-stone-900">Revendiquer ma fiche</h1>
                <p className="text-stone-600 mt-2 text-sm">Recherchez votre cabinet, clinique, spa ou centre dans notre base.</p>
              </div>

              <div className="relative mb-6">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input
                  type="search"
                  placeholder="Ex: Polyclinique Sainte Anne-Marie, Croix-Rouge…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-12 h-14 text-base"
                  data-testid="claim-search-input"
                  autoFocus
                />
              </div>

              {searching && <p className="text-sm text-stone-500 text-center">Recherche…</p>}

              {results.length > 0 && (
                <div className="space-y-3" data-testid="claim-search-results">
                  {results.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleSelectProvider(p)}
                      className="w-full text-left p-4 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl transition-all flex items-start gap-3"
                      data-testid={`claim-result-${p.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {p.kind === 'doctor' ? 'Cabinet médical' : 'Partenaire'}
                          {p.activity_type ? ` • ${p.activity_type}` : ''}
                          {(p.specialties && p.specialties.length) ? ` • ${p.specialties.slice(0, 2).join(', ')}` : ''}
                        </p>
                        {(p.city || p.neighborhood) && (
                          <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[p.neighborhood, p.city].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {p.claim_status === 'verified' && (
                          <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                            ⚠️ Déjà revendiquée
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-stone-400 flex-shrink-0 self-center" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                <p className="text-sm text-stone-600 mb-3">Vous ne trouvez pas votre structure ?</p>
                <Link to="/register/add-structure">
                  <Button variant="outline" className="border-blue-900 text-blue-900 hover:bg-blue-50" data-testid="goto-add-structure-btn">
                    Ajouter une nouvelle structure
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 - FILL CLAIM */}
        {step === 2 && selected && (
          <Card className="shadow-xl border-stone-100">
            <CardContent className="p-8 md:p-10">
              <button type="button" onClick={() => { setStep(1); setSelected(null); }}
                className="inline-flex items-center gap-1 text-stone-600 hover:text-blue-900 mb-4 text-sm"
                data-testid="back-to-search-btn">
                <ArrowLeft className="w-4 h-4" /> Choisir une autre fiche
              </button>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                <p className="text-xs uppercase text-blue-700 font-semibold mb-1">Fiche sélectionnée</p>
                <p className="font-semibold text-blue-900">{selected.name}</p>
                {(selected.city || selected.neighborhood) && (
                  <p className="text-xs text-blue-800 mt-1">
                    {[selected.neighborhood, selected.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">Vos informations</h2>
              <p className="text-sm text-stone-600 mb-6">
                Ces informations seront utilisées par notre équipe pour valider que vous êtes bien autorisé(e) à gérer cette fiche.
              </p>

              <form onSubmit={handleSubmitClaim} className="space-y-4" data-testid="claim-form">
                <div className="space-y-1.5">
                  <Label htmlFor="claim_full_name">Nom complet *</Label>
                  <Input id="claim_full_name" value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required data-testid="claim-fullname-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim_phone">Téléphone *</Label>
                  <Input id="claim_phone" type="tel" placeholder="+225 07 XX XX XX XX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required data-testid="claim-phone-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim_email">Email professionnel</Label>
                  <Input id="claim_email" type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    data-testid="claim-email-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim_function">Fonction *</Label>
                  <select id="claim_function"
                    value={form.function_role}
                    onChange={(e) => setForm({ ...form, function_role: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-stone-200 bg-white text-stone-900"
                    data-testid="claim-function-select">
                    {FUNCTION_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim_justification">Pièce justificative / précisions (optionnel)</Label>
                  <Textarea id="claim_justification" rows={3}
                    placeholder="Lien ou description d'un document prouvant votre fonction (diplôme, carte d'employé, etc.)"
                    value={form.justification}
                    onChange={(e) => setForm({ ...form, justification: e.target.value })}
                    data-testid="claim-justification-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="claim_password">Mot de passe pour votre compte *</Label>
                  <Input id="claim_password" type="password" placeholder="Minimum 6 caractères"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required minLength={6} data-testid="claim-password-input" />
                  <p className="text-xs text-stone-500">Vous pourrez vous connecter dès que la demande sera validée.</p>
                </div>

                <Button type="submit" disabled={submitting}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-full py-6 text-base font-semibold"
                  data-testid="claim-submit-btn">
                  {submitting ? 'Envoi…' : 'Envoyer ma demande de revendication'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 - DONE */}
        {step === 3 && (
          <Card className="shadow-xl border-stone-100" data-testid="claim-success-card">
            <CardContent className="p-10 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-serif font-bold text-stone-900 mb-3">Demande envoyée !</h2>
              <p className="text-stone-600 mb-2">
                Votre demande de revendication a été transmise à l&apos;équipe keneyakafisa.
              </p>
              <p className="text-stone-600 mb-6">
                Vous recevrez un appel ou un WhatsApp dans les <strong>48 heures</strong> pour finaliser la validation.
              </p>
              <Button onClick={() => navigate('/')} className="bg-blue-900 hover:bg-blue-800 text-white rounded-full"
                data-testid="claim-back-home-btn">
                Retour à l&apos;accueil
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClaimFiche;
