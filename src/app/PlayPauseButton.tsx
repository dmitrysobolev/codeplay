import React from "react";

type PlayPauseButtonProps = {
  isPlaying: boolean;
  onClick: () => void;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
};

const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({ isPlaying, onClick, disabled, buttonRef }) => {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"} text-white`}
      onClick={onClick}
      disabled={disabled}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <polygon points="8,5 20,12 8,19" fill="currentColor" />
        </svg>
      )}
    </button>
  );
};

export default PlayPauseButton; 