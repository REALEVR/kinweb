import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App } from "./App";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./lib/auth";
import { MePage } from "./pages/MePage";
import { PersonPage } from "./pages/PersonPage";
import { SignInPage } from "./pages/SignInPage";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<App />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/p/:id" element={<PersonPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
