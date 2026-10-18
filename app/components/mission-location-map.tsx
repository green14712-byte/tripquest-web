'use client'

import { useEffect, useRef, useState } from 'react'

import type { Circle, CircleMarker, Map as LeafletMap } from 'leaflet'

type MissionLocationMapProps = {
  latitude: number | null
  longitude: number | null
  radius: number

  /*
   * 기관 Mission 생성/수정 화면에서는
   * 위치 변경 callback을 전달한다.
   *
   * USER 공개 화면의 readOnly 모드에서는
   * 전달하지 않아도 된다.
   */
  onLocationChange?: (latitude: number, longitude: number) => void

  /*
   * true:
   * - 장소 검색 숨김
   * - 지도 클릭 위치 변경 비활성화
   * - 현재 Mission 위치와 인증 반경만 표시
   *
   * false:
   * - 기존 생성/수정용 편집 지도
   */
  readOnly?: boolean
}

type SearchResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export default function MissionLocationMap({
  latitude,
  longitude,
  radius,
  onLocationChange,
  readOnly = false,
}: MissionLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<LeafletMap | null>(null)

  const locationMarkerRef = useRef<CircleMarker | null>(null)

  const radiusCircleRef = useRef<Circle | null>(null)

  const leafletRef = useRef<typeof import('leaflet') | null>(null)

  const onLocationChangeRef = useRef(onLocationChange)

  const readOnlyRef = useRef(readOnly)

  /*
   * Leaflet 지도가 실제 생성됐는지 확인하는 상태.
   *
   * 비동기 import가 끝난 뒤 이 값을 true로 만들어
   * 중심점 / 인증 반경 effect가 반드시 다시 실행되도록 한다.
   */
  const [mapReady, setMapReady] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  const [searchLoading, setSearchLoading] = useState(false)

  const [searchError, setSearchError] = useState('')

  /*
   * 부모 callback이 변경되더라도
   * 지도 이벤트에서는 최신 callback을 사용한다.
   */
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  /*
   * readOnly 값도 최신 상태를 ref에 반영한다.
   */
  useEffect(() => {
    readOnlyRef.current = readOnly
  }, [readOnly])

  /*
   * Leaflet 지도 최초 생성
   */
  useEffect(() => {
    let cancelled = false

    async function initializeMap() {
      const L = await import('leaflet')

      if (cancelled || !containerRef.current || mapRef.current) {
        return
      }

      leafletRef.current = L

      /*
       * 위치가 존재하면 해당 Mission 위치에서 시작한다.
       *
       * 위치가 아직 없는 생성 화면에서는
       * 대한민국 전체가 보이도록 한다.
       */
      const initialCenter: [number, number] =
        latitude !== null && longitude !== null
          ? [latitude, longitude]
          : [36.5, 127.8]

      const initialZoom = latitude !== null && longitude !== null ? 16 : 7

      const map = L.map(containerRef.current, {
        zoomControl: true,
      }).setView(initialCenter, initialZoom)

      /*
       * OpenStreetMap 지도 타일
       */
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,

        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      /*
       * 기관 Mission 생성/수정 화면에서만
       * 지도 클릭으로 좌표를 변경한다.
       */
      map.on('click', (event) => {
        if (readOnlyRef.current) {
          return
        }

        onLocationChangeRef.current?.(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map

      /*
       * 중요:
       *
       * 여기까지 와야 실제 Leaflet map이 준비된 것이다.
       * mapReady를 true로 변경해서
       * 아래 중심점 / 인증 반경 effect를 다시 실행한다.
       */
      setMapReady(true)

      /*
       * grid / flex 내부에서 지도가 생성될 경우
       * 크기를 다시 계산한다.
       */
      window.setTimeout(() => {
        map.invalidateSize()
      }, 0)
    }

    void initializeMap()

    return () => {
      cancelled = true

      if (mapRef.current) {
        mapRef.current.remove()

        mapRef.current = null
      }

      locationMarkerRef.current = null

      radiusCircleRef.current = null

      leafletRef.current = null
    }
  }, [])

  /*
   * Mission 위치 / 인증 반경 표시
   *
   * mapReady가 true가 된 뒤 반드시 다시 실행된다.
   */
  useEffect(() => {
    if (!mapReady) {
      return
    }

    const L = leafletRef.current

    const map = mapRef.current

    if (!L || !map) {
      return
    }

    /*
     * 아직 위치가 선택되지 않은 경우
     */
    if (latitude === null || longitude === null) {
      if (locationMarkerRef.current) {
        locationMarkerRef.current.remove()

        locationMarkerRef.current = null
      }

      if (radiusCircleRef.current) {
        radiusCircleRef.current.remove()

        radiusCircleRef.current = null
      }

      return
    }

    const position: [number, number] = [latitude, longitude]

    /*
     * Mission 중심점
     */
    if (!locationMarkerRef.current) {
      locationMarkerRef.current = L.circleMarker(position, {
        radius: 8,

        weight: 3,

        fillOpacity: 1,
      }).addTo(map)
    } else {
      locationMarkerRef.current.setLatLng(position)
    }

    /*
     * GPS 인증 가능 반경
     */
    if (!radiusCircleRef.current) {
      radiusCircleRef.current = L.circle(position, {
        radius,

        weight: 3,

        opacity: 0.9,

        fillOpacity: 0.15,
      }).addTo(map)
    } else {
      radiusCircleRef.current.setLatLng(position)

      radiusCircleRef.current.setRadius(radius)
    }

    /*
     * USER 읽기 전용 화면
     *
     * 고정 zoom을 사용하는 대신
     * 인증 반경 원 전체가 화면에 들어오도록 맞춘다.
     *
     * 예:
     * 100m → 비교적 가까이
     * 400m → 원 전체 표시
     * 1000m → 더 넓게 표시
     */
    if (readOnly && radiusCircleRef.current) {
      window.setTimeout(() => {
        const currentMap = mapRef.current

        const currentCircle = radiusCircleRef.current

        if (!currentMap || !currentCircle) {
          return
        }

        currentMap.invalidateSize()

        currentMap.fitBounds(currentCircle.getBounds(), {
          padding: [35, 35],

          maxZoom: 16,
        })
      }, 0)

      return
    }

    /*
     * 기관 생성/수정 화면에서는
     * 기존 선택 위치 중심으로 유지한다.
     */
    map.setView(position, 16)
  }, [latitude, longitude, radius, readOnly, mapReady])

  /*
   * 장소 검색
   *
   * readOnly에서는 호출되지 않는다.
   */
  async function handleSearch() {
    if (readOnly) {
      return
    }

    const query = searchQuery.trim()

    if (!query) {
      setSearchError('검색할 장소를 입력해주세요.')

      setSearchResults([])

      return
    }

    setSearchLoading(true)

    setSearchError('')

    setSearchResults([])

    try {
      const params = new URLSearchParams({
        q: query,

        format: 'jsonv2',

        limit: '5',

        countrycodes: 'kr',

        'accept-language': 'ko',
      })

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      )

      if (!response.ok) {
        throw new Error('장소 검색에 실패했습니다.')
      }

      const data: SearchResult[] = await response.json()

      if (data.length === 0) {
        setSearchError(
          '검색 결과가 없습니다. 장소명이나 주소를 조금 다르게 입력해보세요.',
        )

        return
      }

      setSearchResults(data)
    } catch (err) {
      if (err instanceof Error) {
        setSearchError(err.message)
      } else {
        setSearchError('장소 검색 중 오류가 발생했습니다.')
      }
    } finally {
      setSearchLoading(false)
    }
  }

  /*
   * 검색 결과 선택
   */
  function selectSearchResult(result: SearchResult) {
    if (readOnly) {
      return
    }

    const selectedLatitude = Number(result.lat)

    const selectedLongitude = Number(result.lon)

    if (Number.isNaN(selectedLatitude) || Number.isNaN(selectedLongitude)) {
      setSearchError('검색 위치 좌표를 확인할 수 없습니다.')

      return
    }

    onLocationChangeRef.current?.(selectedLatitude, selectedLongitude)

    mapRef.current?.setView([selectedLatitude, selectedLongitude], 17)

    setSearchQuery(result.display_name)

    setSearchResults([])

    setSearchError('')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white">
      {!readOnly && (
        <>
          {/* 장소 검색 */}
          <div className="border-b border-slate-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()

                    if (!searchLoading) {
                      void handleSearch()
                    }
                  }
                }}
                placeholder="장소명 또는 주소 검색"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
              />

              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searchLoading}
                className="shrink-0 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {searchLoading ? '검색 중...' : '검색'}
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              예: 중부대학교 고양캠퍼스, 경복궁, 서울역
            </p>

            {searchError && (
              <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {searchError}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                {searchResults.map((result, index) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-sky-50 ${
                      index !== searchResults.length - 1
                        ? 'border-b border-slate-100'
                        : ''
                    }`}
                  >
                    <p className="text-sm font-semibold leading-6 text-slate-800">
                      {result.display_name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 지도 */}
      <div
        ref={containerRef}
        className={readOnly ? 'h-80 w-full sm:h-96' : 'h-130 w-full'}
      />

      {/* 위치 정보 */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        {latitude === null || longitude === null ? (
          <p className="text-sm font-semibold text-slate-500">
            {readOnly
              ? 'Mission 위치 정보를 확인할 수 없습니다.'
              : '장소를 검색하거나 지도에서 Mission 위치를 클릭해주세요.'}
          </p>
        ) : readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400">Mission 위치</p>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                위도 {latitude.toFixed(6)}
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                경도 {longitude.toFixed(6)}
              </p>
            </div>

            <div className="rounded-xl bg-sky-50 px-4 py-2 text-right">
              <p className="text-xs font-bold text-sky-500">GPS 인증 반경</p>

              <p className="mt-1 font-bold text-sky-700">{radius}m</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-semibold text-slate-700">선택된 위치</p>

            <p className="text-slate-500">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
