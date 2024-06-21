export const findParentByClassName = (
  element: Element | null,
  className: string
): HTMLElement | null => {
  if (element === null) return null;

  const parent = element.parentElement;
  if (parent?.classList.contains(className)) {
    return parent;
  } else {
    return findParentByClassName(parent, className);
  }
};
