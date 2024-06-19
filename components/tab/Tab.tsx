import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import React from 'react';
import { FieldValues } from 'react-hook-form';

interface TabItemType {
  label: string;
  value: string;
}

interface TabProps<T extends FieldValues> extends ClassNameProps {
  id: string;
  value: string;
  setValue: any;
  tabs: (TabItemType | React.ReactNode)[];
}
const Tab = <T extends FieldValues>({
  id,
  value,
  setValue,
  tabs,
  className,
}: TabProps<T>) => {
  return (
    <ul className={cn('flex items-center flex-wrap gap-x-4', className)}>
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
