'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'

type ChallengeRouteMode = 'WALKING' | 'CYCLING' | 'DRIVING'

type SummaryMission = {
  id: number
  title: string
  address: string | null
  latitude: number
  longitude: number
  sortOrder: number
}

type ChallengeSummaryMapProps = {
  missions: SummaryMission[]
  completedMissionIds?: number[]
  routeMode: ChallengeRouteMode
}

type MapboxDirectionsResponse = {
  code?: string

  routes?: Array<{
    distance?: number
    duration?: number

    geometry?: {
      type?: string
      coordinates?: number[][]
    }
  }>
}

type RouteSummary = {
  distanceMeters: number | null
  durationSeconds: number | null
  actualRoute: boolean
  message: string
}

export default function ChallengeSummaryMap({
  missions,
  completedMissionIds = [],
  routeMode,
}: ChallengeSummaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<LeafletMap | null>(null)

  const markersRef = useRef<Marker[]>([])

  const routeLineRef = useRef<Polyline | null>(null)

  const [routeSummary, setRouteSummary] = useState<RouteSummary>({
    distanceMeters: null,
    durationSeconds: null,
    actualRoute: false,
    message: '',
  })

  /*
   * 좌표가 정상적으로 존재하는 Mission만 지도에 표시한다.
   *
   * PUBLIC Challenge API에서는 이미 ACTIVE Mission만 내려오고,
   * sortOrder 순서대로 정렬되어 있지만
   * 프론트에서도 한 번 더 안전하게 정렬한다.
   */
  const orderedMissions = useMemo(() => {
    return [...missions]
      .filter(
        (mission) =>
          Number.isFinite(mission.latitude) &&
          Number.isFinite(mission.longitude),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [missions])

  /*
   * progress가 아직 없는 상태에서는 부모 컴포넌트에서
   * 빈 배열이 새로 생성될 수 있다.
   *
   * 배열 자체가 아니라 실제 완료 Mission ID 값만 비교해서
   * 불필요한 Leaflet 재생성을 줄인다.
   */
  const completedMissionKey = completedMissionIds
    .slice()
    .sort((a, b) => a - b)
    .join(',')

  useEffect(() => {
    let cancelled = false

    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    let currentMap: LeafletMap | null = null

    const abortController = new AbortController()

    async function initializeMap() {
      const container = containerRef.current

      if (!container) {
        return
      }

      const L = await import('leaflet')

      if (cancelled || !containerRef.current) {
        return
      }

      /*
       * 혹시 이전 Map 인스턴스가 남아 있다면 먼저 제거한다.
       */
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      markersRef.current = []
      routeLineRef.current = null

      setRouteSummary({
        distanceMeters: null,
        durationSeconds: null,
        actualRoute: false,
        message: '',
      })

      /*
       * 처음 보여줄 위치
       *
       * Mission이 있으면 첫 번째 Mission 위치,
       * 없으면 대한민국 전체.
       */
      const initialCenter: [number, number] =
        orderedMissions.length > 0
          ? [orderedMissions[0].latitude, orderedMissions[0].longitude]
          : [36.5, 127.8]

      const initialZoom = orderedMissions.length > 0 ? 14 : 7

      /*
       * React + Leaflet cleanup 시 발생할 수 있는
       * _leaflet_pos 오류를 방지하기 위해
       * 지도 애니메이션을 사용하지 않는다.
       */
      const map = L.map(containerRef.current, {
        zoomControl: true,

        scrollWheelZoom: false,

        zoomAnimation: false,

        fadeAnimation: false,

        markerZoomAnimation: false,
      }).setView(initialCenter, initialZoom)

      currentMap = map
      mapRef.current = map

      /*
       * 지도 배경은 기존처럼 OpenStreetMap을 사용한다.
       *
       * Mapbox는 실제 추천 경로를 계산하는 용도로만 사용한다.
       */
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,

        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      /*
       * Mission이 없다면 대한민국 기본 지도만 표시한다.
       */
      if (orderedMissions.length === 0) {
        resizeTimer = setTimeout(() => {
          if (
            cancelled ||
            mapRef.current !== map ||
            !map.getContainer().isConnected
          ) {
            return
          }

          map.invalidateSize({
            animate: false,
          })
        }, 0)

        return
      }

      const completedMissionIdSet = new Set(
        completedMissionKey
          ? completedMissionKey.split(',').map((value) => Number(value))
          : [],
      )

      /*
       * Marker와 fallback 직선 경로에서 사용하는
       * Mission의 원래 좌표.
       */
      const missionPositions: [number, number][] = []

      orderedMissions.forEach((mission, index) => {
        const position: [number, number] = [mission.latitude, mission.longitude]

        missionPositions.push(position)

        const completed = completedMissionIdSet.has(mission.id)

        /*
         * 지도 번호 Marker
         *
         * 파랑:
         * 아직 완료하지 않은 Mission
         *
         * 초록:
         * 완료한 Mission
         */
        const markerIcon = L.divIcon({
          className: '',

          html: `
            <div
              style="
                width: 36px;
                height: 36px;
                border-radius: 9999px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 800;
                color: white;
                background: ${completed ? '#10b981' : '#0284c7'};
                border: 3px solid white;
                box-shadow:
                  0 4px 12px
                  rgba(15, 23, 42, 0.28);
              "
            >
              ${index + 1}
            </div>
          `,

          iconSize: [36, 36],

          iconAnchor: [18, 18],

          popupAnchor: [0, -22],
        })

        const marker = L.marker(position, {
          icon: markerIcon,

          keyboard: true,
        }).addTo(map)

        const missionNumber = index + 1

        const completionText = completed
          ? '완료한 Mission'
          : '진행 가능한 Mission'

        marker.bindPopup(`
          <div style="min-width: 180px;">
            <div
              style="
                margin-bottom: 4px;
                color: #64748b;
                font-size: 11px;
                font-weight: 700;
              "
            >
              MISSION ${String(missionNumber).padStart(2, '0')}
            </div>

            <div
              style="
                margin-bottom: 6px;
                color: #0f172a;
                font-size: 15px;
                font-weight: 800;
              "
            >
              ${escapeHtml(mission.title)}
            </div>

            ${
              mission.address
                ? `
                  <div
                    style="
                      margin-bottom: 6px;
                      color: #64748b;
                      font-size: 12px;
                      line-height: 1.5;
                    "
                  >
                    ${escapeHtml(mission.address)}
                  </div>
                `
                : ''
            }

            <div
              style="
                color: ${completed ? '#059669' : '#0284c7'};
                font-size: 12px;
                font-weight: 700;
              "
            >
              ${completionText}
            </div>
          </div>
        `)

        markersRef.current.push(marker)
      })

      /*
       * Mission이 한 개뿐이라면
       * 이동 경로 계산이 필요하지 않는다.
       */
      if (orderedMissions.length === 1) {
        setRouteSummary({
          distanceMeters: null,

          durationSeconds: null,

          actualRoute: false,

          message: 'Mission이 1개이므로 이동 경로 계산이 필요하지 않습니다.',
        })
      }

      /*
       * Mission이 2개 이상인 경우
       * 실제 이동 경로 계산을 시도한다.
       */
      if (orderedMissions.length >= 2) {
        let routeDrawn = false

        try {
          const accessToken =
            process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? ''

          /*
           * 아직 Mapbox 토큰을 설정하지 않았다면
           * API를 호출하지 않고 기존 직선 경로로 fallback 한다.
           */
          if (!accessToken) {
            throw new Error('MAPBOX_TOKEN_MISSING')
          }

          /*
           * 하나의 Directions 요청에서 처리 가능한
           * Mission 수를 초과한 경우 fallback 한다.
           */
          if (orderedMissions.length > 25) {
            throw new Error('TOO_MANY_MISSIONS')
          }

          const profile = getMapboxProfile(routeMode)

          /*
           * Mapbox 좌표 형식:
           *
           * longitude,latitude
           */
          const coordinates = orderedMissions
            .map((mission) => `${mission.longitude},${mission.latitude}`)
            .join(';')

          const query = new URLSearchParams({
            access_token: accessToken,

            alternatives: 'false',

            geometries: 'geojson',

            overview: 'full',

            steps: 'false',
          })

          const response = await fetch(
            `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?${query.toString()}`,
            {
              method: 'GET',

              signal: abortController.signal,

              cache: 'no-store',
            },
          )

          if (!response.ok) {
            throw new Error(`MAPBOX_${response.status}`)
          }

          const data = (await response.json()) as MapboxDirectionsResponse

          const route = data.routes?.[0]

          if (!route) {
            throw new Error('ROUTE_NOT_FOUND')
          }

          const coordinatesResult = route?.geometry?.coordinates

          if (
            data.code !== 'Ok' ||
            !Array.isArray(coordinatesResult) ||
            coordinatesResult.length < 2
          ) {
            throw new Error('ROUTE_NOT_FOUND')
          }

          /*
           * Mapbox GeoJSON:
           *
           * [longitude, latitude]
           *
           * Leaflet:
           *
           * [latitude, longitude]
           */
          const actualRoutePositions: [number, number][] = coordinatesResult
            .filter(
              (coordinate) =>
                Array.isArray(coordinate) &&
                coordinate.length >= 2 &&
                Number.isFinite(coordinate[0]) &&
                Number.isFinite(coordinate[1]),
            )
            .map((coordinate) => [coordinate[1], coordinate[0]])

          if (actualRoutePositions.length < 2) {
            throw new Error('INVALID_ROUTE')
          }

          if (
            cancelled ||
            mapRef.current !== map ||
            !map.getContainer().isConnected
          ) {
            return
          }

          /*
           * 실제 도로/보행/자전거 경로는 실선으로 표시한다.
           */
          routeLineRef.current = L.polyline(actualRoutePositions, {
            weight: 5,

            opacity: 0.9,

            lineCap: 'round',

            lineJoin: 'round',
          }).addTo(map)

          routeDrawn = true

          setRouteSummary({
            distanceMeters:
              typeof route.distance === 'number' ? route.distance : null,

            durationSeconds:
              typeof route.duration === 'number' ? route.duration : null,

            actualRoute: true,

            message: '',
          })
        } catch (error) {
          /*
           * 컴포넌트가 제거되면서 요청이 취소된 경우
           * 별도 fallback 작업을 하지 않는다.
           */
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }

          if (
            cancelled ||
            mapRef.current !== map ||
            !map.getContainer().isConnected
          ) {
            return
          }

          let message =
            '실제 경로를 불러오지 못해 Mission 위치를 직선으로 연결했습니다.'

          if (
            error instanceof Error &&
            error.message === 'MAPBOX_TOKEN_MISSING'
          ) {
            message =
              '경로 API가 아직 설정되지 않아 Mission 위치를 직선으로 표시하고 있습니다.'
          }

          if (error instanceof Error && error.message === 'TOO_MANY_MISSIONS') {
            message =
              'Mission이 25개를 초과하여 현재는 직선 추천 경로로 표시합니다.'
          }

          setRouteSummary({
            distanceMeters: null,

            durationSeconds: null,

            actualRoute: false,

            message,
          })
        }

        /*
         * 실제 경로를 만들지 못했을 경우
         * 기존 직선 점선 방식으로 표시한다.
         *
         * 따라서 Mapbox 장애나 토큰 문제가 있어도
         * Challenge 상세 화면은 정상적으로 유지된다.
         */
        if (
          !routeDrawn &&
          !cancelled &&
          mapRef.current === map &&
          map.getContainer().isConnected
        ) {
          routeLineRef.current = L.polyline(missionPositions, {
            weight: 4,

            opacity: 0.8,

            dashArray: '10 8',

            lineCap: 'round',

            lineJoin: 'round',
          }).addTo(map)
        }
      }

      /*
       * React 렌더링이 완료된 다음
       * Leaflet이 실제 컨테이너 크기를 다시 계산한다.
       */
      resizeTimer = setTimeout(() => {
        if (
          cancelled ||
          mapRef.current !== map ||
          !map.getContainer().isConnected
        ) {
          return
        }

        map.invalidateSize({
          animate: false,
        })

        /*
         * Mission이 하나면 해당 장소 중심으로 표시.
         */
        if (missionPositions.length === 1) {
          map.setView(missionPositions[0], 15, {
            animate: false,
          })

          return
        }

        /*
         * Mission이 여러 개라면
         * 모든 Mission Marker가 한 화면에 들어오도록 맞춘다.
         */
        const bounds = L.latLngBounds(missionPositions)

        if (!bounds.isValid()) {
          return
        }

        map.fitBounds(bounds, {
          padding: [55, 55],

          maxZoom: 16,

          animate: false,
        })
      }, 0)
    }

    void initializeMap()

    return () => {
      cancelled = true

      /*
       * 실행 중인 Directions 요청도 취소한다.
       */
      abortController.abort()

      /*
       * 아직 실행되지 않은 Leaflet 크기 조절 작업을 취소한다.
       *
       * _leaflet_pos 오류 방지에서 중요하다.
       */
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer)
      }

      markersRef.current = []

      routeLineRef.current = null

      /*
       * 현재 effect에서 생성한 Map만 제거한다.
       */
      if (currentMap) {
        currentMap.off()

        currentMap.remove()

        if (mapRef.current === currentMap) {
          mapRef.current = null
        }
      }
    }
  }, [orderedMissions, completedMissionKey, routeMode])

  const routeModeLabel = getRouteModeLabel(routeMode)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {orderedMissions.length > 0 ? (
        <div ref={containerRef} className="h-96 w-full lg:h-115" />
      ) : (
        <div className="flex h-80 items-center justify-center bg-slate-50 px-6 text-center">
          <div>
            <p className="font-bold text-slate-700">
              표시할 Mission이 없습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              현재 공개된 Mission이 등록되면 추천 이동 경로가 지도에 표시됩니다.
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-800">추천 이동 경로</p>

              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                {routeModeLabel}
              </span>

              {routeSummary.actualRoute && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  실제 경로
                </span>
              )}
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              번호는 기관이 설정한 추천 이동 순서이며 Mission은 원하는 순서대로
              자유롭게 수행할 수 있습니다.
            </p>

            {routeSummary.actualRoute &&
              (routeSummary.distanceMeters !== null ||
                routeSummary.durationSeconds !== null) && (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {routeSummary.distanceMeters !== null && (
                    <>
                      예상 이동거리{' '}
                      {formatDistance(routeSummary.distanceMeters)}
                    </>
                  )}

                  {routeSummary.distanceMeters !== null &&
                    routeSummary.durationSeconds !== null && (
                      <span className="mx-2 text-slate-300">•</span>
                    )}

                  {routeSummary.durationSeconds !== null && (
                    <>
                      예상 소요시간{' '}
                      {formatDuration(routeSummary.durationSeconds)}
                    </>
                  )}
                </p>
              )}

            {routeSummary.message && (
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-600">
                {routeSummary.message}
              </p>
            )}
          </div>

          <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
            총 {orderedMissions.length}개 Mission
          </span>
        </div>
      </div>
    </div>
  )
}

/*
 * Challenge에 저장된 이동수단을
 * Mapbox Directions profile로 변환한다.
 */
function getMapboxProfile(routeMode: ChallengeRouteMode) {
  switch (routeMode) {
    case 'CYCLING':
      return 'mapbox/cycling'

    case 'DRIVING':
      return 'mapbox/driving'

    case 'WALKING':
    default:
      return 'mapbox/walking'
  }
}

/*
 * 화면에 표시할 이동수단 이름.
 */
function getRouteModeLabel(routeMode: ChallengeRouteMode) {
  switch (routeMode) {
    case 'CYCLING':
      return '🚲 자전거'

    case 'DRIVING':
      return '🚗 자동차'

    case 'WALKING':
    default:
      return '🚶 도보'
  }
}

/*
 * 미터 단위 거리를 사용자에게 보기 좋은 형태로 변환한다.
 */
function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`
}

/*
 * 초 단위 시간을 분 / 시간으로 변환한다.
 */
function formatDuration(durationSeconds: number) {
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60))

  if (totalMinutes < 60) {
    return `약 ${totalMinutes}분`
  }

  const hours = Math.floor(totalMinutes / 60)

  const minutes = totalMinutes % 60

  if (minutes === 0) {
    return `약 ${hours}시간`
  }

  return `약 ${hours}시간 ${minutes}분`
}

/*
 * Leaflet popup에 Mission 데이터의 HTML이
 * 직접 실행되지 않도록 escape 처리한다.
 */
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
