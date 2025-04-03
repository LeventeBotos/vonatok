import { neon, neonConfig } from '@neondatabase/serverless';

// Ensure the fetchConnectionCache flag is set
neonConfig.fetchConnectionCache = true;

// Ensure the environment variable for database URL is correctly accessed
const sql = neon(process.env.NEON_DATABASE_URL!);

// Helper function to cast the result to a specific type
export function castResult<T>(result: unknown): T {
  return result as T;
}

export { sql };

// Types for our database tables

export interface Train {
  vonatid: number;
  megallok: string[];
  kocsiidk: string[];
  mozdonyid: string;
  nev: string;
}

export interface Coach {
  kocsiid: string;
  imageurl: string;
  kocsiosztaly: string;
  utaster: string;
  sebesseg: number;
  klima: boolean;
  ulohelyek: string;
}

export interface Locomotive {
  mozdonyid: string;
  sebesseg: number;
  gyarto: string;
  imageurl: string;
  nev: string;
}

// import { neon, neonConfig } from '@neondatabase/serverless';

// neonConfig.fetchConnectionCache = true;

// const sql = neon(process.env.NEON_DATABASE_URL!);

// // Helper function to cast the result to a specific type
// export function castResult<T>(result: any): T {
//   return result as T;
// }

// export { sql };

// // Types for our database tables
// export interface Train {
//   vonatid: number;
//   megallok: string[];
//   kocsiidk: string[];
//   mozdonyid: string;
//   nev: string
// }

// export interface Coach {
//   kocsiid: string;
//   imageurl: string;
//   kocsiosztaly: string;
//   utaster: string;
//   sebesseg: number;
//   klima: string;
//   ulohelyek: string;
// }

// export interface Locomotive {
//   mozdonyid: string;
//   sebesseg: number;
//   gyarto: string;
//   imageurl: string;
// }
