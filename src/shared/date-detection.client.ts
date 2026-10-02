// src/shared/date-detection.client.ts
// Client-side only wrapper - re-exports from shared (which is now pure TS, no chrono-node dependency)

export {
  detectDateTimes,
  formatDateTimeForDisplay,
  formatDateOnlyForDisplay,
  formatTimeOnlyForDisplay,
  type DetectedDateTime,
} from "./date-detection.js";