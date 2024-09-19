import React, { useState, useEffect } from 'react';
import Welcome from './welcome/welcome.tsx';
import Profile from './profile/profile.tsx';

const App: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    // Hide the Welcome component and show the Profile component after 2 seconds
    const timer = setTimeout(() => {
      setShowWelcome(false);
      setShowProfile(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {showWelcome && <Welcome />}
      {showProfile && <Profile />}
    </div>
  );
};

export default App;