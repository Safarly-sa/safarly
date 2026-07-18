import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { I18nProvider } from '@/providers/I18nProvider';

import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';

import { Home } from '@/pages/home';
import { StubPage } from '@/pages/stub';
import NotFound from '@/pages/not-found';

import { 
  UserCircle, 
  Map, 
  Wand2, 
  ListTodo, 
  Camera, 
  MessageCircle, 
  LayoutDashboard 
} from 'lucide-react';

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full relative">
        <Switch>
          <Route path="/" component={Home} />
          
          <Route path="/onboarding">
            <StubPage id="onboarding" icon={UserCircle} />
          </Route>
          
          <Route path="/trip">
            <StubPage id="trip" icon={Map} />
          </Route>
          
          <Route path="/generating">
            <StubPage id="generating" icon={Wand2} />
          </Route>
          
          <Route path="/itinerary">
            <StubPage id="itinerary" icon={ListTodo} />
          </Route>
          
          <Route path="/lens">
            <StubPage id="lens" icon={Camera} />
          </Route>
          
          <Route path="/dialect">
            <StubPage id="dialect" icon={MessageCircle} />
          </Route>
          
          <Route path="/dashboard">
            <StubPage id="dashboard" icon={LayoutDashboard} />
          </Route>

          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;