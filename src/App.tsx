import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MenuIntelligence from './pages/MenuIntelligence';
import DishDetail from './pages/DishDetail';
import RecipeCosting from './pages/RecipeCosting';
import SalesAnalytics from './pages/SalesAnalytics';
import Ingredients from './pages/Ingredients';
import Recommendations from './pages/Recommendations';
import Simulator from './pages/Simulator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { EmptyState } from './components/ui';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="menu" element={<MenuIntelligence />} />
          <Route path="dish/:id" element={<DishDetail />} />
          <Route path="costing" element={<RecipeCosting />} />
          <Route path="sales" element={<SalesAnalytics />} />
          <Route path="ingredients" element={<Ingredients />} />
          <Route path="ai" element={<Recommendations />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<EmptyState title="Page not found" hint="That route doesn't exist in MarginMind." />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
