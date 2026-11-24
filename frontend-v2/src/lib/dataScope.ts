// 화면에 보여줄 데이터 범위. 실험 모드 스위치를 따라감 (실험 모드 = 실험 데이터, 평소 = 실제 데이터)
// 실제 값은 queries.ts의 useDataScope()에서 서버 설정을 읽어 정함
export type DataScope = 'all' | 'real' | 'experiment'
