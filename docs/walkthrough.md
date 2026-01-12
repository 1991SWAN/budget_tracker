# 인증 및 보안 구현 워크스루 (Authentication & Security Walkthrough)

## 개요 (Overview)
기존의 로컬/익명 우선 방식에서 **Supabase Auth**를 사용한 안전한 사용자 인증 시스템으로 성공적으로 마이그레이션했습니다.
가장 중요한 점은 **행 수준 보안(RLS)**을 엄격하게 적용하여 사용자 데이터 간의 격리를 완벽하게 보장한다는 것입니다.

## 주요 변경 사항 (Key Changes)

### 1. 사용자 인증 (User Authentication)
- **로그인/가입 UI**: 이메일/비밀번호 지원을 포함한 `LoginView.tsx` 추가.
- **Google OAuth**: 구글 로그인 버튼 연동 (Supabase 프로젝트 설정과 일치).
- **전역 컨텍스트**: `AuthContext`가 세션 상태와 라우팅을 중앙에서 관리.

### 2. 데이터 격리 및 보안 (Data Isolation & Security - RLS)
- **스키마 업데이트**: 모든 주요 테이블(`transactions`, `assets` 등)에 `user_id` 컬럼 추가.
- **코드 로직**: `SupabaseService`가 새로운 데이터를 저장할 때 로그인된 `user_id`를 엄격하게 연결하도록 수정.
- **정책 적용 (Policy Enforcement)**:
    - 안전하지 않은 "모든 접근 허용(Enable all access)" 정책 제거.
    - 엄격한 RLS 정책 적용: `USING (auth.uid() = user_id)`.
    - **자신의 데이터만 볼 수 있도록** 강제함.

## 검증된 시나리오 (Validated Scenarios)
- [x] **신규 가입**: 깨끗한 빈 계정이 생성되는지 확인.
- [x] **데이터 보존**: 사용자 A가 생성한 데이터가 정상적으로 저장되고 조회되는지 확인.
- [x] **데이터 격리**: 사용자 B가 사용자 A의 데이터를 볼 수 없음 (NULL 필터링 및 RLS 확인).
- [x] **로그아웃**: 로컬 상태가 즉시 초기화되는지 확인.
- [x] **단일 기기 로그인 (Single Device)**: 다른 기기에서 로그인 시 기존 기기가 로그아웃되는지 검증.
- [x] **모바일 지원**: 모바일 환경에서 앱 구동(`crypto` 충돌 해결) 및 구글 로그인 작동(IP 설정) 확인.
- [x] **강력한 로그아웃**: 로그아웃 시 모든 로컬 토큰을 삭제하고 앱을 새로고침하여 "좀비 세션" 방지.
- [x] **새로고침 안정성 (Refresh Stability)**: 페이지 새로고침 시 데이터가 사라지거나(Race Condition) 앱이 멈추는(Deadlock) 치명적 버그 수정 완료.
- [x] **세션 유지 (Session Persistence)**: 브라우저 새로고침 시에도 동일한 기기 ID(Device ID)를 유지하여 "단일 기기" 경험 개선.

## 다음 단계 (Next Steps)
- **CSV 가져오기 재구축 (CSV Import Refactor)** (Task Priority #7) 작업을 진행합니다.
