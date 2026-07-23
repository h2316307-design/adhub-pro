/**
 * Reverse Geocoding Utility
 * Uses Nominatim (OpenStreetMap) + Overpass POIs for accurate Arabic location & landmark detection.
 */

export interface GeocodingResult {
  road: string;
  suburb: string;
  city: string;
  display_name: string;
  location_text: string;    // formatted for location_text field (Area/Road/District)
  nearest_landmark: string; // formatted for nearest_landmark field (Nearest Pharmacy, Government Building, Mosque, etc.)
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Helper to fetch nearby POIs (Pharmacy, Government Building, Mosque, Hospital, Bank, School, Petrol Station)
 * using Overpass API when direct reverse geocode doesn't include a POI name.
 */
async function fetchNearbyOverpassLandmark(lat: number, lng: number): Promise<string | null> {
  try {
    const query = `[out:json][timeout:3];(
      node(around:250,${lat},${lng})["amenity"];
      way(around:250,${lat},${lng})["amenity"];
      node(around:250,${lat},${lng})["building"="government"];
      way(around:250,${lat},${lng})["building"="government"];
      node(around:250,${lat},${lng})["office"];
      way(around:250,${lat},${lng})["office"];
    );out center 8;`;

    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.elements || data.elements.length === 0) return null;

    const namedPOIs = data.elements.map((el: any) => {
      const tags = el.tags || {};
      const name = tags['name:ar'] || tags['name'] || tags['official_name'] || '';
      const elLat = el.lat || el.center?.lat || lat;
      const elLng = el.lon || el.center?.lon || lng;

      // Distance calculation in meters
      const dLat = (elLat - lat) * 111000;
      const dLng = (elLng - lng) * 111000 * Math.cos((lat * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      return { name, dist };
    }).filter((p: any) => p.name && p.name.trim().length > 2);

    if (namedPOIs.length === 0) return null;

    namedPOIs.sort((a: any, b: any) => a.dist - b.dist);
    const closest = namedPOIs[0];

    const cleanName = closest.name.trim();
    if (cleanName.startsWith('بجوار') || cleanName.startsWith('بالقرب') || cleanName.startsWith('مقابل')) {
      return cleanName;
    }

    return `بالقرب من ${cleanName}`;
  } catch {
    return null;
  }
}

/**
 * Reverse geocode (lat, lng) → Arabic street/suburb names & nearest landmark POI.
 * Returns null if offline or location not found.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar&zoom=18&addressdetails=1&extratags=1&namedetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AlFaresAdHub/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address || {};
    const extra = data.extratags || {};

    const road       = addr.road || addr.pedestrian || addr.path || addr.footway || '';
    const suburb     = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '';
    const city       = addr.city || addr.town || addr.village || addr.county || '';
    const state      = addr.state || '';
    const displayName = data.display_name || '';

    // 1. Build location_text: road + suburb (Area where the photo was taken)
    const locationParts = [road, suburb].filter(Boolean);
    const location_text = locationParts.join(' - ') || city || state || 'موقع غير مسمى';

    // 2. Build nearest_landmark: look for specific POIs (Pharmacy, Government Building, Mosque, Hospital, Bank, School, Petrol Station, etc.)
    let specificPoi = 
      addr.pharmacy ||
      addr.hospital ||
      addr.clinic ||
      addr.mosque ||
      addr.bank ||
      addr.school ||
      addr.university ||
      addr.government ||
      addr.building ||
      addr.office ||
      addr.shop ||
      addr.amenity ||
      extra.name ||
      '';

    if (!specificPoi && data.name && data.name !== road && data.name !== suburb && data.name !== city) {
      specificPoi = data.name;
    }

    let nearest_landmark = '';

    if (specificPoi && typeof specificPoi === 'string' && specificPoi.trim().length > 2) {
      const trimmed = specificPoi.trim();
      if (trimmed.startsWith('بجوار') || trimmed.startsWith('بالقرب') || trimmed.startsWith('مقابل')) {
        nearest_landmark = trimmed;
      } else {
        nearest_landmark = `بالقرب من ${trimmed}`;
      }
    } else {
      // Fetch closest nearby POI (Pharmacy, Government Building, Mosque, Bank, etc.) via Overpass API
      const nearbyPoi = await fetchNearbyOverpassLandmark(lat, lng);
      if (nearbyPoi) {
        nearest_landmark = nearbyPoi;
      } else {
        // Fallback: road + suburb combination
        const landmarkParts = [road, suburb].filter(Boolean);
        nearest_landmark = landmarkParts.length > 0 ? `بالقرب من ${landmarkParts.join(' - ')}` : (displayName.split(',').slice(0, 2).join('، ') || 'بالقرب من الموقع');
      }
    }

    return { road, suburb, city, display_name: displayName, location_text, nearest_landmark };
  } catch {
    return null;
  }
}
