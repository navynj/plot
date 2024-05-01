import React from 'react';

interface TabItemType {
  label: string;
  value: string;
}

interface TabProps {
  id: string;
  value: string;
  setValue: any;
  tabs: (TabItemType | React.ReactNode)[];
}
const Tab = ({ id, value, setValue, tabs }: TabProps) => {
  return (
    <ul className="flex items-center flex-wrap space-x-4">
      {tabs.map((tab) => {
        if (!tab) {
          return;
        }

        if (React.isValidElement(tab)) {
          return tab;
        }

        const tabData = tab as TabItemType;

        const changeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
          setValue && setValue(event.target.value);
        };

        return (
          <li
            key={tabData.value}
            className="font-extrabold text-gray-300 [&>input:checked+label]:text-primary"
          >
            <input
              id={`${id}-${tabData.value}`}
              type="radio"
              value={tabData.value}
              name={id}
              checked={value === tabData.value}
              onChange={changeHandler}
              hidden
            />
            <label htmlFor={`${id}-${tabData.value}`} className="cursor-pointer">
              {tabData.label}
            </label>
          </li>
        );
      })}
    </ul>
  );
};

export default Tab;
