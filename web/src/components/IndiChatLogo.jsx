export default function IndiChatLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f8ef7"/>
          <stop offset="100%" stopColor="#7c6af7"/>
        </linearGradient>
        <linearGradient id="arrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a0c4ff"/>
          <stop offset="100%" stopColor="#ffffff"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Rounded square background */}
      <rect width="100" height="100" rx="24" fill="url(#bg)"/>
      <rect width="100" height="100" rx="24" fill="white" fillOpacity="0.06"/>

      {/* Globe outer ring */}
      <circle cx="46" cy="52" r="28" stroke="white" strokeWidth="2.5" strokeOpacity="0.9" fill="none"/>

      {/* Globe latitude lines */}
      <ellipse cx="46" cy="52" rx="28" ry="10" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" fill="none"/>
      <line x1="18" y1="40" x2="74" y2="40" stroke="white" strokeWidth="1.2" strokeOpacity="0.35"/>
      <line x1="18" y1="64" x2="74" y2="64" stroke="white" strokeWidth="1.2" strokeOpacity="0.35"/>

      {/* Globe longitude lines */}
      <ellipse cx="46" cy="52" rx="14" ry="28" stroke="white" strokeWidth="1.5" strokeOpacity="0.45" fill="none"/>

      {/* Network nodes */}
      <circle cx="46" cy="24" r="3" fill="white" fillOpacity="0.95" filter="url(#glow)"/>
      <circle cx="46" cy="80" r="3" fill="white" fillOpacity="0.95"/>
      <circle cx="18" cy="52" r="3" fill="white" fillOpacity="0.95"/>
      <circle cx="74" cy="52" r="3" fill="white" fillOpacity="0.95"/>
      <circle cx="25" cy="33" r="2.2" fill="white" fillOpacity="0.8"/>
      <circle cx="67" cy="33" r="2.2" fill="white" fillOpacity="0.8"/>
      <circle cx="25" cy="71" r="2.2" fill="white" fillOpacity="0.8"/>
      <circle cx="67" cy="71" r="2.2" fill="white" fillOpacity="0.8"/>

      {/* Node connections */}
      <line x1="46" y1="24" x2="25" y2="33" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="46" y1="24" x2="67" y2="33" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="25" y1="33" x2="18" y2="52" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="67" y1="33" x2="74" y2="52" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="18" y1="52" x2="25" y2="71" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="74" y1="52" x2="67" y2="71" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="25" y1="71" x2="46" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
      <line x1="67" y1="71" x2="46" y2="80" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>

      {/* Shine overlay */}
      <rect x="0" y="0" width="100" height="50" rx="24" fill="white" fillOpacity="0.04"/>
    </svg>
  );
}
