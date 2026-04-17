import React from 'react';

// Temporarily reuse the existing home implementation during migration.
// You can later replace this with the new subject-focused homepage.
import LegacyHomeScreen from '../../../app/(tabs)/index';

const HomeScreen = () => {
  return <LegacyHomeScreen />;
};

export default HomeScreen;


