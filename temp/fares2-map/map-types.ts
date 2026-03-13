// Map Provider Types - Abstraction Layer for Multiple Map Providers

export type MapProvider = 'google' | 'openstreetmap'

export interface MapPosition {
  lat: number
  lng: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface MarkerData {
  id: string
  position: MapPosition
  title: string
  icon?: MarkerIcon
  label?: string
  zIndex?: number
  data?: any
}

export interface MarkerIcon {
  url: string
  size: { width: number; height: number }
  anchor: { x: number; y: number }
  labelOrigin?: { x: number; y: number }
}

export interface ClusterOptions {
  gridSize: number
  minimumClusterSize: number
}

export interface MapConfig {
  center: MapPosition
  zoom: number
  minZoom?: number
  maxZoom?: number
  gestureHandling?: 'greedy' | 'cooperative' | 'none'
}

export interface MapStyleOption {
  id: 'roadmap' | 'satellite' | 'hybrid'
  label: string
  labelAr: string
}

export const MAP_STYLES: MapStyleOption[] = [
  { id: 'roadmap', label: 'Map', labelAr: 'خريطة' },
  { id: 'satellite', label: 'Satellite', labelAr: 'القمر الصناعي' },
  { id: 'hybrid', label: 'Hybrid', labelAr: 'هجين' }
]

// OpenStreetMap tile providers - fast and free
export const OSM_TILE_LAYERS = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
  }
}

export interface MapControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleStyle: () => void
  onToggleProvider: () => void
  currentStyle: string
  currentProvider: MapProvider
  isDrawingMode: boolean
  onStartDrawing: () => void
  onCancelDrawing: () => void
}
