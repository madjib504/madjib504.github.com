import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, MessageSquare, Star, Clock, MapPin, CheckCircle, XCircle, 
  AlertCircle, CreditCard, Smartphone, TrendingUp, ArrowRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientDashboard = () => {
  const { user } = useContext(AuthContext);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [appointmentsRes, paymentsRes] = await Promise.all([
        axios.get(`${API}/appointments`, { headers }),
        axios.get(`${API}/payments/history`, { headers }).catch(() => ({ data: { payments: [] } }))
      ]);
      
      setAppointments(appointmentsRes.data);
      setPayments(paymentsRes.data.payments || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      confirmed: { label: 'Confirmé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: XCircle },
      completed: { label: 'Terminé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      SUCCESSFUL: { label: 'Confirmé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      FAILED: { label: 'Échoué', color: 'bg-red-100 text-red-800', icon: XCircle },
      CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-800', icon: XCircle }
    };
    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getProviderInfo = (provider) => {
    const providers = {
      orange_money: { name: 'Orange Money', color: 'bg-orange-500' },
      mtn_momo: { name: 'MTN MoMo', color: 'bg-yellow-500' },
      moov: { name: 'Moov Money', color: 'bg-blue-500' }
    };
    return providers[provider] || { name: provider, color: 'bg-gray-500' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount, currency = 'XOF') => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
  };

  // Calculate payment stats
  const totalSpent = payments
    .filter(p => p.status === 'SUCCESSFUL')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
  const successfulPayments = payments.filter(p => p.status === 'SUCCESSFUL').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
          <p className="mt-4 text-stone-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(
    a => a.status !== 'completed' && a.status !== 'cancelled'
  );
  const pastAppointments = appointments.filter(
    a => a.status === 'completed' || a.status === 'cancelled'
  );

  return (
    <div data-testid="patient-dashboard" className="min-h-screen bg-stone-50 pt-24 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-green-900 mb-2" data-testid="dashboard-title">
            Mon Espace Patient
          </h1>
          <p className="text-lg text-stone-600">Bienvenue, {user?.name}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Rendez-vous à venir</p>
                  <p className="text-3xl font-bold text-green-900" data-testid="upcoming-count">{upcomingAppointments.length}</p>
                </div>
                <Calendar className="w-12 h-12 text-green-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Total consultations</p>
                  <p className="text-3xl font-bold text-green-900" data-testid="total-count">{appointments.length}</p>
                </div>
                <Star className="w-12 h-12 text-green-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Paiements réussis</p>
                  <p className="text-3xl font-bold text-green-900" data-testid="payments-count">{successfulPayments}</p>
                </div>
                <CreditCard className="w-12 h-12 text-green-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-stone-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-600 mb-1">Total dépensé</p>
                  <p className="text-2xl font-bold text-green-900" data-testid="total-spent">{formatAmount(totalSpent)}</p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-900 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link to="/chat" className="w-full">
            <Button className="w-full bg-green-900 text-white hover:bg-green-800 rounded-full py-6" data-testid="go-to-messages-btn">
              <MessageSquare className="w-5 h-5 mr-2" />
              Mes Messages
            </Button>
          </Link>
          <Link to="/payment" className="w-full">
            <Button className="w-full bg-orange-500 text-white hover:bg-orange-600 rounded-full py-6" data-testid="go-to-payment-btn">
              <Smartphone className="w-5 h-5 mr-2" />
              Nouveau Paiement
            </Button>
          </Link>
          <Link to="/search" className="w-full">
            <Button variant="outline" className="w-full border-green-900 text-green-900 hover:bg-green-50 rounded-full py-6" data-testid="find-doctor-btn">
              <Star className="w-5 h-5 mr-2" />
              Trouver un médecin
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-6 py-3 rounded-full font-medium transition-colors ${
              activeTab === 'appointments' 
                ? 'bg-green-900 text-white' 
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
            data-testid="tab-appointments"
          >
            <Calendar className="w-4 h-4 inline-block mr-2" />
            Rendez-vous
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-6 py-3 rounded-full font-medium transition-colors ${
              activeTab === 'payments' 
                ? 'bg-green-900 text-white' 
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
            data-testid="tab-payments"
          >
            <CreditCard className="w-4 h-4 inline-block mr-2" />
            Historique Paiements
            {pendingPayments > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingPayments}</Badge>
            )}
          </button>
        </div>

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <>
            {/* Upcoming Appointments */}
            <Card className="shadow-md border-stone-100 mb-8">
              <CardHeader>
                <CardTitle className="text-2xl font-serif text-green-900">Rendez-vous à venir</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-12" data-testid="no-upcoming">
                    <Calendar className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-600 mb-4">Aucun rendez-vous à venir</p>
                    <Link to="/search">
                      <Button className="bg-green-900 text-white hover:bg-green-800 rounded-full">
                        Trouver un médecin
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4" data-testid="upcoming-list">
                    {upcomingAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        data-testid={`appointment-${apt.id}`}
                        className="flex items-center justify-between p-6 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="text-lg font-serif font-bold text-stone-900">
                              Dr. {apt.doctor_info?.name || 'Inconnu'}
                            </h3>
                            {getStatusBadge(apt.status)}
                          </div>
                          {apt.doctor_info?.specialties && (
                            <div className="flex gap-2 mb-2">
                              {apt.doctor_info.specialties.slice(0, 2).map((spec, idx) => (
                                <span key={idx} className="text-sm bg-green-50 text-green-800 px-2 py-1 rounded-full">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-sm text-stone-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(apt.appointment_date).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {apt.appointment_time}
                            </div>
                          </div>
                          {apt.reason && (
                            <p className="text-sm text-stone-600 mt-2">Motif: {apt.reason}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Link to={`/chat/${apt.doctor_info?.user_id || apt.doctor_id}`}>
                            <Button variant="outline" className="border-green-900 text-green-900 hover:bg-green-50 rounded-full" data-testid={`message-btn-${apt.id}`}>
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <Card className="shadow-md border-stone-100">
                <CardHeader>
                  <CardTitle className="text-2xl font-serif text-green-900">Historique</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="past-list">
                    {pastAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        data-testid={`past-appointment-${apt.id}`}
                        className="flex items-center justify-between p-6 bg-stone-50 rounded-xl"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <h3 className="text-lg font-serif font-bold text-stone-900">
                              Dr. {apt.doctor_info?.name || 'Inconnu'}
                            </h3>
                            {getStatusBadge(apt.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-stone-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(apt.appointment_date).toLocaleDateString('fr-FR')}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {apt.appointment_time}
                            </div>
                          </div>
                        </div>
                        {apt.status === 'completed' && (
                          <Link to={`/doctor/${apt.doctor_id}`}>
                            <Button variant="outline" className="border-green-900 text-green-900 hover:bg-green-50 rounded-full">
                              Laisser un avis
                            </Button>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <Card className="shadow-md border-stone-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-2xl font-serif text-green-900">Historique des Paiements</CardTitle>
              <Link to="/payment">
                <Button className="bg-green-900 text-white hover:bg-green-800 rounded-full" data-testid="new-payment-from-history">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Nouveau Paiement
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12" data-testid="no-payments">
                  <CreditCard className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-600 mb-4">Aucun paiement effectué</p>
                  <Link to="/payment">
                    <Button className="bg-orange-500 text-white hover:bg-orange-600 rounded-full">
                      <Smartphone className="w-4 h-4 mr-2" />
                      Effectuer un paiement
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4" data-testid="payments-list">
                  {payments.map((payment, index) => {
                    const providerInfo = getProviderInfo(payment.provider);
                    return (
                      <div
                        key={payment.id || index}
                        data-testid={`payment-${payment.reference_id}`}
                        className="flex items-center justify-between p-6 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 ${providerInfo.color} rounded-full flex items-center justify-center`}>
                            <Smartphone className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-stone-900">{providerInfo.name}</h3>
                              {getPaymentStatusBadge(payment.status)}
                            </div>
                            <p className="text-sm text-stone-600">{payment.description || payment.service_type}</p>
                            <p className="text-xs text-stone-500 mt-1">
                              {formatDate(payment.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${payment.status === 'SUCCESSFUL' ? 'text-green-600' : 'text-stone-900'}`}>
                            {formatAmount(payment.amount, payment.currency)}
                          </p>
                          <p className="text-xs text-stone-500 font-mono">
                            Réf: {payment.reference_id?.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Payment Summary */}
              {payments.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <h4 className="font-semibold text-green-900 mb-3">Résumé</h4>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-stone-600">Total paiements</p>
                      <p className="font-bold text-green-900">{payments.length}</p>
                    </div>
                    <div>
                      <p className="text-stone-600">Paiements réussis</p>
                      <p className="font-bold text-green-600">{successfulPayments}</p>
                    </div>
                    <div>
                      <p className="text-stone-600">Montant total</p>
                      <p className="font-bold text-green-900">{formatAmount(totalSpent)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
