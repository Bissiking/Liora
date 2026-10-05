// src/server/ical-timezones.d.ts
declare module "@touch4it/ical-timezones" {
  const tz: { getVtimezoneComponent(zone: string): string | null };
  export default tz;
}
