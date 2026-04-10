import { useState, useEffect, useCallback, useContext } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Heart, Pill, Shield, Plus, X } from 'lucide-react';

const MedicalRecord = () => {
  const { user } = useContext(AuthContext);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');

  const fetchRecord = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/medical-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecord(response.data);
    } catch {
      // Record fetch failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/medical-records`, record, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Dossier médical mis à jour !');
      setEditing(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setRecord(prev => ({
        ...prev,
        allergies: [...(prev.allergies || []), newAllergy]
      }));
      setNewAllergy('');
    }
  };

  const removeAllergy = (index) => {
    setRecord(prev => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index)
    }));
  };

  const addCondition = () => {
    if (newCondition.trim()) {
      setRecord(prev => ({
        ...prev,
        chronic_conditions: [...(prev.chronic_conditions || []), newCondition]
      }));
      setNewCondition('');
    }
  };

  const removeCondition = (index) => {
    setRecord(prev => ({
      ...prev,
      chronic_conditions: prev.chronic_conditions.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div data-testid="medical-record-page" className="min-h-screen bg-stone-50 pt-24 px-6 pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-blue-900 mb-2">Mon Dossier Médical</h1>
          <p className="text-stone-600">Centralisez toutes vos informations de santé</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Allergies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Ajouter une allergie"
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                  />
                  <Button onClick={addAllergy} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {record?.allergies?.length > 0 ? (
                  record.allergies.map((allergy, idx) => (
                    <Badge key={allergy} variant="destructive" className="flex items-center gap-1">
                      {allergy}
                      {editing && (
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeAllergy(idx)}
                        />
                      )}
                    </Badge>
                  ))
                ) : (
                  <p className="text-stone-500 text-sm">Aucune allergie connue</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Maladies Chroniques */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-blue-600" />
                Maladies Chroniques
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing && (
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Ajouter une maladie"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCondition()}
                  />
                  <Button onClick={addCondition} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {record?.chronic_conditions?.length > 0 ? (
                  record.chronic_conditions.map((condition, idx) => (
                    <Badge key={condition} className="flex items-center gap-1 bg-blue-100 text-blue-800">
                      {condition}
                      {editing && (
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeCondition(idx)}
                        />
                      )}
                    </Badge>
                  ))
                ) : (
                  <p className="text-stone-500 text-sm">Aucune maladie chronique</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Groupe Sanguin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-red-600" />
                Groupe Sanguin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Input
                  placeholder="Ex: O+, A-, AB+"
                  value={record?.blood_type || ''}
                  onChange={(e) => setRecord(prev => ({ ...prev, blood_type: e.target.value }))}
                />
              ) : (
                <p className="text-2xl font-bold text-stone-900">
                  {record?.blood_type || 'Non renseigné'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-stone-600" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  placeholder="Informations importantes..."
                  value={record?.notes || ''}
                  onChange={(e) => setRecord(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                />
              ) : (
                <p className="text-stone-600">
                  {record?.notes || 'Aucune note'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex gap-4">
          {editing ? (
            <>
              <Button onClick={handleUpdate} className="bg-blue-900 text-white hover:bg-blue-800">
                Enregistrer
              </Button>
              <Button onClick={() => { setEditing(false); fetchRecord(); }} variant="outline">
                Annuler
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} className="bg-blue-900 text-white hover:bg-blue-800">
              Modifier
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecord;