import type { Result } from "../types/assessment";
export function screeningMessage(r: Result): string {
  if (r.kind === "tug") {
    if (!r.completed) return "미완료 검사: TUG 선별 기준을 적용하지 않습니다.";
    return r.seconds >= 12
      ? "TUG 12초 이상: CDC STEADI의 낙상위험 증가 관련 선별 소견입니다."
      : "TUG 12초 미만입니다. 이 결과만으로 낙상위험을 배제할 수 없습니다.";
  }
  const tandem = r.stages.find((s) => s.stage === 2);
  if (!tandem)
    return "Tandem 미실시: 해당 단계의 선별 기준을 적용하지 않습니다.";
  if (tandem.passed)
    return "Tandem 10초 유지. 이 결과만으로 낙상위험을 배제할 수 없습니다.";
  if (
    tandem.reason === "검사자 균형 상실 판정" ||
    tandem.reason === "외부 지지 필요"
  )
    return "Tandem 10초 유지 실패: CDC STEADI의 낙상위험 증가 관련 선별 소견입니다.";
  return "Tandem 중단 사유 확인 필요: 일반 중단은 균형 유지 실패로 간주하지 않으며 선별 기준을 적용하지 않습니다.";
}
