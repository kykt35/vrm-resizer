import React from 'react';
import Spinner from './Spinner';

type LoadingIndicatorProps = {
  statusMessage: string;
};

const LoadingIndicator = ({ statusMessage }: LoadingIndicatorProps) => (
  <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg p-12 text-center">
    <Spinner className="w-16 h-16 mb-4" />
    <p className="text-xl text-gray-300">{statusMessage}</p>
  </div>
);

export default LoadingIndicator;
