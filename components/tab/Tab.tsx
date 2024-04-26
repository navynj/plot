import React from 'react';

interface TabItemType {
  label: string;
  value: string;
  checked?: boolean;
}

interface TabProps {
  id: string;
  tabs: (TabItemType | React.ReactNode)[];
}
const Tab = ({ id, tabs }: TabProps) => {
  return (
    <div className="flex items-center flex-wrap space-x-4">
      {tabs.map((tab) => {
        if (!tab) {
          return;
        }

        if (React.isValidElement(tab)) {
          return tab;
        }

        const tabData = tab as TabItemType;
        return (
          <div
            key={tabData.value}
            className="font-extrabold text-gray-300 [&>input:checked+label]:text-primary"
          >
            <input
              id={`${id}-${tabData.value}`}
              type="radio"
              value={tabData.value}
              name="id"
              defaultChecked={tabData.checked}
              hidden
            />
            <label htmlFor={`${id}-${tabData.value}`} className="cursor-pointer">
              {tabData.label}
            </label>
          </div>
        );
      })}
    </div>
  );
};

export default Tab;
