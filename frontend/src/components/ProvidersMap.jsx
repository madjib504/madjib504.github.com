import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { Star, Calendar, MapPin } from 'lucide-react';

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

// --- Auto-fit map to markers when results change
function AutoFitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [points, map]);
  return null;
}

const ABIDJAN_CENTER = [5.36, -4.0083];

export default function ProvidersMap({ providers = [], height = '60vh' }) {
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
      className="rounded-xl overflow-hidden border border-stone-200 shadow-sm"
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
        <AutoFitBounds points={points} />
        {markers.map((m) => {
          const isDoctor =
            (m.provider_kind || m.kind || '').toLowerCase() === 'doctor' ||
            !!m.medical_type;
          const icon = isDoctor ? DOCTOR_ICON : PARTNER_ICON;
          const title = m.name || m.company_name || 'Fournisseur';
          const specialty =
            (m.specialties && m.specialties[0]) || m.activity_type || '';
          const place = m.neighborhood || m.city || '';
          return (
            <Marker
              key={m.id}
              position={[m._lat, m._lng]}
              icon={icon}
              eventHandlers={{}}
            >
              <Popup>
                <div className="min-w-[200px]" data-testid={`map-popup-${m.id}`}>
                  <div className="font-semibold text-sm text-stone-900 leading-tight">
                    {title}
                  </div>
                  {specialty && (
                    <div className="text-xs text-stone-600 mt-0.5">
                      {specialty}
                    </div>
                  )}
                  {place && (
                    <div className="flex items-center text-xs text-stone-500 mt-1">
                      <MapPin className="w-3 h-3 mr-1" />
                      {place}
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
    </div>
  );
}
