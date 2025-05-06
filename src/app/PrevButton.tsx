import React from "react";

type PrevButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

const PrevButton: React.FC<PrevButtonProps> = ({ onClick, disabled, ariaLabel = "Previous" }) => (
  <button
    type="button"
    className="w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-zinc-700 hover:bg-zinc-600 text-white"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="16,5 8,12 16,19" fill="currentColor" />
    </svg>
  </button>
);

export default PrevButton; 