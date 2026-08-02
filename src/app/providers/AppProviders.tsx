import React, { ReactNode } from "react";
import { AuthProvider } from "../../context/AuthContext";
import { UiFeedbackProvider } from "../../context/UiFeedbackContext";
import { SmartWorkspaceProvider } from "../../context/SmartWorkspaceContext";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <UiFeedbackProvider>
      <AuthProvider>
        <SmartWorkspaceProvider>
          {children}
        </SmartWorkspaceProvider>
      </AuthProvider>
    </UiFeedbackProvider>
  );
};

export default AppProviders;
