import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey="pk_test_d2FudGVkLWhhZGRvY2stNDEuY2xlcmsuYWNjb3VudHMuZGV2JA" afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);