import React from "react";

type PlaybackSpeedSelectorProps = {
  value: number;
  onChange: (value: number) => void;
  options: number[];
};

const PlaybackSpeedSelector: React.FC<PlaybackSpeedSelectorProps> = ({ value, onChange, options }) => (
  <div className="ml-2 flex items-center">
    <label htmlFor="playback-speed" className="text-gray-400 text-xs mr-1">Speed</label>
    <select
      id="playback-speed"
      className="bg-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}x</option>
      ))}
    </select>
  </div>
);

export default PlaybackSpeedSelector; 