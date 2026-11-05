'use client'

import { useEffect, useMemo, useRef } from 'react'

import type { Map as LeafletMap, Marker, Polyline } from 'leaflet'

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
}

export default function ChallengeSummaryMap({
  missions,
  completedMissionIds = [],
}: ChallengeSummaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<LeafletMap | null>(null)

  const markersRef = useRef<Marker[]>([])

  const routeLineRef = useRef<Polyline | null>(null)

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
       * 요약 지도에서는 애니메이션을 사용하지 않는다.
       *
       * React에서 Leaflet Map이 제거되는 순간
       * zoom animation이 남아 있으면
       * _leaflet_pos 관련 오류가 발생할 수 있기 때문이다.
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,

        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      /*
       * Mission이 하나도 없으면
       * 기본 대한민국 지도만 표시한다.
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

      const routePositions: [number, number][] = []

      orderedMissions.forEach((mission, index) => {
        const position: [number, number] = [mission.latitude, mission.longitude]

        routePositions.push(position)

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
       * Mission 추천 이동 경로.
       *
       * 실제 도보 길찾기 경로가 아니라
       * 기관에서 지정한 Mission 순서를
       * 시각적으로 표현한 선이다.
       */
      if (routePositions.length >= 2) {
        routeLineRef.current = L.polyline(routePositions, {
          weight: 4,

          opacity: 0.8,

          dashArray: '10 8',

          lineCap: 'round',

          lineJoin: 'round',
        }).addTo(map)
      }

      /*
       * React 렌더링이 끝난 다음
       * Leaflet이 실제 컨테이너 크기를 계산하도록 한다.
       *
       * cleanup 이후 실행되지 않도록
       * cancelled / mapRef / isConnected를 모두 검사한다.
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
         * Mission이 하나면 그 장소를 중심으로 표시.
         */
        if (routePositions.length === 1) {
          map.setView(routePositions[0], 15, {
            animate: false,
          })

          return
        }

        /*
         * Mission이 여러 개면
         * 모든 장소가 한 화면 안에 들어오도록 조절한다.
         */
        const bounds = L.latLngBounds(routePositions)

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
       * 아직 실행되지 않은 Leaflet 크기 조절 작업을 취소한다.
       *
       * 이 부분이 _leaflet_pos 오류 방지에서 중요하다.
       */
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer)
      }

      markersRef.current = []

      routeLineRef.current = null

      /*
       * 현재 effect가 만든 Map만 제거한다.
       */
      if (currentMap) {
        currentMap.off()

        currentMap.remove()

        if (mapRef.current === currentMap) {
          mapRef.current = null
        }
      }
    }
  }, [orderedMissions, completedMissionKey])

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">추천 이동 경로</p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              번호는 추천 이동 순서이며 Mission은 원하는 순서대로 자유롭게
              수행할 수 있습니다.
            </p>
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
