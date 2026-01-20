import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertCircle, Phone, Stethoscope } from 'lucide-react';

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
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-red-600 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Urgences Médicales
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contacts.map((contact, idx) => (
            <a
              key={idx}
              href={`tel:${contact.number}`}
              className="flex items-center justify-between p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <div>
                <p className="font-bold text-stone-900">{contact.name}</p>
                <p className="text-sm text-stone-600">{contact.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-600" />
                <span className="text-xl font-bold text-green-900">{contact.number}</span>
              </div>
            </a>
          ))}
        </div>
        <p className="text-sm text-stone-500 text-center mt-4">
          En cas d'urgence vitale, appelez immédiatement le 15 ou le 112
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
          className="fixed bottom-24 right-6 z-50 bg-green-900 hover:bg-green-800 text-white rounded-full shadow-xl"
        >
          <Stethoscope className="w-5 h-5 mr-2" />
          Assistant Santé
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif text-green-900">
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
            className="w-full bg-green-900 hover:bg-green-800 rounded-full"
            data-testid="suggest-button"
          >
            {loading ? 'Analyse...' : 'Obtenir des suggestions'}
          </Button>

          {suggestions.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-4">Spécialités recommandées :</h3>
              <div className="space-y-3">
                {suggestions.map((sug, idx) => (
                  <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-bold text-green-900">{sug.specialty}</p>
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
