import React from 'react';
import { UploadIcon } from './icons';

type UploadPromptProps = {
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const UploadPrompt = ({ onFileChange }: UploadPromptProps) => (
  <section className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col items-center justify-center gap-4 text-center">
    <UploadIcon className="w-12 h-12 text-gray-500" />
    <p className="text-lg text-gray-400 max-w-sm">
      Upload a VRM file to get started. After the file is parsed we'll show a live preview of your model and the texture controls.
    </p>
    <label className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
      Select File
      <input type="file" className="hidden" accept=".vrm" onChange={onFileChange} />
    </label>
  </section>
);

export default UploadPrompt;
