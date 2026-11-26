type ChallengeRatingProps = {
  averageRating?: number
  reviewCount?: number
  variant?: 'card' | 'hero'
}

export default function ChallengeRating({
  averageRating = 0,
  reviewCount = 0,
  variant = 'card',
}: ChallengeRatingProps) {
  const normalizedRating = Number.isFinite(averageRating)
    ? Math.max(0, Math.min(5, averageRating))
    : 0

  const normalizedCount = Number.isFinite(reviewCount)
    ? Math.max(0, Math.floor(reviewCount))
    : 0

  const hasReviews = normalizedCount > 0

  const displayedRating = hasReviews ? normalizedRating : 0

  const isHero = variant === 'hero'

  const stars = (
    <div
      className={`inline-flex items-center gap-0.5 ${
        isHero ? 'text-2xl' : 'text-lg'
      }`}
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent =
          Math.max(0, Math.min(1, displayedRating - (star - 1))) * 100

        return (
          <span key={star} className="relative inline-block leading-none">
            <span className={isHero ? 'text-white/35' : 'text-slate-200'}>
              ★
            </span>

            <span
              className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-400"
              style={{
                width: `${fillPercent}%`,
              }}
            >
              ★
            </span>
          </span>
        )
      })}
    </div>
  )

  if (isHero) {
    return (
      <div
        className="flex flex-col items-center gap-2"
        aria-label={
          hasReviews
            ? `평균 별점 ${displayedRating.toFixed(1)}점, 후기 ${normalizedCount}개`
            : '아직 평가 없음'
        }
      >
        {hasReviews ? (
          <>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-black text-white">
                {displayedRating.toFixed(1)}
              </span>

              <span className="pb-1 text-sm font-bold text-white/70">/ 5</span>
            </div>

            {stars}

            <p className="text-xs font-semibold text-white/80">
              여행자 후기 {normalizedCount}개
            </p>
          </>
        ) : (
          <>
            {stars}

            <p className="text-sm font-semibold text-white/80">
              아직 평가 없음
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={
        hasReviews
          ? `평균 별점 ${displayedRating.toFixed(1)}점, 후기 ${normalizedCount}개`
          : '아직 평가 없음'
      }
    >
      {stars}

      {hasReviews ? (
        <>
          <span className="text-sm font-black text-slate-800">
            {displayedRating.toFixed(1)}
          </span>

          <span className="text-xs font-semibold text-slate-400">
            ({normalizedCount})
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-slate-400">
          아직 평가 없음
        </span>
      )}
    </div>
  )
}
