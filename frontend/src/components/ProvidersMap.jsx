import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { Star, Calendar, MapPin, Crosshair, Loader2 } from 'lucide-react';
import ProviderBadge from '@/components/ProviderBadge';

// --- Fix the default-icon bug in CRA: Leaflet's marker images aren't auto-resolved
//     by Webpack 5. Re-bind them to the public CDN.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --- Two colored icons: doctors (blue) vs partners/structures (green-ish)
const makeIcon = (color) =>
  L.divIcon({
    className: 'kk-marker',
    html: `
      <div style="
        background:${color};
        width:30px;height:30px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;">
        <div style="
          background:white;width:10px;height:10px;border-radius:50%;
          transform:rotate(45deg);"></div>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });

const DOCTOR_ICON = makeIcon('#1d4ed8');     // blue-700
const PARTNER_ICON = makeIcon('#15803d');    // green-700

// User pulsing dot
const USER_ICON = L.divIcon({
  className: 'kk-user-marker',
  html: `
    <div style="position:relative;width:22px;height:22px;">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(37,99,235,.25);
        animation:kkPulse 2s ease-out infinite;"></div>
      <div style="
        position:absolute;left:5px;top:5px;width:12px;height:12px;
        background:#2563eb;border:2px solid white;border-radius:50%;
        box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>
    </div>
    <style>
      @keyframes kkPulse {
        0%   { transform:scale(0.5); opacity:0.9; }
        100% { transform:scale(2.2); opacity:0;   }
      }
    </style>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// --- Auto-fit map to markers + user position when they change
function AutoFitBounds({ points, userPos }) {
  const map = useMap();
  useEffect(() => {
    const all = [...(points || [])];
    if (userPos) all.push(userPos);
    if (all.length === 0) return;
    if (all.length === 1) {
      map.setView(all[0], 14);
      return;
    }
    const bounds = L.latLngBounds(all);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [points, userPos, map]);
  return null;
}

// --- Recenter helper: lets parent imperatively recenter on user
function RecenterOnUser({ userPos }) {
  const map = useMap();
  useEffect(() => {
    if (userPos) map.setView(userPos, 13, { animate: true });
  }, [userPos, map]);
  return null;
}

const ABIDJAN_CENTER = [5.36, -4.0083];

export default function ProvidersMap({
  providers = [],
  height = '60vh',
  userPos = null,
  onLocate,
}) {
  // Filter providers having usable coordinates
  const markers = useMemo(
    () =>
      providers
        .map((p) => {
          const lat = p?.coordinates?.latitude;
          const lng = p?.coordinates?.longitude;
          if (typeof lat !== 'number' || typeof lng !== 'number') return null;
          return { ...p, _lat: lat, _lng: lng };
        })
        .filter(Boolean),
    [providers]
  );

  const points = useMemo(() => markers.map((m) => [m._lat, m._lng]), [markers]);

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);

  const handleLocate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocateError("Votre navigateur ne supporte pas la géolocalisation.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setLocating(false);
        if (onLocate) onLocate(p, pos.coords.accuracy);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === 1
            ? "Autorisez la géolocalisation pour utiliser cette fonction."
            : "Impossible de récupérer votre position. Réessayez."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [onLocate]);

  const containerRef = useRef(null);

  if (markers.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-stone-50 border border-stone-200 rounded-xl text-stone-500 text-sm py-12"
        data-testid="providers-map-empty"
      >
        <MapPin className="w-10 h-10 text-stone-300 mb-2" />
        Aucun fournisseur géolocalisé pour cette recherche.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden border border-stone-200 shadow-sm"
      style={{ height }}
      data-testid="providers-map"
    >
      <MapContainer
        center={ABIDJAN_CENTER}
        zoom={11}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userPos ? <RecenterOnUser userPos={userPos} /> : <AutoFitBounds points={points} userPos={userPos} />}
        {userPos && (
          <>
            <Marker position={userPos} icon={USER_ICON}>
              <Popup>📍 Vous êtes ici</Popup>
            </Marker>
            <Circle
              center={userPos}
              radius={2000}
              pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.07, weight: 1 }}
            />
          </>
        )}
        {markers.map((m) => {
          const isDoctor =
            (m.provider_kind || m.kind || '').toLowerCase() === 'doctor' ||
            !!m.medical_type;
          const icon = isDoctor ? DOCTOR_ICON : PARTNER_ICON;
          const title = m.name || m.company_name || 'Fournisseur';
          const specialty =
            (m.specialties && m.specialties[0]) || m.activity_type || '';
          const place = m.neighborhood || m.city || '';
          const distLabel =
            typeof m._distance_km === 'number'
              ? m._distance_km < 1
                ? `${Math.round(m._distance_km * 1000)} m`
                : `${m._distance_km.toFixed(1)} km`
              : null;
          return (
            <Marker key={m.id} position={[m._lat, m._lng]} icon={icon}>
              <Popup>
                <div className="min-w-[200px]" data-testid={`map-popup-${m.id}`}>
                  <div className="font-semibold text-sm text-stone-900 leading-tight">
                    {title}
                  </div>
                  {m.badges && (
                    <div className="mt-1">
                      <ProviderBadge badges={m.badges} size="xs" sponsored />
                    </div>
                  )}
                  {specialty && (
                    <div className="text-xs text-stone-600 mt-1">
                      {specialty}
                    </div>
                  )}
                  {place && (
                    <div className="flex items-center text-xs text-stone-500 mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {place}
                    </div>
                  )}
                  {distLabel && (
                    <div className="text-xs font-semibold text-blue-700 mt-1">
                      📍 À {distLabel} de vous
                    </div>
                  )}
                  {m.rating > 0 && (
                    <div className="flex items-center text-xs text-stone-500 mt-1">
                      <Star className="w-3 h-3 mr-1 text-yellow-500 fill-yellow-500" />
                      {m.rating.toFixed(1)} ({m.total_reviews || 0})
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Link
                      to={isDoctor ? `/doctor/${m.id}` : `/structures/${m.id}`}
                      className="text-xs px-2 py-1 rounded-md border border-stone-300 text-stone-700 hover:bg-stone-50"
                      data-testid={`map-view-${m.id}`}
                    >
                      Voir
                    </Link>
                    {isDoctor && (
                      <Link
                        to={`/booking/${m.id}`}
                        className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        data-testid={`map-book-${m.id}`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        Rdv
                      </Link>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* "Locate me" floating button — sits on the map overlay */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          data-testid="locate-me-btn"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium shadow-md backdrop-blur-sm transition-colors ${
            locating
              ? 'bg-stone-200/90 text-stone-500 cursor-wait'
              : userPos
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white/95 text-stone-800 hover:bg-white'
          }`}
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
          <span>{userPos ? 'Vous êtes ici' : 'Autour de moi'}</span>
        </button>
        {locateError && (
          <div
            className="max-w-[260px] bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded-md shadow"
            data-testid="locate-error"
          >
            {locateError}
          </div>
        )}
      </div>
    </div>
  );
}
