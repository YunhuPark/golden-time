export type HospitalSearchPerformanceStatus =
  | 'running'
  | 'initial-results'
  | 'complete'
  | 'failed';

export interface HospitalSearchPerformanceSnapshot {
  searchId: number;
  status: HospitalSearchPerformanceStatus;
  eGenFetchMs?: number;
  geocodingMs?: number;
  rankingMs?: number;
  firstResultsStateMs?: number;
  firstResultsPaintMs?: number;
  routeEnrichmentMs?: number;
  totalToRoutesMs?: number;
  hospitalCount?: number;
  geocodingRequested?: number;
  geocodingSucceeded?: number;
  routeCount?: number;
  failureStage?: string;
}

type SearchPerformanceState = HospitalSearchPerformanceSnapshot & {
  startedAtMs: number;
  routeStartedAtMs?: number;
};

const MAX_TRACKED_SEARCHES = 20;
let nextSearchId = 1;
let activeSearchId: number | null = null;
const searches = new Map<number, SearchPerformanceState>();

const nowMs = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const roundMs = (value: number): number => Math.max(0, Math.round(value));

const toSnapshot = (state: SearchPerformanceState): HospitalSearchPerformanceSnapshot => ({
  searchId: state.searchId,
  status: state.status,
  eGenFetchMs: state.eGenFetchMs,
  geocodingMs: state.geocodingMs,
  rankingMs: state.rankingMs,
  firstResultsStateMs: state.firstResultsStateMs,
  firstResultsPaintMs: state.firstResultsPaintMs,
  routeEnrichmentMs: state.routeEnrichmentMs,
  totalToRoutesMs: state.totalToRoutesMs,
  hospitalCount: state.hospitalCount,
  geocodingRequested: state.geocodingRequested,
  geocodingSucceeded: state.geocodingSucceeded,
  routeCount: state.routeCount,
  failureStage: state.failureStage,
});

const publishSnapshot = (label: string, state: SearchPerformanceState): void => {
  const snapshot = toSnapshot(state);
  console.info(`[PERF] ${label}`, snapshot);

  if (typeof window === 'undefined') return;
  const perfWindow = window as Window & {
    __GOLDEN_TIME_PERF__?: HospitalSearchPerformanceSnapshot[];
  };
  const history = perfWindow.__GOLDEN_TIME_PERF__ ?? [];
  const withoutCurrent = history.filter((item) => item.searchId !== snapshot.searchId);
  perfWindow.__GOLDEN_TIME_PERF__ = [...withoutCurrent, snapshot].slice(-MAX_TRACKED_SEARCHES);
};

const getState = (searchId: number | null | undefined): SearchPerformanceState | null => {
  if (!searchId) return null;
  return searches.get(searchId) ?? null;
};

const pruneSearches = (): void => {
  while (searches.size > MAX_TRACKED_SEARCHES) {
    const oldestId = searches.keys().next().value as number | undefined;
    if (oldestId === undefined) return;
    searches.delete(oldestId);
  }
};

export const startHospitalSearchPerformance = (): number => {
  const searchId = nextSearchId++;
  activeSearchId = searchId;
  searches.set(searchId, {
    searchId,
    status: 'running',
    startedAtMs: nowMs(),
  });
  pruneSearches();
  return searchId;
};

export const getActiveHospitalSearchPerformanceId = (): number | null => activeSearchId;

export const recordEGenPerformance = (
  searchId: number,
  data: {
    eGenFetchMs: number;
    geocodingMs: number;
    geocodingRequested: number;
    geocodingSucceeded: number;
  }
): void => {
  const state = getState(searchId);
  if (!state) return;
  state.eGenFetchMs = roundMs(data.eGenFetchMs);
  state.geocodingMs = roundMs(data.geocodingMs);
  state.geocodingRequested = data.geocodingRequested;
  state.geocodingSucceeded = data.geocodingSucceeded;
};

export const recordRankingPerformance = (searchId: number, rankingMs: number): void => {
  const state = getState(searchId);
  if (!state) return;
  state.rankingMs = roundMs(rankingMs);
};

export const recordFirstHospitalResults = (
  searchId: number | null,
  hospitalCount: number
): void => {
  const state = getState(searchId);
  if (!state || state.firstResultsStateMs !== undefined || state.status === 'failed') return;

  state.hospitalCount = hospitalCount;
  state.firstResultsStateMs = roundMs(nowMs() - state.startedAtMs);
  if (state.status !== 'complete') state.status = 'initial-results';

  const recordPaint = () => {
    const latest = getState(searchId);
    if (!latest || latest.firstResultsPaintMs !== undefined) return;
    latest.firstResultsPaintMs = roundMs(nowMs() - latest.startedAtMs);
    publishSnapshot('hospital_search_initial', latest);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(recordPaint));
  } else {
    state.firstResultsPaintMs = state.firstResultsStateMs;
    publishSnapshot('hospital_search_initial', state);
  }
};

export const startRouteEnrichmentPerformance = (searchId: number | null): void => {
  const state = getState(searchId);
  if (!state || state.routeStartedAtMs !== undefined) return;
  state.routeStartedAtMs = nowMs();
};

export const recordRouteEnrichmentPerformance = (
  searchId: number | null,
  routeCount: number
): void => {
  const state = getState(searchId);
  if (!state || state.status === 'failed') return;

  const finishedAt = nowMs();
  state.routeCount = routeCount;
  if (state.routeStartedAtMs !== undefined) {
    state.routeEnrichmentMs = roundMs(finishedAt - state.routeStartedAtMs);
  }
  state.totalToRoutesMs = roundMs(finishedAt - state.startedAtMs);
  state.status = 'complete';
  publishSnapshot('hospital_search_complete', state);
};

export const recordHospitalSearchFailure = (
  searchId: number | null,
  stage: string
): void => {
  const state = getState(searchId);
  if (!state) return;
  state.status = 'failed';
  state.failureStage = stage;
  publishSnapshot('hospital_search_failed', state);
};

export const getRecentHospitalSearchPerformance = (): HospitalSearchPerformanceSnapshot[] =>
  Array.from(searches.values()).map(toSnapshot);
