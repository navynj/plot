import HomeNav from '@/components/layout/HomeNav';
import React from 'react';

const layout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <div>
      {children}
      <HomeNav />
    </div>
  );
};

export default layout;
