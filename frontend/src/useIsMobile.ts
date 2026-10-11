import { useEffect, useState } from 'react'

// 창 크기가 바뀔 때마다 다시 판단 (처음 열 때 폭으로 고정되지 않게)
export default function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= maxWidth)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= maxWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [maxWidth])

  return isMobile
}
