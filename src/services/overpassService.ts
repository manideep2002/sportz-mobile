/**
 * overpassService — OpenStreetMap Overpass API integration.
 *
 * Queries the public Overpass API for sports pitches / courts near a set of
 * coordinates, filtered by sport type.  The results are returned as lightweight
 * `OverpassVenue` objects that can be shown alongside the app's own Supabase
 * courts without any additional dependencies.
 *
 * Rate-limit guidance
 * -------------------
 *  - Calls should be cached for at least 10 minutes (enforced at the hook
 *    layer via TanStack Query `staleTime`).
 *  - `retry: false` should be set on the query so a transient 429 doesn't
 *    flood the endpoint.
 */

import type { Sport } from '@/types/domain';
import type { CourtCoordinates } from './courtService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface OverpassVenue {
  /** Stable OSM element id, e.g. "node/12345678" */
  osmId: string;
  name: string;
  sport: string | null;
  latitude: number;
  longitude: number;
  /** Address built from OSM addr:* tags, may be null */
  address: string | null;
  /** Straight-line distance from origin in km, null when origin not provided */
  distanceKm: number | null;
}

// ── OSM tag mapping ────────────────────────────────────────────────────────

/**
 * Maps an app Sport filter to the OSM `sport` tag value used in Overpass QL.
 * Returns null for 'All', which means any sport.
 */
function sportToOsmTag(sport: Sport | 'All'): string | null {
  const map: Record<string, string | null> = {
    All: null,
    Basketball: 'basketball',
    Football: 'football',
    Tennis: 'tennis',
    Badminton: 'badminton',
    Cricket: 'cricket',
    Volleyball: 'volleyball',
    Hockey: 'hockey',
    Badminton_doubles: 'badminton',
  };
  return map[sport] ?? null;
}

// ── Haversine distance ─────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Overpass QL builder ────────────────────────────────────────────────────

function buildQuery(
  origin: CourtCoordinates,
  radiusMetres: number,
  osmSportTag: string | null,
): string {
  const { latitude: lat, longitude: lon } = origin;
  const bbox = `(around:${radiusMetres},${lat},${lon})`;

  const sportFilter = osmSportTag ? `[sport=${osmSportTag}]` : '';

  // Filter for named venues directly in Overpass QL so the server only processes
  // named pitches rather than serializing hundreds of unnamed residential polygons.
  // Using 'qt' (quadtile sorting) is significantly faster than standard ID sorting.
  const body = [
    `node[leisure=pitch][name]${sportFilter}${bbox};`,
    `way[leisure=pitch][name]${sportFilter}${bbox};`,
    `node[leisure=pitch]["name:en"]${sportFilter}${bbox};`,
    `way[leisure=pitch]["name:en"]${sportFilter}${bbox};`,
    ...(osmSportTag === null
      ? [
          `node[leisure=sports_centre][name]${bbox};`,
          `way[leisure=sports_centre][name]${bbox};`,
          `node[leisure=sports_centre]["name:en"]${bbox};`,
          `way[leisure=sports_centre]["name:en"]${bbox};`,
        ]
      : []),
  ].join('\n  ');

  return `[out:json][timeout:20];\n(\n  ${body}\n);\nout center qt 40;`;
}

// ── Response parsing ───────────────────────────────────────────────────────

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Populated for way/relation when `out center` is used */
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OsmElement[];
}

function parseElement(
  el: OsmElement,
  origin: CourtCoordinates | null,
): OverpassVenue | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;

  if (lat === undefined || lon === undefined) return null;

  const tags = el.tags ?? {};

  // Build a readable address from addr:* tags.
  const addrParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
  ].filter(Boolean);
  const address = addrParts.length > 0 ? addrParts.join(', ') : null;

  const distanceKm =
    origin !== null
      ? Math.round(haversineKm(origin.latitude, origin.longitude, lat, lon) * 10) / 10
      : null;

  const name = tags.name ?? tags['name:en'];
  // Drop elements with no name — they are not useful to display.
  if (!name) return null;

  return {
    osmId: `${el.type}/${el.id}`,
    name,
    sport: tags.sport ?? null,
    latitude: lat,
    longitude: lon,
    address,
    distanceKm,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Public Overpass API mirrors, tried in order of global reliability.
 */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

const DEFAULT_RADIUS_KM = 5;
const MAX_RESULTS = 40;
/** Per-mirror request timeout in milliseconds (15s allows cold-start DNS/TLS on mobile). */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Attempts a single Overpass mirror with a timeout and parent abort signal.
 * Uses POST with proper User-Agent and Accept headers to prevent 406/504 rejections.
 */
async function tryMirror(
  endpoint: string,
  query: string,
  parentSignal?: AbortSignal,
): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // If the parent caller aborts (e.g. another mirror won), abort this request immediately.
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer);
      throw new Error('Aborted by parent');
    }
    parentSignal.addEventListener('abort', onParentAbort);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'SportzApp/1.0 (Mobile App; contact@sportz.app)',
        'Accept': 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${endpoint}`);
    }

    const json = (await response.json()) as OverpassResponse;
    return json;
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/** Resolves after `ms` milliseconds — used to stagger mirror starts. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Stagger offset applied between mirror starts (ms). */
const MIRROR_STAGGER_MS = 1_500;

export const overpassService = {
  /**
   * Fetches sports courts / pitches near the given coordinates.
   * Races multiple Overpass mirrors with a gentle staggered start so that
   * the fastest available mirror wins while giving the primary mirror time to respond.
   *
   * @param origin    - User's current location.
   * @param sport     - App sport filter ('All' means any sport).
   * @param radiusKm  - Search radius in km (default 5).
   * @returns         Sorted list of named venues (nearest first), capped at MAX_RESULTS.
   */
  async fetchNearbyVenues(
    origin: CourtCoordinates,
    sport: Sport | 'All' = 'All',
    radiusKm: number = DEFAULT_RADIUS_KM,
  ): Promise<OverpassVenue[]> {
    const osmTag = sportToOsmTag(sport);
    const query = buildQuery(origin, radiusKm * 1000, osmTag);

    const masterController = new AbortController();

    const mirrorAttempts = OVERPASS_MIRRORS.map(async (mirror, i) => {
      if (i > 0) {
        await sleep(i * MIRROR_STAGGER_MS);
      }

      if (masterController.signal.aborted) {
        throw new Error('Aborted');
      }

      const json = await tryMirror(mirror, query, masterController.signal);

      return (json.elements ?? [])
        .map((el) => parseElement(el, origin))
        .filter((v): v is OverpassVenue => v !== null)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        .slice(0, MAX_RESULTS);
    });

    try {
      const result = await Promise.any(mirrorAttempts);
      // Abort other pending mirror requests to free up device networking.
      masterController.abort();
      return result;
    } catch {
      masterController.abort();
      throw new Error('All Overpass mirrors failed.');
    }
  },
};
