import { useState, useContext } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Mail, X } from 'lucide-react';

const EmailVerificationBanner = () => {
  const { user } = useContext(AuthContext);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/auth/resend-verification`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Email de vérification renvoyé. Vérifiez votre boîte de réception.');
    } catch {
      toast.error("Impossible d'envoyer l'email. Réessayez plus tard.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
      data-testid="email-verification-banner"
    >
      <div className="flex items-center gap-2 text-amber-900 text-sm flex-1 min-w-0">
        <Mail className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          Vérifiez votre adresse email <strong className="font-semibold">{user.email}</strong> pour sécuriser votre compte.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="text-amber-900 underline hover:text-amber-700 text-sm font-medium disabled:opacity-50"
          data-testid="resend-verification-btn"
        >
          {sending ? 'Envoi…' : "Renvoyer l'email"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-700 hover:text-amber-900"
          aria-label="Fermer"
          data-testid="dismiss-verification-banner-btn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
