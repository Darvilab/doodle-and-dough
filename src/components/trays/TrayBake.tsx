import React from 'react';

interface TrayBakeProps {
  doneness: number;
}

export const TrayBake: React.FC<TrayBakeProps> = ({ doneness }) => {
  const needlePct = Math.min(100, Math.max(0, (doneness / 1.05) * 100));

  let tempTxt = `Inferno at ${Math.round(200 + doneness * 250)}°C`;
  let tempColor = 'var(--ink2)';
  let isPeak = false;
  let isBurnt = false;

  if (doneness >= 0.86) {
    tempTxt = '⚠️ CHARRED! Pull immediately!';
    tempColor = 'var(--tomato-d)';
    isBurnt = true;
  } else if (doneness >= 0.72) {
    tempTxt = '🔥 PEAK CRISP! PULL NOW! 🔥';
    tempColor = 'var(--basil)';
    isPeak = true;
  }

  return (
    <>
      <div className="stage-ribbon stage-ribbon-bake">
        <span className="star">🔥</span>
        <span>LEVEL 5: WOOD-FIRED INFERNO</span>
        <span className="star">🔥</span>
      </div>

      <div className={`tray-top game-tray-top ${isPeak ? 'oven-peak-glow' : ''}`}>
        <div className="tray-ic flame-dancing">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 3 C12.5 6.5 16.5 8.5 16.5 12.5 C16.5 15.5 14.5 17.5 12 17.5 C9.5 17.5 7.5 15.5 7.5 12.5 C7.5 10.5 8.6 9.3 9.4 7.8 C9.9 9 10.6 9.7 11.4 10.2 C11.2 8 11.4 5.5 12 3Z"
              fill="#E04622"
              stroke="#33241A"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 9 C13 11 14.5 12.5 14.5 14.5 C14.5 16 13.5 17 12 17 C10.5 17 9.5 16 9.5 14.5 C9.5 13 10.5 11.5 12 9Z"
              fill="#F5C036"
            />
          </svg>
        </div>
        <div className="tray-txt">
          <b>Wood-Fired Pizza Oven</b>
          <small
            id="tempTxt"
            className={isPeak ? 'peak-text-pulse' : isBurnt ? 'burnt-text-pulse' : ''}
            style={{ color: tempColor, fontWeight: isPeak || isBurnt ? 800 : 600 }}
          >
            {tempTxt}
          </small>
        </div>
      </div>

      <div className={`bakewrap game-bakewrap ${isPeak ? 'bakewrap-peak' : ''}`}>
        <i style={{ width: '42.9%', background: '#E3D3A8' }} />
        <i style={{ width: '25.7%', background: '#E2BC72' }} />
        <i style={{ width: '13.3%', background: 'var(--basil)' }} />
        <i style={{ width: '18.1%', background: '#8C4A1F' }} />
        <i className="tick" style={{ left: '68.6%' }} />
        <i className="tick" style={{ left: '81.9%' }} />
        <div
          className={`needle ${isPeak ? 'needle-peak' : ''}`}
          id="needle"
          style={{ left: `${needlePct}%` }}
        />
      </div>

      <div className="gauge-labels">
        <span style={{ left: '21%' }}>Doughy</span>
        <span style={{ left: '55%' }}>Golden</span>
        <span style={{ left: '75%' }} className={`hot ${isPeak ? 'hot-peak' : ''}`}>
          Pull now ⭐
        </span>
        <span style={{ left: '91%' }}>Char</span>
      </div>
    </>
  );
};
