import CategoryTab from './_components/CategoryTab';
import SubjectColumns from './_components/SubjectColumns';

const page = () => {
  return (
    <main className="p-4">
      <div className="flex flex-col items-center space-y-4">
        <CategoryTab />
        <SubjectColumns />
      </div>
    </main>
  );
};

export default page;
