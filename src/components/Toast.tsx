import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  return (
    <div id="toast" className={message ? 'show' : ''} role="status">
      {message}
    </div>
  );
};
