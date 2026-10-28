/** Soft, decorative paths keep the login calm without a WebGL scene. */
export function LoginFlowBackground() {
  return (
    <div className="mind-login-flow" aria-hidden="true">
      <div className="mind-login-glow mind-login-glow-one" />
      <div className="mind-login-glow mind-login-glow-two" />
      <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id="login-flow-line" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#c4b5fd" stopOpacity="0.03" />
            <stop offset=".5" stopColor="#dfc8ff" stopOpacity=".45" />
            <stop offset="1" stopColor="#f5c5df" stopOpacity=".06" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#login-flow-line)" strokeWidth="1.2" strokeLinecap="round">
          <path d="M-180 740 C80 980 420 950 440 730 S120 470 160 260 S540 50 730 -120" />
          <path d="M-210 770 C90 1040 470 970 490 730 S170 450 210 250 S590 80 780 -100" />
          <path d="M-240 800 C100 1100 520 990 540 730 S220 430 260 240 S640 110 830 -80" />
          <path d="M760 1120 C610 880 780 690 1070 730 S1540 700 1480 400 S1130 100 1280 -120" />
          <path d="M810 1140 C660 900 830 720 1100 770 S1600 720 1530 400 S1180 100 1330 -120" />
          <path d="M860 1160 C710 920 880 750 1130 810 S1660 740 1580 400 S1230 100 1380 -120" />
        </g>
        <g fill="#e9d5ff" fillOpacity=".5">
          <circle cx="173" cy="511" r="5" />
          <circle cx="484" cy="789" r="4" />
          <circle cx="1233" cy="741" r="6" />
        </g>
      </svg>
    </div>
  );
}
