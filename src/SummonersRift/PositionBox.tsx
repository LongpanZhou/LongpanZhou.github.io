import PanelChrome from './PanelChrome'

interface Props {
  pos: { x: number; y: number; z: number }
  rot: { yaw: number; pitch: number }
}

// One line: the live text, and an invisible copy of the widest text it can become, stacked in
// the same grid cell so the line never changes width.
function Line({ text, widest }: { text: string; widest: string }) {
  return (
    <div className="position-line">
      <span>{text}</span>
      <span className="position-ghost" aria-hidden="true">{widest}</span>
    </div>
  )
}

// The camera readout, top left. Resizable; after a resize its text grows to fill the box.
export default function PositionBox({ pos, rot }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '100px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: 'calc(15px * var(--hud-scale, 1)) calc(20px * var(--hud-scale, 1))',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.45',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      data-hud-draw="Position"
      data-hud-always
      data-hud-fade
    >
      <PanelChrome id="position" label="Position" resizable fillText minWidth={110} minHeight={34} />
      <Line
        text={`Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`}
        widest="Position: (-000.0, -000.0, -000.0)"
      />
      <Line
        text={`Yaw: ${rot.yaw.toFixed(1)}° | Pitch: ${rot.pitch.toFixed(1)}°`}
        widest="Yaw: -000.0° | Pitch: -000.0°"
      />
    </div>
  )
}
