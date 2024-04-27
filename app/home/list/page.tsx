import CategoryTab from './_components/CategoryTab';
import SubjectColumns from './_components/SubjectColumns';
import TodoList from './_components/TodoList';

const page = () => {
  return (
    <main className="p-4 lg:flex lg:space-x-16 lg:h-screen lg:mt-48 max-w-[1280px] mx-auto">
      <div className="flex flex-col items-center space-y-4 lg:w-[50%]">
        <CategoryTab />
        <SubjectColumns />
      </div>
      <div className="lg:w-[50%]">
        <TodoList />
      </div>
    </main>
  );
};

export default page;
