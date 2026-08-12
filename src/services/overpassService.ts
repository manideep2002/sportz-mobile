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

  // Query both node and way elements so we capture both small courts (nodes)
  // and larger pitches mapped as areas (ways).
  const body = [
    `node[leisure=pitch]${sportFilter}${bbox};`,
    `way[leisure=pitch]${sportFilter}${bbox};`,
    // Also include sport-centre amenities when searching for any sport.
    ...(osmSportTag === null
      ? [
          `node[leisure=sports_centre]${bbox};`,
          `way[leisure=sports_centre]${bbox};`,
        ]
      : []),
  ].join('\n  ');

  return `[out:json][timeout:25];\n(\n  ${body}\n);\nout center;`;
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
 * Public Overpass API mirrors, tried in order.
 * Kumi Systems and mail.ru are community-maintained mirrors that are often
 * faster and more available than the primary overpass-api.de server.
 */
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

const DEFAULT_RADIUS_KM = 5;
const MAX_RESULTS = 40;
/** Per-mirror request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 6_000;

/**
 * Attempts a single Overpass mirror with a hard timeout.
 * Uses a GET request (more reliable than POST in some React Native network
 * stacks) with the Overpass QL query encoded in the URL.
 */
async function tryMirror(
  endpoint: string,
  query: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${endpoint}?data=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves after `ms` milliseconds — used to stagger mirror starts. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Stagger offset applied between mirror starts (ms). */
const MIRROR_STAGGER_MS = 400;

export const overpassService = {
  /**
   * Fetches sports courts / pitches near the given coordinates.
   * Races all Overpass mirrors in parallel with a staggered start so that a
   * brief network blip does not simultaneously abort every mirror attempt.
   * The first mirror that responds successfully wins.
   *
   * @param origin    - User's current location.
   * @param sport     - App sport filter ('All' means any sport).
   * @param radiusKm  - Search radius in km (default 5).
   * @returns         Sorted list of venues (nearest first), capped at MAX_RESULTS.
   */
  async fetchNearbyVenues(
    origin: CourtCoordinates,
    sport: Sport | 'All' = 'All',
    radiusKm: number = DEFAULT_RADIUS_KM,
  ): Promise<OverpassVenue[]> {
    const osmTag = sportToOsmTag(sport);
    const query = buildQuery(origin, radiusKm * 1000, osmTag);

    /**
     * Staggered parallel race:
     *  - Mirror 0 fires immediately.
     *  - Mirror 1 fires after MIRROR_STAGGER_MS (400 ms).
     *  - Mirror 2 fires after 2 × MIRROR_STAGGER_MS (800 ms).
     *
     * Best-case latency is unchanged (the fastest mirror still wins as soon as
     * it replies).  The stagger ensures that a transient sub-second network
     * failure doesn't wipe out every attempt in the same error window.
     */
    const mirrorAttempts = OVERPASS_MIRRORS.map(async (mirror, i) => {
      if (i > 0) await sleep(i * MIRROR_STAGGER_MS);

      const response = await tryMirror(mirror, query);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${mirror}`);
      }

      const json = (await response.json()) as OverpassResponse;

      return (json.elements ?? [])
        .map((el) => parseElement(el, origin))
        .filter((v): v is OverpassVenue => v !== null)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        .slice(0, MAX_RESULTS);
    });

    try {
      return await Promise.any(mirrorAttempts);
    } catch {
      throw new Error('All Overpass mirrors failed.');
    }
  },
};
