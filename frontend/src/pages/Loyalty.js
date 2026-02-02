import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Star, Award } from 'lucide-react';

const Loyalty = () => {
  const { user } = useContext(AuthContext);
  const [loyalty, setLoyalty] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyalty();
    fetchRewards();
  }, []);

  const fetchLoyalty = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/loyalty/points`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLoyalty(response.data);
    } catch (error) {
      console.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const fetchRewards = async () => {
    try {
      const response = await axios.get(`${API}/loyalty/rewards`);
      setRewards(response.data);
    } catch (error) {
      console.error('Erreur');
    }
  };

  const getLevelColor = (level) => {
    const colors = {
      'Bronze': 'bg-amber-700',
      'Argent': 'bg-gray-400',
      'Or': 'bg-yellow-500',
      'Platine': 'bg-purple-600'
    };
    return colors[level] || 'bg-stone-500';
  };

  const getLevelIcon = (level) => {
    const icons = {
      'Bronze': '🥉',
      'Argent': '🥈',
      'Or': '🥇',
      'Platine': '💎'
    };
    return icons[level] || '⭐';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 pt-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div data-testid="loyalty-page" className="min-h-screen bg-gradient-to-br from-stone-50 via-purple-50 to-yellow-50 pt-24 px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-blue-900 mb-2">
            Programme HealthPoints
          </h1>
          <p className="text-lg text-stone-600">Gagnez des points à chaque achat et profitez de récompenses exclusives</p>
        </div>

        <Card className={"mb-8 shadow-xl border-2 " + getLevelColor(loyalty?.level || 'Bronze') + " border-opacity-20"}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="text-6xl">{getLevelIcon(loyalty?.level || 'Bronze')}</div>
                <div>
                  <p className="text-sm text-stone-600">Niveau actuel</p>
                  <h2 className="text-3xl font-bold text-blue-900">{loyalty?.level || 'Bronze'}</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-600">Total de points</p>
                <h2 className="text-4xl font-bold text-blue-900">{loyalty?.total_points || 0}</h2>
                <p className="text-xs text-stone-500 mt-1">1€ dépensé = 10 points</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Bronze (0)</span>
                <span>Argent (1000)</span>
                <span>Or (2000)</span>
                <span>Platine (5000)</span>
              </div>
              <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
                <div 
                  className={getLevelColor(loyalty?.level || 'Bronze') + " h-full transition-all duration-500"}
                  style={{ width: Math.min((loyalty?.total_points || 0) / 5000 * 100, 100) + '%' }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-3xl font-serif font-bold text-blue-900 mb-6">Récompenses Disponibles</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => {
            const canRedeem = (loyalty?.total_points || 0) >= reward.points;
            return (
              <Card key={reward.id} className={"hover:shadow-lg transition-all " + (canRedeem ? 'border-blue-500' : '')}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Gift className={"w-10 h-10 " + (canRedeem ? 'text-blue-600' : 'text-stone-400')} />
                    <Badge className={canRedeem ? 'bg-blue-600' : 'bg-stone-400'}>
                      {reward.points} pts
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 mb-2">{reward.name}</h3>
                  <Button 
                    disabled={!canRedeem}
                    className="w-full mt-4 rounded-full"
                  >
                    {canRedeem ? 'Échanger' : 'Pas assez de points'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-12">
          <CardHeader>
            <CardTitle>Comment ça marche ?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-8 h-8 text-blue-900" />
                </div>
                <h4 className="font-bold mb-2">1. Gagnez des points</h4>
                <p className="text-sm text-stone-600">Chaque euro dépensé = 10 points</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-purple-900" />
                </div>
                <h4 className="font-bold mb-2">2. Montez de niveau</h4>
                <p className="text-sm text-stone-600">Plus de points = meilleurs avantages</p>
              </div>
              <div className="text-center">
                <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-yellow-900" />
                </div>
                <h4 className="font-bold mb-2">3. Profitez !</h4>
                <p className="text-sm text-stone-600">Échangez vos points contre des récompenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Loyalty;
