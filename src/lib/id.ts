/**
 * Entity ids. UUIDv4 keeps archive imports collision-free without any
 * coordination, which matters because archives get passed between people.
 */
export function newId(): string {
  return crypto.randomUUID()
}
