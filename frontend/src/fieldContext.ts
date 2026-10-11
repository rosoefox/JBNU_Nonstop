import { createContext, useContext } from 'react'
import { Field } from './types'

// 여러 페이지가 같이 쓰는 "선택한 논·지역" 상태 (값은 App.tsx에서 채움)
interface FieldContextType {
  selectedRegion: string
  selectedFieldId: number | null
  setSelectedRegion: (region: string) => void
  setSelectedFieldId: (fieldId: number | null) => void
  // 논을 고르면 그 논의 지역도 같이 맞춤
  selectField: (fieldId: number | null, fields: Field[]) => void
}

export const FieldContext = createContext<FieldContextType>({
  selectedRegion: '',
  selectedFieldId: null,
  setSelectedRegion: () => {},
  setSelectedFieldId: () => {},
  selectField: () => {},
})

export const useFieldContext = () => useContext(FieldContext)
