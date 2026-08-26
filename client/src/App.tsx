import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Layout } from '@/components/layout';
import BuildPage from '@/pages/build';
import LeaderboardPage from '@/pages/leaderboard';
import RulesPage from '@/pages/rules';
import AdminPage from '@/pages/admin';
import NotFound from '@/pages/not-found';

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={BuildPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/rules" component={RulesPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <Layout>
            <AppRouter />
          </Layout>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
