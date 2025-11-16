import React from 'react';

type ErrorBannerProps = {
  message: string;
};

const ErrorBanner = ({ message }: ErrorBannerProps) => (
  <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative" role="alert">
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

export default ErrorBanner;
