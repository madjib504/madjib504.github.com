import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Download, MessageCircle, ArrowRight } from 'lucide-react';

const BROCHURE_LINK = "https://drive.google.com/file/d/VOTRE_LIEN_ICI/view";
const WHATSAPP_NUMBER = "2250000000000";
const WELCOME_MESSAGE = "Bienvenu sur keneyakafisa !!! Télécharger le catalogue de partenariat";

const WelcomeDoctor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-open WhatsApp with welcome message after 2 seconds
    const timer = setTimeout(() => {
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `${WELCOME_MESSAGE}\n\n📋 Catalogue: ${BROCHURE_LINK}`
      )}`;
      window.open(whatsappUrl, '_blank');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const openWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      `${WELCOME_MESSAGE}\n\n📋 Catalogue: ${BROCHURE_LINK}`
    )}`;
    window.open(whatsappUrl, '_blank');
  };

  const openBrochure = () => {
    window.open(BROCHURE_LINK, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/95 backdrop-blur" data-testid="welcome-doctor-card">
        <CardContent className="p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-blue-900" data-testid="welcome-title">
              Bienvenu sur keneyakafisa !!!
            </h1>
            <p className="text-stone-600">
              Votre inscription en tant que professionnel de santé a été enregistrée avec succès.
            </p>
          </div>

          {/* Brochure Download */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-blue-900">
              Télécharger le catalogue de partenariat
            </p>
            <p className="text-sm text-stone-600">
              Découvrez tous les avantages de rejoindre keneyakafisa
            </p>
            <Button
              onClick={openBrochure}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              data-testid="download-brochure-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger le catalogue
            </Button>
          </div>

          {/* WhatsApp Button */}
          <Button
            onClick={openWhatsApp}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-base"
            data-testid="whatsapp-welcome-btn"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Recevoir sur WhatsApp
          </Button>

          {/* Go to Dashboard */}
          <Button
            onClick={() => navigate('/doctor/dashboard')}
            variant="outline"
            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
            data-testid="go-to-dashboard-btn"
          >
            Accéder à mon tableau de bord
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default WelcomeDoctor;
