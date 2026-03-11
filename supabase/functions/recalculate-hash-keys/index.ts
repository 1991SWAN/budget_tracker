import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * hashKey 재계산 Edge Function
 * 기존 DB의 hash_key를 방안 C(memo 공백 완전 제거) 기준으로 재계산합니다.
 *
 * 호출: POST /functions/v1/recalculate-hash-keys
 * Body: { "dry_run": true }  ← dry_run=true이면 실제 업데이트 없이 미리보기만
 */

// 기존 generateHashKey 로직 (방안 C: memo 공백 제거)
function generateHashKey(assetId: string, timestamp: number, amount: number, memo: string): string {
  const timeKey = Math.floor(timestamp / 60000);
  const normalizedMemo = memo.trim().replace(/\s/g, ""); // 방안 C
  const raw = `${assetId}|${timeKey}|${amount}|${normalizedMemo}`;

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run !== false; // 기본값: dry_run=true (안전)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. hash_key가 있는 모든 거래 조회
    const { data: transactions, error: fetchError } = await supabase
      .from("transactions")
      .select("id, asset_id, timestamp, amount, memo, hash_key")
      .not("hash_key", "is", null);

    if (fetchError) throw fetchError;
    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ message: "No transactions with hash_key found.", updated: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. 각 거래의 hash_key 재계산
    const updates: { id: string; old_hash: string; new_base_hash: string; new_hash: string }[] = [];

    // count 재계산을 위해 baseHash 카운터 유지
    const baseHashCounts = new Map<string, number>();

    for (const tx of transactions) {
      if (!tx.asset_id || !tx.timestamp || tx.amount === null || tx.amount === undefined) continue;

      const memo = tx.memo || "";
      const baseHash = generateHashKey(tx.asset_id, tx.timestamp, tx.amount, memo);

      const currentCount = baseHashCounts.get(baseHash) || 0;
      baseHashCounts.set(baseHash, currentCount + 1);

      // 기존 hashKey에서 subIdx 추출 (보존)
      const existingSubIdx = tx.hash_key
        ? parseInt(tx.hash_key.split("#").pop() ?? "0", 10)
        : 0;
      const subIdx = isNaN(existingSubIdx) ? 0 : existingSubIdx;

      const newHashKey = `${baseHash}#${currentCount}#${subIdx}`;

      if (newHashKey !== tx.hash_key) {
        updates.push({
          id: tx.id,
          old_hash: tx.hash_key,
          new_base_hash: baseHash,
          new_hash: newHashKey,
        });
      }
    }

    if (dryRun) {
      // dry_run: 변경 예정 목록만 반환
      return new Response(
        JSON.stringify({
          dry_run: true,
          total: transactions.length,
          will_update: updates.length,
          unchanged: transactions.length - updates.length,
          preview: updates.slice(0, 20), // 최대 20개만 미리보기
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. 실제 업데이트 (dry_run=false일 때만)
    let successCount = 0;
    let failCount = 0;

    for (const upd of updates) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ hash_key: upd.new_hash })
        .eq("id", upd.id);

      if (updateError) {
        console.error(`Failed to update ${upd.id}:`, updateError);
        failCount++;
      } else {
        successCount++;
      }
    }

    return new Response(
      JSON.stringify({
        dry_run: false,
        total: transactions.length,
        updated: successCount,
        unchanged: transactions.length - updates.length,
        failed: failCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
