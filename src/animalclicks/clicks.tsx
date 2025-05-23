import { useEffect, useState } from 'react';
//@ts-ignore
import AnimalClicks from 'animalclicks';
import './clicks.css';

import 'bootstrap/dist/css/bootstrap.min.css';

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

  // @ts-ignore
  let animalClicksInstance: AnimalClicks = null;

  useEffect(() => {
    animalClicksInstance = new AnimalClicks(
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
    <>
      <div className="container card mx-auto settings-table">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">
                Inner Text (comma-separated):
                <input
                  type="text"
                  className="form-control"
                  value={innerText.join(',')}
                  onChange={handleInnerTextChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Time (ms):
                <input
                  type="number"
                  className="form-control"
                  value={time}
                  onChange={handleTimeChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Quality:
                <input
                  type="number"
                  className="form-control"
                  value={quality}
                  onChange={handleQualityChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Angle (degrees):
                <input
                  type="number"
                  className="form-control"
                  value={angle}
                  onChange={handleAngleChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Velocity X:
                <input
                  type="number"
                  className="form-control"
                  value={velocityX}
                  onChange={handleVelocityXChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Velocity Y:
                <input
                  type="number"
                  className="form-control"
                  value={velocityY}
                  onChange={handleVelocityYChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                Gravity:
                <input
                  type="number"
                  className="form-control"
                  value={gravity}
                  onChange={handleGravityChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                DX:
                <input
                  type="number"
                  className="form-control"
                  value={dx}
                  onChange={handleDxChange}
                />
              </label>
            </div>
            <div className="col-md-4">
              <label className="form-label">
                DY:
                <input
                  type="number"
                  className="form-control"
                  value={dy}
                  onChange={handleDyChange}
                />
              </label>
            </div>
            <div className="col-12">
              <h5>Effects:</h5>
              <div className="d-flex flex-wrap justify-content-center gap-3">
                {Object.entries(effects).map(([name, checked], index) => (
                  <div className="form-check" key={index}>
                    <input
                      type="checkbox"
                      name={name}
                      className="form-check-input"
                      checked={checked}
                      onChange={handleEffectsChange}
                    />
                    <label className="form-check-label">
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <p className="alert alert-info text-center col-12">
              Click anywhere to see animals drop!
            </p>
          </div>
        </div>
      </div>
    </>
  );  
}

export default Clicks;