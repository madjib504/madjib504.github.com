import { AlertTriangle, Phone, Shield } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div
      data-testid="maintenance-page"
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 relative overflow-hidden"
    >
      {/* Decorative pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative max-w-2xl w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-white flex-shrink-0" />
          <h1 className="text-xl md:text-2xl font-bold text-white">Maintenance en cours</h1>
        </div>

        <div className="p-8 md:p-10">
          <p className="text-lg text-stone-800 mb-6 leading-relaxed">
            Notre plateforme est <strong>temporairement inaccessible</strong> suite à un incident de sécurité.
            Nos équipes travaillent activement pour rétablir le service.
          </p>

          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
            <Shield className="w-6 h-6 text-green-700 flex-shrink-0 mt-0.5" />
            <p className="text-green-900 text-sm leading-relaxed">
              <strong>Vos données personnelles et médicales sont en sécurité.</strong> Aucune donnée n'a été compromise.
              Nous vous remercions de votre compréhension.
            </p>
          </div>

          <div className="bg-stone-50 rounded-xl p-5 border border-stone-200">
            <p className="text-stone-700 text-sm mb-3">Pour toute urgence, contactez-nous :</p>
            <a
              href="tel:+2250777154048"
              data-testid="maintenance-phone-link"
              className="inline-flex items-center gap-2 text-blue-900 font-semibold text-lg hover:text-blue-700 transition-colors"
            >
              <Phone className="w-5 h-5" />
              +225 07 77 15 40 48
            </a>
          </div>

          <p className="text-stone-600 text-sm mt-6 text-center">
            Merci de votre patience.
          </p>
          <p className="text-stone-900 font-serif font-semibold text-center mt-1">
            — L'équipe keneyakafisa
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
