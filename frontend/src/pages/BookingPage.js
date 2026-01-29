import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, Check, 
  User, MapPin, Star, CreditCard, Smartphone
} from 'lucide-react';

const BookingPage = () => {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [doctor, setDoctor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState(1); // 1: date, 2: time, 3: confirm

  useEffect(() => {
    if (doctorId) {
      fetchDoctorAndAvailability();
    }
  }, [doctorId]);

  const fetchDoctorAndAvailability = async () => {
    try {
      const [doctorRes, availRes] = await Promise.all([
        axios.get(`${API}/doctors/${doctorId}`),
        axios.get(`${API}/doctors/${doctorId}/availability`)
      ]);
      setDoctor(doctorRes.data);
      setAvailability(availRes.data.availability || []);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setStep(2);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setStep(3);
  };

  const handleBooking = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour réserver');
      navigate('/login');
      return;
    }

    if (!selectedDate || !selectedTime) {
      toast.error('Veuillez sélectionner une date et un horaire');
      return;
    }

    setBooking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/bookings`,
        {
          doctor_id: doctorId,
          date: selectedDate,
          time: selectedTime,
          reason: reason,
          payment_method: paymentMethod
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Réservation confirmée !');
        navigate('/patient/dashboard');
      }
    } catch (error) {
      console.error('Erreur réservation:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la réservation');
    } finally {
      setBooking(false);
    }
  };

  const getAvailableSlotsForDate = (date) => {
    const dayData = availability.find(a => a.date === date);
    return dayData?.slots?.filter(s => s.available) || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-24 px-4 pb-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-stone-600 hover:text-green-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Retour
          </button>
          <h1 className="text-3xl font-serif font-bold text-green-900">
            Réserver un rendez-vous
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Doctor Info Card */}
          <Card className="md:col-span-1 h-fit">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  {doctor?.profile_image ? (
                    <img src={doctor.profile_image} alt={doctor.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-green-600" />
                  )}
                </div>
                <h2 className="text-xl font-semibold text-stone-900 mb-1">
                  Dr. {doctor?.name}
                </h2>
                <div className="flex flex-wrap justify-center gap-1 mb-3">
                  {doctor?.specialties?.slice(0, 2).map((spec, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
                {doctor?.location && (
                  <p className="text-sm text-stone-500 flex items-center mb-2">
                    <MapPin className="w-4 h-4 mr-1" />
                    {doctor.location}
                  </p>
                )}
                {doctor?.rating > 0 && (
                  <p className="text-sm text-stone-500 flex items-center mb-3">
                    <Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" />
                    {doctor.rating.toFixed(1)} ({doctor.total_reviews} avis)
                  </p>
                )}
                <div className="w-full pt-3 border-t">
                  <p className="text-sm text-stone-600">Consultation</p>
                  <p className="text-2xl font-bold text-green-600">
                    {doctor?.consultation_fee?.toLocaleString() || '0'} XOF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Steps */}
          <div className="md:col-span-2 space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? 'bg-green-600 text-white' : 'bg-stone-200 text-stone-500'
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-12 h-1 mx-1 ${step > s ? 'bg-green-600' : 'bg-stone-200'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Select Date */}
            {step >= 1 && (
              <Card className={step === 1 ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    1. Choisir une date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {availability.map((day) => {
                      const isSelected = selectedDate === day.date;
                      const hasSlots = day.available_count > 0;
                      return (
                        <button
                          key={day.date}
                          onClick={() => hasSlots && handleDateSelect(day.date)}
                          disabled={!hasSlots}
                          className={`p-3 rounded-xl text-center transition-all ${
                            isSelected 
                              ? 'bg-green-600 text-white shadow-lg' 
                              : hasSlots 
                                ? 'bg-white hover:bg-green-50 border border-stone-200' 
                                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          }`}
                          data-testid={`date-${day.date}`}
                        >
                          <p className="text-xs font-medium">{day.day_name?.slice(0, 3)}</p>
                          <p className="text-lg font-bold">
                            {new Date(day.date).getDate()}
                          </p>
                          <p className={`text-xs ${isSelected ? 'text-green-100' : 'text-green-600'}`}>
                            {day.available_count} dispo
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Select Time */}
            {step >= 2 && selectedDate && (
              <Card className={step === 2 ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-600" />
                    2. Choisir un horaire
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {getAvailableSlotsForDate(selectedDate).map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          onClick={() => handleTimeSelect(slot.time)}
                          className={`p-3 rounded-lg text-center transition-all ${
                            isSelected 
                              ? 'bg-green-600 text-white shadow-lg' 
                              : 'bg-white hover:bg-green-50 border border-stone-200'
                          }`}
                          data-testid={`time-${slot.time}`}
                        >
                          <p className="font-medium">{slot.time}</p>
                        </button>
                      );
                    })}
                  </div>
                  {getAvailableSlotsForDate(selectedDate).length === 0 && (
                    <p className="text-center text-stone-500 py-4">
                      Aucun créneau disponible pour cette date
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Confirm */}
            {step >= 3 && selectedTime && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    3. Confirmer la réservation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  <div className="bg-green-50 rounded-xl p-4">
                    <h3 className="font-semibold text-green-900 mb-2">Résumé</h3>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-stone-500">Médecin:</span> Dr. {doctor?.name}</p>
                      <p><span className="text-stone-500">Date:</span> {new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                      <p><span className="text-stone-500">Heure:</span> {selectedTime}</p>
                      <p><span className="text-stone-500">Tarif:</span> <strong>{doctor?.consultation_fee?.toLocaleString() || '0'} XOF</strong></p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motif de consultation (optionnel)</Label>
                    <Input
                      id="reason"
                      placeholder="Décrivez brièvement le motif..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label>Mode de paiement</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'orange_money', name: 'Orange Money', color: 'bg-orange-500' },
                        { id: 'mtn_momo', name: 'MTN MoMo', color: 'bg-yellow-500' },
                        { id: 'moov', name: 'Moov', color: 'bg-blue-500' }
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            paymentMethod === method.id 
                              ? 'border-green-600 bg-green-50' 
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className={`w-8 h-8 ${method.color} rounded-full mx-auto mb-2 flex items-center justify-center`}>
                            <Smartphone className="w-4 h-4 text-white" />
                          </div>
                          <p className="text-xs font-medium">{method.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <Button
                    onClick={handleBooking}
                    disabled={booking}
                    className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
                    data-testid="confirm-booking-btn"
                  >
                    {booking ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Réservation en cours...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <CreditCard className="w-5 h-5 mr-2" />
                        Confirmer et Payer {doctor?.consultation_fee?.toLocaleString() || '0'} XOF
                      </span>
                    )}
                  </Button>

                  <p className="text-xs text-center text-stone-500">
                    En confirmant, vous acceptez nos conditions générales
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
