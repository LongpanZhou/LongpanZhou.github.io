import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Welcome from './welcome/welcome.tsx';
import Profile from './profile/profile.tsx';
import './App.css';

const App: React.FC = () => {
  const [showWelcome, setShowWelcome] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
      setShowProfile(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const profileVariants = {
    hidden: { opacity: 0, y: 0 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div>
      {showWelcome && <Welcome />}
      {showProfile && (
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ duration: 1 }}
          variants={profileVariants}
          style={{ zIndex: 1, position: 'relative' }}
        >
          <Profile />
        </motion.div>
      )}
    </div>
  );
};

export default App;