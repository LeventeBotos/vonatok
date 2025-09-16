export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region?: string;
}

export const stations: Station[] = [
  {
    id: "budapest-keleti",
    name: "Budapest Keleti",
    latitude: 47.5009,
    longitude: 19.0833,
    region: "Budapest",
  },
  {
    id: "budapest-nyugati",
    name: "Budapest Nyugati",
    latitude: 47.5105,
    longitude: 19.0564,
    region: "Budapest",
  },
  {
    id: "budapest-deli",
    name: "Budapest Deli",
    latitude: 47.5002,
    longitude: 19.0239,
    region: "Budapest",
  },
  {
    id: "gyor",
    name: "Gyor",
    latitude: 47.6849,
    longitude: 17.635,
    region: "Transdanubia",
  },
  {
    id: "debrecen",
    name: "Debrecen",
    latitude: 47.5299,
    longitude: 21.6227,
    region: "Great Plain",
  },
  {
    id: "miskolc-tiszai",
    name: "Miskolc Tiszai",
    latitude: 48.1186,
    longitude: 20.8012,
    region: "Northern Hungary",
  },
  {
    id: "szeged",
    name: "Szeged",
    latitude: 46.253,
    longitude: 20.1414,
    region: "Great Plain",
  },
  {
    id: "pecs",
    name: "Pecs",
    latitude: 46.0727,
    longitude: 18.2323,
    region: "Transdanubia",
  },
  {
    id: "kecskemet",
    name: "Kecskemet",
    latitude: 46.9071,
    longitude: 19.6925,
    region: "Great Plain",
  },
  {
    id: "siofok",
    name: "Siofok",
    latitude: 46.9052,
    longitude: 18.0584,
    region: "Lake Balaton",
  },
  {
    id: "szombathely",
    name: "Szombathely",
    latitude: 47.2364,
    longitude: 16.6287,
    region: "Transdanubia",
  },
  {
    id: "tatabanya",
    name: "Tatabanya",
    latitude: 47.5696,
    longitude: 18.4038,
    region: "Transdanubia",
  },
  {
    id: "veszprem",
    name: "Veszprem",
    latitude: 47.1022,
    longitude: 17.9091,
    region: "Transdanubia",
  },
  {
    id: "nyiregyhaza",
    name: "Nyiregyhaza",
    latitude: 47.955,
    longitude: 21.7173,
    region: "Great Plain",
  },
  {
    id: "eger",
    name: "Eger",
    latitude: 47.9053,
    longitude: 20.3776,
    region: "Northern Hungary",
  },
  {
    id: "vac",
    name: "Vac",
    latitude: 47.7833,
    longitude: 19.1353,
    region: "Central Hungary",
  },
  {
    id: "sopron",
    name: "Sopron",
    latitude: 47.6817,
    longitude: 16.5845,
    region: "Transdanubia",
  },
  {
    id: "zalaegerszeg",
    name: "Zalaegerszeg",
    latitude: 46.8431,
    longitude: 16.851,
    region: "Transdanubia",
  },
  {
    id: "esztergom",
    name: "Esztergom",
    latitude: 47.794,
    longitude: 18.7385,
    region: "Central Hungary",
  },
  {
    id: "bekescsaba",
    name: "Bekescsaba",
    latitude: 46.6737,
    longitude: 21.0965,
    region: "Great Plain",
  },
  {
    id: "balatonfured",
    name: "Balatonfured",
    latitude: 46.9635,
    longitude: 17.8725,
    region: "Lake Balaton",
  },
  {
    id: "szekesfehervar",
    name: "Szekesfehervar",
    latitude: 47.186,
    longitude: 18.4221,
    region: "Transdanubia",
  },
  {
    id: "hatvan",
    name: "Hatvan",
    latitude: 47.6641,
    longitude: 19.6727,
    region: "Northern Hungary",
  },
];

export const stationById = new Map(stations.map((station) => [station.id, station] as const));

export function findStationByName(name: string): Station | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;

  return stations.find((station) => station.name.toLowerCase() === normalized);
}

