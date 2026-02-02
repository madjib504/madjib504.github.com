import { useState, useEffect } from 'react';
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
    } catch (error) {
      console.error('Erreur');
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
            {urgentContacts.map((contact, idx) => (
              <a
                key={idx}
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
            {otherContacts.map((contact, idx) => (
              <a
                key={idx}
                href={`tel:${contact.number.replace(/\s/g, '')}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${getTypeColor(contact.type)} hover:shadow-md transition-all`}
                data-testid={`contact-${idx}`}
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

export const MedicalAssistant = () => {
  const [open, setOpen] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/assistant/suggest`, { symptoms });
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          data-testid="assistant-button"
          className="fixed bottom-24 right-6 z-50 bg-blue-900 hover:bg-blue-800 text-white rounded-full shadow-xl"
        >
          <Stethoscope className="w-5 h-5 mr-2" />
          Assistant Santé
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-blue-900">
            Assistant d'Orientation Médicale
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              Décrivez vos symptômes :
            </label>
            <Input
              placeholder="Ex: J'ai mal à la tête et de la fièvre..."
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

          {suggestions.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-4">Spécialités recommandées :</h3>
              <div className="space-y-3">
                {suggestions.map((sug, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="font-bold text-blue-900">{sug.specialty}</p>
                    <p className="text-sm text-stone-600 capitalize">{sug.medical_type.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-4">
                ⚠️ Cet outil est une aide à l'orientation. Consultez toujours un professionnel pour un diagnostic précis.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
