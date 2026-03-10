export function CL1Architecture() {
  const w = 720;
  const h = 200;
  const boxH = 56;
  const boxR = 6;
  const y = (h - boxH) / 2;

  const boxes = [
    { x: 20, w: 130, label: 'DOOM pixels', sub: '(simplified)', fill: '#1a1a2e' },
    { x: 180, w: 130, label: 'PPO encoder', sub: 'silicon', fill: '#16213e' },
    { x: 340, w: 140, label: '200k neurons', sub: 'biological', fill: '#2a1a1a' },
    { x: 510, w: 130, label: 'CNN decoder', sub: 'silicon', fill: '#16213e' },
    { x: 670, w: 40, label: 'Act', sub: '', fill: '#1a2e1a' },
  ];

  const arrows = [
    [150, 310],
    [310, 340],
    [480, 510],
    [640, 670],
  ];

  return (
    <figure style={{ margin: '2rem 0', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: 'block', margin: '0 auto' }}>
        {boxes.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={y} width={b.w} height={boxH} rx={boxR} fill={b.fill} stroke="#444" strokeWidth={1} />
            <text x={b.x + b.w / 2} y={y + 24} textAnchor="middle" fill="#ddd" fontSize={12} fontFamily="monospace">
              {b.label}
            </text>
            {b.sub && (
              <text x={b.x + b.w / 2} y={y + 42} textAnchor="middle" fill="#666" fontSize={10} fontFamily="monospace">
                {b.sub}
              </text>
            )}
          </g>
        ))}
        {arrows.map(([x1, x2], i) => (
          <g key={`a${i}`}>
            <line x1={x1} y1={h / 2} x2={x2 - 6} y2={h / 2} stroke="#555" strokeWidth={1.5} />
            <polygon points={`${x2},${h / 2} ${x2 - 8},${h / 2 - 4} ${x2 - 8},${h / 2 + 4}`} fill="#555" />
          </g>
        ))}
        {/* Highlight bracket around the silicon parts */}
        <text x={245} y={y - 10} textAnchor="middle" fill="#555" fontSize={9} fontFamily="monospace">
          silicon
        </text>
        <text x={575} y={y - 10} textAnchor="middle" fill="#555" fontSize={9} fontFamily="monospace">
          silicon
        </text>
        <text x={410} y={y + boxH + 20} textAnchor="middle" fill="#994444" fontSize={10} fontFamily="monospace">
          the "playing DOOM" part
        </text>
      </svg>
      <figcaption style={{ fontSize: '0.8rem', color: '#666', marginTop: 8, textAlign: 'center' }}>
        The CL1 architecture. The biological neurons sit between two conventional ML systems.
      </figcaption>
    </figure>
  );
}
