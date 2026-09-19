/**
 * The projector's permanent backdrop: deep navy gradient, a drifting wave
 * layer and a rig silhouette on the horizon.
 *
 * Everything here is decorative and `pointer-events-none`, so it can sit
 * behind any stage content without stealing clicks.
 */

export function OceanBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Depth gradient: lit at the surface, black at the bottom. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b2044] via-[#061530] to-[#02060f]" />

      {/* Cold glow from above, like light through water. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-15%,rgba(34,211,238,0.16)_0%,transparent_55%)]" />

      {/* Slow-rotating caustic sheen, adds life without drawing the eye. */}
      <div className="absolute -left-1/4 -top-1/4 h-[150%] w-[150%] animate-slow-spin bg-[conic-gradient(from_0deg,transparent_0%,rgba(34,211,238,0.05)_18%,transparent_36%,rgba(255,176,32,0.04)_58%,transparent_78%)]" />

      <RigSilhouette />
      <Waves />

      {/* Vignette keeps the focus centre-screen from the back of the room. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

/** Two offset wave bands scrolling at different speeds for a parallax feel. */
function Waves() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[22vh]">
      <div className="absolute inset-x-0 bottom-0 h-full w-[200%] animate-wave-drift-slow">
        <WaveBand opacity={0.28} color="#0e7490" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[78%] w-[200%] animate-wave-drift-fast">
        <WaveBand opacity={0.22} color="#22d3ee" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#02060f] to-transparent" />
    </div>
  );
}

/**
 * One tiling wave. The path spans 0..2400 and repeats identically at x=1200,
 * so translating by -50% loops seamlessly.
 */
function WaveBand({ opacity, color }: { opacity: number; color: string }) {
  const wave = "c 100 -28 200 -28 300 0 c 100 28 200 28 300 0 c 100 -28 200 -28 300 0 c 100 28 200 28 300 0";
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 2400 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`M 0 70 ${wave} ${wave} V 200 H 0 Z`}
        fill={color}
        opacity={opacity}
      />
    </svg>
  );
}

/** A jack-up on the horizon, bottom-right, deliberately low contrast. */
function RigSilhouette() {
  return (
    <svg
      className="absolute bottom-[14vh] right-[4vw] h-[26vh] w-auto opacity-[0.22]"
      viewBox="0 0 420 340"
      fill="none"
      aria-hidden="true"
    >
      <g fill="#7dd3fc">
        {/* Legs */}
        <rect x="70" y="92" width="11" height="248" />
        <rect x="330" y="92" width="11" height="248" />
        <rect x="200" y="70" width="11" height="270" />
        {/* Hull */}
        <path d="M 40 196 L 380 196 L 358 244 L 62 244 Z" />
        {/* Accommodation */}
        <rect x="58" y="152" width="78" height="46" />
        {/* Derrick */}
        <path d="M 236 44 L 296 44 L 316 196 L 216 196 Z" />
        <rect x="248" y="22" width="36" height="24" />
        {/* Flare boom */}
        <path d="M 380 200 L 418 168 L 412 162 L 374 194 Z" />
      </g>
      {/* Warning lights on the derrick */}
      <circle cx="266" cy="18" r="5" fill="#ffb020" className="animate-pulse" />
    </svg>
  );
}
