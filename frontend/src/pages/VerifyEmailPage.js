import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | already | error
  const [message, setMessage] = useState('');

  const verify = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setMessage('Lien de vérification invalide.');
      return;
    }
    try {
      const res = await axios.get(`${API}/auth/verify-email`, { params: { token } });
      setStatus(res.data.already_verified ? 'already' : 'success');
      setMessage(res.data.message || 'Email vérifié avec succès');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Le lien est invalide ou expiré.');
    }
  }, [token]);

  useEffect(() => {
    verify();
  }, [verify]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6 py-12" data-testid="verify-email-page">
      <Card className="w-full max-w-md shadow-md border-stone-100">
        <CardContent className="p-10 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-blue-900 animate-spin mb-4" />
              <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">Vérification en cours…</h1>
              <p className="text-stone-600">Un instant, nous validons votre email.</p>
            </>
          )}
          {(status === 'success' || status === 'already') && (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" data-testid="verify-success-icon" />
              <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">
                {status === 'already' ? 'Email déjà vérifié' : 'Email vérifié !'}
              </h1>
              <p className="text-stone-600 mb-6">
                {status === 'already'
                  ? 'Votre adresse email était déjà confirmée. Vous pouvez profiter pleinement de keneyakafisa.'
                  : 'Merci ! Votre compte est désormais sécurisé et entièrement activé.'}
              </p>
              <Button
                className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-full"
                onClick={() => navigate('/')}
                data-testid="verify-go-home-btn"
              >
                Aller à l'accueil
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 mx-auto text-red-600 mb-4" data-testid="verify-error-icon" />
              <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">Lien invalide</h1>
              <p className="text-stone-600 mb-6">{message}</p>
              <Link to="/login">
                <Button className="w-full bg-blue-900 hover:bg-blue-800 text-white rounded-full" data-testid="verify-back-login-btn">
                  Se reconnecter
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
