"use server"

import { sql, castResult } from "./db"
import type { Train, Coach, Locomotive } from "./db"

export async function getTrains(): Promise<Train[]> {
  const result = await sql`SELECT * FROM vonatok`
  return castResult<Train[]>(result)
}

export async function getTrainById(id: number): Promise<Train | null> {
  const result = await sql`SELECT * FROM vonatok WHERE vonatid = ${id}`
  const trains = castResult<Train[]>(result)
  return trains.length > 0 ? trains[0] : null
}

export async function getCoachById(id: string): Promise<Coach | null> {
  const result = await sql`SELECT * FROM kocsik WHERE kocsiid = ${id}`
  const coaches = castResult<Coach[]>(result)
  return coaches.length > 0 ? coaches[0] : null
}

export async function getLocomotiveById(id: string): Promise<Locomotive | null> {
  const result = await sql`SELECT * FROM mozdonyok WHERE mozdonyid = ${id}`
  const locomotives = castResult<Locomotive[]>(result)
  return locomotives.length > 0 ? locomotives[0] : null
}

export async function getCoachesByIds(ids: string[]): Promise<Coach[]> {
  if (ids.length === 0) return [];
  
  // Use sql.unsafe for dynamic IN clause
  const result = await sql(`SELECT * FROM kocsik WHERE kocsiid IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids);
  return castResult<Coach[]>(result);
}
