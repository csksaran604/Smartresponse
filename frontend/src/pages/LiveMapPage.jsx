import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  RefreshCw,
  Info,
  Navigation,
  Crosshair,
  AlertTriangle,
  Ambulance,
  Shield,
  Flame,
  CheckCircle2,
  PhoneCall,
  MapPin,
  ExternalLink,
  ChevronRight,
  Send,
  X,
  Radio,
  Layers,
  Compass,
  Camera,
  Clock,
  Bell
} from 'lucide-react';
import { accidentsApi, unitsApi } from '../services/api';
import { broadcastEmergencySos, subscribeToEmergencyAlerts } from '../services/realtimeEmergency';
import { SeverityBadge } from '../components/SeverityBadge';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatTime } from '../utils/dateUtils';

// Google Maps Tile Layer Configurations
const GOOGLE_MAP_STYLES = {
  roadmap: {
    id: 'roadmap',
    name: 'Google Map (Default)',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
  satellite: {
    id: 'satellite',
    name: 'Google Satellite (Hybrid)',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
  traffic: {
    id: 'traffic',
    name: 'Google Live Traffic',
    url: 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
  terrain: {
    id: 'terrain',
    name: 'Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  },
};

// Helper to calculate distance in km using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
};

// Google Maps style pulsating Blue Location Dot
const createGoogleUserLocationIcon = () => {
  return L.divIcon({
    className: 'google-user-live-pin',
    html: `
      <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
        <div class="animate-user-location" style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(66, 133, 244, 0.45);"></div>
        <div style="
          position: relative;
          z-index: 10;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1a73e8;
          border: 3.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// Helper for Incident / Unit icons
const createCustomIcon = (color, text, isUnit = false) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        border-radius: ${isUnit ? '6px' : '50%'};
        width: ${isUnit ? '32px' : '28px'};
        height: ${isUnit ? '28px' : '28px'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
      ">
        ${text}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
};

// Global memoized icon cache to prevent Leaflet from re-instantiating icons on every frame
const iconCache = {};
const getCachedIcon = (color, text, isUnit = false) => {
  const key = `${color}_${text}_${isUnit}`;
  if (!iconCache[key]) {
    iconCache[key] = createCustomIcon(color, text, isUnit);
  }
  return iconCache[key];
};

let cachedUserLocationIcon = null;
const getUserLocationIcon = () => {
  if (!cachedUserLocationIcon) {
    cachedUserLocationIcon = createGoogleUserLocationIcon();
  }
  return cachedUserLocationIcon;
};

const SEVERITY_PIN_COLORS = {
  Critical: '#ea4335', // Google Red
  High: '#fa7b17',     // Google Orange
  Medium: '#fbbc04',   // Google Yellow
  Low: '#34a853',      // Google Green
};

const UNIT_PIN_COLORS = {
  Ambulance: '#1a73e8', // Google Blue
  Police: '#185abc',    // Dark Blue
  'Fire & Rescue': '#d93025', // Deep Red
};

// Map controller component for smooth, non-laggy camera centering
function MapController({ targetCenter, targetZoom }) {
  const map = useMap();
  const lastCenterRef = useRef(null);

  useEffect(() => {
    if (!targetCenter || !targetCenter[0] || !targetCenter[1]) return;
    const [lat, lng] = targetCenter;
    const last = lastCenterRef.current;

    // Only update camera if coordinates moved meaningfully to avoid continuous re-rendering lag
    if (!last || Math.abs(last[0] - lat) > 0.001 || Math.abs(last[1] - lng) > 0.001) {
      lastCenterRef.current = [lat, lng];
      map.setView([lat, lng], targetZoom || map.getZoom());
    }
  }, [targetCenter, targetZoom, map]);

  return null;
}

export const LiveMapPage = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [units, setUnits] = useState([]);
  const [_loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterUnitType, setFilterUnitType] = useState('');
  const [showOnlyVerified, setShowOnlyVerified] = useState(false);

  // Google Maps Style state: roadmap (default), satellite, traffic, terrain
  const [googleStyle, setGoogleStyle] = useState('roadmap');
  // View mode: 'interactive' (Leaflet with Google Tiles) or 'nativeEmbed' (Official Google Maps Iframe)
  const [viewMode, setViewMode] = useState('interactive');

  // User Live GPS Location State: initialize from cached GPS if available
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const lastLat = localStorage.getItem('ser_user_last_lat');
      const lastLng = localStorage.getItem('ser_user_last_lng');
      if (lastLat && lastLng) {
        return {
          lat: parseFloat(lastLat),
          lng: parseFloat(lastLng),
          accuracy: 20,
          address: 'Live Responder Location',
          timestamp: new Date(),
        };
      }
    } catch {}
    return null;
  });
  const [gpsError, setGpsError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapCenter, setMapCenter] = useState(() => {
    try {
      const lastLat = localStorage.getItem('ser_user_last_lat');
      const lastLng = localStorage.getItem('ser_user_last_lng');
      if (lastLat && lastLng) {
        return [parseFloat(lastLat), parseFloat(lastLng)];
      }
    } catch {}
    return [11.3410, 77.7172];
  });
  const [mapZoom, setMapZoom] = useState(14);
  const watchIdRef = useRef(null);
  const mapCenterRef = useRef(mapCenter);
  const lastAutoRoutedKeyRef = useRef('');

  useEffect(() => {
    mapCenterRef.current = mapCenter;
  }, [mapCenter]);

  // Quick SOS / Report Incident Modal State
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [sosType, setSosType] = useState('Medical');
  const [sosSeverity, setSosSeverity] = useState('Critical');
  const [sosDescription, setSosDescription] = useState('');
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(null);
  const [spawningUnits, setSpawningUnits] = useState(false);

  // Routing and Emergency Navigation State
  const [searchParams] = useSearchParams();
  const [activeRoute, setActiveRoute] = useState(null);
  const [isRouting, setIsRouting] = useState(false);

  // Fetch Incidents and Units from API
  const fetchData = useCallback(async () => {
    try {
      const [incRes, unitRes] = await Promise.all([
        accidentsApi.getAccidents({ per_page: 100 }),
        unitsApi.getUnits(),
      ]);
      setIncidents(incRes.data.accidents || []);
      setUnits(unitRes.data.units || []);
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reverse Geocoding via Nominatim
  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    }
    return `GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  };

  // Obtain User Live Location
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);

        const newLoc = {
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          address,
          heading: heading || null,
          speed: speed ? Math.round(speed * 3.6) : null,
          timestamp: new Date(pos.timestamp),
        };

        setUserLocation(newLoc);
        try {
          localStorage.setItem('ser_user_last_lat', String(latitude));
          localStorage.setItem('ser_user_last_lng', String(longitude));
        } catch {}
        setMapCenter([latitude, longitude]);
        setMapZoom(16);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Location error:', err);
        setGpsError('Could not acquire your precise GPS fix. Using emergency operations coordinates.');
        setIsLocating(false);
        const cachedLat = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lat') : null;
        const cachedLng = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lng') : null;
        const fallbackLat = cachedLat ? parseFloat(cachedLat) : 11.3410;
        const fallbackLng = cachedLng ? parseFloat(cachedLng) : 77.7172;
        setUserLocation({
          lat: fallbackLat,
          lng: fallbackLng,
          accuracy: 50,
          address: 'Emergency Dispatch Hub',
          heading: null,
          speed: null,
          timestamp: new Date(),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  }, []);

  // Initialize and watch live position
  useEffect(() => {
    fetchData();
    locateUser();

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          setUserLocation((prev) => ({
            ...prev,
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            timestamp: new Date(pos.timestamp),
          }));
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000 }
      );
    }

    const interval = setInterval(fetchData, 20000);
    return () => {
      clearInterval(interval);
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [fetchData, locateUser]);

  // Routing Function: Fetch High-Accuracy Driving Route from Responder/User to Destination
  const calculateRouteTo = useCallback(async (destLat, destLng, incidentLabel = 'Accident Scene', forcedStartLat = null, forcedStartLng = null) => {
    const startLat = forcedStartLat ?? (userLocation?.lat || mapCenterRef.current[0]);
    const startLng = forcedStartLng ?? (userLocation?.lng || mapCenterRef.current[1]);
    setIsRouting(true);

    const directDist = calculateDistance(startLat, startLng, destLat, destLng);
    const directDuration = directDist ? Math.max(1, Math.round((parseFloat(directDist) / 35) * 60)) : 5;

    let routePositions = null;
    let distanceKm = directDist;
    let durationMins = directDuration;

    // 1. Primary High-Precision Driving Route Engine (OSRM)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          routePositions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          distanceKm = (route.distance / 1000).toFixed(1);
          durationMins = Math.max(1, Math.round(route.duration / 60));
        }
      }
    } catch (err) {
      console.warn('Primary route fetch error:', err);
    }

    // 2. Secondary High-Precision Driving Route Engine (OpenStreetMap.de)
    if (!routePositions || routePositions.length === 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const backupUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const res = await fetch(backupUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            routePositions = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            distanceKm = (route.distance / 1000).toFixed(1);
            durationMins = Math.max(1, Math.round(route.duration / 60));
          }
        }
      } catch (err) {
        console.warn('Backup route fetch error:', err);
      }
    }

    // 3. Fallback Smooth Interpolation if servers are temporarily unreachable
    if (!routePositions || routePositions.length === 0) {
      const steps = 6;
      routePositions = [];
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        routePositions.push([
          startLat + (destLat - startLat) * ratio,
          startLng + (destLng - startLng) * ratio,
        ]);
      }
    }

    setActiveRoute({
      destination: [destLat, destLng],
      origin: [startLat, startLng],
      label: incidentLabel,
      distanceKm,
      durationMins,
      positions: routePositions,
    });

    const midLat = (startLat + destLat) / 2;
    const midLng = (startLng + destLng) / 2;
    setMapCenter([midLat, midLng]);
    const numDist = parseFloat(distanceKm);
    if (!isNaN(numDist)) {
      if (numDist < 0.5) setMapZoom(17);
      else if (numDist < 2.0) setMapZoom(16);
      else if (numDist < 6.0) setMapZoom(15);
      else if (numDist < 15.0) setMapZoom(14);
      else setMapZoom(12);
    }
    setIsRouting(false);
  }, [userLocation]);

  const focusLatParam = searchParams.get('focusLat');
  const focusLngParam = searchParams.get('focusLng');
  const routeParam = searchParams.get('route');

  // Determine ONLY the current active accident (priority: URL params > active localStorage SOS > latest incident)
  const currentAccident = React.useMemo(() => {
    if (focusLatParam && focusLngParam) {
      const fLat = parseFloat(focusLatParam);
      const fLng = parseFloat(focusLngParam);
      const found = incidents.find(
        (i) => Math.abs(i.latitude - fLat) < 0.005 && Math.abs(i.longitude - fLng) < 0.005
      );
      if (found) return found;
      let sosData = {};
      try {
        const saved = localStorage.getItem('ser_active_sos');
        if (saved) sosData = JSON.parse(saved) || {};
      } catch {}
      return {
        id: sosData.id || 'active-sos-target',
        incident_id: sosData.id || 'SOS-LIVE-ALERT',
        latitude: fLat,
        longitude: fLng,
        address: sosData.address || 'Citizen Emergency SOS Location',
        severity: sosData.urgency || sosData.severity || 'Critical',
        type: sosData.type || sosData.emergencyType || 'Medical',
        phone: sosData.phone || sosData.reporter_phone,
        photo: sosData.photo,
        response_status: 'Active',
        date_time: sosData.timestamp || new Date().toISOString(),
      };
    }

    try {
      const saved = localStorage.getItem('ser_active_sos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.latitude && parsed?.longitude) {
          const fLat = parseFloat(parsed.latitude);
          const fLng = parseFloat(parsed.longitude);
          const found = incidents.find(
            (i) => Math.abs(i.latitude - fLat) < 0.005 && Math.abs(i.longitude - fLng) < 0.005
          );
          if (found) return found;
          return {
            id: parsed.id || 'ser-live-sos',
            incident_id: parsed.id || 'CITIZEN-SOS',
            latitude: fLat,
            longitude: fLng,
            address: parsed.address || 'Citizen Distress Location',
            severity: parsed.severity || 'Critical',
            type: parsed.type || parsed.emergencyType || 'Medical',
            phone: parsed.reporter_phone || parsed.phone,
            photo: parsed.photo,
            response_status: 'Active',
            date_time: parsed.timestamp || new Date().toISOString(),
          };
        }
      }
    } catch {}

    if (incidents.length > 0) {
      return incidents[0];
    }
    return null;
  }, [focusLatParam, focusLngParam, incidents]);

  // Handle URL Query Params and Auto-route to current accident with live GPS position
  useEffect(() => {
    if (currentAccident?.latitude && currentAccident?.longitude) {
      const lat = Number(currentAccident.latitude);
      const lng = Number(currentAccident.longitude);
      const uLat = userLocation?.lat ? userLocation.lat.toFixed(4) : '';
      const uLng = userLocation?.lng ? userLocation.lng.toFixed(4) : '';
      const routeKey = `${currentAccident.id || currentAccident.incident_id}_${lat.toFixed(4)}_${lng.toFixed(4)}_from_${uLat}_${uLng}`;
      if (!isNaN(lat) && !isNaN(lng) && lastAutoRoutedKeyRef.current !== routeKey) {
        lastAutoRoutedKeyRef.current = routeKey;
        calculateRouteTo(lat, lng, currentAccident.incident_id || 'Active Emergency Scene');
      }
    }
  }, [currentAccident, calculateRouteTo, userLocation]);

  // Live incoming emergency SOS listener for real-time dispatch map centering
  useEffect(() => {
    const handleIncomingSos = (alert) => {
      if (!alert || !alert.latitude || !alert.longitude) return;
      const lat = Number(alert.latitude);
      const lng = Number(alert.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const newInc = {
        id: alert.id,
        incident_id: alert.id,
        latitude: lat,
        longitude: lng,
        address: alert.address || 'Citizen Emergency SOS Location',
        severity: alert.urgency || 'Critical',
        type: alert.type || alert.emergencyType || 'Medical',
        emergency_type: alert.type || alert.emergencyType || 'Medical',
        phone: alert.phone || alert.reporter_phone,
        phone_number: alert.phone || alert.reporter_phone,
        reporter: `Citizen (${alert.phone || 'Emergency'})`,
        photo: alert.photo,
        response_status: 'Active',
        date_time: alert.timestamp || new Date().toISOString(),
      };

      setIncidents((prev) => {
        if (prev.some((i) => String(i.id) === String(alert.id) || String(i.incident_id) === String(alert.id))) {
          return prev;
        }
        return [newInc, ...prev];
      });

      setMapCenter([lat, lng]);
      setMapZoom(16);
      calculateRouteTo(lat, lng, alert.id);
    };

    const unsubscribe = subscribeToEmergencyAlerts(handleIncomingSos);
    const handleCustomEvent = (e) => {
      if (e.detail) handleIncomingSos(e.detail);
    };
    window.addEventListener('ser_emergency_sos', handleCustomEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('ser_emergency_sos', handleCustomEvent);
    };
  }, [calculateRouteTo]);

  // Spawn Demo Units Near User's Real Coordinates
  const spawnDemoUnitsNearMe = async () => {
    if (!userLocation) return;
    setSpawningUnits(true);
    try {
      const demoTemplates = [
        {
          unit_id: `AMB-108-${Math.floor(100 + Math.random() * 900)}`,
          vehicle_number: `TN-01-EMG-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'Ambulance',
          driver_name: '108 Rapid Ambulance Officer',
          contact_number: '108',
          status: 'Available',
          latitude: userLocation.lat + 0.007,
          longitude: userLocation.lng + 0.006,
        },
        {
          unit_id: `POL-CITY-${Math.floor(100 + Math.random() * 900)}`,
          vehicle_number: `TN-01-POL-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'Police',
          driver_name: 'City Patrol Inspector',
          contact_number: '112',
          status: 'Available',
          latitude: userLocation.lat - 0.006,
          longitude: userLocation.lng - 0.005,
        },
        {
          unit_id: `FIRE-RES-${Math.floor(100 + Math.random() * 900)}`,
          vehicle_number: `TN-01-FIR-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'Fire & Rescue',
          driver_name: 'Fire Station Crew',
          contact_number: '101',
          status: 'Available',
          latitude: userLocation.lat + 0.005,
          longitude: userLocation.lng - 0.008,
        },
      ];

      for (const unitData of demoTemplates) {
        await unitsApi.createUnit(unitData);
      }
      await fetchData();
    } catch (e) {
      console.error('Failed to spawn nearby units:', e);
    } finally {
      setSpawningUnits(false);
    }
  };

  // Quick SOS / Incident Submission Handler
  const handleQuickSosSubmit = async (e) => {
    e.preventDefault();
    if (!userLocation) {
      alert('Please allow location access to dispatch emergency services to your location.');
      return;
    }

    setSosSubmitting(true);
    try {
      const typeTitles = {
        Medical: '🚨 Medical Emergency / 108 Ambulance Request',
        Traffic: '🚗 Road Traffic Collision / Accident',
        Fire: '🚒 Fire Emergency / Hazardous Situation',
        Police: '👮 Public Safety / Police Incident',
      };

      const title = typeTitles[sosType] || 'Emergency SOS Request';
      const desc = sosDescription
        ? `${title}: ${sosDescription}`
        : `${title} reported at live citizen Google Maps coordinates.`;

      const payload = {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        address: userLocation.address || `GPS: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`,
        description: desc,
        severity: sosSeverity,
        emergency_type: sosType,
        type: sosType,
        reporter: user?.full_name || 'Citizen User',
        phone: typeof window !== 'undefined' ? localStorage.getItem('ser_user_phone') || '' : '',
        ai_confidence: 96.0,
      };

      await broadcastEmergencySos({
        type: sosType,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        address: payload.address,
        notes: payload.description,
        phone: payload.phone,
        urgency: sosSeverity,
      }).catch(() => {});

      const res = await accidentsApi.createAccident(payload);
      setSosSuccess(res.data.accident);
      setSosDescription('');
      fetchData();
    } catch (err) {
      console.error('Failed to report incident:', err);
      alert('Failed to transmit emergency request. Please dial 108 or 112 directly.');
    } finally {
      setSosSubmitting(false);
    }
  };

  // Filter incidents & units
  const filteredIncidents = incidents.filter((i) => {
    if (showOnlyVerified && i.verification_status !== 'Verified') return false;
    if (filterSeverity && i.severity !== filterSeverity) return false;
    return true;
  });

  const filteredUnits = units.filter((u) => {
    if (filterUnitType && u.type !== filterUnitType) return false;
    return true;
  });

  // Calculate nearest emergency unit from user's live position
  const unitsWithDistance = units
    .map((u) => {
      const dist = userLocation
        ? parseFloat(calculateDistance(userLocation.lat, userLocation.lng, u.latitude, u.longitude))
        : null;
      return { ...u, distanceKm: dist };
    })
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));

  const nearestUnit = unitsWithDistance.length > 0 && unitsWithDistance[0].distanceKm !== null
    ? unitsWithDistance[0]
    : null;

  const hasUnitsNearUser = nearestUnit && nearestUnit.distanceKm < 50;

  // Active Google tile configuration
  const activeTile = GOOGLE_MAP_STYLES[googleStyle] || GOOGLE_MAP_STYLES.roadmap;

  // Direct Google Maps web link for user's live location
  const googleMapsWebUrl = userLocation
    ? `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`
    : `https://www.google.com/maps?q=13.0827,80.2707`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span className="text-sky-400">Google Maps</span> Live Tracking
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              GPS CONNECTED
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real Google Maps rendering with live citizen location, nearby emergency services, and instant SOS dispatch
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* External Google Maps Button */}
          {userLocation && (
            <a
              href={googleMapsWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
              title="Open your location in Google Maps website or app"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Open in Google Maps App</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}

          <button
            onClick={locateUser}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-xs font-semibold text-sky-300 border border-sky-500/30 transition-all"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Detecting GPS...' : 'My Location'}</span>
          </button>

          <Link
            to="/alerts"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-300 border border-slate-700 transition-all font-mono"
            title="Go to Emergency Alerts"
          >
            <Bell className="w-3.5 h-3.5 text-rose-400" />
            <span>Alerts</span>
          </Link>

          <button
            onClick={() => {
              setSosSuccess(null);
              setIsSosModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition-all active:scale-95 animate-pulse"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>🚨 Quick SOS Help</span>
          </button>
        </div>
      </div>

      {/* User Location Info Bar */}
      {userLocation ? (
        <div className="glass-panel p-3.5 rounded-xl border border-sky-500/30 bg-sky-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0 text-sky-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono">
                <strong className="text-white font-semibold">📍 Your Live Position:</strong>
                <span className="text-sky-300 font-mono">
                  {userLocation.lat.toFixed(5)}° N, {userLocation.lng.toFixed(5)}° E
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-900/50 text-sky-300 border border-sky-700/50">
                  ± {userLocation.accuracy}m GPS Accuracy
                </span>
              </div>
              <p className="text-slate-300 mt-0.5 line-clamp-1">{userLocation.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {nearestUnit ? (
              <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-[11px] text-slate-300 flex items-center gap-2">
                <span className="text-slate-400">Nearest Unit:</span>
                <strong className="text-sky-400">{nearestUnit.unit_id}</strong>
                <span className="text-emerald-400 font-bold">({nearestUnit.distanceKm} km away)</span>
              </div>
            ) : null}

            {!hasUnitsNearUser && (
              <button
                onClick={spawnDemoUnitsNearMe}
                disabled={spawningUnits}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-300 transition-all flex items-center gap-1.5"
                title="Create 3 local ambulances/patrol cars in your city"
              >
                <Ambulance className="w-3.5 h-3.5" />
                <span>{spawningUnits ? 'Deploying...' : 'Deploy Units Near Me'}</span>
              </button>
            )}
          </div>
        </div>
      ) : gpsError ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button
            onClick={locateUser}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-bold border border-amber-500/30 text-amber-300"
          >
            Retry GPS
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-400 animate-spin" />
            <span>Detecting your browser GPS location... Please allow location permission if prompted.</span>
          </div>
        </div>
      )}

      {/* Google Map Mode Bar & Layer Switcher */}
      <div className="glass-panel p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Google Map Layer Switcher (Roads, Satellite, Traffic, Terrain) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Google Layer:
          </span>
          {Object.entries(GOOGLE_MAP_STYLES).map(([key, style]) => (
            <button
              key={key}
              onClick={() => {
                setGoogleStyle(key);
                setViewMode('interactive');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'interactive' && googleStyle === key
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {style.name}
            </button>
          ))}

          {/* Native Embed View Switcher */}
          <button
            onClick={() => setViewMode(viewMode === 'nativeEmbed' ? 'interactive' : 'nativeEmbed')}
            className={`ml-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              viewMode === 'nativeEmbed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Official Google Embed</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
          >
            <option value="">All Incidents</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>

          <select
            value={filterUnitType}
            onChange={(e) => setFilterUnitType(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
          >
            <option value="">All Emergency Units</option>
            <option value="Ambulance">Ambulances (108)</option>
            <option value="Police">Police Patrol</option>
            <option value="Fire & Rescue">Fire & Rescue</option>
          </select>

          <button
            onClick={fetchData}
            className="px-2 py-1 rounded-lg bg-slate-850 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Main Map Box */}
      {viewMode === 'nativeEmbed' ? (
        /* Native Google Maps Embed Iframe */
        <div className="glass-panel p-2 rounded-2xl border border-slate-800 h-[620px] overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-xs font-mono text-slate-200 backdrop-blur-md">
            🌐 Native Google Maps Embed &bull; Lat: {userLocation ? userLocation.lat.toFixed(4) : mapCenter[0].toFixed(4)}, Lng: {userLocation ? userLocation.lng.toFixed(4) : mapCenter[1].toFixed(4)}
          </div>
          <iframe
            title="Google Map Live Location"
            width="100%"
            height="100%"
            style={{ border: 0, borderRadius: '0.75rem' }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?q=${userLocation ? userLocation.lat : mapCenter[0]},${userLocation ? userLocation.lng : mapCenter[1]}&z=15&output=embed`}
          />
        </div>
      ) : (
        /* Interactive Google Maps Layer with Live Pins, Real-time GPS, & Dispatch Units */
        <div className="glass-panel p-2 rounded-2xl border border-slate-800 h-[620px] overflow-hidden shadow-2xl relative" style={{ isolation: 'isolate' }}>
          {/* Active Navigation Route HUD */}
          {activeRoute && (
            <div className="absolute top-4 left-4 z-[500] max-w-sm rounded-2xl bg-slate-900/95 border-2 border-sky-500 shadow-2xl p-3 text-white font-sans backdrop-blur-md animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-400 animate-pulse" />
                  <span className="text-xs font-bold font-mono uppercase text-sky-300">
                    Active Road Route
                  </span>
                </div>
                <button
                  onClick={() => setActiveRoute(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Clear Route"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="py-2 space-y-1 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Target:</span>
                  <span className="font-bold text-white truncate max-w-[170px]">{activeRoute.label}</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Road Distance:</span>
                  <span className="font-bold text-sky-400">{activeRoute.distanceKm} km</span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Estimated Drive:</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{activeRoute.durationMins} mins
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-sky-400 font-bold flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  Live Route Active
                </span>
                <button
                  onClick={() => setActiveRoute(null)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] transition-colors"
                >
                  Clear Route
                </button>
              </div>
            </div>
          )}

          {/* Floating Target and SOS Buttons on Map */}
          <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
            {userLocation && (
              <button
                onClick={() => {
                  setMapCenter([userLocation.lat, userLocation.lng]);
                  setMapZoom(16);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-white font-mono text-xs border border-slate-700 shadow-xl flex items-center gap-2 backdrop-blur-md transition-all active:scale-95"
                title="Target and center on my location"
              >
                <Navigation className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Center On Me</span>
              </button>
            )}

            <button
              onClick={() => {
                setSosSuccess(null);
                setIsSosModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xl flex items-center gap-2 backdrop-blur-md transition-all active:scale-95"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Report SOS Here</span>
            </button>
          </div>

          {/* Floating Google Maps Brand Badge */}
          <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
            <div className="px-2.5 py-1 rounded-md bg-white/90 shadow text-[11px] font-bold text-slate-800 flex items-center gap-1.5 font-sans">
              <span className="text-[#4285F4]">G</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">o</span>
              <span className="text-[#4285F4]">g</span>
              <span className="text-[#34A853]">l</span>
              <span className="text-[#EA4335]">e</span>
              <span className="text-slate-600 font-medium">Maps &bull; {activeTile.name}</span>
            </div>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <MapController targetCenter={mapCenter} targetZoom={mapZoom} />

            {/* Authentic Google Maps Tile Layer */}
            <TileLayer
              key={googleStyle}
              attribution={activeTile.attribution}
              url={activeTile.url}
              subdomains={activeTile.subdomains}
              maxZoom={activeTile.maxZoom}
            />

            {/* Active Navigation Route Polyline */}
            {activeRoute && activeRoute.positions && (
              <>
                <Polyline
                  positions={activeRoute.positions}
                  pathOptions={{
                    color: '#0369a1',
                    weight: 8,
                    opacity: 0.5,
                  }}
                />
                <Polyline
                  positions={activeRoute.positions}
                  pathOptions={{
                    color: '#38bdf8',
                    weight: 5,
                    opacity: 0.95,
                    dashArray: isRouting ? '8, 8' : undefined,
                  }}
                />
              </>
            )}

            {/* User's Live GPS Location Marker (Google Style Blue Pin) & Accuracy Circle */}
            {userLocation && (
              <>
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={Math.max(userLocation.accuracy, 20)}
                  pathOptions={{
                    color: '#1a73e8',
                    fillColor: '#1a73e8',
                    fillOpacity: 0.16,
                    weight: 1.5,
                  }}
                />
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={getUserLocationIcon()}
                >
                  <Popup>
                    <div className="space-y-2 font-sans p-1 text-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-sky-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          You Are Here (Google GPS)
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-mono text-[10px]">
                          ±{userLocation.accuracy}m
                        </span>
                      </div>

                      <p className="text-slate-200 font-medium">{userLocation.address}</p>

                      <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                        <p>Lat: {userLocation.lat.toFixed(6)}</p>
                        <p>Lng: {userLocation.lng.toFixed(6)}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                        <button
                          onClick={() => {
                            setSosSuccess(null);
                            setIsSosModalOpen(true);
                          }}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          <span>Request SOS At This Location</span>
                        </button>

                        <a
                          href={googleMapsWebUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open in Official Google Maps</span>
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* Current Active Accident Marker ONLY */}
            {currentAccident && currentAccident.latitude && currentAccident.longitude && (() => {
              const color = SEVERITY_PIN_COLORS[currentAccident.severity] || '#ea4335';
              const icon = getCachedIcon(color, '!', false);
              const distFromUser = userLocation
                ? calculateDistance(userLocation.lat, userLocation.lng, currentAccident.latitude, currentAccident.longitude)
                : null;
              const gmapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${currentAccident.latitude},${currentAccident.longitude}`;

              return (
                <Marker
                  key={`current-accident-${currentAccident.id || 'live-pin'}`}
                  position={[Number(currentAccident.latitude), Number(currentAccident.longitude)]}
                  icon={icon}
                >
                  <Popup>
                    <div className="space-y-2 font-sans p-1 text-xs min-w-[210px]">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                        <span className="font-mono font-bold text-rose-400">
                          {currentAccident.incident_id || 'Active Accident Scene'}
                        </span>
                        <SeverityBadge severity={currentAccident.severity || 'Critical'} />
                      </div>

                      <p className="text-slate-200 font-medium">{currentAccident.address}</p>

                      {currentAccident.photo && (
                        <div className="rounded-lg overflow-hidden border border-emerald-500/50 my-1.5 max-h-32 bg-black">
                          <img
                            src={currentAccident.photo}
                            alt="Accident scene photo"
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                        {distFromUser && (
                          <p className="text-amber-300 font-semibold">Distance from you: {distFromUser} km</p>
                        )}
                        <p>Time: {formatDateTime(currentAccident.date_time || currentAccident.created_at)}</p>
                        {currentAccident.phone && (
                          <p className="text-emerald-400 font-bold">Contact: {currentAccident.phone}</p>
                        )}
                        <p>Status: {currentAccident.response_status || 'Dispatched'}</p>
                      </div>

                      <button
                        onClick={() => calculateRouteTo(Number(currentAccident.latitude), Number(currentAccident.longitude), currentAccident.incident_id, userLocation?.lat, userLocation?.lng)}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold font-mono flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Navigation className="w-3 h-3 text-sky-400" />
                        <span>Recalculate Road Route</span>
                      </button>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <a
                          href={gmapsDirections}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
                        >
                          <Compass className="w-3 h-3" />
                          <span>Google Directions &rarr;</span>
                        </a>

                        <Link
                          to="/alerts"
                          className="text-[11px] font-bold text-rose-400 hover:text-rose-300 font-mono"
                        >
                          View in Alerts &rarr;
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })()}
          </MapContainer>
        </div>
      )}

      {/* Quick Citizen SOS & Emergency Report Modal */}
      {isSosModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsSosModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {sosSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Emergency Request Dispatched!</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Your location has been transmitted to dispatchers and nearby units.
                  </p>
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
                    <p>
                      Incident Code: <span className="text-rose-400 font-bold">{sosSuccess.incident_id}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Status: {sosSuccess.response_status}</p>
                  </div>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <Link
                    to={`/incidents/${sosSuccess.id}`}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono transition-colors"
                  >
                    Track Response Terminal &rarr;
                  </Link>
                  <button
                    onClick={() => setIsSosModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleQuickSosSubmit} className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-600/40 flex items-center justify-center text-rose-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Citizen Emergency SOS Request</h3>
                    <p className="text-xs text-slate-400">Transmits real-time incident with your exact GPS position</p>
                  </div>
                </div>

                {/* Detected Coordinates display */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>GOOGLE GPS FIX:</span>
                    {userLocation ? (
                      <span className="text-emerald-400 font-bold">
                        {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} (±{userLocation.accuracy}m)
                      </span>
                    ) : (
                      <span className="text-amber-400">Detecting location...</span>
                    )}
                  </div>
                  <p className="text-slate-200 text-xs font-medium line-clamp-2">
                    {userLocation?.address || 'Acquiring high-accuracy address...'}
                  </p>
                </div>

                {/* Emergency Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Emergency Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Medical', label: 'Ambulance / Medical', icon: Ambulance, color: 'text-sky-400' },
                      { id: 'Traffic', label: 'Traffic Accident', icon: AlertTriangle, color: 'text-amber-400' },
                      { id: 'Fire', label: 'Fire & Rescue', icon: Flame, color: 'text-rose-500' },
                      { id: 'Police', label: 'Police / Crime', icon: Shield, color: 'text-indigo-400' },
                    ].map((type) => {
                      const Icon = type.icon;
                      const isSelected = sosType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setSosType(type.id)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-rose-500/15 border-rose-500 text-white shadow-sm'
                              : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${type.color}`} />
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Severity Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Urgency Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Critical', 'High', 'Medium'].map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSosSeverity(sev)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                          sosSeverity === sev
                            ? sev === 'Critical'
                              ? 'bg-red-500/20 border-red-500 text-red-300'
                              : 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    What Happened? (Optional details)
                  </label>
                  <textarea
                    rows={2}
                    value={sosDescription}
                    onChange={(e) => setSosDescription(e.target.value)}
                    placeholder="e.g. 2-wheeler collision, head injury, vehicle blocking intersection..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSosModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sosSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-900/50 active:scale-95 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sosSubmitting ? 'Transmitting...' : 'Dispatch Emergency Units Now'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
