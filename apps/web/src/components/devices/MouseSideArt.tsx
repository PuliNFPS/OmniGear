/**
 * Side view used to illustrate the tracking height. The gap between the mouse
 * and the surface follows the chosen value; it is a drawing, not a measurement.
 */
export function MouseSideArt({ heightRatio }: { heightRatio: number }) {
  const lift = 4 + Math.min(1, Math.max(0, heightRatio)) * 16;
  const baseline = 104;
  const bodyTop = baseline - lift;

  return (
    <svg viewBox="0 0 320 120" className="w-full" fill="none" aria-hidden="true" focusable="false">
      <g transform={`translate(0 ${bodyTop - 100})`}>
        <path
          d="M34 100C28 92 30 82 40 74C62 58 100 44 142 36C180 29 218 30 240 40C262 50 276 68 278 84C279 94 274 100 266 100Z"
          className="fill-muted stroke-strong"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M128 39C130 60 132 80 132 99" className="stroke-strong" strokeWidth="1.5" />
        <rect
          x="88"
          y="50"
          width="30"
          height="13"
          rx="6.5"
          className="fill-background stroke-strong"
          strokeWidth="1.5"
        />
      </g>
      <path d="M20 104h280" className="stroke-strong" strokeWidth="1.5" />
      <path
        d={`M250 ${baseline - lift} h30`}
        className="stroke-muted-foreground"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <path
        d={`M262 ${baseline} V ${baseline - lift}`}
        className="stroke-foreground"
        strokeWidth="1.2"
      />
      <path
        d={`M258 ${baseline - 4} l4 4 l4 -4 M258 ${baseline - lift + 4} l4 -4 l4 4`}
        className="stroke-foreground"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
