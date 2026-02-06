import { useEffect, useRef, useState } from 'react';
import AnimalClicks from './index.js';
import PageShell from '../components/PageShell';
import './clicks.css';

function Clicks() {
  const [innerText, setInnerText] = useState(['🦝','😺','🐶']);
  const [time, setTime] = useState(2000);
  const [angle, setAngle] = useState(180);
  const [quality, setQuality] = useState(10);
  const [velocityX, setVelocityX] = useState(2.5);
  const [velocityY, setVelocityY] = useState(4.5);
  const [gravity, setGravity] = useState(0.075);
  const [dx, setDx] = useState(10);
  const [dy, setDy] = useState(10);
  const [effects, setEffects] = useState({
    random: false,
    physics: true,
    fade: true,
    hideCursor: true,
  });

  const instanceRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    instanceRef.current = new AnimalClicks(
      innerText,
      time,
      quality,
      angle,
      velocityX,
      velocityY,
      gravity,
      dx,
      dy,
      effects
    );

    return () => {
      if (instanceRef.current) {
        instanceRef.current.shutdown();
        instanceRef.current = null;
      }
    };
  }, [innerText, time, quality, angle, velocityX, velocityY, gravity, dx, dy, effects]);

  const handleInnerTextChange = (e: React.ChangeEvent<HTMLInputElement>) => setInnerText(e.target.value.split(','));
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setTime(Number(e.target.value));
  const handleQualityChange = (e: React.ChangeEvent<HTMLInputElement>) => setQuality(Number(e.target.value));
  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => setAngle(Number(e.target.value));
  const handleVelocityXChange = (e: React.ChangeEvent<HTMLInputElement>) => setVelocityX(Number(e.target.value));
  const handleVelocityYChange = (e: React.ChangeEvent<HTMLInputElement>) => setVelocityY(Number(e.target.value));
  const handleGravityChange = (e: React.ChangeEvent<HTMLInputElement>) => setGravity(Number(e.target.value));
  const handleDxChange = (e: React.ChangeEvent<HTMLInputElement>) => setDx(Number(e.target.value));
  const handleDyChange = (e: React.ChangeEvent<HTMLInputElement>) => setDy(Number(e.target.value));

  const handleEffectsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEffects((prevEffects) => ({
      ...prevEffects,
      [name]: checked,
    }));
  };

  return (
    <PageShell>
      <div className="clicks-page">
        <h1 className="clicks-page__title">AnimalClicks</h1>
        <p className="clicks-page__subtitle">
          Interactive demo of the{' '}
          <a href="https://www.npmjs.com/package/animalclicks" target="_blank" rel="noopener noreferrer">
            animalclicks
          </a>{' '}
          NPM package — click anywhere on the page to see emoji animals drop with physics!
        </p>

        <div className="clicks-panel">
          <div className="clicks-grid">
            <div className="clicks-field">
              <label>Inner Text (comma-separated)</label>
              <input type="text" value={innerText.join(',')} onChange={handleInnerTextChange} />
            </div>
            <div className="clicks-field">
              <label>Time (ms)</label>
              <input type="number" value={time} onChange={handleTimeChange} />
            </div>
            <div className="clicks-field">
              <label>Quality</label>
              <input type="number" value={quality} onChange={handleQualityChange} />
            </div>
            <div className="clicks-field">
              <label>Angle (degrees)</label>
              <input type="number" value={angle} onChange={handleAngleChange} />
            </div>
            <div className="clicks-field">
              <label>Velocity X</label>
              <input type="number" value={velocityX} onChange={handleVelocityXChange} />
            </div>
            <div className="clicks-field">
              <label>Velocity Y</label>
              <input type="number" value={velocityY} onChange={handleVelocityYChange} />
            </div>
            <div className="clicks-field">
              <label>Gravity</label>
              <input type="number" value={gravity} onChange={handleGravityChange} />
            </div>
            <div className="clicks-field">
              <label>DX</label>
              <input type="number" value={dx} onChange={handleDxChange} />
            </div>
            <div className="clicks-field">
              <label>DY</label>
              <input type="number" value={dy} onChange={handleDyChange} />
            </div>
          </div>

          <div className="clicks-effects">
            <h3 className="clicks-effects__title">Effects</h3>
            <div className="clicks-effects__list">
              {Object.entries(effects).map(([name, checked], index) => (
                <label className="clicks-checkbox" key={index}>
                  <input
                    type="checkbox"
                    name={name}
                    checked={checked}
                    onChange={handleEffectsChange}
                  />
                  <span>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="clicks-hint">
            Click anywhere to see animals drop!
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default Clicks;
