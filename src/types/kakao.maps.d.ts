/**
 * Kakao Maps JavaScript SDK Type Definitions
 *
 * 공식 문서: https://apis.map.kakao.com/web/documentation/
 *
 * 필요한 타입만 선언 (전체 타입 정의는 방대함)
 */

declare global {
  interface Window {
    kakao: {
      maps: {
        // 지도 생성
        Map: new (container: HTMLElement, options: kakao.maps.MapOptions) => kakao.maps.Map;

        // 좌표
        LatLng: new (lat: number, lng: number) => kakao.maps.LatLng;

        // 마커
        Marker: new (options: kakao.maps.MarkerOptions) => kakao.maps.Marker;

        // 인포윈도우 (말풍선)
        InfoWindow: new (options: kakao.maps.InfoWindowOptions) => kakao.maps.InfoWindow;

        // 지도 컨트롤
        ZoomControl: new () => kakao.maps.ZoomControl;
        MapTypeControl: new () => kakao.maps.MapTypeControl;

        // 로드 완료 이벤트
        load: (callback: () => void) => void;

        // 이벤트
        event: {
          addListener: (
            target: any,
            type: string,
            handler: (...args: any[]) => void
          ) => void;
          removeListener: (
            target: any,
            type: string,
            handler: (...args: any[]) => void
          ) => void;
        };

        // 지도 타입
        ControlPosition: {
          TOP: number;
          TOPLEFT: number;
          TOPRIGHT: number;
          LEFT: number;
          RIGHT: number;
          BOTTOMLEFT: number;
          BOTTOM: number;
          BOTTOMRIGHT: number;
        };

        // CustomOverlay
        CustomOverlay: new (options: kakao.maps.CustomOverlayOptions) => kakao.maps.CustomOverlay;

        // LatLngBounds
        LatLngBounds: new () => kakao.maps.LatLngBounds;

        // Services (Geocoding 등)
        services: {
          Geocoder: new () => kakao.maps.services.Geocoder;
          Places: new () => kakao.maps.services.Places;
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
        };
      };
    };
  }
}

declare namespace kakao.maps {
  // 지도 옵션
  interface MapOptions {
    center: LatLng;
    level?: number; // 확대/축소 레벨 (1~14, 작을수록 확대)
    mapTypeId?: string;
    draggable?: boolean;
    scrollwheel?: boolean;
    disableDoubleClick?: boolean;
    disableDoubleClickZoom?: boolean;
    projectionId?: string;
  }

  // 지도 객체
  interface Map {
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setLevel(level: number, options?: { animate?: boolean; anchor?: LatLng }): void;
    getLevel(): number;
    panTo(latlng: LatLng): void;
    setBounds(bounds: LatLngBounds): void;
    getBounds(): LatLngBounds;
    addControl(control: any, position: number): void;
    removeControl(control: any): void;
    addOverlayMapTypeId(mapTypeId: string): void;
    removeOverlayMapTypeId(mapTypeId: string): void;
    setMapTypeId(mapTypeId: string): void;
    relayout(): void;
  }

  // 좌표
  interface LatLng {
    getLat(): number;
    getLng(): number;
  }

  // 마커 옵션
  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    image?: MarkerImage;
    title?: string;
    draggable?: boolean;
    clickable?: boolean;
    zIndex?: number;
    opacity?: number;
    altitude?: number;
    range?: number;
  }

  // 마커 객체
  interface Marker {
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(position: LatLng): void;
    getPosition(): LatLng;
    setImage(image: MarkerImage): void;
    setZIndex(zIndex: number): void;
    setVisible(visible: boolean): void;
    setTitle(title: string): void;
    setDraggable(draggable: boolean): void;
    setClickable(clickable: boolean): void;
    setAltitude(altitude: number): void;
    setRange(range: number): void;
    setOpacity(opacity: number): void;
  }

  // 마커 이미지
  interface MarkerImage {
    // 구현은 생략
  }

  // 인포윈도우 옵션
  interface InfoWindowOptions {
    content: string | HTMLElement;
    position?: LatLng;
    map?: Map;
    removable?: boolean;
    zIndex?: number;
  }

  // 인포윈도우 객체
  interface InfoWindow {
    open(map: Map, marker: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
    setPosition(position: LatLng): void;
    getContent(): HTMLElement;
    getPosition(): LatLng;
    setZIndex(zIndex: number): void;
  }

  // 커스텀 오버레이 옵션
  interface CustomOverlayOptions {
    clickable?: boolean;
    content?: string | HTMLElement;
    map?: Map;
    position?: LatLng;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
  }

  // 커스텀 오버레이 객체
  interface CustomOverlay {
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(position: LatLng): void;
    getPosition(): LatLng;
    setContent(content: string | HTMLElement): void;
    getContent(): HTMLElement;
    setZIndex(zIndex: number): void;
    setAltitude(altitude: number): void;
    setRange(range: number): void;
  }

  // 지도 경계
  interface LatLngBounds {
    extend(latlng: LatLng): void;
    contain(latlng: LatLng): boolean;
    isEmpty(): boolean;
    getSouthWest(): LatLng;
    getNorthEast(): LatLng;
  }

  // 줌 컨트롤
  interface ZoomControl {}

  // 지도 타입 컨트롤
  interface MapTypeControl {}

  // Services
  namespace services {
    interface Geocoder {
      addressSearch(
        address: string,
        callback: (result: GeocoderResult[], status: GeocoderStatus) => void
      ): void;
      coord2Address(
        lng: number,
        lat: number,
        callback: (result: GeocoderResult[], status: GeocoderStatus) => void
      ): void;
    }

    interface Places {
      keywordSearch(
        keyword: string,
        callback: (result: PlacesSearchResult[], status: string, pagination: Pagination) => void,
        options?: PlacesSearchOptions
      ): void;
      categorySearch(
        category: string,
        callback: (result: PlacesSearchResult[], status: string, pagination: Pagination) => void,
        options?: PlacesSearchOptions
      ): void;
    }

    interface PlacesSearchOptions {
      location?: LatLng;
      x?: number;
      y?: number;
      radius?: number;
      bounds?: LatLngBounds;
      rect?: string;
      size?: number;
      page?: number;
      sort?: string;
      useMapBounds?: boolean;
      useMapCenter?: boolean;
    }

    interface PlacesSearchResult {
      id: string;
      place_name: string;
      category_name: string;
      category_group_code: string;
      category_group_name: string;
      phone: string;
      address_name: string;
      road_address_name: string;
      x: string;
      y: string;
      place_url: string;
      distance: string;
    }

    interface Pagination {
      current: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      nextPage(): void;
      prevPage(): void;
      gotoPage(page: number): void;
    }

    interface GeocoderResult {
      address_name: string;
      address_type: string;
      x: string;
      y: string;
      address: {
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
        mountain_yn: string;
        main_address_no: string;
        sub_address_no: string;
      };
      road_address: {
        address_name: string;
        region_1depth_name: string;
        region_2depth_name: string;
        region_3depth_name: string;
        road_name: string;
        underground_yn: string;
        main_building_no: string;
        sub_building_no: string;
        building_name: string;
        zone_no: string;
      } | null;
    }

    type GeocoderStatus = 'OK' | 'ZERO_RESULT' | 'ERROR';
  }
}

export {};
