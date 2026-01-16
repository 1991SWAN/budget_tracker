# 🐛 Bug Analysis: Asset History Clear Regression

*Date: 2026-01-17*
*Status: Identified*
*Type: Regression (Code Removal)*

## 1. 사용자의 기억 검증 (Verification)
사용자님의 기억이 **정확합니다.**
오늘 작업 중 **"거래 내역을 지우면 모달 상태에서도 리프레쉬(동기화) 하는 로직"**이 구현되었으나, 이후 다른 작업 과정에서 해당 코드가 **삭제(Reverted)** 된 것으로 확인되었습니다.

### 1.1 삭제된 코드 (Evidence)
`App.tsx` 파일에서 다음 `useEffect` 훅이 제거되었습니다. (Step Id: 16618 확인)

```typescript
// [삭제된 코드]
// --- Reactive Modal Sync ---
// Ensure open modals always show the latest data
useEffect(() => {
  if (!selectedItem) return;

  // 1. Sync Asset Modals
  if ('balance' in selectedItem && 'type' in selectedItem) {
    const freshAsset = assets.find(a => a.id === selectedItem.id);
    if (freshAsset && freshAsset !== selectedItem) {
      setSelectedItem(freshAsset); // 🔄 여기서 모달을 최신 상태로 강제 업데이트했었음
    }
  }
  // ... (Recurring, Goals sync)
}, [assets, recurring, goals, selectedItem]);
```

## 2. 왜 문제가 재발했는가? (Why it happened)
*   위 코드는 `assets` 배열(전역 상태)이 변경되면, 현재 열려있는 `selectedItem`(모달 상태)을 즉시 최신 데이터로 교체해주는 역할을 했습니다.
*   `onClearHistory`가 실행되면 `assets`의 잔액 등이 변경될 수 있는데, 이 싱크 로직이 사라지면서 **모달이 "과거의 자산 객체"를 계속 들고 있게 되었습니다.**
*   (참고: AssetManager 내부에도 비슷한 싱크 로직이 있지만, `App.tsx` 레벨에서 `TransactionList`와의 연동성 측면에서 차이가 있을 수 있습니다.)

## 3. 조치 방안 (Action Plan)
삭제된 **"Reactive Modal Sync" 로직을 `App.tsx`에 복구**해야 합니다.
이 코드가 있어야 DB/전역 상태가 변했을 때 모달(UI)도 즉시 반응하여 최신 잔액과 내역(차트)을 보여줍니다.

저희가 바로 복구 작업을 진행하면 됩니다.
