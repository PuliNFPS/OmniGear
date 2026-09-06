const CENTER_X = 110;
const CENTER_Y = 104;
const RADIUS = 82;
const TICKS = 25;

function pointOnArc(fraction: number, radius: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: CENTER_X + Math.cos(angle) * radius, y: CENTER_Y - Math.sin(angle) * radius };
}

/** Visual reading of the sensor rotation. The slider beside it is the control. */
export function RotationDial({ value, min, max }: { value: number; min: number; max: number }) {
  const fraction = (value - min) / (max - min);
  const needle = pointOnArc(fraction, RADIUS - 12);

  return (
    <svg viewBox="0 0 220 120" className="w-full" fill="none" aria-hidden="true" focusable="false">
      {Array.from({ length: TICKS }, (_, index) => {
        const tickFraction = index / (TICKS - 1);
        const outer = pointOnArc(tickFraction, RADIUS);
        const inner = pointOnArc(tickFraction, RADIUS - (index % 6 === 0 ? 14 : 8));
        return (
          <path
            key={index}
            d={`M${inner.x.toFixed(2)} ${inner.y.toFixed(2)} L${outer.x.toFixed(2)} ${outer.y.toFixed(2)}`}
            className="stroke-strong"
            strokeWidth={index % 6 === 0 ? 1.4 : 0.8}
          />
        );
      })}
      <path
        d={`M${CENTER_X} ${CENTER_Y} L${needle.x.toFixed(2)} ${needle.y.toFixed(2)}`}
        className="stroke-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx={CENTER_X} cy={CENTER_Y} r="4" className="fill-foreground" />
    </svg>
  );
}
