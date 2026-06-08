import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertCircle, Phone, Stethoscope, Hospital, Shield, Flame, Heart, AlertTriangle } from 'lucide-react';

export const SOSButton = () => {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (open) {
      fetchContacts();
    }
  }, [open]);

  const fetchContacts = async () => {
    try {
      const response = await axios.get(`${API}/emergency/contacts`);
      setContacts(response.data);
    } catch {
      // Contacts fetch failed
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'Urgences Médicales':
        return <Hospital className="w-5 h-5 text-red-500" />;
      case 'Incendie & Secours':
      case 'Secours':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'Police':
      case 'Gendarmerie':
        return <Shield className="w-5 h-5 text-blue-500" />;
      case 'Hôpital':
        return <Hospital className="w-5 h-5 text-blue-500" />;
      case 'Humanitaire':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'Intoxication':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Phone className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Urgences Médicales':
        return 'bg-red-50 border-red-200';
      case 'Incendie & Secours':
      case 'Secours':
        return 'bg-orange-50 border-orange-200';
      case 'Police':
      case 'Gendarmerie':
        return 'bg-blue-50 border-blue-200';
      case 'Hôpital':
        return 'bg-blue-50 border-blue-200';
      case 'Humanitaire':
        return 'bg-pink-50 border-pink-200';
      case 'Intoxication':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-stone-50 border-stone-200';
    }
  };

  // Séparer les numéros courts (urgences) des numéros longs (hôpitaux)
  const urgentContacts = contacts.filter(c => c.number.length <= 3);
  const otherContacts = contacts.filter(c => c.number.length > 3);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          data-testid="sos-button"
          className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 shadow-2xl animate-pulse"
        >
          <AlertCircle className="w-8 h-8" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-red-600 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Urgences - Côte d'Ivoire
          </DialogTitle>
        </DialogHeader>
        
        {/* Numéros d'urgence courts */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Numéros d'urgence
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {urgentContacts.map((contact) => (
              <a
                key={contact.number}
                href={`tel:${contact.number}`}
                className={`flex flex-col items-center p-4 rounded-xl border-2 ${getTypeColor(contact.type)} hover:shadow-md transition-all`}
                data-testid={`emergency-${contact.number}`}
              >
                <div className="mb-2">
                  {getIcon(contact.type)}
                </div>
                <span className="text-2xl font-bold text-stone-900">{contact.number}</span>
                <span className="text-sm font-medium text-stone-700 text-center">{contact.name}</span>
                <span className="text-xs text-stone-500 text-center mt-1">{contact.type}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Autres numéros utiles */}
        <div>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
            Hôpitaux & Services
          </h3>
          <div className="space-y-2">
            {otherContacts.map((contact) => (
              <a
                key={contact.number}
                href={`tel:${contact.number.replace(/\s/g, '')}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${getTypeColor(contact.type)} hover:shadow-md transition-all`}
                data-testid={`contact-${contact.number}`}
              >
                <div className="flex items-center gap-3">
                  {getIcon(contact.type)}
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">{contact.name}</p>
                    <p className="text-xs text-stone-500">{contact.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-blue-800 text-sm">{contact.number}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 text-center font-medium">
            🚨 En cas d'urgence vitale, appelez le <strong>185</strong> (SAMU) ou le <strong>180</strong> (Pompiers)
          </p>
        </div>

        <p className="text-xs text-stone-400 text-center mt-2">
          Cliquez sur un numéro pour appeler directement
        </p>
      </DialogContent>
    </Dialog>
  );
};

export const MedicalAssistant = ({ open: controlledOpen, onOpenChange: controlledOnOpenChange, trigger }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;
  const [symptoms, setSymptoms] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/assistant/suggest`, { symptoms });
      setResult(response.data);
    } catch {
      // Suggestion failed
    } finally {
      setLoading(false);
    }
  };

  const urgencyStyle = result?.urgency_level === 'urgent'
    ? 'bg-red-50 border-red-300 text-red-900'
    : result?.urgency_level === 'moderate'
      ? 'bg-amber-50 border-amber-300 text-amber-900'
      : 'bg-blue-50 border-blue-200 text-blue-900';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-blue-900">
            Assistant d&apos;Orientation Médicale
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              Décrivez vos symptômes ou besoins :
            </label>
            <Input
              placeholder="Ex: J'ai mal à la tête et de la fièvre, mal aux dents, douleur poitrine…"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="h-24"
              data-testid="symptoms-input"
            />
          </div>
          <Button
            onClick={handleSuggest}
            disabled={loading || !symptoms.trim()}
            className="w-full bg-blue-900 hover:bg-blue-800 rounded-full"
            data-testid="suggest-button"
          >
            {loading ? 'Analyse...' : 'Obtenir des suggestions'}
          </Button>

          {result && (
            <div className="mt-6 space-y-5" data-testid="assistant-result">

              {/* Urgency banner */}
              <div className={`p-4 rounded-xl border ${urgencyStyle}`} data-testid="assistant-urgency">
                <p className="font-semibold text-sm">{result.urgency_label}</p>
                {result.urgency_level === 'urgent' && (
                  <a
                    href={`tel:${result.emergency_number || '185'}`}
                    className="inline-block mt-2 px-4 py-2 bg-red-600 text-white rounded-full font-semibold text-sm hover:bg-red-700"
                    data-testid="assistant-call-emergency"
                  >
                    📞 Appeler les urgences ({result.emergency_number || '185'})
                  </a>
                )}
              </div>

              {/* Specialties */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 text-stone-900">Spécialités recommandées</h3>
                  <div className="flex flex-wrap gap-2" data-testid="assistant-specialties">
                    {result.suggestions.map((sug) => (
                      <span key={sug.specialty}
                        className="inline-block px-3 py-1.5 rounded-full bg-blue-100 text-blue-900 text-sm font-medium">
                        {sug.specialty}
                        <span className="text-xs text-blue-700/70 ml-1">
                          ({(sug.medical_type || '').replace(/_/g, ' ')})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Providers */}
              {result.providers && result.providers.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 text-stone-900">
                    Professionnels suggérés ({result.providers.length})
                  </h3>
                  <div className="space-y-2" data-testid="assistant-providers">
                    {result.providers.map((p) => (
                      <Link
                        key={p.id}
                        to={`/doctor/${p.id}`}
                        onClick={() => setOpen(false)}
                        className="block p-3 bg-white border border-stone-200 hover:border-blue-400 hover:shadow-md rounded-xl transition-all"
                        data-testid={`assistant-provider-${p.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                            {p.specialties && p.specialties.length > 0 && (
                              <p className="text-xs text-stone-500 mt-0.5 truncate">
                                {p.specialties.slice(0, 3).join(' • ')}
                              </p>
                            )}
                            {(p.city || p.neighborhood) && (
                              <p className="text-xs text-stone-500 mt-0.5">
                                📍 {[p.neighborhood, p.city].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          {p.claim_status === 'verified' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 flex-shrink-0">
                              ✓ Vérifié
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {result.providers && result.providers.length === 0 && (
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-600">
                  Aucun professionnel ne correspond exactement à ces symptômes dans notre base pour le moment.
                  Essayez la recherche par catégorie ou contactez nos urgences si c'est grave.
                </div>
              )}

              {/* Legal notice */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-900 leading-relaxed">
                  ⚠️ {result.legal_notice}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
