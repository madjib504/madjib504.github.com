import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, Star, Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const PatientDashboard = () => {
  const { user } = useContext(AuthContext);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des rendez-vous');
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
        <div className="grid md:grid-cols-3 gap-6 mb-8">
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
            <CardContent className="p-6 flex items-center justify-center">
              <Link to="/chat" className="w-full">
                <Button className="w-full bg-green-900 text-white hover:bg-green-800 rounded-full py-6" data-testid="go-to-messages-btn">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Mes Messages
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

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
      </div>
    </div>
  );
};

export default PatientDashboard;