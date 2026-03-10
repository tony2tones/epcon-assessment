/**
 * Colours used by the Leaflet map layer.
 * These mirror the --epcon-* CSS custom properties but are kept here as
 * TypeScript constants because Leaflet operates outside Angular's styling
 * pipeline and cannot read CSS variables at runtime.
 */

/** Fill colour for a location marker, keyed by its aggregate status. */
export const MAP_STATUS_COLORS = {
  PENDING:           '#2196f3',  // --epcon-pending
  ACCEPTED:          '#4caf50',  // --epcon-accepted
  DECLINED:          '#f44336',  // --epcon-declined
  ACCEPTED_BY_OTHER: '#607d8b',  // --epcon-taken
  MIXED:             '#ff9800',  // amber — mix of accepted + declined
} as const;

/** Stroke colour for the circular marker ring. */
export const MAP_MARKER_BORDER = {
  SELECTED: '#1a1d2e',  // --epcon-surface (dark ring makes selected marker pop)
  DEFAULT:  '#ffffff',
} as const;

/** Stroke + fill colours for the GeoJSON country polygons. */
export const MAP_COUNTRY_COLORS = {
  /** Country currently active as a filter (teal highlight). */
  FILTERED:      '#0097a7',
  /** Country that has at least one assigned location (subtle teal). */
  HAS_LOCATIONS: '#00796b',
  /** All other countries — muted grey. */
  DEFAULT_STROKE: '#b0bec5',
  DEFAULT_FILL:   '#eceff1',
} as const;
