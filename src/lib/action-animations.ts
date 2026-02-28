/**
 * Animations for approve, reject, and mark-paid actions.
 */
import confetti from "canvas-confetti";

/** Light green confetti for approval success */
export function fireApprovalConfetti() {
  const count = 80;
  const defaults = { origin: { y: 0.6 }, zIndex: 9999 };
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"];
  confetti({
    ...defaults,
    particleCount: count,
    colors,
    spread: 70,
    startVelocity: 35,
    decay: 0.9,
    scalar: 0.9,
  });
  confetti({
    ...defaults,
    particleCount: count * 0.4,
    colors,
    angle: 60,
    spread: 55,
    origin: { x: 0.2, y: 0.6 },
    startVelocity: 25,
    decay: 0.92,
    scalar: 0.85,
  });
  confetti({
    ...defaults,
    particleCount: count * 0.4,
    colors,
    angle: 120,
    spread: 55,
    origin: { x: 0.8, y: 0.6 },
    startVelocity: 25,
    decay: 0.92,
    scalar: 0.85,
  });
}
