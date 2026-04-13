/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace kakao {
  namespace maps {
    function load(callback: () => void): void

    class Map {
      constructor(container: HTMLElement, options: MapOptions)
      setCenter(latlng: LatLng): void
      getCenter(): LatLng
      setLevel(level: number): void
      setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void
    }

    class LatLng {
      constructor(lat: number, lng: number)
      getLat(): number
      getLng(): number
    }

    class LatLngBounds {
      constructor()
      extend(latlng: LatLng): void
      isEmpty(): boolean
    }

    class Size {
      constructor(width: number, height: number)
    }

    class Point {
      constructor(x: number, y: number)
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: { offset?: Point; spriteSize?: Size; spriteOrigin?: Point })
    }

    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      getPosition(): LatLng
    }

    class InfoWindow {
      constructor(options: InfoWindowOptions)
      open(map: Map, marker: Marker): void
      close(): void
    }

    namespace event {
      function addListener(target: any, type: string, handler: (...args: any[]) => void): void
    }

    interface MapOptions {
      center: LatLng
      level: number
    }

    interface MarkerOptions {
      position: LatLng
      map?: Map
      title?: string
      image?: MarkerImage
    }

    interface InfoWindowOptions {
      content: string | HTMLElement
      removable?: boolean
      zIndex?: number
    }
  }
}

interface Window {
  kakao: typeof kakao
}
