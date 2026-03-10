import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  effect,
  NgZone,
} from '@angular/core';
import * as L from 'leaflet';
import { AcceptanceStore } from '../../../../core/services/acceptance.store';
import { AssignedLocation } from '../../../../core/models/location.model';
import { MAP_STATUS_COLORS, MAP_MARKER_BORDER, MAP_COUNTRY_COLORS } from '../../../../shared/constants/map-colors.const';

/** Derive a single display color from all opportunities in an area */
function aggregateColor(loc: AssignedLocation): string {
  const opps = loc.opportunities;
  const pending  = opps.filter(o => o.status === 'PENDING').length;
  const accepted = opps.filter(o => o.status === 'ACCEPTED').length;
  const declined = opps.filter(o => o.status === 'DECLINED').length;
  const actionable = pending + accepted + declined;

  if (actionable === 0) return MAP_STATUS_COLORS.ACCEPTED_BY_OTHER;
  if (pending > 0)      return MAP_STATUS_COLORS.PENDING;
  if (accepted > 0 && declined === 0) return MAP_STATUS_COLORS.ACCEPTED;
  if (declined > 0 && accepted === 0) return MAP_STATUS_COLORS.DECLINED;
  return MAP_STATUS_COLORS.MIXED;
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  template: `<div #mapContainer class="map-container"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .map-container { width: 100%; height: 100%; }
  `],
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  private readonly store = inject(AcceptanceStore);
  private readonly ngZone = inject(NgZone);

  private map!: L.Map;
  private markersLayer!: L.FeatureGroup;
  private geoJsonLayer!: L.GeoJSON;

  constructor() {
    // Re-render markers when locations or selected area changes
    effect(() => {
      const locations = this.store.locations();
      const selectedId = this.store.selectedLocationId();
      if (this.map) {
        this.renderMarkers(locations, selectedId);
      }
    });

    // Fly to selected area
    effect(() => {
      const selected = this.store.selectedLocation();
      if (this.map && selected) {
        this.ngZone.runOutsideAngular(() => {
          this.map.flyTo(
            [selected.coordinates.lat, selected.coordinates.lng],
            7,
            { duration: 1.2 }
          );
        });
      }
    });

    // Re-style GeoJSON on country filter change
    effect(() => {
      const filter = this.store.countryFilter();
      const countries = this.store.availableCountries();
      if (this.geoJsonLayer) {
        this.geoJsonLayer.setStyle(feature =>
          this.geoJsonStyle(feature, countries, filter)
        );
        this.markersLayer?.bringToFront();
      }
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initMap();
      this.loadGeoJson();
    });
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [-5, 25],
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(this.map);

    this.markersLayer = L.featureGroup().addTo(this.map);
  }

  private async loadGeoJson(): Promise<void> {
    try {
      const res = await fetch('/assets/geo/countries.geojson');
      const data = await res.json();
      const countries = this.store.availableCountries();
      const filter = this.store.countryFilter();

      this.geoJsonLayer = L.geoJSON(data as GeoJSON.GeoJsonObject, {
        style: feature => this.geoJsonStyle(feature, countries, filter),
        onEachFeature: (feature, layer) => {
          layer.on('click', () => {
            const isoA2 = feature.properties?.['ISO_A2'] as string;
            if (isoA2 && countries.includes(isoA2)) {
              this.ngZone.run(() => this.store.setCountryFilter(isoA2));
            }
          });
        },
      }).addTo(this.map);

      const locations = this.store.locations();
      this.renderMarkers(locations, this.store.selectedLocationId());
      this.markersLayer.bringToFront();
    } catch (e) {
      console.warn('GeoJSON load failed — map works without country borders', e);
    }
  }

  private geoJsonStyle(
    feature: GeoJSON.Feature | undefined,
    availableCountries: string[],
    activeFilter: string | null
  ): L.PathOptions {
    const iso = feature?.properties?.['ISO_A2'];
    const hasLocations = availableCountries.includes(iso);
    const isFiltered = activeFilter === iso;

    if (isFiltered) {
      return { color: MAP_COUNTRY_COLORS.FILTERED,      weight: 2,   fillColor: MAP_COUNTRY_COLORS.FILTERED,      fillOpacity: 0.12, opacity: 0.9 };
    }
    if (hasLocations) {
      return { color: MAP_COUNTRY_COLORS.HAS_LOCATIONS, weight: 1.5, fillColor: MAP_COUNTRY_COLORS.HAS_LOCATIONS, fillOpacity: 0.06, opacity: 0.5 };
    }
    return   { color: MAP_COUNTRY_COLORS.DEFAULT_STROKE, weight: 0.5, fillColor: MAP_COUNTRY_COLORS.DEFAULT_FILL,  fillOpacity: 0.2,  opacity: 0.4 };
  }

  private renderMarkers(locations: AssignedLocation[], selectedId: string | null): void {
    this.markersLayer.clearLayers();

    for (const loc of locations) {
      const isSelected = loc.id === selectedId;
      const color = aggregateColor(loc);
      const oppCount = loc.opportunities.length;
      const pending = loc.opportunities.filter(o => o.status === 'PENDING').length;

      const marker = L.circleMarker([loc.coordinates.lat, loc.coordinates.lng], {
        radius: isSelected ? 16 : 10,
        fillColor: color,
        color: isSelected ? MAP_MARKER_BORDER.SELECTED : MAP_MARKER_BORDER.DEFAULT,
        weight: isSelected ? 3 : 2,
        opacity: 1,
        fillOpacity: isSelected ? 1 : 0.9,
      });

      const tooltipHtml = `
        <strong>${loc.name}</strong><br/>
        ${loc.countryName}<br/>
        ${oppCount} position${oppCount !== 1 ? 's' : ''}
        ${pending > 0 ? `· ${pending} pending` : ''}
      `;
      marker.bindTooltip(tooltipHtml, { direction: 'top', className: 'epcon-tooltip' });

      marker.on('click', () => {
        this.ngZone.run(() => this.store.selectLocation(loc.id));
      });

      this.markersLayer.addLayer(marker);
    }

    this.markersLayer.bringToFront();
  }
}
