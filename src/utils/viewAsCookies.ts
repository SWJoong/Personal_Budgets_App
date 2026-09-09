// view-as 쿠키 이름 상수 — 클라이언트/서버 공용. ★서버 전용(next/headers 등) import 금지:
// ViewAsBanner·ParticipantFab 등 클라이언트 컴포넌트가 이 파일을 import 하므로, 여기에 서버 코드가
// 섞이면 클라이언트 번들에 끌려 들어가 빌드가 깨진다. 실제 읽기/판정 로직은 server 전용 viewAs.ts.
export const VIEW_AS_ID_COOKIE = 'view_as_participant'
export const VIEW_AS_NAME_COOKIE = 'view_as_name'
