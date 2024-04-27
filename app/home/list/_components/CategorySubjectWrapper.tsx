'use client';

import { useState } from 'react';
import CategoryTab from './CategoryTab';
import SubjectColumns from './SubjectColumns';

const CategorySubjectWrapper = () => {
  const [currentCategory, setCurrentCategory] = useState('all');

  return (
    <>
      <CategoryTab setCategory={setCurrentCategory} />
      <SubjectColumns category={currentCategory} />
    </>
  );
};

export default CategorySubjectWrapper;
