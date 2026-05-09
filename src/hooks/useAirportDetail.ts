import { useQuery } from '@tanstack/react-query';
import { fetchAirportDetail, type AirportDbDetail } from '@/services/airportDbService';
import { IATA_TO_ICAO } from '@/data/tradeInfrastructure/iataToIcao';

export type { AirportDbDetail };

/**
 * Fetches and caches AirportDB detail for a given IATA code.
 *
 * Call-efficiency:
 *   - Only runs when `iata` is defined (enabled: !!icao)
 *   - staleTime = 24 h  → no refetch until the next day
 *   - gcTime   = 7 days → result stays in memory across panel open/close
 *   - If the IATA code has no ICAO mapping, the query stays disabled
 */
export function useAirportDetail(iata: string | undefined) {
  const icao = iata ? IATA_TO_ICAO[iata] : undefined;

  return useQuery<AirportDbDetail, Error>({
    queryKey: ['airportdb', icao],
    queryFn:  () => fetchAirportDetail(icao!),
    enabled:  !!icao,
    staleTime: 24 * 60 * 60 * 1_000,   // 24 h
    gcTime:     7 * 24 * 60 * 60 * 1_000, // 7 days
    retry: 1,
  });
}
