import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Phone, CreditCard, CheckCircle, Clock, XCircle, ArrowLeft, Smartphone } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const MobileMoneyPayment = () => {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentReference, setPaymentReference] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    phone_number: '',
    email: '',
    customer_name: '',
    description: 'Paiement SanaVitaFLOW',
    service_type: 'consultation'
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    let interval;
    if (paymentReference && paymentStatus === 'PENDING') {
      interval = setInterval(() => {
        checkPaymentStatus(paymentReference);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [paymentReference, paymentStatus]);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${API}/payments/providers`);
      setProviders(response.data.providers || []);
    } catch (error) {
      console.error('Erreur chargement providers:', error);
      toast.error('Erreur lors du chargement des fournisseurs');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const initiatePayment = async (e) => {
    e.preventDefault();
    
    if (!selectedProvider) {
      toast.error('Veuillez sélectionner un fournisseur de paiement');
      return;
    }

    if (!formData.amount || !formData.phone_number || !formData.email || !formData.customer_name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/payments/initiate`, {
        provider: selectedProvider,
        amount: parseFloat(formData.amount),
        phone_number: formData.phone_number,
        email: formData.email,
        customer_name: formData.customer_name,
        description: formData.description,
        service_type: formData.service_type
      });

      if (response.data.success) {
        setPaymentReference(response.data.reference_id);
        setPaymentStatus('PENDING');
        toast.success(response.data.message || 'Paiement initié avec succès');
      } else {
        toast.error(response.data.error || 'Erreur lors du paiement');
      }
    } catch (error) {
      console.error('Erreur paiement:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (referenceId) => {
    try {
      const response = await axios.get(`${API}/payments/status/${referenceId}?provider=${selectedProvider}`);
      if (response.data.status !== 'PENDING') {
        setPaymentStatus(response.data.status);
        if (response.data.status === 'SUCCESSFUL') {
          toast.success('Paiement confirmé avec succès!');
        } else if (response.data.status === 'FAILED') {
          toast.error('Le paiement a échoué');
        }
      }
    } catch (error) {
      console.error('Erreur vérification:', error);
    }
  };

  const simulateConfirmation = async () => {
    if (!paymentReference) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/payments/simulate-confirmation/${paymentReference}`);
      if (response.data.success) {
        setPaymentStatus('SUCCESSFUL');
        toast.success('Paiement simulé confirmé!');
      }
    } catch (error) {
      console.error('Erreur simulation:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la simulation');
    } finally {
      setLoading(false);
    }
  };

  const resetPayment = () => {
    setPaymentReference(null);
    setPaymentStatus(null);
    setSelectedProvider(null);
    setFormData({
      amount: '',
      phone_number: '',
      email: '',
      customer_name: '',
      description: 'Paiement SanaVitaFLOW',
      service_type: 'consultation'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case 'SUCCESSFUL':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" /> Confirmé</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Affichage du statut du paiement
  if (paymentReference) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-2">
              {paymentStatus === 'SUCCESSFUL' ? (
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-blue-600" />
                </div>
              ) : paymentStatus === 'FAILED' ? (
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
              ) : (
                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Smartphone className="w-10 h-10 text-yellow-600" />
                </div>
              )}
              <CardTitle className="text-xl">
                {paymentStatus === 'SUCCESSFUL' ? 'Paiement Confirmé' : 
                 paymentStatus === 'FAILED' ? 'Paiement Échoué' : 
                 'Paiement en cours...'}
              </CardTitle>
              <CardDescription>
                {paymentStatus === 'PENDING' && 'Vérifiez votre téléphone pour confirmer le paiement'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Référence</span>
                  <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">{paymentReference.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Montant</span>
                  <span className="font-semibold">{formData.amount} XOF</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fournisseur</span>
                  <span className="capitalize">{selectedProvider?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Statut</span>
                  {getStatusBadge(paymentStatus)}
                </div>
              </div>

              {paymentStatus === 'PENDING' && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Mode Sandbox:</strong> En production, vous recevriez une notification sur votre téléphone pour confirmer le paiement.
                    </p>
                  </div>
                  <Button 
                    onClick={simulateConfirmation} 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    data-testid="simulate-confirm-btn"
                  >
                    {loading ? 'Simulation...' : 'Simuler la Confirmation (Sandbox)'}
                  </Button>
                </div>
              )}

              {paymentStatus === 'SUCCESSFUL' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Votre paiement a été confirmé avec succès. Des points de fidélité ont été ajoutés à votre compte.
                  </p>
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={resetPayment}
                className="w-full"
                data-testid="new-payment-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Nouveau Paiement
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Paiement Mobile Money</h1>
          <p className="text-gray-600">Payez facilement avec votre portefeuille mobile</p>
          <Badge variant="secondary" className="mt-2 bg-orange-100 text-orange-800">
            Mode Sandbox - Tests uniquement
          </Badge>
        </div>

        {/* Sélection du fournisseur */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Choisir un Fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider.id)}
                  className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                    selectedProvider === provider.id 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow'
                  }`}
                  data-testid={`provider-${provider.id}`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Smartphone className="w-6 h-6 text-gray-600" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{provider.name}</h3>
                    <p className="text-xs text-gray-500">{provider.countries?.slice(0, 2).join(', ')}...</p>
                    {selectedProvider === provider.id && (
                      <CheckCircle className="w-5 h-5 text-blue-500 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Formulaire de paiement */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Détails du Paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={initiatePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Nom Complet *</Label>
                  <Input
                    id="customer_name"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    placeholder="Jean Dupont"
                    required
                    data-testid="customer-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="jean@exemple.com"
                    required
                    data-testid="email-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Numéro de Téléphone *</Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    placeholder="+237612345678"
                    required
                    data-testid="phone-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (XOF) *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="100"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="5000"
                    required
                    data-testid="amount-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_type">Type de Service</Label>
                <select
                  id="service_type"
                  name="service_type"
                  value={formData.service_type}
                  onChange={handleInputChange}
                  className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white"
                  data-testid="service-type-select"
                >
                  <option value="consultation">Consultation Médicale</option>
                  <option value="product">Produit Bien-être</option>
                  <option value="equipment">Matériel Médical</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Description du paiement"
                  data-testid="description-input"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Fournisseur sélectionné:</span>
                  <span className="font-semibold capitalize">
                    {selectedProvider ? selectedProvider.replace('_', ' ') : 'Aucun'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-gray-600">Montant à payer:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {formData.amount ? `${formData.amount} XOF` : '0 XOF'}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !selectedProvider}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                data-testid="pay-now-btn"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Traitement en cours...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Payer Maintenant
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Note sur le mode sandbox */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Mode Sandbox</h3>
          <p className="text-sm text-blue-700">
            Cette intégration fonctionne actuellement en mode test. Les paiements sont simulés et aucune transaction réelle nest effectuée. 
            Pour activer les vrais paiements, configurez les clés API des fournisseurs (Orange Money, MTN MoMo, Moov).
          </p>
        </div>
      </div>
    </div>
  );
};

export default MobileMoneyPayment;
