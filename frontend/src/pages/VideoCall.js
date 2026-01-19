import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, AlertCircle } from 'lucide-react';

const VideoCall = () => {
  const { roomId } = useParams();
  const { user } = useContext(AuthContext);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState('connecting');

  useEffect(() => {
    // Simulate connection
    setTimeout(() => {
      setCallStatus('connected');
    }, 2000);
  }, []);

  const handleEndCall = () => {
    window.history.back();
  };

  return (
    <div data-testid="video-call-page" className="min-h-screen bg-stone-900 pt-20 relative">
      <div className="h-[calc(100vh-5rem)] flex items-center justify-center p-6">
        {/* Main Video Area */}
        <div className="w-full max-w-7xl">
          {callStatus === 'connecting' ? (
            <Card className="bg-stone-800 border-stone-700">
              <CardContent className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mb-6"></div>
                <h2 className="text-2xl font-serif font-bold text-white mb-2">Connexion en cours...</h2>
                <p className="text-stone-400">Veuillez patienter</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Video Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Remote Video */}
                <Card className="bg-stone-800 border-stone-700 overflow-hidden aspect-video">
                  <CardContent className="p-0 h-full relative">
                    <div className="w-full h-full bg-gradient-to-br from-green-900 to-sky-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-24 h-24 bg-green-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                          <span className="text-4xl text-white font-bold">D</span>
                        </div>
                        <p className="text-white text-lg font-medium">Médecin</p>
                      </div>
                    </div>
                    <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full">
                      <p className="text-white text-sm">Interlocuteur</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Local Video */}
                <Card className="bg-stone-800 border-stone-700 overflow-hidden aspect-video">
                  <CardContent className="p-0 h-full relative">
                    {isVideoEnabled ? (
                      <div className="w-full h-full bg-gradient-to-br from-sky-900 to-green-900 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-24 h-24 bg-sky-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <span className="text-4xl text-white font-bold">
                              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <p className="text-white text-lg font-medium">{user?.name || 'Vous'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                        <div className="text-center">
                          <VideoOff className="w-16 h-16 text-stone-600 mb-4 mx-auto" />
                          <p className="text-stone-400">Caméra désactivée</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full">
                      <p className="text-white text-sm">Vous</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Banner */}
              <Card className="bg-blue-900/20 border-blue-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400" />
                    <p className="text-blue-200 text-sm">
                      <strong>Note:</strong> Ceci est une interface de démonstration. Pour des appels vidéo fonctionnels, 
                      une intégration WebRTC ou un service tiers (comme Twilio, Agora) serait nécessaire.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Controls */}
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  variant="outline"
                  className={`rounded-full w-14 h-14 p-0 ${
                    isAudioEnabled
                      ? 'bg-stone-700 border-stone-600 hover:bg-stone-600 text-white'
                      : 'bg-red-600 border-red-500 hover:bg-red-700 text-white'
                  }`}
                  data-testid="toggle-audio-btn"
                >
                  {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>

                <Button
                  onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                  variant="outline"
                  className={`rounded-full w-14 h-14 p-0 ${
                    isVideoEnabled
                      ? 'bg-stone-700 border-stone-600 hover:bg-stone-600 text-white'
                      : 'bg-red-600 border-red-500 hover:bg-red-700 text-white'
                  }`}
                  data-testid="toggle-video-btn"
                >
                  {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </Button>

                <Button
                  onClick={handleEndCall}
                  className="rounded-full w-14 h-14 p-0 bg-red-600 hover:bg-red-700 text-white border-0"
                  data-testid="end-call-btn"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCall;