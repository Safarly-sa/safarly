import { Component, type ReactNode } from 'react';
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
import { Onboarding } from '@/pages/onboarding';
import { Trip } from '@/pages/trip';
import { StubPage } from '@/pages/stub';
import NotFound from '@/pages/not-found';

import { 
  Wand2, 
  ListTodo, 
  Camera, 
  MessageCircle, 
  LayoutDashboard 
} from 'lucide-react';

/* ── Error boundary ─────────────────────────────────────────────────── */
interface EBState { error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100dvh', padding: '40px 20px',
          background: 'var(--sf-bg)', color: 'var(--sf-text)', textAlign: 'center',
          gap: '16px',
        }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</p>
          <p style={{ color: 'var(--sf-text-muted)', fontSize: '0.875rem', maxWidth: '420px', lineHeight: 1.6 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              marginTop: '8px', padding: '12px 28px', borderRadius: '10px',
              border: 'none', background: 'var(--sf-accent)', color: '#0A0E16',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full relative">
        <Switch>
          <Route path="/" component={Home} />
          
          <Route path="/onboarding" component={Onboarding} />
          
          <Route path="/trip" component={Trip} />
          
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
        <AppErrorBoundary>
          <I18nProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </I18nProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;