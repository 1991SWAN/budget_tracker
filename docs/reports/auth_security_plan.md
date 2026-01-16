# 🔐 Auth Security Enhancement Plan: Leaked Password Protection

*Date: 2026-01-17*
*Status: Proposal*
*Module: Supabase Auth / Frontend*

## 1. 이슈 개요 (Issue Overview)

**경고**: `Supabase Auth prevents the use of compromised passwords...`
**내용**: Supabase는 [HaveIBeenPwned API](https://haveibeenpwned.com/)와 연동하여, 이미 유출된(해킹된) 비밀번호의 사용을 원천 차단하는 강력한 보안 기능을 제공합니다. 현재 이 기능이 비활성화되어 있어 활성화를 권장하는 메시지입니다.

---

## 2. 조치 방법 (Action Items)

이 기능은 코드 수정이 아닌, **Supabase 대시보드 설정**을 통해 활성화해야 합니다. SQL로는 제어할 수 없습니다.

### 2.1 대시보드 설정 (Dashboard Configuration)
1.  **Supabase Dashboard** 접속
2.  좌측 메뉴 **Authentication** -> **Providers** -> **Email** (또는 **Security**) 클릭
3.  **Password Protection** 섹션 탐색
4.  **"Prevent usage of leaked passwords"** 옵션을 **Enable(켜기)** 로 변경
5.  **Save** 클릭

### 2.2 프론트엔드 UX 개선 제안 (Frontend UX)

이 기능을 켜면, 사용자가 유출된 비밀번호로 가입을 시도할 때 에러가 발생합니다. 현재 `LoginView.tsx`는 일반적인 에러 메시지만 보여주므로 (`addToast(error.message...)`), 이를 더 친절하게 안내하는 개선이 필요합니다.

**현재 코드 (`LoginView.tsx`)**:
```typescript
catch (error: any) {
    addToast(error.message || 'Authentication failed', 'error');
}
```

**개선 제안 (Action Item)**:
특정 에러 키워드(예: `weak_password`, `pwned`)를 감지하여 구체적인 가이드를 제공해야 합니다.

```typescript
// 추후 구현 예시
catch (error: any) {
    if (error.message?.includes("security") || error.code === 'weak_password') {
        addToast("⚠️ 보안 위험: 해당 비밀번호는 인터넷에 유출된 기록이 있습니다. 다른 비밀번호를 사용해 주세요.", 'error');
    } else {
        addToast(error.message || 'Authentication failed', 'error');
    }
}
```

---

## 3. 권장 정책 (Recommended Policy)

Supabase AI가 제안한 추가 보안 조치들도 함께 검토를 권장합니다.

1.  **비밀번호 최소 길이**: 6자 -> **8자 이상**으로 상향 조정 (대시보드 설정)
2.  **보안 문자 사용 강제**: 숫자/특수문자 혼용 권장
3.  **MFA (다중 인증)**: 관리자 계정 등 중요 계정에 대해 도입 고려

## 4. 결론

지금 즉시 **대시보드에서 "Leaked Password Protection"을 켜시는 것**을 강력히 권장합니다. 이는 사용자의 계정을 해킹 위협으로부터 보호하는 가장 쉽고 강력한 방법입니다. 프론트엔드 메시지 개선은 다음 작업으로 진행할 수 있습니다.
