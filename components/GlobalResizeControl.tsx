import React from 'react';
import { TEXTURE_SIZES } from '../constants/textureSizes';

type GlobalResizeControlProps = {
  value: number;
  onChange: (size: number) => void;
};

const GlobalResizeControl = ({ value, onChange }: GlobalResizeControlProps) => (
  <div className="flex flex-col sm:flex-row items-center gap-2">
    <label htmlFor="global-resize" className="text-gray-300">
      Resize all to (max):
    </label>
    <select
      id="global-resize"
      value={value}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
    >
      <option value={0}>-- Select Size --</option>
      {TEXTURE_SIZES.slice(1).map(size => (
        <option key={size} value={size}>
          {size} x {size}
        </option>
      ))}
    </select>
  </div>
);

export default GlobalResizeControl;
