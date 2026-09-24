// Utility function to scroll to top
export const scrollToTop = (behavior = 'smooth') => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior
  });
};

// Hook to scroll to top on route change
export const useScrollToTop = () => {
  return scrollToTop;
};
